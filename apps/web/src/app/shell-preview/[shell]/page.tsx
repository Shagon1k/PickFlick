import { notFound } from "next/navigation";

import { ActionLink, Button, TextField } from "@pickflick/ui";

import {
  AdminShell,
  ControlShell,
  DenseRegion,
  ProductShell,
  PublicShell,
  SessionShell,
  SetupShell,
  ShellPlaceholder,
  type ShellRouteMap,
} from "../../../components/shells/shells";
import styles from "./page.module.css";

const shellNames = ["public", "setup", "product", "session", "settings", "library", "admin"] as const;
type ShellName = (typeof shellNames)[number];
const previewRoutes: ShellRouteMap = {
  admin: "/shell-preview/admin",
  contact: "/shell-preview/public",
  home: "/shell-preview",
  howItWorks: "/shell-preview/public#public-content",
  library: "/shell-preview/library",
  legalPrivacy: "/legal/privacy",
  legalTerms: "/legal/terms",
  pricing: "/shell-preview/public",
  privacy: "/shell-preview/settings?tab=privacy",
  product: "/shell-preview/product",
  session: "/shell-preview/session",
  settings: "/shell-preview/settings",
  setup: "/shell-preview/setup",
};

const previewClubItems = [
  { href: "/shell-preview/product#overview", label: "Overview", current: true },
  { href: "/shell-preview/product#sessions", label: "Sessions" },
  { href: "/shell-preview/product#ratings", label: "Ratings" },
  { href: "/shell-preview/product#members", label: "Members" },
  { href: "/shell-preview/product#achievements", label: "Achievements" },
  { href: "/shell-preview/product#manage", label: "Manage Club" },
] as const;

const previewAdminItems = [
  { href: "/shell-preview/admin#overview", label: "Overview", current: true },
  { href: "/shell-preview/admin#users", label: "Users" },
  { href: "/shell-preview/admin#clubs", label: "Clubs" },
  { href: "/shell-preview/admin#application", label: "Application settings" },
] as const;

function isShellName(value: string): value is ShellName {
  return shellNames.some((name) => name === value);
}

export function generateStaticParams() {
  return shellNames.map((shell) => ({ shell }));
}

export default async function ShellPreviewPage({
  params,
}: Readonly<{ params: Promise<{ shell: string }> }>) {
  const { shell } = await params;
  if (!isShellName(shell)) {notFound();}

  switch (shell) {
    case "public":
      return (
        <PublicShell routes={previewRoutes}>
          <section aria-labelledby="public-shell-title" className={styles.publicHero}>
            <p className={styles.eyebrow}>Public shell</p>
            <h1 id="public-shell-title">An editorial canvas for the public PickFlick story.</h1>
            <p>Marketing, pricing, contact, and legal content inherit the same responsive header, reading measure, action hierarchy, and footer.</p>
            <div className={styles.actions}>
              <ActionLink href="/shell-preview/setup" variant="primary">Get started</ActionLink>
              <ActionLink href="#public-content">See the structure</ActionLink>
            </div>
          </section>
          <div className={styles.publicSections} id="public-content">
            <ShellPlaceholder title="Editorial section"><p>Public feature content is supplied by Phase 3 inside this restrained section rhythm.</p></ShellPlaceholder>
            <ShellPlaceholder title="Decision section"><p>Pricing or contact content can change composition without redefining shared shell tokens.</p></ShellPlaceholder>
          </div>
        </PublicShell>
      );
    case "setup":
      return (
        <SetupShell description="Authentication, invitations, first-run setup, and focused forms share this compact composition." routes={previewRoutes} title="Begin with one clear task.">
          <TextField id="setup-placeholder" label="Named setup field" placeholder="Feature-owned value" />
          <Button>Continue</Button>
          <ActionLink href="/shell-preview/public" variant="ghost">Return to public shell</ActionLink>
        </SetupShell>
      );
    case "product":
      return (
        <ProductShell admin clubItems={previewClubItems} currentArea="hub" eyebrow="Authenticated product shell" routes={previewRoutes} title="Club context">
          <div className={styles.productGrid}>
            <ShellPlaceholder title="Primary Club region"><p>The current Club, Session, phase, progress, and next action render here.</p></ShellPlaceholder>
            <ShellPlaceholder title="Supporting region"><p>Authorized summaries keep their own loading, empty, error, and read-only states.</p></ShellPlaceholder>
          </div>
        </ProductShell>
      );
    case "session":
      return (
        <SessionShell clubItems={previewClubItems} routes={previewRoutes}>
          <div className={styles.sessionGrid}>
            <ShellPlaceholder title="Phase content"><p>Nomination, Selection, Watching, Rating, or Completed behavior replaces this slot without changing the outer Session shell.</p></ShellPlaceholder>
            <ShellPlaceholder title="Session details"><p id="session-details">Metrics and detail rows retain one geometry across every Session phase.</p></ShellPlaceholder>
          </div>
        </SessionShell>
      );
    case "settings":
      return (
        <ControlShell
          clubItems={previewClubItems}
          currentArea="settings"
          description="Personal controls keep a stable reading width and move section navigation into a mobile menu."
          items={[
            { href: "/shell-preview/settings", label: "Profile", current: true },
            { href: "/shell-preview/settings?tab=notifications", label: "Notifications" },
            { href: "/shell-preview/settings?tab=subscription", label: "Subscription" },
            { href: "/shell-preview/settings?tab=privacy", label: "Privacy" },
            { href: "/shell-preview/settings?tab=import-export", label: "Import & Export" },
          ]}
          routes={previewRoutes}
          title="Settings"
        >
          <ShellPlaceholder title="Settings panel"><p>Each settings section renders forms and stable feedback inside this content column.</p></ShellPlaceholder>
        </ControlShell>
      );
    case "library":
      return (
        <ControlShell
          clubItems={previewClubItems}
          currentArea="library"
          description="Personal film memory uses the product chrome, local views, and bounded dense regions."
          items={[
            { href: "/shell-preview/library?tab=my-ratings", label: "My Ratings", current: true },
            { href: "/shell-preview/library?tab=watchlist", label: "Watchlist" },
            { href: "/shell-preview/library?tab=achievements", label: "Achievements" },
          ]}
          routes={previewRoutes}
          title="My Library"
        >
          <ShellPlaceholder title="Library content">
            <p className={styles.regionIntro}>Search, filters, statistics, and feature-owned data sit above a locally scrollable dense region.</p>
            <DenseRegion label="Library results preview" />
          </ShellPlaceholder>
        </ControlShell>
      );
    case "admin":
      return (
        <AdminShell clubItems={previewClubItems} items={previewAdminItems} routes={previewRoutes}>
          <div className={styles.adminGrid}>
            <ShellPlaceholder title="Operational overview"><p>Privacy-safe metrics and activity summaries render here after the App Admin boundary is enforced.</p></ShellPlaceholder>
            <ShellPlaceholder title="Administration table">
              <p className={styles.regionIntro}>Searchable operational rows remain contained on narrow screens.</p>
              <DenseRegion label="Administration results preview" />
            </ShellPlaceholder>
          </div>
        </AdminShell>
      );
  }
}
