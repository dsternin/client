"use client";

import { useEffect, useState } from "react";
import {
  Typography,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Link from "next/link";

export default function BooksToc() {
  const [toc, setToc] = useState([]);

  useEffect(() => {
    fetch("/api/content/toc")
      .then((res) => res.json())
      .then((data) => setToc(data));
  }, []);

  return (
    toc.length > 0 && (
      <Accordion sx={{ padding: "10px" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h5">📚 Содержание</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {toc.map((book) => (
            <Accordion key={book.name}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{book.label}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {book.chapters.map((ch) => {
                    return (
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
                          fontSize: "24px",
                        }}
                      >
                        <ListItem>
                          <ListItemText
                            primary={ch.title}
                            primaryTypographyProps={{
                              fontSize: "20px",
                              color: "#000",
                            }}
                          />
                        </ListItem>
                      </Link>
                    );
                  })}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </AccordionDetails>
      </Accordion>
    )
  );
}
