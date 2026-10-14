import { ImageResponse } from 'next/og';
import type { CSSProperties } from 'react';

export const alt = 'PickFlick — choose a film together';
export const contentType = 'image/png';
export const size = { height: 630, width: 1200 };

const CANVAS_STYLE: CSSProperties = {
    alignItems: 'center',
    background: '#0c0c0c',
    color: '#f2eee8',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
};
const SPOTLIGHT_STYLE: CSSProperties = {
    background: 'radial-gradient(circle, rgba(200,155,85,.24), rgba(12,12,12,0) 68%)',
    display: 'flex',
    height: 780,
    left: 210,
    position: 'absolute',
    top: -230,
    width: 780,
};
const FRAME_STYLE: CSSProperties = {
    border: '2px solid #393633',
    display: 'flex',
    height: 470,
    left: 64,
    position: 'absolute',
    top: 80,
    width: 1072,
};
const STACK_STYLE: CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
};
const EYEBROW_STYLE: CSSProperties = {
    color: '#c89b55',
    display: 'flex',
    fontSize: 24,
    letterSpacing: 8,
};
const TITLE_STYLE: CSSProperties = {
    display: 'flex',
    fontFamily: 'Georgia',
    fontSize: 116,
    marginTop: 28,
};
const TAGLINE_STYLE: CSSProperties = {
    color: '#a6a19c',
    display: 'flex',
    fontSize: 34,
    marginTop: 22,
};

export default function OpenGraphImage() {
    return new ImageResponse(
        <div style={CANVAS_STYLE}>
            <div style={SPOTLIGHT_STYLE} />
            <div style={FRAME_STYLE} />
            <div style={STACK_STYLE}>
                <div style={EYEBROW_STYLE}>TONIGHT&apos;S FEATURE</div>
                <div style={TITLE_STYLE}>PickFlick</div>
                <div style={TAGLINE_STYLE}>Pick a film. Watch together. Remember everything.</div>
            </div>
        </div>,
        size,
    );
}
