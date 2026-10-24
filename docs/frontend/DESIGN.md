# Senku visual and interaction direction

Sources: explicit chat requirements plus masterplan sections 4, 14, 28-31. User constraints override conflicting defaults in libraries or skills. This is direction, not a finalized palette/type system.

## Product cognition

Stage: documentation/new product. Users: learners and educators; school and college focus, exact ages unresolved. Core objects: experiment/model version, lesson, run, result, investigation, assignment. Main learner task: predict, manipulate, inspect and explain a scientific outcome. Entry: mission map or experiment catalog. First decision: choose a mission or make its prediction. Success: measured observation plus explanation, with progression preserved. Recovery: reset/replay, inspect warnings, retry a failed run or use an available offline lesson. Mobile action: adjust a small number of real parameters and inspect the result. Temperament: curious, encouraging, scientifically honest.

## Fixed user constraints

- No Lucide icons or dependencies. Use a consistent custom SVG/artwork/3D asset language.
- No gradients in UI surfaces, text, or decorative backgrounds. Natural physical lighting/reflection can express material depth.
- No em dashes or filler-heavy marketing copy in user-facing text.
- Premium Apple-inspired translucent/glass controls, expressive typography and tactile Duolingo-inspired feedback.
- Original mascot and original identity. Cursive is selective accent typography, never required for readable controls or scientific units.
- Real Three.js/R3F scenes, materials, lights, cameras and transformations where they improve understanding. Preserve a capable 2D fallback.

The plan suggests mint/teal, yellow rewards, warm backgrounds, large controls and rounded forms. These are inputs for a coherent token system, not permission to repeat generic identical cards everywhere. Palette values, font licenses, type scale, spacing, radius, shadows and motion tokens remain to be designed against actual screens.

## Surface composition

Learn: clear branching map and prerequisite state; full-screen mission with 1-3 meaningful controls, prediction, observation and explanation. Lab desktop: left experiment/model tree, central visualization, right parameters/assumptions, bottom plots/timeline, top execution toolbar, collapsible AI workspace. Lab mobile: central lightweight scene, bottom-sheet parameters, tabbed charts and reachable execution controls. Discover: question, source cards, DAG/job status, comparison and report provenance. Teacher Studio: reviewed template selection, rubric, assignment and learner progress.

## Materials and motion

Use glass where it clarifies control layers and spatial context. Protect text/plot contrast and provide opaque/reduced-transparency fallbacks. Use solid surfaces for dense data as needed. Animate actual state changes: parameter response, camera focus, inspection, scene transformations, experiment-to-Lab continuity, and earned feedback. Define trigger, start/end state, interruption, reset and reduced-motion behavior. Assign one animation owner per property.

Scientific state comes from the solver. A mascot can celebrate a result but cannot conceal warnings or imply scientific validation. No fake 3D screenshots presented as interactive scenes, generic floating objects without purpose, or animation-only sliders.

## Mobile and inclusion

Touch and keyboard equivalents, visible focus, scalable typography, non-color status, textual result/plot descriptions, safe areas, single-column adaptations and honest loading/error/offline states. Structure localization to support Malayalam; typography must cover selected scripts. Heavy viewers and effects load only when needed.

## Confirmed launch interaction choices

English initially; concept-first. Offer guided missions and free labs immediately, with learner-selected first experiments. Allow guest exploration and account-based cloud saves. Keep the companion quiet unless summoned. Include real-time shared labs, private work and share links at learner launch. Teacher Studio and public community follow later. See ../launch-brief.md.

## Preserve-identity UX pass, 2026-10-25

Current user override: improve usability without replacing Senku's palette, mascot, artwork or tools. The existing experiment catalog stays at `/`; `/welcome` is the public introduction and `/home` is the learner dashboard. The compact application header exposes the entire toolkit, while mobile has a five-destination bottom navigation with document/focus safe-area insets.

Learn uses grouped mission rows and one suggested action, without prerequisite locks. Mobile Lab separates Results, Controls, Model and History while retaining mounted state and a reachable run action; desktop retains the complete layout. Dropdowns use a shared Radix Select and classroom due dates use an optional keyboard-operable calendar/time dialog.

Profile and home use authoritative learning rewards, actual attempt history, UTC day accounting and persisted daily goals. Levels are a transparent presentation of each100earned XP, not a new currency. Existing compute admission remains separate from learning XP. All prior tools remain available.

## Mascot brand mark, 2026-10-25
User explicitly replaced the abstract cell logo with a flat head-only rendering of the existing mascot. Shared BrandMark and favicon use the green face, yellow goggles, dark eyes, blush and smile, with solid vector fills. Full-body mascot artwork remains unchanged. Source: public/art/senku-mark.svg, mirrored in app/icon.svg.

## Coherent icon language and generated-question reflow
Original symbols now use chunky rounded silhouettes and a second tint of the current color, consistent with the head-only mascot. No external icon pack, Lucide, gradients or new palette is introduced. At narrow widths/large text, the header reflows in the document, toolkit title/close reserve independent columns and precise labels/units wrap. Phone mission questions use full width under the mascot. Missions prepare Gemini text before showing questions; practice states are explicit, answer keys stay server-side and saved mission IDs preserve reload continuity.

## Product voice
All learner-facing language and marketing speaks as Senku. Do not advertise providers, model names, libraries, frameworks or implementation details. Say a mission made for you, your adventure, or Senku is preparing your adventure. The same rule applies to generated prose, metadata and social artwork. Internal contracts and accurate scientific citations remain intact.

## Home dashboard proportions, 2026-10-25
Home now uses a1120px content grid, a compact40–44px desktop heading, a separate personal greeting and a single question-led action. The mascot occupies a deliberate companion column; on phones it becomes a small illustration beside reserved intro space. Secondary mission/experiment links are lower emphasis. The composer has a consistent field/footer rhythm, a single example question and concise helper text. Palette, fonts, mascot, account data and tools are preserved. This is a learner dashboard, with progress and continuation directly after the entry section.
