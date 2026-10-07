# GitHub project audit: do the portfolio's project cards match the code?

Researched 2026-10-07. The primary source is GitHub itself: each repo's code, manifests and lockfiles, read through `gh api` and shallow clones pinned to the commit SHAs below. READMEs were read too, but a claim counts as true only when code backs it. Live URLs were checked with `curl -sL`.

## TL;DR

- **All three cards made claims the code doesn't back.**
  - F1 names the Claude API, but the app runs on Gemini. It also says "telemetry", but telemetry loading is switched off.
  - The code-review card says OpenAI and PostgreSQL, but the repo calls Claude and has no database. Its "authentication and review-history tracking" was planned for a Phase 3 that was never committed.
  - The Kanban card's "WebSockets" and "Node.js" tags describe infrastructure the app code never touches. Sync is Supabase Realtime and the backend is Next.js Server Actions.
- **Two cards had no repo link.** `codereview-ai` and `kanban-board` are public and are now linked.
- **None of the 13 public repos has a live demo.** No homepage field, no GitHub deployments, no deploy config. The only `vercel.app` URLs that return 200 belong to other people's apps (details below). Every card stays without a `live` link.
- **Grid descriptions were truncated at every width.** At 169 and 216 characters they ran to 4–8 lines in a 2-line clamp. The narrowest real text column is 222 px (320 px phone) and 230 px (640 px, 2-col), so a description that fits everywhere is about 60 characters.

## Repos audited

All 13 are `visibility: public` per `gh api repos/lawry98/<repo> -q .visibility`. Private repos are out of scope and are never linked or described.

| Repo | SHA audited | Last push | Homepage / deployments | README (1–5) | Card? |
|---|---|---|---|---|---|
| f1-application | `1613609` | 2026-10-05 | none / 0 | 4: accurate, no screenshots | Featured |
| codereview-ai | `2810c19` | 2026-02-13 | none / 0 | 2: lists features that don't exist | Grid |
| kanban-board | `d6037c4` | 2026-10-07 | none / 0 | 3: accurate, placeholder screenshots and demo link | Grid |
| nudge-ai | `3144510` | 2026-04-22 | none / 0 | 4 | Not on site (see below) |
| cv-final-project | `0503734` | 2025-12-11 | none / 0 | no README | Not on site (see below) |
| neetcode-submissions | `af9dceb` | 2026-07-17 | none / 0 | 1: auto-generated | No: practice log |
| todo_app | `1163a1e` | 2024-11-16 | none / 0 | 2 | No: tutorial CRUD |
| twitter-clone | `d65bf5f` | 2024-11-16 | none / 0 | 2 | No: unfinished |
| React-practice (fork) | `1595c07` | 2024-10-03 | none / 0 | 1 | No: cohort homework |
| webdev-week7.4 (fork) | `b4f5630` | 2024-10-16 | none / 0 | 1 | No: cohort homework |
| WebDevFSassignments (fork) | `bb98b58` | 2024-10-22 | none / 0 | 1 | No: cohort homework |
| lawry98 | `0c4bacd` | 2026-10-07 | n/a | profile README | n/a |
| portfolio_lc | this repo | | | | n/a |

Full SHAs: f1-application `161360924073e95983a24ff7fbc6d4e5bc59f8c9`, codereview-ai `2810c19c2b9de92c442d310c632de199631c4a6e`, kanban-board `d6037c4756c99091bcc099e62673a5a3d265ae82`.

## Card 1: F1 Race Weekend Briefing Agent (`f1-application`)

Permalinks are at `161360924073e95983a24ff7fbc6d4e5bc59f8c9`.

### Stack

