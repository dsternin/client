import { useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import getEditorExtensions from "@/lib/tiptapExtensions";

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

export default function useBookEditor(book, editable) {
  const [isLoaded, setIsloaded] = useState(false);
  const editor = useEditor({
    extensions: getEditorExtensions(),
    immediatelyRender: false,
    content: "Загрузка",
    editable,
  });

  useEffect(() => {
    if (!book || !editor) return;
    setIsloaded(false);
    fetch(`/api/content/books?book=${book}`)
      .then(async (res) => {
        if (res.status === 404) {
          editor.commands.setContent({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Ещё нет текста книги" }],
              },
            ],
          });
          return null;
        }
        return res.json();
      })
      .then(async (data) => {
        if (!data) return;
        const chapterNames = data.chapters || [];
        if (!chapterNames.length) return;

        const allChapters = await Promise.all(
          chapterNames.map(async (section) => {
            const res = await fetch(
              `/api/content/chapters?book=${book}&section=${encodeURIComponent(
                section.title
              )}`
            );
            const data = await res.json();
            const content = data.content?.content || [];
            return addIdsToHeadings(content);
          })
        );

        const combinedContent = allChapters.flat();
        editor.commands.setContent({ type: "doc", content: combinedContent });
        setIsloaded(true);
      });
  }, [book, editor]);

  return { editor, isLoaded };
}
