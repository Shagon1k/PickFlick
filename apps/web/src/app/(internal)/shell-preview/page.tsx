import { ActionLink, BrandImage, Pill } from '@pickflick/ui';

import styles from '@/app/(internal)/shell-preview/shell-preview.module.scss';

const shells = [
    ['Public', 'Brand header, responsive navigation, editorial canvas, and public footer.'],
    ['Setup', 'Compact entry header and a focused setup or authentication panel.'],
    ['Product', 'Authenticated product chrome, Club context, tabs, and mobile navigation.'],
    ['Session', 'Shared Session status, hero, actions, phase slot, and details structure.'],
    ['Settings', 'Personal control shell with responsive local section navigation.'],
    ['Library', 'Personal Library shell with bounded dense content regions.'],
    ['Admin', 'Protected administration shell with desktop and mobile task navigation.'],
] as const;

export default function ShellPreviewIndexPage() {
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div>
                    <p className={styles.eyebrow}>Production shells · issue 19</p>
                    <h1>Responsive structure for every PickFlick context.</h1>
                    <p>
                        These routes demonstrate composition and navigation without feature data,
                        provider behavior, or production copy.
                    </p>
                    <Pill tone="warm">S · M · L · XL</Pill>
                </div>
                <BrandImage
                    alt="A panda operating a cinema projector"
                    asset="hero"
                    className={styles.heroImage}
                    loading="eager"
                />
            </header>
            <section aria-labelledby="shell-list-title" className={styles.section}>
                <h2 id="shell-list-title">Shell routes</h2>
                <div className={styles.grid}>
                    {shells.map(([name, description]) => (
                        <article className={styles.card} key={name}>
                            <p className={styles.cardLabel}>Shared shell</p>
                            <h3>{name}</h3>
                            <p>{description}</p>
                            <ActionLink href={`/shell-preview/${name.toLowerCase()}`}>
                                Open {name} shell
                            </ActionLink>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}
