"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { SESSION_REFRESH_INTERVAL_MS } from "@/lib/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const reset = () => setLoaded(false);

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const data = res.ok ? await res.json() : { user: null };

      setUser(data.user);
      setLoaded(true);

      return data.user;
    } catch {
      setUser(null);
      setLoaded(true);
      return null;
    }
  };

  useEffect(() => {
    if (loaded) return;

    refreshSession();
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !user) return;

    const intervalId = window.setInterval(() => {
      refreshSession();
    }, SESSION_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loaded, user]);

  return (
    <AuthContext.Provider value={{ user, reset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
