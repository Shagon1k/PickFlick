import {
  Alert,
  BrandImage,
  Button,
  DataTable,
  EmptyState,
  FilmStripMenu,
  LoadingState,
  Pill,
  ProgressFilmStrip,
  SelectField,
  StatusBanner,
  Tabs,
  TextAreaField,
  TextField,
  Toggle,
} from "@pickflick/ui";

import { PreviewInteractions } from "./preview-interactions";
import styles from "./preview.module.css";

const tableColumns = [
  { key: "member", header: "Member" },
  { key: "state", header: "State" },
  { key: "score", header: "Score", numeric: true },
] as const;

const tableRows = [
  { id: "alex", cells: { member: "Alex", state: "Submitted", score: "4" } },
  { id: "maya", cells: { member: "Maya", state: "Waiting", score: "—" } },
] as const;

export default function UiPreviewPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Production foundation · issue 17</p>
          <h1>A common language for every screening.</h1>
          <p>
            Projector Noir keeps structure monochrome and reserves warmth for the connected moment
            that matters.
          </p>
          <div className={styles.pillRow}>
            <Pill>Neutral structure</Pill>
            <Pill tone="warm">Selected route</Pill>
            <Pill tone="success">Verified state</Pill>
          </div>
        </div>
        <BrandImage alt="A panda operating a cinema projector" asset="hero" className={styles.heroImage} loading="eager" />
      </section>

      <PreviewSection kicker="01 · Foundations" title="Shared tokens" description="Color, type, spacing, layout, elevation, imagery, and motion resolve through one production contract.">
        <div className={styles.tokenGrid}>
          {[
            ["Page", "var(--bg)"],
            ["Surface", "var(--surface)"],
            ["Foreground", "var(--fg)"],
            ["Gold route", "var(--gold)"],
            ["Ivory", "var(--ivory)"],
            ["Success", "var(--success)"],
            ["Warning", "var(--warn)"],
            ["Danger", "var(--danger)"],
          ].map(([label, color]) => (
            <div className={styles.token} key={label} style={{ "--token-color": color } as React.CSSProperties}>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection kicker="02 · Actions" title="Buttons and states" description="Primary actions stay monochrome. Danger appears only at the appropriate confirmation level.">
        <div className={styles.stateGrid}>
          <StateCell label="Default"><Button>Create Session</Button></StateCell>
          <StateCell label="Secondary"><Button variant="secondary">Invite</Button></StateCell>
          <StateCell label="Loading"><Button loading>Creating</Button></StateCell>
          <StateCell label="Success"><Button success>Saved</Button></StateCell>
          <StateCell label="Disabled"><Button disabled>Create</Button></StateCell>
          <StateCell label="Ghost"><Button variant="ghost">Back to Hub</Button></StateCell>
          <StateCell label="Danger trigger"><Button variant="secondary-danger">Cancel Session</Button></StateCell>
          <StateCell label="Danger confirm"><Button variant="danger">Delete</Button></StateCell>
        </div>
      </PreviewSection>

      <PreviewSection kicker="03 · Forms" title="Fields and selection" description="Labels, stable help regions, accessible semantics, and non-color messages travel with every control.">
        <div className={styles.grid}>
          <div className={`${styles.panel} ${styles.formStack}`}>
            <TextField id="club-name" hint="Shown to every Club member." label="Club name" defaultValue="Friday Night Film Club" />
            <TextField error="Use at least 3 characters." id="short-name" label="Club name with error" defaultValue="F" />
            <TextField id="saved-name" label="Saved Club name" success="Club name saved." defaultValue="Friday Night" />
            <TextField disabled id="provider-email" label="Email" defaultValue="alexey@example.com" />
          </div>
          <div className={`${styles.panel} ${styles.formStack}`}>
            <SelectField id="score-range" label="Selection range" name="score-range" defaultValue="0-4">
              <option value="0-4">0 to 4</option>
              <option value="1-5">1 to 5</option>
            </SelectField>
            <TextAreaField id="session-note" label="Session note" placeholder="Add context for the Club" />
            <Toggle defaultChecked id="rating-reminders" label="Rating reminders" description="Receive a reminder while Rating remains open." />
            <Toggle disabled id="provider-setting" label="Provider-managed setting" />
          </div>
        </div>
      </PreviewSection>

      <PreviewSection kicker="04 · Navigation" title="Tabs and film-strip menu" description="Arrow-key navigation, explicit selection, focus entry, Escape dismissal, and focus return are built in.">
        <div className={styles.grid}>
          <div className={styles.panel}>
            <Tabs
              label="Club views"
              items={[
                { id: "overview", label: "Overview", content: <p className={styles.tabCopy}>The current Session and next useful action stay together.</p> },
                { id: "sessions", label: "Sessions", content: <p className={styles.tabCopy}>Session history uses the same shared table and feedback primitives.</p> },
                { id: "manage", label: "Manage Club", content: <p className={styles.tabCopy}>Permission-sensitive controls remain explicit.</p> },
                { id: "future", label: "Unavailable", content: null, disabled: true },
              ]}
            />
          </div>
          <div className={styles.panel}>
            <div className={styles.menuRow}>
              <FilmStripMenu
                items={[
                  { id: "overview", label: "Overview", href: "#navigation", current: true },
                  { id: "settings", label: "Settings", href: "#forms" },
                  { id: "leave", label: "Leave Club", href: "#dialogs", danger: true },
                ]}
                menuLabel="Club menu"
                triggerLabel="Open Club menu"
              />
              <FilmStripMenu
                items={[
                  { id: "profile", label: "Profile", href: "#forms" },
                  { id: "sign-out", label: "Sign out", href: "#dialogs", danger: true },
                ]}
                menuLabel="Account menu"
                triggerLabel="Open account menu"
              />
            </div>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection kicker="05 · Status" title="Feedback and progress" description="Stable, announced states remain specific and recoverable without relying on color alone.">
        <div className={styles.feedbackGrid}>
          <div className={styles.feedbackStack}>
            <StatusBanner>Selection closes Friday at 19:30. Four members have submitted.</StatusBanner>
            <Alert title="Settings saved" tone="success">Your reminder preferences are active.</Alert>
            <Alert title="Connection interrupted" tone="warning">Your changes remain here. Try again when you are online.</Alert>
            <Alert title="Session could not advance" tone="danger">Review the incomplete scores and try again.</Alert>
          </div>
          <div className={`${styles.panel} ${styles.feedbackStack}`}>
            <ProgressFilmStrip label="Selection participation" max={5} value={4} />
            <LoadingState label="Loading Session details" lines={3} />
          </div>
        </div>
      </PreviewSection>

      <PreviewSection kicker="06 · Data" title="Tables and empty states" description="Dense data scrolls inside a named region; empty states preserve an authorized next step.">
        <div className={styles.grid}>
          <DataTable caption="Selection progress" columns={tableColumns} rows={tableRows} />
          <EmptyState title="No completed Sessions yet" action={<Button variant="secondary">Log a past Session</Button>}>
            Finish a screening or record one from the Club archive.
          </EmptyState>
        </div>
      </PreviewSection>

      <PreviewSection kicker="07 · Score, rating, dialog" title="Keyboard-complete controls" description="Inclusive Club score ranges, the 1–10 rating control, and modal focus containment share the same tokens.">
        <div className={styles.panel} id="dialogs"><PreviewInteractions /></div>
      </PreviewSection>
    </main>
  );
}

function PreviewSection({ children, description, kicker, title }: Readonly<{ children: React.ReactNode; description: string; kicker: string; title: string }>) {
  const id = kicker.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase();
  return (
    <section aria-labelledby={`${id}-title`} className={styles.section} id={id.includes("forms") ? "forms" : id.includes("navigation") ? "navigation" : id}>
      <header className={styles.sectionHeader}>
        <div><span className={styles.sectionKicker}>{kicker}</span><h2 id={`${id}-title`}>{title}</h2></div>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

function StateCell({ children, label }: Readonly<{ children: React.ReactNode; label: string }>) {
  return <div className={styles.stateCell}><span className={styles.stateLabel}>{label}</span>{children}</div>;
}
