"use client";

import Link from "next/link";
import styles from "./Header.module.css";
import { Typography } from "@mui/material";
import { Link as MuiLink } from "@mui/material";
import LinkButton from "../LinkButton";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/AuthContext";

export default function Header() {
  const { user, reset } = useAuth();
  const router = useRouter();

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
                Приветствуем, {user.name}
              </h2>
              <LinkButton
                onClick={() => {
                  fetch("/api/logout").then(() => {
                    reset();
                    router.push("/");
                  });
                }}
                style={{ backgroundColor: "transparent" }}
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
