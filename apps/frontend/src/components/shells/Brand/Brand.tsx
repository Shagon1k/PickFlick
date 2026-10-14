import Link from 'next/link';

import styles from '#components/shells/shells.module.scss';
import BrandImage from '#components/ui/BrandImage/BrandImage';

interface IBrandProps {
    href?: string;
}

export default function Brand({ href = '/' }: IBrandProps) {
    return (
        <Link aria-label="PickFlick home" className={styles.brand} href={href}>
            <BrandImage alt="" asset="logo" loading="eager" />
            <span>PickFlick</span>
        </Link>
    );
}
