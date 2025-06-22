import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { ChapterSchema } from "../chapters/route";

export const BookSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    chapters: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

const Chapter =
  mongoose.models.Chapter || mongoose.model("Chapter", ChapterSchema);

export async function getBookChaptersWithTitles(bookDoc) {
  const chapters = await Chapter.find({
    _id: { $in: bookDoc.chapters },
  }).select("section");

  const chapterMap = new Map(
    chapters.map((ch) => [ch._id.toString(), ch.section])
  );

  return bookDoc.chapters.map((id) => chapterMap.get(id) || "");
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
