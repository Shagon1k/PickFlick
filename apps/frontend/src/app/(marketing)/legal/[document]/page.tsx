import Link from 'next/link';
import { notFound } from 'next/navigation';

import PublicShell from '#components/shells/PublicShell/PublicShell';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import { createPublicMetadata } from '#lib/public-metadata';

import { isLegalDocumentName, legalDocuments } from './legal-content';
import styles from './page.module.scss';

interface ILegalPageProps {
    readonly params: Promise<{ document: string }>;
}

export function generateStaticParams() {
    return Object.keys(legalDocuments).map((document) => ({ document }));
}

export async function generateMetadata({ params }: ILegalPageProps) {
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

export default async function LegalPage({ params }: ILegalPageProps) {
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
                                Current data tools, service behavior and the policy decisions still
                                awaiting review before public launch.
                            </p>
                        </div>
                        <BrandImage
                            alt=""
                            asset={document === 'privacy' ? 'privacyData' : 'tieBreakBalance'}
                            className={styles.mascot}
                            loading="eager"
                        />
                    </header>

                    <aside aria-labelledby="legal-review-status" className={styles.reviewNotice}>
                        <p className={styles.reviewLabel} id="legal-review-status">
                            Draft for review
                        </p>
                        <p>
                            This content is provisional. Legal or privacy review and the final
                            production policy are still pending. Operator placeholders must be
                            replaced before public launch.
                        </p>
                    </aside>

                    <article aria-label={legalDocument.title} className={styles.document}>
                        {legalDocument.sections.map((section, index) => (
                            <section className={styles.section} key={section.title}>
                                <span aria-hidden="true" className={styles.sectionIndex}>
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <h2>{section.title}</h2>
                                    {section.body.map((paragraph) => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </article>

                    <p className={styles.contact}>
                        <Link href={document === 'privacy' ? '/legal/terms' : '/legal/privacy'}>
                            {document === 'privacy' ? 'Terms of Service' : 'Privacy Notice'}
                        </Link>
                        <br />
                        Questions about this draft? Write to{' '}
                        <a href="mailto:hello@pick-flick.app">hello@pick-flick.app</a>.
                    </p>
                </div>
            </div>
        </PublicShell>
    );
}
