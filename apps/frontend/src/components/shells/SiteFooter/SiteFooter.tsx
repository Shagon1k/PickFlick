import { Fragment } from 'react';

import type { IShellRouteMap } from '@/components/shells/shell-navigation';
import styles from '@/components/shells/shells.module.scss';

interface ISiteFooterProps {
    routes: IShellRouteMap;
}

export default function SiteFooter({ routes }: ISiteFooterProps) {
    const footerLinks = [
        { href: routes.howItWorks, label: 'How it works' },
        { href: routes.legalPrivacy, label: 'Privacy' },
        { href: routes.legalTerms, label: 'Terms' },
        { href: routes.contact, label: 'Contact' },
    ];

    return (
        <footer className={styles.publicFooter}>
            <div className={styles.publicFooterInner}>
                <div className={styles.footerBrand}>
                    <a className={styles.footerWordmark} href={routes.home}>
                        PickFlick
                    </a>
                    <p>Pick a film. Watch together. Remember everything.</p>
                </div>
                <nav aria-label="Footer navigation">
                    {footerLinks.map((link, index) => (
                        <Fragment key={link.label}>
                            {index > 0 ? <span aria-hidden="true">·</span> : null}
                            <a href={link.href}>{link.label}</a>
                        </Fragment>
                    ))}
                </nav>
            </div>
        </footer>
    );
}
