import { Typography } from "@mui/material";

export default function ErrorText({ children }) {
  if (!children) return null;

  return (
    <Typography variant="body2" sx={{ color: "error.main", mt: 0.5 }}>
      {children}
    </Typography>
  );
}
