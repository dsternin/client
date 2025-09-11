"use client";

import { useEffect, useState, useRef } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  colors,
} from "@mui/material";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import RedButton from "../RedButton";

const CACHE_MAX = 12;
const searchCache = new Map();
const lruTouch = (key) => {
  if (!searchCache.has(key)) return;
  const v = searchCache.get(key);
  searchCache.delete(key);
  searchCache.set(key, v);
};
const lruSet = (key, val) => {
  if (searchCache.has(key)) searchCache.delete(key);
  searchCache.set(key, val);
  while (searchCache.size > CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    searchCache.delete(oldest);
  }
};
const normalizeQ = (q) => (q || "").trim().toLowerCase();

export default function Search({ goToMatch, editor, isLoaded, fullDoc }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const book = searchParams.get("book");
  const query = searchParams.get("query") || "";
  const openFlag = searchParams.get("openSearch");

  const [open, setOpen] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [matches, setMatches] = useState(null);
  const [count, setCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [booksMatches, setBooksMatches] = useState([]);
  const [cursor, setCursor] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const abortRef = useRef(null);

  const collapseSelection = () => {
    try {
      const to = editor?.state?.selection?.to;
      if (typeof to === "number") {
        editor.commands.setTextSelection({ from: to, to });
      }
    } catch {}
  };

  const resetResults = () => {
    setMatches(null);
    setCount(0);
    setTotalCount(0);
    setBooksMatches([]);
    setCursor(-1);
    setError(null);
  };

  useEffect(() => {
    setQueryInput(query);
    if (query.trim() && isLoaded && fullDoc) {
      setHasSubmitted(true);
      handleSearch(query);
      setOpen(true);
      collapseSelection();
    }
  }, [query, isLoaded, fullDoc]);

  useEffect(() => {
    if (openFlag && isLoaded && fullDoc) {
      setOpen(true);
      setHasSubmitted(false);
      collapseSelection();
    }
  }, [openFlag, isLoaded, fullDoc]);

  useEffect(() => {
    if (open && count > 0 && matches?.[cursor] && editor) {
      goToMatch(matches[cursor]);
    }
  }, [cursor, matches, count, editor, open]);

  const searchInDocument = (doc, q) => {
    const results = [];
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "gi");
    (doc?.content || []).forEach((block, blockIndex) => {
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

  const getDocVersion = (doc) => {
    if (!doc) return "0";
    if (doc.version) return String(doc.version);
    const blocks = doc?.content || [];
    const blocksCount = blocks.length;
    const childrenSum = blocks.reduce(
      (s, b) => s + (b?.content?.length || 0),
      0
    );
    return `${blocksCount}:${childrenSum}`;
  };

  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || "").trim();
    if (!q || !editor || !fullDoc) return;

    setLoading(true);
    setError(null);
    setBooksMatches([]);

    try {
      const key = normalizeQ(q);
      let cached = searchCache.get(key);
      if (!cached) cached = { perBook: new Map() };

      if (!cached.global) {
        abortRef.current?.abort?.();
        abortRef.current = new AbortController();
        const { signal } = abortRef.current;

        const tocRes = await fetch("/api/content/toc", { signal });
        const toc = await tocRes.json();
        let globalTotal = 0;
        const list = [];

        for (const b of toc) {
          const metaRes = await fetch(
            `/api/content/books?book=${encodeURIComponent(b.name)}`,
            { signal }
          );
          const meta = await metaRes.json();
          const label = meta.label || b.name;
          const chapters = meta.chapters || [];
          const blocks = [];
          for (const ch of chapters) {
            const chRes = await fetch(
              `/api/content/chapters?book=${encodeURIComponent(
                b.name
              )}&section=${encodeURIComponent(ch.title)}`,
              { signal }
            );
            const chData = await chRes.json();
            blocks.push(...(chData.content?.content || []));
          }
          const bookCount = searchInDocument({ content: blocks }, q).length;
          list.push({ name: b.name, label, count: bookCount });
          globalTotal += bookCount;
        }
        cached.global = { list, total: globalTotal };
        lruSet(key, cached);
      } else {
        lruTouch(key);
      }

      setBooksMatches(searchCache.get(key).global.list);
      setTotalCount(searchCache.get(key).global.total);

      const current = searchCache.get(key);
      const bookKey = book || "__current__";
      const currentVersion = getDocVersion(fullDoc);
      const cachedBook = current.perBook.get(bookKey);

      let localMatches, localCount;
      if (cachedBook && cachedBook.version === currentVersion) {
        ({ matches: localMatches } = cachedBook);
        localCount = cachedBook.count;
      } else {
        localMatches = searchInDocument(fullDoc, q);
        localCount = localMatches.length;
        current.perBook.set(bookKey, {
          matches: localMatches,
          count: localCount,
          version: currentVersion,
        });
        lruSet(key, current);
      }

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
    setOpen(true);
    const trimmed = (queryInput || "").trim();
    setHasSubmitted(!!trimmed);
    const params = new URLSearchParams(searchParams);
    if (trimmed) params.set("query", trimmed);
    else params.delete("query");
    params.delete("openSearch");
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

  useEffect(() => {
    if (!open) {
      editor?.commands.unsetSearchHighlight();
      setCursor(-1);
    }
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    setQueryInput("");
    resetResults();
    setHasSubmitted(false);

    const params = new URLSearchParams(searchParams);
    params.delete("query");
    params.delete("openSearch");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleChange = (e) => {
    editor?.commands.unsetSearchHighlight();
    const q = e.target.value;
    setQueryInput(q);

    resetResults();
    setHasSubmitted(false);

    const url = new URL(window.location.href);
    const trimmed = (q || "").trim();
    if (trimmed.length === 0) url.searchParams.delete("query");
    else url.searchParams.set("query", trimmed);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const hasQuery = (queryInput || "").trim().length > 0;
  const currentBook = booksMatches.find((b) => b.name === book) || {};
  const currentLabel = currentBook.label || book;

  return (
    <>
      {open && (
        <Box
          sx={{
            position: "fixed",
            bottom: 16,
            right: "20%",
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
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  color: "#b81414",
                  fontWeight: 600,
                },
              }}
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

          {!loading && hasQuery && hasSubmitted && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Всего совпадений во всех книгах: {totalCount}.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                  {booksMatches.map((b) => (
                    <RedButton
                      key={b.name}
                      fullWidth={false}
                      clickHandler={() => goToBook(b.name)}
                      label={`${b.label}: ${b.count}`}
                      active={b.name === book}
                    />
                  ))}
                </Box>
              </Box>
              {hasQuery && hasSubmitted && count > 0 && (
                <>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Текущая книга: {currentLabel}, совпадений в ней: {count}.
                  </Typography>
                  <Typography variant="body2">
                    Текущий результат: {cursor + 1} из {count}.
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <RedButton
                      fullWidth={true}
                      clickHandler={() => setCursor((p) => Math.max(p - 1, 0))}
                      label="Назад"
                    />
                    <RedButton
                      fullWidth={true}
                      clickHandler={() =>
                        setCursor((p) => Math.min(p + 1, count - 1))
                      }
                      label="Далее"
                    />
                  </Box>
                </>
              )}
            </>
          )}

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
