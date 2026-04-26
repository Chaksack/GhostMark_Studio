# GhostMark Storefront — Agents, Skills, and MCP Catalog

Reference deliverable for v15. Date: 2026-04-26. Stack scope: Nuxt 3 (4.4.2) + Vue 3.5 + Tailwind 3.4 + @nuxtjs/medusa SDK + vue-konva print editor; Medusa v2 backend in `ghostmark-backend/`; 3-mode commerce model (D2C `/shop`, B2B `/studio`, POD per-unit).

---

## Section 1 — Subagent types (Agent tool)

The Agent tool dispatches one of the named `subagent_type` workers. Group, summary, GhostMark dispatch use, when-not, and edit access listed per agent.

### Engineering

| subagent_type | Summary | Dispatch in GhostMark for | When NOT | Edits files |
|---|---|---|---|---|
| `backend-principal-engineer` | Senior backend lead for distributed systems, infra, and complex API surfaces. | Medusa v2 module customization (custom 3-mode pricing logic, Stripe Connect for POD payouts, region-tax rules). | Trivial CRUD or single-route fixes — overkill. | Yes |
| `frontend-principal-engineer` | Senior frontend lead for Nuxt/Vue architecture and SSR/hydration topology. | Print-editor (vue-konva) state model, route-rules redesign for `/shop` vs `/studio`, hydration audit on PDP. | Single-component CSS tweaks. | Yes |
| `data-principal-engineer` | Pipelines, warehousing, analytics schemas. | Order/quote analytics warehouse if/when GhostMark needs B2B revenue dashboards. | Storefront-only work. | Yes |
| `platform-principal-engineer` | Build/deploy/infra/observability platforms. | CI on Vercel/Cloudflare for storefront, Trustpilot/3rd-party widget integration, edge image optimisation. | UI styling tasks. | Yes |
| `security-principal-engineer` | AppSec, secrets, threat modeling. | Reviewing Medusa auth flows, Stripe webhook verification, customer PII handling on `/account`. | Cosmetic UI changes. | Yes |
| `qa-principal-engineer` | E2E/perf/regression test architecture. | Playwright suite for cart -> checkout -> success on all 3 modes; visual regression for redesign. | Single bug repro. | Yes |
| `principal-architect` | Cross-cutting system design, ADRs, contract definition. | Defining the 3-mode commerce contract (data model + pricing rules across `/shop`/`/studio`/POD). | Implementation work — architect decides, doesn't ship code. | Yes (mostly docs/ADRs) |
| `ios-principal-engineer` | Native iOS / SwiftUI. | Not applicable — GhostMark is a web storefront. | All current work. | Yes |
| `senior-backend-engineer` | Mid-tier backend implementation. | Standard Medusa endpoints, region/cart/quote handlers. | Architectural decisions. | Yes |
| `senior-frontend-engineer` | Mid-tier Nuxt/Vue implementation. | New Vue components, page sections, Tailwind composition, Pinia stores. | Print-editor canvas math (escalate to principal). | Yes |

### Design

| subagent_type | Summary | Dispatch in GhostMark for | When NOT | Edits files |
|---|---|---|---|---|
| `ux-ui-designer` | Wireframes, IA, interaction models, design rationale. | Discover/Brands flow IA, mobile sticky cart-bar tablet behavior, /studio quote-builder UX. | Brand visuals/illustration work. | Yes (design specs) |
| `senior-graphics-designer` | Visual identity, brand assets, hero artwork, typography systems. | Custom photography brief, hero imagery direction, brand-mark refresh, OG/social cards. | Functional UI logic. | Yes |

### Process

| subagent_type | Summary | Dispatch in GhostMark for | When NOT | Edits files |
|---|---|---|---|---|
| `project-manager-technical` | Task breakdown, dependency mapping, RAID, sprint planning. | Composing the v15 outstanding-work plan, sequencing imagery + Trustpilot + sticky-cart fixes. | Direct implementation. | No (planning artefacts only) |
| `claude-code-guide` | Meta-guidance on using Claude Code itself, settings, hooks. | Tightening `.claude/settings.json` permissions/hooks for the storefront repo. | Product code. | Yes (config only) |

