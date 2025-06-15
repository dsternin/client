"use client";
import { Box, Button } from "@mui/material";

import { rainbowColors } from "@/lib/colors";
import MenuButton from "@/components/MenuButtons";

export default function TextBoxControls({ editor }) {
  const updateAttrs = (attr, value) => {
    editor.chain().focus().updateAttributes("textBox", { [attr]: value }).run();
  };

  const remove = () => {
    editor.chain().focus().deleteNode("textBox").run();
  };

  const attrs = editor.getAttributes("textBox");

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        p: 2,
        border: "1px solid #ccc",
        borderRadius: 2,
        background: "#fafafa",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <MenuButton
        label="Заливка"
        items={Object.fromEntries([
          ["Прозрачная", () => updateAttrs("backgroundColor", "transparent")],
          ...rainbowColors.map((color) => [
            color,
            () => updateAttrs("backgroundColor", color),
          ]),
        ])}
        buttonProps={{ color: "primary" }}
        renderOption={(color) =>
          color === "Прозрачная" ? (
            <div style={{ padding: 8 }}>Прозрачная</div>
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
      <MenuButton
        label="Рамка"
        items={Object.fromEntries([
          ["Без рамки", () => updateAttrs("borderColor", "transparent")],
          ...rainbowColors.map((color) => [
            color,
            () => updateAttrs("borderColor", color),
          ]),
        ])}
        buttonProps={{ color: "primary" }}
        renderOption={(color) =>
          color === "Без рамки" ? (
            <div style={{ padding: 8 }}>Без рамки</div>
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
      <MenuButton
        label="Выравнивание"
        items={{
          "Влево": () => updateAttrs("displayStyle", "float-left"),
          "По центру": () => updateAttrs("displayStyle", "block"),
          "Вправо": () => updateAttrs("displayStyle", "float-right"),
        }}
        buttonProps={{ color: "primary" }}
      />
      <Button variant="outlined" color="error" onClick={remove}>
        Удалить
      </Button>
    </Box>
  );
}