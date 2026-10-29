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
  LinearProgress,
  Paper,
  Popper,
  Popover,
  Typography,
} from "@mui/material";
import TextBoxControls from "../extensions/TextBoxControl";
import { rainbowColors } from "@/lib/colors";
import { useEffect, useRef, useState } from "react";
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
import { getGrammarHighlightState } from "@/components/Tiptap/extensions/GrammarHighlight";

const MAX_GRAMMAR_CHECK_LENGTH = 20_000;
const LEGACY_IGNORED_GRAMMAR_PHRASES_KEY = "ignoredGrammarPhrases";
let nextGrammarMatchId = 0;

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

  const phraseList = Array.isArray(ignoredPhrases) ? ignoredPhrases : [];
  for (const phrase of phraseList) {
    if (!phrase) continue;

    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    maskedText = maskedText.replace(
      new RegExp(
        `(^|[^\\p{L}\\p{N}_])(${escapedPhrase})(?=$|[^\\p{L}\\p{N}_])`,
        "giu",
      ),
      (...groups) => `${groups[1]}${" ".repeat(groups[2].length)}`,
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

function splitGrammarText(text) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + MAX_GRAMMAR_CHECK_LENGTH, text.length);
    if (end < text.length) {
      const minBoundary = start + MAX_GRAMMAR_CHECK_LENGTH * 0.7;
      let boundary = -1;

      // Prefer a paragraph break or sentence end so sentences are not split.
      for (let index = end - 1; index >= minBoundary; index -= 1) {
        if (text[index] === "\n") {
          boundary = index;
          break;
        }
        if (/\s/u.test(text[index])) {
          let previous = index - 1;
          while (previous > start && /["'»”’)\]]/u.test(text[previous])) {
            previous -= 1;
          }
          if (/[.!?…]/u.test(text[previous] || "")) {
            boundary = index;
            break;
          }
        }
      }

      if (boundary < 0) {
        boundary = Math.max(
          text.lastIndexOf("\n", end - 1),
          text.lastIndexOf(" ", end - 1),
        );
      }

      if (boundary >= minBoundary) {
        end = boundary + 1;
      }

      const lastCharacter = text.charCodeAt(end - 1);
      if (lastCharacter >= 0xd800 && lastCharacter <= 0xdbff) end -= 1;
    }

    chunks.push({ start, end, text: text.slice(start, end) });
    start = end;
  }

  return chunks;
}

function getPositionRanges(positions) {
  const ranges = [];
  let start = null;
  let end = null;

  for (const position of positions) {
    if (!Number.isInteger(position)) {
      if (start !== null) ranges.push({ from: start, to: end });
      start = null;
      end = null;
      continue;
    }

    if (start === null) {
      start = position;
      end = position + 1;
    } else if (position === end) {
      end += 1;
    } else {
      ranges.push({ from: start, to: end });
      start = position;
      end = position + 1;
    }
  }

  if (start !== null) ranges.push({ from: start, to: end });
  return ranges;
}

function isRangeChecked(positions, checkedRanges) {
  const textPositions = positions.filter(Number.isInteger);
  return (
    textPositions.length > 0 &&
    textPositions.every((position) =>
      checkedRanges.some(
        (range) => position >= range.from && position < range.to,
      ),
    )
  );
}

function findPhraseRanges(text, positions, phrase) {
  const ranges = [];
  const normalizedText = text.toLocaleLowerCase("ru-RU");
  const normalizedPhrase = phrase.toLocaleLowerCase("ru-RU");
  if (!normalizedPhrase) return ranges;
  const isWordCharacter = (character) =>
    Boolean(character && /[\p{L}\p{N}_]/u.test(character));
  const phraseStartsWithWord = isWordCharacter(normalizedPhrase[0]);
  const phraseEndsWithWord = isWordCharacter(
    normalizedPhrase[normalizedPhrase.length - 1],
  );

  let offset = 0;
  while (offset < normalizedText.length) {
    const index = normalizedText.indexOf(normalizedPhrase, offset);
    if (index < 0) break;
    const phraseEnd = index + normalizedPhrase.length;
    const hasWordBoundary =
      (!phraseStartsWithWord ||
        !isWordCharacter(normalizedText[index - 1])) &&
      (!phraseEndsWithWord ||
        !isWordCharacter(normalizedText[phraseEnd]));

    const phrasePositions = positions.slice(index, index + phrase.length);
    if (
      hasWordBoundary &&
      phrasePositions.length === phrase.length &&
      phrasePositions.every(
        (position, positionIndex) =>
          Number.isInteger(position) &&
          position === phrasePositions[0] + positionIndex,
      )
    ) {
      ranges.push({
        from: phrasePositions[0],
        to: phrasePositions[0] + phrasePositions.length,
      });
    }

    offset = phraseEnd;
  }

  return ranges;
}

