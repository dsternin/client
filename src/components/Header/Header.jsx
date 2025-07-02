"use client";

import Link from "next/link";
import styles from "./Header.module.css";
import { Typography } from "@mui/material";
import { Link as MuiLink } from "@mui/material";
import LinkButton from "../LinkButton";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/AuthContext";
import BooksToc from "../BooksToc";

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
          <Typography variant="h3" component="span" className={styles.title}>
            Трикнижье
          </Typography>
        </MuiLink>
        <BooksToc />
        <div style={{ marginLeft: "auto" }}>
          {user ? (
            <>
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
                {`Вы вошли как ${user.name} | Выйти`}
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
