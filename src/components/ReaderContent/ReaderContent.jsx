"use client";

import { useSearchParams } from "next/navigation";
import Reader from "../Reader";



export default function ReaderContent() {
  const searchParams = useSearchParams();
  const book = searchParams.get("book");
  const section = searchParams.get("section");
  return <Reader book={book} section={section} />;
}
