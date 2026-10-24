# Offline and device-adaptive execution

Source: masterplan sections 4, 7, 11, 14, 16, 25, 28-30.

## Execution routing

If an approved experiment can execute locally, run its declared solver in a Web Worker or supported WASM kernel. Otherwise require connectivity for a queued remote sandbox. If disconnected, display a truthful unavailable/deferred state and preserve a pending request as supported. Both execution paths return the shared result contract.

Changing render quality does not change the scientific model or result. A 2D heatmap and a 3D view represent the same numerical state. Mobile accessibility and low-power devices must not require transmission shaders or WebGL to complete the core lesson.

## Cache and sync requirements

Service Worker caches versioned application/lesson assets. IndexedDB stores local progress, available lesson packs and relevant run data. A cached experiment requires its exact manifest, compatible solver and essential assets, not just a page shell. Version compatibility, invalidation and storage eviction must be explicit before claiming offline support.

Progress events have unique IDs and idempotent server reconciliation. Reconnection must not double-award XP or duplicate attempts. Conflict rules, account transitions, migration, retention, storage quota handling and deferred-job confirmation semantics remain design decisions.

## Truthful states

Show cached availability before learners commit. Explain when AI or remote engines need connection. Distinguish pending sync from saved-on-server, queued-local-request from remotely running, and a stale cache from a usable lesson pack. Never animate simulated cloud completion while offline.

## Acceptance

Prepare/cache a lesson online, disconnect actual networking, reload and finish it using a local worker, inspect real outputs, reconnect, and verify each progress/XP event reconciles once. Repeat on a fresh cache to prove the unavailable state. Verify unavailable/evicted assets do not corrupt progress. Test reduced rendering and keyboard completion independently of connectivity.
