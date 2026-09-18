import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { BrandImage } from "@pickflick/ui";

import { hasAuthenticatedSession } from "../../../auth-server";
import styles from "../../../components/clubs/club-onboarding.module.css";
import { CreateClubForm } from "../../../components/clubs/create-club-form";

export const metadata: Metadata = {
  title: "Create a Club — PickFlick",
  description: "Name your PickFlick Club and choose its Selection score range.",
};

export default async function CreateClubPage() {
  await connection();
  if (!(await hasAuthenticatedSession(await headers()))) {
    redirect("/login?returnTo=/app");
  }

  return (
    <main className={styles.setupMain}>
      <a className={styles.backLink} href="/app">← Back to your Clubs</a>
      <section aria-labelledby="create-club-title" className={styles.createScene}>
        <BrandImage alt="" asset="settingsSubscription" className={styles.mascot} loading="eager" />
        <div className={styles.createCard}>
          <h1 id="create-club-title">Open a Screening Room</h1>
          <p className={styles.lead}>Every great film Club starts with a name.</p>
          <CreateClubForm />
        </div>
        <p aria-hidden="true" className={styles.sceneOrnament}>Scene 02 · Opening Night</p>
      </section>
    </main>
  );
}
