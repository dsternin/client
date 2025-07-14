"use client";
import { useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

const BookContext = createContext({});

export function BookContextProvider({ children }) {
  const [edit, setEdit] = useState(false);
  const searchParams = useSearchParams();
  const [book, setBook] = useState("");
  const [bookLabel, setBookLabel] = useState("");

  const [section, setSection] = useState("");
  const [point, setPoint] = useState("");

  useEffect(() => {
    setBook(searchParams.get("book"));
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
        edit,
        setBook,
        setSection,
        setPoint,
        setBookLabel,
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
