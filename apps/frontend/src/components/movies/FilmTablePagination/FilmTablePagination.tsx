import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';

import styles from './FilmTablePagination.module.scss';

/** Previous and Next page links under a film table; with scripts, the table pages in place. */
export default function FilmTablePagination({
    label,
    page,
    pages,
    disabled,
    getHref,
    onNavigate,
}: {
    label: string;
    page: number;
    pages: number;
    disabled: boolean;
    getHref: (page: number) => string;
    onNavigate: (page: number) => void;
}) {
    const link = (target: number, isNext: boolean) => (
        <ButtonLink
            aria-label={isNext ? 'Next page' : 'Previous page'}
            variant="navigation"
            data-direction={isNext ? 'next' : undefined}
            href={getHref(target)}
            onNavigate={(event) => {
                event.preventDefault();
                onNavigate(target);
            }}
            disabled={disabled || target < 1 || target > pages}
        >
            <Icon name="arrow-left" />
        </ButtonLink>
    );
    return (
        <nav aria-label={label} className={styles.pagination}>
            {link(page - 1, false)}
            <span>
                Page {page} of {pages}
            </span>
            {link(page + 1, true)}
        </nav>
    );
}
