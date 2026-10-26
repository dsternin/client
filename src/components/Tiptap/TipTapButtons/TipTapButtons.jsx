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
  CircularProgress,
  Typography,
} from "@mui/material";
import TextBoxControls from "../extensions/TextBoxControl";
import { rainbowColors } from "@/lib/colors";
import { useEffect, useState } from "react";
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

const MAX_GRAMMAR_CHECK_LENGTH = 20_000;
const IGNORED_GRAMMAR_PHRASES_KEY = "ignoredGrammarPhrases";

function normalizeGrammarPhrase(phrase) {
  return phrase.trim().toLocaleLowerCase("ru-RU");
}

function getReplacementLabel(value) {
  if (value.length === 0) return "Удалить фрагмент";
  if (/^ +$/u.test(value)) {
    const count = value.length;
    const word =
      count % 10 === 1 && count % 100 !== 11
        ? "пробел"
        : count % 10 >= 2 &&
            count % 10 <= 4 &&
            (count % 100 < 12 || count % 100 > 14)
          ? "пробела"
          : "пробелов";
    return `Заменить на ${count} ${word}`;
  }

  return value;
}

function maskIgnoredPhrases(text, ignoredPhrases) {
  let maskedText = text;

  for (const phrase of ignoredPhrases) {
    if (!phrase) continue;

    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    maskedText = maskedText.replace(
      new RegExp(
        `(^|[^\\p{L}\\p{N}_])(${escapedPhrase})(?=$|[^\\p{L}\\p{N}_])`,
        "giu",
      ),
      (match, precedingCharacter, phraseMatch) =>
        `${precedingCharacter}${" ".repeat(phraseMatch.length)}`,
    );
  }

  return maskedText;
}

function getEditorTextWithPositions(editor) {
  const characters = [];
  const positions = [];
  let blockCount = 0;

  editor.state.doc.descendants((node, position) => {
    if (!node.isTextblock) return true;

    if (blockCount > 0) {
      characters.push("\n");
      positions.push(null);
    }
    blockCount += 1;

    node.descendants((child, childPosition) => {
      if (child.isText) {
        for (let index = 0; index < child.text.length; index += 1) {
          characters.push(child.text[index]);
          positions.push(position + 1 + childPosition + index);
        }
      } else if (child.type.name === "hardBreak") {
        characters.push("\n");
        positions.push(null);
      }
    });

    return false;
  });

  return { text: characters.join(""), positions };
}

