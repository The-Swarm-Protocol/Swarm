/** Office3D — React Three Fiber immersive office with camera controls, speech bubbles, collab arcs, spawn effects */
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { useOffice, getFilteredAgents } from "./office-store";
import { STATUS_COLORS } from "./types";
import type { VisualAgent, AgentVisualStatus, CameraMode } from "./types";
import { GltfAgent } from "./GltfAgent";

/* ═══════════════════════════════════════════════════════════════
   Office Floor — Grid floor with subtle pattern
   ═══════════════════════════════════════════════════════════════ */

function OfficeFloor() {
  return (
    <group position={[0, -0.01, 0]}>
      <gridHelper args={[30, 60, "#1a2332", "#141c28"]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0a0f18" metalness={0.5} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Desk — Agent workstation
   ═══════════════════════════════════════════════════════════════ */

const deskMaterial = new THREE.MeshStandardMaterial({
  color: "#1e2738",
  metalness: 0.6,
  roughness: 0.4,
});

const monitorMaterial = new THREE.MeshStandardMaterial({
  color: "#0d1117",
  metalness: 0.8,
  roughness: 0.2,
});

function Desk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Desk surface */}
      <mesh material={deskMaterial} position={[0, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
      </mesh>
      {/* Desk legs */}
      {[
        [-0.5, 0, -0.2],
        [0.5, 0, -0.2],
        [-0.5, 0, 0.2],
        [0.5, 0, 0.2],
      ].map((leg, i) => (
        <mesh key={i} material={deskMaterial} position={[leg[0], 0.22, leg[2]]}>
          <cylinderGeometry args={[0.02, 0.02, 0.44, 6]} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh material={monitorMaterial} position={[0, 0.72, -0.15]}>
        <boxGeometry args={[0.5, 0.35, 0.02]} />
      </mesh>
      {/* Monitor stand */}
      <mesh material={deskMaterial} position={[0, 0.55, -0.15]}>
        <cylinderGeometry args={[0.02, 0.04, 0.15, 6]} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AgentFigure — Procedural humanoid at a desk
   ═══════════════════════════════════════════════════════════════ */

function AgentFigure({
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
  const headRef = useRef<THREE.Mesh>(null);

  const statusColor = STATUS_COLORS[agent.status];
  const isActive =
    agent.status !== "offline" && agent.status !== "idle";

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a3548",
        metalness: 0.3,
        roughness: 0.6,
        emissive: new THREE.Color(statusColor),
        emissiveIntensity: isActive ? 0.15 : 0.02,
        transparent: dimmed,
        opacity: dimmed ? 0.2 : 1,
      }),
    [statusColor, isActive, dimmed],
  );

  const headMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8c4a0",
        metalness: 0.1,
        roughness: 0.8,
        transparent: dimmed,
        opacity: dimmed ? 0.2 : 1,
      }),
    [dimmed],
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Breathing/idle bob
    groupRef.current.position.y =
      position[1] + Math.sin(t * 1.2 + position[0]) * 0.005;

    // Head movement (thinking/active)
    if (headRef.current && isActive) {
      headRef.current.rotation.y =
        Math.sin(t * 0.5 + position[2]) * 0.1;
    }

    // Typing animation for active agents
    if (isActive && groupRef.current) {
      groupRef.current.rotation.x = Math.sin(t * 3) * 0.01;
    }
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
      {/* Body (torso) */}
      <mesh material={bodyMat} position={[0, 0.55, 0.1]}>
        <boxGeometry args={[0.3, 0.35, 0.2]} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} material={headMat} position={[0, 0.82, 0.1]}>
        <sphereGeometry args={[0.1, 12, 12]} />
      </mesh>

      {/* Arms */}
      <mesh
        material={bodyMat}
        position={[-0.22, 0.48, -0.05]}
        rotation={[0.3, 0, -0.1]}
      >
        <boxGeometry args={[0.08, 0.25, 0.08]} />
      </mesh>
      <mesh
        material={bodyMat}
        position={[0.22, 0.48, -0.05]}
        rotation={[0.3, 0, 0.1]}
      >
        <boxGeometry args={[0.08, 0.25, 0.08]} />
      </mesh>

      {/* Legs */}
      <mesh material={bodyMat} position={[-0.08, 0.25, 0.15]}>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
      </mesh>
      <mesh material={bodyMat} position={[0.08, 0.25, 0.15]}>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
      </mesh>

      {/* Status light */}
      <mesh position={[0, 1.0, 0.1]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={dimmed ? 0.2 : 2}
        />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0.01, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.4, 24]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Name tag (always visible) */}
      {!dimmed && (
        <Html position={[0, 1.15, 0.1]} center distanceFactor={8}>
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
        <Html position={[0, 1.35, 0.1]} center distanceFactor={6}>
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

/* ═══════════════════════════════════════════════════════════════
   Meeting Room — Glass-walled room
   ═══════════════════════════════════════════════════════════════ */

function MeetingRoom({
  position,
}: {
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[3, 2.5]} />
        <meshStandardMaterial
          color="#0d1520"
          metalness={0.4}
          roughness={0.6}
          opacity={0.8}
          transparent
        />
      </mesh>
      {[
        [-1.5, 0.6, 0],
        [1.5, 0.6, 0],
        [0, 0.6, -1.25],
        [0, 0.6, 1.25],
      ].map((pos, i) => (
        <mesh
          key={i}
          position={[pos[0], pos[1], pos[2]]}
          rotation={[0, i < 2 ? Math.PI / 2 : 0, 0]}
        >
          <planeGeometry args={[i < 2 ? 2.5 : 3, 1.2]} />
          <meshStandardMaterial
            color="#3b82f6"
            metalness={0.9}
            roughness={0.1}
            opacity={0.08}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.04, 16]} />
        <meshStandardMaterial
          color="#1e2738"
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Collaboration Arc — Dashed line between collaborating agents
   ═══════════════════════════════════════════════════════════════ */

function CollaborationArc({
  from,
  to,
  strength,
}: {
  from: [number, number, number];
  to: [number, number, number];
  strength: number;
}) {
  const ref = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from).add(new THREE.Vector3(0, 0.8, 0)),
      new THREE.Vector3(
        (from[0] + to[0]) / 2,
        1.5,
        (from[2] + to[2]) / 2,
      ),
      new THREE.Vector3(...to).add(new THREE.Vector3(0, 0.8, 0)),
    ]);
    return g;
  }, [from, to]);

  const material = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: "#3b82f6",
        dashSize: 0.2,
        gapSize: 0.1,
        opacity: 0.3 + strength * 0.5,
        transparent: true,
      }),
    [strength],
  );

  useFrame(() => {
    if (ref.current) {
      ref.current.computeLineDistances();
    }
  });

  return <line ref={ref as React.Ref<THREE.Line>} geometry={geometry} material={material} />;
}

