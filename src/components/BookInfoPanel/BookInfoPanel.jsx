"use client";

import styles from "./BookInfoPanel.module.css";
import { Typography, Button, Box } from "@mui/material";
import { useAuth } from "@/store/AuthContext";
import { useBookContext } from "@/store/BookContext";
import { THESAURUS_BOOK_NAME } from "@/lib/thesaurus";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const isThesaurus = book === THESAURUS_BOOK_NAME;

  const editButtonIsVisible = mounted && loaded && user?.role === "admin" && !edit;

  const handleEdit = () => {
    setEdit(true);
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
        <Box>
          <Button variant="contained" onClick={handleEdit}>
            Редактировать
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
