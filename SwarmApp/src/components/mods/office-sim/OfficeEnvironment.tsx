/** OfficeEnvironment — Composes floor, walls, ceiling, and AI-generated furniture */
"use client";

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import type { OfficeTheme } from "./themes";
import type { OfficeFurnitureData } from "./studio/furniture-types";
import type { OfficeTextureData } from "./studio/texture-types";
import { ThemedFloor } from "./ThemedFloor";
import { GltfFurniture } from "./GltfFurniture";

interface OfficeEnvironmentProps {
  theme: OfficeTheme;
  furniture?: Map<string, OfficeFurnitureData>;
  textures?: Map<string, OfficeTextureData>;
}

/** Default positions for furniture categories in the 3D scene */
const FURNITURE_PLACEMENTS: Record<string, { position: [number, number, number]; rotation?: [number, number, number] }[]> = {
  plant: [
    { position: [-5.5, 0, -2] },
    { position: [4.5, 0, -2] },
    { position: [-5.5, 0, 3.5] },
    { position: [4.5, 0, 3.5] },
  ],
  whiteboard: [
    { position: [0, 0, -4], rotation: [0, 0, 0] },
  ],
  "coffee-machine": [
    { position: [6, 0, 3] },
  ],
  "server-rack": [
    { position: [-6.5, 0, 0] },
    { position: [-6.5, 0, 1.5] },
  ],
  lamp: [
    { position: [-3, 0.48, -1] },
    { position: [1, 0.48, -1] },
    { position: [-3, 0.48, 2] },
    { position: [1, 0.48, 2] },
  ],
  divider: [
    { position: [-1, 0, 0.5], rotation: [0, Math.PI / 2, 0] },
  ],
  couch: [
    { position: [6, 0, -2], rotation: [0, -Math.PI / 2, 0] },
  ],
};

function Walls({ theme }: { theme: OfficeTheme }) {
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.wallColor,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    [theme.wallColor],
  );

  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 1.5, -5]} material={wallMat}>
        <planeGeometry args={[16, 3]} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-8, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[10, 3]} />
      </mesh>
      {/* Right wall */}
      <mesh position={[8, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[10, 3]} />
      </mesh>
    </group>
  );
}

function Ceiling({ theme }: { theme: OfficeTheme }) {
  return (
    <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[16, 10]} />
      <meshStandardMaterial
        color={theme.wallColor}
        metalness={0.05}
        roughness={0.95}
        side={THREE.DoubleSide}
        opacity={0.4}
        transparent
      />
    </mesh>
  );
}

export function OfficeEnvironment({
  theme,
  furniture,
  textures,
}: OfficeEnvironmentProps) {
  const floorTextureUrl = textures?.get("wood-floor")?.textureUrl
    || textures?.get("tile-floor")?.textureUrl
    || textures?.get("carpet")?.textureUrl;

  return (
    <group>
      <ThemedFloor theme={theme} textureUrl={floorTextureUrl} />
      <Walls theme={theme} />
      <Ceiling theme={theme} />

      {/* Render AI-generated furniture where available */}
      {furniture && Array.from(furniture.entries()).map(([category, data]) => {
        const placements = FURNITURE_PLACEMENTS[category];
        if (!placements || !data.modelUrl) return null;

        return placements.map((placement, i) => (
          <Suspense key={`${category}-${i}`} fallback={null}>
            <GltfFurniture
              modelUrl={data.modelUrl}
              category={data.category}
              position={placement.position}
              rotation={placement.rotation}
            />
          </Suspense>
        ));
      })}
    </group>
  );
}
