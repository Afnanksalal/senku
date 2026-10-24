# UI repair review

## Scope and design judgment

Senku is a partially built science learning app for school and college learners. Its current surfaces are the experiment catalog, guided missions, lab workspaces and local account dialog. A learner chooses an experiment, changes declared model parameters, runs it, and inspects results or completes a lesson. Success means the controls remain reachable, scientific evidence stays readable, and saved work stays connected. Recovery uses retry, defaults, account access and model limitations.

Keep the existing biology artwork, original glyphs, pale glass, rounded typography and tactile buttons. This is a component-layout repair, not a new visual direction. Reference lenses: UI/UX quality, UI/UX Pro Max, frontend-design and the Duolingo UX reference. Existing Senku constraints override library suggestions: no Lucide, gradients or em dashes.

## Repairs

- Explicit shrinkable grid/flex children and long-text wrapping prevent intrinsic content from forcing page overflow.
- Numeric values have their own fixed input column. Units sit below labels instead of squeezing between values and labels. Inputs and buttons retain 44px touch areas.
- Lab uses one column on phones, two on medium screens, and three only at 1280px and above. Mobile document order is controls, visualization, readouts, history, model. Controls and results use the document scroll, with no nested lab scroll container. Chart/readout panels share one stacked workspace so a tall model sidebar cannot stretch the gap between them.
- Visible scrollbars are hidden without disabling wheel, touch or keyboard scrolling. Floating mobile action docks were removed. Focus scroll margins reserve space below the header; mission transitions focus and scroll to the current step, respecting reduced motion.
- Molecular results occupy the main Result panel. Readouts and provenance remain secondary. Chart legends sit below plots, use scrolling for long comparisons, and tooltips remain within the chart.
- Catalog actions align at the bottom of cards. Panel titles/dates can wrap; small-screen run actions use a separate row. Long account names are bounded in the header and disclosed in full in the account dialog.
- Account dialogs scroll within short viewports, isolate background scrolling and have solid readable surfaces. Muted text contrast was increased.
- Short account-usage/run-list caches prevent unnecessary requests during navigation. Starting runs and redeeming invitations still invalidate affected queries.

## Verification status

Production builds pass. Initial 375px and 768px route sweeps passed overflow and lab-panel intersection checks across all 21 current routes. Rapid repeated navigation exposed backend rate limiting; query caching was improved and the final sweep follows normal client navigation. The 84 route/width checks passed at 375, 768, 1024 and 1440 pixels. Short-screen account dialog and Escape dismissal passed. A further 200% text-size check identified mission-choice intrinsic overflow; its grid sizing was repaired. Final scroll and result-render checks are recorded in the integration log after completion.

These checks are not a full WCAG certification or real-device performance test. Missing 3D scenes and absent feature UI remain outside this layout repair.

## Final verification
Final production build and 84 route/width checks passed (21 routes at 375/768/1024/1440). Measured result-to-readout gap is 20px. Additional checks passed: 200% mission text size, 844x390 landscape, 375x480 account dialog bounds and Escape dismissal, mission focus/scroll below the sticky header, normal and reduced motion, live molecular canvas in the Result panel, all catalog art loaded after scrolling, wheel and PageDown scrolling with hidden scrollbars. Audit fixture account deleted through the API and its temporary budget disabled. Real-device touch/assistive-technology testing and full WCAG certification were not performed.