function overlapsAnyRange(match, ranges) {
  return ranges.some(
    (range) => match.from < range.to && match.to > range.from,
  );
}

function containsIgnoredPhrase(text, ignoredPhrases) {
  if (!text) return false;
  const positions = Array.from({ length: text.length }, (_, index) => index);
  return ignoredPhrases.some(
    (phrase) => findPhraseRanges(text, positions, phrase).length > 0,
  );
}

function isIgnoredGrammarMatch(match, ignoredRanges, ignoredPhrases, doc) {
  const documentText =
    Number.isInteger(match.from) &&
    Number.isInteger(match.to) &&
    match.from >= 0 &&
    match.to > match.from &&
    match.to <= doc.content.size
      ? doc.textBetween(match.from, match.to, "\n", "\n")
      : "";

  return (
    overlapsAnyRange(match, ignoredRanges) ||
    containsIgnoredPhrase(match.issueText, ignoredPhrases) ||
    containsIgnoredPhrase(documentText, ignoredPhrases)
  );
}

function mapGrammarMatches(matches, positions, text, baseOffset = 0) {
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
      id: ++nextGrammarMatchId,
      offset: baseOffset + offset,
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

function GrammarCheckPopovers({
  grammarAnchorEl,
  activeGrammarMatch,
  ignoredAnchorEl,
  ignoredPhrases,
  grammarChecking,
  grammarProgress,
  grammarStatus,
  onCloseGrammar,
  onCloseIgnored,
  onApplySuggestion,
  onIgnorePhrase,
  onRestorePhrase,
}) {
  const grammarPopupRef = useRef(null);
  const grammarPopoverOpen = Boolean(grammarAnchorEl && activeGrammarMatch);

  useEffect(() => {
    if (!grammarPopoverOpen) return;

    const handlePointerDown = (event) => {
      if (
        grammarPopupRef.current?.contains(event.target) ||
        grammarAnchorEl?.contains(event.target)
      ) {
        return;
      }
      onCloseGrammar();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseGrammar();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [grammarPopoverOpen, grammarAnchorEl, onCloseGrammar]);

  return (
    <>
      <Popper
        open={grammarPopoverOpen}
        anchorEl={grammarAnchorEl}
        placement="bottom-start"
        modifiers={[
          { name: "flip", enabled: true },
          { name: "preventOverflow", options: { padding: 8 } },
        ]}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        {activeGrammarMatch ? (
          <Paper
            ref={grammarPopupRef}
            elevation={6}
            sx={{ p: 2, maxWidth: 360, maxHeight: 320, overflowY: "auto" }}
          >
            <Typography fontWeight={600}>{activeGrammarMatch.message}</Typography>
            {activeGrammarMatch.replacements?.length ? (
              <List disablePadding sx={{ mt: 1 }}>
                {activeGrammarMatch.replacements.map((replacement, index) => (
                  <ListItemButton
                    key={`${replacement.value}-${index}`}
                    disabled={grammarChecking}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onApplySuggestion(activeGrammarMatch, replacement.value)}
                  >
                    <ListItemText primary={getReplacementLabel(replacement.value)} />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Вариант исправления не предложен.
              </Typography>
            )}
            {activeGrammarMatch.issueText.trim() ? (
              <Button
                size="small"
                color="inherit"
                disabled={grammarChecking}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onIgnorePhrase(activeGrammarMatch.issueText)}
                sx={{ mt: 1, textTransform: "none" }}
              >
                Считать «{activeGrammarMatch.issueText}» правильным
              </Button>
            ) : null}
          </Paper>
        ) : null}
      </Popper>

      <Popover
        open={Boolean(ignoredAnchorEl)}
        anchorEl={ignoredAnchorEl}
        onClose={onCloseIgnored}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        disableScrollLock
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 1, maxWidth: 360 }}>
          <Typography fontWeight={600} sx={{ px: 1, pt: 1 }}>
            Исключённые фрагменты
          </Typography>
          <List disablePadding>
            {ignoredPhrases.map((phrase, index) => (
              <ListItemButton
                key={`${phrase}-${index}`}
                disabled={grammarChecking}
                onClick={() => onRestorePhrase(phrase)}
              >
                <ListItemText
                  primary={phrase}
                  secondary="Нажмите, чтобы снова проверять этот фрагмент"
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Popover>
      <GrammarProgressDialog
        open={grammarChecking}
        completed={grammarProgress.completed}
        total={grammarProgress.total}
        status={grammarStatus}
      />
    </>
  );
}

function GrammarProgressDialog({ open, completed, total, status }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} disableEscapeKeyDown fullWidth maxWidth="xs">
      <DialogTitle>Проверка грамматики</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {status || `Проверено фрагментов: ${completed} из ${total}`}
        </Typography>
        <LinearProgress variant="determinate" value={percentage} />
        <LinearProgress sx={{ mt: 1 }} />
        <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
          Проверяется текущий фрагмент. Большие тексты обрабатываются последовательно.
        </Typography>
      </DialogContent>
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
  const [grammarChecking, setGrammarChecking] = useState(false);
  const [grammarProgress, setGrammarProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [grammarStatus, setGrammarStatus] = useState("");
  const [grammarMatches, setGrammarMatches] = useState([]);
  const [activeGrammarMatch, setActiveGrammarMatch] = useState(null);
  const [grammarAnchorEl, setGrammarAnchorEl] = useState(null);
  const [ignoredAnchorEl, setIgnoredAnchorEl] = useState(null);
  const [ignoredPhrases, setIgnoredPhrases] = useState([]);
  const [ignoredPhrasesReady, setIgnoredPhrasesReady] = useState(false);

  const isThesaurus = book === THESAURUS_BOOK_NAME;
  const showThesaurusTermActions = isThesaurus && !termEditorMode;

  useEffect(() => {
    let cancelled = false;

    const loadIgnoredPhrases = async () => {
      try {
        const response = await fetch("/api/grammar-exclusions");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Не удалось загрузить исключения.");
        }

        const databasePhrases = Array.isArray(data.ignoredPhrases)
          ? data.ignoredPhrases.filter((phrase) => typeof phrase === "string")
          : [];
        let legacyPhrases = [];
        try {
          const legacyValue = window.localStorage.getItem(
            LEGACY_IGNORED_GRAMMAR_PHRASES_KEY,
          );
          const parsed = legacyValue ? JSON.parse(legacyValue) : [];
          if (Array.isArray(parsed)) {
            legacyPhrases = parsed.filter(
              (phrase) => typeof phrase === "string" && phrase.trim(),
            );
          }
        } catch (error) {
          console.error("Failed to read legacy grammar exclusions:", error);
        }

        const mergedPhrases = new Map();
        for (const phrase of [...databasePhrases, ...legacyPhrases]) {
          const trimmedPhrase = phrase.trim();
          const key = normalizeGrammarPhrase(trimmedPhrase);
          if (key && !mergedPhrases.has(key)) {
            mergedPhrases.set(key, trimmedPhrase);
          }
        }
        const phrases = Array.from(mergedPhrases.values());

        if (legacyPhrases.length > 0) {
          const saveResponse = await fetch("/api/grammar-exclusions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ignoredPhrases: phrases }),
          });
          const savedData = await saveResponse.json();
          if (!saveResponse.ok) {
            throw new Error(savedData.error || "Не удалось перенести исключения в базу.");
          }
          window.localStorage.removeItem(LEGACY_IGNORED_GRAMMAR_PHRASES_KEY);
        }

        if (cancelled) return;
        setIgnoredPhrases(phrases);
        setIgnoredPhrasesReady(true);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load grammar exclusions:", error);
        setGrammarStatus(error.message || "Не удалось загрузить исключения.");
      }
    };

    void loadIgnoredPhrases();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editor) return;

    const handleClick = (event) => {
      const target = event.target;
      const issueElement = target?.closest?.("[data-grammar-issue]");
      if (!issueElement || !editor.view.dom.contains(issueElement)) return;

      const matchIndex = Number(issueElement.dataset.grammarIssue);
      const match = grammarMatches.find(
        (grammarMatch) => grammarMatch.id === matchIndex,
      );
      if (!match) return;

      setActiveGrammarMatch(match);
      setGrammarAnchorEl(issueElement);
    };

    const handleTransaction = ({ transaction }) => {
      if (!transaction.docChanged) return;

      const nextState = getGrammarHighlightState(editor.state);
      const nextMatches = nextState?.matches || [];
      setGrammarMatches(nextMatches);
      setActiveGrammarMatch((currentMatch) => {
        if (!currentMatch) return null;
        const updatedMatch = nextMatches.find(
          (match) => match.id === currentMatch.id,
        );
        if (!updatedMatch) {
          setGrammarAnchorEl(null);
          return null;
        }
        return updatedMatch;
      });
      setGrammarStatus("");
    };

    editor.view.dom.addEventListener("click", handleClick);
    editor.on("transaction", handleTransaction);

    return () => {
      editor.view.dom.removeEventListener("click", handleClick);
      editor.off("transaction", handleTransaction);
    };
  }, [editor, grammarMatches]);

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

  const checkGrammar = async (phrasesToIgnore = ignoredPhrases) => {
    if (!editor || !ignoredPhrasesReady) return;

    const ignoredPhraseList = Array.isArray(phrasesToIgnore)
      ? phrasesToIgnore.filter((phrase) => typeof phrase === "string")
      : [];
    if (!Array.isArray(phrasesToIgnore)) {
      setGrammarStatus("Список винятків пошкоджений. Перевірка продовжиться без нього.");
    }

    const { text, positions } = getEditorTextWithPositions(editor);
    const grammarState = getGrammarHighlightState(editor.state);
    const ignoredRanges = ignoredPhraseList.flatMap((phrase) =>
      findPhraseRanges(text, positions, phrase),
    );
    let matches = (grammarState?.matches || []).filter(
      (match) =>
        !isIgnoredGrammarMatch(
          match,
          ignoredRanges,
          ignoredPhraseList,
          editor.state.doc,
        ),
    );
    let checkedRanges = [...(grammarState?.checkedRanges || [])];
    if (matches.length !== (grammarState?.matches || []).length) {
      editor.commands.setGrammarData({ matches, checkedRanges });
      setGrammarMatches(matches);
    }

    if (!text.trim()) {
      editor.commands.clearGrammarHighlights();
      setGrammarMatches([]);
      setGrammarStatus("В редакторе нет текста для проверки.");
      return;
    }

    setActiveGrammarMatch(null);
    setGrammarAnchorEl(null);
    const checkedDocument = editor.state.doc;
    const chunks = splitGrammarText(text);
    const chunksToCheck = chunks.filter(
      (chunk) =>
        !isRangeChecked(
          positions.slice(chunk.start, chunk.end),
          checkedRanges,
        ),
    );

    if (!chunksToCheck.length) {
      setGrammarMatches(matches);
      setGrammarStatus(
        matches.length
          ? `Найдено ошибок: ${matches.length}. Проверенные фрагменты использованы повторно.`
          : "Все фрагменты уже проверены. Новых ошибок нет.",
      );
      return;
    }

    setGrammarChecking(true);
    setGrammarProgress({ completed: 0, total: chunksToCheck.length });
    setGrammarStatus(`Проверка фрагментов: 0 из ${chunksToCheck.length}…`);
    let checkedChunks = 0;

    try {
      for (const chunk of chunksToCheck) {
        if (editor.state.doc !== checkedDocument) return;

        const chunkPositions = positions.slice(chunk.start, chunk.end);
        const chunkRanges = getPositionRanges(chunkPositions);
        const matchesOutsideChunk = () =>
          matches.filter(
            (match) =>
              !chunkRanges.some(
                (range) => match.from < range.to && match.to > range.from,
              ),
          );
        const textToCheck = maskIgnoredPhrases(chunk.text, ignoredPhraseList);
        if (!textToCheck.trim()) {
          matches = matchesOutsideChunk();
          checkedRanges = [...checkedRanges, ...chunkRanges];
          editor.commands.setGrammarData({ matches, checkedRanges });
          setGrammarMatches(matches);
          checkedChunks += 1;
          setGrammarProgress({
            completed: checkedChunks,
            total: chunksToCheck.length,
          });
          setGrammarStatus(
            `Проверка фрагментов: ${checkedChunks} из ${chunksToCheck.length}…`,
          );
          continue;
        }

        setGrammarStatus(
          `Проверка фрагментов: ${checkedChunks + 1} из ${chunksToCheck.length}…`,
        );
        const response = await fetch("/api/grammar-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToCheck }),
        });
        const data = await response.json();

        if (editor.state.doc !== checkedDocument) return;

        if (!response.ok) {
          throw new Error(data.error || "Не удалось проверить текст.");
        }

        matches = matchesOutsideChunk();
        matches.push(
          ...mapGrammarMatches(
            Array.isArray(data.matches) ? data.matches : [],
            positions.slice(chunk.start, chunk.end),
            chunk.text,
            chunk.start,
          ).filter(
            (match) =>
              Number.isInteger(match.from) &&
              Number.isInteger(match.to) &&
              !isIgnoredGrammarMatch(
                match,
                ignoredRanges,
                ignoredPhraseList,
                checkedDocument,
              ),
          ),
        );
        checkedRanges = [...checkedRanges, ...chunkRanges];
        editor.commands.setGrammarData({ matches, checkedRanges });
        setGrammarMatches(matches);
        checkedChunks += 1;
        setGrammarProgress({
          completed: checkedChunks,
          total: chunksToCheck.length,
        });
      }

      setGrammarStatus(
        matches.length
          ? `Найдено ошибок: ${matches.length}. Нажмите на подчёркнутый фрагмент, чтобы увидеть варианты.`
          : ignoredPhraseList.length
            ? "Ошибок не найдено. Исключённые фрагменты пропущены."
            : "Ошибок не найдено.",
      );
    } catch (error) {
      if (editor.state.doc !== checkedDocument) return;

      setGrammarMatches(matches);
      editor.commands.setGrammarData({ matches, checkedRanges });
      setGrammarStatus(
        `${error.message || "Не удалось проверить текст."}${
          checkedChunks
            ? ` Проверено фрагментов: ${checkedChunks} из ${chunksToCheck.length}.`
            : ""
        }`,
      );
    } finally {
      setGrammarChecking(false);
    }
  };

  const saveIgnoredPhrases = async (phrases) => {
    const response = await fetch("/api/grammar-exclusions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignoredPhrases: phrases }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Не удалось сохранить исключения.");
    }

    if (!Array.isArray(data.ignoredPhrases)) {
      throw new Error("Сервер вернул некорректный список исключений.");
    }

    return data.ignoredPhrases;
  };

  const ignoreGrammarPhrase = async (phrase) => {
    const normalizedPhrase = normalizeGrammarPhrase(phrase);
    if (!normalizedPhrase) return;

    const alreadyIgnored = ignoredPhrases.some(
      (ignoredPhrase) =>
        normalizeGrammarPhrase(ignoredPhrase) === normalizedPhrase,
    );
    const nextIgnoredPhrases = alreadyIgnored
      ? ignoredPhrases
      : [...ignoredPhrases, phrase.trim()];
    try {
      if (!alreadyIgnored) {
        const savedPhrases = await saveIgnoredPhrases(nextIgnoredPhrases);
        setIgnoredPhrases(savedPhrases);
      }
      setIgnoredAnchorEl(null);
      setActiveGrammarMatch(null);
      setGrammarAnchorEl(null);
      const currentGrammarState = getGrammarHighlightState(editor.state);
      const { text, positions } = getEditorTextWithPositions(editor);
      const ignoredRanges = findPhraseRanges(
        text,
        positions,
        phrase.trim(),
      );
      const remainingMatches = (currentGrammarState?.matches || []).filter(
        (match) =>
          !isIgnoredGrammarMatch(
            match,
            ignoredRanges,
            [phrase.trim()],
            editor.state.doc,
          ),
      );
      editor.commands.setGrammarData({
        matches: remainingMatches,
        checkedRanges: currentGrammarState?.checkedRanges || [],
      });
      setGrammarMatches(remainingMatches);
    } catch (error) {
      console.error("Failed to save ignored grammar phrase:", error);
      setGrammarStatus(error.message || "Не удалось сохранить исключение.");
    }
  };

  const restoreGrammarPhrase = async (phrase) => {
    const normalizedPhrase = normalizeGrammarPhrase(phrase);
    const nextIgnoredPhrases = ignoredPhrases.filter(
      (ignoredPhrase) =>
        normalizeGrammarPhrase(ignoredPhrase) !== normalizedPhrase,
    );

    try {
      const savedPhrases = await saveIgnoredPhrases(nextIgnoredPhrases);
      setIgnoredPhrases(savedPhrases);
      setIgnoredAnchorEl(null);
      const { text, positions } = getEditorTextWithPositions(editor);
      const phraseRanges = findPhraseRanges(text, positions, phrase);
      editor.commands.invalidateGrammarRanges(phraseRanges);
      const invalidatedState = getGrammarHighlightState(editor.state);
      setGrammarMatches(invalidatedState?.matches || []);
    } catch (error) {
      console.error("Failed to update ignored grammar phrases:", error);
      setGrammarStatus(error.message || "Не удалось обновить исключения.");
    }
  };

  const applyGrammarSuggestion = (match, replacement) => {
    if (!editor || match.from === null || match.to === null) return;

    setActiveGrammarMatch(null);
    setGrammarAnchorEl(null);
    editor
      .chain()
      .focus()
      .insertContentAt({ from: match.from, to: match.to }, replacement)
      .run();
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
          <Button
            variant="contained"
            color="secondary"
            onClick={() => checkGrammar()}
            disabled={!editor || !ignoredPhrasesReady || grammarChecking}
          >
            {grammarChecking ? "Проверка грамматики…" : "Проверить грамматику"}
          </Button>

          {ignoredPhrases.length > 0 ? (
            <Button
              variant="outlined"
              onClick={(event) => setIgnoredAnchorEl(event.currentTarget)}
            >
              Исключения: {ignoredPhrases.length}
            </Button>
          ) : null}

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

        <GrammarCheckPopovers
          grammarAnchorEl={grammarAnchorEl}
          activeGrammarMatch={activeGrammarMatch}
          ignoredAnchorEl={ignoredAnchorEl}
          ignoredPhrases={ignoredPhrases}
          grammarChecking={grammarChecking}
          grammarProgress={grammarProgress}
          grammarStatus={grammarStatus}
          onCloseGrammar={() => {
            setGrammarAnchorEl(null);
            setActiveGrammarMatch(null);
          }}
          onCloseIgnored={() => setIgnoredAnchorEl(null)}
          onApplySuggestion={applyGrammarSuggestion}
          onIgnorePhrase={ignoreGrammarPhrase}
          onRestorePhrase={restoreGrammarPhrase}
        />
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
          onClick={() => checkGrammar()}
          disabled={!editor || !ignoredPhrasesReady || grammarChecking}
        >
          {grammarChecking ? (
            <>
              <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
              Проверка грамматики…
            </>
          ) : (
            "Проверить грамматику"
          )}
        </Button>
        {ignoredPhrases.length > 0 ? (
          <Button
            variant="outlined"
            onClick={(event) => setIgnoredAnchorEl(event.currentTarget)}
          >
            Исключения: {ignoredPhrases.length}
          </Button>
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

      <GrammarCheckPopovers
        grammarAnchorEl={grammarAnchorEl}
        activeGrammarMatch={activeGrammarMatch}
        ignoredAnchorEl={ignoredAnchorEl}
        ignoredPhrases={ignoredPhrases}
        grammarChecking={grammarChecking}
        grammarProgress={grammarProgress}
        grammarStatus={grammarStatus}
        onCloseGrammar={() => {
          setGrammarAnchorEl(null);
          setActiveGrammarMatch(null);
        }}
        onCloseIgnored={() => setIgnoredAnchorEl(null)}
        onApplySuggestion={applyGrammarSuggestion}
        onIgnorePhrase={ignoreGrammarPhrase}
        onRestorePhrase={restoreGrammarPhrase}
      />

    </>
  );
}
