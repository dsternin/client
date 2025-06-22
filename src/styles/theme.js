// theme.js
import { createTheme } from "@mui/material/styles";

let theme = createTheme({
  palette: {
    primary: {
      main: "#f5c518",
      contrastText: "#000000",
      dark: "#e6b800",
    },
    success: {
      main: "#4caf50",
      contrastText: "#ffffff",
      dark: "#388e3c",
    },
    typography: {
      fontSize: 26,
      body1: {
        fontSize: "1.5rem",
      },
      button: {
        textTransform: "none",
        fontSize: "2.25rem",
      },
    },
  },
});

theme = createTheme(theme, {
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const color = ownerState.color || "primary";
          const isContained = ownerState.variant === "contained";

          if (isContained && theme.palette[color]) {
            return {
              backgroundColor: theme.palette[color].main,
              color: theme.palette[color].contrastText,
              transition: "background-color 0.2s ease-in-out",
              "&:hover": {
                backgroundColor: theme.palette[color].dark,
              },
            };
          }

          return {};
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          color: "#000",
          borderRadius: 8,
          boxShadow: "none",
          marginBottom: theme.spacing(1),
          "&::before": {
            display: "none",
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          borderRadius: 8,
          minHeight: "48px",
          "& .MuiAccordionSummary-content": {
            margin: theme.spacing(1, 0),
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          padding: theme.spacing(2),
        },
      },
    },
    typography: {
      fontSize: 26,
      body1: {
        fontSize: "1.5rem",
      },
      body2: {
        fontSize: "24px", // додаємо body2
      },
      button: {
        textTransform: "none",
        fontSize: "2.25rem",
      },
    },
  },
});

export default theme;
