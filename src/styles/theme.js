// theme.js
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#f5c518",
      contrastText: "#000000",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: "#f5c518",
          color: "#000000",
          "&:hover": {
            backgroundColor: "#e6b800",
          },
        },
      },
    },
  },
});

export default theme;
