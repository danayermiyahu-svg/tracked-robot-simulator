// File: src/components/Drone.tsx
// Aerial drone that hovers over the UGV. Its camera is a "payload" mounted on a
// gimbal with yaw + pitch (no roll). Two flight modes:
//   • Follow (default): drone chases the UGV automatically.
//   • Manual (N key): WASD forward/backward/strafe, Space=up, Shift=down.
// Arrow keys always control the payload gimbal. [ / ] adjust FOV.

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useTelemetryStore } from '../store';
import { useKeyboard } from '../hooks/useKeyboard';

const DEG2RAD = Math.PI / 180;
// בסיס התקנת מצלמת המטען על גוף הרחפן (היסט במטרים, סיבוב במעלות [yaw,pitch,roll]).
const DRONE_CAM_OFFSET: [number, number, number] = [0, -0.02, 0.16];
const DRONE_CAM_ROT: [number, number, number] = [0, -15, 0];

// Where the drone hovers relative to the UGV (world space): up and slightly behind.
const HOVER_OFFSET = new THREE.Vector3(0, 6, 4);
// How quickly the drone chases the hover target (higher = snappier follow).
const FOLLOW_RATE = 2.5;
// Manual flight speed (m/s)
const FLY_SPEED = 6;

// ===== Reusable math temporaries (module scope → no per-frame allocation) =====
const _robotPos = new THREE.Vector3();
const _hoverTarget = new THREE.Vector3();
const _bodyEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _bodyQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _localEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _localQuat = new THREE.Quaternion();
const _camPos = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _flyDir = new THREE.Vector3();

/**
 * Handles the live drone controls (arrow keys → gimbal, brackets → FOV,
 * and in manual mode: WASD + Space/Shift → position).
 * Rendered once inside the main Canvas; no-ops unless drone view is active.
 */
export function DroneControls() {
  const keys = useKeyboard();

  useFrame((_, delta) => {
    const s = useTelemetryStore.getState();
    if (!s.droneView) return;
    const k = keys.current;

    // --- Payload gimbal (yaw + pitch only, no roll) ---
    const YAW_RATE = 60;
    const PITCH_RATE = 45;
    const FOV_RATE = 40;

    let yaw = s.droneGimbalYaw;
    let pitch = s.droneGimbalPitch;

    if (k['ArrowLeft']) yaw -= YAW_RATE * delta;
    if (k['ArrowRight']) yaw += YAW_RATE * delta;
    if (k['ArrowUp']) pitch += PITCH_RATE * delta;
    if (k['ArrowDown']) pitch -= PITCH_RATE * delta;

    if (yaw !== s.droneGimbalYaw || pitch !== s.droneGimbalPitch) {
      s.setDroneGimbal(yaw, pitch);
    }

    // FOV (zoom)
    let fov = s.droneFov;
    if (k['BracketLeft']) fov -= FOV_RATE * delta;
    if (k['BracketRight']) fov += FOV_RATE * delta;
    if (fov !== s.droneFov) s.setDroneFov(fov);

    // --- Manual flight (I/K + U/O + Space/Ctrl) ---
    if (s.droneManual) {
      const [px, py, pz] = s.dronePosition;
      let dx = 0, dy = 0, dz = 0;
      if (k['KeyI']) dz -= 1;            // forward (-Z)
      if (k['KeyK']) dz += 1;            // backward
      if (k['KeyU']) dx -= 1;            // strafe left
      if (k['KeyO']) dx += 1;            // strafe right
      if (k['Space']) dy += 1;           // up
      if (k['ControlLeft'] || k['ControlRight']) dy -= 1; // down

      if (dx !== 0 || dy !== 0 || dz !== 0) {
        const step = FLY_SPEED * delta;
        // Normalise horizontal so diagonal isn't faster
        const hLen = Math.hypot(dx, dz);
        if (hLen > 0) { dx /= hLen; dz /= hLen; }
        s.setDronePosition([px + dx * step, Math.max(0.5, py + dy * step), pz + dz * step]);
      }
    }
  });

  return null;
}

/**
 * The visual drone body. Renders the mesh (and optionally the payload camera).
 * The hover position tracks the UGV; the body yaws to keep the UGV framed.
 */
