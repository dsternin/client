"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect, useState, useRef, useMemo } from "react";
import Search from "../Search";
import {
  CircularProgress,
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
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useBookContext } from "@/store/BookContext";
import TipTapButtons from "../Tiptap/TipTapButtons";
import MenuButton from "../MenuButtons";
import useNearestHeadings from "@/hooks/useNearestHeadings";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  buildThesaurusTermBlocks,
  findThesaurusEntriesByPrefix,
  getThesaurusEntries,
  getThesaurusTerms,
  removeThesaurusTerm,
  sortThesaurusContent,
  THESAURUS_BOOK_NAME,
  upsertThesaurusTermBlocks,
} from "@/lib/thesaurus";

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

function buildSynonymMatchHintBlock(synonym) {
  return {
    type: "paragraph",
    attrs: { textAlign: "left" },
    content: [
      {
        type: "text",
        text: `Синоним: ${synonym}`,
        marks: [
          { type: "textStyle", attrs: { color: "#6b7280" } },
          { type: "italic" },
        ],
      },
    ],
  };
}

function withSynonymHint(entry) {
  if (!entry || entry.matchedBy !== "synonym" || !entry.matchedSynonym) {
    return entry?.blocks || [];
  }

  const blocks = entry.blocks || [];
  if (!blocks.length) return blocks;

  const [first, ...rest] = blocks;
  if (first?.type === "heading" && first?.attrs?.level === 2) {
    return [first, buildSynonymMatchHintBlock(entry.matchedSynonym), ...rest];
  }

  return [buildSynonymMatchHintBlock(entry.matchedSynonym), ...blocks];
}