### Read-only

| subagent_type | Summary | Dispatch in GhostMark for | When NOT | Edits files |
|---|---|---|---|---|
| `Explore` | Fast multi-file structural reconnaissance. | "Where is region detection wired?" "What stores touch cart state?" | When you need a fix, not a map. | No |
| `Plan` | Read-only planner that produces an executable plan from a goal. | Producing the implementation plan for Discover/Brands routing rewrite. | When the plan is already written. | No |
| `general-purpose` | Catch-all read+research worker for ambiguous tasks. | "Audit all places `useRegion` is called" type sweeps. | When a specialist exists — pick them instead. | Yes |

### Special

| subagent_type | Summary | Dispatch in GhostMark for | When NOT | Edits files |
|---|---|---|---|---|
| `statusline-setup` | Configures Claude Code's status line. | One-time DX polish for the storefront repo. | Product work. | Yes (config) |
| `superpowers:code-reviewer` | Structured PR review with verification-before-completion discipline. | Reviewing every PR before merge — especially the redesign branch. | Drafts/WIP. | No (comments) |

---

## Section 2 — Skills (local /skills catalog)

Filtered from 938 installed skills to the ~42 that apply to a Nuxt storefront with a Medusa backend. Security/forensics/IR/blockchain/iOS-pentest skills omitted.

### Frontend / Vue / Nuxt / Tailwind

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:nuxt4-patterns` | Nuxt 4 hydration, route rules, SSR-safe data fetching. | Auditing useFetch/useAsyncData on PDP and PLP for hydration mismatches. |
| `skills:frontend-patterns` | React/Next/state/perf patterns (translatable to Vue idioms). | Pinia store shape decisions for cart + quote-builder. |
| `skills:frontend-design` | Production-grade distinctive UI generation. | Building new marketing sections (Discover, Brands hub) without generic AI look. |
| `skills:design-system` | Generate/audit DS, visual consistency, styling PR review. | Auditing Tailwind token sprawl; reviewing the redesign branch's spacing/colour drift. |
| `skills:impeccable` | UX/visual hierarchy/IA/anti-pattern frontend critique. | Polishing the redesign — typography rhythm, empty states, motion taste. |
| `skills:frontend-slides` | Animation-rich HTML deck builder. | If GhostMark needs an investor / sales-pitch deck. |

### Accessibility

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:accessibility` | WCAG 2.2 AA implementation and audit; semantic ARIA. | A11y pass on cart drawer, quote-builder dialog, print-editor canvas controls. |
| `skills:click-path-audit` | Trace every button through full state-change sequence. | Catching state bugs in cart/region switcher where actions individually work but cancel out. |

### Testing / QA

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:e2e-testing` | Playwright POM, CI artefacts, flake strategies. | Building the /shop, /studio, POD checkout E2E suite. |
| `skills:browser-qa` | Visual & interaction verification post-deploy. | Smoke-checking the redesign on staging across breakpoints. |
| `skills:tdd-workflow` | Red-green-refactor with 80%+ coverage targets. | Adding new server routes or quote-pricing logic. |
| `skills:ai-regression-testing` | Sandbox API testing, AI-blind-spot bug-checks. | Catching regressions where the same model both wrote and "verified" a redesign change. |
| `skills:ui-demo` | Polished Playwright walkthrough recordings. | Producing the v15 launch walkthrough video. |

### Performance / SEO

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:benchmark` | Perf baselines and before/after PR comparisons. | LCP/CLS measurement on PDP after the hero refactor. |
| `skills:seo` | Technical SEO, structured data, Core Web Vitals, content strategy. | Product schema, sitemap, OG, canonicals across the 3-mode catalogue. |

