import Heading from "@tiptap/extension-heading";

const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return {
            id: attributes.id,
          };
        },
      },
    };
  },
});

export default CustomHeading;