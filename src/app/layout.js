"use client";
import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import theme from "@/styles/theme";
import { ThemeProvider } from "@mui/material";
import { AuthProvider } from "@/store/AuthContext";
import AdminPanel from "@/components/AdminPanel";
import { BookContextProvider } from "@/store/BookContext";
import BookInfoPanel from "@/components/BookInfoPanel";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="layout">
        <AuthProvider>
          <BookContextProvider>
            <ThemeProvider theme={theme}>
              {/* <CssBaseline /> */}
              <div className="stickyHeaderWrapper">
                <Header />
                <BookInfoPanel />
              </div>
              {/* <AdminPanel /> */}
              <main className="content">{children}</main>
              <Footer />
            </ThemeProvider>
          </BookContextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
