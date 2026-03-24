# OpenClaw Office Sim Studio — Product Requirements Document

**Status:** Draft v2.0 (post-audit revision)
**Date:** 2026-03-24
**Author:** Swarm Core
**Mod ID:** `openclaw-office-sim`
**Pricing:** Tiered (Free 2D / Premium 3D+Studio)

---

## 1. Executive Summary

OpenClaw Office Sim Studio is a Swarm mod that transforms the dashboard into a living virtual office. AI agents become visible employees — sitting at desks, walking to meetings, blocked at whiteboards, sprinting through tool calls. Two synchronized views serve distinct needs: a **2D command-center map** for operational clarity, and a **3D immersive simulation** for cinematic explainability.

The premium tier adds a **generative design studio** where users create custom office environments: ComfyUI powers visual concept generation (themes, avatar portraits, VFX), and Meshy converts approved concepts into production 3D assets (GLB/GLTF). The result is an office that looks the way *you* designed it.

### Architecture Decision: Single Base + Donor Components

This mod is built on **one base project** with **targeted borrowing** from three donor projects — not a mashup of four frontends.

| Layer | Source | What We Take |
|-------|--------|-------------|
| **Base shell** | [openclaw-office](https://github.com/WW-AI-Lab/openclaw-office) | Perception engine, event pipeline (classify → aggregate → narrate → hold), dual 2D/3D rendering model, Zustand store shape, gateway adapter pattern, speech bubbles with streaming Markdown |
| **3D ideas** | [Claw3D](https://github.com/iamlukethedev/Claw3D) | Functional room semantics (gym=training, server=infra), credential-safe proxy architecture (browser → server → gateway), layout editor concept |
| **Ops panels** | [tenacitOS](https://github.com/carlosazaustre/tenacitOS) | Cost tracking pipeline pattern, session transcript viewer, heatmap activity feeds, multiple art style support |
| **Behavioral semantics** | [claw-empire](https://github.com/GreenSheep01201/claw-empire) | Department-based spatial organization, workflow packs, CEO oversight metaphor for task delegation, XP/progression concepts |
| **Premium differentiator** | ComfyUI + Meshy | Generative concept art → 3D asset pipeline. No other office-sim mod has this. |

**Why this split:**
- openclaw-office has the most architecturally mature event model. Building on its perception engine means one coherent state machine instead of gluing together four incompatible event systems.
- The other three repos contribute *design patterns and UX ideas*, not code. We don't import their frontends — we re-implement their best concepts within the openclaw-office architecture.
- ComfyUI + Meshy is the premium moat. The open-source repos are free. Our value-add is the generative studio.

---

## 2. Problem

### For Swarm Users
- **Agent activity is invisible.** Current dashboard shows agent lists and status badges — no spatial or temporal representation of what agents are doing, who they're collaborating with, or how work flows between them.
- **Multi-agent coordination is opaque.** When 3–6 agents run concurrently on sub-tasks, users cannot see parent-child hierarchy, collaboration sessions, or task handoff patterns without digging through logs.
- **No ambient monitoring.** Users must actively check dashboards. No "leave it on a second monitor" experience that passively communicates system health.
- **Status is binary.** Agents are "online" or "offline." No visual distinction between thinking, tool-calling, waiting, spawning sub-agents, or encountering errors.

### For the Market
- The open-source ecosystem (2,800+ combined stars in <5 weeks) proves demand. But every project is standalone, tightly coupled to OpenClaw's gateway. None embeds into an existing agent management platform.
- Users wanting this experience today must self-host a separate app, manage a WebSocket gateway, and context-switch between platforms.

---

## 3. Solution

### Tier 1: Free — "Watch Your Agents Work"
1. **2D Command-Center Map** — SVG floor plan, agent desks, status indicators, speech bubbles, collaboration lines, zone layout. Information-dense, low-resource, always-on.
2. **Agent Detail Drawer** — Click any agent to inspect status, current task, model, tool call count, logs.
3. **Basic Status Mapping** — 9 visual states (idle, active, thinking, tool_calling, speaking, error, blocked, offline, spawning).

### Tier 2: Premium ($9.99/mo) — "Run Your Office"
4. **3D Immersive Office** — React Three Fiber scene with procedural avatars, furnished rooms, A* pathfinding, ambient animations, spawn/despawn effects. Background mode pins the scene behind dashboard content.
5. **Ops Overlay Panels** — Slide-in panels for task board, cost metrics, terminal stream, session transcripts. Patterns borrowed from tenacitOS's ops dashboard approach.
6. **Functional Room Semantics** — Desk Area (working), Meeting Room (collaboration), Server Room (infra tasks), Break Room (idle), Gym (training/fine-tuning). Zone assignments driven by agent state — concept from Claw3D.
7. **Office Builder** — Drag-and-drop 2D editor for arranging desks, rooms, furniture. Snap-to-grid, rotation, templates. Persisted per-org.

### Tier 3: Studio ($19.99/mo) — "Design Your Office"
8. **ComfyUI Concept Generator** — Node-based generative workflow for office themes, avatar portraits, VFX concepts, texture ideation. Runs on user's ComfyUI instance or Swarm's hosted endpoint.
9. **Meshy Asset Generator** — Text-to-3D and image-to-3D conversion. Approved ComfyUI concepts → production GLB/GLTF assets for the office scene.
10. **Asset Placement & Theme Manager** — Place generated assets in the office, save themes, share via marketplace.

---

## 4. Why This Is a Mod, Not a Core Feature

| Criterion | Assessment |
|-----------|-----------|
| **Required for base functionality?** | No. Swarm's agent management works without spatial visualization. |
| **Resource footprint** | 3D rendering adds ~500KB+ to bundle + continuous GPU. Not appropriate for all users. |
| **Audience** | Power users running 3+ concurrent agents. Single-agent users don't need this. |
| **Maintenance surface** | 3D scenes, pathfinding, avatar systems, generative pipelines — all orthogonal to core dashboard. |
| **Revenue opportunity** | Three-tier pricing captures casual users (free 2D), power users ($9.99 3D+ops), and creative users ($19.99 studio). |
| **Precedent** | All four reference projects ship as standalone apps, confirming this is a discrete product surface. |

---

## 5. Target Users

### P1 — Solo Developer ("The Builder")
- Runs 3–10 agents locally or on a single VPS
- Wants to **see** what each agent is doing without reading logs
- Needs quick context switches: "which agent is stuck?" → click → inspect → unblock
- **Tier:** Free (2D) or Premium (3D)

### P2 — Ops/Admin ("The Operator")
- Manages 10–50+ agents across an organization
- Needs filtering, search, batch operations, alerting
- Uses 2D view as command center — multiple monitors, always-on
- Cares about uptime, error rates, cost attribution
- **Tier:** Premium (ops panels + cost tracking)

### P3 — Demo/Pitch Presenter ("The Storyteller")
- Showing the system to investors, customers, executives
- Needs the 3D view to create a "wow" moment
- Wants cinematic experience: smooth camera, clean UI
- **Tier:** Premium (3D + background mode)

### P4 — Creative Designer ("The Worldbuilder")
- Wants the office to reflect a unique brand or aesthetic
- Explores style directions (cyberpunk, cozy startup, space station)
- Rapid iteration: prompt → generate → preview → approve → place
- **Tier:** Studio (ComfyUI + Meshy)

---

## 6. Functional Requirements

### 6.1 Base Layer (from openclaw-office architecture)

#### FR-1: Perception Engine
The core event-processing pipeline. All visual behavior derives from this.

```
Swarm Agent API (HTTP poll 5s / future WebSocket)
        │
        ▼
    Event Ingestion (normalize raw events to OfficeEvent schema)
        │
        ▼
    Event Classifier (lifecycle | tool | assistant | error × severity)
        │
        ▼
    Event Aggregator (group related events in 2s window)
        │
        ▼
    Narrative Generator (human-readable speech bubbles)
        │
        ▼
    Hold Controller (minimum 3s display, anti-flicker)
        │
        ▼
    State Machine (debounced agent state transitions)
        │
        ▼
    Office Store (Zustand → React components)
```

This is the single most important architectural decision. The perception engine is what makes an office sim feel *alive* rather than a status dashboard with sprites. openclaw-office's pipeline is the most mature implementation. We adopt its classify → aggregate → narrate → hold pattern exactly, replacing only the ingestion adapter (OpenClaw Gateway → Swarm Agent API).

#### FR-2: Agent Status Mapping
Map Swarm agent states to visual behaviors:

| Swarm State | Zone | Visual Cue | Speech Bubble |
|-------------|------|------------|---------------|
| `online` + idle | Desk (relaxed) | Green pulse | — |
| `online` + active task | Desk (typing) | Blue glow | "Working on: {task}" |
| `online` + thinking | Desk (leaned back) | Yellow spin | "Thinking..." |
| `online` + tool call | Desk (reaching) | Cyan flash | "Using {toolName}" |
| `online` + speaking | Desk (speech bubble) | White wave | Streaming content |
| `online` + error | Desk (red highlight) | Red shake | Error message |
| `busy` | Meeting/Server Room | Yellow indicator | "In session with {agents}" |
| `offline` | Empty desk | Gray, no avatar | — |
| `spawning` | Corridor → Desk | Portal spawn FX | "Initializing..." |
| `blocked` | Desk (frozen) | Amber pulse | "Waiting on: {reason}" |

#### FR-3: 2D Command-Center Map (Free Tier)
- SVG-rendered floor plan with configurable desk zones
- Agent avatars at assigned desks with deterministic appearance from agent ID hash
- Real-time status animations (pulse, spin, flash, wave, shake)
- Speech bubbles with narrative summaries (60-char max)
- Collaboration lines between agents sharing sessions (animated dash, opacity decay at 60s)
- Zone labels: Work Area, Meeting Room, Break Room, Server Room, Error Bay
- Click agent → Agent Detail Drawer
- Capacity: 6–24 agents (overflow to paginated list)
- Zoom/pan with scroll wheel + drag

#### FR-4: Agent Detail Drawer (Free Tier)
- Slide-in panel from right (400px)
- Shows: name, ASN, status badge, current task, assigned model, uptime, tool call count, last active
- Quick actions: retry, pause, view logs, reassign task
- Parent/child agent relationships
- Accessible from both 2D and 3D views

### 6.2 Premium Layer

#### FR-5: 3D Immersive Office
- React Three Fiber scene with orbit controls (default), first-person WASD (toggle)
- Procedural avatars: torso, head, arms, legs with status-colored emissive materials
- Furniture primitives: desks, chairs, monitors, server racks, plants, coffee machine, whiteboard
- A* grid-based pathfinding with furniture collision avoidance
- Smooth position lerp (0.15) and rotation lerp (0.12)
- Spawn animation (portal) on agent connect, despawn (fade) on disconnect
- Canvas at configurable opacity (100% dedicated, 35% background mode)
- `powerPreference: "low-power"`, fog, code-split via `dynamic({ ssr: false })`
- Day/night ambient lighting cycle (optional)

#### FR-6: Functional Room Semantics (from Claw3D)
Agents don't just sit at desks — they move to rooms based on what they're doing:

| Agent Activity | Room | Animation |
|---------------|------|-----------|
| Active task execution | Desk Area | Typing, screen glow |
| Shared session / collaboration | Meeting Room | Cluster around table, collaboration lines |
| Infrastructure / deployment tasks | Server Room | Interact with server racks |
| Idle, no tasks | Break Room | Relaxed pose, coffee machine |
| Skill installation / fine-tuning | Gym | Exercise/training animation |
| Error state | Error Bay | Red glow, distress animation |

Movement between rooms uses A* pathfinding with walk animations.

#### FR-7: Ops Overlay Panels (patterns from tenacitOS)
- **Task Board Overlay** — Kanban (Inbox → Planned → In Progress → Review → Done), drag-and-drop agent assignment, click task → highlight agent
- **Cost & Metrics Panel** — Token usage by agent (bar), cost trend (line), model breakdown (pie), budget alerts. Uses existing Swarm usage APIs.
- **Terminal Stream** — Live agent terminal output, last 100 lines, auto-scroll
- **Session Transcript Viewer** — Styled message bubbles (user/assistant/tool) with search and filter

#### FR-8: Office Builder
- 2D drag-and-drop editor for desk positions, rooms, furniture
- Snap-to-grid, rotation controls
- Templates: "Startup Loft" (open), "Corporate Floor" (cubicles), "Tech Lab" (server-heavy), "Creative Studio" (lounge-heavy)
- Persisted per-org to Firestore
- Export/import layouts as JSON

#### FR-9: Collaboration & Hierarchy (from claw-empire behavioral semantics)
- Parent-child relationships as connecting lines (2D: SVG paths, 3D: tube geometry)
- Sub-agents spawn at hot desks near parent
- Hierarchy depth → line thickness (d=1 thick, d=2 medium, d=3 thin)
- Workflow pack awareness: agents grouped by department/workflow type
- Task delegation visualization: CEO metaphor for orchestrator agents dispatching sub-tasks

### 6.3 Studio Layer (ComfyUI + Meshy — Premium Differentiator)

#### FR-10: ComfyUI Concept Generator
- Node-based visual workflow embedded in the Studio tab
- Prompt categories:
  - **Office Themes** — "cyberpunk office", "cozy startup loft", "space station command center"
  - **Avatar Portraits** — Agent-specific portraits from name + role + style prompt
  - **Furniture Concepts** — "neon desk with holographic monitors", "wooden farmhouse table"
  - **VFX Concepts** — Spawn effects, status auras, collaboration beam styles
  - **Texture Ideation** — Floor tiles, wall materials, ceiling patterns
- Connects to user's local ComfyUI instance or Swarm's hosted endpoint
- Gallery view of generated concepts with approve/reject/regenerate actions
- Approved concepts tagged for Meshy conversion

#### FR-11: Meshy Asset Generator
- Text-to-3D: generate 3D meshes from text descriptions
- Image-to-3D: convert approved ComfyUI concept art to GLB/GLTF
- Preview in 3D viewport before placement
- LOD (Level of Detail) variants for performance: high (editor), medium (3D view), low (background mode)
- Asset library: saved generated assets reusable across offices

#### FR-12: Asset Placement & Theme Manager
- Place generated 3D assets into the office via drag-and-drop
- Theme system: bundle of assets + layout + lighting into a named theme
- Theme gallery with preview thumbnails
- Publish themes to Swarm marketplace for other users
- Import community themes

---

## 7. Technical Architecture

### 7.1 Module Structure

```
src/components/mods/office-sim/
├── types.ts                    # Shared type definitions
├── office-store.ts             # React Context + useReducer store
├── OfficeProvider.tsx           # Provider: data fetching, polling, state dispatch
├── Office2D.tsx                # 2D SVG command-center view
├── Office3D.tsx                # 3D React Three Fiber scene
├── AgentDetailDrawer.tsx       # Agent inspection panel
├── engine/
│   ├── perception.ts           # Event classification + aggregation
│   ├── narrative.ts            # Human-readable activity summaries
│   ├── state-machine.ts        # Agent behavioral state transitions
│   └── hold-controller.ts      # Anti-flicker display duration
├── panels/
│   ├── TaskBoardOverlay.tsx    # Kanban task management
│   ├── CostMetricsPanel.tsx    # Usage/cost analytics
│   ├── TerminalStream.tsx      # Live terminal output
│   └── TranscriptViewer.tsx    # Session transcript
├── builder/
│   ├── OfficeBuilder.tsx       # Drag-and-drop layout editor
│   ├── FurniturePalette.tsx    # Furniture selection
│   └── GridCanvas.tsx          # Snap-to-grid placement
├── studio/                     # Premium: ComfyUI + Meshy
│   ├── ConceptGenerator.tsx    # ComfyUI workflow runner
│   ├── AssetGenerator.tsx      # Meshy text/image-to-3D
│   ├── AssetPlacer.tsx         # 3D drag-and-drop placement
│   └── ThemeManager.tsx        # Theme bundle CRUD
├── navigation/
│   ├── pathfinding.ts          # A* grid navigation
│   └── movement.ts             # Smooth interpolation
└── layouts/
    ├── startup-loft.json
    ├── corporate-floor.json
    ├── tech-lab.json
    └── creative-studio.json

src/app/(dashboard)/mods/office-sim/
├── page.tsx                    # Home dashboard
├── 2d/page.tsx                 # 2D office view
├── 3d/page.tsx                 # 3D office view
├── builder/page.tsx            # Office builder (premium)
├── studio/page.tsx             # Generative studio (studio tier)
└── replay/page.tsx             # Replay mode (premium)
```

### 7.2 Integration Points

| Swarm System | Integration | Data Flow |
|-------------|------------|-----------|
| Agent Status | `GET /api/agents?orgId=` | Poll 5s → perception engine → store |
| Task Management | Existing task/job APIs | Read assignments, write reassignments |
| Session/Logs | Existing log APIs | Stream to terminal panel |
| Usage/Cost | Existing usage APIs | Feed cost metrics panel |
| Org Context | `useOrg()` hook | Office layout scoped per-org |
| Mod System | `skills.ts` + sidebar | Registered with sidebarConfig |
| Firestore | Existing client | Persist layouts, avatar customizations, themes |
| ComfyUI | REST API (user-hosted or Swarm endpoint) | Concept generation requests/results |
| Meshy | REST API (API key stored per-org) | 3D asset generation requests/results |

### 7.3 State Management

Based on openclaw-office's Zustand-style store, adapted to React Context + useReducer (matching Swarm's existing patterns):

```typescript
interface OfficeState {
  agents: Map<string, VisualAgent>;
  collaborationLinks: CollaborationLink[];
  layout: OfficeLayout;
  viewMode: "2d" | "3d" | "background";
  activePanel: PanelType | null;
  selectedAgentId: string | null;
  connected: boolean;
  metrics: {
    activeCount: number;
    taskCount: number;
    errorCount: number;
  };
}

interface VisualAgent {
  id: string;
  name: string;
  status: AgentVisualStatus;
  position: Position;
  targetPosition: Position;
  zone: AgentZone;
  currentTask: string | null;
  speechBubble: string | null;
  parentAgentId: string | null;
  childAgentIds: string[];
  lastActiveAt: number;
  toolCallCount: number;
  model: string | null;
}
```

### 7.4 Performance Budget

| Metric | Target | Strategy |
|--------|--------|----------|
| Bundle size (mod) | < 800KB gzipped | Code-split 3D via `dynamic({ ssr: false })`, tree-shake Three.js |
| Initial load (2D) | < 1s | SVG renders instantly, data polling starts async |
| Initial load (3D) | < 3s | Lazy-load after 2D, progressive scene build |
| Frame rate (3D) | 30fps min | Low-poly primitives, 8-segment cylinders, fog culling, `powerPreference: "low-power"` |
| Memory (3D) | < 150MB | Shared materials, dispose on unmount |
| API polling | 5s interval | Batch agent + task in single request, debounce store |
| Agent capacity | 24 agents | Beyond 24, paginated list with top-8 in office view |

### 7.5 Dependencies

Already installed in Swarm:
- `three` (0.183), `@react-three/fiber` (9.5) — 3D rendering
- React Context + useReducer — state management (no Zustand needed)

New dependencies (Studio tier only, code-split):
- ComfyUI client SDK — REST API wrapper for workflow execution
- Meshy SDK — text-to-3D / image-to-3D API wrapper

---

## 8. MVP Scope (v1.0) — "Watch Your Agents Work"

**Goal:** Ship the free tier (2D + detail drawer) and core premium tier (3D office) with enough visual fidelity and operational utility to justify the premium price.

### Included in MVP

| Feature | Tier | Priority | Status |
|---------|------|----------|--------|
| 2D command-center map with status | Free | P0 | Done (basic) |
| Agent detail drawer | Free | P0 | Done (basic) |
| Status mapping (9 states) | Free | P0 | Done |
| 3D office with procedural avatars | Premium | P0 | Done (basic) |
| View toggle (2D / 3D) | Free | P0 | Done |
| Home dashboard with overview cards | Free | P0 | Done |
| Perception engine (classify → narrate) | Free | P1 | Pending |
| Speech bubbles with narratives | Free | P1 | Pending |
| Collaboration lines | Free | P1 | Pending |
| A* pathfinding (3D) | Premium | P1 | Pending |
| Spawn/despawn animations | Premium | P1 | Pending |
| Background mode (3D behind dashboard) | Premium | P1 | Pending |
| Cost metrics panel | Premium | P2 | Pending |
| 2 floor plan templates | Free | P2 | Done (1 template) |

### Excluded from MVP

- Office builder (v2.0)
- Functional room semantics with pathfinding (v2.0)
- Task board overlay (v2.0)
- Terminal stream / session transcript (v2.1)
- ComfyUI concept generator (v3.0)
- Meshy asset generator (v3.0)
- Theme manager / marketplace publishing (v3.0)
- Replay mode (v2.1)
- Avatar customization (v2.0)
- First-person WASD controls (v2.0)

---

## 9. Roadmap

### v1.0: "Watch" (Free + Premium Core)
MVP as scoped above. 2D floor plan, 3D scene, agent detail drawer, basic perception engine.

### v2.0: "Run" (Full Premium)
- **Perception Engine v2** — Full classify → aggregate → narrate → hold pipeline with configurable hold durations and custom narrative templates
- **Functional Room Semantics** — Agents move between rooms based on activity (from Claw3D patterns)
- **Office Builder** — Drag-and-drop layout editor with furniture palette
- **Ops Panels** — Task board, cost metrics, terminal stream (from tenacitOS patterns)
- **Behavioral Semantics** — Department grouping, workflow packs, task delegation visualization (from claw-empire patterns)
- **Avatar Customization** — Skin tone, hair, clothing, accessories
- **First-Person Mode** — WASD + mouse walk-through

### v2.1: "Observe"
- **Replay Mode** — Timeline scrubbing, playback speed control, event-by-event stepping
- **Session Transcripts** — Styled message bubbles (user/assistant/tool) with search
- **Meeting Gathering** — Agents auto-cluster in meeting room during shared sessions
- **Sub-Agent Hierarchy** — Animated spawn/retire lifecycle with hot desk assignment

### v3.0: "Create" (Studio Tier)
- **ComfyUI Integration** — Concept generator for themes, avatars, furniture, VFX
- **Meshy Integration** — Text/image-to-3D asset generation pipeline
- **Asset Placement** — Drag-and-drop generated assets into office
- **Theme Manager** — Bundle assets + layout + lighting into named themes
- **Marketplace Publishing** — Share/sell themes via Swarm marketplace

### v3.1: "Share"
- **Office Snapshots** — Capture and share state as image/video
- **Visitor Mode** — Read-only shareable link for stakeholders
- **Ambient Sound** — Optional office ambiance with volume control
- **Day/Night Cycle** — Real-clock or configurable lighting shifts

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **3D performance on low-end devices** | High | Medium | 2D free tier as fallback, `powerPreference: "low-power"`, agent cap at 24 |
| **Perception engine complexity** | Medium | High | Start with simplified mapping (v1), iterate to full pipeline (v2). The engine is the product — invest here |
| **ComfyUI/Meshy API stability** | Medium | Medium | Studio tier is v3.0, giving time for APIs to mature. Abstract behind adapter layer |
| **Office metaphor feels gimmicky** | Medium | High | Ops panels provide genuine utility. The office is the hook; the panels are the value |
| **Scope creep** | High | High | Strict tier gating. Ship free+premium before touching Studio |
| **Free tier cannibalization** | Low | Medium | 2D is useful but limited. 3D and ops panels are clearly premium value |
| **ComfyUI self-hosting barrier** | Medium | Low | Offer Swarm-hosted endpoint alongside BYO. Meshy is cloud-only (simpler) |

---

## 11. Key Performance Indicators

### Adoption
- **Mod activation rate** — % of eligible orgs (3+ agents) that install
- **Tier conversion** — Free → Premium → Studio conversion rates
- **Daily active users** per tier
- **View mode split** — 2D vs 3D vs background

### Engagement
- **Session duration** — target 15min+ (ambient monitoring signal)
- **Panel interaction rate** — % of sessions with agent detail clicks
- **Studio generation count** — concepts generated per studio user per month

### Revenue
- **MRR per tier** — Premium and Studio monthly recurring
- **Churn rate** — target <5% monthly
- **Studio asset marketplace GMV** — if/when theme selling launches

### Technical Health
- **3D frame rate p50/p95** — via `requestAnimationFrame` timing
- **Time to interactive** — office view fully loaded
- **Perception engine latency** — event ingestion → visual update delay
- **Error rate** — render errors, API timeouts, perception failures

---

## 12. Resolved Questions (from v1.0 audit)

1. **Architecture approach** — Single base (openclaw-office) + donor patterns (Claw3D, tenacitOS, claw-empire). Not a mashup of four frontends. **Resolved.**

2. **Pricing model** — Three tiers: Free (2D), Premium $9.99/mo (3D + ops), Studio $19.99/mo (generative pipeline). **Resolved.**

3. **Premium differentiator** — ComfyUI + Meshy generative studio. No other office-sim mod has this. All reference repos are free/open-source, so our value proposition must exceed what's freely available — generative customization does this. **Resolved.**

4. **Agent capacity** — 24 max in office view, paginated list for overflow. **Resolved.**

5. **WebSocket vs polling** — Start with 5s HTTP polling (sufficient for office metaphor). Add WebSocket adapter in v2 when Swarm supports it. **Resolved.**

## 13. Open Questions

1. **Demo/mock mode** — Should the mod include mock data for demos when no agents are running? All reference projects support this. Likely yes, but scope TBD.

2. **Cross-skin integration** — Should the office sim respect active skin themes (Mecha, JRPG, Pokemon)? E.g., mecha-themed furniture. High-impact but high-scope.

3. **ComfyUI hosting** — Swarm-hosted endpoint vs BYO-only for Studio tier. Hosting adds infrastructure cost but lowers adoption barrier.

4. **OpenClaw Gateway compatibility** — Should this mod speak the OpenClaw Gateway WebSocket protocol natively? Expands addressable market but increases complexity.

5. **Sound** — Ambient office audio. Ship silent, add opt-in in v3.1?

---

## Appendix A: Reference Repository Roles

### A.1 openclaw-office (WW-AI-Lab) — **BASE SHELL**
- **Role:** Primary architecture source. We adopt its perception engine, event pipeline, dual rendering model, and store shape.
- **Stars:** 419 | **License:** MIT
- **What we take:** classify → aggregate → narrate → hold pipeline, VisualAgent interface, gateway adapter pattern (rewritten for Swarm API), speech bubble streaming, 2D/3D view toggle architecture.
- **What we don't take:** OpenClaw-specific gateway protocol, React-specific UI components (we have our own design system).

### A.2 Claw3D (iamlukethedev) — **3D & BUILDER DONOR**
- **Role:** Design inspiration for 3D office features and layout editing.
- **Stars:** 633 | **License:** MIT
- **What we take:** Functional room semantics (zone = agent activity), credential-safe proxy pattern, A* pathfinding concept, immersive screen overlay ideas.
- **What we don't take:** Phaser rendering engine (we use R3F), voxel avatar system (we use procedural primitives), WebSocket proxy architecture (Swarm has its own auth).

### A.3 tenacitOS (carlosazaustre) — **OPS PANELS DONOR**
- **Role:** Design patterns for operational dashboard features.
- **Stars:** 909 | **License:** MIT
- **What we take:** Cost tracking pipeline concept, session transcript viewer pattern, heatmap activity feed design, multiple art style support as inspiration for theme system.
- **What we don't take:** 30+ API routes (we use Swarm's existing APIs), SQLite storage (we use Firestore), OS-desktop metaphor (we use office metaphor).

### A.4 claw-empire (GreenSheep01201) — **BEHAVIORAL SEMANTICS DONOR**
- **Role:** Design patterns for agent interaction and task management visualization.
- **Stars:** 850 | **License:** Apache 2.0
- **What we take:** Department-based spatial organization concept, workflow pack scoping, CEO oversight metaphor for orchestrator agents, task delegation visualization patterns.
- **What we don't take:** PixiJS renderer (we use R3F), company-sim game mechanics, XP system (deferred exploration).
