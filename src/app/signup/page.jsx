"use client";
import { TextField, Button, Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const router = useRouter();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Регистрация с данными:", formData);
  };

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>
      <Typography variant="h5" gutterBottom>
        Регистрация
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Имя"
          name="name"
          fullWidth
          margin="normal"
          required
          onChange={handleChange}
        />
        <TextField
          label="Электронная почта"
          name="email"
          type="email"
          fullWidth
          margin="normal"
          required
          onChange={handleChange}
        />
        <TextField
          label="Пароль"
          name="password"
          type="password"
          fullWidth
          margin="normal"
          required
          onChange={handleChange}
        />
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
          Зарегистрироваться
        </Button>
      </form>
      <Button
        variant="text"
        onClick={() => router.push("/login")}
        fullWidth
        sx={{ mt: 1 }}
      >
        Уже есть аккаунт? Войти
      </Button>
    </Box>
  );
}
