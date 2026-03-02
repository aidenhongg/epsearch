import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "EP Search",
  description: "RAG-powered search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
