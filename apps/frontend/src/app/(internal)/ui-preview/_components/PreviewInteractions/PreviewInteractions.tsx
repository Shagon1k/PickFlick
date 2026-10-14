'use client';

import { useState } from 'react';

import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import RatingControl from '@/components/ui/ScaleControl/RatingControl';
import ScoreControl from '@/components/ui/ScaleControl/ScoreControl';

import styles from '../../page.module.scss';

export default function PreviewInteractions() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDangerDialogOpen, setIsDangerDialogOpen] = useState(false);
    const [adjustableMax, setAdjustableMax] = useState(5);

    return (
        <div className={styles.scaleStack}>
            <ScoreControl
                defaultValue={2}
                label="Selection score"
                max={4}
                min={0}
                name="preview-score"
            />
            <RatingControl defaultValue={7} label="Session rating" name="preview-rating" />
            <ScoreControl
                defaultValue={3}
                label="Submitted score"
                max={5}
                name="submitted-score"
                submitted
            />
            <ScoreControl
                defaultValue={5}
                label="Adjustable score"
                max={adjustableMax}
                name="adjustable-score"
            />
            <Button
                onClick={() => setAdjustableMax((current) => (current === 5 ? 4 : 5))}
                variant="ghost"
            >
                {adjustableMax === 5 ? 'Reduce adjustable scale' : 'Restore adjustable scale'}
            </Button>
            <div className={styles.dialogActions}>
                <Button onClick={() => setIsDialogOpen(true)} variant="secondary">
                    Open dialog
                </Button>
                <Button onClick={() => setIsDangerDialogOpen(true)} variant="secondary-danger">
                    Delete Club
                </Button>
            </div>
            <Modal
                actions={<Button onClick={() => setIsDialogOpen(false)}>Continue</Button>}
                onClose={() => setIsDialogOpen(false)}
                open={isDialogOpen}
                title="Move to Selection?"
            >
                Members who have not nominated will lose their remaining nomination opportunity.
            </Modal>
            <Modal
                actions={
                    <>
                        <Button onClick={() => setIsDangerDialogOpen(false)} variant="secondary">
                            Cancel
                        </Button>
                        <Button onClick={() => setIsDangerDialogOpen(false)} variant="danger">
                            Delete Club
                        </Button>
                    </>
                }
                onClose={() => setIsDangerDialogOpen(false)}
                open={isDangerDialogOpen}
                title="Delete Friday Night?"
                tone="danger"
            >
                This irreversible action belongs in a separate confirmation context.
            </Modal>
        </div>
    );
}