| Tech | Version | Evidence |
|---|---|---|
| LangGraph | 1.0.6 | [backend/requirements.txt#L6](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/requirements.txt#L6) |
| Gemini via langchain-google-genai | 4.3.2, model `gemini-3.6-flash` | [requirements.txt#L4-L5](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/requirements.txt#L4-L5), [config.py#L12-L13](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/config.py#L12-L13) |
| FastAPI, sse-starlette | 0.128.0, 3.1.2 | [requirements.txt#L1-L13](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/requirements.txt#L1-L13) |
| FastF1, OpenF1 REST, Tavily, OpenWeather | 3.7.0, n/a, 0.7.17, API 2.5 | [requirements.txt#L7](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/requirements.txt#L7), [openf1_client.py#L54](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/openf1_client.py#L54), [requirements.txt#L12](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/requirements.txt#L12), [weather_tools.py#L31](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/weather_tools.py#L31) |
| Next.js, React | 16.3.8, 19.3.0 | [frontend/package.json#L28-L30](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/package.json#L28-L30) |
| Three.js, React Three Fiber | 0.182.0, 9.8.1 | [frontend/package.json#L22](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/package.json#L22), [#L34-L35](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/package.json#L34-L35) |

No `anthropic` or `langchain-anthropic` package appears in any manifest. [ADR 0001](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/docs/adr/0001-gemini-over-anthropic.md#L5-L10) records the switch from `claude-sonnet-4`.

### Claims on the old card

| Claim | Verdict | Evidence |
|---|---|---|
| "AI-powered web application" | True | FastAPI backend calls the model: [graph.py#L108-L114](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/graph.py#L108-L114) |
| "uses LangGraph" | True | 4-node `StateGraph` (resolver, planner, tool_executor, synthesizer): [graph.py#L695-L711](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/graph.py#L695-L711) |
| "and the Claude API" | **False** | `ChatGoogleGenerativeAI(model=LLM_MODEL)` with `LLM_MODEL = "gemini-3.6-flash"`: [graph.py#L108-L114](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/graph.py#L108-L114), [config.py#L13](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/config.py#L13) |
| "telemetry" | **False** | `session.load(laps=False, telemetry=False, weather=False, messages=False)`; only `session.results` is read: [fastf1_helpers.py#L44-L55](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/fastf1_helpers.py#L44-L55) |
| "weather" | True | OpenWeather 5-day forecast per session: [weather_tools.py#L31-L111](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/weather_tools.py#L31-L111) |
| "news" | True | `TavilyClient.search`: [search_tools.py#L5-L32](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/search_tools.py#L5-L32) |
| "session results" | True | OpenF1 `session_result` from 2023 on, FastF1 before that: [openf1_client.py#L310-L326](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/openf1_client.py#L310-L326), [fastf1_helpers.py#L53-L54](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/fastf1_helpers.py#L53-L54) |
| "concise race-weekend briefings" | Partly | The prompt asks for a 6-section Markdown briefing, and the README calls them "detailed": [prompts.py#L20-L43](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/prompts.py#L20-L43) |
| "interactive Three.js experience" | True, narrowly | `/showcase` auto-rotates a GLB car. A picker tints its livery texture to one team color at a time, across 11 teams. It doesn't redraw each team's real livery, and there are no orbit controls: [f1-car-showcase.tsx#L114-L126](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/components/3d/f1-car-showcase.tsx#L114-L126), [f1-car-model.tsx#L128-L131](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/components/3d/f1-car-model.tsx#L128-L131), [lib/livery.ts#L104](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/lib/livery.ts#L104) |
| Tags LangGraph, Three.js, React Three Fiber | True | See stack table |
| Tag Claude API | **False** | See above |

### Evidence for the new card

| New claim | Evidence |
|---|---|
| "A LangGraph agent" | The planner node has Gemini pick which tools to run, and they run in parallel: [graph.py#L212-L233](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/graph.py#L212-L233), [#L461](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/graph.py#L461) |
| "uses Gemini" | [graph.py#L15](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/agent/graph.py#L15), [config.py#L13](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/config.py#L13) |
| "race results, standings, weather, and news" | Results and weather/news as above; standings derived from OpenF1: [standings_tools.py#L133-L134](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tools/standings_tools.py#L133-L134) |
| "streamed race-weekend briefings" | SSE endpoint emits `briefing_delta` tokens: [routes.py#L246-L337](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/api/routes.py#L246-L337) |
| "a Three.js viewer that paints a 3D car in each team's color" | `teamColor={selectedTeam.color}` and the picker: [f1-car-showcase.tsx#L114-L126](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/components/3d/f1-car-showcase.tsx#L114-L126); `recolourLivery(..., hexToRgb(teamColor))`: [f1-car-model.tsx#L128-L131](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/frontend/components/3d/f1-car-model.tsx#L128-L131) |
| Tag FastAPI | [requirements.txt#L1](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/requirements.txt#L1), [routes.py#L222-L225](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/api/routes.py#L222-L225) |

### Other notes

- **The README is consistent about Gemini.** At this SHA, [README.md#L3](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/README.md#L3) says "using Gemini". The only Claude mention is the `CLAUDE.md` agent-notes file. The README's credit "FastF1 — Python library for F1 telemetry data" ([#L381](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/README.md#L381)) describes the library, not this app. It is the likely source of the card's "telemetry".
- **CI on `main` is red.** 8 backend weather tests hard-code the 2026-10-02..04 weekend without freezing the clock: [test_tools.py#L66-L69](https://github.com/lawry98/f1-application/blob/161360924073e95983a24ff7fbc6d4e5bc59f8c9/backend/tests/test_tools.py#L66-L69).
- **Other README drift:**
  - It says "Node.js 18+", but Next 16.3.8 needs Node 20.9 or later.
  - The routes table omits `/tyres`.
  - The test blurb understates the 96 frontend test files.

## Card 2: AI-Powered Code Review Tool (`codereview-ai`)

Permalinks are at `2810c19c2b9de92c442d310c632de199631c4a6e` (branch `master`, 3 commits, all 2026-02-13). The repo stops at "Phase 2". Its own [PHASE2-COMPLETE.md#L187-L193](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/PHASE2-COMPLETE.md#L187-L193) says it has "No authentication yet" and that reviews are not saved.

### Stack

| Tech | Version | Evidence |
|---|---|---|
| Next.js (App Router, one Route Handler) | 16.1.6 (the README says 14) | [package.json#L18](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/package.json#L18) |
| Anthropic SDK, model `claude-sonnet-4-20250514` | 0.74.0 | [package.json#L12](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/package.json#L12), [src/lib/anthropic.ts#L1-L16](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/lib/anthropic.ts#L1-L16) |
| TypeScript | 5.9.3 | [package.json#L39](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/package.json#L39) |
| Tailwind CSS | 4.1.18 | [package.json#L37](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/package.json#L37) |
| shadcn/ui on Radix, prism-react-renderer | 3.8.4, 2.4.1 | [components.json](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/components.json#L1-L23), [CodeEditor.tsx#L4](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/components/CodeEditor.tsx#L4) |
| Installed, never imported | `@supabase/supabase-js`, `@supabase/ssr`, `react-simple-code-editor`, `prismjs` | [package.json#L13-L25](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/package.json#L13-L25); nothing under `src/` imports them |

The string "openai" appears nowhere in the tree, the lockfile included.

### Claims on the old card

| Claim | Verdict | Evidence |
|---|---|---|
| "full-stack developer tool" | True, thin | One page plus `/api/analyze`: [route.ts#L13-L196](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/app/api/analyze/route.ts#L13-L196) |
| "10+ programming languages" | True: 12 | Picked from a dropdown, and the server rejects anything else: [src/types/index.ts#L76-L89](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/types/index.ts#L76-L89), [route.ts#L45-L52](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/app/api/analyze/route.ts#L45-L52). Only 8 of the 12 get syntax colouring |
| "feedback on security, performance, and engineering standards" | True | Prompt categories: Bugs, Security, Performance, Best Practices, Refactoring: [codeReview.ts#L16-L20](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/prompts/codeReview.ts#L16-L20) |
| "with authentication" | **False** | `const user = null;` [Navbar.tsx#L8-L9](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/components/Navbar.tsx#L8-L9); `const isAuthenticated = false;` [route.ts#L56-L57](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/app/api/analyze/route.ts#L56-L57). No Supabase client, OAuth or magic link anywhere |
| "review-history tracking" | **False** | No history route and nothing saved: [PHASE2-COMPLETE.md#L190-L191](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/PHASE2-COMPLETE.md#L190-L191). The table design exists only in [SETUP.md#L31-L76](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/SETUP.md#L31-L76) |
| Tags Next.js, TypeScript | True | See stack table |
| Tag OpenAI API | **False** | Anthropic SDK only |
| Tag PostgreSQL | **False** | No DB code, migrations or queries |

### Evidence for the new card

| New claim | Evidence |
|---|---|
| "Claude reviews code" | `anthropic.messages.create(...)` with the review prompt: [route.ts#L83-L97](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/app/api/analyze/route.ts#L83-L97) |
| "in 12 languages" | [src/types/index.ts#L76-L89](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/types/index.ts#L76-L89): JavaScript, TypeScript, Python, Java, C++, Go, Rust, C#, PHP, Ruby, Swift, Kotlin |
| "with line-level fixes" | Each issue has `severity`, `line`, `suggestion` and `fixedCode`: [codeReview.ts#L29-L56](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/prompts/codeReview.ts#L29-L56); shown with line badges in [CategoryCard.tsx#L106-L152](https://github.com/lawry98/codereview-ai/blob/2810c19c2b9de92c442d310c632de199631c4a6e/src/components/CategoryCard.tsx#L106-L152) |
| Tags Next.js, TypeScript, Claude API, Tailwind CSS | See stack table |

### Live demo

None. No homepage field, no deployments, and no deploy URL in the repo. `codereview-ai-lawry98.vercel.app` and similar URLs return 404 `DEPLOYMENT_NOT_FOUND`. `codereview-ai.vercel.app` returns 200, but it is someone else's app: its title is "Create Next App", it asks for a GitHub PR URL and your own Anthropic key, and it matches none of lawry98's repos. Don't link it.

## Card 3: Real-Time Collaborative Kanban Board (`kanban-board`)

Permalinks are at `d6037c4756c99091bcc099e62673a5a3d265ae82` (225 commits, CI green).

### Stack

| Tech | Version | Evidence |
|---|---|---|
| Next.js (App Router, Server Actions) | 16.3.8 | [package.json#L36](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/package.json#L36) |
| Supabase: Auth and Realtime | supabase-js 2.97.0, ssr 0.8.0 | [package.json#L29-L30](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/package.json#L29-L30) |
| Prisma (with `@prisma/adapter-pg`) | 7.10.0 | [package.json#L26-L27](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/package.json#L26-L27), [lib/prisma.ts#L2-L26](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/lib/prisma.ts#L2-L26) |
| PostgreSQL (Supabase-hosted, 11 SQL migrations) | n/a | [schema.prisma#L20-L22](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/prisma/schema.prisma#L20-L22) |
| React, TypeScript (strict) | 19.2.3, 5.9.3 | [package.json#L39](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/package.json#L39), [#L67](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/package.json#L67), [tsconfig.json#L7](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/tsconfig.json#L7) |
| @hello-pangea/dnd | 18.0.1 | [package.json#L25](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/package.json#L25) |
| Tailwind CSS v4, shadcn/ui | 4.2.1 | [app/globals.css#L1-L3](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/globals.css#L1-L3), [components.json](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/components.json#L2-L7) |

No `socket.io` in the lockfile, and no `new WebSocket`, `ws` import or Express server in the app source. The lockfile pulls in `ws` only through `@supabase/realtime-js`, and `express` only through a shadcn CLI dev dependency.

### Claims on the old card

| Claim | Verdict | Evidence |
|---|---|---|
| "real-time collaborative" | True | `postgres_changes` on tasks, columns, board_members and boards: [hooks/use-realtime.ts#L221-L257](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/hooks/use-realtime.ts#L221-L257) |
| "project-management application" | True | Tasks have priority, labels, due date and assignee: [schema.prisma#L190-L219](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/prisma/schema.prisma#L190-L219) |
| "WebSocket synchronization" | Misleading | It's Supabase Realtime, so the socket lives inside supabase-js. Events trigger a debounced refetch: [use-realtime.ts#L42-L51](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/hooks/use-realtime.ts#L42-L51), [#L133-L178](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/hooks/use-realtime.ts#L133-L178) |
| "drag-and-drop workflows" | True | Tasks within and across columns, saved as a fractional `position`: [board-view.tsx#L41-L106](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/%28dashboard%29/board/%5BboardId%5D/board-view.tsx#L41-L106), [task-actions.ts#L175-L196](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/actions/task-actions.ts#L175-L196). Columns can't be dragged |
| "role-based permissions" | True | `enum Role { OWNER EDITOR VIEWER }` with different server checks per role: [schema.prisma#L26-L30](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/prisma/schema.prisma#L26-L30), [lib/auth/require-access.ts#L64-L93](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/lib/auth/require-access.ts#L64-L93) |
| "optimistic UI updates" | Partly | Only task moves and board rename update first and roll back on error: [board-view.tsx#L55-L99](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/%28dashboard%29/board/%5BboardId%5D/board-view.tsx#L55-L99), [board-header.tsx#L67-L83](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/components/board/board-header.tsx#L67-L83) |
| Tag React | True, but incomplete | The framework is Next.js 16, which the tags left out |
| Tags WebSockets, Node.js | Misleading | No socket code and no Node server; the backend is Next.js Server Actions |
| Tag PostgreSQL | True | See stack table |

### Evidence for the new card

| New claim | Evidence |
|---|---|
| "Drag-and-drop boards" | `@hello-pangea/dnd` in [board-view.tsx#L141-L150](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/%28dashboard%29/board/%5BboardId%5D/board-view.tsx#L141-L150), [column.tsx#L250-L323](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/components/board/column.tsx#L250-L323) |
| "that sync live" | [use-realtime.ts#L221-L257](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/hooks/use-realtime.ts#L221-L257) |
| "with role-based access" | [schema.prisma#L26-L30](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/prisma/schema.prisma#L26-L30), [board-actions.ts#L104-L109](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/actions/board-actions.ts#L104-L109), [task-actions.ts#L178](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/app/actions/task-actions.ts#L178) |
| Tags Next.js, Supabase, Prisma, PostgreSQL | See stack table |

### Live demo

None. The README's demo link is a placeholder, and the README says "there is no deployment yet" ([README.md#L9-L14](https://github.com/lawry98/kanban-board/blob/d6037c4756c99091bcc099e62673a5a3d265ae82/README.md#L9-L14)). `kanban-board-lawry98.vercel.app` returns 404. `kanban-board.vercel.app` returns 200, but it is someone else's create-react-app page titled "React App". Don't link it.

## Repos not on the site

| Repo | What the code shows | Verdict |
|---|---|---|
| nudge-ai | Solo Django REST + Next.js 14 procrastination coach. Claude (`claude-sonnet-4-6`) answers in a per-task chat and suggests 1–2 next steps ([backend/core/views.py#L13-L19](https://github.com/lawry98/nudge-ai/blob/3144510cab6db48b50ebdf1d3bcd4a1493f78e02/backend/core/views.py#L13-L19), [#L88-L108](https://github.com/lawry98/nudge-ai/blob/3144510cab6db48b50ebdf1d3bcd4a1493f78e02/backend/core/views.py#L88-L108)). The opening "nudge" is a fixed template, the AI-tone setting is never read, and the API URL is hard-coded to localhost. No screenshots | Maybe |
| cv-final-project | CS5330 team of 3, a single notebook with no README. Fine-tuned YOLOv5 and YOLOv8; YOLOv8m reached mAP@50 0.632 at 6.9 ms per image on a P100 ([notebook#L2558-L2562](https://github.com/lawry98/cv-final-project/blob/050373497bfbdc7dd60a12ee0d545b1826191e0b/cv-final%20%283%29%20%281%29.ipynb?plain=1#L2558-L2562)) | Maybe, after a README with team credit |
| Others | Practice log, tutorial CRUD, an unfinished clone, and 100xdevs cohort forks | No |

## src/data/skills.ts (flag only, not changed)

Two technologies on the new cards are missing from `src/data/skills.ts`: Prisma (kanban-board uses it for every read and write) and FastAPI (the f1-application backend).

## Screenshots found (for a follow-up)

| Repo | Candidates |
|---|---|
| f1-application | `frontend/assets/teardown-frames/frame_0000.png` (clean car) and `frame_0191.png` (cutaway, glowing engine), 800×420; `frontend/public/models/f1-car.glb` (CC BY 4.0, credited in `CREDITS.md`) |
| codereview-ai | None. Only create-next-app SVGs |
| kanban-board | None. The README links 4 placeholders under `docs/screenshots/` that don't exist |
| nudge-ai | None tracked; `frontend/test-screenshots/` is gitignored |
| cv-final-project | 22 inline notebook outputs (detection grids, PR curves) |

## Method

- Code and manifests were read at the pinned SHAs through `gh api repos/lawry98/<repo>/contents/...` and shallow clones.
- Each repo's head was re-checked against its pinned SHA before writing. kanban-board then moved to `af8c43c` (accessibility commits). `compare` shows none of the files cited here changed, so the pinned links still describe `main`.
- For deployments, each repo was checked for `gh api repos/lawry98/<repo>/deployments`, its `homepage` field, any deploy config, and URLs in the README, docs and env examples.
- Every URL found, and the obvious `<repo>.vercel.app` and `<repo>-lawry98.vercel.app` guesses, was fetched with `curl -sL` and identified by its page title and content.
- Card fit was measured in headless Chrome against `next start`. The real description was swapped in for each candidate, and `scrollHeight <= clientHeight` was checked on the clamped `<p>` at 19 widths from 320 to 1440 px.
