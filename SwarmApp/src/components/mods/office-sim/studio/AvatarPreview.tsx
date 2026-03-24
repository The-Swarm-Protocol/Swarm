/** AvatarPreview — Mini 3D + 2D preview for completed avatars */
"use client";

import { Suspense, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function AvatarModel({ url }: { url: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, groupRef);

  // Auto-scale
  useEffect(() => {
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      groupRef.current.scale.setScalar(1.5 / maxDim);
    }
    // Center vertically
    const center = box.getCenter(new THREE.Vector3());
    clonedScene.position.sub(center);
    clonedScene.position.y += size.y / 2;
  }, [clonedScene]);

  // Play idle animation
  useEffect(() => {
    if (!actions) return;
    const idle = actions["idle"] || Object.values(actions)[0];
    if (idle) {
      idle.reset().play();
    }
  }, [actions]);

  // Slow rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

function ModelFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.4, 0.6, 0.3]} />
      <meshStandardMaterial color="#2a3548" wireframe />
    </mesh>
  );
}

export function AvatarPreview({
  modelUrl,
  spriteUrl,
}: {
  modelUrl?: string;
  spriteUrl?: string;
}) {
  if (!modelUrl && !spriteUrl) return null;

  return (
    <div className="flex items-start gap-3">
      {/* 3D preview */}
      {modelUrl && (
        <div className="w-[120px] h-[120px] rounded-lg border border-border overflow-hidden bg-[#060a12]">
          <Canvas
            camera={{ position: [0, 1, 2.5], fov: 40 }}
            style={{ width: "100%", height: "100%" }}
            gl={{ alpha: false, antialias: true }}
          >
            <color attach="background" args={["#060a12"]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[2, 3, 1]} intensity={0.8} />
            <Suspense fallback={<ModelFallback />}>
              <AvatarModel url={modelUrl} />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>
        </div>
      )}

      {/* 2D sprite preview */}
      {spriteUrl && (
        <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-[#060a12] flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={spriteUrl}
            alt="2D sprite"
            className="w-full h-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      )}
    </div>
  );
}
