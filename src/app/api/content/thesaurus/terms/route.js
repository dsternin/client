import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { BookSchema, ensureThesaurusBook } from "../../books/route";
import { loadChapter } from "../../chapters/route";
import {
  getThesaurusTerms,
  THESAURUS_BOOK_NAME,
  THESAURUS_DEFAULT_SECTION,
} from "@/lib/thesaurus";

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

function normalizeDocContent(chapterData) {
  if (!chapterData) return [];

  if (chapterData.content && Array.isArray(chapterData.content)) {
    return chapterData.content;
  }

  if (chapterData.content && chapterData.content.content) {
    return Array.isArray(chapterData.content.content)
      ? chapterData.content.content
      : [];
  }

  return Array.isArray(chapterData.content) ? chapterData.content : [];
}

export async function GET() {
  try {
    await ensureThesaurusBook();

    const bookDoc = await Book.findOne({ name: THESAURUS_BOOK_NAME });
    const sections =
      Array.isArray(bookDoc?.chapters) && bookDoc.chapters.length > 0
        ? bookDoc.chapters
        : [THESAURUS_DEFAULT_SECTION];

    const allContent = [];
    for (const section of sections) {
      try {
        const chapterData = await loadChapter(THESAURUS_BOOK_NAME, section);
        const content = normalizeDocContent(chapterData);
        allContent.push(...content);
      } catch {
        // Skip missing/invalid chapter and continue collecting terms from others.
      }
    }

    const uniqueTerms = Array.from(new Set(getThesaurusTerms(allContent)));
    const terms = uniqueTerms.map((term) => ({
      id: term,
      title: term,
      href: `/reader?book=${THESAURUS_BOOK_NAME}&term=${encodeURIComponent(term)}`,
    }));

    return NextResponse.json({ terms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
