'use client';

import { useState } from 'react';

import Button from '@/components/ui/Button/Button';
import ScoreControl from '@/components/ui/ScaleControl/ScoreControl';
import Select from '@/components/ui/Select/Select';
import Tabs from '@/components/ui/Tabs/Tabs';
import TextInput from '@/components/ui/TextInput/TextInput';
import { formText } from '@/lib/form-data';

import styles from '../../page.module.scss';

export default function ReviewFixInteractions() {
    const [feedback, setFeedback] = useState<'error' | 'success' | undefined>();
    const [isReadOnlySubmitted, setIsReadOnlySubmitted] = useState(false);
    const [isSecondTabDisabled, setIsSecondTabDisabled] = useState(false);
    const [isSecondTabRemoved, setIsSecondTabRemoved] = useState(false);
    const [submittedScore, setSubmittedScore] = useState('Not submitted');
    const [submittedValue, setSubmittedValue] = useState('Not submitted');
    const tabItems = [
        { id: 'first', label: 'First enabled', content: 'First enabled panel' },
        ...(isSecondTabRemoved
            ? []
            : [
                  {
                      id: 'selected',
                      label: 'Selected tab',
                      content: 'Selected panel',
                      disabled: isSecondTabDisabled,
                  },
              ]),
    ];

    return (
        <div className={styles.gridWide}>
            <form
                aria-label="Required select form"
                className={`${styles.panel} ${styles.formStack}`}
                onSubmit={(event) => {
                    event.preventDefault();
                    setSubmittedValue(
                        formText(new FormData(event.currentTarget), 'required-range'),
                    );
                }}
            >
                <Select
                    id="required-range"
                    label="Required selection range"
                    name="required-range"
                    placeholder="Choose a range"
                    data={[
                        { value: '0-4', label: '0 to 4' },
                        { value: '1-5', label: '1 to 5' },
                    ]}
                    required
                />
                <Button type="submit" variant="secondary">
                    Submit required select
                </Button>
                <output data-submitted-value>{submittedValue}</output>
            </form>
            <form
                aria-label="Read-only required select form"
                className={`${styles.panel} ${styles.formStack}`}
                onSubmit={(event) => {
                    event.preventDefault();
                    setIsReadOnlySubmitted(true);
                }}
            >
                <Select
                    id="read-only-range"
                    label="Read-only selection range"
                    name="read-only-range"
                    placeholder="No range configured"
                    readOnly
                    required
                />
                <Button type="submit" variant="secondary">
                    Submit read-only select
                </Button>
                <output data-read-only-submitted>
                    {isReadOnlySubmitted ? 'Submitted' : 'Not submitted'}
                </output>
            </form>
            <form
                aria-label="Required score form"
                className={`${styles.panel} ${styles.formStack}`}
                onSubmit={(event) => {
                    event.preventDefault();
                    setSubmittedScore(
                        formText(new FormData(event.currentTarget), 'required-score'),
                    );
                }}
            >
                <ScoreControl
                    label="Required selection score"
                    max={4}
                    min={0}
                    name="required-score"
                    required
                />
                <Button type="submit" variant="secondary">
                    Submit required score
                </Button>
                <output data-submitted-score>{submittedScore}</output>
            </form>
            <div className={`${styles.panel} ${styles.formStack}`}>
                <Tabs initialId="selected" items={tabItems} label="Changing views" />
                <div className={styles.buttonRow}>
                    <Button
                        onClick={() => setIsSecondTabDisabled((wasDisabled) => !wasDisabled)}
                        variant="ghost"
                    >
                        {isSecondTabDisabled ? 'Enable selected tab' : 'Disable selected tab'}
                    </Button>
                    <Button
                        onClick={() => setIsSecondTabRemoved((wasRemoved) => !wasRemoved)}
                        variant="ghost"
                    >
                        {isSecondTabRemoved ? 'Restore selected tab' : 'Remove selected tab'}
                    </Button>
                </div>
            </div>
            <div className={`${styles.panel} ${styles.formStack}`}>
                <TextInput
                    id="async-club-name"
                    label="Async Club name"
                    {...(feedback === 'error' ? { error: 'Club name could not be saved.' } : {})}
                    {...(feedback === 'success' ? { success: 'Club name saved.' } : {})}
                />
                <div className={styles.buttonRow}>
                    <Button onClick={() => setFeedback('error')} variant="ghost">
                        Show async error
                    </Button>
                    <Button onClick={() => setFeedback('success')} variant="ghost">
                        Show async success
                    </Button>
                </div>
            </div>
        </div>
    );
}
