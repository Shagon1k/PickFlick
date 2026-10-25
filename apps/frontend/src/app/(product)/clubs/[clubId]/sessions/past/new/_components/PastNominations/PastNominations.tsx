'use client';

import type { TCreatePastSession, TPastSessionMembers } from '@pickflick/contracts';
import { useState } from 'react';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import Button from '#components/ui/Button/Button';
import Select from '#components/ui/Select/Select';

import styles from './PastNominations.module.scss';

type TEvidence = Pick<TCreatePastSession, 'nominations' | 'scoreMatrix'>;

export default function PastNominations({
    evidence,
    attendees,
    members,
    scaleMin,
    scaleMax,
    disabled,
    error,
    onChange,
}: {
    evidence: TEvidence;
    attendees: TCreatePastSession['attendees'];
    members: TPastSessionMembers;
    scaleMin: number;
    scaleMax: number;
    disabled: boolean;
    error?: React.ReactNode;
    onChange: (evidence: TEvidence) => void;
}) {
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const { nominations, scoreMatrix } = evidence;
    function removeNomination(movieId: string) {
        onChange({
            nominations: nominations.filter((row) => row.movieId !== movieId),
            scoreMatrix: scoreMatrix.map((row) => ({
                ...row,
                scores: row.scores.filter((cell) => cell.movieId !== movieId),
            })),
        });
        setMessage('Nomination and its recorded scores removed.');
        requestAnimationFrame(() => document.getElementById('past-nomination')?.focus());
    }
    function setScore(membershipId: string, movieId: string, value: string) {
        const scores = scoreMatrix.find((row) => row.membershipId === membershipId)?.scores ?? [];
        const next = scores.filter((cell) => cell.movieId !== movieId);
        if (value !== '') next.push({ movieId, score: Number(value) });
        onChange({
            nominations,
            scoreMatrix: [
                ...scoreMatrix.filter((row) => row.membershipId !== membershipId),
                { membershipId, scores: next },
            ],
        });
    }
    return (
        <fieldset className={styles.evidence} disabled={disabled}>
            <legend>Nomination Details (optional)</legend>
            <p>Add only remembered nominations and scores. Blank cells mean unknown, not zero.</p>
            <MoviePicker
                id="past-nomination"
                label="Add nominated Movies"
                required={false}
                placeholder="Add a nominated Movie…"
                value={null}
                disabled={disabled}
                error={error}
                onChange={(id, movie) => {
                    if (!id || !movie) return;
                    if (nominations.some((row) => row.movieId === id)) {
                        setMessage('This Movie is already in the nomination list.');
                        return;
                    }
                    setTitles((current) => ({
                        ...current,
                        [id]: movie.title ?? movie.originalTitle ?? 'Untitled film',
                    }));
                    onChange({ nominations: [...nominations, { movieId: id }], scoreMatrix });
                    setMessage(
                        'Nomination added. Choose a nominator if known; original submission time is unknown.',
                    );
                }}
            />
            <p role="status">{message}</p>
            <ul className={styles.movies} aria-label="Imported nominations">
                {nominations.map(({ movieId: id, nominatorMembershipId }) => (
                    <li key={id}>
                        <span>{titles[id]}</span>
                        <Select
                            id={`nominator-${id}`}
                            label={`Nominator for ${titles[id]} (optional)`}
                            value={nominatorMembershipId ?? ''}
                            disabled={disabled}
                            data={[
                                { value: '', label: 'Unknown' },
                                ...members.map((member) => ({
                                    value: member.id,
                                    label: `${member.displayName}${member.status === 'ACTIVE' ? '' : ' (former member)'}`,
                                })),
                            ]}
                            onChange={(value) =>
                                onChange({
                                    nominations: nominations.map((row) =>
                                        row.movieId === id
                                            ? {
                                                  movieId: id,
                                                  nominatorMembershipId: value || undefined,
                                              }
                                            : row,
                                    ),
                                    scoreMatrix,
                                })
                            }
                        />
                        <Button
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => removeNomination(id)}
                        >
                            Remove {titles[id]}
                        </Button>
                    </li>
                ))}
            </ul>
            {nominations.length > 0 && attendees.length > 0 ? (
                <div
                    className={styles.matrix}
                    role="region"
                    aria-label="Historical score matrix"
                    tabIndex={0}
                >
                    <table>
                        <caption>
                            Recorded Selection scores · Scale {scaleMin}–{scaleMax}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col">Attendee</th>
                                {nominations.map(({ movieId: id }) => (
                                    <th scope="col" key={id}>
                                        {titles[id]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {attendees.map((attendee) => {
                                const name =
                                    members.find((member) => member.id === attendee.membershipId)
                                        ?.displayName ?? 'Attendee';
                                return (
                                    <tr key={attendee.membershipId}>
                                        <th scope="row">{name}</th>
                                        {nominations.map(({ movieId }) => (
                                            <td key={movieId}>
                                                <select
                                                    aria-label={`Selection score for ${name}: ${titles[movieId]}`}
                                                    disabled={disabled}
                                                    value={
                                                        scoreMatrix
                                                            .find(
                                                                (row) =>
                                                                    row.membershipId ===
                                                                    attendee.membershipId,
                                                            )
                                                            ?.scores.find(
                                                                (cell) => cell.movieId === movieId,
                                                            )?.score ?? ''
                                                    }
                                                    onChange={(event) =>
                                                        setScore(
                                                            attendee.membershipId,
                                                            movieId,
                                                            event.currentTarget.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">Unknown</option>
                                                    {Array.from(
                                                        { length: scaleMax - scaleMin + 1 },
                                                        (_, index) => scaleMin + index,
                                                    ).map((score) => (
                                                        <option key={score} value={score}>
                                                            {score}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>
                    Scores are optional. Select known attendees and add nominations to record a
                    matrix.
                </p>
            )}
            <p>
                This import does not establish a complete ballot, ranking or Selection closure time.
            </p>
        </fieldset>
    );
}
