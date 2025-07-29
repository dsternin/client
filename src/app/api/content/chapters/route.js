import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

export const ChapterSchema = new mongoose.Schema(
  {
    book: { type: String, required: true },
    section: { type: String, required: true },
    content: { type: Object },
  },
  { timestamps: true }
);

ChapterSchema.index({ book: 1, section: 1 }, { unique: true });

const Chapter =
  mongoose.models.Chapter || mongoose.model("Chapter", ChapterSchema);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");
    const book = searchParams.get("book");

    if (!book || !section) {
      return NextResponse.json(
        { error: "Параметры 'book' и 'section' обязательны" },
        { status: 400 }
      );
    }
    // const entry = await Chapter.findOne({ book, section });
    // if (!entry) return NextResponse.json({ content: null });
    // return NextResponse.json({ content: entry.content });
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
      JSON.stringify(content)
    );

    return NextResponse.json({
      message: "Контент сохранен в GridFS",
      section: sectionName,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function saveChapter(book, section, content) {
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
      .on("finish", () => resolve(section));
  });
}

export async function loadChapter(book, section) {
  const conn = await dbConnect();
  const db = conn.connection.db;

  const bucket = new GridFSBucket(db);
  const filename = `${book}_${section}`;

  const downloadStream = bucket.openDownloadStreamByName(filename);
  // const downloadStream = bucket.openDownloadStream(section);

  const chunks = [];

  return new Promise((resolve, reject) => {
    downloadStream
      .on("data", (chunk) => {
        chunks.push(chunk);
      })
      .on("end", () => {
        const buffer = Buffer.concat(chunks);
        try {
          resolve(JSON.parse(buffer.toString("utf-8")));
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
