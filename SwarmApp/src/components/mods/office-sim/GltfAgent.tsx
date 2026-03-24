/** GltfAgent — Renders a Meshy.ai-generated GLTF model with animations */
"use client";

import { useRef, useEffect, useMemo } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STATUS_COLORS } from "./types";
import type { VisualAgent } from "./types";

/** Map agent visual status to animation clip name */
const STATUS_TO_ANIMATION: Record<string, string> = {
  idle: "idle",
  active: "sit_idle_f",
  thinking: "sit_idle_f",
  tool_calling: "sit_idle_m",
  speaking: "talking",
  error: "idle",
  blocked: "idle",
  spawning: "idle",
};

export function GltfAgent({
  position,
  agent,
  selected,
  dimmed,
  onClick,
}: {
  position: [number, number, number];
  agent: VisualAgent;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(agent.modelUrl!);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, groupRef);

  const statusColor = STATUS_COLORS[agent.status];

  // Auto-normalize scale to fit desk area (~0.8 units tall)
  useEffect(() => {
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetHeight = 0.8;
      const scale = targetHeight / maxDim;
      groupRef.current.scale.setScalar(scale);
    }
  }, [clonedScene]);

  // Apply dimming
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.transparent !== undefined) {
          mat.transparent = dimmed;
          mat.opacity = dimmed ? 0.2 : 1;
          mat.needsUpdate = true;
        }
      }
    });
  }, [dimmed, clonedScene]);

  // Play animation based on status
  const targetAnim = STATUS_TO_ANIMATION[agent.status] || "idle";

  useEffect(() => {
    if (!actions) return;

    // Try the mapped animation name, fall back to first available
    const action = actions[targetAnim] || Object.values(actions)[0];
    if (action) {
      action.reset().fadeIn(0.3).play();
      return () => {
        action.fadeOut(0.3);
      };
    }
  }, [targetAnim, actions]);

  // Subtle breathing bob (fallback animation supplement)
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y =
      position[1] + Math.sin(t * 1.2 + position[0]) * 0.003;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        if (!dimmed) onClick();
      }}
    >
      <primitive object={clonedScene} />

      {/* Status light (floating above head) */}
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={dimmed ? 0.2 : 2}
        />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.4, 24]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Name tag */}
      {!dimmed && (
        <Html position={[0, 1.15, 0]} center distanceFactor={8}>
          <div
            className="pointer-events-none select-none text-center whitespace-nowrap"
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {agent.name}
          </div>
        </Html>
      )}

      {/* Speech bubble */}
      {agent.speechBubble && !dimmed && (
        <Html position={[0, 1.35, 0]} center distanceFactor={6}>
          <div
            className="pointer-events-none select-none"
            style={{
              background: "rgba(10, 15, 24, 0.92)",
              border: "1px solid hsl(48, 100%, 50%)",
              borderRadius: "6px",
              padding: "4px 10px",
              maxWidth: "180px",
              fontSize: "10px",
              color: "hsl(48, 100%, 85%)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              backdropFilter: "blur(4px)",
            }}
          >
            {agent.speechBubble}
          </div>
        </Html>
      )}
    </group>
  );
}
