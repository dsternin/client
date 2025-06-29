"use client";
import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import theme from "@/styles/theme";
import { ThemeProvider } from "@mui/material";
import { AuthProvider } from "@/store/AuthContext";
import AdminPanel from "@/components/AdminPanel";
import BooksToc from "@/components/BooksToc";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="layout">
        <AuthProvider>
          <ThemeProvider theme={theme}>
            {/* <CssBaseline /> */}
            <Header />
            <AdminPanel />
            <BooksToc />
            <main className="content">{children}</main>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
