'use client';

import type { TCreatePastSession, TPastSessionMembers } from '@pickflick/contracts';

import Icon from '#components/ui/Icon/Icon';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import { getMonogram } from '#lib/format';

import { buildMemberNames, formatMemberName } from '../../past-members';
import styles from './PastSessionForm.module.scss';

type TAttendees = TCreatePastSession['attendees'];

/** Step two: who came, and what each of them rated; tapping the same star again clears it. */
export default function PastAttendees({
    members,
    attendees,
    disabled,
    onToggle,
    onRate,
}: {
    members: TPastSessionMembers;
    attendees: TAttendees;
    disabled: boolean;
    onToggle: (membershipId: string, isAttending: boolean) => void;
    onRate: (index: number, score: number | undefined) => void;
}) {
    const names = buildMemberNames(members);
    return (
        <fieldset className={styles.attendees} disabled={disabled}>
            <legend className={styles.stepTitle} data-step-heading tabIndex={-1}>
                Who came?
            </legend>
            <div className={styles.members}>
                {members.map((member) => {
                    const isAttending = attendees.some((row) => row.membershipId === member.id);
                    return (
                        <label key={member.id}>
                            <input
                                type="checkbox"
                                checked={isAttending}
                                onChange={(event) =>
                                    onToggle(member.id, event.currentTarget.checked)
                                }
                            />
                            <span className={styles.monogram} aria-hidden="true" data-press-surface>
                                {isAttending ? (
                                    <Icon name="check" />
                                ) : (
                                    getMonogram(member.displayName)
                                )}
                            </span>
                            {formatMemberName(member)}
                        </label>
                    );
                })}
            </div>
            {attendees.length ? (
                <ul className={styles.ratings} aria-label="Attendee ratings">
                    {attendees.map((attendee, index) => {
                        const name = names.get(attendee.membershipId) ?? 'Attendee';
                        return (
                            <li key={attendee.membershipId}>
                                <span>{name}</span>
                                <RatingControl
                                    isCompact
                                    label={`Rating for ${name}`}
                                    name={`rating-${attendee.membershipId}`}
                                    value={attendee.score ?? 0}
                                    onChange={(score) =>
                                        onRate(index, score === attendee.score ? undefined : score)
                                    }
                                    disabled={disabled}
                                />
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </fieldset>
    );
}
