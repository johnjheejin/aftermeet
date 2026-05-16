# aftermeet · DESIGN.md

> The meet doesn't end after the meet.

A persistent networking surface for in-person events. Calm, precise, and quietly emotional — the feeling of a connection that doesn't disappear when the lights go down.

## Mood

- **Editorial × technical.** Linear's precision meets Superhuman's keyboard-first warmth.
- **Persistent, not loud.** Subtle violet glow, never neon. Things settle into place.
- **Human-centered.** People-cards are the protagonists; chrome recedes.

## Color System

```
--bg          #07070C    /* near-black with a hint of violet */
--bg-elev     #0F0F1A    /* card surfaces */
--bg-elev-2   #1A1A2E    /* hover / nested */
--border      rgba(255,255,255,0.08)
--border-hi   rgba(167,139,250,0.4)   /* violet-300 @ 40 */

--text        #F5F5F7    /* warm white */
--text-muted  #A1A1AA    /* zinc-400 */
--text-dim    #52525B    /* zinc-600 */

--accent      #A78BFA    /* violet-400 — primary */
--accent-hi   #C4B5FD    /* violet-300 — hover */
--accent-low  #4C1D95    /* violet-900 — backgrounds */
--accent-glow rgba(139,92,246,0.35)

--success     #34D399
--danger      #F87171
```

**Background**: not flat black. Always a soft radial-gradient from `#1E1B4B` at top-left fading to `#000` bottom-right. Calm cosmic.

## Typography

- **Display / Headings**: `-apple-system, "Inter", system-ui` with `font-weight: 800`, `letter-spacing: -0.04em`. Big. Confident.
- **Body**: same family, `font-weight: 400`, `line-height: 1.6`.
- **Eyebrow / labels**: `font-size: 11px`, `letter-spacing: 0.18em`, `text-transform: uppercase`, color `--accent-hi`.
- **Monospace accents**: `ui-monospace, "JetBrains Mono"` for URLs, codes, keyboard hints.

**Scale**:
- Hero display: `clamp(48px, 8vw, 96px)`
- Page heading: `clamp(32px, 4vw, 56px)`
- Section heading: `24px`
- Body: `16px`
- Small: `13px`
- Eyebrow: `11px`

## Surfaces

**Cards**:
- Background: `--bg-elev` with `backdrop-filter: blur(20px)`
- Border: `1px solid --border`
- Radius: `16px` (cards), `999px` (pills/CTAs)
- Hover: border becomes `--border-hi`, slight `translateY(-2px)`, subtle violet glow on edge

**Buttons**:
- **Primary**: violet fill, white text, full radius pill, `padding: 14px 28px`. On hover: lighten + tiny lift + glow ring.
- **Ghost**: `rgba(255,255,255,0.06)` background, white text, same shape.
- **Link**: underline only, no chrome.

## Motion

- **Easing**: `cubic-bezier(0.2, 0.8, 0.2, 1)` — Linear-ish out-quart
- **Duration**: 250–400ms for UI; 600ms for page-level reveals
- **Entrance**: fade + 8px rise, staggered children by 80ms
- **Hover**: 200ms; cards lift 2px and brighten border
- **Never**: bouncy / spring / cartoonish

## Components

### Eyebrow
```
PERSISTENT  ·  STARTED IN SEOUL  ·  v0.1
```
11px, uppercase, letter-spaced, violet-300.

### Person Card
A profile in the participant grid is the most important element. Big avatar (or letter avatar with violet-500/30), name in semibold, role/title in muted small, optional one-line "what I'm working on" note in violet-300. Platform indicator (LinkedIn/X/GitHub) sits as a small monospace tag at the bottom-left. Whole card is a link. Hover: border violet, lift, glow.

### QR Hero (big-screen mode)
The QR is the protagonist. Pure white card, generous padding (`p-10`), `rounded-3xl`, soft shadow + violet glow ring. Below: eyebrow ("📱 SCAN TO JOIN") + monospace URL. To one side: "🟢 N connected" pill that pulses gently.

### Eventbar
At top of `/e/[slug]`: title (huge), description (1-line muted), then a horizontal row of meta chips: location, date, participant count, "original event ↗" link. Chips are 13px, muted, with subtle dividers.

## Voice & Copy

- **Direct, not hyped.** "Paste a link." not "Effortlessly create your event!"
- **Warm but technical.** "We auto-fill the rest." not "Magic ✨"
- **Time-aware.** "The meet doesn't end after the meet." "1 year from now, this page is still here."
- **Quiet jokes.** "Built at a hackathon, with caffeine." OK. "🚀 DISRUPT NETWORKING!!!" not OK.

## Anti-patterns

- ❌ Rainbow gradients, blur-glass overload, marketing-speak emojis in headings
- ❌ Hover effects that scale > 1.05 (feels cartoonish)
- ❌ Drop shadows below cards (we use glow instead)
- ❌ More than one accent color visible at a time

## Inspiration credits

- **Linear** — typography, spacing, sense of precision
- **Superhuman** — violet glow, keyboard-first, calm dark UI
- **Vercel** — black canvas + monospace accents
- **DESIGN.md spec** — VoltAgent/awesome-design-md
