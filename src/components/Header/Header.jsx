"use client";

import Link from "next/link";
import styles from "./Header.module.css";
import { Typography } from "@mui/material";
import { Link as MuiLink } from "@mui/material";
import { useAuth } from "@/hooks/useAuth";
import LinkButton from "../LinkButton";

export default function Header() {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <MuiLink
          component={Link}
          href="/"
          underline="none"
          className={styles.logoLink}
        >
          <Typography variant="h6" component="span" className={styles.title}>
            Трикнижье
          </Typography>
        </MuiLink>

        <div style={{ marginLeft: "auto" }}>
          {user ? (
            <>
              <h2
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  margin: 0,
                }}
              >
                Приветсвуем, {user.name}
              </h2>
              <LinkButton
                style={{ backgroundColor: "transparent" }}
                href="/logout"
                className={styles.loginLink}
              >
                Выйти
              </LinkButton>
            </>
          ) : (
            <Link href="/login" className={styles.loginLink}>
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
