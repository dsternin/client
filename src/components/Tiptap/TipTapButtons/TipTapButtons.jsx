"use client";

import { Box, Button } from "@mui/material";

export default function TipTapButtons({ editor, save }) {
  const handleExport = () => {
    save();
  };

  // const insertImage = () => {
  //   const url = prompt("Вставьте URL изображения:");
  //   if (url) {
  //     editor?.chain().focus().setImage({ src: url }).run();
  //   }
  // };

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
        variant="outlined"
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        Жирный
      </Button>
      <Button
        variant="outlined"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        Курсив
      </Button>
      <Button
        variant="outlined"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        H1
      </Button>
      <Button
        variant="outlined"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        H2
      </Button>
      {/* <Button variant="outlined" onClick={insertImage}>
        Вставить картинку
      </Button> */}
      <Button
        variant="outlined"
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
        variant="outlined"
        onClick={() => editor?.chain().focus().setTextAlign("left").run()}
      >
        Влево
      </Button>
      <Button
        variant="outlined"
        onClick={() => editor?.chain().focus().setTextAlign("center").run()}
      >
        По центру
      </Button>
      <Button
        variant="outlined"
        onClick={() => editor?.chain().focus().setTextAlign("right").run()}
      >
        Вправо
      </Button>
      <Button variant="contained" color="primary" onClick={handleExport}>
        Сохранить
      </Button>
      {/* <Button
        variant="contained"
        color="primary"
        onClick={() => {
          const html = editor?.getHTML();
          console.log(html);
          alert("HTML вивантажено. Перевірте консоль.");
        }}
      >
        Вивантажити HTML
      </Button> */}
    </Box>
  );
}
