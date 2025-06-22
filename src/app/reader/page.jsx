import ReaderContent from "@/components/ReaderContent";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <ReaderContent />
    </Suspense>
  );
}
