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

      setUser((currentUser) => {
        const nextUser = data.user;
        if (
          currentUser &&
          nextUser &&
          currentUser.userId === nextUser.userId &&
          currentUser.email === nextUser.email &&
          currentUser.name === nextUser.name &&
          currentUser.role === nextUser.role
        ) {
          return currentUser;
        }

        return nextUser;
      });
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

    let lastActivityRefresh = 0;
    const intervalId = window.setInterval(() => {
      refreshSession();
    }, SESSION_REFRESH_INTERVAL_MS);

    const handleActivity = () => {
      const now = Date.now();
      if (user.role !== "admin" || now - lastActivityRefresh < 60_000) return;

      lastActivityRefresh = now;
      refreshSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => {
      document.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        document.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loaded, user]);

  return (
    <AuthContext.Provider value={{ user, reset, loaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
