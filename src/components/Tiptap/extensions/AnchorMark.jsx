import { Mark, mergeAttributes } from "@tiptap/core";

function slugify(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const AnchorMark = Mark.create({
  name: "anchor",

  inclusive: false,

  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.anchorId) return {};
          return {
            id: attributes.anchorId,
            "data-anchor": "true",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-anchor]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setAnchor:
        () =>
        ({ commands, editor }) => {
          const { from, to } = editor.state.selection;
          const selectedText = editor.state.doc
            .textBetween(from, to, " ")
            .trim();
          const finalId = slugify(selectedText);

          return commands.setMark(this.name, { anchorId: finalId });
        },

      unsetAnchor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default AnchorMark;