### Backend / API / Medusa

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:api-design` | REST patterns, naming, status, pagination, errors, versioning. | Designing `/api/quote` and POD pricing endpoints. |
| `skills:api-connector-builder` | Add a new connector matching the repo's existing integration pattern. | Adding Trustpilot or analytics provider as a Medusa module/Nuxt plugin. |
| `skills:backend-patterns` | Node/Express/Next API route patterns, DB optimisation. | Custom Medusa workflow steps and DB index decisions. |
| `skills:customer-billing-ops` | Subscriptions/refunds/churn/billing portal ops on Stripe. | If/when GhostMark adds subscriptions for repeat-print B2B accounts. |
| `skills:hexagonal-architecture` | Ports & Adapters, dependency inversion. | Isolating the print-editor's domain logic from vue-konva's adapter surface. |
| `skills:deployment-patterns` | CI/CD, Docker, health checks, rollback. | Vercel/Cloudflare deploy pipeline + Medusa container hardening. |

### Content / Copy / Brand

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:brand-voice` | Source-derived voice profile reused across content. | Locking GhostMark's tone for product copy, emails, testimonials placeholders. |
| `skills:article-writing` | Long-form polished content. | Blog/Discover articles, "How POD works" explainer. |
| `skills:content-engine` | Platform-native content systems and calendars. | Launch campaign across IG/X/LinkedIn for redesign reveal. |
| `skills:crosspost` | Per-platform adaptation (X/LinkedIn/Threads/Bluesky). | Distributing the v15 launch announcement. |

### Imagery / Media

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:fal-ai-media` | Text-to-image/video/audio via fal.ai. | Generating placeholder hero/lifestyle imagery while real photography is in production. |

### Research

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:deep-research` | Multi-source cited research via firecrawl + exa. | Trustpilot widget options, B2B print pricing benchmarks. |
| `skills:exa-search` | Neural web/code/company search. | Competitor scan in custom-print + POD space. |
| `skills:documentation-lookup` | Live framework docs via Context7. | Looking up Nuxt 3, Tailwind 3.4, Medusa v2, vue-konva APIs while coding. |
| `skills:market-research` | Market sizing, competitor comparison, decision-oriented synthesis. | Sizing the B2B custom-print SAM for GTM messaging. |

### Process / Multi-agent

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:team-builder` | Interactive picker for parallel agent teams. | Composing the dispatch table in Section 4. |
| `skills:blueprint` | One-line objective -> multi-session multi-agent plan with adversarial review. | Planning the v16 print-editor v2 redesign. |
| `skills:dmux-workflows` | Multi-agent orchestration via dmux/tmux. | Running 3 agents in parallel (Discover routing, sticky cart, Trustpilot) on isolated worktrees. |
| `skills:agentic-engineering` | Eval-first execution, decomposition, cost-aware routing. | Choosing model tier per task in v15 polish. |
| `skills:search-first` | Search before coding — invokes researcher agent. | Before writing a Trustpilot widget — confirm an off-the-shelf component exists. |

### Code quality

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:coding-standards` | Cross-project naming/readability/immutability baseline. | Enforcing conventions across the redesign branch's new components. |
| `skills:codebase-onboarding` | Architecture map + starter CLAUDE.md for unfamiliar repos. | Onboarding a new agent (or human) into `ghostmark-backend/`. |
| `skills:repo-scan` | File-class audit, embedded library detection, HTML report. | License/embedded-asset audit before public launch. |
| `skills:safety-guard` | Block destructive operations in autonomous runs. | Mandatory when a `/loop` or scheduled agent touches Medusa DB or git history. |

### Misc but useful

| Skill | Summary | Use for THIS project when... |
|---|---|---|
| `skills:jira-integration` | Jira ticket retrieval, status, comments via MCP/REST. | If the team moves outstanding-work tracking into Jira. |
| `skills:knowledge-ops` | KB ingest/sync/search across files/MCP/vector/git. | Persisting the v15 review docs into a searchable KB for future rounds. |
| `skills:product-capability` | PRD-to-SRS capability planning exposing constraints + interfaces. | Spec'ing the B2B quote-to-order pipeline before dev starts. |
| `skills:product-lens` | Validate the "why" before building, run product diagnostics. | Pressure-testing whether Discover/Brands actually drives conversion before scoping it. |

