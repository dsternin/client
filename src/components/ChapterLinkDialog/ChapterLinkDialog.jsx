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
import { useState } from "react";

export default function ChapterLinkDialog({ open, onClose, onInsert }) {
  const {toc} = useToc();
  const [selectedBook, setSelectedBook] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedPoint, setSelectedPoint] = useState("");

  const handleInsert = () => {
    if (selectedBook) {
      let url = `/reader?book=${selectedBook}`;
      if (selectedChapter) {
        url += `&section=${selectedChapter}`;
      }
      if (selectedPoint) {
        url += `&point=${selectedPoint}`;
      }
      onInsert(url);
      onClose();
    }
  };

  const currentBook = toc.find((b) => b.name === selectedBook);
  const currentChapter = currentBook?.chapters.find(
    (ch) => ch.title === selectedChapter
  );

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Добавить ссылку на раздел книги</DialogTitle>
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
              setSelectedChapter("");
              setSelectedPoint("");
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
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setSelectedPoint("");
              }}
            >
              {currentBook?.chapters.map((ch) => {
                return (
                  <MenuItem key={ch.section} value={ch.title}>
                    {ch.title}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}

        {selectedChapter && currentChapter?.points?.length > 0 && (
          <FormControl fullWidth>
            <InputLabel>Раздел</InputLabel>
            <Select
              value={selectedPoint}
              label="Раздел"
              onChange={(e) => setSelectedPoint(e.target.value)}
            >
              {currentChapter.points.map((pt) => {
                return (
                  <MenuItem key={pt.title} value={pt.title}>
                    {pt.title}
                  </MenuItem>
                );
              })}
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
