---
name: VerificaAI (Editorial Broadsheet)
description: Sistema acadêmico-jornalístico de verificação de fatos com estética de jornal impresso e arquivo de alta precisão.
colors:
  primary: "#29316B"
  primary-hover: "#1B224B"
  blue-50: "#F3F4FC"
  blue-100: "#E3E6F7"
  blue-200: "#C5CAED"
  blue-300: "#9FA7DF"
  blue-400: "#7781CF"
  blue-500: "#6371D6"
  blue-600: "#4F5EBA"
  blue-700: "#303A82"
  blue-800: "#29316B"
  blue-900: "#1B224B"
  blue-950: "#131839"
  paper: "#F6F7FB"
  paper-subtle: "#EDEFF7"
  paper-card: "#FFFFFF"
  ink: "#121628"
  ink-muted: "#555B75"
  ink-light: "#6B718B"
  border-ink: "#D7DAE7"
  border-dark: "#29316B"
  header-dark: "#1B224B"
  verdict-true: "#0B5D4E"
  verdict-false: "#9E1B32"
  verdict-partial: "#855300"
  verdict-neutral: "#303A82"
typography:
  display:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.2rem, 5vw, 3.8rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Source Serif Pro, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.85rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: VerificaAI (Editorial Broadsheet)

## Overview

**Creative North Star: "The Investigative Gazette & Archival Ledger"**

VerificaAI rejects all generic AI aesthetics in favor of a timeless, authoritative journalistic broadsheet aesthetic. Designed for researchers, investigators, and discerning readers, the interface mimics the sober dignity of printed academic journals and newspaper front pages. 

The visual system is built on a cool archival paper ground (`#F6F7FB`), deep indigo typography and masthead (`#29316B`), crisp hairline borders (`#D7DAE7`), and strict serif headings paired with highly legible body text and monospace data points. There are no decorative gradients, no floating glowing cards, and no excessive rounded corners. Every element serves data clarity and evidentiary proof.

**Key Characteristics:**
- Deep indigo masthead with a transparent light-on-dark brand mark and high-contrast navigation.
- Cool paper surfaces with blue-black ink for long-form reading.
- Authoritative serif typography (Newsreader / Georgia / Source Serif Pro).
- Precise hairline borders, sharp corners (2px - 4px radius), and structured grid tables.
- Semantic editorial badges (crimson for false, amber for partial, teal-green for verified, indigo-gray for inconclusive).

## Colors

The palette is anchored on the VerificaAI indigo `#29316B`, supported by a 50-900 tonal scale and a cool neutral surface ramp. All theme switching happens through semantic CSS custom properties in `styleglobal.css`.

