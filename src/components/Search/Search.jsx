"use client";

import { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";

import { useSearchParams, usePathname, useRouter } from "next/navigation";

export default function Search({ highlight, editor, unsetSearchHighlight }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryUrl = searchParams.get("query") || "";
  const [query, setQuery] = useState(queryUrl);
  const [matches, setMatches] = useState(null);
  const [count, setCount] = useState(0);

  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applySearch = () => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set("query", query);
    } else {
      params.delete("query");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    handleSearch();
  }, [queryUrl]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const book = searchParams.get("book");
      const section = searchParams.get("section");

      const response = await fetch(
        `/api/search?book=${book}&section=${section}&query=${query}`
      );
      const { matches, count } = await response.json();

      if (count) {
        const cursorIndex = matches.findIndex((m) => m.section === section);
        setCursor(cursorIndex === -1 ? 0 : cursorIndex);
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

  function nextMatch() {
    setCursor((prev) => (prev + 1) % count);
  }

  useEffect(() => {
    if (!count || !matches[cursor] || !editor) return;
    unsetSearchHighlight();

    const { blockIndex, childIndex, charIndex, length } = matches[cursor];
    const doc = editor.getJSON();

    const absolutePos = getAbsolutePosition(
      doc,
      blockIndex,
      childIndex,
      charIndex
    );
    highlight(absolutePos, absolutePos + length);
  }, [cursor, matches, count, editor]);

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Поиск по книгам
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <TextField
          label="Введите слово"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
        />
        <Button variant="contained" onClick={applySearch} disabled={loading}>
          Поиск
        </Button>
      </Box>

      {loading && <CircularProgress />}

      {count > 0 ? (
        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setCursor((prev) => (prev - 1 + count) % count)}
            disabled={loading}
          >
            Назад
          </Button>
          <Button variant="outlined" onClick={nextMatch} disabled={loading}>
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
  );
}

function getAbsolutePosition(doc, blockIndex, childIndex, charIndex) {
  let pos = 1;
  for (let i = 0; i < blockIndex; i++) {
    const block = doc.content[i];
    pos += getNodeLength(block);
  }

  const targetBlock = doc.content[blockIndex];
  if (targetBlock?.content) {
    for (let j = 0; j < childIndex; j++) {
      const child = targetBlock.content[j];
      pos += getNodeLength(child);
    }
  }

  return pos + charIndex;
}

export function getNodeLength(node) {
  if (!node) return;
  if (node.text) return node.text.length;
  if (node.type === "hardBreak") {
    return 1;
  }
  if (node.type === "customImage" || node.type === "textBox") return 1;
  if (node.content) {
    return node.content.reduce((sum, child) => sum + getNodeLength(child), 2);
  }
  return 2;
}
