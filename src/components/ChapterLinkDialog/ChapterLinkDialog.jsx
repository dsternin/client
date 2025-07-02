"use client";

import useToc from "@/hooks/useToc";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {  useState } from "react";

export default function ChapterLinkDialog({ open, onClose, onInsert }) {
  const toc = useToc();
  const [selectedBook, setSelectedBook] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const handleInsert = () => {
    if (selectedBook && selectedChapter) {
      const url = `/reader?book=${selectedBook}&section=${selectedChapter}`;
      onInsert(url);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Добавить ссылку на главу книги</DialogTitle>
      <DialogContent
        sx={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <FormControl fullWidth>
          <InputLabel>Книга</InputLabel>
          <Select
            value={selectedBook}
            label="Книга"
            onChange={(e) => {
              setSelectedBook(e.target.value);
              setSelectedChapter(""); // Сброс главы при смене книги
            }}
          >
            {toc.map((book) => (
              <MenuItem key={book.name} value={book.name}>
                {book.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedBook && (
          <FormControl fullWidth>
            <InputLabel>Глава</InputLabel>
            <Select
              value={selectedChapter}
              label="Глава"
              onChange={(e) => setSelectedChapter(e.target.value)}
            >
              {toc
                .find((b) => b.name === selectedBook)
                ?.chapters.map((ch) => (
                  <MenuItem key={ch.section} value={ch.title}>
                    {ch.title}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          onClick={handleInsert}
          disabled={!selectedBook || !selectedChapter}
        >
          Вставить ссылку
        </Button>
      </DialogActions>
    </Dialog>
  );
}
