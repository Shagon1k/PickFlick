'use client';

import type {
    TCreatePastSession,
    TMovieSearchResults,
    TPastSessionMembers,
} from '@pickflick/contracts';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import Select from '#components/ui/Select/Select';
import { formatMovieTitle } from '#lib/format';
import { useActionStatus } from '#lib/use-action-status';

import { buildMemberNames, formatMemberName } from '../../past-members';
import styles from './PastNominations.module.scss';

type TEvidence = Pick<TCreatePastSession, 'nominations' | 'scoreMatrix'>;

export default function PastNominations({
    evidence,
    attendees,
    members,
    titles,
    onTitlesChange,
    scaleMin,
    scaleMax,
    disabled,
    error,
    onChange,
}: {
    evidence: TEvidence;
    attendees: TCreatePastSession['attendees'];
    members: TPastSessionMembers;
    titles: Record<string, string>;
    onTitlesChange: (titles: Record<string, string>) => void;
    scaleMin: number;
    scaleMax: number;
    disabled: boolean;
    error?: React.ReactNode;
    onChange: (evidence: TEvidence) => void;
}) {
    const { message, isSuccess, setMessage, announceSuccess } = useActionStatus();
    const { nominations, scoreMatrix } = evidence;
    const isNominationLimitReached = nominations.length >= attendees.length;
    const hasTooManyNominations = nominations.length > attendees.length;
    let placeholder = 'Add a nominated Movie…';
    if (isNominationLimitReached) placeholder = 'All nomination slots filled';
    if (attendees.length === 0) placeholder = 'Choose attendees first';
    const memberNames = buildMemberNames(members);
    const scoreOptions = Array.from(
        { length: scaleMax - scaleMin + 1 },
        (_, index) => scaleMin + index,
    );
    function handleNominationPick(movie: TMovieSearchResults['movies'][number] | null) {
        if (!movie) return;
        const movieId = movie.id;
        if (isNominationLimitReached) {
            setMessage('Select more attendees in "Who came?" to add another nomination.');
            return;
        }
        if (nominations.some((row) => row.movieId === movieId)) {
            setMessage('This Movie is already in the nomination list.');
            return;
        }
        onTitlesChange({
            ...titles,
            [movieId]: formatMovieTitle(movie),
        });
        onChange({ nominations: [...nominations, { movieId }], scoreMatrix });
        announceSuccess('Nomination added.');
    }
    function setNominator(movieId: string, nominatorMembershipId: string) {
        onChange({
            nominations: nominations.map((row) =>
                row.movieId === movieId
                    ? { movieId, nominatorMembershipId: nominatorMembershipId || undefined }
                    : row,
            ),
            scoreMatrix,
        });
    }
    function getScore(membershipId: string, movieId: string) {
        const scores = scoreMatrix.find((row) => row.membershipId === membershipId)?.scores;
        return scores?.find((cell) => cell.movieId === movieId)?.score ?? '';
    }
    function removeNomination(movieId: string) {
        onChange({
            nominations: nominations.filter((row) => row.movieId !== movieId),
            scoreMatrix: scoreMatrix.map((row) => ({
                ...row,
                scores: row.scores.filter((cell) => cell.movieId !== movieId),
            })),
        });
        announceSuccess('Nomination and its recorded scores removed.');
        requestAnimationFrame(() => {
            const picker = document.getElementById('past-nomination');
            if (picker?.matches(':disabled'))
                document.querySelector<HTMLElement>('[data-step-heading]')?.focus();
            else picker?.focus();
        });
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
    // Each member nominates one Movie, so a chosen nominator leaves the other lists.
    const takenNominators = new Set(nominations.flatMap((row) => row.nominatorMembershipId ?? []));
    return (
        <fieldset className={styles.evidence} disabled={disabled}>
            <legend className={styles.title} data-step-heading tabIndex={-1}>
                What else was nominated?
            </legend>
            <MoviePicker
                id="past-nomination"
                label={`Nominated films · ${nominations.length}/${attendees.length}`}
                required={false}
                shouldReserveMessage={false}
                placeholder={placeholder}
                value={null}
                disabled={disabled || isNominationLimitReached}
                error={
                    hasTooManyNominations
                        ? 'Remove extra nominations or select more attendees in "Who came?".'
                        : error
                }
                onChange={handleNominationPick}
            />
            <p className={isSuccess ? 'visually-hidden' : undefined} role="status">
                {message}
            </p>
            <ul className={styles.movies} aria-label="Imported nominations">
                {nominations.map(({ movieId: id, nominatorMembershipId }) => (
                    <li key={id}>
                        <span>{titles[id]}</span>
                        <Select
                            id={`nominator-${id}`}
                            label={`Nominated by · ${titles[id]}`}
                            isLabelHidden
                            shouldReserveMessage={false}
                            value={nominatorMembershipId ?? ''}
                            disabled={disabled}
                            data={[
                                { value: '', label: '—' },
                                ...members
                                    .filter(
                                        (member) =>
                                            member.id === nominatorMembershipId ||
                                            !takenNominators.has(member.id),
                                    )
                                    .map((member) => ({
                                        value: member.id,
                                        label: formatMemberName(member),
                                    })),
                            ]}
                            onChange={(value) => setNominator(id, value ?? '')}
                        />
                        <Button
                            aria-label={`Remove ${titles[id]}`}
                            title={`Remove ${titles[id]}`}
                            disabled={disabled}
                            onClick={() => removeNomination(id)}
                            size="icon"
                            variant="subtle"
                        >
                            <Icon name="close" />
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
                                const name = memberNames.get(attendee.membershipId) ?? 'Attendee';
                                return (
                                    <tr key={attendee.membershipId}>
                                        <th scope="row">{name}</th>
                                        {nominations.map(({ movieId }) => (
                                            <td key={movieId}>
                                                <span className={styles.score}>
                                                    <select
                                                        aria-label={`Selection score for ${name}: ${titles[movieId]}`}
                                                        disabled={disabled}
                                                        value={getScore(
                                                            attendee.membershipId,
                                                            movieId,
                                                        )}
                                                        onChange={(event) =>
                                                            setScore(
                                                                attendee.membershipId,
                                                                movieId,
                                                                event.currentTarget.value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">—</option>
                                                        {scoreOptions.map((score) => (
                                                            <option key={score} value={score}>
                                                                {score}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Icon name="chevron-down" />
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </fieldset>
    );
}
