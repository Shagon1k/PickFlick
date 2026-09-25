import Alert from '@/components/ui/Alert/Alert';
import BrandImage from '@/components/ui/BrandImage/BrandImage';
import Button from '@/components/ui/Button/Button';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import LoadingState from '@/components/ui/LoadingState/LoadingState';
import Pill from '@/components/ui/Pill/Pill';
import Progress from '@/components/ui/Progress/Progress';
import Select from '@/components/ui/Select/Select';
import StatusBanner from '@/components/ui/StatusBanner/StatusBanner';
import Switch from '@/components/ui/Switch/Switch';
import Table, { type ITableColumn, type ITableRow } from '@/components/ui/Table/Table';
import Tabs from '@/components/ui/Tabs/Tabs';
import Textarea from '@/components/ui/Textarea/Textarea';
import TextInput from '@/components/ui/TextInput/TextInput';

import {
    PreviewInteractions,
    PreviewMenus,
    ReviewFixInteractions,
} from './_components/PreviewInteractions/PreviewInteractions';
import styles from './page.module.scss';

const tableColumns: ITableColumn[] = [
    { key: 'member', header: 'Member' },
    { key: 'state', header: 'State' },
    { key: 'score', header: 'Score', numeric: true },
];

const tableRows: ITableRow[] = [
    { id: 'alex', cells: { member: 'Alex', state: 'Submitted', score: '4' } },
    { id: 'maya', cells: { member: 'Maya', state: 'Waiting', score: '—' } },
];

