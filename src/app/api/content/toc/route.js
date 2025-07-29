// app/api/content/toc/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { BookSchema, getBookChaptersWithTitles } from "../books/route";

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

export async function GET() {
  try {
    await dbConnect();

    const books = await Book.find({});
    const result = [];

    for (const book of books) {
      console.log("start chapters");
      console.log(book.name);

      const chapters = await getBookChaptersWithTitles(book);
      console.log("end chapters");

      result.push({
        name: book.name,
        label: book.label,
        chapters,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
