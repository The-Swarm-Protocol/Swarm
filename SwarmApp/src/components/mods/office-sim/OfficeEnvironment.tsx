/** OfficeEnvironment — Composes floor, walls, ceiling, and AI-generated furniture */
"use client";

import { Suspense, useMemo, useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeTheme } from "./themes";
import type { OfficeFurnitureData } from "./studio/furniture-types";
import type { OfficeTextureData } from "./studio/texture-types";
import type { OfficeArtPieceData } from "./studio/art-types";
import { DEFAULT_ART_SLOTS, ART_PIPELINE, ART_3D_SCALES } from "./studio/art-types";
import { ThemedFloor } from "./ThemedFloor";
import { GltfFurniture } from "./GltfFurniture";
import { ArtPlane } from "./ArtPlane";
import { ArtPlaceholder } from "./ArtPlaceholder";

interface OfficeEnvironmentProps {
  theme: OfficeTheme;
  furniture?: Map<string, OfficeFurnitureData>;
  textures?: Map<string, OfficeTextureData>;
  art?: Map<string, OfficeArtPieceData>;
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

/** Simple GLTF loader for art pieces (no category/scale assumptions from furniture) */
function GltfArt({
  modelUrl,
  position,
  rotation,
  scale,
}: {
  modelUrl: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!groupRef.current) return;
    // Center the model
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    clonedScene.position.sub(center);
    clonedScene.position.y += box.getSize(new THREE.Vector3()).y / 2;
  }, [clonedScene]);

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

export function OfficeEnvironment({
  theme,
  furniture,
  textures,
  art,
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

      {/* Render AI-generated art pieces */}
      {DEFAULT_ART_SLOTS.map((slot) => {
        const artData = art?.get(slot.id);
        const pipeline = ART_PIPELINE[slot.category];
        const is3D = pipeline === "meshy";

        if (artData?.modelUrl && is3D) {
          // 3D art: render as GLTF model
          const scale = ART_3D_SCALES[slot.category] || [0.5, 0.5, 0.5];
          return (
            <Suspense key={slot.id} fallback={null}>
              <GltfArt
                modelUrl={artData.modelUrl}
                position={slot.three.position}
                rotation={slot.three.rotation}
                scale={scale}
              />
            </Suspense>
          );
        }

        if (artData?.imageUrl && !is3D) {
          // 2D art: render as textured plane
          return (
            <Suspense key={slot.id} fallback={null}>
              <ArtPlane
                imageUrl={artData.imageUrl}
                position={slot.three.position}
                rotation={slot.three.rotation}
                size={slot.three.planeSize}
              />
            </Suspense>
          );
        }

        // Empty slot: wireframe placeholder
        return (
          <ArtPlaceholder
            key={slot.id}
            position={slot.three.position}
            rotation={slot.three.rotation}
            size={slot.three.planeSize}
            is3D={is3D}
          />
        );
      })}
    </group>
  );
}
