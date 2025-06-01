"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ email, password });
  };

  return (
    <main style={{ maxWidth: 400, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Вход</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <input
          type="email"
          placeholder="Ел. почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          style={{ padding: "0.5rem 1rem", fontWeight: 600 }}
        >
          Войти
        </button>
      </form>
    </main>
  );
}
