"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import TipTapButtons from "./TipTapButtons";
import { useSearchParams } from "next/navigation";
import getEditorExtensions from "@/lib/tiptapExtensions";
import { useEffect, useState } from "react";

const Tiptap = () => {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");

  async function save() {
    if (!editor || !section) return;

    const content = editor.getJSON();

    try {
      const res = await fetch(`/api/content/${section}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error("Ошибка при сохранении");
      }

      const data = await res.json();
      alert("Сохранено успешно!");
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить.");
    }
  }
  const editor = useEditor({
    extensions: getEditorExtensions(),
    immediatelyRender: false,
    content: "Загрузка",
  });

  useEffect(() => {
    fetch("/api/content/intro")
      .then((res) => res.json())
      .then((data) => {
        editor?.commands.setContent(data.content);
      });
  }, [editor]);

  return (
    <div>
      <TipTapButtons editor={editor} save={save} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default Tiptap;
