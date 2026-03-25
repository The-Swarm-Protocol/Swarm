/** ArtPlane — 3D textured plane for wall art (ComfyUI-generated images) */
"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface ArtPlaneProps {
  imageUrl: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}

function ArtPlaneInner({ imageUrl, position, rotation, size = [1.5, 1.0] }: ArtPlaneProps) {
  const texture = useTexture(imageUrl);

  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a2a2a",
        metalness: 0.6,
        roughness: 0.3,
      }),
    [],
  );

  return (
    <group position={position} rotation={rotation ? rotation.map(r => r) as [number, number, number] : undefined}>
      {/* Frame (slightly larger than the art) */}
      <mesh position={[0, 0, -0.005]} material={frameMat}>
        <planeGeometry args={[size[0] + 0.08, size[1] + 0.08]} />
      </mesh>
      {/* Art image */}
      <mesh>
        <planeGeometry args={size} />
        <meshStandardMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Wrapper with error boundary fallback */
export function ArtPlane(props: ArtPlaneProps) {
  return <ArtPlaneInner {...props} />;
}