export default function Reader() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef(null);

  const {
    book = "intro",
    setBookLabel,
    edit,
    setEdit,
    setEditingTermLabel,
  } = useBookContext();
  const isThesaurus = book === THESAURUS_BOOK_NAME;
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
  const [thesaurusTermQuery, setThesaurusTermQuery] = useState("");
  const [selectedThesaurusTerm, setSelectedThesaurusTerm] = useState("");
  const [selectedThesaurusBlocks, setSelectedThesaurusBlocks] = useState([]);
  const [thesaurusModalOpen, setThesaurusModalOpen] = useState(false);
  const [thesaurusModalMode, setThesaurusModalMode] = useState("create");
  const [thesaurusNameDraft, setThesaurusNameDraft] = useState("");
  const [thesaurusNameError, setThesaurusNameError] = useState("");
  const [thesaurusDeleteDialogOpen, setThesaurusDeleteDialogOpen] = useState(false);
  const [pendingDeleteTerm, setPendingDeleteTerm] = useState("");
  const [thesaurusEditorOpen, setThesaurusEditorOpen] = useState(false);
  const [selectedThesaurusSynonyms, setSelectedThesaurusSynonyms] = useState([]);
  const [synonymsDialogOpen, setSynonymsDialogOpen] = useState(false);
  const [synonymsDraft, setSynonymsDraft] = useState("");

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

  const thesaurusSearchResult = useMemo(() => {
    if (!isThesaurus) return { prefix: [], entries: [] };
    return findThesaurusEntriesByPrefix(pageDoc || [], thesaurusTermQuery);
  }, [isThesaurus, pageDoc, thesaurusTermQuery]);

  const filteredThesaurusContent = useMemo(() => {
    if (!isThesaurus || edit) return pageDoc;
    return [
      ...(thesaurusSearchResult.prefix || []),
      ...((thesaurusSearchResult.entries || []).flatMap((entry) => withSynonymHint(entry))),
    ];
  }, [isThesaurus, edit, pageDoc, thesaurusSearchResult]);

  const totalThesaurusTerms = useMemo(() => {
    if (!isThesaurus) return 0;
    return getThesaurusTerms(pageDoc || []).length;
  }, [isThesaurus, pageDoc]);

  const visibleThesaurusTerms = useMemo(() => {
    if (!isThesaurus) return 0;
    return (thesaurusSearchResult.entries || []).length;
  }, [isThesaurus, thesaurusSearchResult]);

  const thesaurusEntries = useMemo(() => {
    if (!isThesaurus || !pageDoc) return [];
    return getThesaurusEntries(pageDoc).terms || [];
  }, [isThesaurus, pageDoc]);

  const [start, setStart] = useState();
  const [end, setEnd] = useState();
  const [trigger, setTrigger] = useState(false);
  const [pendingMatch, setPendingMatch] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [pageAppliedRevision, setPageAppliedRevision] = useState(0);
  const pageRequestIdRef = useRef(0);
  const wasEditRef = useRef(false);

  async function resolveNavigationPage({ section, point, anchor }) {
    if (!book) return null;

    const params = new URLSearchParams();
    params.set("book", book);
    params.set("pageSize", String(isThesaurus ? -1 : pageBlockSize));
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

  const initialSection = isThesaurus ? null : searchParams.get("section");
  const initialPoint = isThesaurus ? null : searchParams.get("point");
  const initialAnchor = isThesaurus ? null : searchParams.get("anchor");
  const initialTerm = isThesaurus ? searchParams.get("term") : null;

  useNearestHeadings(setSection, setPoint, fullDoc, pageContext, {
    syncUrl: !isThesaurus,
  });

  useEffect(() => {
    if (!isThesaurus) return;
    // searchParams may already reflect the new book before BookContext updates isThesaurus
    if (searchParams.get("book") !== THESAURUS_BOOK_NAME) return;

    const params = new URLSearchParams(searchParams);
    const hadExtraParams =
      params.has("section") || params.has("point") || params.has("anchor");

    if (!hadExtraParams) return;

    params.delete("section");
    params.delete("point");
    params.delete("anchor");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [isThesaurus, searchParams, router, pathname]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(edit && (!isThesaurus || thesaurusEditorOpen));
    }
  }, [edit, editor, isThesaurus, thesaurusEditorOpen]);

  useEffect(() => {
    const enteredEditMode = !wasEditRef.current && edit;

    if (enteredEditMode && isThesaurus) {
      setThesaurusEditorOpen(false);
      setSelectedThesaurusTerm("");
      setSelectedThesaurusBlocks([]);
      setSelectedThesaurusSynonyms([]);
      setThesaurusModalOpen(false);
      setThesaurusDeleteDialogOpen(false);
      setSynonymsDialogOpen(false);
      setSynonymsDraft("");
      setThesaurusNameDraft("");
      setThesaurusNameError("");
      setEditingTermLabel("");
    }

    wasEditRef.current = edit;
  }, [edit, isThesaurus, setEditingTermLabel]);

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
    if (!isThesaurus || !pageDoc) {
      setSelectedThesaurusTerm("");
      setSelectedThesaurusBlocks([]);
      setSelectedThesaurusSynonyms([]);
      setThesaurusEditorOpen(false);
      setEditingTermLabel("");
      return;
    }
  }, [isThesaurus, pageDoc, setEditingTermLabel]);

  useEffect(() => {
    if (!book) return;
    setIsLoaded(false);
    setIsReadyToScroll(false);
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
    setThesaurusTermQuery("");
  }, [book]);

  useEffect(() => {
    if (!isThesaurus) return;
    // searchParams may already reflect the new book before BookContext updates isThesaurus
    if (searchParams.get("book") !== THESAURUS_BOOK_NAME) return;

    const params = new URLSearchParams(searchParams);
    const hasSearchParams = params.has("query") || params.has("openSearch");
    if (!hasSearchParams) return;

    params.delete("query");
    params.delete("openSearch");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [isThesaurus, pathname, router, searchParams]);

  useEffect(() => {
    if (!book) return;

    if (isThesaurus || pageBlockSize === -1) {
      setCurrentPage(0);
      loadPageDocument(0, -1);
      return;
    }

    loadPageDocument(currentPage, pageBlockSize);
  }, [book, currentPage, pageBlockSize, isThesaurus]);

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
      const contentToRender =
        isThesaurus && !edit
          ? (filteredThesaurusContent || [])
          : isThesaurus && edit && thesaurusEditorOpen
            ? (selectedThesaurusBlocks.length
                ? selectedThesaurusBlocks
                : [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }])
            : pageDoc;

      scheduleSetContent({ type: "doc", content: contentToRender }, false, () => {
        setPageAppliedRevision((prev) => prev + 1);
      });
      // Keep fullDoc in sync with currently loaded page to avoid eager full-book fetch.
      setFullDoc({ type: "doc", content: contentToRender });
      setIsLoaded(true);
      setIsReadyToScroll(true);
    }
  }, [editor, pageDoc, loadingBook, loadingPage, isThesaurus, edit, filteredThesaurusContent, selectedThesaurusBlocks]);

  function openThesaurusEditor(termName) {
    const normalizedTerm = String(termName || "").trim();
    if (!normalizedTerm) return;

    const existingEntry = thesaurusEntries.find(
      (entry) => String(entry.term || "").toLocaleLowerCase("uk") === normalizedTerm.toLocaleLowerCase("uk"),
    );

    const termBlocks = existingEntry?.blocks?.length
      ? existingEntry.blocks
      : buildThesaurusTermBlocks(normalizedTerm, "");
    const termSynonyms = Array.isArray(existingEntry?.synonyms)
      ? existingEntry.synonyms
      : [];

    const bodyBlocks =
      termBlocks[0]?.type === "heading" && termBlocks[0]?.attrs?.level === 2
        ? termBlocks.slice(1)
        : termBlocks;

    setSelectedThesaurusTerm(normalizedTerm);
    setSelectedThesaurusBlocks(bodyBlocks);
    setSelectedThesaurusSynonyms(termSynonyms);
    setSynonymsDraft(termSynonyms.join(", "));
    setThesaurusEditorOpen(true);
    setEditingTermLabel(normalizedTerm);
    setThesaurusModalOpen(false);
    setThesaurusNameDraft("");
    setThesaurusNameError("");
  }

  function openAddThesaurusTermModal() {
    if (!isThesaurus) return;
    setThesaurusModalMode("create");
    setThesaurusNameDraft("");
    setThesaurusNameError("");
    setThesaurusModalOpen(true);
  }

  function openEditThesaurusTermModal() {
    if (!isThesaurus) return;
    setThesaurusModalMode("edit");
    setThesaurusNameDraft("");
    setThesaurusNameError("");
    setThesaurusModalOpen(true);
  }

  function confirmThesaurusModal() {
    const termName = thesaurusNameDraft.trim();
    if (!termName) {
      setThesaurusNameError("Введите название термина");
      return;
    }

    if (thesaurusModalMode === "create") {
      const normalized = termName.toLocaleLowerCase("uk");
      const exists = thesaurusEntries.some(
        (entry) => String(entry.term || "").toLocaleLowerCase("uk") === normalized,
      );

      if (exists) {
        setThesaurusNameError("Такой термин уже существует");
        return;
      }
    }

    setThesaurusNameError("");
    openThesaurusEditor(termName);
  }

  function openDeleteThesaurusTermDialog() {
    if (!isThesaurus) return;
    setPendingDeleteTerm("");
    setThesaurusDeleteDialogOpen(true);
  }

  function parseSynonyms(value) {
    const parts = String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const item of parts) {
      const key = item.toLocaleLowerCase("uk");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }

    return result;
  }

  function openSynonymsDialog() {
    setSynonymsDraft((selectedThesaurusSynonyms || []).join(", "));
    setSynonymsDialogOpen(true);
  }

  function saveSynonyms() {
    const nextSynonyms = parseSynonyms(synonymsDraft);
    setSelectedThesaurusSynonyms(nextSynonyms);
    setSynonymsDraft(nextSynonyms.join(", "));
    setSynonymsDialogOpen(false);
  }

  function confirmDeleteThesaurusTerm(termName) {
    if (!termName) return;
    const nextContent = removeThesaurusTerm(pageDoc || [], termName);
    setPageDoc(nextContent);
    setPendingDeleteTerm("");
    setThesaurusDeleteDialogOpen(false);
    setThesaurusEditorOpen(false);
    setSelectedThesaurusTerm("");
    setSelectedThesaurusBlocks([]);
    setEditingTermLabel("");
  }

  async function save() {
    if (!editor || !book || !pageDoc) return;
    setIsReadyToScroll(false);

    let editedPageContent = editor.getJSON().content;

    if (isThesaurus && edit) {
      if (thesaurusEditorOpen && selectedThesaurusTerm) {
        const termBlocks = buildThesaurusTermBlocks(
          selectedThesaurusTerm,
          editedPageContent,
          { synonyms: selectedThesaurusSynonyms },
        );
        editedPageContent = upsertThesaurusTermBlocks(pageDoc || [], selectedThesaurusTerm, termBlocks);
      } else {
        editedPageContent = addIdsToHeadings(editedPageContent);
      }
    } else {
      // Ensure all headings have IDs before saving
      editedPageContent = addIdsToHeadings(editedPageContent);
      if (isThesaurus) {
        editedPageContent = sortThesaurusContent(editedPageContent);
      }
    }

    if (!isThesaurus || !edit) {
      editedPageContent = addIdsToHeadings(editedPageContent);
    }

    if (isThesaurus) {
      editedPageContent = sortThesaurusContent(editedPageContent);
    }

    const savePageSize = isThesaurus ? -1 : pageBlockSize;

    const res = await fetch("/api/content/book-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book,
        page: currentPage,
        pageSize: savePageSize,
        content: editedPageContent,
      }),
    });

    if (!res.ok) {
      alert("Ошибка при сохранении страницы");
      return;
    }

    await loadPageDocument(currentPage, savePageSize);

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
      isThesaurus || pageBlockSize === -1
        ? 0
        : Math.floor(match.blockIndex / pageBlockSize);

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
    if (!initialSection && !initialPoint && !initialAnchor && !initialTerm) return;

    setStart(NaN);
    setEnd(NaN);
    triggerHighlight();

    if (!isReadyToScroll) return;

    let cancelled = false;

    (async () => {
      if (isThesaurus && initialTerm) {
        setPendingNavigation({
          page: 0,
          type: "term",
          value: initialTerm,
          blockIndex: -1,
        });
        setCurrentPage(0);
        return;
      }

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
    initialTerm,
    isThesaurus,
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

      // Full page load so the Reader always mounts fresh with the correct URL
      window.location.assign(url.pathname + url.search + url.hash);
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
        !edit && !isThesaurus && (
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
          onAddTerm={openAddThesaurusTermModal}
          onEditTerm={openEditThesaurusTermModal}
          onDeleteTerm={openDeleteThesaurusTermDialog}
          onEditSynonyms={openSynonymsDialog}
          termEditorMode={isThesaurus && thesaurusEditorOpen}
          save={() => {
            save();
            setEdit(false);
          }}
        />
      ) : null}

      <div ref={containerRef}>
        {isLoaded && isThesaurus && !edit && (
          <Box
            sx={{
              mb: 2,
              mt: 1,
              position: "sticky",
              top: "8.5rem",
              zIndex: 950,
              backgroundColor: "rgba(248, 244, 239, 0.92)",
              backdropFilter: "blur(4px)",
              borderRadius: 1,
              p: 1,
            }}
          >
            <TextField
              fullWidth
              label="Поиск по терминам"
              placeholder="Введите начало термина"
              value={thesaurusTermQuery}
              onChange={(e) => setThesaurusTermQuery(e.target.value)}
              size="small"
              autoComplete="off"
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "#fff",
                },
                "& .MuiInputBase-input": {
                  fontWeight: 700,
                  color: "#111",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#b81414",
                  borderWidth: "2px",
                },
                "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#8e1010",
                },
                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#8e1010",
                },
              }}
              slotProps={{
                inputLabel: {
                  sx: {
                    color: "#b81414",
                    fontWeight: 600,
                  },
                },
              }}
            />
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              Найдено терминов: {visibleThesaurusTerms} из {totalThesaurusTerms}
            </Typography>

          </Box>
        )}

        {isLoaded && isThesaurus && edit && thesaurusEditorOpen ? (
          <Box sx={{ mt: { xs: 4, md: 3 } }}>
            <EditorContent editor={editor} />
            <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
              <Button variant="contained" color="success" onClick={() => { save(); setEdit(false); }}>
                Сохранить термин
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setThesaurusEditorOpen(false);
                  setEditingTermLabel("");
                }}
              >
                Назад
              </Button>
            </Box>
          </Box>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      <Dialog open={thesaurusModalOpen} onClose={() => setThesaurusModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {thesaurusModalMode === "create" ? "Добавить термин" : "Редактировать термин"}
        </DialogTitle>
        <DialogContent>
          {thesaurusModalMode === "create" ? (
            <TextField
              autoFocus
              fullWidth
              label="Назва терміна"
              value={thesaurusNameDraft}
              onChange={(e) => {
                setThesaurusNameDraft(e.target.value);
                if (thesaurusNameError) setThesaurusNameError("");
              }}
              sx={{ mt: 1 }}
            />
          ) : (
            <List sx={{ mt: 1 }}>
              {thesaurusEntries.map((entry) => (
                <ListItemButton key={entry.term} onClick={() => openThesaurusEditor(entry.term)}>
                  <ListItemText primary={entry.term} />
                </ListItemButton>
              ))}
            </List>
          )}
          {thesaurusNameError ? (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {thesaurusNameError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setThesaurusModalOpen(false)}>Отмена</Button>
          {thesaurusModalMode === "create" ? (
            <Button variant="contained" onClick={confirmThesaurusModal}>
              Відкрити редактор
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={thesaurusDeleteDialogOpen} onClose={() => setThesaurusDeleteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Удалить термин</DialogTitle>
        <DialogContent>
          <List>
            {thesaurusEntries.map((entry) => (
              <ListItemButton key={entry.term} onClick={() => confirmDeleteThesaurusTerm(entry.term)}>
                <ListItemText primary={entry.term} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setThesaurusDeleteDialogOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={synonymsDialogOpen} onClose={() => setSynonymsDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Редактировать синонимы</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Синонимы через запятую"
            value={synonymsDraft}
            onChange={(e) => setSynonymsDraft(e.target.value)}
            sx={{ mt: 1 }}
            placeholder="например: вода, H2O"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSynonymsDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveSynonyms}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {isLoaded && fullDoc && !edit && (
        <>
          {!isThesaurus && (
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
            </>
          )}

          {isLoaded && !edit && !isThesaurus && (
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

  let blockStart = 0;
  for (let i = 0; i < blockIndex; i++) {
    blockStart += doc.child(i).nodeSize;
  }

  let currentNode = doc.child(blockIndex);
  let parentContentStart = blockStart + 1;
  let currentStart = NaN;

  for (let pathIndex = 0; pathIndex < childIndexPath.length; pathIndex++) {
    const idx = childIndexPath[pathIndex];
    if (!currentNode || idx < 0 || idx >= currentNode.childCount) return NaN;

    let childOffset = 0;
    for (let i = 0; i < idx; i++) {
      childOffset += currentNode.child(i).nodeSize;
    }

    const childStart = parentContentStart + childOffset;
    const childNode = currentNode.child(idx);

    currentNode = childNode;
    currentStart = childStart;
    parentContentStart = childStart + 1;
  }

  if (!currentNode?.isText) return NaN;
  if (!Number.isFinite(currentStart)) return NaN;

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
