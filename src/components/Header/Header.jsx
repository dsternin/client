'use client';

import Link from 'next/link';
import styles from './Header.module.css';
import { Typography } from '@mui/material';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logoLink}>
          <Typography variant="h6" component="span" className={styles.title}>
            Трикнижье
          </Typography>
        </Link>
      </div>
    </header>
  );
}
