// Shake-to-report: detects a phone shake via the DeviceMotionEvent
// accelerometer stream. iOS requires an explicit permission request from
// a user gesture (the Settings toggle) before motion events fire.

import { useEffect, useRef } from "react";

// Sum of per-axis acceleration deltas (m/s²) that counts as one jolt.
const JOLT_THRESHOLD = 18;
// Jolts within this window add up to a shake.
const WINDOW_MS = 800;
const JOLTS_PER_SHAKE = 3;
// Ignore further shakes for this long after firing.
const COOLDOWN_MS = 1500;

type MotionPermissionAPI = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Ask iOS for motion access. Must be called from a user gesture (a tap).
 * Resolves true when motion events will fire — including on platforms
 * that never gate them (Android, desktop).
 */
export const requestMotionPermission = async (): Promise<boolean> => {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const api = DeviceMotionEvent as unknown as MotionPermissionAPI;
  if (typeof api.requestPermission !== "function") return true;
  try {
    return (await api.requestPermission()) === "granted";
  } catch {
    return false;
  }
};

export const useShake = (enabled: boolean, onShake: () => void) => {
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (typeof DeviceMotionEvent === "undefined") return;

    let last: { x: number; y: number; z: number } | null = null;
    let jolts: number[] = [];
    let firedAt = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a?.x == null || a?.y == null || a?.z == null) return;
      const current = { x: a.x, y: a.y, z: a.z };
      if (last) {
        const delta =
          Math.abs(current.x - last.x) +
          Math.abs(current.y - last.y) +
          Math.abs(current.z - last.z);
        const now = Date.now();
        if (delta > JOLT_THRESHOLD && now - firedAt > COOLDOWN_MS) {
          jolts = jolts.filter((t) => now - t < WINDOW_MS);
          jolts.push(now);
          if (jolts.length >= JOLTS_PER_SHAKE) {
            jolts = [];
            firedAt = now;
            onShakeRef.current();
          }
        }
      }
      last = current;
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [enabled]);
};
