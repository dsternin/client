"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Box,
  TextField,
  CircularProgress,
  IconButton,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import MenuBookIcon from "@mui/icons-material/MenuBook";

export function groupTermsAlphabetically(termsList = []) {
  const sorted = [...termsList].sort((a, b) => {
    const titleA = typeof a === "string" ? a : a.title || a.id || "";
    const titleB = typeof b === "string" ? b : b.title || b.id || "";
    return titleA.localeCompare(titleB, "uk", { sensitivity: "base" });
  });

  const groups = {};

  for (const item of sorted) {
    const title = typeof item === "string" ? item : item.title || item.id || "";
    if (!title.trim()) continue;

    const firstChar = title.trim()[0].toLocaleUpperCase("uk");
    if (!groups[firstChar]) {
      groups[firstChar] = [];
    }
    groups[firstChar].push(item);
  }

  return Object.keys(groups)
    .sort((a, b) => a.localeCompare(b, "uk", { sensitivity: "base" }))
    .map((letter) => ({
      letter,
      terms: groups[letter],
    }));
}

export default function ThesaurusToc({
  buttonText = "📖 Тезаурус",
  buttonVariant = "contained",
  sx = {},
  open: controlledOpen,
  onClose,
  onSelect,
  title = "Термины Тезауруса",
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");
  const open = controlledOpen ?? internalOpen;

  const topStickyRef = useRef(null);
  const dialogContentRef = useRef(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);

  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/thesaurus/terms?updatedAt=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Не удалось загрузить термины");
      const data = await res.json();
      setTerms(Array.isArray(data.terms) ? data.terms : []);
    } catch (err) {
      console.error(err);
      setError("Ошибка при загрузке терминов тезауруса");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setInternalOpen(true);
    setFilterQuery("");
    fetchTerms();
  };

  const handleClose = () => {
    if (onClose) onClose();
    else setInternalOpen(false);
  };

  useEffect(() => {
    if (controlledOpen) {
      setFilterQuery("");
      fetchTerms();
    }
  }, [controlledOpen]);

  const filteredTerms = useMemo(() => {
    if (!filterQuery.trim()) return terms;
    const q = filterQuery.trim().toLocaleLowerCase("uk");
    return terms.filter((item) => {
      const title = typeof item === "string" ? item : item.title || item.id || "";
      return title.toLocaleLowerCase("uk").includes(q);
    });
  }, [terms, filterQuery]);

  const groupedTerms = useMemo(() => {
    return groupTermsAlphabetically(filteredTerms);
  }, [filteredTerms]);

  useEffect(() => {
    if (!topStickyRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStickyHeaderHeight(entry.target.offsetHeight);
      }
    });
    observer.observe(topStickyRef.current);
    return () => observer.disconnect();
  }, [terms, loading, filterQuery, groupedTerms]);

  const handleTermClick = (item) => {
    const termTitle = typeof item === "string" ? item : item.title || item.id || "";
    if (onSelect) {
      onSelect(item);
      return;
    }
    const href = typeof item === "string"
      ? `/reader?book=thesaurus&term=${encodeURIComponent(termTitle)}`
      : item.href || `/reader?book=thesaurus&term=${encodeURIComponent(termTitle)}`;
    handleClose();
    window.location.assign(href);
  };

  const scrollToLetter = (letter) => {
    const el = document.getElementById(`thesaurus-letter-${letter}`);
    const container = dialogContentRef.current;
    if (el && container) {
      const headerOffset = topStickyRef.current
        ? topStickyRef.current.offsetHeight - 16
        : 0;
      const targetScroll = el.offsetTop - headerOffset;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    }
  };

  return (
    <>
      {buttonText ? (
        <Button
          variant={buttonVariant}
          onClick={handleOpen}
          sx={{
            marginLeft: { xs: 1, sm: 2 },
            textTransform: "none",
            fontSize: "16px",
            backgroundColor: "#2e7d32",
            color: "#fff",
            "&:hover": {
              backgroundColor: "#1b5e20",
            },
            ...sx,
          }}
        >
          {buttonText}
        </Button>
      ) : null}

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        aria-labelledby="thesaurus-dialog-title"
      >
        <DialogTitle
          id="thesaurus-dialog-title"
          sx={{
            m: 0,
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f5f5f5",
            borderBottom: "1px solid #e0e0e0",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <MenuBookIcon sx={{ color: "#2e7d32" }} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{ color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers ref={dialogContentRef} sx={{ p: 2, position: "relative" }}>
          {/* Sticky top container: Search field + Alphabet bar */}
          <Box
            ref={topStickyRef}
            sx={{
              position: "sticky",
              top: -16,
              zIndex: 10,
              backgroundColor: "#fff",
              pt: 2,
              mt: -2,
              pb: 1.5,
              mb: 1.5,
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск по терминам..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
                  ),
                },
              }}
              sx={{ mb: groupedTerms.length > 0 ? 1.5 : 0 }}
            />

            {groupedTerms.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.5,
                }}
              >
                {groupedTerms.map((group) => (
                  <Chip
                    key={group.letter}
                    label={group.letter}
                    size="small"
                    clickable
                    onClick={() => scrollToLetter(group.letter)}
                    color="success"
                    variant="outlined"
                    sx={{
                      fontWeight: 900,
                      fontSize: "19px",
                      height: "38px",
                      minWidth: "38px",
                      borderRadius: "50%",
                      border: "2px solid #2e7d32",
                      backgroundColor: "#e8f5e9",
                      color: "#1b5e20",
                      boxShadow: "0 0 0 1px rgba(46, 125, 50, 0.12)",
                      px: 0.5,
                      ".MuiChip-label": {
                        fontWeight: 900,
                        fontSize: "19px",
                        px: 0,
                      },
                      "&:hover": {
                        backgroundColor: "#d7efd8",
                        borderColor: "#1b5e20",
                      },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress color="success" />
            </Box>
          ) : error ? (
            <Typography color="error" textAlign="center" sx={{ py: 3 }}>
              {error}
            </Typography>
          ) : !terms.length ? (
            <Typography textAlign="center" color="text.secondary" sx={{ py: 3 }}>
              В Тезаурусе пока нет терминов.
            </Typography>
          ) : !groupedTerms.length ? (
            <Typography textAlign="center" color="text.secondary" sx={{ py: 3 }}>
              Термины по запросу "{filterQuery}" не найдены.
            </Typography>
          ) : (
            <Box>
              {groupedTerms.map((group) => (
                <Box
                  key={group.letter}
                  id={`thesaurus-letter-${group.letter}`}
                  sx={{ mb: 2 }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: "#2e7d32",
                      borderBottom: "2px solid #2e7d32",
                      pb: 0.5,
                      mb: 1,
                      fontSize: "1.5rem",
                      position: "sticky",
                      top: stickyHeaderHeight ? `${stickyHeaderHeight - 16}px` : 0,
                      backgroundColor: "#fff",
                      zIndex: 5,
                    }}
                  >
                    {group.letter}
                  </Typography>

                  <List dense disablePadding>
                    {group.terms.map((item) => {
                      const title =
                        typeof item === "string" ? item : item.title || item.id || "";
                      return (
                        <ListItemButton
                          key={title}
                          onClick={() => handleTermClick(item)}
                          sx={{
                            py: 0.75,
                            px: 1.5,
                            borderRadius: 1,
                            "&:hover": {
                              backgroundColor: "#e8f5e9",
                              color: "#1b5e20",
                            },
                          }}
                        >
                          <ListItemText
                            primary={title}
                            primaryTypographyProps={{
                              fontSize: "19px",
                              fontWeight: 500,
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, backgroundColor: "#f9f9f9" }}>
          <Button onClick={handleClose} variant="outlined" color="inherit">
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
