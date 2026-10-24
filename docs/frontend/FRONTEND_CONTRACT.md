# Frontend behavior contract

Status: requirements for future implementation; not evidence of completed UI.

1. Read product, decisions and DESIGN before broad UI work. Record the current surface, primary user task, entry path, first decision, mobile primary action and recovery path.
2. Build against typed experiment/run/artifact contracts. Every scientific input changes a declared solver parameter. Every quantitative chart identifies the run that produced it.
3. Preserve experiment/model version, parameter state and applicable seed between Learn and Lab. Show assumptions, units, provenance and diagnostics in the appropriate detail layer.
4. Handle initial/empty, loading, success, invalid input, failure, offline/deferred, permission-denied and unsupported-renderer states where applicable. No fabricated data to make a state look populated.
5. Use accessible HTML controls around canvas, keyboard alternatives, visible focus, non-color feedback and readable plot descriptions. Support reduced motion and lower-cost rendering.
6. Choose one primary molecular viewer per scene. Load large editors/viewers lazily. Typed renderer routing must not accept executable UI from an LLM.
7. Keep numerical computation off the main thread when needed. Avoid React state updates each animation frame. Bound device pixel ratio, shader/postprocessing cost and assets; stop idle/offscreen rendering where appropriate.
8. Clean up timelines, observers, events, workers, textures, buffers, render targets and owned model instances. Do not let GSAP, useFrame and physics write the same transform concurrently.
9. Respect all explicit design constraints in DESIGN. Do not install default Lucide dependencies indirectly through copied components.
10. Verify actual interactions and numerical changes, production build, responsive layouts, accessibility, offline behavior and representative mobile performance. Report browser/device checks that were not performed.

## Before a surface is called complete

Primary task works from entry to outcome and recovery; controls are meaningful; state and units stay readable; visible actions have implementations; no overflow at supported layouts; assets do not block the local lesson unnecessarily; progression persists correctly; plots and claims have provenance; failures are recoverable; performance claims have evidence.

Per-surface briefs should be written when screens are actually scoped, not invented now as if their interaction design were settled.
