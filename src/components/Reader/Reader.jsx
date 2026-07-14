"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect, useState, useRef } from "react";
import Search from "../Search";
import { CircularProgress, Box, Button, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useBookContext } from "@/store/BookContext";
import TipTapButtons from "../Tiptap/TipTapButtons";
import MenuButton from "../MenuButtons";
import useNearestHeadings from "@/hooks/useNearestHeadings";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function addIdsToHeadings(content) {
  function extractText(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (Array.isArray(node.content)) {
      return node.content.map(extractText).join("");
    }
    return "";
  }

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    if (
      node.type === "heading" &&
      (node.attrs?.level === 1 || node.attrs?.level === 2)
    ) {
      const text = extractText(node);
      const id = text;
      node.attrs = { ...node.attrs, id };
    }

    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  content.forEach(traverse);
  return content;
}

function createLoadingDoc() {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Загрузка..." }],
      },
    ],
  };
}

function buildPageUrl(book, page, pageSize) {
  const params = new URLSearchParams();
  params.set("book", book);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `/api/content/book-pages?${params.toString()}`;
}

export default function Reader() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef(null);

  const { book = "intro", setBookLabel, edit, setEdit } = useBookContext();
  const { editor } = useBookEditor(edit);
  const { setSection, setPoint } = useBookContext();
  const [fullDoc, setFullDoc] = useState(null);
  const [pageDoc, setPageDoc] = useState(null);
  const [pageContext, setPageContext] = useState({ section: "", point: "" });
  const [loadedPage, setLoadedPage] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageBlockSize, setPageBlockSize] = useState(500);
  const [totalPages, setTotalPages] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReadyToScroll, setIsReadyToScroll] = useState(false);
  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState(null);

  async function fetchPage(bookName, page, pageSize) {
    const res = await fetch(buildPageUrl(bookName, page, pageSize), {
      cache: "no-store",
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error("Failed to load page");
    }

    return res.json();
  }

  async function loadPageDocument(page, pageSize) {
    if (!book) return;
    const requestId = ++pageRequestIdRef.current;
    setLoadingPage(true);
    setPageError(null);

    try {
      const payload = await fetchPage(book, page, pageSize);
      if (requestId !== pageRequestIdRef.current) return;
      if (!payload) {
        setPageDoc(null);
        setPageContext({ section: "", point: "" });
        setLoadedPage(null);
        return;
      }

      const content = addIdsToHeadings(payload.pageContent?.content || []);
      setPageDoc(content);
      setPageContext(payload.pageContext || { section: "", point: "" });
      setLoadedPage(page);
      setTotalPages(payload.totalPages || totalPages);
      setTotalBlocks(payload.totalBlocks || totalBlocks);
      setBookLabel(payload.label);
    } catch (error) {
      console.error(error);
      setPageError("Ошибка загрузки страницы");
    } finally {
      if (requestId === pageRequestIdRef.current) {
        setLoadingPage(false);
      }
    }
  }

  function updateBlockSize(value) {
    const newSize = parseInt(value, 10);
    setPageBlockSize(newSize);
    setCurrentPage(0);
  }

  const pageLabel = pageBlockSize === -1 ? "Весь текст" : `${pageBlockSize}`;

  const [start, setStart] = useState();
  const [end, setEnd] = useState();
  const [trigger, setTrigger] = useState(false);
  const [pendingMatch, setPendingMatch] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [pageAppliedRevision, setPageAppliedRevision] = useState(0);
  const pageRequestIdRef = useRef(0);

  async function resolveNavigationPage({ section, point, anchor }) {
    if (!book) return null;

    const params = new URLSearchParams();
    params.set("book", book);
    params.set("pageSize", String(pageBlockSize));
    if (anchor) params.set("anchor", anchor);
    else if (point) params.set("point", point);
    else if (section) params.set("section", section);

    const res = await fetch(`/api/content/book-pages?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    return res.json();
  }

  const searchParams = useSearchParams();

  const initialSection = searchParams.get("section");
  const initialPoint = searchParams.get("point");
  const initialAnchor = searchParams.get("anchor");

  useNearestHeadings(setSection, setPoint, fullDoc, pageContext);

  useEffect(() => {
    if (editor) {
      editor.setEditable(edit);
    }
  }, [edit, editor]);

  function scheduleSetContent(doc, replace = false, onApplied) {
    if (!editor) return;
    Promise.resolve().then(() => {
      try {
        editor.commands.setContent(doc, replace);
        onApplied?.();
      } catch (e) {
        console.error("setContent failed", e);
      }
    });
  }

  function triggerHighlight() {
    setTrigger((prev) => !prev);
  }

  function getSelectedText() {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ").trim();
  }

  function openSearchUnified() {
    const selected = getSelectedText();
    const params = new URLSearchParams(searchParams);
    params.delete("section");
    params.delete("point");
    params.delete("anchor");

    if (selected) {
      params.set("query", selected);
      params.delete("openSearch");
    } else {
      params.delete("query");
      params.set("openSearch", "1");
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!book) return;
    setIsLoaded(false);
    pageRequestIdRef.current += 1;
    setFullDoc(null);
    setPageDoc(null);
    setPageContext({ section: "", point: "" });
    setLoadedPage(null);
    setPendingMatch(null);
    setPendingNavigation(null);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalBlocks(0);
    setPageError(null);
  }, [book]);

  useEffect(() => {
    if (!book) return;

    if (pageBlockSize === -1) {
      setCurrentPage(0);
      loadPageDocument(0, -1);
      return;
    }

    loadPageDocument(currentPage, pageBlockSize);
  }, [book, currentPage, pageBlockSize]);

  useEffect(() => {
    if (!book || pageBlockSize !== -1 || currentPage !== 0) return;
    loadPageDocument(0, -1);
  }, [book, pageBlockSize, currentPage]);

  useEffect(() => {
    if (!editor) return;
    if (loadingBook || loadingPage) {
      scheduleSetContent(createLoadingDoc(), false);
      return;
    }
    if (pageDoc) {
      scheduleSetContent({ type: "doc", content: pageDoc }, false, () => {
        setPageAppliedRevision((prev) => prev + 1);
      });
      // Keep fullDoc in sync with currently loaded page to avoid eager full-book fetch.
      setFullDoc({ type: "doc", content: pageDoc });
      setIsLoaded(true);
      setIsReadyToScroll(true);
    }
  }, [editor, pageDoc, loadingBook, loadingPage]);

  async function save() {
    if (!editor || !book || !pageDoc) return;
    setIsReadyToScroll(false);

    let editedPageContent = editor.getJSON().content;
    // Ensure all headings have IDs before saving
    editedPageContent = addIdsToHeadings(editedPageContent);

    const res = await fetch("/api/content/book-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book,
        page: currentPage,
        pageSize: pageBlockSize,
        content: editedPageContent,
      }),
    });

    if (!res.ok) {
      alert("Ошибка при сохранении страницы");
      return;
    }

    await loadPageDocument(currentPage, pageBlockSize);

    alert("Сохранено успешно!");
  }

  async function reloadCurrentBook() {
    if (!book) return;
    setPageError(null);

    await loadPageDocument(currentPage, pageBlockSize);
  }

  function highlight(start, end) {
    setEnd(end);
    setStart(start);
    setTrigger((prev) => !prev);
  }

  function goToPage(page) {
    if (!editor || page < 0) return;
    setCurrentPage(page);
  }

  function goToMatch(match) {
    if (!editor || !match) return;

    const targetPage =
      pageBlockSize === -1 ? 0 : Math.floor(match.blockIndex / pageBlockSize);

    setPendingMatch({ match, targetPage });
    setCurrentPage(targetPage);
  }

  useEffect(() => {
    if (!editor || !pendingMatch || !pageDoc) return;
    if (loadingBook || loadingPage) return;
    if (currentPage !== pendingMatch.targetPage) return;
    if (loadedPage !== pendingMatch.targetPage) return;

    const localBlockIndex =
      pageBlockSize === -1
        ? pendingMatch.match.blockIndex
        : pendingMatch.match.blockIndex % pageBlockSize;

    if (localBlockIndex < 0 || localBlockIndex >= pageDoc.length) {
      return;
    }

    const relativePos = getRelativePositionInEditorDoc(
      editor.state.doc,
      localBlockIndex,
      pendingMatch.match.childIndexPath,
      pendingMatch.match.charIndex,
    );

    if (!Number.isFinite(relativePos)) return;

    const range = clampHighlightRange(
      editor.state.doc,
      relativePos,
      pendingMatch.match.length,
    );
    if (!range) return;

    highlight(range.from, range.to);
    setPendingMatch(null);
  }, [
    editor,
    pendingMatch,
    pageDoc,
    loadedPage,
    currentPage,
    pageBlockSize,
    loadingBook,
    loadingPage,
    pageAppliedRevision,
  ]);

  useEffect(() => {
    if (!editor || isNaN(start) || isNaN(end)) return;
    editor.commands.setSearchHighlight(start, end);

    // Wait for the mark render, then center viewport by editor coordinates.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const centered = centerViewportOnEditorRange(editor, start, end);
        if (!centered) {
          waitForElement("#search-target", 1000, 50).then((el) => {
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          });
        }
      });
    });
  }, [start, end, trigger, editor]);

  useEffect(() => {
    if (!isLoaded || !editor) return;
    if (!initialSection && !initialPoint && !initialAnchor) return;

    setStart(NaN);
    setEnd(NaN);
    triggerHighlight();

    if (!isReadyToScroll) return;

    let cancelled = false;

    (async () => {
      const payload = await resolveNavigationPage({
        section: initialSection,
        point: initialPoint,
        anchor: initialAnchor,
      });
      if (cancelled || !payload?.resolved?.found) return;

      const targetPage = payload.resolved.page;
      const targetType = payload.resolved.type;
      const targetValue = payload.resolved.value;
      const targetBlockIndex = payload.resolved.blockIndex;

      if (typeof targetPage === "number") {
        setPendingNavigation({
          page: targetPage,
          type: targetType,
          value: targetValue,
          blockIndex: targetBlockIndex,
        });
        setCurrentPage(targetPage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editor,
    isLoaded,
    initialPoint,
    initialSection,
    initialAnchor,
    isReadyToScroll,
    book,
    pageBlockSize,
  ]);

  useEffect(() => {
    if (!pendingNavigation || loadingBook || loadingPage) return;
    if (loadedPage !== pendingNavigation.page) return;

    if (
      Number.isInteger(pendingNavigation.blockIndex) &&
      pendingNavigation.type !== "anchor"
    ) {
      const localBlockIndex =
        pageBlockSize === -1
          ? pendingNavigation.blockIndex
          : pendingNavigation.blockIndex - pendingNavigation.page * pageBlockSize;

      const centered = centerViewportOnBlock(editor, localBlockIndex);
      if (centered) {
        setPendingNavigation(null);
        return;
      }
    }

    waitForElement(`#${CSS.escape(pendingNavigation.value)}`, 5000, 100).then((el) => {
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setPendingNavigation(null);
    });
  }, [pendingNavigation, loadedPage, loadingBook, loadingPage, pageAppliedRevision]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    function isModifiedEvent(e) {
      return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
    }

    function toURL(href) {
      if (!href) return null;
      try {
        return new URL(href, window.location.origin);
      } catch {
        return null;
      }
    }

    const onClick = (e) => {
      if (editor?.isEditable) return;

      const target = e.target;
      const a = target?.closest("a");
      if (!a) return;

      if (a.dataset.tiptapIgnore === "true") return;

      const url = toURL(a.getAttribute("href"));
      if (!url) return;

      const sameOrigin = url.origin === window.location.origin;
      if (!sameOrigin || isModifiedEvent(e) || a.target === "_blank") return;

      e.preventDefault();

      const samePath = url.pathname === window.location.pathname;
      if (samePath && !url.search && url.hash) {
        document.getElementById(url.hash.slice(1))?.scrollIntoView({
          behavior: "smooth",
        });
        return;
      }

      router.push(url.pathname + url.search + url.hash);
    };

    const onMouseEnter = (e) => {
      const target = e.target;
      const a = target?.closest("a");
      if (!a) return;

      const url = toURL(a.getAttribute("href"));
      if (!url) return;

      if (url.origin === window.location.origin) {
        router.prefetch?.(url.pathname + url.search + url.hash);
      }
    };

    root.addEventListener("click", onClick, true);
    root.addEventListener("mouseenter", onMouseEnter, true);

    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("mouseenter", onMouseEnter, true);
    };
  }, [editor, router]);

  return (
    <>
      {isLoaded ? (
        !edit && (
          <Search
            highlight={highlight}
            editor={editor}
            fullDoc={fullDoc}
            goToMatch={goToMatch}
            isLoaded={isLoaded}
            onReloadCurrentBook={reloadCurrentBook}
          />
        )
      ) : (
        <Box
          sx={{
            height: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={48} />
        </Box>
      )}

      {isLoaded && edit ? (
        <TipTapButtons
          editor={editor}
          save={() => {
            save();
            setEdit(false);
          }}
        />
      ) : null}

      <div ref={containerRef}>
        <EditorContent editor={editor} />
      </div>

      {isLoaded && fullDoc && !edit && (
        <>
          <Box
            sx={{ display: "flex", justifyContent: "center", mt: 2, gap: 2 }}
          >
            <Button
              variant="contained"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
            >
              Назад
            </Button>

            <Typography variant="body1" sx={{ alignSelf: "center" }}>
              Страница {currentPage + 1} из {totalPages}
            </Typography>

            <Button
              variant="contained"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage + 1 >= totalPages}
            >
              Вперёд
            </Button>
          </Box>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
            <MenuButton
              label={`Абзацев на страницу: ${pageLabel}`}
              items={{
                50: () => updateBlockSize(50),
                100: () => updateBlockSize(100),
                500: () => updateBlockSize(500),
                1000: () => updateBlockSize(1000),
                "-1": () => updateBlockSize(-1),
              }}
              renderOption={(key) => (key === "-1" ? "Весь текст" : `${key}`)}
            />
          </Box>

          {isLoaded && !edit && (
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={openSearchUnified}
              sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 1000 }}
            >
              Поиск текста по книгам
            </Button>
          )}
        </>
      )}
    </>
  );
}

