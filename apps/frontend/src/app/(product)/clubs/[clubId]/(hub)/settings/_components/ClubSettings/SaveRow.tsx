'use client';

import { type IClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import Button from '#components/ui/Button/Button';

import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

export default function SaveRow({
    disabled,
    isPending,
    state,
}: {
    disabled: boolean;
    isPending: boolean;
    state: IClubActionState;
}) {
    return (
        <div className={styles.saveRow}>
            <div className={styles.saveButton}>
                <Button
                    disabled={disabled}
                    fullWidth
                    loading={isPending}
                    size="small"
                    type="submit"
                >
                    Save Changes
                </Button>
            </div>
            <ActionStatus state={state} />
        </div>
    );
}
