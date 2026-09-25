import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ActionLink } from "@pickflick/ui";

import { loginPath } from "../../../../auth-server";
import { loadClubSettings } from "../../../../components/clubs/club-api";
import { ClubSettings } from "../../../../components/clubs/club-settings";
import styles from "../../../../components/clubs/club-settings.module.css";
import { clubNavigation, ProductFrame } from "../../../../components/shells/shells";

export const metadata: Metadata = {
  title: "Club settings — PickFlick",
  description: "Manage one private PickFlick Club.",
};

function SafeFailure({ forbidden = false }: Readonly<{ forbidden?: boolean }>) {
  return (
    <ProductFrame>
      <main className={styles.layout}>
        <section className={styles.card}>
          <p className={styles.kicker}>{forbidden ? "Private Club" : "Projection interrupted"}</p>
          <h1>{forbidden ? "Club access unavailable" : "Club settings are temporarily unavailable"}</h1>
          <p className={styles.explanation}>
            {forbidden
              ? "This page requires an active Membership. No Club details were disclosed."
              : "Nothing was changed. Return to your Clubs or retry this page."}
          </p>
          <div className={styles.formFooter}><ActionLink href="/app" variant="primary">Back to your Clubs</ActionLink></div>
        </section>
      </main>
    </ProductFrame>
  );
}

export default async function ClubSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
  await connection();
  const { clubId } = await params;
  const response = await loadClubSettings(await headers(), clubId).catch(() => ({ ok: false, status: 503 } as const));
  if (response.status === 401) {
    redirect(loginPath(`/clubs/${clubId}/settings`));
  }
  if (response.status === 403) {
    return <SafeFailure forbidden />;
  }
  if (!response.ok || !response.body) {
    return <SafeFailure />;
  }
  const club = response.body.club;
  return (
    <ProductFrame clubItems={clubNavigation(club.id, "manage")}>
      <ClubSettings projection={response.body} />
    </ProductFrame>
  );
}