function mapGrammarMatches(matches, positions, text) {
  return matches.map((match) => {
    const { offset, length } = match;
    let from = null;
    let to = null;

    if (
      Number.isInteger(offset) &&
      Number.isInteger(length) &&
      offset >= 0 &&
      length > 0 &&
      offset + length <= positions.length
    ) {
      const matchPositions = positions.slice(offset, offset + length);
      const firstPosition = matchPositions[0];
      const isContiguous =
        Number.isInteger(firstPosition) &&
        matchPositions.every(
          (position, index) => position === firstPosition + index,
        );

      if (isContiguous) {
        from = firstPosition;
        to = firstPosition + length;
      }
    }

    return {
      ...match,
      from,
      to,
      issueText:
        Number.isInteger(offset) &&
        Number.isInteger(length) &&
        offset >= 0 &&
        length > 0 &&
        offset + length <= text.length
          ? text.slice(offset, offset + length)
          : "",
    };
  });
}

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
  const [grammarDialogOpen, setGrammarDialogOpen] = useState(false);
  const [grammarChecking, setGrammarChecking] = useState(false);
  const [grammarError, setGrammarError] = useState("");
  const [grammarMatches, setGrammarMatches] = useState([]);
  const [ignoredPhrases, setIgnoredPhrases] = useState([]);
  const [ignoredPhrasesReady, setIgnoredPhrasesReady] = useState(false);

  const isThesaurus = book === THESAURUS_BOOK_NAME;
  const showThesaurusTermActions = isThesaurus && !termEditorMode;

  useEffect(() => {
    try {
      const savedPhrases = window.localStorage.getItem(
        IGNORED_GRAMMAR_PHRASES_KEY,
      );
      const parsedPhrases = savedPhrases ? JSON.parse(savedPhrases) : [];
      if (
        !Array.isArray(parsedPhrases) ||
        parsedPhrases.some((phrase) => typeof phrase !== "string")
      ) {
        throw new Error("Invalid ignored grammar phrases");
      }
      setIgnoredPhrases(parsedPhrases);
      setIgnoredPhrasesReady(true);
    } catch (error) {
      console.error("Failed to load ignored grammar phrases:", error);
      setGrammarError(
        "Не удалось загрузить список фрагментов, исключённых из проверки.",
      );
    }
  }, []);

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

  const checkGrammar = async () => {
    if (!editor || !ignoredPhrasesReady) return;

    let { text, positions } = getEditorTextWithPositions(editor);
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const selectedIndexes = positions.reduce((indexes, position, index) => {
        if (Number.isInteger(position) && position >= from && position < to) {
          indexes.push(index);
        }
        return indexes;
      }, []);

      if (selectedIndexes.length) {
        const start = selectedIndexes[0];
        const end = selectedIndexes[selectedIndexes.length - 1] + 1;
        text = text.slice(start, end);
        positions = positions.slice(start, end);
      }
    }

    if (!text.trim()) {
      setGrammarMatches([]);
      setGrammarError("В редакторе нет текста для проверки.");
      setGrammarDialogOpen(true);
      return;
    }
    if (text.length > MAX_GRAMMAR_CHECK_LENGTH) {
      setGrammarMatches([]);
      setGrammarError(
        "Выделите фрагмент или сократите текст в редакторе до 20 000 символов.",
      );
      setGrammarDialogOpen(true);
      return;
    }

    const textToCheck = maskIgnoredPhrases(text, ignoredPhrases);
    if (!textToCheck.trim()) {
      setGrammarMatches([]);
      setGrammarError(
        "Весь текст исключён из проверки. Восстановите нужные фрагменты в списке ниже.",
      );
      setGrammarDialogOpen(true);
      return;
    }

    setGrammarDialogOpen(true);
    setGrammarChecking(true);
    setGrammarError("");
    setGrammarMatches([]);

    try {
      const response = await fetch("/api/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToCheck }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не удалось проверить текст.");
      }

      setGrammarMatches(
        mapGrammarMatches(data.matches || [], positions, textToCheck),
      );
    } catch (error) {
      setGrammarError(error.message || "Не удалось проверить текст.");
    } finally {
      setGrammarChecking(false);
    }
  };

  const ignoreGrammarPhrase = (phrase) => {
    const normalizedPhrase = normalizeGrammarPhrase(phrase);
    if (!normalizedPhrase) return;

    const alreadyIgnored = ignoredPhrases.some(
      (ignoredPhrase) =>
        normalizeGrammarPhrase(ignoredPhrase) === normalizedPhrase,
    );
    if (alreadyIgnored) return;

    const nextIgnoredPhrases = [...ignoredPhrases, phrase.trim()];
    try {
      window.localStorage.setItem(
        IGNORED_GRAMMAR_PHRASES_KEY,
        JSON.stringify(nextIgnoredPhrases),
      );
      setIgnoredPhrases(nextIgnoredPhrases);
      setGrammarMatches((currentMatches) =>
        currentMatches.filter(
          (match) =>
            normalizeGrammarPhrase(match.issueText) !== normalizedPhrase,
        ),
      );
      setGrammarError("");
    } catch (error) {
      console.error("Failed to save ignored grammar phrase:", error);
      setGrammarError(
        "Не удалось сохранить фрагмент в списке исключений. Проверьте настройки браузера.",
      );
    }
  };

  const restoreGrammarPhrase = (phrase) => {
    const normalizedPhrase = normalizeGrammarPhrase(phrase);
    const nextIgnoredPhrases = ignoredPhrases.filter(
      (ignoredPhrase) =>
        normalizeGrammarPhrase(ignoredPhrase) !== normalizedPhrase,
    );

    try {
      window.localStorage.setItem(
        IGNORED_GRAMMAR_PHRASES_KEY,
        JSON.stringify(nextIgnoredPhrases),
      );
      setIgnoredPhrases(nextIgnoredPhrases);
      setGrammarError("");
    } catch (error) {
      console.error("Failed to update ignored grammar phrases:", error);
      setGrammarError(
        "Не удалось обновить список исключений. Проверьте настройки браузера.",
      );
    }
  };

  const applyGrammarSuggestion = (match, replacement) => {
    if (!editor || match.from === null || match.to === null) return;

    editor
      .chain()
      .focus()
      .insertContentAt({ from: match.from, to: match.to }, replacement)
      .run();

    void checkGrammar();
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
        <Button
          variant="contained"
          color="secondary"
          onClick={checkGrammar}
          disabled={!editor || !ignoredPhrasesReady || grammarChecking}
        >
          Проверить грамматику
        </Button>
        {!ignoredPhrasesReady && grammarError ? (
          <Typography color="error" variant="body2">
            {grammarError}
          </Typography>
        ) : null}

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

      <Dialog
        open={grammarDialogOpen}
        onClose={() => setGrammarDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Проверка грамматики</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            Текст отправляется на проверку в LanguageTool.
          </Typography>
          {grammarChecking ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} />
              <Typography>Проверяем текст…</Typography>
            </Box>
          ) : grammarError ? (
            <Typography color="error">{grammarError}</Typography>
          ) : grammarMatches.length === 0 ? (
            <Typography>LanguageTool не нашёл ошибок.</Typography>
          ) : (
            <List disablePadding>
              {grammarMatches.map((match, index) => (
                <Box key={`${match.offset}-${match.length}-${index}`}>
                  {index > 0 ? <Box sx={{ borderTop: 1, borderColor: "divider", my: 1.5 }} /> : null}
                  <Typography fontWeight={600}>{match.message}</Typography>
                  {match.context?.text ? (
                    <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
                      {Number.isInteger(match.context.offset) &&
                      Number.isInteger(match.context.length) &&
                      match.context.offset >= 0 &&
                      match.context.length > 0 &&
                      match.context.offset + match.context.length <=
                        match.context.text.length ? (
                        <>
                          {match.context.text.slice(0, match.context.offset)}
                          <Box
                            component="span"
                            sx={{
                              color: "error.main",
                              fontWeight: 700,
                              textDecoration: "underline wavy",
                              textDecorationColor: "error.main",
                              textUnderlineOffset: "3px",
                            }}
                          >
                            {match.context.text
                              .slice(
                                match.context.offset,
                                match.context.offset + match.context.length,
                              )
                              .replace(/ /g, "␣")}
                          </Box>
                          {match.context.text.slice(
                            match.context.offset + match.context.length,
                          )}
                        </>
                      ) : (
                        match.context.text
                      )}
                    </Typography>
                  ) : null}
                  {match.issueText.trim() ? (
                    <Button
                      size="small"
                      color="inherit"
                      disabled={grammarChecking}
                      onClick={() => ignoreGrammarPhrase(match.issueText)}
                      sx={{ mt: 0.5, textTransform: "none" }}
                    >
                      Считать «{match.issueText}» правильным и не проверять снова
                    </Button>
                  ) : null}
                  {match.replacements?.length ? (
                    <List disablePadding sx={{ mt: 0.5 }}>
                      {match.replacements.map((replacement, replacementIndex) => (
                        <ListItemButton
                          key={`${replacement.value}-${replacementIndex}`}
                          disabled={
                            grammarChecking || match.from === null || match.to === null
                          }
                          onClick={() => applyGrammarSuggestion(match, replacement.value)}
                        >
                          <ListItemText
                            primary={getReplacementLabel(replacement.value)}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Вариант исправления не предложен.
                    </Typography>
                  )}
                </Box>
              ))}
            </List>
          )}
          {ignoredPhrases.length > 0 ? (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
              <Typography fontWeight={600}>
                Исключённые из проверки фрагменты
              </Typography>
              <List disablePadding>
                {ignoredPhrases.map((phrase, index) => (
                    <ListItemButton
                      key={`${phrase}-${index}`}
                      disabled={grammarChecking}
                      onClick={() => restoreGrammarPhrase(phrase)}
                    >
                      <ListItemText
                        primary={phrase}
                        secondary="Нажмите, чтобы снова проверять этот фрагмент"
                      />
                    </ListItemButton>
                ))}
              </List>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrammarDialogOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

    </>
  );
}
