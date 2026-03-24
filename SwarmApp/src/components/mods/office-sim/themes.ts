/** Office Sim — Theme definitions for visual customization */

export interface OfficeTheme {
  id: string;
  name: string;
  description: string;

  // 3D Colors
  floorColor: string;
  wallColor: string;
  deskColor: string;
  monitorColor: string;
  accentColor: string;

  // 3D Lighting
  ambientIntensity: number;
  ambientColor: string;
  directionalIntensity: number;
  directionalColor: string;
  fillLightColor: string;
  pointLightColor: string;
  pointLightIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;

  // 3D Materials
  floorMetalness: number;
  floorRoughness: number;
  deskMetalness: number;
  deskRoughness: number;

  // 2D SVG
  svgBackground: string;
  svgGridColor: string;
  svgDeskFill: string;
  svgDeskStroke: string;
  svgMonitorFill: string;
  svgMonitorStroke: string;
  svgRoomMeeting: { bg: string; border: string };
  svgRoomBreak: { bg: string; border: string };
  svgRoomServer: { bg: string; border: string };
  svgRoomErrorBay: { bg: string; border: string };

  // AI generation prompt hints (used by Meshy/ComfyUI)
  furnitureStylePrompt: string;
  textureStylePrompt: string;
}

export const THEME_PRESETS: OfficeTheme[] = [
  {
    id: "startup-loft",
    name: "Startup Loft",
    description: "Modern open-plan with warm wood tones and natural light",

    floorColor: "#2a1f14",
    wallColor: "#3d3428",
    deskColor: "#5c4a35",
    monitorColor: "#1a1a1a",
    accentColor: "#f59e0b",

    ambientIntensity: 0.4,
    ambientColor: "#fff5e6",
    directionalIntensity: 0.8,
    directionalColor: "#ffe8c4",
    fillLightColor: "#87ceeb",
    pointLightColor: "#fbbf24",
    pointLightIntensity: 0.4,
    fogColor: "#1a150f",
    fogNear: 14,
    fogFar: 30,

    floorMetalness: 0.1,
    floorRoughness: 0.9,
    deskMetalness: 0.2,
    deskRoughness: 0.7,

    svgBackground: "hsl(30, 30%, 8%)",
    svgGridColor: "hsl(30, 20%, 14%)",
    svgDeskFill: "hsl(30, 25%, 18%)",
    svgDeskStroke: "hsl(30, 20%, 28%)",
    svgMonitorFill: "hsl(0, 0%, 8%)",
    svgMonitorStroke: "hsl(30, 15%, 22%)",
    svgRoomMeeting: { bg: "rgba(245, 158, 11, 0.06)", border: "rgba(245, 158, 11, 0.2)" },
    svgRoomBreak: { bg: "rgba(34, 197, 94, 0.04)", border: "rgba(34, 197, 94, 0.15)" },
    svgRoomServer: { bg: "rgba(6, 182, 212, 0.04)", border: "rgba(6, 182, 212, 0.15)" },
    svgRoomErrorBay: { bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.2)" },

    furnitureStylePrompt: "modern minimalist startup office, light wood and steel, Scandinavian design",
    textureStylePrompt: "warm oak wood grain, natural matte finish, Scandinavian",
  },
  {
    id: "corporate-tower",
    name: "Corporate Tower",
    description: "Sleek glass and steel high-rise with cool blue accents",

    floorColor: "#1a1d24",
    wallColor: "#2a2d34",
    deskColor: "#3a3d44",
    monitorColor: "#0a0a0a",
    accentColor: "#3b82f6",

    ambientIntensity: 0.35,
    ambientColor: "#d4e4ff",
    directionalIntensity: 0.9,
    directionalColor: "#ffffff",
    fillLightColor: "#3b82f6",
    pointLightColor: "#60a5fa",
    pointLightIntensity: 0.3,
    fogColor: "#0d1117",
    fogNear: 15,
    fogFar: 32,

    floorMetalness: 0.6,
    floorRoughness: 0.3,
    deskMetalness: 0.7,
    deskRoughness: 0.3,

    svgBackground: "hsl(220, 25%, 6%)",
    svgGridColor: "hsl(220, 20%, 12%)",
    svgDeskFill: "hsl(220, 15%, 14%)",
    svgDeskStroke: "hsl(220, 15%, 22%)",
    svgMonitorFill: "hsl(220, 20%, 6%)",
    svgMonitorStroke: "hsl(220, 15%, 18%)",
    svgRoomMeeting: { bg: "rgba(59, 130, 246, 0.06)", border: "rgba(59, 130, 246, 0.2)" },
    svgRoomBreak: { bg: "rgba(96, 165, 250, 0.04)", border: "rgba(96, 165, 250, 0.15)" },
    svgRoomServer: { bg: "rgba(147, 197, 253, 0.04)", border: "rgba(147, 197, 253, 0.12)" },
    svgRoomErrorBay: { bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.2)" },

    furnitureStylePrompt: "corporate executive office, glass and brushed steel, premium modern",
    textureStylePrompt: "polished concrete, cool grey, professional corporate",
  },
  {
    id: "cyberpunk-den",
    name: "Cyberpunk Den",
    description: "Neon-lit underground workspace with glitch aesthetics",

    floorColor: "#0a0014",
    wallColor: "#14002a",
    deskColor: "#1a0a2e",
    monitorColor: "#050008",
    accentColor: "#e040fb",

    ambientIntensity: 0.15,
    ambientColor: "#4a0080",
    directionalIntensity: 0.3,
    directionalColor: "#e040fb",
    fillLightColor: "#00e5ff",
    pointLightColor: "#e040fb",
    pointLightIntensity: 0.6,
    fogColor: "#050010",
    fogNear: 10,
    fogFar: 24,

    floorMetalness: 0.8,
    floorRoughness: 0.2,
    deskMetalness: 0.9,
    deskRoughness: 0.1,

    svgBackground: "hsl(270, 100%, 3%)",
    svgGridColor: "hsl(280, 80%, 10%)",
    svgDeskFill: "hsl(270, 60%, 10%)",
    svgDeskStroke: "hsl(290, 80%, 25%)",
    svgMonitorFill: "hsl(270, 80%, 3%)",
    svgMonitorStroke: "hsl(290, 100%, 40%)",
    svgRoomMeeting: { bg: "rgba(224, 64, 251, 0.08)", border: "rgba(224, 64, 251, 0.3)" },
    svgRoomBreak: { bg: "rgba(0, 229, 255, 0.06)", border: "rgba(0, 229, 255, 0.25)" },
    svgRoomServer: { bg: "rgba(0, 229, 255, 0.04)", border: "rgba(0, 229, 255, 0.2)" },
    svgRoomErrorBay: { bg: "rgba(255, 0, 60, 0.08)", border: "rgba(255, 0, 60, 0.3)" },

    furnitureStylePrompt: "cyberpunk futuristic, neon purple and cyan LED accents, dark metal, sci-fi",
    textureStylePrompt: "dark metal grating with neon light bleed, cyberpunk, industrial",
  },
  {
    id: "cozy-studio",
    name: "Cozy Studio",
    description: "Warm indie workspace with plants, rugs, and soft lighting",

    floorColor: "#2a2018",
    wallColor: "#3d3020",
    deskColor: "#6b5440",
    monitorColor: "#1a1510",
    accentColor: "#22c55e",

    ambientIntensity: 0.5,
    ambientColor: "#ffe4c4",
    directionalIntensity: 0.6,
    directionalColor: "#ffd4a0",
    fillLightColor: "#22c55e",
    pointLightColor: "#fde68a",
    pointLightIntensity: 0.5,
    fogColor: "#1a150e",
    fogNear: 12,
    fogFar: 26,

    floorMetalness: 0.05,
    floorRoughness: 0.95,
    deskMetalness: 0.1,
    deskRoughness: 0.85,

    svgBackground: "hsl(30, 35%, 7%)",
    svgGridColor: "hsl(30, 25%, 13%)",
    svgDeskFill: "hsl(25, 30%, 20%)",
    svgDeskStroke: "hsl(25, 25%, 30%)",
    svgMonitorFill: "hsl(25, 20%, 8%)",
    svgMonitorStroke: "hsl(25, 20%, 20%)",
    svgRoomMeeting: { bg: "rgba(34, 197, 94, 0.06)", border: "rgba(34, 197, 94, 0.2)" },
    svgRoomBreak: { bg: "rgba(253, 230, 138, 0.05)", border: "rgba(253, 230, 138, 0.18)" },
    svgRoomServer: { bg: "rgba(6, 182, 212, 0.04)", border: "rgba(6, 182, 212, 0.15)" },
    svgRoomErrorBay: { bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.2)" },

    furnitureStylePrompt: "cozy indie studio, reclaimed wood, plants, vintage brass accents, warm",
    textureStylePrompt: "worn reclaimed wood, warm tones, rustic cottage",
  },
];
