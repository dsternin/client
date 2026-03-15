import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

const chapterCache = new Map();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const ChapterSchema = new mongoose.Schema(
  {
    book: { type: String, required: true },
    section: { type: String, required: true },
    content: { type: Object },
  },
  { timestamps: true },
);

ChapterSchema.index({ book: 1, section: 1 }, { unique: true });

const AnchorSchema = new mongoose.Schema(
  {
    book: { type: String, required: true, index: true },
    section: { type: String, required: true, index: true },
    anchorId: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true },
);

AnchorSchema.index({ book: 1, anchorId: 1 }, { unique: true });
AnchorSchema.index({ book: 1, section: 1 });

const AnchorModel =
  mongoose.models.Anchor || mongoose.model("Anchor", AnchorSchema);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");
    const book = searchParams.get("book");

    if (!book || !section) {
      return NextResponse.json(
        { error: "Параметры 'book' и 'section' обязательны" },
        { status: 400 },
      );
    }

    const content = await loadChapter(book, section);
    return NextResponse.json({ content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const reader = req.body?.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    result += decoder.decode();
    const body = JSON.parse(result);

    const { book, section, content } = body;

    if (!book || !section || !content) {
      return NextResponse.json({ error: "Данные неполные" }, { status: 400 });
    }

    const sectionName = await saveChapter(
      book,
      section,
      JSON.stringify(content),
    );

    await syncChapterAnchors(book, section, content);

    return NextResponse.json({
      message: "Контент и якоря сохранены",
      section: sectionName,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function saveChapter(book, section, content) {
  chapterCache.delete(`${book}_${section}`);

  const conn = await dbConnect();
  const db = conn.connection.db;
  const bucket = new GridFSBucket(db);

  const stream = Readable.from([content]);
  const uploadStream = bucket.openUploadStream(`${book}_${section}`, {
    metadata: { book, section },
  });

  return new Promise((resolve, reject) => {
    stream
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => {
        resolve(section);
      });
  });
}

export async function loadChapter(book, section) {
  const key = `${book}_${section}`;
  console.log(`start ${key}`);

  const cached = chapterCache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < ONE_DAY_MS) {
    console.log(`Chapter from cache ${book}_${section}`);
    return cached.data;
  }

  const conn = await dbConnect();
  const db = conn.connection.db;
  const bucket = new GridFSBucket(db);
  const filename = `${book}_${section}`;

  const downloadStream = bucket.openDownloadStreamByName(filename);
  const chunks = [];

  return new Promise((resolve, reject) => {
    downloadStream
      .on("data", (chunk) => {
        chunks.push(chunk);
      })
      .on("end", () => {
        try {
          const buffer = Buffer.concat(chunks);
          const data = JSON.parse(buffer.toString("utf-8"));

          chapterCache.set(key, { data, timestamp: now });
          console.log(`end ${key}`);
          resolve(data);
        } catch (e) {
          console.error("❌ JSON parsing error", e);
          reject(e);
        }
      })
      .on("error", (err) => {
        console.error("❌ Stream error:", err);
        reject(err);
      });
  });
}

function extractAnchorsFromTiptapJSON(content) {
  const anchors = [];
  const seen = new Set();

  function walk(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node !== "object") return;

    if (node.type === "text" && Array.isArray(node.marks) && node.text) {
      for (const mark of node.marks) {
        if (mark?.type === "anchor" && mark?.attrs?.anchorId) {
          const anchorId = String(mark.attrs.anchorId).trim();
          const text = String(node.text).trim();

          if (!anchorId || !text) continue;

          const key = `${anchorId}__${text}`;
          if (!seen.has(key)) {
            seen.add(key);
            anchors.push({ anchorId, text });
          }
        }
      }
    }

    if (node.content) {
      walk(node.content);
    }
  }

  walk(content);
  return anchors;
}

async function syncChapterAnchors(book, section, content) {
  await dbConnect();

  const anchors = extractAnchorsFromTiptapJSON(content);

  await AnchorModel.deleteMany({ book, section });

  if (!anchors.length) return;

  const docs = anchors.map((anchor) => ({
    book,
    section,
    anchorId: anchor.anchorId,
    text: anchor.text,
  }));

  await AnchorModel.insertMany(docs, { ordered: false });
}
