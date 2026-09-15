import { notFound } from "next/navigation";

import { BrandImage } from "@pickflick/ui";

import {
  isLegalDocumentName,
  legalDocuments,
} from "../../../components/legal/legal-content";
import styles from "../../../components/legal/legal.module.css";
import { PublicShell } from "../../../components/shells/shells";
import { createPublicMetadata } from "../../../public-metadata";

interface LegalPageProps {
  readonly params: Promise<{ document: string }>;
}

export function generateStaticParams() {
  return Object.keys(legalDocuments).map((document) => ({ document }));
}

export async function generateMetadata({ params }: LegalPageProps) {
  const { document } = await params;
  if (!isLegalDocumentName(document)) {
    notFound();
  }

  const legalDocument = legalDocuments[document];
  return createPublicMetadata({
    description: legalDocument.description,
    path: legalDocument.path,
    title: `${legalDocument.title} — PickFlick`,
  });
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { document } = await params;
  if (!isLegalDocumentName(document)) {
    notFound();
  }

  const legalDocument = legalDocuments[document];

  return (
    <PublicShell>
      <div className={styles.page}>
        <div className={styles.layout}>
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{legalDocument.eyebrow}</p>
              <h1>{legalDocument.title}</h1>
              <p className={styles.lead}>
                A clear entry point while PickFlick&apos;s launch policies are being completed and reviewed.
              </p>
            </div>
            <BrandImage alt="" asset={document === "privacy" ? "privacyData" : "tieBreakBalance"} className={styles.mascot} loading="eager" />
          </header>

          <aside aria-labelledby="legal-review-status" className={styles.reviewNotice}>
            <p className={styles.reviewLabel} id="legal-review-status">Draft for review</p>
            <p>This content is provisional. Legal or privacy review and the final production policy are still pending.</p>
          </aside>

          <article aria-label={legalDocument.title} className={styles.document}>
            {legalDocument.sections.map((section, index) => (
              <section className={styles.section} key={section.title}>
                <span aria-hidden="true" className={styles.sectionIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{section.title}</h2>
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </article>

          <p className={styles.contact}>
            Questions about this draft? Write to {" "}
            <a href="mailto:hello@pick-flick.app">hello@pick-flick.app</a>.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
