"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Image from "next/image";
// import ReadonlyViewer from "../ReadonlyViewer";

const ReadonlyViewer = dynamic(() => import("../ReadonlyViewer"), {
  ssr: false,
});

export default function Home() {
  const [content, setContent] = useState("");
  useEffect(() => {
    fetch("/api/content/intro")
      .then((res) => res.json())
      .then((data) => {
        setContent(data.content);
      });
  }, []);
  return (
    <>
      {/* <div style={{ display: "flex", justifyContent: "center" }}>
        <Image alt="sky" width={500} height={500 * 0.6} src="/oblako.jpg" />
      </div> */}
      {content ? <ReadonlyViewer content={content} /> : "Загрузка"}
    </>
  );
}
