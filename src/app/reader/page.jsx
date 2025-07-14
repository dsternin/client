import Reader from "@/components/Reader";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <Reader />
    </Suspense>
  );
}
