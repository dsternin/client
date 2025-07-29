import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";

import { ChapterSchema, loadChapter } from "../chapters/route";

export const BookSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    chapters: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

export async function getBookChaptersWithTitles(bookDoc) {
  const chapterMap = new Map();

  for (const id of bookDoc.chapters) {
    try {
      const content = await loadChapter(bookDoc.name, id);
      const points = extractH2FromTipTap(content);

      chapterMap.set(id, {
        section: id,
        title: id,
        points,
      });
    } catch (err) {
      console.warn(`⚠️ Не вдалося завантажити розділ ${id}:`, err);
      chapterMap.set(id, { section: id, title: id, points: [] });
    }
  }

  return bookDoc.chapters.map(
    (id) => chapterMap.get(id) || { section: id, title: id, points: [] }
  );
}

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const bookName = searchParams.get("book");

    if (!bookName) {
      return NextResponse.json({ error: "Missing book name" }, { status: 400 });
    }

    const bookDoc = await Book.findOne({ name: bookName });
    if (!bookDoc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const chapterNames = await getBookChaptersWithTitles(bookDoc);

    return NextResponse.json({
      name: bookDoc.name,
      chapters: chapterNames,
      label: bookDoc.label,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await dbConnect();
    const { book, chapters } = await req.json();

    if (!book || !Array.isArray(chapters)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const updated = await Book.findOneAndUpdate(
      { name: book },
      { chapters },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ ok: true, id: updated._id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function extractH2FromTipTap(content) {
  const points = [];

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    if (node.type === "heading" && node.attrs?.level === 2) {
      const text = extractText(node);
      points.push({
        title: text,
      });
    }

    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  function extractText(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (Array.isArray(node.content)) {
      return node.content.map(extractText).join("");
    }
    return "";
  }
  traverse(content);
  return points;
}
