/** Office Sim — Art piece generation type definitions */

/* ═══════════════════════════════════════
   Art Categories
   ═══════════════════════════════════════ */

export type ArtCategory =
  | "wall-painting"
  | "poster"
  | "photograph"
  | "mural"
  | "sculpture"
  | "trophy"
  | "decorative-plant"
  | "vase"
  | "desk-ornament";

export const ART_CATEGORIES: ArtCategory[] = [
  "wall-painting",
  "poster",
  "photograph",
  "mural",
  "sculpture",
  "trophy",
  "decorative-plant",
  "vase",
  "desk-ornament",
];

export const ART_LABELS: Record<ArtCategory, string> = {
  "wall-painting": "Wall Painting",
  poster: "Poster",
  photograph: "Photograph",
  mural: "Mural",
  sculpture: "Sculpture",
  trophy: "Trophy",
  "decorative-plant": "Decorative Plant",
  vase: "Vase",
  "desk-ornament": "Desk Ornament",
};

/** Which pipeline each category uses */
export type ArtPipeline = "comfyui" | "meshy";

export const ART_PIPELINE: Record<ArtCategory, ArtPipeline> = {
  "wall-painting": "comfyui",
  poster: "comfyui",
  photograph: "comfyui",
  mural: "comfyui",
  sculpture: "meshy",
  trophy: "meshy",
  "decorative-plant": "meshy",
  vase: "meshy",
  "desk-ornament": "meshy",
};

/** Default 3D scale per category (same pattern as FURNITURE_SCALES) */
export const ART_3D_SCALES: Partial<Record<ArtCategory, [number, number, number]>> = {
  sculpture: [0.6, 0.8, 0.6],
  trophy: [0.15, 0.25, 0.15],
  "decorative-plant": [0.3, 0.5, 0.3],
  vase: [0.2, 0.4, 0.2],
  "desk-ornament": [0.1, 0.1, 0.1],
};

/** Category-specific example prompts for the customize dialog */
export const ART_EXAMPLE_PROMPTS: Record<ArtCategory, string[]> = {
  "wall-painting": [
    "Abstract expressionist oil painting with bold red and blue",
    "Serene Japanese landscape with cherry blossoms and mountains",
    "Geometric pattern in vibrant tech brand colors",
  ],
  poster: [
    "Motivational tech startup poster with circuit board motif",
    "Retro sci-fi movie poster, neon colors, space theme",
    "Minimalist typography poster about innovation",
  ],
  photograph: [
    "Dramatic aerial cityscape at golden hour",
    "Abstract macro photograph of water droplets on glass",
  ],
  mural: [
    "Flowing abstract mural with gradient waves of color",
    "Urban street art mural with geometric shapes and patterns",
  ],
  sculpture: [
    "Modern abstract chrome sculpture, organic flowing form",
    "Classical marble bust, ancient Greek style",
    "Kinetic wind sculpture, metal rods, Calder-inspired",
  ],
  trophy: [
    "Polished golden trophy cup with laurel wreath",
    "Crystal achievement award, faceted and elegant",
  ],
  "decorative-plant": [
    "Lush monstera plant in a ceramic pot",
    "Tall bamboo arrangement in a woven basket",
    "Succulent garden in a geometric planter",
  ],
  vase: [
    "Elegant ceramic vase with hand-painted blue floral pattern",
    "Modern glass vase with iridescent rainbow finish",
  ],
  "desk-ornament": [
    "Miniature globe on a brass stand",
    "Crystal prism desk ornament",
    "Small zen garden with sand and stones",
  ],
};

/* ═══════════════════════════════════════
   Default Art Prompts per Theme
   ═══════════════════════════════════════ */

/**
 * Theme-aware default prompts for each art slot.
 * Used by generate-office to auto-populate all art
 * without requiring user input.
 *
 * Keys are theme IDs, values map slot IDs to prompts.
 * If a theme is missing, falls back to "default".
 */
