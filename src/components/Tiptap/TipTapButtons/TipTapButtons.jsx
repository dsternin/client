"use client";

import { Box, Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";

export default function TipTapButtons({ editor, save }) {
  const [headingAnchor, setHeadingAnchor] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const handleExport = () => {
    save();
  };
  const handleHeadingClick = (event) => {
    setHeadingAnchor(event.currentTarget);
  };

  const handleHeadingSelect = (level) => {
    editor?.chain().focus().toggleHeading({ level }).run();
    setHeadingAnchor(null);
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

  const rainbowColors = [
    "#ff0000",
    "#ff7f00",
    "#ffff00",
    "#00ff00",
    "#00bfff",
    "#0000cd",
    "#8000ff",
  ];

  const handleColorClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleColorSelect = (color) => {
    editor?.chain().focus().setColor(color).run();
    setAnchorEl(null);
  };

  return (
    <Box
      sx={{
        zIndex: 999,
        top: "6rem",
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
      <Button variant="contained" color="primary" onClick={handleHeadingClick}>
        Заголовок
      </Button>
      <Menu
        anchorEl={headingAnchor}
        open={Boolean(headingAnchor)}
        onClose={() => setHeadingAnchor(null)}
      >
        {[1, 2, 3].map((level) => (
          <MenuItem key={level} onClick={() => handleHeadingSelect(level)}>
            Заголовок H{level}
          </MenuItem>
        ))}
      </Menu>
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
      <Button
        variant="contained"
        color="primary"
        onClick={() => editor?.chain().focus().setTextAlign("left").run()}
      >
        Влево
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => editor?.chain().focus().setTextAlign("center").run()}
      >
        По центру
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => editor?.chain().focus().setTextAlign("right").run()}
      >
        Вправо
      </Button>

      <Button variant="contained" onClick={handleColorClick}>
        Цвет текста
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {rainbowColors.map((color) => (
          <MenuItem
            key={color}
            onClick={() => handleColorSelect(color)}
            sx={{ padding: 0 }}
          >
            <Box
              sx={{
                backgroundColor: color,
                width: 30,
                height: 30,
                margin: 1,
                borderRadius: "4px",
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            />
          </MenuItem>
        ))}
      </Menu>
      <Button variant="contained" onClick={handleExport} color="success">
        Сохранить
      </Button>
    </Box>
  );
}
