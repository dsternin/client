import { Mark } from "@tiptap/core";

const SearchHighlight = Mark.create({
  name: "searchHighlight",

  addAttributes() {
    return {
      class: {
        default: "search-highlight",
      },
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span.search-highlight",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setSearchHighlight:
        (from, to) =>
        ({ chain }) => {
          return chain()
            .command(({ tr }) => {
              tr.doc.descendants((node, pos) => {
                if (node.marks) {
                  node.marks.forEach((mark) => {
                    if (mark.type.name === this.name) {
                      tr.removeMark(pos, pos + node.nodeSize, mark.type);
                    }
                  });
                }
              });
              return true;
            })
            .setTextSelection({ from, to })
            .setMark(this.name, {
              class: "search-highlight",
              id: "search-target",
            })
            .run();
        },

      unsetSearchHighlight:
        () =>
        ({ chain }) => {
          return chain()
            .command(({ tr }) => {
              tr.doc.descendants((node, pos) => {
                if (node.marks) {
                  node.marks.forEach((mark) => {
                    if (mark.type.name === this.name) {
                      tr.removeMark(pos, pos + node.nodeSize, mark.type);
                    }
                  });
                }
              });
              return true;
            })
            .run();
        },
    };
  },
});

export default SearchHighlight;
