"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import Search from "../Search";
import { CircularProgress, Box, Button, Typography } from "@mui/material";
import { useBookContext } from "@/store/BookContext";
import TipTapButtons from "../Tiptap/TipTapButtons";
import MenuButton from "../MenuButtons";
import useNearestHeadings from "@/hooks/useNearestHeadings";
import { useSearchParams } from "next/navigation";

export default function Reader() {
  const { book = "intro", setBookLabel, edit, setEdit } = useBookContext();
  const { editor, isLoaded } = useBookEditor(book, edit, setBookLabel);
  const { setSection, setPoint } = useBookContext();
  const [fullDoc, setFullDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageBlockSize, setPageBlockSize] = useState(-1);
  function updateBlockSize(value) {
    const newSize = parseInt(value);
    setPageBlockSize(newSize);
    setCurrentPage(0);
    if (fullDoc && editor) {
      const sliced = {
        ...fullDoc,
        content:
          newSize === -1 ? fullDoc.content : fullDoc.content.slice(0, newSize),
      };
      editor.commands.setContent(sliced, false);
    }
  }
  const pageLabel = pageBlockSize === -1 ? "Весь текст" : `${pageBlockSize}`;

  const [start, setStart] = useState();
  const [end, setEnd] = useState();
  const [trigger, setTrigger] = useState(false);

  const searchParams = useSearchParams();

  const initialSection = searchParams.get("section");
  const initialPoint = searchParams.get("point");

  useNearestHeadings(setSection, setPoint);

  useEffect(() => {
    if (editor) {
      editor.setEditable(edit);
    }
  }, [edit]);

  function triggerHighlight() {
    setTrigger((prev) => !prev);
  }

  async function save() {
    if (!editor || !book || !fullDoc) return;

    const editedPageContent = editor.getJSON().content;
    const pageStart = currentPage * pageBlockSize;
    const pageEnd = pageStart + pageBlockSize;

    const updatedFullDoc = {
      ...fullDoc,
      content: [
        ...fullDoc.content.slice(0, pageStart),
        ...editedPageContent,
        ...fullDoc.content.slice(pageEnd),
      ],
    };

    const fullContent = updatedFullDoc;
    const chapters = [];
    let currentChapter = null;

    for (const block of fullContent.content) {
      if (block.type === "heading" && block.attrs?.level === 1) {
        if (currentChapter) {
          const res = await fetch("/api/content/chapters", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              book,
              section: currentChapter.slug,
              content: { type: "doc", content: currentChapter.content },
            }),
          });
          const data = await res.json();
          if (data.section) chapters.push(data.section);
        }
        currentChapter = {
          slug: block.content?.[0]?.text || "glava",
          content: [block],
        };
      } else if (currentChapter) {
        currentChapter.content.push(block);
      }
    }

    if (currentChapter) {
      const res = await fetch("/api/content/chapters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book,
          section: currentChapter.slug,
          content: { type: "doc", content: currentChapter.content },
        }),
      });
      const data = await res.json();
      if (data.section) chapters.push(data.section);
    }

    const update = await fetch("/api/content/books", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, chapters }),
    });

    if (!update.ok) {
      alert("Ошибка при сохранении книги");
    } else {
      setFullDoc(updatedFullDoc);
      alert("Сохранено успешно!");
    }
  }

  function highlight(start, end) {
    setEnd(end);
    setStart(start);
  }

  function goToPage(page) {
    if (!fullDoc || !editor || pageBlockSize === -1) return;
    const start = page * pageBlockSize;
    const end = pageBlockSize === -1 ? undefined : start + pageBlockSize;
    const sliced = {
      ...fullDoc,
      content: fullDoc.content.slice(start, end),
    };
    setCurrentPage(page);
    editor.commands.setContent(sliced, false);
  }

  function goToMatch(match) {
    const pageIndex = Math.floor(match.blockIndex / pageBlockSize);
    const sliceStart = pageIndex * pageBlockSize;
    const sliceEnd = sliceStart + pageBlockSize;
    const sliced = {
      ...fullDoc,
      content: fullDoc.content.slice(sliceStart, sliceEnd),
    };

    setTimeout(() => {
      setCurrentPage(pageIndex);
      editor.commands.setContent(sliced, false);

      setTimeout(() => {
        const localBlockIndex = match.blockIndex % pageBlockSize;
        const relativePos = getRelativePositionInSlice(
          sliced,
          localBlockIndex,
          match.childIndexPath,
          match.charIndex
        );
        highlight(relativePos, relativePos + match.length);
      }, 0);
    }, 0);
  }

  useEffect(() => {
    if (!editor || isNaN(start) || isNaN(end)) return;
    editor.commands.setSearchHighlight(start, end);
    const el = document.getElementById("search-target");
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }, [start, end, trigger]);

  useEffect(() => {
    if (!isLoaded || !editor) return;
    const json = editor.getJSON();
    setFullDoc(json);

    const slice = {
      ...json,
      content: json.content.slice(0, pageBlockSize),
    };
    editor.commands.setContent(slice, false);
  }, [editor, isLoaded]);

  useEffect(() => {
    function goToSection(id) {
      if (!fullDoc || !Array.isArray(fullDoc.content)) return;
      const index = fullDoc.content.findIndex(
        (block) => block.attrs?.id === id
      );
      if (index === -1) return;

      const pageIndex = Math.floor(index / pageBlockSize);
      const sliceStart = pageIndex * pageBlockSize;
      const sliceEnd = sliceStart + pageBlockSize;
      const sliced = {
        ...fullDoc,
        content: fullDoc.content.slice(sliceStart, sliceEnd),
      };

      setCurrentPage(pageIndex);
      editor.commands.setContent(sliced, false);

      waitForElement(`#${CSS.escape(id)}`, 10).then((el) => {
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    if (!isLoaded || (!initialSection && !initialPoint)) return;
    triggerHighlight();
    const targetId = initialPoint || initialSection;
    goToSection(targetId);
  }, [editor, isLoaded, initialPoint, initialSection]);

  const totalPages = fullDoc
    ? pageBlockSize === -1
      ? 1
      : Math.ceil(fullDoc.content.length / pageBlockSize)
    : 0;
  return (
    <>
      {isLoaded ? (
        !edit && (
          <Search
            highlight={highlight}
            editor={editor}
            fullDoc={fullDoc}
            goToMatch={goToMatch}
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

      <EditorContent editor={editor} />

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
                200: () => updateBlockSize(200),
                500: () => updateBlockSize(500),
                "-1": () => updateBlockSize(-1),
              }}
              renderOption={(key) => (key === "-1" ? "Весь текст" : `${key}`)}
            />
          </Box>
        </>
      )}
    </>
  );
}

function getNodeLength(node) {
  if (!node) return 0;
  if (node.text) return node.text.length;
  if (node.type === "customImage" || node.type === "hardBreak") return 1;
  if (node.content) {
    return node.content.reduce((sum, child) => sum + getNodeLength(child), 2);
  }
  return 2;
}

function getRelativePositionInSlice(
  slice,
  blockIndex,
  childIndexPath,
  charIndex
) {
  let pos = 1;

  for (let i = 0; i < blockIndex; i++) {
    const block = slice.content[i];
    pos += getNodeLength(block);
  }

  let currentNode = slice.content[blockIndex];
  for (let idx of childIndexPath) {
    if (!currentNode || !currentNode.content || !currentNode.content[idx])
      break;
    for (let i = 0; i < idx; i++) {
      pos += getNodeLength(currentNode.content[i]);
    }
    currentNode = currentNode.content[idx];
  }

  return pos + charIndex;
}

function waitForElement(selector, maxTries = 20, delay = 100) {
  return new Promise((resolve) => {
    let tries = 0;
    function check() {
      const el = document.querySelector(selector);
      if (el && el.offsetHeight > 0) return resolve(el);
      if (tries++ >= maxTries) return resolve(null);
      setTimeout(check, delay);
    }
    check();
  });
}
