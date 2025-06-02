"use client";

import { Button, TextField } from "@mui/material";
import { useState } from "react";
import { useRouter } from "next/navigation";
import FormWrapper from "../FormWrapper/FormWrapper";
import ErrorText from "../ErrorText";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }

      router.push("/"); // або інша захищена сторінка
    } catch (err) {
      setError("Сетевая ошибка");
    }
  };

  return (
    <FormWrapper title={"Вход"}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
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
        <ErrorText variant="body1">{error}</ErrorText>
        <Button variant="contained" type="submit" fullWidth sx={{ mt: 2 }}>
          Войти
        </Button>
        <Button
          variant="contained"
          onClick={() => router.push("/signup")}
          fullWidth
          sx={{ mt: 1 }}
        >
          Создать акаунт
        </Button>
      </form>
    </FormWrapper>
  );
}
