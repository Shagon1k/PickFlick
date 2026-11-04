import Button from '#components/ui/Button/Button';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import Textarea from '#components/ui/Textarea/Textarea';

import styles from './RatingForm.module.scss';

export default function RatingFormSkeleton() {
    return (
        <div className={styles.form}>
            <RatingControl
                isCompact
                isLoading
                name="loading-session-rating"
                label="Your rating"
                tone="neutral"
            />
            <Textarea
                isLoading
                disabled
                id="loading-session-comment"
                isLabelHidden
                label="Comment"
                size="compact"
                variant="transparent"
            />
            <div className={styles.submitRow}>
                <div className={styles.submitButton}>
                    <Button fullWidth disabled size="large">
                        Submit Rating
                    </Button>
                </div>
                <InfoTip label="About Session Ratings">You rate once.</InfoTip>
            </div>
        </div>
    );
}
