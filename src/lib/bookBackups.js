import { createHash, randomUUID } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readdir, rename, stat, unlink } from "fs/promises";
import path from "path";
import { createInterface } from "readline";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip, createGzip } from "zlib";
import { BSON } from "mongodb";
import dbConnect from "@/lib/db";

const COLLECTIONS = [
  "books",
  "chapters",
  "anchors",
  "contents",
  "images",
  "fs.files",
  "fs.chunks",
];
const BACKUP_PATTERN = /^backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)-([0-9a-f-]{36})\.json\.gz$/;
const MAX_BACKUPS = 20;

function backupDirectory() {
  const root = process.env.BACKUP_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (!root || (process.env.NODE_ENV === "production" && !path.isAbsolute(root))) {
    throw new Error("BACKUP_DIR или RAILWAY_VOLUME_MOUNT_PATH должен указывать на постоянное хранилище");
  }
  return path.join(path.resolve(root), "book-backups");
}

function isLocalRelativeStorage() {
  const root = process.env.BACKUP_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return process.env.NODE_ENV !== "production" && root && !path.isAbsolute(root);
}

function backupPath(id) {
  if (typeof id !== "string" || !BACKUP_PATTERN.test(id)) {
    throw new Error("Некорректное имя бекапа");
  }
  return path.join(backupDirectory(), id);
}

async function ensureBackupDirectory() {
  const directory = backupDirectory();
  if (isLocalRelativeStorage()) {
    await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  }
  const root = await stat(path.dirname(directory));
  if (!root.isDirectory()) throw new Error("Путь к хранилищу бекапов не является каталогом");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export async function listBookBackups() {
  const directory = backupDirectory();
  try {
    const root = await stat(path.dirname(directory));
    if (!root.isDirectory()) throw new Error("Путь к хранилищу бекапов не является каталогом");
  } catch (error) {
    if (error.code === "ENOENT" && isLocalRelativeStorage()) return [];
    throw error;
  }
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const backups = [];
  for (const id of entries) {
    const match = BACKUP_PATTERN.exec(id);
    if (!match) continue;
    const file = await stat(path.join(directory, id));
    if (!file.isFile()) continue;
    backups.push({
      id,
      createdAt: match[1].replace(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/,
        "$1T$2:$3:$4",
      ),
      size: file.size,
    });
  }
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function pruneBackups() {
  const backups = await listBookBackups();
  for (const backup of backups.slice(MAX_BACKUPS)) {
    await unlink(backupPath(backup.id));
  }
}

async function* snapshotLines(db, session, createdAt, book, onProgress) {
  const hash = createHash("sha256");
  const counts = Object.fromEntries(COLLECTIONS.map((name) => [name, 0]));
  let total = 0;
  let processed = 0;
  onProgress?.("Подсчет документов", null);
  for (const name of COLLECTIONS) {
    total += await db.collection(name).countDocuments({}, { session });
  }
  const header = JSON.stringify({ type: "header", version: 1, createdAt, book, collections: COLLECTIONS });
  hash.update(`${header}\n`);
  yield `${header}\n`;

  for (const name of COLLECTIONS) {
    onProgress?.(`Копирование: ${name}`, total ? processed / total : 0);
    const cursor = db.collection(name).find({}, { session, promoteValues: false });
    try {
      for await (const document of cursor) {
        const line = BSON.EJSON.stringify({ type: "document", collection: name, document }, { relaxed: false });
        hash.update(`${line}\n`);
        counts[name] += 1;
        processed += 1;
        onProgress?.(`Копирование: ${name}`, total ? processed / total : 1);
        yield `${line}\n`;
      }
    } finally {
      await cursor.close();
    }
  }

  yield `${JSON.stringify({ type: "footer", counts, sha256: hash.digest("hex") })}\n`;
}

export async function createBookBackup(book, onProgress) {
  onProgress?.("Подготовка хранилища", null);
  await ensureBackupDirectory();
  const createdAt = new Date().toISOString();
  const id = `backup-${createdAt.replace(/:/g, "-")}-${randomUUID()}.json.gz`;
  const destination = backupPath(id);
  const temporary = `${destination}.tmp`;
  const connection = await dbConnect();
  const db = connection.connection.db;
  const session = connection.connection.getClient().startSession();
  let completed = false;
  try {
    session.startTransaction({ readConcern: { level: "snapshot" } });
    await pipeline(
      Readable.from(snapshotLines(db, session, createdAt, book, onProgress)),
      createGzip(),
      createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
    );
    onProgress?.("Завершение записи бекапа", 0.99);
    await session.commitTransaction();
    await rename(temporary, destination);
    completed = true;
  } finally {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
    if (!completed) {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") console.error("Не удалось удалить временный бекап:", error);
      });
    }
  }
  try {
    await pruneBackups();
  } catch (error) {
    console.error("Не удалось удалить старые бекапы:", error);
  }
  return { id, createdAt };
}

