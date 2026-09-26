"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookInfoPanel from "@/components/BookInfoPanel";
import theme from "@/styles/theme";
import { AuthProvider } from "@/store/AuthContext";
import { BookContextProvider } from "@/store/BookContext";
import { ThemeProvider } from "@mui/material";
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

export default function ClientProviders({ children }) {
  return (
    <>
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
    </>
  );
}