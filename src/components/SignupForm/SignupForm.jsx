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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.length < 3) {
      setError("Имя слишком короткое");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    console.log("Регистрация с данными:", {
      name,
      email,
      password,
    });
    // TODO: отправка данных на API
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
        {error ? <ErrorText variant="body1">{error}</ErrorText> : null}
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
