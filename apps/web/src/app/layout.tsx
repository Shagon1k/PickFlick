import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@pickflick/ui/tokens.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "PickFlick",
  description: "Pick a film together.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
