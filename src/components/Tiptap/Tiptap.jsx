"use client";

import { EditorContent } from "@tiptap/react";
import TipTapButtons from "./TipTapButtons";
import { useSearchParams } from "next/navigation";

import useBookEditor from "@/hooks/useBookEditor";

const Tiptap = () => {
  const searchParams = useSearchParams();
  const book = searchParams.get("book");

  async function save() {
    if (!editor || !book) return;

    const fullContent = editor.getJSON();
    const chapters = [];

    let currentChapter = null;

    for (const block of fullContent.content) {
      if (block.type === "heading" && block.attrs?.level === 1) {
        if (currentChapter) {
          const res = await fetch("/api/content/chapters", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              book,
              section: currentChapter.slug,
              content: { type: "doc", content: currentChapter.content },
            }),
          });

          const data = await res.json();
          if (data.id) chapters.push(data.id);
        }
        currentChapter = {
          slug:
            block.content?.[0]?.text ||
            "glava",
          content: [block],
        };
      } else if (currentChapter) {
        currentChapter.content.push(block);
      }
    }
    if (currentChapter) {
      const res = await fetch("/api/content/chapters", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          book,
          section: currentChapter.slug,
          content: { type: "doc", content: currentChapter.content },
        }),
      });

      const data = await res.json();
      if (data.id) chapters.push(data.id);
    }

    const update = await fetch("/api/content/books", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        book,
        chapters,
      }),
    });

    if (!update.ok) {
      alert("Ошибка при сохранении книги");
    } else {
      alert("Сохранено успешно!");
    }
  }
  const {editor} = useBookEditor(book, true);

  return (
    <div>
      <TipTapButtons editor={editor} save={save} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default Tiptap;
