# XCollab — Cross-Team Workflow Intelligence

**A prompt-first, AI-native program management platform built for EDGE Group and its secure-communications subsidiary Katim.**

Describe a project in one prompt — or attach a PRD — and XCollab's AI architect designs the entire program: teams, work-breakdown packages, tasks, milestones, risks, and the dependency chain. Then run it: discuss work where the work lives, route approvals with recorded verdicts, triage a real inbox, and watch every window stay in sync in real time.

---

## The experience

**The first screen is a prompt, not a dashboard.** Open XCollab and it asks: *"What are you building?"* Type something like:

> *I am developing a project called XCollab — a cross-team collaboration platform. Timeline is 3 weeks. Teams: design and QA, plus whoever else you think we need.*

…optionally attach a PRD (`.md` / `.txt`), press **Create the program**, and land on a fully populated workspace. The generator honors your project name, timeline, and team choices. With an AI API key configured the design comes from a live model; without one, a built-in synthesizer parses the brief and produces a tailored plan — the flow works offline, always.

## Screens & features — everything functional, nothing mocked

| Screen | What it does |
|---|---|
| **Create** | Prompt-to-program onboarding: brief + PRD upload → complete program in the database, with animated build progress |
| **Dashboard** | Live program health: progress, burndown, team workloads, WBP health donut, open risks, upcoming milestones |
| **Inbox** | Real notification center — mentions, assignments, comment activity, approval verdicts — with per-item and bulk triage; unread badges in the sidebar and header bell |
| **Work Packages** | Interactive WBP tree with progress dials and task spines; each package opens a dossier: scope, tasks, milestones, risks, **approvals**, and a **discussion thread with @mention autocomplete** |
| **Kanban Board** | Drag & drop across columns (persisted, WIP limits), **assign tasks from the card** — assignees are notified |
| **Timeline** | Gantt-style schedule with month grid, health-colored bars, live TODAY marker, zoom |
| **Dependencies** | Cross-package dependency map with blocking-path highlighting |
| **Teams** | Org roster across internal teams and external vendors, filterable by role |
| **AI Assistant** | Program analyst grounded in live program data, plus the **Design a program** architect action |
| **Settings** | Working themes (Obsidian Dark / Signal Light / System), five brand accents (EDGE Orange, Katim Teal…), language |

**Cross-cutting:**
- **Real-time** — every surface polls the server; open two windows and watch comments, moves, and verdicts appear without a refresh
- **Multi-program** — programs coexist; switch from the breadcrumb, create new ones any time
- **Full English / Arabic** with correct RTL layout throughout
- **Approvals as first-class objects** — approve / request changes / reject, recorded with timestamps, never buried in comments

## Quick start

```bash
npm install
npx prisma generate
npm run dev          # http://localhost:3000
```

A seeded SQLite database ships in `db/custom.db` with two demo programs (BRAIN Network Encryptor and SAQR Counter-UAS Defense Grid). Reset the demo data any time:

```bash
sh scripts/demo-reset.sh
```

### AI configuration (optional)

The AI assistant and program architect work out of the box using built-in offline generation. To enable live model-backed replies and designs, set the API key in `.env` (see the comment there). The offline path keeps every demo functional with no network or key.

### Testing

```bash
npx tsc --noEmit     # strict type check
npm run lint         # eslint
npm run test:e2e     # 16 Playwright end-to-end tests
```

The e2e suite covers every screen, the comment→mention→notification pipeline, approval round-trips, drag-and-drop persistence, task assignment, prompt-to-program creation (verifying name, timeline, and team extraction), program switching, Arabic RTL, and a **two-browser real-time sync test**. Tests clean up after themselves and are deterministic across runs.

### Production build

```bash
npm run build
npm start            # standalone server on :3000
```

## Architecture

- **Next.js 16** (App Router, standalone output) · **React 19** · **TypeScript strict**
- **Prisma + SQLite** — programs, WBPs, tasks, comments, notifications, approvals, dependencies
- **TanStack Query** — shared cache, optimistic updates with reconciliation, polling-based real-time
- **Tailwind CSS 4** with a semantic design-token system (`--brand`, surface ramp, ink tiers) powering runtime theme and accent switching
- **dnd-kit** drag & drop · **framer-motion** · **Playwright** e2e
- REST API routes with zod validation: `/api/program`, `/api/programs`, `/api/tasks`, `/api/comments`, `/api/inbox`, `/api/approvals`, `/api/architect`, `/api/ai-chat`, `/api/me`

The current-user identity is resolved in one server-side function (`src/lib/collab.ts`) so a real authentication integration replaces a single seam.

## Scope & limitations (prototype)

- **No authentication yet** — the signed-in persona is the seeded program admin; API routes are open. Production would integrate EDGE identity infrastructure.
- Encryption at rest, audit logging, and the Jira/Slack/Teams integrations shown in Settings are roadmap items (labeled as such in the UI).
- Real-time uses short-interval polling; a production build would move to server-sent events or websockets behind the same hooks.

---

*Built for EDGE Group — Katim.*
