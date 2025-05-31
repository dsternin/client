"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Home() {
  const [text, setText] = useState("");
  const [dedication, setDedication] = useState("");
  useEffect(() => {
    fetch("/api/intro")
      .then((res) => res.json())
      .then((data) => {
        setText(data.message);
        setDedication(data.dedication);
      });
  }, []);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Image alt="sky" width={500} height={500 * 0.6} src="/oblako.jpg" />
      </div>
      {/* <p>"{dedication}"</p> */}
      <div dangerouslySetInnerHTML={{ __html: text }} />
    </>
  );
}
