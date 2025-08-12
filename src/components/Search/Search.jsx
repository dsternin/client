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

export default function Search({ goToMatch, editor, isLoaded }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const book = searchParams.get("book");
  const query = searchParams.get("query") || "";

  const [open, setOpen] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [matches, setMatches] = useState(null);
  const [count, setCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [booksMatches, setBooksMatches] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false); // ← нове

  const resetResults = () => {
    setMatches(null);
    setCount(0);
    setTotalCount(0);
    setBooksMatches([]);
    setCursor(0);
    setError(null);
  };

  // Ініціалізація з URL (вважаємо як сабмітований пошук)
  useEffect(() => {
    setQueryInput(query);
    if (query.trim() && isLoaded) {
      setHasSubmitted(true);
      handleSearch(query);
      setOpen(true);
    }
  }, [query, isLoaded]);

  // Автоперехід до поточного збігу
  useEffect(() => {
    if (count > 0 && matches?.[cursor] && editor) {
      goToMatch(matches[cursor]);
    }
  }, [cursor, matches, count, editor]);

  const searchInDocument = (doc, q) => {
    const results = [];
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "gi");
    (doc.content || []).forEach((block, blockIndex) => {
      if (!block?.content) return;
      block.content.forEach((child, childIndex) => {
        if (child?.text) {
          let m;
          while ((m = regex.exec(child.text))) {
            results.push({
              blockIndex,
              childIndexPath: [childIndex],
              charIndex: m.index,
              length: m[0].length,
            });
          }
        }
      });
    });
    return results;
  };

  const handleSearch = async (searchQuery) => {
    const q = searchQuery.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setBooksMatches([]);

    try {
      // Підсумки по всіх книгах
      const toc = await (await fetch("/api/content/toc")).json();
      let globalTotal = 0;
      const list = [];
      for (const b of toc) {
        const metaRes = await fetch(
          `/api/content/books?book=${encodeURIComponent(b.name)}`
        );
        const meta = await metaRes.json();
        const label = meta.label || b.name;
        const chapters = meta.chapters || [];
        const blocks = [];
        for (const ch of chapters) {
          const chRes = await fetch(
            `/api/content/chapters?book=${encodeURIComponent(
              b.name
            )}&section=${encodeURIComponent(ch.title)}`
          );
          const chData = await chRes.json();
          blocks.push(...(chData.content?.content || []));
        }
        const bookCount = searchInDocument({ content: blocks }, q).length;
        list.push({ name: b.name, label, count: bookCount });
        globalTotal += bookCount;
      }
      setBooksMatches(list);
      setTotalCount(globalTotal);

      if (!editor) throw new Error("Editor not ready");
      const fullDoc = editor.getJSON();
      const localMatches = searchInDocument(fullDoc, q);
      const localCount = localMatches.length;

      if (localCount > 0) {
        setCursor(0);
        setMatches(localMatches);
        setCount(localCount);
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
    const trimmed = (queryInput || "").trim();
    setHasSubmitted(!!trimmed); // показуємо результати/помилки лише після сабміту
    const params = new URLSearchParams(searchParams);
    if (trimmed) params.set("query", trimmed);
    else params.delete("query");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goToBook = (name) => {
    const params = new URLSearchParams(searchParams);
    params.set("book", name);
    const trimmed = (queryInput || "").trim();
    if (trimmed) params.set("query", trimmed);
    else params.delete("query");
    params.delete("section");
    setHasSubmitted(!!trimmed);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleOpen = () => {
    setOpen(true);
    resetResults();
    setError(null);
    setHasSubmitted(false);
  };

  const handleClose = () => {
    setOpen(false);
    editor?.commands.unsetSearchHighlight();
    setQueryInput("");
    resetResults();
    setHasSubmitted(false);

    const params = new URLSearchParams(searchParams);
    params.delete("query");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleChange = (e) => {
    editor?.commands.unsetSearchHighlight();
    const q = e.target.value;
    setQueryInput(q);

    // Поки користувач набирає — нічого не показуємо
    resetResults();
    setHasSubmitted(false);

    // Оновлення URL без навігації
    const url = new URL(window.location.href);
    const trimmed = q.trim();
    if (trimmed.length === 0) url.searchParams.delete("query");
    else url.searchParams.set("query", trimmed);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const hasQuery = queryInput.trim().length > 0;
  const currentBook = booksMatches.find((b) => b.name === book) || {};
  const currentLabel = currentBook.label || book;

  return (
    <>
      {!open && (
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleOpen}
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
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <TextField
              label="Введите слово"
              value={queryInput}
              onChange={handleChange}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              onClick={applySearch}
              disabled={loading || !hasQuery}
            >
              Поиск
            </Button>
          </Box>

          {loading && <CircularProgress size={24} />}

          {/* Показуємо статистику/результати тільки після сабміту */}
          {!loading && hasQuery && hasSubmitted && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                Всего совпадений во всех книгах: {totalCount}.
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                {booksMatches.map((b) => (
                  <Button
                    key={b.name}
                    variant={b.name === book ? "contained" : "outlined"}
                    size="small"
                    onClick={() => goToBook(b.name)}
                  >
                    {b.label}: {b.count}
                  </Button>
                ))}
              </Box>
            </Box>
          )}

          {hasQuery && hasSubmitted && count > 0 && (
            <>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Текущая книга: {currentLabel}, совпадений в ней: {count}.
              </Typography>
              <Typography variant="body2">
                Текущий результат: {cursor + 1} из {count}.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setCursor((p) => Math.max(p - 1, 0))}
                >
                  Назад
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setCursor((p) => Math.min(p + 1, count - 1))}
                >
                  Далее
                </Button>
              </Box>
            </>
          )}

          {/* Помилку показуємо лише після сабміту і завершення завантаження */}
          {hasQuery && hasSubmitted && !loading && (error || count === 0) && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {error || "Ничего не найдено."}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}
