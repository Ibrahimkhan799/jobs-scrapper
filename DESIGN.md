---
name: Job Hunter
description: Quiet classifieds desk for local job matching and approved sending
colors:
  newsprint: "#e8e9e6"
  ink: "#1c1e1c"
  paper: "#f3f3f0"
  rule: "#c3c6c1"
  mute: "#4a4e4a"
  score: "#3d5c47"
  danger: "#8a3d36"
  night: "#161716"
  night-ink: "#e6e7e3"
  night-score: "#8aa890"
typography:
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.018em"
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  nameplate:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  caption:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  micro:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.04em"
  editor:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  row: "10px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.score}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  select-trigger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "32px"
---

# DESIGN.md

## Overview

Job Hunter is a private classifieds desk: ranked listings, a match-score gutter, and a letter you approve before it leaves. Color is almost entirely ink on newsprint. Oxidized green marks scores and the send action. Native `<select>` is banned; dropdowns are the custom listbox.

Seed `04305ad8`, grounded candidate 7 (classifieds columns), raised by Japanese density (packed rows), cloud-edge (achromatic field), and split-flap (ranked rows that do not rearrange columns).

## Colors

Light is cool newsprint `#e8e9e6` with ink `#1c1e1c`. Dark is a dim desk `#161716`. Score green is the only chromatic token. Do not introduce blue, purple, or saturated red.

## Typography

One grotesk: Archivo at 400/500/600. Headings are 500, not 700. Body 14px, nameplate 15px, captions 11px, demo labels 10px, email editor 13px. Tabular numerals on scores and counts. No display serif.

## Layout

Text navigation, not icon rails. First viewport is a one-line status strip plus a classifieds list. Match score sits in a left gutter. Filters sit in a dense six-column row. Mobile collapses nav to a horizontal text strip.

## Elevation & Depth

Hairlines, not cards. One offset shadow on open menus and notification panels: `0 8px 24px -12px`. No glass, no glow.

## Shapes

Square corners. Pills and 16px cards are out of this world.

## Components

- **Select:** button + listbox, hidden input for forms, keyboard arrows/Enter/Escape, click-outside close.
- **ScoreBadge:** tabular number, green only at 80+.
- **StatusStrip:** inline counts separated by middots, never a metric-card grid.
- **Buttons:** 32px, ink fill for primary, hairline outline otherwise.

## Do's and Don'ts

Do keep sending visually protected (Approve / Approve & Send).
Do label Demo listings.
Don't scrape LinkedIn or Indeed in copy or UI.
Don't treat Match Score as a hire probability.
Don't use native `<select>`.
Don't restore the seven metric cards.
