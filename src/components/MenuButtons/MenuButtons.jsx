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
    const item = items[key];
    const action = typeof item === "function" ? item : item?.action;
    const disabled = typeof item === "function" ? false : Boolean(item?.disabled);

    if (disabled) {
      handleClose();
      return;
    }

    action?.();
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
        {Object.entries(items).map(([key, value]) => {
          const disabled =
            typeof value === "function" ? false : Boolean(value?.disabled);

          return (
            <MenuItem
              key={key}
              disabled={disabled}
              onClick={() => handleSelect(key)}
            >
              {renderOption(key)}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
