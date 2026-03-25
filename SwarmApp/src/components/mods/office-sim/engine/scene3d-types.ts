/** 3D Scene Types — Core data structures for Three.js/R3F office rendering
 *
 * Adapted from Claw3D's retro-office/core/types.ts and objects/types.ts.
 * Provides type definitions for 3D agents, furniture, navigation, and rendering.
 */

/* ═══════════════════════════════════════
   Agent Types
   ═══════════════════════════════════════ */

export type AgentState3D =
  | "walking"
  | "sitting"
  | "standing"
  | "away"
  | "working_out";

export type WorkoutStyle =
  | "run"
  | "lift"
  | "bike"
  | "box"
  | "row"
  | "stretch";

export type JanitorTool =
  | "broom"
  | "vacuum"
  | "floor_scrubber";

export type GymStage =
  | "door_outer"
  | "door_inner"
  | "workout";

export type BoothStage =
  | "door_outer"
  | "door_inner"
  | "using";

export interface RenderAgent {
  id: string;
  name: string;
  /** Current canvas position */
  x: number;
  y: number;
  /** Movement target */
  targetX: number;
  targetY: number;
  /** Waypoint path from A* */
  path: { x: number; y: number }[];
  /** Direction facing (radians) */
  facing: number;
  /** Animation frame counter */
  frame: number;
  /** Movement speed */
  walkSpeed: number;
  /** Current animation state */
  state: AgentState3D;
  /** Agent status from hub */
  status: "idle" | "working" | "error" | "offline" | "away";
  /** Agent color for UI indicators */
  color: string;
  /** Collision freeze timestamp */
  bumpedUntil?: number;
  /** Collision cooldown to prevent thrashing */
  collisionCooldownUntil?: number;

  /* ── Interaction states ── */
  /** Playing ping pong until this timestamp */
  pingPongUntil?: number;
  /** Gym interaction stage */
  gymStage?: GymStage;
  /** Current workout style */
  workoutStyle?: WorkoutStyle;
  /** Phone booth stage */
  phoneBoothStage?: BoothStage;
  /** SMS booth stage */
  smsBoothStage?: BoothStage;
  /** QA lab stage */
  qaLabStage?: BoothStage;
  /** Server room stage */
  serverRoomStage?: BoothStage;
  /** Janitor cleaning tool */
  janitorTool?: JanitorTool;
  /** Is this agent a janitor? */
  isJanitor?: boolean;

  /* ── Appearance ── */
  appearance?: AgentAppearance | null;
  /** Speech bubble text */
  speechText?: string | null;
  /** Whether to show speech bubble */
  showSpeech?: boolean;
}

/* ═══════════════════════════════════════
   Appearance Customization
   ═══════════════════════════════════════ */

export interface AgentAppearance {
  body: {
    skinTone: string;
  };
  hair: {
    style: "short" | "parted" | "spiky" | "bun" | "none";
    color: string;
  };
  clothing: {
    topStyle: "tshirt" | "hoodie" | "jacket";
    topColor: string;
    bottomStyle: "pants" | "shorts" | "cuffed";
    bottomColor: string;
    shoesColor: string;
  };
  accessories: {
    hatStyle: "none" | "cap" | "beanie";
    glasses: boolean;
    headset: boolean;
    backpack: boolean;
  };
}

/** Default appearance preset */
export const DEFAULT_APPEARANCE: AgentAppearance = {
  body: { skinTone: "#d8a06e" },
  hair: { style: "short", color: "#342016" },
  clothing: {
    topStyle: "tshirt",
    topColor: "#3b82f6",
    bottomStyle: "pants",
    bottomColor: "#1f2937",
    shoesColor: "#374151",
  },
  accessories: {
    hatStyle: "none",
    glasses: false,
    headset: false,
    backpack: false,
  },
};

/* ═══════════════════════════════════════
   Furniture Types
   ═══════════════════════════════════════ */

export type FurnitureType =
  // Desks & seating
  | "desk_cubicle"
  | "executive_desk"
  | "chair"
  | "couch"
  | "couch_v"
  | "beanbag"
  // Tables
  | "round_table"
  | "table_rect"
  | "pingpong"
  | "table_coffee"
  // Storage & display
  | "bookshelf"
  | "cabinet"
  | "whiteboard"
  // Kitchen
  | "fridge"
  | "stove"
  | "sink"
  | "dishwasher"
  | "coffee_machine"
  | "microwave"
  | "vending"
  | "water_cooler"
  // Office equipment
  | "printer"
  | "computer_screen"
  // Server room
  | "server_rack"
  | "server_terminal"
  // Gym
  | "treadmill"
  | "weight_bench"
  | "exercise_bike"
  | "punching_bag"
  | "rowing_machine"
  | "yoga_mat"
  // QA Lab
  | "qa_terminal"
  | "device_rack"
  | "test_bench"
  // Interactive machines
  | "atm"
  | "phone_booth"
  | "sms_booth"
  // Decorative
  | "plant"
  | "lamp"
  | "clock"
  | "trash"
  | "mug"
  | "keyboard"
  | "mouse"
  // Structure
  | "wall"
  | "door";

