import type { ReactNode } from "react";

export interface ScaffoldPanelProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function ScaffoldPanel({ children, eyebrow, title }: ScaffoldPanelProps) {
  return (
    <main className="scaffold-panel">
      <p className="scaffold-panel__eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="scaffold-panel__body">{children}</div>
    </main>
  );
}
