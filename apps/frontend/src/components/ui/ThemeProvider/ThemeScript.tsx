import { ColorSchemeScript } from '@mantine/core';

interface IThemeScriptProps {
    nonce?: string;
}

// Projector Noir is dark only, so the scheme is forced before hydration. The inline script needs
// the request's CSP nonce to run. The server already renders the attribute, but removing the
// script changed when streamed Hub content is revealed (UI tests caught duplicate content).
export default function ThemeScript({ nonce }: IThemeScriptProps) {
    return <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" nonce={nonce} />;
}
