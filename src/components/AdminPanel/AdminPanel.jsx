"use client";

import { useAuth } from "@/store/AuthContext";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

export default function AdminPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить статистику");
      setStats(data);
    } catch (loadError) {
      setError(loadError.message || "Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") loadStats();
  }, [user?.role, loadStats]);

  if (!user || user.role !== "admin") return null;

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto", px: 2, py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Статистика
      </Typography>

      <Button
        onClick={loadStats}
        variant="contained"
        disabled={loading}
        sx={{
          mb: 4,
          backgroundColor: "#5f8f5a",
          color: "#fff",
          textTransform: "none",
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "#4f7d4c",
            boxShadow: "none",
          },
        }}
      >
        Обновить статистику
      </Button>

      <Typography variant="h6" gutterBottom>
        Посетители
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {stats?.analyticsStatus === "not_configured" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Подключите GA4 Data API, чтобы видеть статистику посещений.
        </Alert>
      )}
      {stats?.analyticsStatus === "unavailable" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          GA4 не вернул данные. Проверьте доступ сервисного аккаунта к ресурсу.
        </Alert>
      )}
      {loading && !stats ? (
        <CircularProgress size={28} />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 2,
            mb: 4,
          }}
        >
          {[
            {
              label: "Активные за 5 минут",
              value: stats?.analytics?.activeUsersLast5Minutes ?? "—",
              caption: "GA4 Realtime",
            },
            {
              label: "Сегодня",
              value: stats?.analytics?.today
                ? `${stats.analytics.today.visits} / ${stats.analytics.today.unique}`
                : "—",
              caption: "Сеансы / уникальные пользователи",
            },
            {
              label: "Последние 7 дней",
              value: stats?.analytics?.week
                ? `${stats.analytics.week.visits} / ${stats.analytics.week.unique}`
                : "—",
              caption: "Сеансы / уникальные пользователи",
            },
            {
              label: "Последние 30 дней",
              value: stats?.analytics?.month
                ? `${stats.analytics.month.visits} / ${stats.analytics.month.unique}`
                : "—",
              caption: "Сеансы / уникальные пользователи",
            },
            {
              label: "Последние 365 дней",
              value: stats?.analytics?.year
                ? `${stats.analytics.year.visits} / ${stats.analytics.year.unique}`
                : "—",
              caption: "Сеансы / уникальные пользователи",
            },
            {
              label: "Зарегистрировано аккаунтов",
              value: stats?.registeredUsersCount,
            },
          ].map(({ label, value, caption }) => (
            <Paper key={label} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography
                variant={caption ? "h5" : "h4"}
                sx={{ mt: 1, ...(caption ? { whiteSpace: "nowrap" } : {}) }}
              >
                {value}
              </Typography>
              {caption && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.72rem" }}
                >
                  {caption === "GA4 Realtime"
                    ? caption
                    : <>Сеансы / уникальные{"\u00a0"}пользователи</>}
                </Typography>
              )}
            </Paper>
          ))}
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Активность и входы пользователей
      </Typography>
      <Paper variant="outlined" sx={{ overflowX: "auto", mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Последняя активность / вход</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats?.users?.length ? (
              stats.users.map((listedUser) => (
                <TableRow key={listedUser._id}>
                  <TableCell>{listedUser.name || "—"}</TableCell>
                  <TableCell>{listedUser.email}</TableCell>
                  <TableCell>
                    {listedUser.role === "admin" ? "Администратор" : "Пользователь"}
                  </TableCell>
                  <TableCell>
                    {(listedUser.role === "admin"
                      ? listedUser.lastActivityAt || listedUser.lastLoginAt
                      : listedUser.lastLoginAt)
                      ? new Intl.DateTimeFormat("ru-RU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(
                          new Date(
                            listedUser.role === "admin"
                              ? listedUser.lastActivityAt || listedUser.lastLoginAt
                              : listedUser.lastLoginAt,
                          ),
                        )
                      : "Нет данных до начала учета"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  {loading ? "Загрузка..." : "Зарегистрированных пользователей пока нет"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

    </Box>
  );
}
