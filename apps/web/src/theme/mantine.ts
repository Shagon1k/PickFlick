import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Mantine needs real hex values to compute states; index 5 is --gold in tokens.scss.
const projectorGold: MantineColorsTuple = [
    '#fff8ed',
    '#f5e6cf',
    '#ebd3ae',
    '#e0bc85',
    '#d5aa68',
    '#c89b55',
    '#ae7f3f',
    '#8a6330',
    '#64451f',
    '#3d2913',
];

export const theme = createTheme({
    colors: { projectorGold },
    primaryColor: 'projectorGold',
    cursorType: 'pointer',
    defaultRadius: 'md',
    fontFamily: 'var(--font-body)',
    headings: { fontFamily: 'var(--font-display)' },
    respectReducedMotion: true,
});
