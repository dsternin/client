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
                  {book.chapters.map((ch) => (
                    <Link
                      key={ch.section}
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
                        color: "#000",
                        display: "block",
                      }}
                    >
                      <ListItem onClick={() => setOpen(false)}>
                        <ListItemText
                          primary={ch.title}
                          primaryTypographyProps={{
                            fontSize: "16px",
                          }}
                        />
                      </ListItem>
                    </Link>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>
    </>
  );
}
