import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlockVault — Blockchain Document Verification",
  description: "Verify document integrity using an immutable blockchain ledger",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              boxShadow: "var(--shadow-modal)",
            },
            success: {
              iconTheme: {
                primary: "var(--color-success)",
                secondary: "var(--color-bg-elevated)",
              },
            },
            error: {
              iconTheme: {
                primary: "var(--color-danger)",
                secondary: "var(--color-bg-elevated)",
              },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}