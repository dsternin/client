// tiptapExtensions.js

import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import CustomParagraph from "@/components/Tiptap/extensions/CustomParagraph";
import CustomImage from "@/components/Tiptap/extensions/CustomImage";
import Underline from "@tiptap/extension-underline";
import { TextBox } from "@/components/Tiptap/extensions/TextBox";

export default function getEditorExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      paragraph: false,
    }),
    TextStyle,
    Color.configure({ types: ["textStyle"] }),
    CustomParagraph,
    CustomImage,
    TextBox,
    Underline,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
  ];
}
