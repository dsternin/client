import dbConnect from "@/lib/db";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  BookSchema,
  getBookChaptersWithTitles,
} from "@/app/api/content/books/route";
import { ChapterSchema } from "@/app/api/content/chapters/route";

const Chapter =
  mongoose.models.Chapter || mongoose.model("Chapter", ChapterSchema);
const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const bookName = searchParams.get("book");
  const query = searchParams.get("query");

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "Не указан поисковый запрос" },
      { status: 400 }
    );
  }
  if (!bookName) {
    return NextResponse.json(
      { error: "Параметр 'book' обязателен" },
      { status: 400 }
    );
  }

  await dbConnect();

  const bookDoc = await Book.findOne({ name: bookName });
  if (!bookDoc) {
    return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
  }

  const sections = await getBookChaptersWithTitles(bookDoc);


  const chapters = await Promise.all(
    sections.map((section) =>
      Chapter.findOne({ book: bookName, section: section.title })
    )
  );

  const matches = [];
  let blockOffset = 0;

  for (const chapter of chapters) {
    if (!chapter || !chapter.content?.content) continue;

    const localMatches = findWordInTipTapContent(
      chapter.content.content,
      query,
      blockOffset
    );

    localMatches.forEach((m) => {
      matches.push({
        section: chapter.section,
        ...m,
      });
    });

    blockOffset += chapter.content.content.length;
  }

  return NextResponse.json({
    count: matches.length,
    matches,
  });
}

function findWordInTipTapContent(contentArray, search, blockOffset = 0) {
  const matches = [];
  const lowerSearch = search.toLowerCase();

  contentArray.forEach((block, blockIndex) => {
    searchInNode(
      block,
      blockOffset + blockIndex,
      [],
      lowerSearch,
      search,
      matches
    );
  });

  return matches;
}

function searchInNode(
  node,
  globalBlockIndex,
  childPath,
  lowerSearch,
  search,
  matches
) {
  if (node.text) {
    const text = node.text.toLowerCase();
    let pos = -1;
    while ((pos = text.indexOf(lowerSearch, pos + 1)) !== -1) {
      matches.push({
        blockIndex: globalBlockIndex,
        childIndexPath: [...childPath],
        charIndex: pos,
        length: search.length,
      });
    }
  }

  if (node.content) {
    node.content.forEach((child, idx) => {
      searchInNode(
        child,
        globalBlockIndex,
        [...childPath, idx],
        lowerSearch,
        search,
        matches
      );
    });
  }
}
