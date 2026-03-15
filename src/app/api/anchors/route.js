import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

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

const AnchorModel =
  mongoose.models.Anchor || mongoose.model("Anchor", AnchorSchema);

export async function GET() {
  try {
    await dbConnect();

    const anchors = await AnchorModel.find({})
      .sort({ book: 1, section: 1, text: 1 })
      .lean();

    return NextResponse.json({
      anchors: anchors.map((item) => ({
        id: item.anchorId,
        text: item.text,
        book: item.book,
        section: item.section,

        href: `/reader?book=${encodeURIComponent(item.book)}&section=${encodeURIComponent(item.section)}&anchor=${encodeURIComponent(item.anchorId)}`,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Ошибка получения якорей" },
      { status: 500 },
    );
  }
}
