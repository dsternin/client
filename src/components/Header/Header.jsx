"use client";

import Link from "next/link";
import styles from "./Header.module.css";
import { Typography } from "@mui/material";
import { Link as MuiLink } from "@mui/material";

export default function Header() {
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
          <Link href="/login" className={styles.loginLink}>
            Войти
          </Link>
        </div>
      </div>
    </header>
  );
}
