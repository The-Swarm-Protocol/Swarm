/** Sub-Clone Visual Effects — Particle bursts for agent sub-processes
 *
 * Adapted from Claw-Empire's model.ts emitSubCloneSmokeBurst / emitSubCloneFireworkBurst.
 * Provides purely data-driven particle systems for SVG rendering:
 *   - Smoke puffs on sub-clone spawn/despawn
 *   - Firework bursts at periodic intervals while sub-clones are working
 *   - Sweat/dizzy particles for overloaded agents
 */

import type { Position } from "../types";

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */

/** How often (in ticks) to emit firework bursts per sub-clone */
export const SUB_CLONE_FIREWORK_INTERVAL = 210;

/** Sub-clone sinusoidal drift parameters */
export const SUB_CLONE_WAVE_SPEED = 0.04;
export const SUB_CLONE_MOVE_X_AMPLITUDE = 0.16;
export const SUB_CLONE_MOVE_Y_AMPLITUDE = 0.34;
export const SUB_CLONE_FLOAT_DRIFT = 0.08;

/** Max visible sub-clones rendered per parent agent */
export const MAX_VISIBLE_SUB_CLONES = 3;

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

export interface SubCloneParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  rotation: number;
  spin: number;
  scale: number;
  growth: number;
  color: string;
  opacity: number;
  type: "smoke" | "flash" | "spark" | "text" | "sweat" | "dizzy" | "zzz";
  text?: string;
}

export interface SubCloneVisual {
  id: string;
  parentAgentId: string;
  /** Canvas position */
  position: Position;
  /** Base position before drift */
  basePosition: Position;
  /** Phase offset for sinusoidal animation */
  phase: number;
  /** Firework interval offset */
  fireworkOffset: number;
  /** Current aura opacity */
  auraOpacity: number;
  /** Current rotation */
  rotation: number;
  /** Scale multiplier */
  scale: number;
}

/* ═══════════════════════════════════════
   Particle ID Generator
   ═══════════════════════════════════════ */

let _particleIdSeq = 0;
function nextId(): number { return ++_particleIdSeq; }

/* ═══════════════════════════════════════
   Hash (deterministic from string)
   ═══════════════════════════════════════ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ═══════════════════════════════════════
   Smoke Burst (spawn / despawn)
   ═══════════════════════════════════════ */

export function emitSmokeBurst(
  x: number,
  y: number,
  mode: "spawn" | "despawn",
): SubCloneParticle[] {
  const particles: SubCloneParticle[] = [];
  const baseColor = mode === "spawn" ? "#c7d4ec" : "#b7bfd1";
  const puffCount = mode === "spawn" ? 9 : 7;

  // Smoke puffs
  for (let i = 0; i < puffCount; i++) {
    particles.push({
      id: nextId(),
      x: x + (Math.random() - 0.5) * 10,
      y: y - 14 + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * (mode === "spawn" ? 1.4 : 1.1),
      vy: -0.22 - Math.random() * 0.6,
      life: 0,
      maxLife: 20 + Math.floor(Math.random() * 12),
      rotation: 0,
      spin: (Math.random() - 0.5) * 0.1,
      scale: 1,
      growth: 0.013 + Math.random() * 0.012,
      color: baseColor,
      opacity: 0.62 + Math.random() * 0.18,
      type: "smoke",
    });
  }

  // Center flash
  particles.push({
    id: nextId(),
    x,
    y: y - 14,
    vx: 0,
    vy: -0.16,
    life: 0,
    maxLife: mode === "spawn" ? 14 : 12,
    rotation: 0,
    spin: 0,
    scale: 1,
    growth: 0.022,
    color: "#f8fbff",
    opacity: mode === "spawn" ? 0.52 : 0.42,
    type: "flash",
  });

  // Burst text
  particles.push({
    id: nextId(),
    x,
    y: y - 24,
    vx: (Math.random() - 0.5) * 0.35,
    vy: -0.3,
    life: 0,
    maxLife: mode === "spawn" ? 18 : 16,
    rotation: 0,
    spin: (Math.random() - 0.5) * 0.04,
    scale: 1,
    growth: 0.004,
    color: mode === "spawn" ? "#eff4ff" : "#dde4f5",
    opacity: 1,
    type: "text",
    text: "\u2728",
  });

  return particles;
}

/* ═══════════════════════════════════════
   Firework Burst (periodic while working)
   ═══════════════════════════════════════ */

const FIREWORK_COLORS = ["#ff6b6b", "#ffc75f", "#7ce7ff", "#8cff9f", "#d7a6ff"];

export function emitFireworkBurst(x: number, y: number): SubCloneParticle[] {
  const particles: SubCloneParticle[] = [];
  const sparkCount = 10;

  for (let i = 0; i < sparkCount; i++) {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.45;
    const speed = 0.9 + Math.random() * 0.85;

    particles.push({
      id: nextId(),
      x: x + (Math.random() - 0.5) * 5,
      y: y + (Math.random() - 0.5) * 3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.45,
      life: 0,
      maxLife: 16 + Math.floor(Math.random() * 8),
      rotation: 0,
      spin: (Math.random() - 0.5) * 0.08,
      scale: 1,
      growth: 0.006 + Math.random() * 0.006,
      color,
      opacity: 0.96,
      type: "spark",
    });
  }

  return particles;
}

/* ═══════════════════════════════════════
   Stress Particles (overloaded agents)
   ═══════════════════════════════════════ */