export const DEFAULT_ART_PROMPTS: Record<string, Record<string, string>> = {
  default: {
    "art-back-wall-left": "Abstract expressionist oil painting, bold gestural brushstrokes, warm palette",
    "art-back-wall-center": "Large panoramic landscape, rolling hills and cloudy sky, impressionist style",
    "art-back-wall-right": "Motivational typography poster, minimalist design, clean lines",
    "art-left-wall": "Flowing abstract mural, gradient waves of color, organic shapes",
    "art-sculpture-right": "Modern abstract chrome sculpture, organic flowing form on a pedestal",
    "art-trophy": "Polished golden trophy cup with laurel wreath, achievement award",
    "art-plant-custom": "Lush monstera plant in a matte ceramic pot, tropical leaves",
    "art-desk-ornament-1": "Miniature globe on a brass stand, vintage desk ornament",
  },
  "startup-loft": {
    "art-back-wall-left": "Abstract oil painting with warm earth tones, amber and burnt sienna, Scandinavian gallery",
    "art-back-wall-center": "Large panoramic Nordic landscape, birch forest at golden hour, soft warm light",
    "art-back-wall-right": "Startup culture poster, minimalist typography 'Build. Ship. Iterate.' on cream paper",
    "art-left-wall": "Flowing abstract mural, warm amber and wood tones, honey and gold gradient waves",
    "art-sculpture-right": "Smooth polished wood sculpture, abstract organic form, Danish modern design",
    "art-trophy": "Handcrafted brass startup award trophy, geometric faceted design, Scandinavian modern",
    "art-plant-custom": "Large fiddle leaf fig tree in a woven rattan basket planter, loft interior",
    "art-desk-ornament-1": "Small brass kinetic desk toy, Newton's cradle, warm metallic finish",
  },
  "corporate-tower": {
    "art-back-wall-left": "Minimalist abstract painting, steel blue and white geometric blocks, corporate fine art",
    "art-back-wall-center": "Large glass and steel cityscape at twilight, photorealistic, executive suite quality",
    "art-back-wall-right": "Corporate annual report infographic poster, clean blue data visualization design",
    "art-left-wall": "Monochrome mural, architectural blueprint style, glass tower silhouettes, cool blue tones",
    "art-sculpture-right": "Polished stainless steel abstract sculpture, Brancusi-inspired, reflective surface",
    "art-trophy": "Crystal achievement award with laser-etched corporate logo, faceted glass, premium",
    "art-plant-custom": "Tall snake plant in a sleek brushed aluminum planter, corporate lobby style",
    "art-desk-ornament-1": "Crystal paperweight with holographic facets, executive desk accessory",
  },
  "cyberpunk-den": {
    "art-back-wall-left": "Glitch art digital painting, neon purple and cyan, corrupted pixel aesthetic, cyberpunk",
    "art-back-wall-center": "Neon-lit futuristic cityscape, rain-slicked streets, holographic billboards, Blade Runner",
    "art-back-wall-right": "Cyberpunk propaganda poster, neon magenta on black, Japanese kanji, hacker aesthetic",
    "art-left-wall": "Digital mural of circuit board patterns morphing into a neural network, neon glow, dark metal",
    "art-sculpture-right": "Cybernetic chrome skull sculpture with glowing LED eye sockets, dark metal base",
    "art-trophy": "Neon-accented black acrylic trophy, glowing purple edge lighting, hacker trophy",
    "art-plant-custom": "Bioluminescent alien plant in a hexagonal glass terrarium, cyan glow, sci-fi",
    "art-desk-ornament-1": "Miniature holographic pyramid projector, spinning neon wireframe, cyberpunk gadget",
  },
  "cozy-studio": {
    "art-back-wall-left": "Watercolor botanical illustration, ferns and wildflowers, soft green and cream tones",
    "art-back-wall-center": "Large cozy cottage landscape, garden path with lavender, watercolor, warm afternoon light",
    "art-back-wall-right": "Hand-lettered inspirational quote poster on kraft paper, botanical border, indie studio",
    "art-left-wall": "Botanical mural, trailing ivy and climbing roses, vintage botanical illustration style",
    "art-sculpture-right": "Hand-thrown ceramic vase sculpture, earthy glaze, organic asymmetric form, wabi-sabi",
    "art-trophy": "Handmade wooden award plaque, reclaimed wood, burned-in lettering, artisan craft",
    "art-plant-custom": "Overflowing hanging pothos plant in a macramé hanger, trailing vines, boho style",
    "art-desk-ornament-1": "Small zen garden with raked sand and smooth river stones, bamboo tray",
  },
};

/**
 * Get the default prompt for a slot + theme combination.
 * Falls back to the default theme, then to the first example prompt.
 */
export function getDefaultArtPrompt(themeId: string, slotId: string, category: ArtCategory): string {
  const themePrompts = DEFAULT_ART_PROMPTS[themeId] || DEFAULT_ART_PROMPTS.default;
  if (themePrompts[slotId]) return themePrompts[slotId];

  // Fallback: default theme
  const fallback = DEFAULT_ART_PROMPTS.default[slotId];
  if (fallback) return fallback;

  // Last resort: first example prompt for the category
  return ART_EXAMPLE_PROMPTS[category]?.[0] || `${ART_LABELS[category]}, high quality, office decor`;
}

/* ═══════════════════════════════════════
   Art Slot Definitions
   ═══════════════════════════════════════ */