function getRelativePositionInEditorDoc(
  doc,
  blockIndex,
  childIndexPath,
  charIndex,
) {
  if (!doc || blockIndex < 0 || !Array.isArray(childIndexPath)) return NaN;
  if (blockIndex >= doc.childCount) return NaN;

  let blockStart = 1;
  for (let i = 0; i < blockIndex; i++) {
    blockStart += doc.child(i).nodeSize;
  }

  let currentNode = doc.child(blockIndex);
  let currentStart = blockStart;

  for (const idx of childIndexPath) {
    if (!currentNode || idx < 0 || idx >= currentNode.childCount) return NaN;

    let childOffset = 0;
    for (let i = 0; i < idx; i++) {
      childOffset += currentNode.child(i).nodeSize;
    }

    currentStart = currentStart + childOffset;
    currentNode = currentNode.child(idx);
  }

  if (!currentNode?.isText) return NaN;

  const safeCharIndex = Math.max(
    0,
    Math.min(charIndex || 0, currentNode.text?.length || 0),
  );

  return currentStart + safeCharIndex;
}

function clampHighlightRange(doc, from, length) {
  if (!doc) return null;
  const docSize = doc.content?.size || 0;
  if (docSize <= 0) return null;

  const safeFrom = Math.max(1, Math.min(from, docSize));
  const safeTo = Math.max(safeFrom + 1, Math.min(safeFrom + Math.max(1, length || 1), docSize));

  if (safeFrom >= safeTo) return null;
  return { from: safeFrom, to: safeTo };
}

