import dbConnect from "@/lib/db";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  ChapterSchema,
  loadChapter,
  saveChapter,
  syncChapterAnchors,
} from "@/app/api/content/chapters/route";

const Chapter =
  mongoose.models.Chapter || mongoose.model("Chapter", ChapterSchema);

export async function POST(req) {
  try {
    const body = await req.json();

    const bookName = body?.book;
    const search = body?.search;
    const replaceWith = body?.replaceWith ?? "";

    if (!search || typeof search !== "string") {
      return NextResponse.json(
        { error: "Не указана строка поиска" },
        { status: 400 },
      );
    }

    if (!bookName || typeof bookName !== "string") {
      return NextResponse.json(
        { error: "Параметр 'book' обязателен" },
        { status: 400 },
      );
    }

    await dbConnect();

    const chapters = await Chapter.find({ book: bookName }).lean();

    let totalReplacements = 0;
    let updatedChapters = 0;
    const changedSections = [];
    const debug = {
      bookName,
      search,
      chaptersFound: chapters.length,
      sections: chapters.map((c) => c.section),
      errors: [],
    };

    for (const chapter of chapters) {
      const section = chapter.section;

      try {
        const content = await loadChapter(bookName, section);

        if (!content || !Array.isArray(content.content)) {
          debug.errors.push({
            section,
            reason: "loadChapter returned invalid content",
          });
          continue;
        }

        const contentClone = JSON.parse(JSON.stringify(content));

        const replacementsInChapter = replaceWordInTipTapContent(
          contentClone.content,
          search,
          replaceWith,
        );

        if (replacementsInChapter > 0) {
          await saveChapter(bookName, section, JSON.stringify(contentClone));
          await syncChapterAnchors(bookName, section, contentClone);

          totalReplacements += replacementsInChapter;
          updatedChapters += 1;

          changedSections.push({
            section,
            replacements: replacementsInChapter,
          });
        }
      } catch (error) {
        debug.errors.push({
          section,
          reason: String(error),
        });
      }
    }

    return NextResponse.json({
      count: totalReplacements,
      updatedChapters,
      changedSections,
      debug,
      message: "Замена выполнена",
    });
  } catch (error) {
    console.error("search-replace error:", error);
    return NextResponse.json(
      {
        error: "Ошибка при массовой замене",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

function replaceWordInTipTapContent(contentArray, search, replaceWith) {
  let replacements = 0;

  if (!Array.isArray(contentArray)) return 0;

  contentArray.forEach((block) => {
    replacements += replaceInNode(block, search, replaceWith);
  });

  return replacements;
}

function replaceInNode(node, search, replaceWith) {
  if (!node || typeof node !== "object") return 0;

  let replacements = 0;

  if (typeof node.text === "string") {
    const text = node.text;
    let pos = -1;

    while ((pos = text.indexOf(search, pos + 1)) !== -1) {
      replacements++;
    }

    if (replacements > 0) {
      node.text = text.split(search).join(replaceWith);
    }
  }

  if (Array.isArray(node.content)) {
    node.content.forEach((child) => {
      replacements += replaceInNode(child, search, replaceWith);
    });
  }

  return replacements;
}
