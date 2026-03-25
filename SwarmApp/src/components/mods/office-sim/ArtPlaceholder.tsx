/** ArtPlaceholder — 3D wireframe indicator for empty art slots */
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ArtPlaceholderProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
  /** True for 3D slots (sculptures etc) vs wall art */
  is3D?: boolean;
}

export function ArtPlaceholder({
  position,
  rotation,
  size = [1.5, 1.0],
  is3D = false,
}: ArtPlaceholderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Subtle opacity pulse
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(clock.elapsedTime * 1.5) * 0.08;
    }
  });

  if (is3D) {
    // For sculpture/trophy slots: wireframe box
    return (
      <mesh ref={meshRef} position={position}>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
        <meshBasicMaterial
          color="#4a5568"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
    );
  }

  // For wall art: wireframe plane
  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation ? rotation.map(r => r) as [number, number, number] : undefined}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial
        color="#4a5568"
        wireframe
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
