"use client";

import styles from "./BookInfoPanel.module.css";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import { useAuth } from "@/store/AuthContext";
import { useBookContext } from "@/store/BookContext";
import { THESAURUS_BOOK_NAME } from "@/lib/thesaurus";
import { readProgressResponse } from "@/lib/readProgressResponse";
import { useEffect, useState } from "react";

async function runBackupOperation(method, body, onProgress) {
  const response = await fetch("/api/admin/book-backups", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await readProgressResponse(
    response,
    onProgress,
    "Не удалось выполнить операцию с бекапом",
    "Соединение прервано. Проверьте состояние бекапа перед повтором.",
  );
  onProgress({ stage: "Готово", percent: 100 });
}

function BackupProgress({ progress }) {
  if (!progress) return null;
  return (
    <Box sx={{ mt: 1 }} aria-live="polite">
      <Typography variant="body2">
        {progress.stage}
        {progress.percent !== null ? ` — примерно ${progress.percent}%` : ""}
      </Typography>
      <LinearProgress
        variant={progress.percent === null ? "indeterminate" : "determinate"}
        value={progress.percent === null ? undefined : progress.percent}
      />
    </Box>
  );
}

export default function BookInfoPanel() {
  const {
    bookLabel,
    section,
    point,
    edit,
    setEdit,
    book,
    editingTermLabel,
  } = useBookContext();
  const { user, loaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backups, setBackups] = useState([]);
  const [error, setError] = useState("");
  const [backupBeforeEdit, setBackupBeforeEdit] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isThesaurus = book === THESAURUS_BOOK_NAME;

  const editButtonIsVisible = mounted && loaded && user?.role === "admin" && !edit;

  const handleEdit = async () => {
    setError("");
    if (!backupBeforeEdit) {
      setEdit(true);
      return;
    }
    setBusy(true);
    setProgress({ stage: "Подготовка", percent: null });
    try {
      await runBackupOperation("POST", { book }, setProgress);
      setEdit(true);
    } catch (error) {
      console.error("Failed to create backup:", error);
      setError(error.message || "Не удалось создать бекап");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const openBackups = async () => {
    setBackupDialogOpen(true);
    setBusy(true);
    setError("");
    setProgress(null);
    setBackups([]);
    try {
      const response = await fetch("/api/admin/book-backups", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось получить список бекапов");
      setBackups(data.backups);
    } catch (error) {
      console.error("Failed to list backups:", error);
      setError(error.message || "Не удалось получить список бекапов");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (backup) => {
    if (!window.confirm(
      `Восстановить все книги, тезаурус, якоря, вводный контент и изображения из бекапа от ${new Date(backup.createdAt).toLocaleString()}? Текущее состояние и изменения других редакторов будут заменены без создания нового бекапа.`,
    )) return;
    setBusy(true);
    setError("");
    setProgress({ stage: "Подготовка", percent: null });
    try {
      await runBackupOperation("PUT", { id: backup.id }, setProgress);
      window.location.reload();
    } catch (error) {
      console.error("Failed to restore backup:", error);
      setError(error.message || "Не удалось восстановить бекап");
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Box className={styles.bookInfoPanel}>
      <Box className={styles.infoBlock}>
        <Typography variant="body1">
          📖 Книга: <strong>{bookLabel || "не выбрано"}</strong>
          {isThesaurus && edit && editingTermLabel ? (
            <>
              {" "}
              <span>
                · Редактирование термина <strong>"{editingTermLabel}"</strong>
              </span>
            </>
          ) : null}
        </Typography>
        {!isThesaurus && (
          <>
            <Typography variant="body1">
              📂 Глава: <strong>{section || "не выбрано"}</strong>
            </Typography>
            <Typography variant="body1">
              📄 Секция: <strong>{point || "не выбрано"}</strong>
            </Typography>
          </>
        )}
      </Box>

      {editButtonIsVisible ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" onClick={handleEdit} disabled={busy || !book}>
              {busy && !backupDialogOpen ? "Создание бекапа..." : "Редактировать"}
            </Button>
            <Button variant="outlined" onClick={openBackups} disabled={busy}>
              Бекапы
            </Button>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={backupBeforeEdit}
                onChange={(event) => setBackupBeforeEdit(event.target.checked)}
                disabled={busy}
              />
            }
            label="Создать бекап перед редактированием"
          />
          {!backupDialogOpen ? <BackupProgress progress={progress} /> : null}
          {error && !backupDialogOpen ? <Alert severity="error">{error}</Alert> : null}
        </Box>
      ) : null}

      <Dialog
        open={backupDialogOpen}
        onClose={() => { if (!busy) setBackupDialogOpen(false); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Бекапы всех книг</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Восстановление заменит все книги, тезаурус, якоря, вводный контент и изображения.
          </Typography>
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
          {progress ? <BackupProgress progress={progress} /> : null}
          {busy && !progress ? <Typography sx={{ mt: 2 }}>Подождите...</Typography> : null}
          {!busy && !error && backups.length === 0 ? (
            <Typography sx={{ mt: 2 }}>Бекапов пока нет.</Typography>
          ) : null}
          <List>
            {backups.map((backup) => (
              <ListItem key={backup.id} disableGutters>
                <ListItemText
                  primary={`${new Date(backup.createdAt).toLocaleString()}.${String(new Date(backup.createdAt).getMilliseconds()).padStart(3, "0")}`}
                  secondary={`${(backup.size / 1024 / 1024).toFixed(2)} МБ`}
                />
                <Button onClick={() => restoreBackup(backup)} disabled={busy}>
                  Восстановить
                </Button>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialogOpen(false)} disabled={busy}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
