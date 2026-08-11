"use client";

import { useState } from "react";
import {
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Drawer,
  Box,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useToc from "@/hooks/useToc";
import { THESAURUS_BOOK_NAME } from "@/lib/thesaurus";

export default function BooksToc() {
  const { toc, trigger } = useToc();
  const safeToc = Array.isArray(toc) ? toc : [];
  const [open, setOpen] = useState(false);
  const [expandedBook, setExpandedBook] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState(false);
  const router = useRouter();

  const handleBookToggle = (bookName) => {
    setExpandedBook((prev) => (prev === bookName ? false : bookName));
  };

  const handleChapterToggle = (chapterId) => {
    setExpandedChapter((prev) => (prev === chapterId ? false : chapterId));
  };

  const handleChapterClick = (bookName, section) => {
    router.push(
      `/reader?book=${encodeURIComponent(
        bookName
      )}&section=${encodeURIComponent(section)}`,
      { scroll: false }
    );
    setOpen(false);
  };

  const topBookSx = {
    backgroundColor: "#5f8f5a",
    color: "#fff",
    borderRadius: 1,
    px: 2,
    py: 1.5,
    "&:hover": {
      backgroundColor: "#4f7d4c",
    },
  };

  return (
    <>
      {!open && (
        <Button
          variant="contained"
          onClick={() => {
            setOpen(true);
            trigger();
          }}
          sx={{
            marginLeft: 2,
            textTransform: "none",
            fontSize: "16px",
          }}
        >
          📚 Содержание
        </Button>
      )}

      <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 300, padding: 2 }}>
          <Typography variant="h5" gutterBottom>
            📚 Содержание
          </Typography>

          {safeToc.map((book) => {
            if (book.name === THESAURUS_BOOK_NAME) {
              return (
                <Button
                  key={book.name}
                  variant="text"
                  fullWidth
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    mb: 1,
                    ...topBookSx,
                  }}
                  onClick={() => {
                    router.push(`/reader?book=${encodeURIComponent(book.name)}`);
                    setOpen(false);
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ textAlign: "left", fontWeight: 500, color: "inherit" }}
                  >
                    {book.label}
                  </Typography>
                </Button>
              );
            }

            return (
              <Accordion
                key={book.name}
                expanded={expandedBook === book.name}
                onChange={() => handleBookToggle(book.name)}
                sx={{ mb: 1, borderRadius: 1, overflow: "hidden" }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: "inherit" }} />}
                  sx={topBookSx}
                >
                  <Typography variant="h6" sx={{ color: "inherit" }}>
                    {book.label}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    {book.chapters.map((ch) => {
                      const chapterId = `${book.name}-${ch.section}`;
                      return (
                        <Accordion
                          key={chapterId}
                          expanded={expandedChapter === chapterId}
                          onChange={() => handleChapterToggle(chapterId)}
                          sx={{ boxShadow: "none" }}
                        >
                          <AccordionSummary
                            expandIcon={
                              ch.points?.length > 0 ? <ExpandMoreIcon /> : null
                            }
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Typography
                                fontWeight={500}
                                sx={{ cursor: "pointer", flexGrow: 1 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChapterClick(book.name, ch.title);
                                }}
                              >
                                {ch.title}
                              </Typography>
                            </Box>
                          </AccordionSummary>
                          {ch.points?.length > 0 && (
                            <AccordionDetails sx={{ pl: 1 }}>
                              <List dense>
                                {ch.points.map((pt, ptIndex) => (
                                  <ListItem
                                    key={`${book.name}-${ch.title}-${pt.id}-${ptIndex}`}
                                    disablePadding
                                  >
                                    <ListItemButton
                                      component={Link}
                                      href={{
                                        pathname: "/reader",
                                        query: {
                                          book: book.name,
                                          section: ch.title,
                                          point: pt.id,
                                        },
                                      }}
                                      scroll={false}
                                      onClick={() => setOpen(false)}
                                      sx={{ color: "#444" }}
                                    >
                                      <ListItemText
                                        primary={pt.title}
                                        primaryTypographyProps={{
                                          fontSize: "14px",
                                        }}
                                      />
                                    </ListItemButton>
                                  </ListItem>
                                ))}
                              </List>
                            </AccordionDetails>
                          )}
                        </Accordion>
                      );
                    })}
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      </Drawer>
    </>
  );
}
