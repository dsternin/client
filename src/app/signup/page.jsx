"use client"
import dynamic from "next/dynamic";

const Tiptap = dynamic(() => import("@/components/Tiptap"), { ssr: false });

export default function TextEditorPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Редактор текста</h1>
      <Tiptap />
    </main>
  );
}
