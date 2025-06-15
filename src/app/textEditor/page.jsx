"use client";
import { useAuth } from "@/store/AuthContext";
import { Box, Button, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const Tiptap = dynamic(() => import("@/components/Tiptap"), { ssr: false });

export default function TextEditorPage() {
  const { user, reset } = useAuth();

  const router = useRouter();
  if (user?.role !== "admin") {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h6" gutterBottom>
          Этот функционал доступен только администраторам.
        </Typography>
        <Button variant="contained" onClick={() => router.push("/login")}>
          Войти
        </Button>
      </Box>
    );
  } else {
  }
  return (
    <Box sx={{ p: 6 }}>
      <Typography variant="h4" component="h1" fontWeight="bold" mb={4}>
        Редактор текста
      </Typography>
      <Tiptap />
    </Box>
  );
}
