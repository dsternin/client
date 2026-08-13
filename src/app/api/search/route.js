import dbConnect from "@/lib/db";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  BookSchema,
  ensureThesaurusBook,
  getBookChaptersWithTitles,
} from "@/app/api/content/books/route";
import { loadChapter } from "@/app/api/content/chapters/route";
import { THESAURUS_BOOK_NAME } from "@/lib/thesaurus";

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const bookName = searchParams.get("book");
  const query = searchParams.get("query");

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { error: "Не указан поисковый запрос" },
      { status: 400 },
    );
  }

  await dbConnect();
  await ensureThesaurusBook();

  const matches = [];

  if (bookName) {
    // Search in a single book
    const bookDoc = await Book.findOne({ name: bookName });
    if (!bookDoc) {
      return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
    }

    const sections = await getBookChaptersWithTitles(bookDoc);
    const chapters = await Promise.all(
      sections.map((section) => loadChapter(bookName, section.title)),
    );

    let blockOffset = 0;
    for (let i = 0; i < chapters.length; i++) {
      const chapterData = chapters[i];
      if (!chapterData) continue;

      // Normalize chapter data shape
      let doc = null;
      if (chapterData.content && Array.isArray(chapterData.content)) {
        doc = { type: chapterData.type, content: chapterData.content };
      } else if (chapterData.content && chapterData.content.content) {
        doc = chapterData.content;
      } else {
        doc = chapterData;
      }

      const contentArray = (doc && Array.isArray(doc.content)) ? doc.content : [];
      if (!contentArray.length) continue;

      const localMatches = findWordInTipTapContent(
        contentArray,
        query,
        blockOffset,
      );

      if (bookName === THESAURUS_BOOK_NAME) {
        localMatches.push(
          ...findThesaurusSynonymMatches(contentArray, query, blockOffset),
        );
      }

      localMatches.forEach((m) => {
        matches.push({
          book: bookName,
          section: sections[i].title,
          ...m,
        });
      });

      blockOffset += contentArray.length;
    }
  } else {
    // Search across all books
    const books = await Book.find({});

    for (const bookDoc of books) {
      const sections = await getBookChaptersWithTitles(bookDoc);
      const chapters = await Promise.all(
        sections.map((section) => loadChapter(bookDoc.name, section.title)),
      );

      let blockOffset = 0;
      for (let i = 0; i < chapters.length; i++) {
        const chapterData = chapters[i];
        if (!chapterData) continue;

        // Normalize chapter data shape
        let doc = null;
        if (chapterData.content && Array.isArray(chapterData.content)) {
          doc = { type: chapterData.type, content: chapterData.content };
        } else if (chapterData.content && chapterData.content.content) {
          doc = chapterData.content;
        } else {
          doc = chapterData;
        }

        const contentArray = (doc && Array.isArray(doc.content)) ? doc.content : [];
        if (!contentArray.length) continue;

        const localMatches = findWordInTipTapContent(
          contentArray,
          query,
          blockOffset,
        );

        if (bookDoc.name === THESAURUS_BOOK_NAME) {
          localMatches.push(
            ...findThesaurusSynonymMatches(contentArray, query, blockOffset),
          );
        }

        localMatches.forEach((m) => {
          matches.push({
            book: bookDoc.name,
            section: sections[i].title,
            ...m,
          });
        });

        blockOffset += contentArray.length;
      }
    }
  }

  return NextResponse.json({
    count: matches.length,
    matches,
  });
}

function findWordInTipTapContent(contentArray, search, blockOffset = 0) {
  const matches = [];

  contentArray.forEach((block, blockIndex) => {
    searchInNode(block, blockOffset + blockIndex, [], search, matches);
  });

  return matches;
}

function findThesaurusSynonymMatches(contentArray, search, blockOffset = 0) {
  const normalizedSearch = String(search || "").toLocaleLowerCase("uk");
  if (!normalizedSearch) return [];

  const matches = [];

  contentArray.forEach((block, blockIndex) => {
    if (block?.type !== "heading" || block?.attrs?.level !== 2) return;

    const synonyms = Array.isArray(block?.attrs?.synonyms)
      ? block.attrs.synonyms
      : [];
    const hasMatch = synonyms.some((synonym) =>
      String(synonym || "").toLocaleLowerCase("uk").includes(normalizedSearch),
    );

    if (!hasMatch) return;

    const termText = block?.content?.[0]?.text || "";
    if (!termText) return;

    matches.push({
      blockIndex: blockOffset + blockIndex,
      childIndexPath: [0],
      charIndex: 0,
      length: termText.length,
    });
  });

  return matches;
}

function searchInNode(node, globalBlockIndex, childPath, search, matches) {
  if (node.text) {
    const text = node.text;
    let pos = -1;

    while ((pos = text.indexOf(search, pos + 1)) !== -1) {
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
        search,
        matches,
      );
    });
  }
}
