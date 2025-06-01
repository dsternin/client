"use client";

import { Button, TextField } from "@mui/material";
import { useState } from "react";
import { useRouter } from "next/navigation";
import FormWrapper from "../FormWrapper/FormWrapper";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleEmailChange = (e) => {
    setError("");
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setError("");
    setPassword(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ email, password });
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
