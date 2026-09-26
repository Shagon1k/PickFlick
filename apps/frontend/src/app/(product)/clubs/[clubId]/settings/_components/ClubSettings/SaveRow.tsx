'use client';

import Button from '@/components/ui/Button/Button';

import { type IClubActionState } from '../../action-state';
import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

export default function SaveRow({
    disabled,
    pending,
    state,
}: {
    disabled: boolean;
    pending: boolean;
    state: IClubActionState;
}) {
    return (
        <div className={styles.saveRow}>
            <div className={styles.saveButton}>
                <Button disabled={disabled} fullWidth loading={pending} size="small" type="submit">
                    Save Changes
                </Button>
            </div>
            <ActionStatus state={state} />
        </div>
    );
}
