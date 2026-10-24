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

## Preserve-identity pass, 2026-10-25

Kept the entire toolkit, original colors, artwork and mascot. Added a compact header with an explicit tool directory, mobile bottom navigation, public introduction, learner home and full progress profile. Learn has grouped mission rows; mobile Lab has state-preserving section tabs. Custom Radix selects and a calendar/time dialog replace native menus. Catalog search and availability filters include a recoverable no-match state. Real rewards and activity drive XP, goals, level display and history; no invented currency or sample statistics.

Verified111route/width checks across37routes at375/768/1440, actual profile persistence, calendar submission semantics, keyboard selection, real local lab results and history/control continuity. Enlarged-text reflow repairs include header wrapping, responsive home tool cards and pathway species controls. Landing illustration blending retains original art without white image rectangles. Full screen-reader and physical touch-device audits remain unperformed.

Final rebuilt-container checks: toolkit Escape returns focus to its trigger; 200% text reflows without page overflow on Home/Pathways/Welcome/Learn at375px; toolkit stays inside an844x390 viewport under reduced motion. No page errors in that final interaction run. Original archived masterplan SHA256 remains unchanged. Web/API/gateway and scientific dependencies are running locally.

Final rebuilt-container sweep passed111checks across37routes at375/768/1440 with no page overflow, failed routes or alert errors. Final mobile game check confirmed live preview→controls→saved result order, exact fractional range values, successful local test, and attached device-result context in Lab chat. All containers remain running; archived masterplan hash is unchanged.

Final deployed check: live Gemini returned concise introduction160characters, prediction123characters and contextual choices28/30/36characters, without numeric settings recitation.375px question occupied full301px below mascot,1440px also clean; reload preserved the mission and one generation charge. Final37route×3width sweep passed111checks without overflow/alert errors. All test accounts/budgets cleaned up; Docker services remain running.

## Input spacing and desktop alignment, 2026-10-25
Fixed the challenge setup's native details content layout with an explicit inner grid. Its pace selector, interest field and action row now have24px separation; field labels sit8px above controls. Shared label/form spacing tokens and scoped profile, classroom, rooms, research, companion and pathway form rules use8px label gaps and20px field/action separation. Precise scientific controls retain their original data/behavior.

Desktop header uses equal side tracks to center the primary navigation independently of account-action width. Navigation wraps within a bounded center column when text is enlarged; mobile behavior remains responsive. Initial rebuilt-browser measurements passed320/375/1024/1440/1920:24px challenge gaps,8px label gap, no page overflow and desktop nav center error below0.01px. Sign-in form measured20px between fields. Other visible research/pathway/rooms/classroom inputs measured8px label spacing and20px form rows. Final enlarged-text nav reflow check follows deployment.
Final deployed header test at1024px/200% passed with64.77px brand/nav clearance,40px nav/account clearance and0px center error.1440/1920 normal center error below0.01px. Live chat composer measured20px field/action and8px label/control gaps.

## Install banner polish, 2026-10-25
Replaced the stretched single-row install notice with a mascot tile, short title/body hierarchy and adjacent primary/secondary actions. Mobile uses a full-width action row beneath the message; offline/update states share the layout. Existing colors, install event gating and saved-lesson behavior remain intact.
Verified the rebuilt live banner at320/375/768/1440px: no horizontal overflow, both actions retain44px targets, and Maybe later dismisses the notice. Visually checked mobile/desktop screenshots. Browser installation event was simulated only to expose the banner; no native installation was claimed. Web build and type checking passed; local containers updated.

Home layout verification: production build/type checking passed. Live screenshots inspected at375px and1440px; measured320/375/768/1440/1880 with no horizontal overflow. A browser-only long-name learner fixture passed200% text at320/375/768/1440 after grid minimum-width fixes. Mobile question action now spans its row. Fixture used local browser state only and was cleared; no real learner account changed. Containers rebuilt and running.
