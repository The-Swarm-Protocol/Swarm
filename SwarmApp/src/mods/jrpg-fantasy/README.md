# JRPG Fantasy Mod

16-bit SNES-era Final Fantasy UI skin for Swarm. Transforms the entire dashboard into a retro JRPG command center with pixel fonts, dialog boxes, party stats, and quest menus.

## Features

- **Pixel font** (Press Start 2P) loaded only when skin is active
- **JRPG dialog boxes** — Classic FF-style blue gradient + white pixel border on all cards
- **Party stats header** — HP/MP bars, gold counter, guild name
- **Quest menu sidebar** — `▶` cursor indicators, JRPG section labels
- **Dark fantasy starfield** — Animated star background with vignette
- **Label remapping** — Agents → Party Members, Tasks → Quests, Marketplace → Item Shop
- **Custom pixel cursor** — Sword cursor PNG
- **Gold/cyan color palette** for charts and effects

## Files

| File | Location | Purpose |
|------|----------|---------|
| SkinContext entry | `src/contexts/SkinContext.tsx` | Skin registration |
| SKILL_REGISTRY entry | `src/lib/skills.ts` | Marketplace listing |
| Chart palette | `src/components/charts/chart-theme.ts` | Chart colors |
| CSS skin block | `src/app/globals.css` | 300+ lines of `.skin-jrpg` CSS |
| JrpgContext | `src/contexts/JrpgContext.tsx` | Label remapping |
| JrpgSidebar | `src/components/jrpg/jrpg-sidebar.tsx` | Custom sidebar |
| JrpgHeader | `src/components/jrpg/jrpg-header.tsx` | Custom header |
| JrpgBackground | `src/components/jrpg/jrpg-background.tsx` | Custom background |
| JrpgDialogBox | `src/components/jrpg/jrpg-dialog-box.tsx` | Reusable dialog wrapper |
| DashboardShell | `src/components/dashboard-shell.tsx` | Skin-aware layout switcher |
| Pixel cursor | `public/jrpg-cursor.png` | Custom cursor asset |

## JRPG Label Map

| Standard | JRPG |
|----------|------|
| Command | Guild Hall |
| Deploy | Summon |
| Coordinate | Quest Board |
| Platform | Kingdom |
| Modifications | Enchantments |
| Fleet | Party Members |
| Marketplace | Item Shop |
| Channels | Tavern |
| Scheduler | Time Magic |
| Organizations | Kingdoms |
| Cerebro | Oracle |