### Primary Indigo
- **VerificaAI Indigo** (#29316B): Primary brand color, header, primary buttons, and strong borders in light mode (`--color-primary`).
- **Deep Indigo** (#1B224B): Hover states in light mode and header background in dark mode (`--color-primary-hover` / `--color-header-bg`).
- **Focus Indigo** (#4F5EBA): Input borders, dark-mode buttons, and focus accents (`--color-input-border` / `--color-btn-bg`).
- **Vivid Periwinkle** (#6371D6): Dark-mode primary accents, focus borders, and active controls (`--color-primary` in dark mode).
- **Soft Indigo** (#E3E6F7 / #F3F4FC): Secondary surfaces, hover fills, and subtle highlights.

### Paper Backgrounds
- **Cool Paper** (#F6F7FB): Root background surface (`--paper`).
- **Cool Subtle** (#EDEFF7): Secondary surfaces and alternating rows (`--paper-subtle`).
- **Card White** (#FFFFFF): Cards, inputs, and modal surfaces (`--paper-card`).

### Borders
- **Hairline Rule** (#D7DAE7): Structural dividers, card outlines, and grid lines (`--border-ink`).
- **Strong Indigo Border** (#29316B): High-emphasis containers and inputs in light mode (`--border-dark`).

### Semantic Verdict Colors
- **Verified Teal** (#0B5D4E on #DFF3ED): Factual / veridical status (70-100%).
- **Crimson** (#9E1B32 on #FCE6E9): False / invention status (0-29%).
- **Amber** (#855300 on #FCF0D9): Partially true status (30-69%).
- **Indigo Gray** (#303A82 on #E9ECF9): Inconclusive / no sources found.

Dark mode uses luminous variants of the same verdict hues (teal `#6FE0C8`, crimson `#FF9DAA`, amber `#F2C879`, periwinkle `#B3BCF2`) on deep tinted backgrounds.

## Typography

**Display Font:** Newsreader / Georgia (Serif)
**Body Font:** Source Serif Pro / Georgia (Serif)
**Data / Mono Font:** IBM Plex Mono (Monospace)

**Character:** Scholarly, rigorous, and commanding. Serif headlines command immediate attention, while monospace figures provide unambiguous data precision.

### Hierarchy
- **Display** (600 weight, clamp(2.2rem, 5vw, 3.8rem), 1.15 line-height): Main article headers and section titles.
- **Headline** (600 weight, 20px-24px, 1.3 line-height): Card titles and modal headers.
- **Body** (400 weight, 16px, 1.65 line-height): Analysis, summaries, and journalistic reports.
- **Mono / Label** (500 weight, 12px-13px, uppercase): Metadata, confidence scores, and timestamps.

## Layout

Constructed with traditional newspaper column grids, generous white space margins, and clean horizontal rules (`<hr>` equivalents) to separate editorial sections. Containers feature sharp 2px-4px rounded corners and solid 1px hairline borders rather than drop shadows.

## Elevation & Depth

Completely flat and archival by design. Depth is communicated strictly through tonal contrast between the cool paper ground (`#F6F7FB`) and container cards (`#FFFFFF`), separated by crisp 1px borders (`#D7DAE7`). In dark mode, depth comes from `#0F1224` surfaces, `#14182E` cards, and `#2C3252` hairlines. No glowing borders, no floating drop shadows.

## Shapes

Sharp, precise, architectural:
- **Radii:** 2px (`--radius-sm`) to 4px (`--radius-md`). No pill buttons unless specified as archival tags.

## Components

### Header
- **Background:** Deep indigo (`#29316B` light / `#1B224B` dark).
- **Brand:** Transparent `Logo_header.png` with a white wordmark and periwinkle detective, preserving legibility without a background plate.
- **Navigation:** White/muted links; active item is a white pill with indigo text.
- **Mobile:** Desktop nav collapses into the drawer; the drawer carries all routes, the API key action, and the theme switch.

### Buttons
- **Shape:** Sharp rectangle (2px radius)
- **Primary:** Solid indigo (`#29316B` light / `#4F5EBA` dark), white text, uppercase mono label or icon.
- **Hover:** Deep indigo (`#1B224B` light / `#5B69C7` dark).
- **Icon-only action:** The verification button uses a 56px square target and `aria-label="Verificar notícia"`.

### Cards / Containers
- **Corner Style:** 4px radius
- **Background:** Card white (`#FFFFFF` light / `#14182E` dark)
- **Border:** 1px solid hairline (`#D7DAE7` / `#2C3252`); high-emphasis cards use a 2px indigo border.
- **Internal Padding:** 24px

### Inputs / Fields
- **Style:** Card background with a 2px indigo border (`--color-input-border`), 2px radius, monospace or serif text.
- **Focus:** Border changes to `--color-input-focus` plus a 3px soft ring (`--color-input-focus-ring`).
- **Placeholder:** `--color-input-placeholder`, tested at ≥4.5:1 on card surfaces.

## Do's and Don'ts

### Do:
- **Do** maintain strict high contrast (blue-black ink on cool paper; white on deep indigo).
- **Do** use the semantic tokens instead of hard-coded hex values in components.
- **Do** use precise serif typography for titles and headings.
- **Do** preserve the 50-900 indigo scale for tints, borders, and dark-mode accents.
- **Do** keep focus states visible and icon-only controls labeled.

### Don't:
- **Don't** use decorative blue/purple gradients, neon accents, or glassmorphism.
- **Don't** use exaggerated rounded corners (e.g., 16px+ radius).
- **Don't** use sans-serif system fonts for headings.
- **Don't** change component rules per theme; override tokens under `[data-theme="dark"]` only.
