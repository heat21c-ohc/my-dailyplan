---
name: Kinetic Flow
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777e'
  outline-variant: '#c6c6ce'
  surface-tint: '#525e7f'
  primary: '#182442'
  on-primary: '#ffffff'
  primary-container: '#2e3a59'
  on-primary-container: '#98a4c9'
  inverse-primary: '#bac6ec'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#312300'
  on-tertiary: '#ffffff'
  tertiary-container: '#4a380c'
  on-tertiary-container: '#bca26c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#bac6ec'
  on-primary-fixed: '#0d1a38'
  on-primary-fixed-variant: '#3a4666'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#fddfa4'
  tertiary-fixed-dim: '#dfc38b'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#574417'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The design system is rooted in **Minimalist Productivity**. The goal is to reduce cognitive load and eliminate visual noise, allowing users to focus entirely on their tasks. The aesthetic is organized, spacious, and distraction-free, characterized by high-quality typography and a restrained use of color.

The personality is professional, efficient, and precise. It targets power users who value speed and clarity. The UI evokes a sense of calm control through balanced whitespace and a systematic layout, drawing from modern corporate design movements that prioritize utility over decoration.

## Colors

The palette is anchored by a deep indigo-charcoal (`#2E3A59`) used for primary actions and high-level navigation to provide a grounded, professional feel. A more vibrant secondary indigo (`#6366F1`) is used sparingly for focus states and interactive highlights.

The background architecture utilizes a layered light gray system (`#F8FAFC`) to differentiate the sidebar from the main canvas. Crisp borders (`#E2E8F0`) are the primary method of sectioning content, ensuring a clean "grid" feel without the weight of heavy shadows. Status colors (success, error, warning) should be desaturated to maintain the minimalist tone.

## Typography

This design system utilizes **Inter** for all roles to achieve a systematic, utilitarian aesthetic. The hierarchy is established through significant weight shifts and tight letter-spacing on larger headlines. 

- **Headlines:** Use Bold (700) or Semi-Bold (600) for section titles to create clear anchors for the eye.
- **Body:** Standardized at 14px for density without sacrificing legibility. 
- **Labels:** Use Medium (500) weights to differentiate metadata from body text. 
- **Mobile:** For screens smaller than 768px, scale `headline-lg` down to 24px to maintain readability.

## Layout & Spacing

The layout follows a **12-column fluid grid** for the main content area, while the navigation sidebar remains fixed at 280px. A strict 8px base unit governs all spatial relationships.

Dashboards should utilize "Spacious" padding (24px) between cards to prevent the UI from feeling cramped. Content reflows for mobile by collapsing the sidebar into a bottom navigation bar or a hamburger menu, and reducing horizontal margins to 16px. Use `lg` spacing to separate major functional modules (e.g., the editor from the task list).

## Elevation & Depth

Visual hierarchy is primarily achieved through **Tonal Layers** and **Low-Contrast Outlines**. 
- **Background:** The lowest layer is the page background (`#F8FAFC`).
- **Surface:** Cards and containers use a pure white background with a 1px border.
- **Interactive Depth:** Only "draggable" elements (like Kanban cards or reorderable list items) receive an **Ambient Shadow** upon interaction. The shadow should be highly diffused: `0px 4px 20px rgba(0, 0, 0, 0.05)`.
- **Modals:** Use a heavy backdrop blur (8px) rather than a dark overlay to maintain the "light and airy" feel of the system.

## Shapes

The design system uses **Soft** roundedness to maintain a professional and precise character. 
- **Standard Elements:** 4px (0.25rem) radius for buttons, inputs, and checkboxes.
- **Containers:** 8px (0.5rem) radius for dashboard cards and modal windows.
- **Selection States:** Use a vertical 2px "pill" bar on the left side of active list items to indicate focus, rather than rounding the entire background.

## Components

- **Buttons:** Primary buttons use the Charcoal background with white text. Secondary buttons are ghost-style with a 1px border. Use a "pressed" state that shifts the background color 5% darker.
- **Inputs & Editor Fields:** Use a subtle inset shadow or a 2px indigo border on focus. Place labels above the field in `label-sm` style.
- **Cards:** White background, 1px border. For productivity dashboards, cards should have a consistent header area with a "drag handle" icon visible only on hover.
- **Chips/Tags:** Small, rectangular with 2px radius. Use a light tint of the category color with high-contrast text.
- **Lists:** High-density rows (48px height) with 1px bottom dividers. Actions (delete/edit) should appear on hover to minimize visual clutter.
- **Checkboxes:** Square with a 2px radius. When checked, the box fills with the primary color and displays a crisp white checkmark.