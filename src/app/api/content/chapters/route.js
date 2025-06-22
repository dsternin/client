import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

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
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");
    const book = searchParams.get("book");
    if (!book || !section) {
      return NextResponse.json(
        { error: "Параметры 'book' и 'section' обязательны" },
        { status: 400 }
      );
    }
    const entry = await Chapter.findOne({ book, section });
    if (!entry) return NextResponse.json({ content: null });

    return NextResponse.json({ content: entry.content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const { book, section, content } = body;

    if (!book || !section || !content) {
      return NextResponse.json({ error: "Данные неполные" }, { status: 400 });
    }

    const updated = await Chapter.findOneAndUpdate(
      { book, section },
      { content },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ message: "Контент сохранен", id: updated._id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
