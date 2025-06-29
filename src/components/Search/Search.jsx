"use client";

import { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

export default function Search({ highlight, editor }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [queryInput, setQueryInput] = useState("");
  const [matches, setMatches] = useState(null);
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const book = searchParams.get("book");
  const section = searchParams.get("section");
  const query = searchParams.get("query") || "";

  useEffect(() => {
    setQueryInput(query);
    if (query.trim()) {
      handleSearch(query);
      setOpen(true);
    } else {
      setMatches(null);
      setCount(0);
    }
  }, [query, book]);

  useEffect(() => {
    if (!count || !matches?.[cursor] || !editor) return;

    const { blockIndex, childIndexPath, charIndex, length } = matches[cursor];
    const doc = editor.getJSON();

    const absolutePos = getAbsolutePosition(
      doc,
      blockIndex,
      childIndexPath,
      charIndex
    );
    highlight(absolutePos, absolutePos + length);
  }, [cursor, matches, count, editor]);

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/search?book=${book}&query=${searchQuery}`
      );
      const { matches, count } = await response.json();
      if (count) {
        const localIndex = matches.findIndex((m) => m.section === section);
        setCursor(localIndex === -1 ? 0 : localIndex);
        setMatches(matches);
        setCount(count);
      } else {
        setMatches(null);
        setCount(0);
        setError("Больше результатов не найдено.");
      }
    } catch (err) {
      console.error(err);
      setError("Произошла ошибка при поиске.");
    } finally {
      setLoading(false);
    }
  };

  const applySearch = () => {
    const params = new URLSearchParams(searchParams);
    if (queryInput) {
      params.set("query", queryInput);
    } else {
      params.delete("query");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  async function next() {
    editor?.commands.unsetSearchHighlight();
    setCursor((prev) => prev + 1);
  }

  async function prev() {
    editor?.commands.unsetSearchHighlight();

    setCursor((prev) => prev - 1);
  }

  return (
    <>
      {!open && (
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={() => setOpen(true)}
          sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 1000 }}
        >
          Искать по книгам
        </Button>
      )}

      {open && (
        <Box
          sx={{
            position: "fixed",
            bottom: 16,
            right: 16,
            width: 320,
            p: 2,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 4,
            zIndex: 1000,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6">Поиск по книгам</Typography>
            <IconButton
              size="small"
              onClick={() => {
                setOpen(false);
                editor?.commands.unsetSearchHighlight();
                setQueryInput("");
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <TextField
              label="Введите слово"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              onClick={applySearch}
              disabled={loading}
            >
              Поиск
            </Button>
          </Box>

          {loading && <CircularProgress size={24} />}

          {count > 0 ? (
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                onClick={prev}
                disabled={loading}
                fullWidth
              >
                Назад
              </Button>
              <Button
                variant="outlined"
                onClick={next}
                disabled={loading}
                fullWidth
              >
                Далее
              </Button>
            </Box>
          ) : null}

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}

export function getAbsolutePosition(
  doc,
  blockIndex,
  childIndexPath,
  charIndex
) {
  let pos = 1;

  for (let i = 0; i < blockIndex; i++) {
    const block = doc.content[i];
    pos += getNodeLength(block);
  }

  let currentNode = doc.content[blockIndex];
  // pos += 1;
  for (let idx of childIndexPath) {
    if (
      currentNode.type === "bulletList" ||
      currentNode.type === "listItem" ||
      currentNode.type === "textBox"
    )
      pos += 1;
    if (!currentNode.content || !currentNode.content[idx]) break;
    for (let i = 0; i < idx; i++) {
      pos += getNodeLength(currentNode.content[i]);
    }
    currentNode = currentNode.content[idx];
  }

  return pos + charIndex;
}

export function getNodeLength(node) {
  if (!node) return 0;
  if (node.text) return node.text.length;

  if (node.type === "customImage" || node.type === "hardBreak") return 1;
  if (node.content) {
    return node.content.reduce((sum, child) => sum + getNodeLength(child), 2);
  }
  return 2;
}
