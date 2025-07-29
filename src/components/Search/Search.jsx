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

export default function Search({ editor, fullDoc, goToMatch }) {
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
  const query = searchParams.get("query") || "";

  useEffect(() => {
    setQueryInput(query);
    if (query.trim() && fullDoc?.content?.length > 0) {
      handleSearch(query);
      setOpen(true);
    } else {
      setMatches(null);
      setCount(0);
    }
  }, [query, book, fullDoc]);

  useEffect(() => {
    if (!count || !matches?.[cursor] || !editor || !goToMatch) return;
    goToMatch(matches[cursor]);
  }, [cursor, matches, count, editor]);

  const searchInDocument = (doc, query) => {
    const matches = [];
    doc.content.forEach((block, blockIndex) => {
      if (!block.content) return;
      block.content.forEach((child, childIndex) => {
        if (child.text) {
          const regex = new RegExp(query, "gi");
          let match;
          while ((match = regex.exec(child.text))) {
            matches.push({
              blockIndex,
              childIndexPath: [childIndex],
              charIndex: match.index,
              length: match[0].length,
            });
          }
        }
      });
    });
    return matches;
  };

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (!fullDoc) throw new Error("Документ не загружен");
      const matches = searchInDocument(fullDoc, searchQuery);
      const count = matches.length;

      if (count) {
        setCursor(0);
        setMatches(matches);
        setCount(count);
      } else {
        setMatches(null);
        setCount(0);
        setError("Ничего не найдено в текущей книге.");
      }
    } catch (err) {
      console.error(err);
      setError("Ошибка при поиске.");
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

  async function searchInNextBook() {
    const toc = await (await fetch("/api/content/toc")).json();
    const currentBook = searchParams.get("book");
    const currentIndex = toc.findIndex((b) => b.name === currentBook);
    const nextBook = toc[(currentIndex + 1) % toc.length];
    if (nextBook?.chapters?.length) {
      const params = new URLSearchParams(searchParams);
      params.set("book", nextBook.name);
      params.set("section", nextBook.chapters[0].title);
      params.set("query", queryInput);
      router.push(`${pathname}?${params.toString()}`);
    }
  }

  async function searchInPrevBook() {
    const toc = await (await fetch("/api/content/toc")).json();
    const currentBook = searchParams.get("book");
    const currentIndex = toc.findIndex((b) => b.name === currentBook);
    const prevBook = toc[(currentIndex - 1 + toc.length) % toc.length];
    if (prevBook?.chapters?.length) {
      const params = new URLSearchParams(searchParams);
      params.set("book", prevBook.name);
      params.set("section", prevBook.chapters[0].title);
      params.set("query", queryInput);
      router.push(`${pathname}?${params.toString()}`);
    }
  }

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
            width: 500,
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
              {cursor > 0 ? (
                <Button
                  sx={{ height: 48 }}
                  variant="outlined"
                  onClick={prev}
                  fullWidth
                >
                  Назад
                </Button>
              ) : (
                <Button
                  sx={{ height: 48 }}
                  variant="outlined"
                  onClick={searchInPrevBook}
                  fullWidth
                >
                  Искать в предыдущей книге
                </Button>
              )}
              {cursor < count - 1 ? (
                <Button
                  sx={{ height: 48 }}
                  variant="outlined"
                  onClick={next}
                  fullWidth
                >
                  Далее
                </Button>
              ) : (
                <Button
                  sx={{ height: 48 }}
                  variant="outlined"
                  onClick={searchInNextBook}
                  fullWidth
                >
                  Искать в следующей книге
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button
                sx={{ height: 48 }}
                variant="outlined"
                onClick={searchInPrevBook}
                fullWidth
              >
                Искать в предыдущей книге
              </Button>
              <Button
                sx={{ height: 48 }}
                variant="outlined"
                onClick={searchInNextBook}
                fullWidth
              >
                Искать в следующей книге
              </Button>
            </Box>
          )}

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
