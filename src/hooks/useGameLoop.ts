// src/hooks/useGameLoop.ts
import { useEffect, useRef } from "react";

export const useGameLoop = (update: (deltaTime: number) => void) => {
  const requestRef   = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  // ============================================================
  // [🧱 BLOCK: Stable Update Ref]
  // Always points to the LATEST version of the update callback.
  // This prevents the stale closure bug where the loop keeps
  // calling an old copy of the function after a re-render
  // (e.g. when isGameOver state changes in GameCanvas).
  // ============================================================
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  });

  // ============================================================
  // [🧱 BLOCK: Animation Loop]
  // Uses updateRef.current so it always calls the fresh callback.
  // Cleans up the frame request on unmount to prevent leaks.
  // ============================================================
  useEffect(() => {
    const animate = (time: number) => {
      const deltaTime = time - (previousTimeRef.current || time);
      updateRef.current(deltaTime);
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Intentionally empty — loop starts once and never restarts
};