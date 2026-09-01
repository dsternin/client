"use client";

import MenuButton from "@/components/MenuButtons";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import TextBoxControls from "../extensions/TextBoxControl";
import { rainbowColors } from "@/lib/colors";
import { useState } from "react";
import ChapterLinkDialog from "@/components/ChapterLinkDialog";
import { generateHTML } from "@tiptap/html";
import getEditorExtensions from "@/lib/tiptapExtensions";
import { useBookContext } from "@/store/BookContext";
import ThesaurusToc from "@/components/ThesaurusToc";
import {
  THESAURUS_BOOK_NAME,
  getThesaurusTerms,
  removeThesaurusTerm,
} from "@/lib/thesaurus";

function AnchorLinkDialog({ open, anchors, loading, onClose, onInsert }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Выберите якорь</DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Typography>Загрузка якорей...</Typography>
        ) : !anchors.length ? (
          <Typography>В книге пока нет сохранённых якорей</Typography>
        ) : (
          <List>
            {anchors.map((anchor) => (
              <ListItemButton
                key={`${anchor.section}_${anchor.id}`}
                onClick={() => onInsert(anchor)}
              >
                <ListItemText
                  primary={anchor.text}
                  secondary={`${anchor.section} · #${anchor.id}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TipTapButtons({
  editor,
  save,
  section,
  onAddTerm,
  onEditTerm,
  onDeleteTerm,
  onEditSynonyms,
  termEditorMode = false,
}) {
  const { bookLabel, book } = useBookContext();

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const [anchorDialogOpen, setAnchorDialogOpen] = useState(false);
  const [anchors, setAnchors] = useState([]);
  const [anchorsLoading, setAnchorsLoading] = useState(false);
  const [termLinkDialogOpen, setTermLinkDialogOpen] = useState(false);
  const [deleteTermDialogOpen, setDeleteTermDialogOpen] = useState(false);
  const [termsToDelete, setTermsToDelete] = useState([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteTerm, setPendingDeleteTerm] = useState("");

  const isThesaurus = book === THESAURUS_BOOK_NAME;
  const showThesaurusTermActions = isThesaurus && !termEditorMode;

  const createAnchor = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      alert("Сначала выделите текст, на который нужно поставить якорь");
      return;
    }

    editor.chain().focus().setAnchor().run();
  };

  // const removeAnchor = () => {
  //   editor?.chain().focus().unsetAnchor().run();
  // };

  const openAnchorLinkDialog = async () => {
    setAnchorsLoading(true);
    setAnchorDialogOpen(true);

    const res = await fetch("/api/anchors");
    const data = await res.json();

    setAnchors(data.anchors || []);
    setAnchorsLoading(false);
  };

  const insertAnchorLink = (anchor) => {
    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: anchor.href })
      .run();

    setAnchorDialogOpen(false);
  };

  const openTermLinkDialog = () => {
    setTermLinkDialogOpen(true);
  };

  const insertTermLink = (term) => {
    if (!term?.href) return;

    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: term.href })
      .run();

    setTermLinkDialogOpen(false);
  };

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

  const openDeleteTermDialog = () => {
    const current = editor?.getJSON()?.content || [];
    const terms = getThesaurusTerms(current);

    if (!terms.length) {
      alert("В тезаурусе пока нет терминов для удаления");
      return;
    }

    setTermsToDelete(terms);
    setDeleteTermDialogOpen(true);
  };

  const openDeleteConfirmation = (term) => {
    setPendingDeleteTerm(term);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteTerm = (term) => {
    const current = editor?.getJSON()?.content || [];
    const next = removeThesaurusTerm(current, term);

    editor?.commands.setContent({ type: "doc", content: next }, false);

    const nextTerms = getThesaurusTerms(next);
    setTermsToDelete(nextTerms);
    if (!nextTerms.length) {
      setDeleteTermDialogOpen(false);
    }

    setConfirmDeleteOpen(false);
    setPendingDeleteTerm("");
  };

  if (showThesaurusTermActions) {
    return (
      <>
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
          <Button color="secondary" variant="contained" onClick={onAddTerm}>
            Добавить термин
          </Button>

          <Button color="error" variant="contained" onClick={onDeleteTerm || openDeleteTermDialog}>
            Удалить термин
          </Button>

          <Button variant="contained" onClick={onEditTerm}>
            Редактировать термин
          </Button>

          <Button variant="contained" onClick={save} color="success">
            Сохранить
          </Button>
        </Box>

        <Dialog
          open={deleteTermDialogOpen}
          onClose={() => setDeleteTermDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Удалить термин</DialogTitle>
          <DialogContent dividers>
            <List>
              {termsToDelete.map((term) => (
                <ListItemButton key={term} onClick={() => openDeleteConfirmation(term)}>
                  <ListItemText primary={term} />
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTermDialogOpen(false)}>Закрыть</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={confirmDeleteOpen}
          onClose={() => {
            setConfirmDeleteOpen(false);
            setPendingDeleteTerm("");
          }}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Подтвердите удаление</DialogTitle>
          <DialogContent>
            <Typography>
              Удалить термин "{pendingDeleteTerm}"?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmDeleteOpen(false);
                setPendingDeleteTerm("");
              }}
            >
              Отмена
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => handleDeleteTerm(pendingDeleteTerm)}
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <>
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
        {isThesaurus && termEditorMode ? (
          <Button variant="contained" color="secondary" onClick={onEditSynonyms}>
            Редактировать синонимы
          </Button>
        ) : null}

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
              <div
                style={{ display: "flex", alignItems: "center", padding: 8 }}
              >
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
          label="Якоря"
          items={{
            "Создать якорь": {
              action: createAnchor,
              disabled: isThesaurus && termEditorMode,
            },
            // "Удалить якорь": removeAnchor,
            "Ссылка на якорь": openAnchorLinkDialog,
          }}
          buttonProps={{ color: "primary" }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={() => setLinkDialogOpen(true)}
        >
          Добавить ссылку на главу книги
        </Button>

        <Button variant="contained" color="primary" onClick={openTermLinkDialog}>
          Добавить ссылку на термин
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

      <AnchorLinkDialog
        open={anchorDialogOpen}
        anchors={anchors}
        loading={anchorsLoading}
        onClose={() => setAnchorDialogOpen(false)}
        onInsert={insertAnchorLink}
      />

      <ThesaurusToc
        open={termLinkDialogOpen}
        buttonText={null}
        title="Выберите термин тезауруса"
        onClose={() => setTermLinkDialogOpen(false)}
        onSelect={insertTermLink}
      />

    </>
  );
}
