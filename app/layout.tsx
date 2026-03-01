import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "effective-memory",
  description: "Reviews to social MVP scaffold"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
