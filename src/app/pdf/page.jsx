"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@mui/material";

export default function PDFStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Ожидание завершения экспорта...");
  const [oldAvailable, setOldAvailable] = useState(false);

  const name = searchParams.get("name");

  useEffect(() => {
    if (!name) return;

    const filename = name
      .trim()
      .split(/\s+/)[0]
      .replace(/[\/\\?%*:|"<>]/g, "_");

    const checkOldVersion = async () => {
      try {
        const res = await fetch(`/api/pdf/${filename}?old=1`, {
          method: "HEAD",
        });
        if (res.ok) setOldAvailable(true);
      } catch (err) {
        console.error("Ошибка при проверке старой версии PDF:", err);
      }
    };

    checkOldVersion();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pdf/${filename}`, { method: "HEAD" });
        if (res.ok) {
          clearInterval(interval);
          setStatus("Готово! Скачивание начнётся...");
          router.replace(`/api/pdf/${filename}`);
        }
      } catch (err) {
        console.error("Ошибка при проверке PDF:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [name, router]);

  const handleOpenOld = () => {
    const filename = name
      .trim()
      .split(/\s+/)[0]
      .replace(/[\/\\?%*:|"<>]/g, "_");

    router.replace(`/api/pdf/${filename}?old=1`);
  };

  return (
    <main style={{ padding: "2rem", fontSize: "1.5rem" }}>
      <div>{status}</div>
      {oldAvailable && (
        <Button variant="contained" onClick={handleOpenOld}>
          Открыть предыдущую версию
        </Button>
      )}
    </main>
  );
}