/* ═══════════════════════════════════════════════════════════════
   Spawn Portal — Ring effect when agent comes online
   ═══════════════════════════════════════════════════════════════ */

function SpawnPortal({
  position,
}: {
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(0);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 2;
      ref.current.rotation.z += delta * 0.5;
    }
    if (scale < 1) {
      setScale((s) => Math.min(1, s + delta * 0.8));
    }
  });

  return (
    <mesh
      ref={ref}
      position={[position[0], 0.5, position[2]]}
      scale={scale}
    >
      <torusGeometry args={[0.5, 0.03, 8, 32]} />
      <meshStandardMaterial
        color="#06b6d4"
        emissive="#06b6d4"
        emissiveIntensity={2}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Camera Controllers
   ═══════════════════════════════════════════════════════════════ */

function CameraController({
  mode,
  selectedAgent,
  deskPositions,
}: {
  mode: CameraMode;
  selectedAgent: VisualAgent | null;
  deskPositions: [number, number, number][];
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (mode === "cinematic" && controlsRef.current) {
      // Slow auto-orbit
      const t = state.clock.elapsedTime;
      controlsRef.current.autoRotate = true;
      controlsRef.current.autoRotateSpeed = 0.5;
    } else if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
    }

    // Follow mode: lerp to selected agent
    if (mode === "follow" && selectedAgent && controlsRef.current) {
      const agents = Array.from(
        document.querySelectorAll("[data-agent-id]"),
      );
      // Use desk position index to find target
      const idx = deskPositions.findIndex(
        (_, i) => i === deskPositions.length, // dummy, we use the actual target
      );
      const target = controlsRef.current.target;
      // Find the agent's desk position
      const agentIdx = deskPositions.findIndex((_, i) => {
        // We receive selectedAgent, match by comparing position data
        return true; // Will be refined below
      });

      // Lerp the controls target towards the agent position
      if (selectedAgent.position) {
        // Map 2D position to 3D space approximately
        const targetX =
          ((selectedAgent.position.x - 320) / 160) * 2;
        const targetZ =
          ((selectedAgent.position.y - 280) / 160) * 3;
        target.lerp(
          new THREE.Vector3(targetX, 0.5, targetZ),
          0.02,
        );
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={4}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={0.2}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Office3D — Main export
   ═══════════════════════════════════════════════════════════════ */

const DESK_POSITIONS: [number, number, number][] = [
  [-4, 0, -1],
  [-2, 0, -1],
  [0, 0, -1],
  [2, 0, -1],
  [-4, 0, 2],
  [-2, 0, 2],
  [0, 0, 2],
  [2, 0, 2],
];

export function Office3D() {
  const { state, dispatch } = useOffice();
  const agents = Array.from(state.agents.values());
  const filteredIds = getFilteredAgents(state);
  const [mounted, setMounted] = useState(false);
  const selectedAgent = state.selectedAgentId
    ? state.agents.get(state.selectedAgentId) || null
    : null;

  const isBackground = state.viewMode === "background";

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-full aspect-video rounded-lg border border-border bg-card flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading 3D scene...
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-lg border border-border overflow-hidden bg-[#060a12] ${
        isBackground
          ? "fixed inset-0 z-[-1] opacity-35 pointer-events-none border-none rounded-none"
          : "aspect-video"
      }`}
    >
      <Canvas
        camera={{ position: [0, 6, 12], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "low-power",
        }}
      >
        <color attach="background" args={["#060a12"]} />
        <fog attach="fog" args={["#060a12", 12, 28]} />

        {/* Lighting */}
        <ambientLight intensity={0.25} color="#c4d4f0" />
        <directionalLight
          position={[8, 12, 6]}
          intensity={0.7}
          castShadow
        />
        <directionalLight
          position={[-5, 8, -3]}
          intensity={0.2}
          color="#3b82f6"
        />
        <pointLight
          position={[0, 3, 0]}
          intensity={0.3}
          color="#fbbf24"
        />

        <OfficeFloor />

        {/* Desks + Agents */}
        {DESK_POSITIONS.map((pos, i) => {
          const agent = agents[i];
          const dimmed = agent ? !filteredIds.has(agent.id) : false;
          return (
            <group key={i}>
              <Desk position={pos} />
              {agent && agent.status !== "offline" && (
                agent.modelUrl ? (
                  <Suspense fallback={
                    <AgentFigure
                      position={pos}
                      agent={agent}
                      selected={agent.id === state.selectedAgentId}
                      dimmed={dimmed}
                      onClick={() =>
                        dispatch({ type: "SELECT_AGENT", id: agent.id })
                      }
                    />
                  }>
                    <GltfAgent
                      position={pos}
                      agent={agent}
                      selected={agent.id === state.selectedAgentId}
                      dimmed={dimmed}
                      onClick={() =>
                        dispatch({ type: "SELECT_AGENT", id: agent.id })
                      }
                    />
                  </Suspense>
                ) : (
                  <AgentFigure
                    position={pos}
                    agent={agent}
                    selected={agent.id === state.selectedAgentId}
                    dimmed={dimmed}
                    onClick={() =>
                      dispatch({ type: "SELECT_AGENT", id: agent.id })
                    }
                  />
                )
              )}
              {/* Spawn portal for spawning agents */}
              {agent && agent.status === "spawning" && (
                <SpawnPortal position={pos} />
              )}
            </group>
          );
        })}

        {/* Collaboration arcs */}
        {state.collaborationLinks.map((link, i) => {
          const sourceIdx = agents.findIndex(
            (a) => a.id === link.sourceId,
          );
          const targetIdx = agents.findIndex(
            (a) => a.id === link.targetId,
          );
          if (
            sourceIdx < 0 ||
            targetIdx < 0 ||
            sourceIdx >= DESK_POSITIONS.length ||
            targetIdx >= DESK_POSITIONS.length
          )
            return null;
          return (
            <CollaborationArc
              key={i}
              from={DESK_POSITIONS[sourceIdx]}
              to={DESK_POSITIONS[targetIdx]}
              strength={link.strength}
            />
          );
        })}

        {/* Meeting Room */}
        <MeetingRoom position={[5.5, 0, -1]} />

        {/* Camera controller (replaces AutoCamera) */}
        <CameraController
          mode={state.cameraMode}
          selectedAgent={selectedAgent}
          deskPositions={DESK_POSITIONS}
        />
      </Canvas>
    </div>
  );
}
