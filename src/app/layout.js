import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";

import ClientProviders from "@/components/ClientProviders";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const siteUrl = getConfiguredSiteUrl();

export const metadata = {
  metadataBase: siteUrl || undefined,
  title: {
    default: "Трикнижье",
    template: "%s | Трикнижье",
  },
  applicationName: "Трикнижье",
  description:
    "Электронная библиотека по теме религиозной наукофилософии «Трикнижье»: книги, главы и удобный поиск по текстам.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Трикнижье",
    title: "Трикнижье",
    description:
      "Электронная библиотека по теме религиозной наукофилософии «Трикнижье»: книги, главы и удобный поиск по текстам.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Трикнижье",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Трикнижье",
    description:
      "Электронная библиотека по теме религиозной наукофилософии «Трикнижье»: книги, главы и удобный поиск по текстам.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className="layout">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
