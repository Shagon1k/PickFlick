'use client';

import { Avatar as MantineAvatar } from '@mantine/core';
import clsx from 'clsx';

import ColorReveal from '#components/ui/ColorReveal/ColorReveal';

import styles from './Avatar.module.scss';

export default function Avatar({
    name,
    src,
    size = 'medium',
    withColorReveal = true,
}: {
    name: string;
    src: string | null;
    size?: 'small' | 'medium' | 'large' | 'extra-large';
    withColorReveal?: boolean;
}) {
    const avatar = (
        <MantineAvatar
            alt=""
            aria-hidden="true"
            component="span"
            data-hover-color={!withColorReveal || undefined}
            name={name}
            src={src}
            imageProps={{ loading: 'lazy', decoding: 'async' }}
            classNames={{
                root: clsx(styles.avatar, styles[`m-${size}`]),
                image: styles.avatar__image,
                placeholder: styles.avatar__placeholder,
            }}
            unstyled
        />
    );
    return src && withColorReveal ? <ColorReveal>{avatar}</ColorReveal> : avatar;
}
