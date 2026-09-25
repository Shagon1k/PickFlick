import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { ClubSummary } from "@pickflick/contracts";
import { ActionLink, BrandImage, Pill } from "@pickflick/ui";

import { loginPath } from "../../auth-server";
import { loadClubCollection } from "../../components/clubs/club-api";
import styles from "../../components/clubs/club-onboarding.module.css";
import { clubNavigation } from "../../components/shells/shell-navigation";
import { ProductFrame } from "../../components/shells/shells";

export const metadata: Metadata = {
  title: "Your Clubs — PickFlick",
  description: "Open or create your private PickFlick Club.",
};

function NoClubs() {
  return (
    <ProductFrame>
      <main className={styles.noClubsMain}>
        <section aria-labelledby="no-clubs-title" className={styles.noClubsStage}>
          <div aria-hidden="true" className={styles.illustration}>
            <BrandImage alt="" asset="sessionManagement" loading="eager" />
          </div>
          <div className={styles.body}>
            <p className={styles.kicker}>Your screening room awaits</p>
            <h1 id="no-clubs-title">You haven&apos;t joined any Clubs yet</h1>
            <p className={styles.copy}>
              Create a film Club for your crew. PickFlick will keep nominations, watch nights, and ratings in one place.
            </p>
            <div className={styles.actions}>
              <ActionLink href="/clubs/new" variant="primary">Create a Club</ActionLink>
            </div>
            <p className={styles.note}>Have an invitation? Open its private link to join that Club.</p>
          </div>
        </section>
      </main>
    </ProductFrame>
  );
}

function ClubReady({ club }: Readonly<{ club: ClubSummary }>) {
  return (
    <ProductFrame clubItems={clubNavigation(club.id, "overview")}>
      <main className={styles.readyMain}>
        <section aria-labelledby="club-ready-title" className={styles.readyCard}>
          <p className={styles.kicker}>Opening night</p>
          <Pill tone="warm">{club.tier === "FREE" ? "Free Club" : "Pro Club"}</Pill>
          <h1 id="club-ready-title">{club.name}</h1>
          <p>
            Your Club is ready. Session creation and the full Club Hub arrive in their owning delivery phases.
          </p>
          <dl className={styles.facts}>
            <div><dt>Your role</dt><dd>{club.membershipRole === "ADMIN" ? "Admin" : club.membershipRole}</dd></div>
            <div><dt>Selection scale</dt><dd>{club.selectionScaleMin}–{club.selectionScaleMax}</dd></div>
            <div><dt>Status</dt><dd>{club.lifecycle === "ACTIVE" ? "Active" : "Archived"}</dd></div>
          </dl>
          <div className={styles.actions}>
            <ActionLink href={`/clubs/${club.id}/settings`} variant="primary">Manage Club</ActionLink>
          </div>
        </section>
      </main>
    </ProductFrame>
  );
}

export default async function AppPage() {
  await connection();
  let response;
  try {
    response = await loadClubCollection(await headers());
  } catch {
    response = { ok: false, status: 503 } as const;
  }
  if (response.status === 401) {
    redirect(loginPath("/app"));
  }
  if (!response.ok || !response.body) {
    return (
      <ProductFrame>
        <main className={styles.readyMain}>
          <section aria-labelledby="clubs-unavailable-title" className={styles.readyCard}>
            <p className={styles.kicker}>Projection interrupted</p>
            <h1 id="clubs-unavailable-title">Your Clubs are temporarily unavailable</h1>
            <p>Nothing was changed. Try loading the screening room again.</p>
            <div className={styles.actions}><ActionLink href="/app" variant="primary">Try again</ActionLink></div>
          </section>
        </main>
      </ProductFrame>
    );
  }
  return response.body.clubs[0] ? <ClubReady club={response.body.clubs[0]} /> : <NoClubs />;
}
