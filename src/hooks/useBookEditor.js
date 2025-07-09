import { useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import getEditorExtensions from "@/lib/tiptapExtensions";

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
            if (content.length > 0 && content[0].type === "heading") {
              content[0].attrs = {
                ...content[0].attrs,
                id: section,
              };
            }
            return content;
          })
        );

        const combinedContent = allChapters.flat();
        editor.commands.setContent({ type: "doc", content: combinedContent });
        setIsloaded(true);
      });
  }, [book, editor]);

  return { editor, isLoaded };
}
