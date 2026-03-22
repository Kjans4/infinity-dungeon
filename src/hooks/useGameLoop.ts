// src/hooks/useGameLoop.ts
import { useEffect, useRef } from "react";

export const useGameLoop = (update: (deltaTime: number) => void) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      update(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Run once on mount
};