function getBlockStartPosition(doc, blockIndex) {
  if (!doc || blockIndex < 0 || blockIndex >= doc.childCount) return NaN;

  let pos = 1;
  for (let i = 0; i < blockIndex; i++) {
    pos += doc.child(i).nodeSize;
  }

  return pos;
}

function centerViewportOnEditorRange(editor, from, to) {
  try {
    const view = editor?.view;
    if (!view || !view.state?.doc) return false;

    const docSize = view.state.doc.content?.size || 0;
    if (docSize <= 0) return false;

    const safeFrom = Math.max(1, Math.min(from, docSize));
    const safeTo = Math.max(safeFrom, Math.min(to, docSize));

    const head = view.coordsAtPos(safeFrom);
    const tail = view.coordsAtPos(Math.max(safeFrom, safeTo - 1));
    const midY = (head.top + tail.bottom) / 2;

    const targetTop = Math.max(0, midY + window.scrollY - window.innerHeight / 2);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
    return true;
  } catch {
    return false;
  }
}

function centerViewportOnBlock(editor, blockIndex) {
  try {
    const view = editor?.view;
    const doc = view?.state?.doc;
    if (!view || !doc) return false;

    const pos = getBlockStartPosition(doc, blockIndex);
    if (!Number.isFinite(pos)) return false;

    const coords = view.coordsAtPos(pos);
    const targetTop = Math.max(
      0,
      coords.top + window.scrollY - window.innerHeight / 2,
    );
    window.scrollTo({ top: targetTop, behavior: "smooth" });
    return true;
  } catch {
    return false;
  }
}

function blockContainsAnchor(node, anchorId) {
  if (!node || !anchorId) return false;

  if (Array.isArray(node)) {
    return node.some((child) => blockContainsAnchor(child, anchorId));
  }

  if (typeof node !== "object") return false;

  if (Array.isArray(node.marks)) {
    const hasAnchor = node.marks.some(
      (mark) => mark?.type === "anchor" && mark?.attrs?.anchorId === anchorId,
    );
    if (hasAnchor) return true;
  }

  if (Array.isArray(node.content)) {
    return node.content.some((child) => blockContainsAnchor(child, anchorId));
  }

  return false;
}

function findAnchorBlockIndex(fullDoc, anchorId) {
  if (!fullDoc?.content || !anchorId) return -1;

  return fullDoc.content.findIndex((block) =>
    blockContainsAnchor(block, anchorId),
  );
}

function waitForElement(selector, timeout = 5000, interval = 200) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      if (Date.now() - start > timeout) {
        return resolve(null);
      }

      setTimeout(check, interval);
    };

    check();
  });
}
