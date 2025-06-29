"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import Search from "../Search";

export default function Reader({ book = "intro", section = "" }) {
  const { editor, isLoaded } = useBookEditor(book, false);

  function highlight(start, end) {
    if (!editor || isNaN(start) || isNaN(end)) return;

    editor.commands.unsetSearchHighlight();
    console.log(start, end);

    // editor.commands.setSearchHighlight(12, 13);
    editor.commands.setSearchHighlight(start, end);
    // editor.commands.setSearchHighlight(17, 19);



    const el = document.getElementById("search-target");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  useEffect(() => {
    if (!isLoaded || !section) return;

    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [editor, section, isLoaded]);

  return (
    <>
      {editor ? (
        <Search
          highlight={highlight}
          unsetSearchHighlight={editor.commands.unsetSearchHighlight}
          editor={editor}
        />
      ) : null}
      <EditorContent editor={editor} />;
    </>
  );
}
