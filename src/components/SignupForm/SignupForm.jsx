"use client";
import { TextField, Button, Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ErrorText from "../ErrorText";
import FormWrapper from "../FormWrapper/FormWrapper";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleNameChange = (e) => {
    setError("");
    setName(e.target.value);
  };

  const handleEmailChange = (e) => {
    setError("");
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setError("");
    setPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e) => {
    setError("");
    setConfirmPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (name.length < 3) {
      setError("Имя слишком короткое");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }

      // Успішна реєстрація
      router.push("/login");
    } catch (err) {
      setError("Сетевая ошибка");
    }
  };

  return (
    <FormWrapper title={"Регистрация"}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Имя"
          name="name"
          fullWidth
          margin="normal"
          required
          onChange={handleNameChange}
          value={name}
        />
        <TextField
          label="Электронная почта"
          name="email"
          type="email"
          fullWidth
          margin="normal"
          required
          value={email}
          onChange={handleEmailChange}
        />
        <TextField
          label="Пароль"
          name="password"
          type="password"
          fullWidth
          margin="normal"
          required
          onChange={handlePasswordChange}
          value={password}
        />
        <TextField
          label="Подтвердите пароль"
          name="confirmPassword"
          type="password"
          fullWidth
          margin="normal"
          required
          onChange={handleConfirmPasswordChange}
          value={confirmPassword}
        />
        <ErrorText variant="body1">{error}</ErrorText>
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
          Зарегистрироваться
        </Button>
      </form>
      <Button
        variant="contained"
        onClick={() => router.push("/login")}
        fullWidth
        sx={{ mt: 1 }}
      >
        Уже есть аккаунт? Войти
      </Button>
    </FormWrapper>
  );
}
