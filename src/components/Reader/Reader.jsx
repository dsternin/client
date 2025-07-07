"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import Search from "../Search";

export default function Reader({ book = "intro", section = "" }) {
  const { editor, isLoaded } = useBookEditor(book, false);
  const [start, setSart] = useState();
  const [end, setEnd] = useState();
  const [trigger, setTrigger] = useState(false);

  function triggerHighlight() {
    setTrigger((prev) => !prev);
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

  function highlight(start, end) {
    setEnd(end);
    setSart(start);
  }

  useEffect(() => {
    if (!isLoaded || !section) return;
    triggerHighlight();
    const el = document.getElementById(section);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }, [editor, section, isLoaded]);

  return (
    <>
      {isLoaded ? (
        <Search
          highlight={highlight}
          unsetSearchHighlight={editor.commands.unsetSearchHighlight}
          editor={editor}
        />
      ) : null}
      <EditorContent editor={editor} />
    </>
  );
}
