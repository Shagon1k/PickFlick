import Button from '#components/ui/Button/Button';
import Textarea from '#components/ui/Textarea/Textarea';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from './PastSessionForm.module.scss';

const STEP_COUNT = 3;

export default function PastSessionFormLoading() {
    return (
        <div aria-hidden="true" inert>
            <ol className={styles.steps}>
                {Array.from({ length: STEP_COUNT }, (_, index) => (
                    <li data-done={index === 0 || undefined} key={index} />
                ))}
            </ol>
            <div className={styles.step}>
                <h2 className={styles.stepTitle}>Which film, and when?</h2>
                <TextInput
                    isLoading
                    id="loading-past-film"
                    label="Select a Movie"
                    labelHint="required"
                />
                <div className={styles.when}>
                    <TextInput isLoading id="loading-past-date" label="Date" type="date" required />
                    <TextInput isLoading id="loading-past-time" label="Time" type="time" />
                </div>
                <TextInput isLoading id="loading-past-location" label="Location" required />
                <TextInput isLoading id="loading-past-topic" label="Topic" />
                <Textarea isLoading id="loading-past-notes" label="Notes" size="compact" />
            </div>
            <div className={styles.submit}>
                <Button disabled>Next</Button>
            </div>
            <p className={styles.status} />
        </div>
    );
}