async function readBackup(id, onDocument, onProgress) {
  const file = backupPath(id);
  const fileSize = onProgress ? (await stat(file)).size : 0;
  const input = createReadStream(file);
  const gunzip = createGunzip();
  const lines = createInterface({ input: gunzip, crlfDelay: Infinity });
  input.on("error", (error) => gunzip.destroy(error));
  let streamError = null;
  gunzip.on("error", (error) => {
    streamError = error;
    lines.close();
  });
  input.pipe(gunzip);
  const hash = createHash("sha256");
  const counts = Object.fromEntries(COLLECTIONS.map((name) => [name, 0]));
  let headerSeen = false;
  let footerSeen = false;
  try {
    for await (const line of lines) {
      if (onProgress && fileSize) onProgress(Math.min(input.bytesRead / fileSize, 1));
      if (footerSeen) throw new Error("Данные после конца бекапа");
      const record = JSON.parse(line);
      if (!headerSeen) {
        if (record.type !== "header" || record.version !== 1 ||
          JSON.stringify(record.collections) !== JSON.stringify(COLLECTIONS)) {
          throw new Error("Неподдерживаемый формат бекапа");
        }
        headerSeen = true;
      } else if (record.type === "footer") {
        if (record.sha256 !== hash.digest("hex") ||
          COLLECTIONS.some((name) => record.counts?.[name] !== counts[name])) {
          throw new Error("Проверка целостности бекапа не пройдена");
        }
        footerSeen = true;
        continue;
      } else if (record.type === "document" && COLLECTIONS.includes(record.collection) &&
        record.document && typeof record.document === "object" && record.document._id != null) {
        counts[record.collection] += 1;
        if (onDocument) {
          const parsed = BSON.EJSON.parse(line, { relaxed: false });
          await onDocument(record.collection, parsed.document);
        }
      } else {
        throw new Error("Некорректная запись в бекапе");
      }
      hash.update(`${line}\n`);
    }
    if (streamError) throw streamError;
    if (!headerSeen || !footerSeen) throw new Error("Бекап неполный");
    return counts;
  } finally {
    lines.close();
    input.destroy();
    gunzip.destroy();
  }
}

export async function restoreBookBackup(id, onProgress) {
  onProgress?.("Проверка бекапа", 0);
  const counts = await readBackup(id, undefined, (fraction) => {
    onProgress?.("Проверка бекапа", fraction * 0.2);
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const connection = await dbConnect();
  const db = connection.connection.db;
  const session = connection.connection.getClient().startSession();
  try {
    await session.withTransaction(async () => {
      onProgress?.("Подготовка восстановления", 0.2);
      for (const [index, name] of COLLECTIONS.entries()) {
        await db.collection(name).deleteMany({}, { session });
        onProgress?.("Подготовка восстановления", 0.2 + (index + 1) / COLLECTIONS.length * 0.1);
      }
      let batchName = null;
      let batch = [];
      let batchSize = 0;
      let restored = 0;
      const flushBatch = async () => {
        if (!batch.length) return;
        await db.collection(batchName).insertMany(batch, { session });
        batch = [];
        batchSize = 0;
      };
      await readBackup(id, async (name, document) => {
        const size = BSON.calculateObjectSize(document);
        if (batchName !== name || batch.length >= 100 || batchSize + size > 8 * 1024 * 1024) {
          await flushBatch();
          batchName = name;
        }
        batch.push(document);
        batchSize += size;
        restored += 1;
        onProgress?.(`Восстановление: ${name}`, 0.3 + (total ? restored / total : 1) * 0.65);
      });
      await flushBatch();
      await db.collection("backup_state").updateOne(
        { _id: "content-version" },
        { $set: { version: randomUUID() } },
        { upsert: true, session },
      );
      onProgress?.("Подтверждение транзакции", 0.97);
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
}
