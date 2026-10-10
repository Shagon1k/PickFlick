import type { TMovieDetails } from '@pickflick/contracts';

import styles from '../../page.module.scss';

interface IMovieCreditsProps {
    movie: TMovieDetails;
}

export default function MovieCredits({ movie }: IMovieCreditsProps) {
    return (
        <section className={styles.credits} aria-labelledby="credits-title">
            <h2 id="credits-title">Credits</h2>
            <dl>
                <dt>Director</dt>
                <dd>
                    {movie.directors?.length
                        ? movie.directors.map(({ name }) => name).join(', ')
                        : 'Unavailable'}
                </dd>
                <dt>Cast</dt>
                <dd>
                    {movie.cast?.length ? (
                        <ul>
                            {movie.cast.map((person, index) => (
                                <li key={`${person.name}-${index}`}>
                                    {person.name}
                                    {person.character ? ` — ${person.character}` : ''}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        'Unavailable'
                    )}
                </dd>
            </dl>
        </section>
    );
}
