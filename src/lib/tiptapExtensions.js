// tiptapExtensions.js

import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import CustomParagraph from "@/components/Tiptap/extensions/CustomParagraph";
import CustomImage from "@/components/Tiptap/extensions/CustomImage";

export default function getEditorExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2],
      },
      paragraph: false, 
    }),
    CustomParagraph,
    CustomImage,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
  ];
}
