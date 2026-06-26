# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

- Háblale al usuario **en español**. Todo el código, comentarios, nombres y contenido del proyecto van **en inglés**.
- Respuestas con ritmo conversacional: concisas, claras y puntuales, sin verbosidad.
- Descompón cada tarea en pasos pequeños y resuélvelos uno por uno.

## Project

"Hot Rod Rigs" is a build of the **MarketPro** multi-vendor e-commerce marketplace template (internal package name `market_pro`). It is a presentation/UI template: all product, vendor, and pricing data is hardcoded in components — there is no backend, API layer, database, or auth.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm start        # serve production build
npm run lint     # next lint
```

There is no test suite or test runner configured.

## Architecture

**Stack:** Next.js 15 (App Router) + React 18, plain JavaScript (`.jsx`, no TypeScript). `reactStrictMode` is off ([next.config.js](next.config.js)). Path alias `@/*` → `./src/*` ([jsconfig.json](jsconfig.json)).

**Styling is jQuery + Bootstrap based, not Tailwind.** Heavy reliance on classic jQuery plugins: `bootstrap` (bundle JS), `select2`, `slick`/`react-slick`, `isotope-layout`, `wowjs`, `jquery-ui`. When building UI, follow Bootstrap 5 grid/utility conventions and the existing SCSS utility classes — do not introduce Tailwind or CSS modules.

### Page composition pattern
Routes live in [src/app/](src/app/) (App Router, one `page.jsx` per folder). Each page is a thin composition that imports section components from [src/components/](src/components/) and renders them in order. See [src/app/page.jsx](src/app/page.jsx) for the canonical example. Business/markup logic lives in the components, not the pages.

### Three theme variants
The template ships three home-page designs, and components are suffixed accordingly:
- `*One` (e.g. `HeaderOne`, `BannerOne`) → home page ([src/app/page.jsx](src/app/page.jsx))
- `*Two` → [src/app/index-two/](src/app/index-two/)
- `*Three` → [src/app/index-three/](src/app/index-three/)

Theme color is switched at runtime by [ColorInit](src/helper/ColorInit.jsx), which toggles the `color-two` class on `<html>`. Pages pass `<ColorInit color={true|false} />`; the alternate palette is defined in `public/assets/sass/partials/home-two/_color-two.scss`. `ScrollToTopInit` and other init helpers also take a per-page `color` prop.

### Client-side plugin initialization
Browser-only libraries cannot run during SSR. They are initialized inside `"use client"` helper components in [src/helper/](src/helper/) that `require(...)` the lib inside a `useEffect` guarded by `typeof window !== "undefined"`:
- [BootstrapInit.js](src/helper/BootstrapInit.js) — Bootstrap bundle + select2 (mounted globally in [layout.jsx](src/app/layout.jsx))
- `PhosphorIconInit`, `RouteScrollToTop` — also global in the root layout
- `Preloader`, `ScrollToTopInit`, `ColorInit`, `Animation`, `Countdown`, `QuantityControl` — mounted per page/component as needed

Most interactive components are marked `"use client"` because they use jQuery (`select2()`), `usePathname`, or local state. When adding interactivity, mark the component `"use client"` and guard any direct DOM/jQuery access the same way.

### Styles
- Global SCSS entry: [src/app/globals.scss](src/app/globals.scss), which imports vendor CSS from `public/assets/css/` and then the SCSS system.
- The SCSS system is in [public/assets/sass/](public/assets/sass/), organized by `abstracts/` (variables, mixins, functions), `components/`, `layout/`, `partials/` (per-page-section styles split by theme: `home/`, `home-two/`, `homeThree/`, `othersPage/`), and `utilities/`. Build (compiled by Next via `sass`) flows from `main.scss`.
- Fonts via [src/app/font.css](src/app/font.css). Images and vendor assets live under [public/assets/](public/assets/).
