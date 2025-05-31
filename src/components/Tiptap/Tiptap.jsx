"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import CustomParagraph from "./extensions/CustomParagraph";

const Tiptap = () => {
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

  const handleExport = () => {
    if (editor) {
      console.log(editor.getJSON());
      alert("JSON вивантажено. Перевірте консоль.");
    }
  };

  const insertImage = () => {
    const url = prompt("Вставьте URL изображения:");
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div>
      <div
        style={{
          zIndex: 999,
          top: "4rem",
          marginBottom: "1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          position: "sticky",
        }}
      >
        <button onClick={() => editor?.chain().focus().toggleBold().run()}>
          Жирный
        </button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()}>
          Курсив
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </button>
        <button onClick={insertImage}>Вставить картинку</button>
        <button
          onClick={() => {
            const current = editor?.getAttributes("paragraph").class || "";
            const next = current.includes("no-indent") ? "" : "no-indent";
            console.log(next);

            editor
              ?.chain()
              .focus()
              .updateAttributes("paragraph", { class: next })
              .run();
          }}
        >
          Без відступу
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          Влево
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          По центру
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          Вправо
        </button>
        <button onClick={handleExport}>Вивантажити JSON</button>
        <button
          onClick={() => {
            const html = editor?.getHTML();
            console.log(html);
            alert("HTML вивантажено. Перевірте консоль.");
          }}
        >
          Вивантажити HTML
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default Tiptap;