export function DroneVisuals({ camera = false }: { camera?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rotorRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const robotBodyRef = useTelemetryStore(s => s.robotBodyRef);
  const posInit = useRef(false);
  const smoothPos = useMemo(() => new THREE.Vector3(0, HOVER_OFFSET.y, 0), []);

  useFrame((state, delta) => {
    const body = robotBodyRef.current;
    if (body) {
      const p = body.translation();
      _robotPos.set(p.x, p.y, p.z);
    } else {
      _robotPos.set(0, 0, 0);
    }

    const s = useTelemetryStore.getState();
    const manual = s.droneManual;

    if (manual) {
      // --- Manual mode: position comes from the store ---
      const [mx, my, mz] = s.dronePosition;
      smoothPos.set(mx, my, mz);
    } else {
      // --- Follow mode: smoothly chase the UGV ---
      _hoverTarget.copy(_robotPos).add(HOVER_OFFSET);
      if (!posInit.current) {
        smoothPos.copy(_hoverTarget);
        posInit.current = true;
      } else {
        smoothPos.lerp(_hoverTarget, Math.min(1, FOLLOW_RATE * delta));
      }
      // שומר את המיקום ב-store כל פריים כדי שמעבר לידני/ריחוף יתחיל בדיוק מכאן
      s.setDronePosition([smoothPos.x, smoothPos.y, smoothPos.z]);
    }

    // Gentle hover bob.
    const t = state.clock.elapsedTime;
    const bobY = Math.sin(t * 1.6) * 0.12;
    const dronePosY = smoothPos.y + bobY;

    // Body yaw: point the drone's front (-Z) horizontally toward the UGV.
    const dx = _robotPos.x - smoothPos.x;
    const dz = _robotPos.z - smoothPos.z;
    const bodyYaw = Math.atan2(-dx, -dz);
    _bodyEuler.set(0, bodyYaw, 0);
    _bodyQuat.setFromEuler(_bodyEuler);

    if (groupRef.current) {
      groupRef.current.position.set(smoothPos.x, dronePosY, smoothPos.z);
      groupRef.current.quaternion.copy(_bodyQuat);
      // subtle nose-down tilt + roll for a "flying" feel
      groupRef.current.rotateX(Math.sin(t * 1.2) * 0.03 - 0.05);
      groupRef.current.rotateZ(Math.sin(t * 0.9) * 0.04);
    }

    // Spin the rotors.
    rotorRefs.forEach((r, i) => {
      if (r.current) r.current.rotation.y += delta * (28 + i * 2);
    });

    // ===== Payload camera =====
    if (camera && cameraRef.current) {
      const cam = cameraRef.current;
      const s = useTelemetryStore.getState();
      const [ox, oy, oz] = DRONE_CAM_OFFSET;
      const [ryDeg, rpDeg, rrDeg] = DRONE_CAM_ROT;

      // yaw-only body frame for the payload mount (so the bob tilt/roll doesn't
      // fight the gimbal); camera position offset from the drone body.
      _yawQuat.copy(_bodyQuat);
      _camOffset.set(ox, oy, oz).applyQuaternion(_yawQuat);
      _camPos.set(smoothPos.x, dronePosY, smoothPos.z).add(_camOffset);
      cam.position.copy(_camPos);

      // Local orientation = base mount rotation + live gimbal (payload, yaw+pitch only).
      _localEuler.set(
        (rpDeg + s.droneGimbalPitch) * DEG2RAD,
        (ryDeg + s.droneGimbalYaw) * DEG2RAD,
        rrDeg * DEG2RAD,
      );
      _localQuat.setFromEuler(_localEuler);
      cam.quaternion.copy(_yawQuat).multiply(_localQuat);

      const targetFov = s.droneFov;
      if (Math.abs(cam.fov - targetFov) > 0.01) {
        cam.fov = targetFov;
        cam.updateProjectionMatrix();
      }
    }
  });

  return (
    <>
      {camera && (
        <PerspectiveCamera ref={cameraRef} makeDefault fov={60} near={0.1} far={1000} />
      )}
      <group ref={groupRef}>
        {/* Central body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.12, 0.42]} />
          <meshStandardMaterial color="#2b2f36" roughness={0.55} metalness={0.5} />
        </mesh>
        {/* Top canopy */}
        <mesh castShadow position={[0, 0.09, 0.02]}>
          <boxGeometry args={[0.22, 0.06, 0.26]} />
          <meshStandardMaterial color="#3a4048" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Four arms + rotors (X configuration) */}
        {[
          { x: 0.32, z: 0.32, i: 0 },
          { x: -0.32, z: 0.32, i: 1 },
          { x: 0.32, z: -0.32, i: 2 },
          { x: -0.32, z: -0.32, i: 3 },
        ].map(({ x, z, i }) => {
          const ang = Math.atan2(z, x);
          const len = Math.hypot(x, z);
          return (
            <group key={i}>
              {/* arm */}
              <mesh position={[x / 2, 0, z / 2]} rotation={[0, -ang, 0]} castShadow>
                <boxGeometry args={[len, 0.03, 0.05]} />
                <meshStandardMaterial color="#22262c" roughness={0.6} metalness={0.4} />
              </mesh>
              {/* motor hub */}
              <mesh position={[x, 0.02, z]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 0.06, 12]} />
                <meshStandardMaterial color="#15181c" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* rotor disc */}
              <mesh ref={rotorRefs[i]} position={[x, 0.07, z]}>
                <boxGeometry args={[0.34, 0.006, 0.03]} />
                <meshStandardMaterial color="#0e1013" transparent opacity={0.55} />
              </mesh>
            </group>
          );
        })}

        {/* Gimbal ball + camera lens (the payload), slung under the nose */}
        <group position={[0, -0.09, 0.16]}>
          <mesh castShadow>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#1a1d21" roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.02, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
            <meshStandardMaterial color="#05060a" metalness={0.9} roughness={0.1} emissive="#0a2540" emissiveIntensity={0.4} />
          </mesh>
        </group>

        {/* Blinking navigation light */}
        <mesh position={[0, -0.02, -0.22]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#ff3020" emissive="#ff3020" emissiveIntensity={3} toneMapped={false} />
        </mesh>
        <pointLight color="#ff3020" intensity={0.35} distance={1.2} decay={2} position={[0, -0.02, -0.22]} />
      </group>
    </>
  );
}
