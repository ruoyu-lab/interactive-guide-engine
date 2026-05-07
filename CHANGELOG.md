# Changelog

All notable changes to this package will be documented in this file.

The project follows Semantic Versioning. While the package is in `0.x`, minor
versions may include API-breaking changes; patch versions are reserved for
backward-compatible fixes.

## 0.1.0 - 2026-05-08

### Added

- Initial package metadata for packable npm artifacts.
- Public exports for the core engine, DOM renderer, DOM renderer CSS, and package metadata.
- Playwright smoke coverage for the Vue demo tutorial flow, including start, real clicks, text input, switch, select, save, completion, and refresh recovery.
- README sections for API usage, CSS loading, Vue integration, pure DOM integration, project structure, testing, packing, and release strategy.

### Release Notes

- This package is no longer marked `private` so `npm pack --dry-run` can inspect the publish artifact.
- No publish script is included. Use `npm run pack` for local release checks and publish manually only after reviewing the tarball contents.
