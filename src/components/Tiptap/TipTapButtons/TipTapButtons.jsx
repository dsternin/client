"use client";

import MenuButton from "@/components/MenuButtons";
import { Box, Button } from "@mui/material";
import TextBoxControls from "../extensions/TextBoxControl";
import { rainbowColors } from "@/lib/colors";

export default function TipTapButtons({ editor, save }) {
  const handleExport = () => {
    save();
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
          editor?.chain().focus().setImage({ src: data.url }).run();
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
        zIndex: 999,
        top: "8rem",
        mb: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        position: "sticky",
      }}
    >
      <Button
        color="primary"
        variant="contained"
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        Жирный
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        Курсив
      </Button>
      <Button
        color="primary"
        variant="contained"
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        Подчёркнутый
      </Button>
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
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          const current = editor?.getAttributes("paragraph").class || "";
          const next = current.includes("no-indent") ? "" : "no-indent";
          editor
            ?.chain()
            .focus()
            .updateAttributes("paragraph", { class: next })
            .run();
        }}
      >
        Без отступа
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
    </Box>
  );
}
