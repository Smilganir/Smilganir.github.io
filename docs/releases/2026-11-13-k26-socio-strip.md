# K26 socio-economic strip chart standalone release

Published the approved strip chart as a standalone page at `/viz/k26-socio-strip/`.

- Source: approved preview commit `f7c61794b903d75c59b702e1ed6f23deedba0337`.
- The HTML, data and 13 logo images are copied byte-for-byte from `preview/k26-socio-strip/`.
- No homepage card or election-map embedding is added.
- The preview stays available. No election-map files or other hosts are changed.
- Restore point: `restore-point-2026-11-13-k26-strip-standalone-live`.
- Rollback: revert this standalone release commit, removing only the new page and this note.

Verification: local copies match the approved Git blob hashes. After deployment, verify
320/390/1280 layouts, Hebrew/English, Parties/Blocs, histogram height and LTR axes,
labels, focus, tap/wheel/pinch zoom and reset. Do not report completion until the live checks pass.
