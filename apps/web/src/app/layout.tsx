import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  ProjectorNoirColorSchemeScript,
  ProjectorNoirProvider,
  projectorNoirHtmlProps,
} from "@pickflick/ui";
import "@pickflick/ui/styles.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "PickFlick",
  description: "Pick a film together.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" {...projectorNoirHtmlProps}>
      <head>
        <ProjectorNoirColorSchemeScript />
      </head>
      <body>
        <ProjectorNoirProvider>{children}</ProjectorNoirProvider>
      </body>
    </html>
  );
}
