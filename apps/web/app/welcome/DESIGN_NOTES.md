# Welcome page design notes

## Product and journey

Senku is a functional biology learning platform with model-backed experiments and Gemini-guided learning. The public landing introduces school and college learners to those existing tools. The primary action is Ask your first question at /home; browsing missions at /learn is the secondary action. The catalog, free labs and every existing tool remain accessible. Guest practice and the lab-access requirement for fresh AI content remain explicit.

## Direction

Keep Senku's exact current identity: Bricolage Grotesque for expressive headings, Nunito for UI/body, Caveat for a small handwritten aside. Existing palette tokens only: paper #f7faf6, slide #e9efe8, ink #17262e, chlorophyll #1b9a68, hema #4a3b97 and the existing eosin/cobalt/pollen accents. No new palette or fonts. Primary CTA uses the existing deeper green token for readable white text and a tactile pressed lip.

Composition: a generous split hero pairs Big questions. Tiny adventures. with new original hero-curiosity artwork, keeping Senku's cute mascot and miniature science world prominent. Phones place the illustration between the heading and supporting copy. Three compact gateways connect missions, games and labs. A short real learning sequence, three illustrated experiment entries, a science-friends game section, molecular exploration, source-backed research, offline callout and closing invitation complete the journey. Every link points to a working product route. No app-console treatment, testimonials, fake learners, invented statistics, gradients, Lucide, or em dashes.

## Skills and judgment

Applied UI/UX cognition and hierarchy, frontend-design composition/restraint, UI/UX Pro Max responsive and CTA guidance, and Duolingo reference tone/tactility. The design-system search was used for structure and interaction guidance only. Its proposed replacement colors/fonts were rejected because the user explicitly requested preservation of Senku's identity.

## Ownership and verification

Only apps/web/app/welcome/** is changed in this refresh. Root supplies public/art/hero-curiosity.png and public/art/science-friends.png. No page-body marketing header is provided; root owns the shared shell. Existing / catalog and all tool routes are preserved. Obsolete page-level metadata was removed so the SEO server layout owns the route consistently. No dependencies, global styles, navigation, Docker services or commits changed. The shared TypeScript check currently reports the parent's unfinished AiStart import only; browser validation waits for the parent's combined build and supplied artwork.