export interface FurnitureItem {
  /** Unique instance ID */
  _uid: string;
  type: FurnitureType;
  /** Canvas x position */
  x: number;
  /** Canvas y position */
  y: number;
  /** Width (for rectangular items) */
  w?: number;
  /** Height (for rectangular items) */
  h?: number;
  /** Radius (for circular items like round_table) */
  r?: number;
  /** Color tint override */
  color?: string;
  /** Facing direction in degrees */
  facing?: number;
  /** Z offset / elevation */
  elevation?: number;
}

/* ═══════════════════════════════════════
   Furniture Metadata
   ═══════════════════════════════════════ */

export interface FurnitureMetadata {
  /** Whether this item blocks the navigation grid */
  blocksNavigation: boolean;
  /** Default footprint [width, height] in canvas units */
  defaultSize: [number, number];
  /** 3D scale multiplier for GLB models */
  modelScale?: number;
  /** Default color tint */
  defaultColor?: string;
  /** Category for UI grouping */
  category: "seating" | "desk" | "table" | "storage" | "kitchen" | "equipment" | "gym" | "lab" | "interactive" | "decorative" | "structure";
}

export const ITEM_METADATA: Record<FurnitureType, FurnitureMetadata> = {
  desk_cubicle:    { blocksNavigation: true, defaultSize: [100, 55], category: "desk" },
  executive_desk:  { blocksNavigation: true, defaultSize: [120, 65], category: "desk" },
  chair:           { blocksNavigation: false, defaultSize: [24, 24], category: "seating" },
  couch:           { blocksNavigation: true, defaultSize: [100, 40], category: "seating" },
  couch_v:         { blocksNavigation: true, defaultSize: [40, 100], category: "seating" },
  beanbag:         { blocksNavigation: true, defaultSize: [36, 36], category: "seating" },
  round_table:     { blocksNavigation: true, defaultSize: [120, 120], category: "table" },
  table_rect:      { blocksNavigation: true, defaultSize: [80, 40], category: "table" },
  pingpong:        { blocksNavigation: true, defaultSize: [140, 80], category: "table" },
  table_coffee:    { blocksNavigation: true, defaultSize: [60, 60], category: "table" },
  bookshelf:       { blocksNavigation: true, defaultSize: [60, 20], category: "storage" },
  cabinet:         { blocksNavigation: true, defaultSize: [50, 24], category: "storage" },
  whiteboard:      { blocksNavigation: false, defaultSize: [80, 8], category: "equipment" },
  fridge:          { blocksNavigation: true, defaultSize: [36, 32], category: "kitchen" },
  stove:           { blocksNavigation: true, defaultSize: [40, 30], category: "kitchen" },
  sink:            { blocksNavigation: true, defaultSize: [30, 28], category: "kitchen" },
  dishwasher:      { blocksNavigation: true, defaultSize: [32, 30], category: "kitchen" },
  coffee_machine:  { blocksNavigation: true, defaultSize: [20, 20], category: "kitchen" },
  microwave:       { blocksNavigation: false, defaultSize: [24, 20], category: "kitchen" },
  vending:         { blocksNavigation: true, defaultSize: [40, 30], category: "kitchen" },
  water_cooler:    { blocksNavigation: true, defaultSize: [20, 20], category: "kitchen" },
  printer:         { blocksNavigation: true, defaultSize: [36, 30], category: "equipment" },
  computer_screen: { blocksNavigation: false, defaultSize: [24, 12], category: "equipment" },
  server_rack:     { blocksNavigation: true, defaultSize: [30, 24], category: "equipment" },
  server_terminal: { blocksNavigation: true, defaultSize: [36, 28], category: "equipment" },
  treadmill:       { blocksNavigation: true, defaultSize: [60, 30], category: "gym" },
  weight_bench:    { blocksNavigation: true, defaultSize: [50, 24], category: "gym" },
  exercise_bike:   { blocksNavigation: true, defaultSize: [40, 24], category: "gym" },
  punching_bag:    { blocksNavigation: true, defaultSize: [24, 24], category: "gym" },
  rowing_machine:  { blocksNavigation: true, defaultSize: [60, 24], category: "gym" },
  yoga_mat:        { blocksNavigation: false, defaultSize: [50, 24], category: "gym" },
  qa_terminal:     { blocksNavigation: true, defaultSize: [40, 28], category: "lab" },
  device_rack:     { blocksNavigation: true, defaultSize: [36, 24], category: "lab" },
  test_bench:      { blocksNavigation: true, defaultSize: [60, 30], category: "lab" },
  atm:             { blocksNavigation: true, defaultSize: [30, 24], category: "interactive" },
  phone_booth:     { blocksNavigation: true, defaultSize: [40, 40], category: "interactive" },
  sms_booth:       { blocksNavigation: true, defaultSize: [40, 40], category: "interactive" },
  plant:           { blocksNavigation: false, defaultSize: [16, 16], category: "decorative" },
  lamp:            { blocksNavigation: false, defaultSize: [12, 12], category: "decorative" },
  clock:           { blocksNavigation: false, defaultSize: [12, 12], category: "decorative" },
  trash:           { blocksNavigation: false, defaultSize: [14, 14], category: "decorative" },
  mug:             { blocksNavigation: false, defaultSize: [8, 8], category: "decorative" },
  keyboard:        { blocksNavigation: false, defaultSize: [24, 10], category: "decorative" },
  mouse:           { blocksNavigation: false, defaultSize: [8, 10], category: "decorative" },
  wall:            { blocksNavigation: true, defaultSize: [80, 8], category: "structure" },
  door:            { blocksNavigation: false, defaultSize: [40, 8], category: "structure" },
};

