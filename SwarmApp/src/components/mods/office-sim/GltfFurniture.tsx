/** GltfFurniture — Loads a GLTF furniture model from Storacha, with procedural fallback */
"use client";

import { useRef, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  FURNITURE_SCALES,
  type FurnitureCategory,
} from "./studio/furniture-types";

interface GltfFurnitureProps {
  modelUrl: string;
  category: FurnitureCategory;
  position: [number, number, number];
  rotation?: [number, number, number];
}

export function GltfFurniture({
  modelUrl,
  category,
  position,
  rotation = [0, 0, 0],
}: GltfFurnitureProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const targetScale = FURNITURE_SCALES[category];

  useEffect(() => {
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const sx = targetScale[0] / Math.max(size.x, 0.01);
      const sy = targetScale[1] / Math.max(size.y, 0.01);
      const sz = targetScale[2] / Math.max(size.z, 0.01);
      const uniformScale = Math.min(sx, sy, sz);
      groupRef.current.scale.setScalar(uniformScale);
    }
  }, [clonedScene, targetScale]);

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <primitive object={clonedScene} />
    </group>
  );
}
