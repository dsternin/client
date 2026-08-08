"use client";
import { useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { THESAURUS_BOOK_NAME } from "@/lib/thesaurus";

const BookContext = createContext({});

export function BookContextProvider({ children }) {
  const [edit, setEdit] = useState(false);
  const searchParams = useSearchParams();
  const [book, setBook] = useState("");
  const [bookLabel, setBookLabel] = useState("");
  const [editingTermLabel, setEditingTermLabel] = useState("");

  const [section, setSection] = useState("");
  const [point, setPoint] = useState("");

  useEffect(() => {
    const currentBook = searchParams.get("book");
    setBook(currentBook);

    if (currentBook === THESAURUS_BOOK_NAME) {
      setSection("");
      setPoint("");
      return;
    }

    setSection(searchParams.get("section"));
    setPoint(searchParams.get("point"));
  }, [searchParams]);
  return (
    <BookContext.Provider
      value={{
        book,
        section,
        point,
        bookLabel,
        editingTermLabel,
        edit,
        setBook,
        setSection,
        setPoint,
        setBookLabel,
        setEditingTermLabel,
        setEdit,
      }}
    >
      {children}
    </BookContext.Provider>
  );
}

export function useBookContext() {
  return useContext(BookContext);
}
