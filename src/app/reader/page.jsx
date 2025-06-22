"use client"
import Reader from "@/components/Reader";
import { useSearchParams } from "next/navigation";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const book = searchParams.get("book");
  const section = searchParams.get("section");
  return <Reader book={book} section={section} />;
}
