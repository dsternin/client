"use client";

import MenuButton from "@/components/MenuButtons";
import { Box, Button } from "@mui/material";
import TextBoxControls from "../extensions/TextBoxControl";
import { rainbowColors } from "@/lib/colors";
import { useState } from "react";
import ChapterLinkDialog from "@/components/ChapterLinkDialog";
import { generateHTML } from "@tiptap/html";
import getEditorExtensions from "@/lib/tiptapExtensions";
import { useBookContext } from "@/store/BookContext";
import { useRouter } from "next/navigation";

export default function TipTapButtons({ editor, save }) {
  const { bookLabel } = useBookContext();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const router = useRouter();

  const handleExport = () => {
    save();
  };

  const handleExportToPDF = async () => {
    if (!editor) return;

    const htmlContent = generateHTML(editor.getJSON(), getEditorExtensions());
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-size: 30px;
              height: 100%;
              margin: 0;
              padding: 16px;
              font-family: "Georgia", serif;
              color: #1a1a1a;
              overflow-x: hidden;
            }
            .content { flex: 1; }
            .layout {
              display: flex;
              flex-direction: column;
              min-height: 95vh;
            }
            .ProseMirror {
              font-size: 30px;
              line-height: 1.6;
              padding: 1rem;
              border-radius: 0.5rem;
              min-height: 300px;
              outline: none;
            }
            .ProseMirror p {
              margin: 0.5em 0;
              text-indent: 2em;
              margin-top: 0.75em;
              margin-bottom: 0.75em;
              line-height: 1.7;
            }
            .ProseMirror p.no-indent { text-indent: 0; }
            .ProseMirror h1 {
              font-size: 3.5rem;
              margin: 1.2em 0 0.6em;
            }
            .ProseMirror h2 {
              font-size: 3rem;
              margin: 1.1em 0 0.5em;
            }
            .text-box {
              border: 5px solid;
              padding: 10px;
            }
            .search-highlight { background-color: aqua; }
            .stickyHeaderWrapper {
              position: sticky;
              top: 0;
              z-index: 1000;
              width: 100%;
              background-color: rgba(248, 244, 239, 0.75);
              backdrop-filter: blur(4px);
            }
          </style>
        </head>
        <body><div>${htmlContent}</div></body>
      </html>
    `;

    const shortName = bookLabel?.split(" ")[0]?.trim();
    if (!shortName) {
      alert("Некоректна назва книги");
      return;
    }

    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename: shortName }),
    });

    if (!res.ok) {
      alert("Помилка експорту PDF");
      return;
    }

    window.open(`/pdf?name=${encodeURIComponent(shortName)}`, "_blank");
  };

  const insertImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/content/image", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.url) {
          editor
            ?.chain()
            .focus()
            .setImage({ src: `${location.origin}${data.url}` })
            .run();
        } else {
          alert("Ошибка загрузки изображения");
        }
      } catch (err) {
        console.error("Image upload failed:", err);
        alert("Ошибка загрузки изображения");
      }
    };

    input.click();
  };

  return (
    <Box
      sx={{
        zIndex: 1000,
        top: "10.5rem",
        mb: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        position: "sticky",
        backdropFilter: "blur(4px)",
      }}
    >
      <MenuButton
        label="Стиль текста"
        items={{
          Жирный: () => editor?.chain().focus().toggleBold().run(),
          Курсив: () => editor?.chain().focus().toggleItalic().run(),
          Подчёркнутый: () => editor?.chain().focus().toggleUnderline().run(),
        }}
      />
      <MenuButton
        label="Заголовок"
        items={{
          "Без заголовка": () =>
            editor?.chain().focus().setNode("paragraph").run(),
          "Заголовок H1": () =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run(),
          "Заголовок H2": () =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          "Заголовок H3": () =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        }}
      />
      <Button color="primary" variant="contained" onClick={insertImage}>
        Вставить картинку
      </Button>
      <MenuButton
        label="Выравнивание"
        items={{
          Влево: () => editor?.chain().focus().setTextAlign("left").run(),
          "По центру": () =>
            editor?.chain().focus().setTextAlign("center").run(),
          Вправо: () => editor?.chain().focus().setTextAlign("right").run(),
        }}
        buttonProps={{ color: "primary" }}
      />
      <MenuButton
        label="Цвет текста"
        items={Object.fromEntries([
          ["По умолчанию", () => editor?.chain().focus().unsetColor().run()],
          ...rainbowColors.map((color) => [
            color,
            () => editor?.chain().focus().setColor(color).run(),
          ]),
        ])}
        buttonProps={{ color: "primary" }}
        renderOption={(color) =>
          color === "По умолчанию" ? (
            <div style={{ padding: 8 }}>По умолчанию</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", padding: 8 }}>
              <Box
                sx={{
                  backgroundColor: color,
                  width: 30,
                  height: 30,
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  cursor: "pointer",
                }}
              />
            </div>
          )
        }
      />
      <Button
        variant="contained"
        color="primary"
        onClick={() => setLinkDialogOpen(true)}
      >
        Добавить ссылку на главу книги
      </Button>
      <ChapterLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onInsert={(url) => {
          editor
            ?.chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        }}
      />
      <Button
        variant="contained"
        color="primary"
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .wrapIn("textBox", {
              backgroundColor: "#f9f9f9",
              borderColor: "#888",
              displayStyle: "block",
            })
            .run()
        }
      >
        Вставить текстовую рамку
      </Button>
      {editor && editor.isActive("textBox") && (
        <TextBoxControls editor={editor} />
      )}
      <Button variant="contained" onClick={handleExport} color="success">
        Сохранить
      </Button>
      <Button variant="contained" onClick={handleExportToPDF}>
        Экспорт в PDF
      </Button>
    </Box>
  );
}