/* ═══════════════════════════════════════
   Camera & Lighting
   ═══════════════════════════════════════ */

export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { name: "overview", position: [0, 18, 14], target: [0, 0, 0], fov: 50 },
  { name: "frontDesk", position: [0, 6, 8], target: [0, 0, -2], fov: 45 },
  { name: "lounge", position: [-8, 5, 6], target: [0, 0, 0], fov: 55 },
];

export interface DayNightKeyframe {
  /** Frame within the cycle (0 to period-1) */
  frame: number;
  /** Ambient light color */
  ambientColor: string;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Directional light intensity */
  sunIntensity: number;
  /** Overall mood name */
  mood: string;
}

export const DAY_NIGHT_PERIOD = 300;

export const DAY_NIGHT_KEYFRAMES: DayNightKeyframe[] = [
  { frame: 0,   ambientColor: "#2a2244", ambientIntensity: 0.15, sunIntensity: 0.1, mood: "night" },
  { frame: 50,  ambientColor: "#553355", ambientIntensity: 0.25, sunIntensity: 0.3, mood: "dawn" },
  { frame: 100, ambientColor: "#ffe8cc", ambientIntensity: 0.5,  sunIntensity: 0.8, mood: "morning" },
  { frame: 150, ambientColor: "#ffffff", ambientIntensity: 0.6,  sunIntensity: 1.0, mood: "noon" },
  { frame: 200, ambientColor: "#ffddaa", ambientIntensity: 0.45, sunIntensity: 0.6, mood: "afternoon" },
  { frame: 250, ambientColor: "#443355", ambientIntensity: 0.2,  sunIntensity: 0.15, mood: "evening" },
];

/* ═══════════════════════════════════════
   Navigation Grid
   ═══════════════════════════════════════ */

export interface NavGrid {
  /** Width of the grid in cells */
  width: number;
  /** Height of the grid in cells */
  height: number;
  /** Cell size in canvas units */
  cellSize: number;
  /** Obstacle map: 0 = free, 1 = blocked */
  data: Uint8Array;
}

export interface Waypoint {
  x: number;
  y: number;
}

/* ═══════════════════════════════════════
   Visual Systems
   ═══════════════════════════════════════ */

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number; // 0-1
}

export interface TrailPoint {
  agentId: string;
  x: number;
  y: number;
  age: number;
  maxAge: number;
  color: string;
}

/* ═══════════════════════════════════════
   District / Multi-Office
   ═══════════════════════════════════════ */

export interface OfficeZone {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const LOCAL_OFFICE_ZONE: OfficeZone = {
  name: "local",
  x: 0,
  y: 0,
  width: 1800,
  height: 720,
};

export const REMOTE_OFFICE_ZONE: OfficeZone = {
  name: "remote",
  x: 0,
  y: 800,
  width: 1800,
  height: 720,
};

/* ═══════════════════════════════════════
   Component Props
   ═══════════════════════════════════════ */

export interface AgentModelProps {
  agentId: string;
  name: string;
  status: RenderAgent["status"];
  color: string;
  appearance?: AgentAppearance | null;
  agentsRef: React.RefObject<RenderAgent[]>;
  agentLookupRef?: React.RefObject<Map<string, RenderAgent>>;
  onHover?: (id: string) => void;
  onUnhover?: () => void;
  onClick?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  showSpeech?: boolean;
  speechText?: string | null;
  suppressSpeechBubble?: boolean;
}

export interface FurnitureModelProps {
  item: FurnitureItem;
  onPointerDown?: (uid: string) => void;
  onPointerOver?: (uid: string) => void;
  onPointerOut?: () => void;
  editMode?: boolean;
}

export interface InteractiveFurnitureProps {
  item: FurnitureItem;
  isSelected: boolean;
  isHovered: boolean;
  editMode: boolean;
  doorOpen?: boolean;
  onPointerDown: (uid: string) => void;
  onPointerOver: (uid: string) => void;
  onPointerOut: () => void;
  onClick?: (uid: string) => void;
}
