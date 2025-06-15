"use client";

import { useState } from "react";
import { Button, Menu, MenuItem } from "@mui/material";
import { ArrowDropDownCircleOutlined } from "@mui/icons-material";

export default function MenuButton({
  label,
  items = {},
  buttonProps = {},
  renderOption = (key) => key,
}) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (key) => {
    items[key]?.();
    handleClose();
  };

  return (
    <>
      <Button
        variant="contained"
        endIcon={<ArrowDropDownCircleOutlined />}
        onClick={handleClick}
        {...buttonProps}
      >
        {label}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        {Object.entries(items).map(([key, _]) => (
          <MenuItem key={key} onClick={() => handleSelect(key)}>
            {renderOption(key)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