export function emitSweatDrop(x: number, y: number): SubCloneParticle {
  return {
    id: nextId(),
    x: x + 8,
    y: y - 36,
    vx: 0,
    vy: 0.45,
    life: 0,
    maxLife: 38,
    rotation: 0,
    spin: 0,
    scale: 1,
    growth: 0,
    color: "#7ec8e3",
    opacity: 0.85,
    type: "sweat",
  };
}

export function emitDizzyStar(x: number, y: number): SubCloneParticle {
  return {
    id: nextId(),
    x,
    y: y - 22,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 38,
    rotation: 0,
    spin: 0,
    scale: 1,
    growth: 0,
    color: "#ffdd44",
    opacity: 0.8,
    type: "dizzy",
  };
}

export function emitSleepyZ(x: number, y: number): SubCloneParticle {
  return {
    id: nextId(),
    x: x + 6,
    y: y - 18,
    vx: 0,
    vy: -0.3,
    life: 0,
    maxLife: 60,
    rotation: 0,
    spin: 0,
    scale: 0.8 + Math.random() * 0.4,
    growth: 0,
    color: "#aaaacc",
    opacity: 1,
    type: "zzz",
    text: "z",
  };
}

/* ═══════════════════════════════════════
   Working Particles (sparkle while active)
   ═══════════════════════════════════════ */

const WORK_SPARKLE_COLORS = ["#55aaff", "#55ff88", "#ffaa33", "#ff5577", "#aa77ff"];

export function emitWorkSparkle(x: number, y: number): SubCloneParticle {
  return {
    id: nextId(),
    x: x + (Math.random() - 0.5) * 24,
    y: y - 16 - Math.random() * 8,
    vx: Math.sin(Math.random() * Math.PI * 2) * 0.2,
    vy: -0.4 - Math.random() * 0.3,
    life: 0,
    maxLife: 35,
    rotation: 0,
    spin: 0,
    scale: 1,
    growth: -0.02,
    color: WORK_SPARKLE_COLORS[Math.floor(Math.random() * WORK_SPARKLE_COLORS.length)],
    opacity: 1,
    type: "spark",
  };
}

/* ═══════════════════════════════════════
   Tick Particles
   ═══════════════════════════════════════ */

/**
 * Advance all particles by one tick. Returns surviving particles.
 */
export function tickParticles(particles: SubCloneParticle[]): SubCloneParticle[] {
  const surviving: SubCloneParticle[] = [];
  for (const p of particles) {
    const next = { ...p };
    next.life += 1;

    if (next.life >= next.maxLife) continue;

    // Physics
    next.x += next.vx;
    next.y += next.vy;
    next.rotation += next.spin;
    next.scale = Math.max(0.1, next.scale + next.growth);
    next.opacity = Math.max(0, 1 - next.life / next.maxLife);

    // Type-specific overrides
    if (next.type === "sweat") {
      next.x += Math.sin(next.life * 0.15) * 0.15;
      next.opacity = Math.max(0, 0.85 - next.life * 0.022);
    } else if (next.type === "dizzy") {
      // Orbital motion handled by renderer using tick
      next.opacity = 0.7 + Math.sin(next.life * 0.1) * 0.3;
    }

    surviving.push(next);
  }
  return surviving;
}

/* ═══════════════════════════════════════
   Sub-Clone Drift Animation
   ═══════════════════════════════════════ */

/**
 * Compute drifted position for a sub-clone at a given tick.
 */
export function computeSubCloneDrift(
  base: Position,
  phase: number,
  tick: number,
): { position: Position; rotation: number; auraOpacity: number; scale: number } {
  const wave = tick * SUB_CLONE_WAVE_SPEED + phase;
  const driftX =
    Math.sin(wave * 0.7) * SUB_CLONE_MOVE_X_AMPLITUDE +
    Math.cos(wave * 0.38 + phase * 0.6) * SUB_CLONE_FLOAT_DRIFT;
  const driftY =
    Math.sin(wave * 0.95) * SUB_CLONE_MOVE_Y_AMPLITUDE +
    Math.cos(wave * 0.52 + phase) * (SUB_CLONE_FLOAT_DRIFT * 0.65);

  return {
    position: { x: base.x + driftX, y: base.y + driftY },
    rotation: Math.sin(wave * 1.45 + phase) * 0.045,
    auraOpacity: 0.1 + (Math.sin(wave * 0.9) + 1) * 0.06,
    scale: 1 + Math.sin(wave * 1.7) * 0.01,
  };
}

/**
 * Check if a firework should be emitted this tick for a given sub-clone.
 */
export function shouldEmitFirework(tick: number, fireworkOffset: number): boolean {
  return (tick + fireworkOffset) % SUB_CLONE_FIREWORK_INTERVAL === 0;
}

/**
 * Create initial sub-clone visual state from a sub-agent.
 */
export function createSubCloneVisual(
  subId: string,
  parentAgentId: string,
  basePosition: Position,
  index: number,
): SubCloneVisual {
  return {
    id: subId,
    parentAgentId,
    position: { ...basePosition },
    basePosition: { ...basePosition },
    phase: (hashStr(subId) % 360) / 57.2958 + index * 0.3,
    fireworkOffset: Math.abs(hashStr(`${subId}:firework`)) % SUB_CLONE_FIREWORK_INTERVAL,
    auraOpacity: 0.12,
    rotation: 0,
    scale: 1,
  };
}
