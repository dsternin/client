"use client";

import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import theme from "@/styles/theme";

import { ThemeProvider } from "@mui/material";
import { AuthProvider } from "@/store/AuthContext";
import { BookContextProvider } from "@/store/BookContext";
import BookInfoPanel from "@/components/BookInfoPanel";

import { Suspense, useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function GATrackPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ID) return;
    if (typeof window === "undefined") return;
    if (typeof window.gtag !== "function") return;

    const url = pathname + (window.location.search || "");

    window.gtag("config", GA_ID, { page_path: url });
  }, [pathname]);

  return null;
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { anonymize_ip: true });
              `}
            </Script>
          </>
        ) : null}
      </head>

      <body className="layout">
        <GATrackPageView />

        <AuthProvider>
          <Suspense fallback={null}>
            <BookContextProvider>
              <ThemeProvider theme={theme}>
                <div className="stickyHeaderWrapper">
                  <Header />
                  <BookInfoPanel />
                </div>

                <main className="content">{children}</main>
                <Footer />
              </ThemeProvider>
            </BookContextProvider>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
і;
