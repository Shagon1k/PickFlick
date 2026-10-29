'use client';

import type { ISessionRoster, TSession } from '@pickflick/contracts';
import { useState } from 'react';

import CancelSessionDialog from '#components/sessions/CancelSessionDialog/CancelSessionDialog';
import NominationClose from '#components/sessions/NominationClose/NominationClose';
import OpenRating from '#components/sessions/OpenRating/OpenRating';
import SelectionClose from '#components/sessions/SelectionClose/SelectionClose';
import SessionRoster from '#components/sessions/SessionRoster/SessionRoster';
import Button from '#components/ui/Button/Button';

import styles from './ActiveSessionActions.module.scss';

/** Manage Club runs the active Session through the same dialogs as its gear menu. */
export default function ActiveSessionActions({
    session,
    roster,
}: {
    session: TSession;
    roster: ISessionRoster;
}) {
    const [isCancelOpen, setIsCancelOpen] = useState(false);
    const { nominations, selection } = session;
    const nextPhase = (phase: string) => (onClose?: () => void) =>
        onClose ? (
            <Button fullWidth onClick={onClose} size="small">
                Start next phase: {phase}
            </Button>
        ) : null;
    return (
        <div className={styles.actions}>
            {nominations ? (
                <NominationClose
                    canClose={nominations.canClose}
                    phaseVersion={session.phaseVersion}
                    sessionId={session.id}
                >
                    {nextPhase(nominations.nominatedCount === 1 ? 'Watching' : 'Selection')}
                </NominationClose>
            ) : null}
            {selection ? (
                <SelectionClose
                    acceptedCount={selection.acceptedCount}
                    canClose={session.canManage && selection.nominations.length > 0}
                    phaseVersion={session.phaseVersion}
                    sessionId={session.id}
                    submittedCount={selection.submittedCount}
                >
                    {nextPhase('Watching')}
                </SelectionClose>
            ) : null}
            {session.phase === 'WATCHING' ? (
                <OpenRating
                    canOpen={session.canManage}
                    phaseVersion={session.phaseVersion}
                    sessionId={session.id}
                >
                    {nextPhase('Rating')}
                </OpenRating>
            ) : null}
            <div className={styles.danger}>
                <SessionRoster roster={roster} sessionId={session.id}>
                    {(_participation, onKick) =>
                        onKick ? (
                            <Button
                                fullWidth
                                onClick={onKick}
                                size="small"
                                variant="secondary-danger"
                            >
                                Kick participant
                            </Button>
                        ) : null
                    }
                </SessionRoster>
                {session.canManage ? (
                    <Button
                        fullWidth
                        onClick={() => setIsCancelOpen(true)}
                        size="small"
                        variant="secondary-danger"
                    >
                        Cancel Session
                    </Button>
                ) : null}
            </div>
            <CancelSessionDialog
                onClose={() => setIsCancelOpen(false)}
                open={isCancelOpen}
                session={session}
            />
        </div>
    );
}
