import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { ResizableBox } from "react-resizable";
import "react-resizable/css/styles.css";
import { useEffect, useRef, useState } from "react";

const CustomImage = Image.extend({
  name: "customImage",

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 300,
        parseHTML: (element) =>
          parseInt(element.getAttribute("data-width")) || 300,
        renderHTML: (attributes) => ({
          "data-width": attributes.width,
        }),
      },
      height: {
        default: 200,
        parseHTML: (element) =>
          parseInt(element.getAttribute("data-height")) || 200,
        renderHTML: (attributes) => ({
          "data-height": attributes.height,
        }),
      },
      alignment: {
        default: "center", // 'left', 'right', or 'center'
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({
          "data-align": attributes.alignment,
        }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, alignment = "center", ...rest } = HTMLAttributes;

    const styleParts = [
      `width: ${width}px`,
      `height: ${height}px`,
      `object-fit: contain`,
    ];

    if (alignment === "left") {
      styleParts.push("float: left", "margin: 0 1em 1em 0", "display: inline");
    } else if (alignment === "right") {
      styleParts.push("float: right", "margin: 0 0 1em 1em", "display: inline");
    } else if (alignment === "center") {
      styleParts.push("display: block", "margin: 1em auto", "float: none");
    }

    return ["img", { ...rest, style: styleParts.join("; ") }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CustomImageComponent);
  },
});

export default CustomImage;

export function CustomImageComponent({ node, updateAttributes, editor }) {
  const readOnly = !editor.isEditable;
  const { src, width = 300, height = 200, alignment = "center" } = node.attrs;
  const [isActive, setIsActive] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const floatStyle =
    alignment === "left" ? "left" : alignment === "right" ? "right" : "none";

  const marginStyle =
    alignment === "left"
      ? "0 1em 1em 0"
      : alignment === "right"
      ? "0 0 1em 1em"
      : "1em auto";

  let wrapperStyle = {
    float: floatStyle,
    margin: marginStyle,
    display: "inline-block",
    position: "relative",
    cursor: readOnly ? "default" : "pointer",
  };

  if (alignment === "center") {
    wrapperStyle = {
      ...wrapperStyle,
      float: "none",
      width: "100%",
      display: "flex",
      justifyContent: "center",
    };
  }

  const buttonStyle = {
    position: "absolute",
    top: 5,
    right: 5,
    display: isActive ? "flex" : "none",
    gap: "4px",
    zIndex: 10,
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      style={wrapperStyle}
      onClick={() => {
        if (readOnly) return;
        setIsActive(true);
      }}
    >
      <div style={buttonStyle}>
        <button onClick={() => updateAttributes({ alignment: "left" })}>
          Left
        </button>
        <button onClick={() => updateAttributes({ alignment: "center" })}>
          Center
        </button>
        <button onClick={() => updateAttributes({ alignment: "right" })}>
          Right
        </button>
      </div>

      {readOnly ? (
        <img
          src={src}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            objectFit: "contain",
            display: "block",
          }}
          contentEditable={false}
        />
      ) : (
        <ResizableBox
          width={width}
          height={height}
          onResizeStop={(e, data) => {
            updateAttributes({
              width: data.size.width,
              height: data.size.height,
            });
          }}
          resizeHandles={["se"]}
          minConstraints={[50, 50]}
        >
          <img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
            contentEditable={false}
          />
        </ResizableBox>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
