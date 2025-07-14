"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import Search from "../Search";
import { CircularProgress, Box } from "@mui/material";
import { useBookContext } from "@/store/BookContext";
import TipTapButtons from "../Tiptap/TipTapButtons";

export default function Reader() {
  const {
    book = "intro",
    section = "",
    point = "",
    setBookLabel,
    edit,
    setEdit,
  } = useBookContext();
  const { editor, isLoaded } = useBookEditor(book, edit, setBookLabel);

  useEffect(() => {
    if (editor) {
      editor.setEditable(edit);
    }
  }, [edit]);

  const [start, setStart] = useState();
  const [end, setEnd] = useState();
  const [trigger, setTrigger] = useState(false);

  function triggerHighlight() {
    setTrigger((prev) => !prev);
  }

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
          slug: block.content?.[0]?.text || "glava",
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

  useEffect(() => {
    if (!editor || isNaN(start) || isNaN(end)) return;
    editor.commands.setSearchHighlight(start, end);
    const el = document.getElementById("search-target");
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }, [start, end, trigger]);

  function highlight(start, end) {
    setEnd(end);
    setStart(start);
  }

  useEffect(() => {
    if (!isLoaded || (!section && !point)) return;
    triggerHighlight();
    const el = point
      ? document.getElementById(point) || document.getElementById(section)
      : document.getElementById(section);

    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }, [editor, section, isLoaded, point]);

  return (
    <>
      {isLoaded ? (
        <>
          <Search
            highlight={highlight}
            unsetSearchHighlight={editor.commands.unsetSearchHighlight}
            editor={editor}
          />
        </>
      ) : (
        <Box
          sx={{
            height: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={48} />
        </Box>
      )}
      {isLoaded ? (
        <TipTapButtons
          editor={editor}
          save={() => {
            save();
            setEdit(false);
          }}
        />
      ) : null}

      <EditorContent editor={editor} />
    </>
  );
}
