"use client";

import { useAuth } from "@/store/AuthContext";
import { Typography, Button, Stack } from "@mui/material";
import { useRouter } from "next/navigation";

export default function AdminPanel({ children }) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ marginTop: "2rem" }}>
      <Typography variant="h6" gutterBottom>
        Панель администратора
      </Typography>

      <Stack spacing={2} direction="column">
        <Button
          onClick={() => router.push("/textEditor?section=intro")}
          variant="contained"
          color="primary"
        >
          ✏️ Редактировать вступление
        </Button>
        <Button variant="contained" color="primary">
          📚 Редактировать книги
        </Button>
        <Button variant="contained" color="primary">
          👥 Управление пользователями
        </Button>
      </Stack>

      {children && (
        <Typography variant="body2" sx={{ color: "error.main", mt: 2 }}>
          {children}
        </Typography>
      )}
    </div>
  );
}
