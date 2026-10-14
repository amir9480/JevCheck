# CLAUDE.md

JevCheck: a Chromium-only (MV3) extension. Clicking the toolbar icon opens a side panel showing the active page as Markdown (Raw / Preview tabs).

## Stack
Vite 8 + `@crxjs/vite-plugin` (root `src/`, config in `vite.config.ts`, manifest in `manifest.config.ts` (`defineManifest`)), TypeScript, React 18, Tailwind v4 (CSS-first, no tailwind.config), shadcn/ui (new-york), pnpm.

## Commands
- `pnpm dev` — Vite dev server with HMR; load `build` unpacked in Chrome
- `pnpm build:chrome` — production build to `build`
- `pnpm exec tsc --noEmit` — typecheck (no test runner configured)
- Add shadcn components with the shadcn CLI; `components.json` aliases point at `src/components/ui`.

## Architecture
1. `src/background.ts` — opens the side panel from `action.onClicked` and the context menu. The panel is per tab: the global panel is disabled and every tab gets `sidebar/index.html?tabId=<id>` via `sidePanel.setOptions({tabId})` (re-applied on tab create/activate/update). Selections are handed over in `chrome.storage.session` under `selectionKey(tabId)`.
2. `src/sidebar/sidebar-app.tsx` — on mount calls `extractPage(tabId)`, then follows its own tab (`tabId` from the URL) via `tabs.onUpdated` (a URL change drops the page and its result; no refresh button). Permission/error states replace the whole body under the top bar. Markdown Raw/Preview lives in `page-markdown-dialog`. Dark mode: `lib/theme.ts` (`.dark` class, localStorage). Deletes go through `useConfirm()` (`confirm-dialog.tsx`, provider in `scripts.tsx`), never `window.confirm`.
3. `src/lib/extract-page.ts` — `chrome.scripting.executeScript` returns `{title, url, html}` from the panel's tab (`activeTab` + `scripting`; no host permissions, no content scripts).
4. `src/lib/clean-html.ts` — DOMParser (inert) strips script/style/template/svg/iframe/nav/footer/hidden nodes/ads/cookie banners/analytics widgets (selector list + class/id token match in `isNoise`)/comments, removes images/media (img, picture, video, audio, etc.), keeps only `href/title`, absolutizes URLs, prefers `main` (or a lone `article`; several articles keep the body). Never strips `form` (ASP.NET wraps whole pages in one).
5. `src/lib/html-to-markdown.ts` — Turndown + `turndown-plugin-gfm` (types in `src/types.d.ts`).
7. `src/lib/decision/` — fetch-based decision API client (Vercel `/v1/evaluate`, OpenRouter `/api/alpha/decisions`, OpenAI `/decisions`, TypeSafe `/v1/systemone`, OpenCode `opencode.ai/inference/v1/systemone` (TypeSafe-compatible, free model; `ProviderInfo` has `badge` and `keyUrl`); custom = OpenAI/TypeSafe-compatible). Normalized questions/answers in `types.ts`.
8. `src/lib/key-vault.ts` + `use-keys.ts` — API keys AES-GCM encrypted in `chrome.storage.local`; the non-extractable CryptoKey lives in IndexedDB `JevCheckVault`. Missing/mismatched key wipes all keys.
9. `src/lib/origin-access.ts` — provider hosts are *optional* host permissions, requested when a key is added (which also tests it) and re-requested on Evaluate.
10. Question sets (Dexie `JevCheckDB` v5: `questionSets`, a shared `documents` library referenced by `documentIds`, `evaluations`, `meta`; nothing is seeded). `lib/question-sets.ts` (CRUD + live hooks), `lib/evaluate-set.ts` (builds `{context, documents, page}` state, truncates the page 70/30 from the middle, SHA-256 hash → cached result in `evaluations`), Question types: boolean/choice/score map to Jev natively; `multi` is sent as one boolean per answer (`<qid>_<answerId>`) and the per-question `threshold` (display-only, not in the cache hash) decides which answers are highlighted. `lib/decision/limits.ts` (Jev limits: 32k state+longest question, 64k request, ≤255 choices, 2–10 score levels; UI blocks anything over them), `lib/answer-presets.ts` (ready answers, color palettes), `lib/icon-map.ts` (curated lucide icons), `lib/spreadsheet.ts` (CSV/XLSX → answers).
11. UI: `question-set-picker` + `evaluation-panel` on the main view; `question-set-editor-dialog` (full-screen: name, documents + uploader, context, questions) with `question-editor`, `answers-editor`, `color-picker`, `icon-picker`, `spreadsheet-import-dialog`. Floating UI inside dialogs must be inline or use `PortalContainerContext` (popovers break in the transformed dialog).
12. `src/templates/` — ready-made question sets: one directory per template with a single `index.ts` exporting a `QuestionSetTemplate` (`types.ts`), listed in `templates/index.ts` (`TEMPLATES`). `createFromTemplate()` in `lib/question-sets.ts` instantiates one. `template-picker-dialog` (the + button; last card = empty set) and `onboarding-dialog` (first run only: pick a template, upload documents if it `requireDocuments`, then the provider settings dialog opens if no key exists; gated by `meta.onboarded`, which `db.ts` sets on `ready` for installs that already have sets).
13. Question dependencies: `Question.dependsOn` (`question-types.ts`) hides a question in results unless an *earlier* source question was answered a qualifying way (boolean/choice top answer in `answerIds`, multi any answer at/above its threshold, score >= `minScore`). Display-only, so it is not in the cache hash; the model still answers every question. `lib/dependencies.ts` has `resolveVisibility` (transitive), `sanitizeDependencies` (run on every editor edit; also checked by `validateSet`) and `describeAnswer`. Each saved `Evaluation` stores a `questions` snapshot: History renders with it, while the live result of the current page (`shown.live`) uses the current set. `cloneQuestionSet` remaps rule ids. Templates use `gateQuestion`/`withGate` (`templates/types.ts`). Editor UI: `dependency-editor.tsx` (collapsible "Advanced").
6. Preview renders with `react-markdown` + `remark-gfm` + `@tailwindcss/typography`.

## Template and question rules
The model only ever sees the page's **readable text** as Markdown (`clean-html.ts` strips scripts, styles, images and media, nav/footer, hidden nodes and attributes other than `href`/`title`). It cannot judge source code, HTML tags, meta tags, structured data, page speed, images, video, layout, colors or links. Never write template questions, answers or context that assume otherwise (no "does it have an H1", "are the images good", "internal links", "page speed"); ask only about what the wording itself states. The SEO template is a *content* checkup for that reason.

## Conventions
- `@/` alias maps to `src/`; use it in new code.
- TypeScript source files are named in kebab-case (`sidebar-app.tsx`, not `SidebarApp.tsx`); use `git mv` when renaming. Component/function identifiers inside stay PascalCase/camelCase.
- Restricted pages (`chrome://`, Web Store, PDFs) make `executeScript` throw; this surfaces as a friendly error in the panel.
- If `activeTab` is not granted on toolbar click in some Chrome version, fall back to `host_permissions: ["<all_urls>"]` and update STORE.md.
