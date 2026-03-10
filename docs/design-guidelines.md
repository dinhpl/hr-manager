# Design Guidelines

## 1. Current visual language

- Primary brand color: jade green `#1DB87A`.
- Secondary/dark accent: eagle green `#0E474E`.
- Light accent: aero blue `#D3F2E7`.
- Main neutral background: cultured `#F7F7F7`.
- Main text color: medium jungle `#203430`.

These tokens are defined in `app/globals.css` and should stay the default design language unless the product is intentionally rebranded.

## 2. Typography

- Primary font: `Public Sans` via `next/font/google` in `app/layout.tsx`.
- Tone: clean enterprise dashboard UI with moderate softness.
- Font weight usage in current app:
  - `400` body
  - `500` supporting labels
  - `600` section headings
  - `700` key titles and action emphasis

## 3. Layout principles

- Dashboard uses left sidebar + top header + scrollable content region.
- Cards are rounded, light, and lightly bordered.
- Important actions often use green solid buttons.
- Secondary actions often use bordered white buttons.
- Pages favor dense business dashboards over marketing-style whitespace.

## 4. Component guidelines

### Reuse first

- Use `components/ui/*` for low-level UI primitives.
- Use shared domain components when a flow already exists:
  - `components/leave-request-modal.tsx`
  - `components/leave-detail-modal.tsx`
  - `components/calendar-day-detail-modal.tsx`
  - `components/confirm-dialog.tsx`

### Inputs

- Date/time UX should reuse shared helpers/components and align with Vietnam timezone assumptions.
- Form validation messages should be direct and operational, not generic.

### Tables and dashboards

- Use simple high-density table layouts for approval, employees, leave history, and reports.
- Keep filters near the table header and actions near the relevant data region.

## 5. Motion and interaction

- Existing app includes lightweight fade-in and stagger classes in `app/globals.css`.
- Motion should remain subtle and utility-first.
- Respect reduced-motion media query behavior already present in global CSS.

## 6. Responsive guidance

- Mobile sidebar uses overlay pattern in `components/app-layout.tsx`.
- Header and card layouts should degrade to stacked layout on narrow widths.
- Complex tables may stay horizontally scrollable, but primary actions must remain reachable on mobile.

## 7. Notification UX

- Notifications live in top-right header bell dropdown.
- Realtime events may trigger toast banners.
- Deep-link behavior should route user to the related entity page when possible.

## 8. Accessibility guidance

- Preserve visible focus treatment; repo already defines `.focus-ring` and ring tokens.
- Icon-only buttons need `aria-label`.
- Avoid color-only status meaning when adding new badges or approval indicators.

## 9. Consistency rules for future UI work

- Do not introduce unrelated palettes or dark themes without product-level reason.
- Keep page actions aligned with role permissions already shown in navigation and page affordances.
- Prefer extending current admin/dashboard language over mixing in a separate visual system.
