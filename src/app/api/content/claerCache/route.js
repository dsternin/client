import dbConnect from "@/lib/db";
import { GridFSBucket } from "mongodb";
import { NextResponse } from "next/server";


export async function cleanAllOldFiles(db) {
  const bucket = new GridFSBucket(db);
  const files = await bucket.find({}).toArray();
  const grouped = files.reduce((acc, file) => {
    (acc[file.filename] = acc[file.filename] || []).push(file);
    return acc;
  }, {});

  for (const filename in grouped) {
    const versions = grouped[filename];
    if (versions.length <= 1) continue;
    versions.sort((a, b) => b.uploadDate - a.uploadDate);
    const [, ...oldFiles] = versions;
    for (const file of oldFiles) {
      await bucket.delete(file._id);
    }
  }
}

export async function GET() {
  const conn = await dbConnect();
  const db = conn.connection.db;
  await cleanAllOldFiles(db);
  return NextResponse.json({ message: "Кеш GridFS очищен" });
}
