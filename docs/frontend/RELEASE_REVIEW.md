# Release screenshot and public layout review

Date: 2026-10-25. Scope: screenshots for the public README and a public/guest layout sweep. This review does not replace the authenticated solver, explanation, quota, export and ownership checks recorded in status.md.

The screenshot provenance and dimensions are recorded in [screenshot provenance](../images/README.md). All four PNGs were captured from real browser pages without mocked application content, then visually inspected. No live learner account was used. No science or explanation operation was charged.

Fourteen routes were checked at 320, 375, 768 and 1440 pixels: welcome, home, catalog, learn, challenges, discover, lab, docking, pathways, companion, offline, rooms, classroom and profile. All 56 ordinary-scale checks had no horizontal overflow, retained an h1 and produced no uncaught JavaScript errors. Browser messages were limited to Next.js stylesheet preload warnings and lazy-image informational messages.

The same 56 checks at 200% root text size found four intrinsic-width failures: welcome at 320px, rooms at 320/375px, and classroom at 320px. Browser-injected minimum-width/grid corrections fixed every observed failure. The corresponding source changes preserve the existing palette, typography, content and tools: zero-minimum introductory grid tracks in rooms/classroom, and bounded breakable h2 text in welcome. UTF-8, TypeScript and diff whitespace checks passed. The parent release task owns the final rebuilt-browser verification.

Final rebuilt verification: all 112 public layout checks passed (14 routes at four widths, at normal and 200% text). The four intrinsic-width failures described above are resolved in the deployed release build. No missing headings or uncaught page exceptions were observed.
