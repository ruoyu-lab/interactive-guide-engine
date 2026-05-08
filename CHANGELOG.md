# Changelog

All notable changes to this package will be documented in this file.

The project follows Semantic Versioning. While the package is in `0.x`, minor
versions may include API-breaking changes; patch versions are reserved for
backward-compatible fixes.

## Unreleased

### Added

- Added pluggable condition handlers so DOM operations can be replaced or extended.
- Added the `dom-adapter` package entry with handlers for click, input, change, focus, blur, submit, hover, keyboard, visible, exists, url, route, drag, and drop conditions.
- Added `pause()`, `resume()`, `setSteps()`, `allOf`, `anyOf`, `custom` conditions, and step lifecycle callbacks.
- Added independent API documentation under `docs/api`.
- Added a real drag-and-drop step to the Vue demo and smoke flow.
- Updated the demo input step to require exact text or advance on blur.
- Added generic tutorial context typing, step `showIf` / `skipIf` predicates, condition timeout actions, and selector/rect/virtual target support.
- Added step `effects` and the `dom-effects` package entry for cursor click, typing preview, drag, pulse, and shake animations.
- Added built-in cursor styles plus `setCursorStyle()` and `registerCursorStyle()` APIs for DOM effects.
- Added `typeText` ghost mode for input-like typing animation without mutating the input value or firing input events.

### Changed

- Updated the Vue demo to register DOM handlers explicitly through `createDomConditionHandlers()`.
- Changed `npm run pack` to generate a real `.tgz` tarball and added `npm run pack:dry` for dry-run inspection.

## 0.1.0 - 2026-05-08

### Added

- Initial package metadata for packable npm artifacts.
- Public exports for the core engine, DOM renderer, DOM renderer CSS, and package metadata.
- Playwright smoke coverage for the Vue demo tutorial flow, including start, real clicks, text input, switch, select, save, completion, and refresh recovery.
- README sections for API usage, CSS loading, Vue integration, pure DOM integration, project structure, testing, packing, and release strategy.

### Release Notes

- This package is no longer marked `private` so `npm pack --dry-run` can inspect the publish artifact.
- No publish script is included. Use `npm run pack` for local release checks and publish manually only after reviewing the tarball contents.
