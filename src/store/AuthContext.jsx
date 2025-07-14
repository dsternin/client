"use client";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const reset = () => setLoaded(false);

  useEffect(() => {
    if (loaded) return;

    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => {
        setUser(null);
        setLoaded(true);
      });
  }, [loaded]);

  return (
    <AuthContext.Provider value={{ user, reset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
