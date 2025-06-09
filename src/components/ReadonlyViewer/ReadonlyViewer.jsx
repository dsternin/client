"use client";

import getEditorExtensions from "@/lib/tiptapExtensions";
import { EditorContent, useEditor } from "@tiptap/react";

export default function ReadonlyViewer({ content }) {
  const editor = useEditor({
    editable: false,
    extensions: getEditorExtensions(),
    immediatelyRender: false,
    content: content,
  });

  return (
    <div style={{ all: "unset" }}>
      <EditorContent editor={editor} />
    </div>
  );
}
