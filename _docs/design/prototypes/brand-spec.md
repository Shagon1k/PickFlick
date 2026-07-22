# PickFlick — Projector Noir

PickFlick is a dark cinematic product with a monochrome noir foundation and a controlled projector-warm layer. The interface should still read as black cinema first, but it no longer needs to hide warm color in isolated micro-accents. One scene may carry visible amber light when that scene is the emotional and task focus.

## Core tokens

```css
:root {
  --bg:      oklch(15.43% 0.0000 0);
  --surface: oklch(20.02% 0.0000 0);
  --fg:      oklch(93.68% 0.0076 61.4);
  --muted:   oklch(58.09% 0.0071 75.4);
  --border:  oklch(28.71% 0.0070 67.5);
  --accent:  oklch(71.71% 0.1031 76.9);

  --font-display: 'Iowan Old Style', 'Charter', Georgia, 'Times New Roman', serif;
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
}
```

## Visual posture

- Build every screen on a black, graphite, white, and grey foundation. Gold is projector light, not a luxury finish.
- Allow one concentrated warm scene per screen: a current film, active session, selected poster, or another meaningful cinematic focus.
- Connect active phase, progress, contextual action, and selected navigation into one warm route. Warm color should explain the current task.
- Keep ordinary sections flat: neutral borders, no decorative glow, no gradient elevation, and no ornamental icons.
- Keep page titles, large statistics, ordinary controls, body copy, and most card borders monochrome.
- Use ivory for short warm labels; use gold for state, line, progress, rating, and a contextual interactive edge.

## Warm-density rule

Do not count isolated gold points or enforce a fixed monochrome percentage. Judge the screen by grouping:

1. One warm focal scene is allowed to be visually rich.
2. One connected warm state route may support it.
3. Everything outside those two groups returns to monochrome.

If several unrelated cards, icons, numbers, and buttons become warm at once, the design has drifted into premium-theatre or casino territory.

## Imagery

- Supporting imagery stays grayscale by default.
- The single focal image may retain restrained amber color at rest, with reduced saturation and deeper contrast.
- Hover may restore more natural color, but should not add a strong shadow, glow, and gold border at the same time.
- Never apply a global sepia filter to the product.

## Controls and surfaces

- Primary CTA remains monochrome by default.
- A gold CTA is exceptional and only belongs to the action that completes the active warm scenario.
- Selected chips and phase labels may combine ivory text, `--gold-soft` background, and `--gold-border`.
- Ordinary cards use `--surface` and `--border`; selected or active cards alone may use the warm border.
- Film-strip UI stays dark and neutral; only its selected frame becomes warm.

## Motion

- Warmth should arrive like a projector aperture opening: one calm reveal, 300–600 ms, no pulse.
- Poster hover may shift from restrained amber to fuller color in 300–400 ms.
- Do not animate gold continuously except for a genuinely urgent notification.
