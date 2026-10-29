# Demo assets

Original placeholder illustrations for the fictional demo data in `dev-data/fixtures`.
- Every image is drawn by `scripts/generate-demo-assets.mjs`. No photo, logo or other third-party image is used.
- Every image carries a "DEMO IMAGE - FICTIONAL PROPERTY" watermark.

Folder layout: `<developer slug>/<project code>/<property reference>/photo-1.png`.
- Paths are stable. The seed uploads these files as property photos into the local Storage emulator.
- Regenerate them with `npm run demo:assets`; the output is identical on every run.