export default function UiPreviewPage() {
    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div>
                    <p className={styles.eyebrow}>Production foundation · issue 17</p>
                    <h1>A common language for every screening.</h1>
                    <p>
                        Projector Noir keeps structure monochrome and reserves warmth for the
                        connected moment that matters.
                    </p>
                    <div className={styles.pillRow}>
                        <Pill>Neutral structure</Pill>
                        <Pill tone="warm">Selected route</Pill>
                        <Pill tone="success">Verified state</Pill>
                    </div>
                </div>
                <BrandImage
                    alt="A panda operating a cinema projector"
                    asset="hero"
                    className={styles.heroImage}
                    loading="eager"
                />
            </section>

            <PreviewSection
                kicker="01 · Foundations"
                title="Shared tokens"
                description="Color, type, spacing, layout, elevation, imagery, and motion resolve through one production contract."
            >
                <div className={styles.tokenGrid}>
                    {[
                        ['Page', 'var(--bg)'],
                        ['Surface', 'var(--surface)'],
                        ['Foreground', 'var(--fg)'],
                        ['Gold route', 'var(--gold)'],
                        ['Ivory', 'var(--ivory)'],
                        ['Success', 'var(--success)'],
                        ['Warning', 'var(--warn)'],
                        ['Danger', 'var(--danger)'],
                    ].map(([label, color]) => (
                        <div
                            className={styles.token}
                            key={label}
                            style={{ '--token-color': color } as React.CSSProperties}
                        >
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="02 · Actions"
                title="Buttons and states"
                description="Primary actions stay monochrome. Danger appears only at the appropriate confirmation level."
            >
                <div className={styles.stateGrid}>
                    <StateCell label="Default">
                        <Button>Create Session</Button>
                    </StateCell>
                    <StateCell label="Secondary">
                        <Button variant="secondary">Invite</Button>
                    </StateCell>
                    <StateCell label="Loading">
                        <Button loading>Creating</Button>
                    </StateCell>
                    <StateCell label="Success">
                        <Button success="Changes saved.">Save</Button>
                    </StateCell>
                    <StateCell label="Disabled">
                        <Button disabled>Create</Button>
                    </StateCell>
                    <StateCell label="Ghost">
                        <Button variant="ghost">Back to Hub</Button>
                    </StateCell>
                    <StateCell label="Danger trigger">
                        <Button variant="secondary-danger">Cancel Session</Button>
                    </StateCell>
                    <StateCell label="Danger confirm">
                        <Button variant="danger">Delete</Button>
                    </StateCell>
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="03 · Forms"
                title="Fields and selection"
                description="Labels, stable help regions, accessible semantics, and non-color messages travel with every control."
            >
                <div className={styles.grid}>
                    <div className={`${styles.panel} ${styles.formStack}`}>
                        <TextInput
                            id="club-name"
                            hint="Shown to every Club member."
                            label="Club name"
                            defaultValue="Friday Night Film Club"
                        />
                        <TextInput
                            error="Use at least 3 characters."
                            id="short-name"
                            label="Club name with error"
                            defaultValue="F"
                        />
                        <TextInput
                            id="saved-name"
                            label="Saved Club name"
                            success="Club name saved."
                            defaultValue="Friday Night"
                        />
                        <TextInput
                            disabled
                            id="provider-email"
                            label="Email"
                            defaultValue="alexey@example.com"
                        />
                    </div>
                    <div className={`${styles.panel} ${styles.formStack}`}>
                        <Select
                            id="score-range"
                            label="Selection range"
                            name="score-range"
                            defaultValue="0-4"
                            hint="Choose the Club scoring range."
                            data={[
                                { value: '0-4', label: '0 to 4' },
                                { value: '1-5', label: '1 to 5' },
                            ]}
                        />
                        <Textarea
                            id="session-note"
                            label="Session note"
                            placeholder="Add context for the Club"
                        />
                        <Switch
                            defaultChecked
                            id="rating-reminders"
                            label="Rating reminders"
                            description="Receive a reminder while Rating remains open."
                        />
                        <Switch disabled id="provider-setting" label="Provider-managed setting" />
                    </div>
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="04 · Navigation"
                title="Tabs and film-strip menu"
                description="Arrow-key navigation, explicit selection, focus entry, Escape dismissal, and focus return are built in."
            >
                <div className={styles.grid}>
                    <div className={styles.panel}>
                        <Tabs
                            label="Club views"
                            items={[
                                {
                                    id: 'overview',
                                    label: 'Overview',
                                    content: (
                                        <p className={styles.tabCopy}>
                                            The current Session and next useful action stay
                                            together.
                                        </p>
                                    ),
                                },
                                {
                                    id: 'sessions',
                                    label: 'Sessions',
                                    content: (
                                        <p className={styles.tabCopy}>
                                            Session history uses the same shared table and feedback
                                            primitives.
                                        </p>
                                    ),
                                },
                                {
                                    id: 'manage',
                                    label: 'Manage Club',
                                    content: (
                                        <p className={styles.tabCopy}>
                                            Permission-sensitive controls remain explicit.
                                        </p>
                                    ),
                                },
                                {
                                    id: 'future',
                                    label: 'Unavailable',
                                    content: null,
                                    disabled: true,
                                },
                            ]}
                        />
                    </div>
                    <div className={styles.panel}>
                        <PreviewMenus />
                    </div>
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="05 · Status"
                title="Feedback and progress"
                description="Stable, announced states remain specific and recoverable without relying on color alone."
            >
                <div className={styles.feedbackGrid}>
                    <div className={styles.feedbackStack}>
                        <StatusBanner>
                            Selection closes Friday at 19:30. Four members have submitted.
                        </StatusBanner>
                        <Alert title="Settings saved" tone="success">
                            Your reminder preferences are active.
                        </Alert>
                        <Alert title="Connection interrupted" tone="warning">
                            Your changes remain here. Try again when you are online.
                        </Alert>
                        <Alert title="Session could not advance" tone="danger">
                            Review the incomplete scores and try again.
                        </Alert>
                    </div>
                    <div className={`${styles.panel} ${styles.feedbackStack}`}>
                        <Progress label="Selection participation" max={5} value={4} />
                        <LoadingState label="Loading Session details" lines={3} />
                    </div>
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="06 · Data"
                title="Tables and empty states"
                description="Dense data scrolls inside a named region; empty states preserve an authorized next step."
            >
                <div className={styles.grid}>
                    <Table caption="Selection progress" columns={tableColumns} rows={tableRows} />
                    <EmptyState
                        title="No completed Sessions yet"
                        action={<Button variant="secondary">Log a past Session</Button>}
                    >
                        Finish a screening or record one from the Club archive.
                    </EmptyState>
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="07 · Score, rating, dialog"
                title="Keyboard-complete controls"
                description="Inclusive Club score ranges, the 1–10 rating control, and modal focus containment share the same tokens."
            >
                <div className={styles.panel} id="dialogs">
                    <PreviewInteractions />
                </div>
            </PreviewSection>

            <PreviewSection
                kicker="08 · Dynamic states"
                title="Constraint and update behavior"
                description="Required custom controls, changing tab sets, and asynchronous field feedback preserve native submission and assistive-technology behavior."
            >
                <ReviewFixInteractions />
            </PreviewSection>
        </main>
    );
}

function PreviewSection({
    children,
    description,
    kicker,
    title,
}: {
    children: React.ReactNode;
    description: string;
    kicker: string;
    title: string;
}) {
    const id = kicker.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase();
    return (
        <section
            aria-labelledby={`${id}-title`}
            className={styles.section}
            id={['forms', 'navigation'].find((anchor) => id.includes(anchor)) ?? id}
        >
            <header className={styles.sectionHeader}>
                <div>
                    <span className={styles.sectionKicker}>{kicker}</span>
                    <h2 id={`${id}-title`}>{title}</h2>
                </div>
                <p>{description}</p>
            </header>
            {children}
        </section>
    );
}

function StateCell({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className={styles.stateCell}>
            <span className={styles.stateLabel}>{label}</span>
            {children}
        </div>
    );
}