Skipped (~895 skills): every forensics/IR/SIEM/EDR/AD/Cobalt Strike/Sliver/Havoc/Splunk/Volatility/malware-RE/blockchain/iOS-pentest/email-security-gateway/cloud-CIS-benchmark skill — none apply to a public-facing storefront.

---

## Section 3 — MCP servers

Active in this session and their relevance to GhostMark.

### Used / verified working

| Server | Tool prefix | Provides | GhostMark relevance |
|---|---|---|---|
| **Playwright** | `mcp__plugin_playwright_playwright__*` (and a second `mcp__playwright__*` instance) | Browser navigate, click, type, snapshot, screenshot, evaluate, console, network, resize, tabs, file upload. | VERIFIED: used every round to capture home/PDP/PLP at desktop+mobile, read console errors, inspect network. Primary visual-verification engine. |
| **Context7** | `mcp__plugin_context7_context7__*` and `mcp__context7__*` | `resolve-library-id`, `query-docs` / `get-library-docs` for live framework docs. | VERIFIED: pulls Nuxt 3, Tailwind 3.4, Vue 3.5, Medusa v2, HeadlessUI docs against current versions instead of training-data drift. |
| **JetBrains** | `mcp__jetbrains__*` | IDE-aware file read/write, refactor, search-by-regex/text/symbol, run configurations, project deps, DB query, file problems, reformat, rename refactor. | Partial use. High value for symbol-aware searches and rename refactors across the redesign branch. |
| **Skills catalog** | `mcp__skills__*` | `list_skills`, `read_skill`, `list_skill_files`, `read_skill_file`. | Used to build Section 2 of this catalog. |

### Available, used selectively

| Server | Tool prefix | Provides | GhostMark relevance |
|---|---|---|---|
| **IDE diagnostics** | `mcp__ide__getDiagnostics` | LSP/diagnostic surface from the editor. | Useful before commits to catch TS/Vue compile errors without `pnpm dev` round-trip. |
| **WebFetch / WebSearch** | top-level deferred | URL fetch and web search. | Trustpilot widget docs, competitor research where Context7 has no entry. |

### Listed but NOT applicable to this storefront project

| Server | Why not |
|---|---|
| `mcp__aws-documentation__*` | GhostMark deploy is Vercel/Cloudflare-leaning, not AWS-managed. Skip unless backend moves to ECS/Fargate. |
| `mcp__aws-terraform__*`, `mcp__terraform__*` | No Terraform IaC in this repo. |
| `mcp__kubernetes__*` | No k8s footprint. Medusa runs as a container, not on a cluster. |
| `mcp__claude_ai_Plaid_Developer_Tools__*` | No banking/ACH product surface. |
| `mcp__claude_ai_Wiz__*` | Cloud security posture mgmt — out of scope. |
| `mcp__claude_ai_Gmail__*`, `mcp__claude_ai_Google_Calendar__*`, `mcp__claude_ai_Google_Drive__*` | Personal-productivity OAuth shims; not part of storefront work. Could be useful if user wants to schedule launch comms. |

### Available, situational

| Server | Tool prefix | Provides | GhostMark relevance |
|---|---|---|---|
| **Cron / Schedule / Loop / Tasks** | `CronCreate`, `CronList`, `TaskCreate`, etc. | Schedule recurring or one-off agent runs; ad-hoc tasking. | "Re-audit redesign on staging every Monday" or "open cleanup PR in 2 weeks". |
| **Worktrees** | `EnterWorktree`, `ExitWorktree` | Isolated git worktrees for parallel agents. | Use whenever Section 4 dispatches >1 agent in parallel. |
| **Monitor / RemoteTrigger / PushNotification** | deferred | Process monitoring, remote triggers, notifications. | Watch a long Nuxt build, ping when staging deploy finishes. |
| **NotebookEdit** | deferred | Jupyter cell ops. | Not applicable. |

Note: `fal.ai` and Nutrient are NOT mounted as MCP servers in this session — `skills:fal-ai-media` is the access path (it bridges to fal). Trustpilot has no MCP — use Context7 + WebFetch.

---

## Section 4 — Recommended dispatch patterns for outstanding GhostMark work

