/** 3D Scene Constants — Canvas/scale/animation parameters
 *
 * Adapted from Claw3D's retro-office/core/constants.ts.
 * All spatial constants for the 3D office rendering pipeline.
 */

/* ═══════════════════════════════════════
   Canvas & Scale
   ═══════════════════════════════════════ */

/** Canvas dimensions (2D grid units) */
export const CANVAS_W = 1800;
export const CANVAS_H = 1800;

/** Conversion factor: canvas units → Three.js world units */
export const SCALE = 0.018;

/** Editor snap grid size */
export const SNAP_GRID = 10;

/** Wall thickness in canvas units */
export const WALL_THICKNESS = 8;

/* ═══════════════════════════════════════
   Agent Parameters
   ═══════════════════════════════════════ */

/** Base walk speed (canvas units per tick) */
export const WALK_SPEED = 0.3;

/** Walk animation sine frequency */
export const WALK_ANIM_SPEED = 0.15;

/** Agent visual scale multiplier */
export const AGENT_SCALE = 1.75;

/** Agent collision radius (canvas units) */
export const AGENT_RADIUS = 20;

/** How quickly agents turn to face movement direction */
export const ROTATION_LERP = 0.12;

/** How quickly agents lerp toward target position */
export const POSITION_LERP = 0.15;

/* ═══════════════════════════════════════
   Animation Amplitudes
   ═══════════════════════════════════════ */

/** Walk bounce height multiplier */
export const WALK_BOUNCE_HEIGHT = 0.012;

/** Breathing animation amplitude */
export const BREATHE_AMPLITUDE = 0.003;

/** Breathing animation speed */
export const BREATHE_SPEED = 0.02;

/** Arm swing amplitude during walk */
export const ARM_SWING = 0.4;

/** Leg swing amplitude during walk */
export const LEG_SWING = 0.35;

/** Head bob amplitude */
export const HEAD_BOB = 0.015;

/** Sitting bounce amplitude */
export const SIT_BOUNCE = 0.005;

/* ═══════════════════════════════════════
   Ping Pong
   ═══════════════════════════════════════ */

export const PING_PONG_BALL_RADIUS = 0.055;
export const PING_PONG_TABLE_SURFACE_Y = 0.465;
export const PING_PONG_SESSION_MS = 60_000; // 1 minute

/* ═══════════════════════════════════════
   Special Rooms
   ═══════════════════════════════════════ */

/** Gym room boundaries (canvas units) */
export const GYM_ROOM_X = 1400;
export const GYM_ROOM_WIDTH = 350;

/** QA Lab boundaries */
export const QA_LAB_X = 1400;
export const QA_LAB_WIDTH = 300;

/* ═══════════════════════════════════════
   Navigation
   ═══════════════════════════════════════ */

/** A* grid cell size (canvas units) */
export const NAV_CELL_SIZE = 25;

/** Max A* iterations before giving up */
export const ASTAR_MAX_ITERATIONS = 5000;

/* ═══════════════════════════════════════
   Visual Systems
   ═══════════════════════════════════════ */

/** Heatmap update interval (ticks) */
export const HEATMAP_UPDATE_INTERVAL = 60;

/** Trail point max age (ticks) */
export const TRAIL_MAX_AGE = 300;

/** Nameplate update interval (ms) */
export const NAMEPLATE_UPDATE_INTERVAL = 400;

/* ═══════════════════════════════════════
   Day/Night Cycle
   ═══════════════════════════════════════ */

/** Total frames in one day/night cycle */
export const DAY_CYCLE_PERIOD = 300;

/** Number of keyframes in the cycle */
export const DAY_CYCLE_KEYFRAMES = 6;

/* ═══════════════════════════════════════
   Camera Defaults
   ═══════════════════════════════════════ */

/** Default FOV */
export const DEFAULT_FOV = 50;

/** Camera follow smoothing */
export const CAMERA_FOLLOW_LERP = 0.08;

/** Min/max zoom distances */
export const CAMERA_MIN_DISTANCE = 4;
export const CAMERA_MAX_DISTANCE = 30;

/* ═══════════════════════════════════════
   Persistence
   ═══════════════════════════════════════ */

/** localStorage key for furniture layout */
export const FURNITURE_STORAGE_KEY = "swarm-office-furniture-v1";
