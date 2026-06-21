import { useEditor } from "@tiptap/react";
import { useEffect } from "react";
import getEditorExtensions from "@/lib/tiptapExtensions";

export default function useBookEditor(editable) {
  const editor = useEditor({
    extensions: getEditorExtensions(),
    immediatelyRender: false,
    content: "Загрузка",
    editable,
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  return { editor };
}
