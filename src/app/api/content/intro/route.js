import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

const ContentSchema = new mongoose.Schema(
  {
    section: { type: String, unique: true },
    content: { type: Object },
  },
  { timestamps: true }
);

const Content =
  mongoose.models.Content || mongoose.model("Content", ContentSchema);

export async function GET() {
  try {
    await dbConnect();

    const entry = await Content.findOne({ section: "intro" });

    if (!entry) {
      return NextResponse.json({ content: null });
    }

    return NextResponse.json({ content: entry.content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const { content } = body;
    console.log(content);

    if (!content) {
      return NextResponse.json({ error: "Контент пустой" }, { status: 400 });
    }

    const updated = await Content.findOneAndUpdate(
      { section: "intro" },
      { content },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ message: "Контент сохранен", data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
