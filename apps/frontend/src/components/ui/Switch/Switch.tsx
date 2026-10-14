import { Switch as MantineSwitch, type SwitchProps as IMantineSwitchProps } from '@mantine/core';

import type { TOmitStyling } from '#components/ui/types';

import styles from './Switch.module.scss';

export interface ISwitchProps extends TOmitStyling<IMantineSwitchProps, 'label' | 'description'> {
    label: string;
    description?: string;
}

export default function Switch(props: ISwitchProps) {
    return (
        <MantineSwitch
            {...props}
            // Mantine wraps label and description in one <label>; name the switch by its label only.
            aria-label={props.label}
            classNames={{
                body: styles.switch,
                labelWrapper: styles.switch__copy,
                label: styles.switch__label,
                description: styles.switch__description,
                input: styles.switch__input,
                track: styles.switch__track,
                thumb: styles.switch__thumb,
            }}
            unstyled
        />
    );
}
