/** The four canonical breakpoints the design is specified at. */
export const canonicalViewports = [
    { height: 844, name: 's-390', width: 390 },
    { height: 1024, name: 'm-768', width: 768 },
    { height: 768, name: 'l-1024', width: 1024 },
    { height: 900, name: 'xl-1440', width: 1440 },
] as const;

/** Widths between breakpoints, checked for overflow only. */
export const gapViewports = [
    { height: 900, name: 's-to-m-640', width: 640 },
    { height: 900, name: 'm-to-l-900', width: 900 },
    { height: 900, name: 'l-to-xl-1200', width: 1200 },
] as const;

/** Screenshot baselines are kept for the smallest and largest canonical widths only. */
export const screenshotViewports = [canonicalViewports[0], canonicalViewports[3]] as const;
