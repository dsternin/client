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
  },
});

export default theme;
