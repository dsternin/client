import { Box, Typography } from "@mui/material";

export default function FormWrapper({ children, title }) {
  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