Outstanding from v14 review: content/imagery, real testimonials, Trustpilot integration, mobile sticky cart bar at tablet, Discover/Brands routing, plus a couple of visual polish items. Dispatcher recommendations below.

| Outstanding work | Recommended agent | Recommended skills | Recommended MCP |
|---|---|---|---|
| Custom photography brief (hero, lifestyle, PDP gallery) | `senior-graphics-designer` | `skills:brand-voice`, `skills:design-system`, `skills:fal-ai-media` (AI placeholders while real shoot is in production) | — |
| Real testimonials sourcing (outreach, consent, transcript) | Manual / outside the agent roster | `skills:brand-voice` (placeholder copy that matches eventual real-voice tone) | — |
| Trustpilot integration (widget, schema, SSR safety) | `platform-principal-engineer` | `skills:api-connector-builder`, `skills:deployment-patterns`, `skills:nuxt4-patterns` (SSR-safe injection), `skills:seo` (review schema) | Context7 (Trustpilot widget docs), WebFetch (fallback) |
| Mobile sticky cart bar — tablet breakpoint regression | `senior-frontend-engineer` | `skills:impeccable`, `skills:click-path-audit`, `skills:accessibility` | Playwright (verify at 768/834/1024 viewports) |
| Discover/Brands routing (IA + page scaffolds) | `ux-ui-designer` then `senior-frontend-engineer` | `skills:product-lens` (validate first), `skills:nuxt4-patterns` (route rules), `skills:seo` (canonical/sitemap) | Context7 (Nuxt route rules), Playwright (post-build smoke) |
| Visual polish across redesign (typography rhythm, spacing drift) | `frontend-principal-engineer` (or design-system pass via senior-frontend) | `skills:design-system`, `skills:impeccable` | Playwright (before/after screenshots) |
| Pre-merge code review of the redesign branch | `superpowers:code-reviewer` | `skills:coding-standards`, `skills:design-system`, `skills:safety-guard` | JetBrains (symbol-aware diff context) |
| Playwright E2E suite for /shop, /studio, POD checkout | `qa-principal-engineer` | `skills:e2e-testing`, `skills:tdd-workflow`, `skills:ai-regression-testing` | Playwright, JetBrains |
| LCP/CLS perf pass on PDP after hero refactor | `frontend-principal-engineer` | `skills:benchmark`, `skills:nuxt4-patterns`, `skills:seo` | Playwright (Lighthouse evaluate) |
| Launch announcement content (blog + social) | (no engineering agent — content workflow) | `skills:article-writing`, `skills:content-engine`, `skills:crosspost`, `skills:brand-voice` | WebFetch / Exa via `skills:exa-search` |
| Pre-launch repo/license audit | `security-principal-engineer` | `skills:repo-scan`, `skills:safety-guard` | JetBrains (file enumeration) |
| Quote-to-order B2B spec (before any code) | `principal-architect` | `skills:product-capability`, `skills:hexagonal-architecture`, `skills:api-design` | Context7 (Medusa v2 workflow docs) |
| Parallel execution of 2+ above tasks | `project-manager-technical` orchestrator | `skills:dmux-workflows`, `skills:team-builder`, `skills:blueprint` | EnterWorktree (isolation), Monitor (status) |

### Dispatch heuristics

1. Prefer the most specialised agent first; escalate to principal only when complexity score >= 9 or risk crosses module boundaries.
2. Always pair an engineering agent with at least one quality skill (`skills:design-system`, `skills:accessibility`, or `skills:click-path-audit`) — the redesign has a known pattern of "looks done, regressed elsewhere".
3. For any agent run touching the Medusa DB, git history, or production deploy: attach `skills:safety-guard`.
4. For any parallel run of >=2 agents: use `EnterWorktree` per agent and orchestrate with `skills:dmux-workflows`.
5. Code review gate before merging the `redesign` branch: dispatch `superpowers:code-reviewer` — non-negotiable.

---

End of catalog. File saved at `/Users/ybk/GolandProjects/GhostMark_Studio/.playwright-mcp/review/v15-catalog/agents-skills-catalog.md`.
