import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { BookSchema } from "../books/route";
import {
  loadChapter,
  saveChapter,
  syncChapterAnchors,
} from "../chapters/route";

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

const DEFAULT_PAGE_SIZE = 500;

function parseInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDocument(content) {
  return { type: "doc", content };
}

async function readBookChapters(bookName) {
  const bookDoc = await Book.findOne({ name: bookName });
  if (!bookDoc) return null;

  const chapters = [];
  let totalBlocks = 0;

  for (const section of bookDoc.chapters) {
    const chapterData = await loadChapter(bookName, section);
    // Normalize possible shapes saved in GridFS:
    // - the file may contain the raw TipTap `doc` object
    // - or it may be wrapped as { content: doc }
    // - or other slight variants. Extract the inner array of blocks reliably.
    let doc = null;
    if (!chapterData) {
      doc = null;
    } else if (chapterData.content && Array.isArray(chapterData.content)) {
      // chapterData is actually the `doc` already
      doc = { type: chapterData.type, content: chapterData.content };
    } else if (chapterData.content && chapterData.content.content) {
      // chapterData is { content: doc }
      doc = chapterData.content;
    } else {
      doc = chapterData;
    }

    const blocks = (doc && Array.isArray(doc.content)) ? doc.content : [];
    chapters.push({ section, content: blocks, length: blocks.length });
    totalBlocks += blocks.length;
  }

  return { bookDoc, chapters, totalBlocks };
}

function sliceBookBlocks(chapters, start, end) {
  const pageBlocks = [];
  let currentIndex = 0;

  for (const chapter of chapters) {
    const chapterStart = currentIndex;
    const chapterEnd = currentIndex + chapter.length;

    if (chapterEnd <= start) {
      currentIndex = chapterEnd;
      continue;
    }

    if (chapterStart >= end) break;

    const sliceStart = Math.max(0, start - chapterStart);
    const sliceEnd = Math.min(chapter.length, end - chapterStart);

    if (sliceStart < sliceEnd) {
      pageBlocks.push(...chapter.content.slice(sliceStart, sliceEnd));
    }

    currentIndex = chapterEnd;
  }

  return pageBlocks;
}

async function updateBookPage(bookName, page, pageSize, pageContent) {
  const bookDoc = await Book.findOne({ name: bookName });
  if (!bookDoc) {
    throw new Error("Book not found");
  }

  if (pageSize === -1) {
    const updatedSections = [];
    let currentChapter = null;

    for (const block of pageContent) {
      if (block.type === "heading" && block.attrs?.level === 1) {
        if (currentChapter) {
          await saveChapter(
            bookName,
            currentChapter.slug,
            JSON.stringify(createDocument(currentChapter.content)),
          );
          await syncChapterAnchors(
            bookName,
            currentChapter.slug,
            createDocument(currentChapter.content),
          );
          updatedSections.push(currentChapter.slug);
        }

        const slug = block.content?.[0]?.text || "chapter";
        currentChapter = { slug, content: [block] };
      } else if (currentChapter) {
        currentChapter.content.push(block);
      }
    }

    if (currentChapter) {
      await saveChapter(
        bookName,
        currentChapter.slug,
        JSON.stringify(createDocument(currentChapter.content)),
      );
      await syncChapterAnchors(
        bookName,
        currentChapter.slug,
        createDocument(currentChapter.content),
      );
      updatedSections.push(currentChapter.slug);
    }

    await Book.findOneAndUpdate(
      { name: bookName },
      { chapters: updatedSections },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return updatedSections;
  }

  const start = page * pageSize;
  const end = start + pageSize;

  const pageBlocks = pageContent || [];
  const updatedSections = [];
  let currentIndex = 0;
  let pageSliceOffset = 0;

  for (const section of bookDoc.chapters) {
    const chapterData = await loadChapter(bookName, section);
    const originalBlocks = chapterData?.content?.content || [];
    const chapterLength = originalBlocks.length;
    const chapterStart = currentIndex;
    const chapterEnd = currentIndex + chapterLength;

    if (chapterEnd <= start) {
      currentIndex = chapterEnd;
      continue;
    }

    if (chapterStart >= end) break;

    const sliceStart = Math.max(0, start - chapterStart);
    const sliceEnd = Math.min(chapterLength, end - chapterStart);
    const pageSliceStart = Math.max(0, chapterStart - start);
    const pageSliceEnd = pageSliceStart + (sliceEnd - sliceStart);

    const updatedBlocks = [
      ...originalBlocks.slice(0, sliceStart),
      ...pageBlocks.slice(pageSliceStart, pageSliceEnd),
      ...originalBlocks.slice(sliceEnd),
    ];

    await saveChapter(
      bookName,
      section,
      JSON.stringify(createDocument(updatedBlocks)),
    );
    await syncChapterAnchors(
      bookName,
      section,
      createDocument(updatedBlocks),
    );

    updatedSections.push(section);
    pageSliceOffset += sliceEnd - sliceStart;
    currentIndex = chapterEnd;
  }

  return updatedSections;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bookName = searchParams.get("book");
    const page = parseInteger(searchParams.get("page"), 0);
    const pageSize = parseInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);

    if (!bookName) {
      return NextResponse.json(
        { error: "Missing book name" },
        { status: 400 },
      );
    }

    await dbConnect();
    const bookRead = await readBookChapters(bookName);
    if (!bookRead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { bookDoc, chapters, totalBlocks } = bookRead;
    const normalizedPageSize = pageSize === -1 ? -1 : Math.max(1, pageSize);
    const totalPages = normalizedPageSize === -1
      ? 1
      : Math.max(1, Math.ceil(totalBlocks / normalizedPageSize));

    const content =
      normalizedPageSize === -1
        ? chapters.flatMap((chapter) => chapter.content)
        : sliceBookBlocks(chapters, page * normalizedPageSize, page * normalizedPageSize + normalizedPageSize);

    return NextResponse.json({
      name: bookDoc.name,
      label: bookDoc.label,
      totalBlocks,
      page: normalizedPageSize === -1 ? 0 : page,
      pageSize: normalizedPageSize,
      totalPages,
      pageContent: createDocument(content),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
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
    const { book, page, pageSize, content } = body;

    if (!book || !Array.isArray(content) || typeof page !== "number") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const normalizedPageSize = pageSize === -1 ? -1 : Math.max(1, parseInteger(pageSize, DEFAULT_PAGE_SIZE));
    const updatedSections = await updateBookPage(book, page, normalizedPageSize, content);

    return NextResponse.json({ ok: true, updatedSections });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
