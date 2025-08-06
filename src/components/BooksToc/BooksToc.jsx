"use client";

import { useState } from "react";
import {
  Typography,
  List,
  ListItem,
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

export default function BooksToc() {
  const { toc, trigger } = useToc();
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
      )}&section=${encodeURIComponent(section)}`
    );
    setOpen(false);
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

          {toc.map((book) => (
            <Accordion
              key={book.name}
              expanded={expandedBook === book.name}
              onChange={() => handleBookToggle(book.name)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{book.label}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
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
                              {ch.points.map((pt) => (
                                <Link
                                  key={pt.title}
                                  href={{
                                    pathname: "/reader",
                                    query: {
                                      book: book.name,
                                      section: ch.title,
                                      point: pt.title,
                                    },
                                  }}
                                  passHref
                                  style={{
                                    textDecoration: "none",
                                    color: "#444",
                                    display: "block",
                                  }}
                                >
                                  <ListItem onClick={() => setOpen(false)}>
                                    <ListItemText
                                      primary={pt.title}
                                      primaryTypographyProps={{
                                        fontSize: "14px",
                                      }}
                                    />
                                  </ListItem>
                                </Link>
                              ))}
                            </List>
                          </AccordionDetails>
                        )}
                      </Accordion>
                    );
                  })}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>
    </>
  );
}
