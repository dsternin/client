import { Button } from "@mui/material";

export default function RedButton({ clickHandler, fullWidth, label, active }) {
  return (
    <Button
      variant={"outlined"}
      sx={{
        color: "#b81414",
        fontWeight: 600,
        borderColor: "#b81414",
        backgroundColor: active ? "#ccbe00" : "",
      }}
      fullWidth={fullWidth}
      onClick={clickHandler}
    >
      {label}
    </Button>
  );
}
