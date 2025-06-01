"use client";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import theme from "@/styles/theme";
import { ThemeProvider } from "@mui/material";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="layout">
        <ThemeProvider theme={theme}>
          {/* <CssBaseline /> */}
          <Header />
          <main className="content">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
