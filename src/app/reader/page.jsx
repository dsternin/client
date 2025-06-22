"use client";
import Reader from "@/components/Reader";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const book = searchParams.get("book");
  const section = searchParams.get("section");
  return (
    <Suspense>
      <Reader book={book} section={section} />
    </Suspense>
  );
}
