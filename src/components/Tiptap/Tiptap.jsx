"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import CustomParagraph from "./extensions/CustomParagraph";
import TipTapButtons from "./TipTapButtons";
import { useSearchParams } from "next/navigation";

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
      console.log(data);
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить.");
    }
  }
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      CustomParagraph,
      Image,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: "<p>Начните писать здесь...</p>",
  });

  return (
    <div>
      <TipTapButtons editor={editor} save={save} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default Tiptap;
