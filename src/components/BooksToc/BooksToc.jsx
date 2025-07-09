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
import useToc from "@/hooks/useToc";

export default function BooksToc() {
  const toc = useToc();
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <Button
          variant="contained"
          onClick={() => setOpen(true)}
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
            <Accordion key={book.name}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{book.label}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {book.chapters.map((ch) =>
                    ch.points?.length > 0 ? (
                      <Accordion key={ch.section} sx={{ boxShadow: "none" }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography fontWeight={500}>{ch.title}</Typography>
                        </AccordionSummary>
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
                      </Accordion>
                    ) : (
                      <Accordion
                        key={ch.section}
                        sx={{ boxShadow: "none" }}
                        expanded={false}
                        onChange={() => {}}
                      >
                        <Link
                          href={{
                            pathname: "/reader",
                            query: {
                              book: book.name,
                              section: ch.title,
                            },
                          }}
                          passHref
                          style={{
                            textDecoration: "none",
                            color: "inherit",
                            width: "100%",
                          }}
                        >
                          <AccordionSummary>
                            <Typography fontWeight={500}>{ch.title}</Typography>
                          </AccordionSummary>
                        </Link>
                      </Accordion>
                    )
                  )}{" "}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>
    </>
  );
}
