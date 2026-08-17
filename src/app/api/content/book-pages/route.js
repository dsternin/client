import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import { BookSchema, clearChapterCache, ensureThesaurusBook } from "../books/route";
import {
  loadChapter,
  saveChapter,
  syncChapterAnchors,
} from "../chapters/route";
import {
  sortThesaurusContent,
  THESAURUS_BOOK_NAME,
  THESAURUS_DEFAULT_SECTION,
} from "@/lib/thesaurus";

const Book = mongoose.models.Book || mongoose.model("Book", BookSchema);

const DEFAULT_PAGE_SIZE = 500;

function parseInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDocument(content) {
  return { type: "doc", content };
}

function extractText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join("");
  }
  return "";
}

async function readBookChapters(bookName) {
  if (bookName === THESAURUS_BOOK_NAME) {
    await ensureThesaurusBook();
  }

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

function blockContainsAnchor(node, anchorId) {
  if (!node || !anchorId) return false;

  if (Array.isArray(node)) {
    return node.some((child) => blockContainsAnchor(child, anchorId));
  }

  if (typeof node !== "object") return false;

  if (Array.isArray(node.marks)) {
    const hasAnchor = node.marks.some(
      (mark) => mark?.type === "anchor" && mark?.attrs?.anchorId === anchorId,
    );
    if (hasAnchor) return true;
  }

  if (Array.isArray(node.content)) {
    return node.content.some((child) => blockContainsAnchor(child, anchorId));
  }

  return false;
}

function findHeadingBlockIndex(chapters, headingId) {
  let offset = 0;

  for (const chapter of chapters) {
    for (let i = 0; i < chapter.length; i++) {
      const block = chapter.content[i];
      if (block?.attrs?.id === headingId) {
        return offset + i;
      }
    }
    offset += chapter.length;
  }

  return -1;
}

function findAnchorBlockIndex(chapters, anchorId) {
  let offset = 0;

  for (const chapter of chapters) {
    for (let i = 0; i < chapter.length; i++) {
      const block = chapter.content[i];
      if (blockContainsAnchor(block, anchorId)) {
        return offset + i;
      }
    }
    offset += chapter.length;
  }

  return -1;
}

function getHeadingId(block) {
  return block?.attrs?.id || extractText(block);
}

function getPageContext(chapters, blockIndex) {
  let offset = 0;
  let section = "";
  let point = "";

  for (const chapter of chapters) {
    for (let i = 0; i < chapter.length; i++) {
      const globalIndex = offset + i;
      if (globalIndex >= blockIndex) {
        return { section, point };
      }

      const block = chapter.content[i];
      if (block?.type === "heading" && block?.attrs?.level === 1) {
        section = getHeadingId(block);
        point = "";
      } else if (block?.type === "heading" && block?.attrs?.level === 2) {
        point = getHeadingId(block);
      }
    }
    offset += chapter.length;
  }

  return { section, point };
}

async function updateBookPage(bookName, page, pageSize, pageContent) {
  const bookDoc = await Book.findOne({ name: bookName });
  if (!bookDoc) {
    throw new Error("Book not found");
  }

  if (bookName === THESAURUS_BOOK_NAME) {
    const document = createDocument(pageContent || []);

    await saveChapter(
      bookName,
      THESAURUS_DEFAULT_SECTION,
      JSON.stringify(document),
    );
    await syncChapterAnchors(bookName, THESAURUS_DEFAULT_SECTION, document);
    await Book.findOneAndUpdate(
      { name: bookName },
      { chapters: [THESAURUS_DEFAULT_SECTION] },
      { new: true },
    );

    return [THESAURUS_DEFAULT_SECTION];
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
      } else {
        // If no chapter started yet, create a default one
        if (!currentChapter) {
          currentChapter = { slug: "intro", content: [block] };
        } else {
          currentChapter.content.push(block);
        }
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

  // Collect updates first so we can handle extra blocks if client sent more than expected
  const pendingUpdates = [];
  let expectedPageLen = 0; // total number of blocks we expect to replace across chapters

  for (const section of bookDoc.chapters) {
    const chapterData = await loadChapter(bookName, section);
    // Normalize chapterData shapes (same logic as readBookChapters)
    let doc = null;
    if (!chapterData) {
      doc = null;
    } else if (chapterData.content && Array.isArray(chapterData.content)) {
      doc = { type: chapterData.type, content: chapterData.content };
    } else if (chapterData.content && chapterData.content.content) {
      doc = chapterData.content;
    } else {
      doc = chapterData;
    }

    const originalBlocks = (doc && Array.isArray(doc.content)) ? doc.content : [];
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
    const sliceLen = Math.max(0, sliceEnd - sliceStart);

    pendingUpdates.push({
      section,
      originalBlocks,
      sliceStart,
      sliceEnd,
      sliceLen,
    });

    expectedPageLen += sliceLen;
    currentIndex = chapterEnd;
  }

  // Apply page blocks into pending updates sequentially
  let pagePointer = 0;
  for (let i = 0; i < pendingUpdates.length; i++) {
    const u = pendingUpdates[i];
    const { section, originalBlocks, sliceStart, sliceEnd, sliceLen } = u;

    const pageChunk = pageBlocks.slice(pagePointer, pagePointer + sliceLen);
    pagePointer += sliceLen;

    const updatedBlocks = [
      ...originalBlocks.slice(0, sliceStart),
      ...pageChunk,
      ...originalBlocks.slice(sliceEnd),
    ];

    // store updated blocks for saving; we'll adjust last one if there are extra blocks
    u.updatedBlocks = updatedBlocks;
    updatedSections.push(section);
  }

  // If client provided more blocks than expected (e.g., page overflowed), append remaining
  if (pagePointer < pageBlocks.length && pendingUpdates.length > 0) {
    const extra = pageBlocks.slice(pagePointer);
    const last = pendingUpdates[pendingUpdates.length - 1];
    // insert extra between the last page chunk and the suffix
    const { originalBlocks, sliceStart, sliceEnd, sliceLen } = last;
    const lastChunkStart = expectedPageLen - sliceLen;
    const lastChunk = pageBlocks.slice(lastChunkStart, lastChunkStart + sliceLen);
    last.updatedBlocks = [
      ...originalBlocks.slice(0, sliceStart),
      ...lastChunk,
      ...extra,
      ...originalBlocks.slice(sliceEnd),
    ];
  }

  // Persist updates
  for (const u of pendingUpdates) {
    await saveChapter(
      bookName,
      u.section,
      JSON.stringify(createDocument(u.updatedBlocks || [])),
    );
    await syncChapterAnchors(
      bookName,
      u.section,
      createDocument(u.updatedBlocks || []),
    );
  }

  return updatedSections;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bookName = searchParams.get("book");
    const page = parseInteger(searchParams.get("page"), 0);
    const pageSize = parseInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const anchor = searchParams.get("anchor");
    const point = searchParams.get("point");
    const section = searchParams.get("section");

    if (bookName === THESAURUS_BOOK_NAME) {
      await ensureThesaurusBook();
    }

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

    let resolvedType = null;
    let resolvedValue = null;
    let resolvedBlockIndex = -1;

    if (anchor) {
      resolvedType = "anchor";
      resolvedValue = anchor;
      resolvedBlockIndex = findAnchorBlockIndex(chapters, anchor);
    } else if (point) {
      resolvedType = "point";
      resolvedValue = point;
      resolvedBlockIndex = findHeadingBlockIndex(chapters, point);
    } else if (section) {
      resolvedType = "section";
      resolvedValue = section;
      resolvedBlockIndex = findHeadingBlockIndex(chapters, section);
    }

    const resolvedPage = resolvedBlockIndex >= 0 && normalizedPageSize !== -1
      ? Math.floor(resolvedBlockIndex / normalizedPageSize)
      : (normalizedPageSize === -1 ? 0 : page);

    const safePage = normalizedPageSize === -1
      ? 0
      : Math.max(0, Math.min(resolvedPage, Math.max(0, totalPages - 1)));
    const pageStartIndex = normalizedPageSize === -1 ? 0 : safePage * normalizedPageSize;
    const pageContext = getPageContext(chapters, pageStartIndex);

    const content =
      normalizedPageSize === -1
        ? chapters.flatMap((chapter) => chapter.content)
        : sliceBookBlocks(
            chapters,
            safePage * normalizedPageSize,
            safePage * normalizedPageSize + normalizedPageSize,
          );

    return NextResponse.json({
      name: bookDoc.name,
      label: bookDoc.label,
      totalBlocks,
      page: normalizedPageSize === -1 ? 0 : safePage,
      pageSize: normalizedPageSize,
      totalPages,
      pageContext,
      pageContent: createDocument(content),
      resolved: resolvedType
        ? {
            type: resolvedType,
            value: resolvedValue,
            found: resolvedBlockIndex >= 0,
            blockIndex: resolvedBlockIndex,
            page: normalizedPageSize === -1 ? 0 : safePage,
          }
        : null,
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

    if (book === THESAURUS_BOOK_NAME) {
      await ensureThesaurusBook();
    }

    const normalizedContent =
      book === THESAURUS_BOOK_NAME ? sortThesaurusContent(content) : content;

    const normalizedPageSize =
      book === THESAURUS_BOOK_NAME
        ? -1
        : (pageSize === -1 ? -1 : Math.max(1, parseInteger(pageSize, DEFAULT_PAGE_SIZE)));

    const updatedSections = await updateBookPage(
      book,
      page,
      normalizedPageSize,
      normalizedContent,
    );

    clearChapterCache(book);

    return NextResponse.json({ ok: true, updatedSections });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
