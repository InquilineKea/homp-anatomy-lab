import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://homp-anatomy-lab.stochasticcockatoo.chatgpt.site"),
  title: "HOMP Anatomy Lab",
  description: "A clickable, color-coded anatomy of higher-order message passing, cross-rank attention, transports, flux, and multiscale dynamics.",
  openGraph: { title: "HOMP Anatomy Lab", description: "See what every operator does.", type: "website", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "HOMP Anatomy Lab", description: "See what every operator does.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
