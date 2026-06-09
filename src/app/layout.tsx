import type { Metadata } from "next";
import { Onest } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// SN Pro — Stoyan Nikolaev, humanist sans with Cyrillic support.
// Used as the *display* face (headings, watermarks, ribbon marks, prices).
// Self-hosted variable fonts live in `./fonts/sn-pro/`. The two variable
// files cover the full 200–900 weight range, so we only ship ~670 KB total
// instead of one file per weight.
const snPro = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    {
      path: "./fonts/sn-pro/SNPro-Variable.ttf",
      style: "normal",
      weight: "200 900",
    },
    {
      path: "./fonts/sn-pro/SNPro-Variable-Italic.ttf",
      style: "italic",
      weight: "200 900",
    },
  ],
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// Onest — modern grotesque, Cyrillic-native, used for body / UI text.
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BATCH Coffee Roastery",
    template: "%s — BATCH Coffee",
  },
  description:
    "Свіжообсмажена спешиалті кава з Полтави. Підписка, доставка по всій Україні.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "BATCH Coffee Roastery",
    description:
      "Свіжообсмажена спешиалті кава з Полтави. Підписка, доставка по всій Україні.",
    url: SITE_URL,
    siteName: "BATCH Coffee",
    locale: "uk_UA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${snPro.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
