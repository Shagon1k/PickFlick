import { ColorSchemeScript } from '@mantine/core';

// Projector Noir is dark only, so the scheme is forced before hydration.
export default function ThemeScript() {
    return <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" />;
}
