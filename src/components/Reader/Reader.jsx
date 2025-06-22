"use client";

import useBookEditor from "@/hooks/useBookEditor";
import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";

export default function Reader({ book = "intro", section = "" }) {
  const { editor, isLoaded } = useBookEditor(book, false);

  useEffect(() => {
    if (!isLoaded || !section) return;

    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [editor, section, isLoaded]);

  return <EditorContent editor={editor} />;
}
