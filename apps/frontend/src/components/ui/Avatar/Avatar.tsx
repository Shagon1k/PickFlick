'use client';

import { Avatar as MantineAvatar } from '@mantine/core';
import clsx from 'clsx';

import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './Avatar.module.scss';

export default function Avatar({
    name,
    src,
    size = 'medium',
    withColorReveal = true,
    isLoading = false,
}: {
    name: string;
    src: string | null;
    size?: 'small' | 'medium' | 'large' | 'extra-large';
    withColorReveal?: boolean;
    isLoading?: boolean;
}) {
    const avatar = (
        <MantineAvatar
            alt=""
            aria-hidden="true"
            component="span"
            data-without-reveal={!withColorReveal || undefined}
            name={name}
            src={isLoading ? null : src}
            imageProps={{ loading: 'lazy', decoding: 'async' }}
            classNames={{
                root: clsx(styles.avatar, styles[`m-${size}`]),
                image: styles.avatar__image,
                placeholder: styles.avatar__placeholder,
            }}
            unstyled
        >
            {isLoading ? <Skeleton shouldFill /> : null}
        </MantineAvatar>
    );
    return src && withColorReveal && !isLoading ? <ColorReveal>{avatar}</ColorReveal> : avatar;
}
