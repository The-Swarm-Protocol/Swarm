/** ThemedFloor — Floor with optional generated texture, falls back to procedural */
"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeTheme } from "./themes";

interface ThemedFloorProps {
  theme: OfficeTheme;
  textureUrl?: string;
}

function TexturedFloor({ textureUrl, theme }: { textureUrl: string; theme: OfficeTheme }) {
  const texture = useTexture(textureUrl);

  useMemo(() => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  const gridColor1 = useMemo(() => {
    const c = new THREE.Color(theme.floorColor);
    c.offsetHSL(0, 0, 0.06);
    return "#" + c.getHexString();
  }, [theme.floorColor]);
  const gridColor2 = useMemo(() => {
    const c = new THREE.Color(theme.floorColor);
    c.offsetHSL(0, 0, 0.03);
    return "#" + c.getHexString();
  }, [theme.floorColor]);

  return (
    <group position={[0, -0.01, 0]}>
      <gridHelper args={[30, 60, gridColor1, gridColor2]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          map={texture}
          metalness={theme.floorMetalness}
          roughness={theme.floorRoughness}
        />
      </mesh>
    </group>
  );
}

function ProceduralFloor({ theme }: { theme: OfficeTheme }) {
  const gridColor1 = useMemo(() => {
    const c = new THREE.Color(theme.floorColor);
    c.offsetHSL(0, 0, 0.06);
    return "#" + c.getHexString();
  }, [theme.floorColor]);
  const gridColor2 = useMemo(() => {
    const c = new THREE.Color(theme.floorColor);
    c.offsetHSL(0, 0, 0.03);
    return "#" + c.getHexString();
  }, [theme.floorColor]);

  return (
    <group position={[0, -0.01, 0]}>
      <gridHelper args={[30, 60, gridColor1, gridColor2]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color={theme.floorColor}
          metalness={theme.floorMetalness}
          roughness={theme.floorRoughness}
        />
      </mesh>
    </group>
  );
}

export function ThemedFloor({ theme, textureUrl }: ThemedFloorProps) {
  if (textureUrl) {
    return <TexturedFloor textureUrl={textureUrl} theme={theme} />;
  }
  return <ProceduralFloor theme={theme} />;
}
