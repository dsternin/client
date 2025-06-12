import { Button } from "@mui/material";

export default function LinkButton({ children, ...props }) {
  return (
    <Button
      variant="text"
      {...props}
      sx={{
        backgroundColor: "transparent",
        color: "#000",
        textTransform: "none",
        "&:hover": {
          backgroundColor: "transparent",
        },
        fontFamily: "Cormorant Garamond, serif",
        fontSize: "2.25rem",
      }}
    >
      {children}
    </Button>
  );
}