export interface ArtSlot {
  id: string;
  label: string;
  category: ArtCategory;
  /** 2D SVG position. x < 0 means offset from canvasWidth */
  svg: { x: number; y: number; width: number; height: number };
  /** 3D position and rotation */
  three: {
    position: [number, number, number];
    rotation?: [number, number, number];
    /** Scale for 2D art displayed as planes in 3D */
    planeSize?: [number, number];
  };
}

export const DEFAULT_ART_SLOTS: ArtSlot[] = [
  // Back wall — three art pieces
  {
    id: "art-back-wall-left",
    label: "Back Wall (Left)",
    category: "wall-painting",
    svg: { x: 150, y: 70, width: 60, height: 40 },
    three: { position: [-3, 2.0, -4.9], rotation: [0, 0, 0], planeSize: [1.5, 1.0] },
  },
  {
    id: "art-back-wall-center",
    label: "Back Wall (Center)",
    category: "wall-painting",
    svg: { x: 320, y: 70, width: 80, height: 50 },
    three: { position: [0, 2.0, -4.9], rotation: [0, 0, 0], planeSize: [2.0, 1.3] },
  },
  {
    id: "art-back-wall-right",
    label: "Back Wall (Right)",
    category: "poster",
    svg: { x: 490, y: 70, width: 50, height: 70 },
    three: { position: [3, 2.0, -4.9], rotation: [0, 0, 0], planeSize: [1.2, 1.7] },
  },
  // Left wall
  {
    id: "art-left-wall",
    label: "Left Wall",
    category: "mural",
    svg: { x: 10, y: 180, width: 20, height: 60 },
    three: { position: [-7.9, 1.8, 0], rotation: [0, Math.PI / 2, 0], planeSize: [2.0, 1.2] },
  },
  // Corner sculpture
  {
    id: "art-sculpture-right",
    label: "Corner Sculpture",
    category: "sculpture",
    svg: { x: 620, y: 40, width: 24, height: 40 },
    three: { position: [6.5, 0, -3.5] },
  },
  // Trophy
  {
    id: "art-trophy",
    label: "Trophy",
    category: "trophy",
    svg: { x: 660, y: 240, width: 20, height: 30 },
    three: { position: [7, 0.4, 0] },
  },
  // Custom plant (replaces one of the procedural plants)
  {
    id: "art-plant-custom",
    label: "Custom Plant",
    category: "decorative-plant",
    svg: { x: -50, y: 20, width: 30, height: 30 },
    three: { position: [-5.5, 0, -2] },
  },
  // Desk ornament
  {
    id: "art-desk-ornament-1",
    label: "Desk Ornament",
    category: "desk-ornament",
    svg: { x: 100, y: 210, width: 16, height: 16 },
    three: { position: [-4, 0.48, -0.7] },
  },
];

/* ═══════════════════════════════════════
   Generation Pipeline State
   ═══════════════════════════════════════ */

export type ArtGenerationStatus =
  | "pending"
  | "generating"
  | "refining"
  | "uploading"
  | "completed"
  | "failed";

export interface ArtMeshyState {
  previewTaskId?: string;
  refineTaskId?: string;
  status: "pending" | "preview" | "refine" | "uploading" | "done" | "failed";
  error?: string;
  progress?: number;
  glbUrl?: string;
  storachaCid?: string;
  gatewayUrl?: string;
}

export interface ArtComfyUIState {
  promptId?: string;
  provider?: "self-hosted" | "replicate";
  status: "pending" | "generating" | "uploading" | "done" | "failed";
  error?: string;
  progress?: number;
  outputUrl?: string;
  filename?: string;
  storachaCid?: string;
  gatewayUrl?: string;
}

/* ═══════════════════════════════════════
   Firestore Document
   ═══════════════════════════════════════ */

export interface ArtGenerationTask {
  id: string;
  orgId: string;
  themeId: string;
  slotId: string;
  category: ArtCategory;
  pipeline: ArtPipeline;
  prompt: string;
  requestedBy: string;
  status: ArtGenerationStatus;
  meshy?: ArtMeshyState;
  comfyui?: ArtComfyUIState;
  createdAt: unknown;
  updatedAt: unknown;
  completedAt?: unknown;
}

/* ═══════════════════════════════════════
   Resolved Art Data (consumed by renderers)
   ═══════════════════════════════════════ */

export interface OfficeArtPieceData {
  slotId: string;
  category: ArtCategory;
  pipeline: ArtPipeline;
  themeId: string;
  /** For 3D art: Storacha gateway URL to GLB */
  modelUrl?: string;
  /** For 2D art: Storacha gateway URL to PNG */
  imageUrl?: string;
  prompt?: string;
  generatedAt?: number;
}
