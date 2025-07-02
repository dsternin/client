// tiptapExtensions.js

import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import CustomParagraph from "@/components/Tiptap/extensions/CustomParagraph";
import CustomImage from "@/components/Tiptap/extensions/CustomImage";
import Underline from "@tiptap/extension-underline";
import { TextBox } from "@/components/Tiptap/extensions/TextBox";
import CustomHeading from "@/components/Tiptap/extensions/CustomHeading";
import SearchHighlight from "@/components/Tiptap/extensions/SearchHighlight";
import Link from "@tiptap/extension-link";

export default function getEditorExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      paragraph: false,
    }),
    CustomHeading.configure({
      levels: [1, 2, 3],
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
    SearchHighlight,
    Link.configure({
      openOnClick: true,
      autolink: true,
      linkOnPaste: true,
    }),
  ];
}
