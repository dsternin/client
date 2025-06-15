import { Node, mergeAttributes } from "@tiptap/core";

export const TextBox = Node.create({
  name: "textBox",

  group: "block",
  content: "block+",
  atom: false,

  parseHTML() {
    return [
      {
        tag: "div[data-type='text-box']",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "text-box",
        class: "text-box",
      }),
      0,
    ];
  },

  addAttributes() {
    return {
      float: {
        default: "none",
        parseHTML: (element) => element.style.float || "none",
        renderHTML: (attributes) => ({}),
      },
      backgroundColor: {
        default: "#f9f9f9",
        parseHTML: (element) => element.style.backgroundColor || "#f9f9f9",
        renderHTML: ({ backgroundColor }) => ({
          style: `background-color: ${backgroundColor}`,
        }),
      },
      borderColor: {
        default: "#888",
        parseHTML: (element) => element.style.borderColor || "#888",
        renderHTML: ({ borderColor }) => ({
          style: `border-color: ${borderColor}`,
        }),
      },
      displayStyle: {
        default: "block",
        parseHTML: (element) => element.getAttribute("data-display-style") || "block",
        renderHTML: ({ displayStyle }) => ({
          "data-display-style": displayStyle,
          style:
            displayStyle === "float-left"
              ? "float: left; margin: 1em;"
              : displayStyle === "float-right"
              ? "float: right; margin: 1em;"
              : "display: block; margin: 1em auto;",
        }),
      },
    };
  },
});
