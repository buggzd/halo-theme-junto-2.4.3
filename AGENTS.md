# Repository Guidelines

## Project Structure & Module Organization

This repository is a Halo 2.x theme derived from Sakura and styled as Junto Blue Archive. TypeScript entry points and browser behavior live in `src/`; page-specific code is under `src/page/`, reusable modules under `src/module/`, and styles under `src/css/`. Thymeleaf views live in `templates/`; custom pages follow `page_*.html`, while reusable fragments belong in `templates/macro/` or `templates/module/`. Generated bundles are committed under `templates/assets/dist/` but must not be edited by hand. Theme metadata and administrator options are defined in `theme.yaml` and `settings.yaml`. Reference material belongs in `docs/`.

## Build, Test, and Development Commands

- `pnpm install` installs the pinned pnpm dependencies.
- `pnpm dev` runs Vite in development watch mode; it rebuilds assets but does not start Halo.
- `pnpm build` runs TypeScript checks and creates production bundles in `templates/assets/dist/`.
- `pnpm prettier` formats source and template files in place.
- `pnpm exec prettier --check "src/**/*.{js,ts,css,json,yaml,html}" "templates/**/*.html"` checks formatting without rewriting files.

`pnpm lint` is defined but currently lacks a declared ESLint installation/configuration; do not use it as a required gate until that setup is restored.

## Coding Style & Naming Conventions

Prettier is authoritative: two-space indentation, LF endings, and a 120-character print width. Use `camelCase` for TypeScript functions and variables, `PascalCase` for classes, and kebab-case for CSS classes. Namespace new theme selectors with `junto-` to avoid collisions with inherited Sakura styles. Keep page scripts named after their route, for example `src/page/moments.ts`. Preserve Thymeleaf expressions when formatting templates.

## Testing Guidelines

There is no automated test suite or coverage target. Every change must pass `pnpm build`. Manually verify the affected route on Halo 2.20.14, including desktop and mobile widths, light/dark modes, PJAX navigation, and interactive hover or pointer states. Include regression checks for the homepage header when shared styles change.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style: `feat:`, `fix:`, `refactor:`, or `build:` followed by a concise imperative summary. Keep generated assets in the same commit as their source changes. Pull requests should explain user-visible behavior, list tested routes and commands, link relevant issues, and include before/after screenshots for layout or animation changes. Update `VITE_THEME_VERSION` in `.env` only when preparing a release build.
