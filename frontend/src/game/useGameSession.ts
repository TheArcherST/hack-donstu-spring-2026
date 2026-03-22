import { startTransition, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

import { createGameEngine } from "./engine";
import { createHudSnapshot } from "./snapshot";
import type { EngineControls, FinishPayload, GameHudSnapshot, GameSnapshot } from "./types";
import { completeSession } from "../lib/api";
import { useSynthAudio } from "../lib/useSynthAudio";
import type { CompletionResult } from "../types";

interface UseGameSessionOptions {
  sessionId: number;
  soundEnabled: boolean;
  enabled: boolean;
  onCompleted: (result: CompletionResult) => void;
}

export function useGameSession({ sessionId, soundEnabled, enabled, onCompleted }: UseGameSessionOptions) {
  const controlsRef = useRef<EngineControls | null>(null);
  const gestureRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const onCompletedRef = useRef(onCompleted);
  const frameSnapshotRef = useRef<GameSnapshot | null>(null);
  const hudSnapshotRef = useRef<GameHudSnapshot | null>(null);
  const lastHudCommitAtRef = useRef(0);
  const [hudSnapshot, setHudSnapshot] = useState<GameHudSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const audio = useSynthAudio(soundEnabled);
  const audioRef = useRef(audio);

  onCompletedRef.current = onCompleted;
  audioRef.current = audio;

  useEffect(() => {
    if (!enabled) {
      frameSnapshotRef.current = null;
      hudSnapshotRef.current = null;
      lastHudCommitAtRef.current = 0;
      setHudSnapshot(null);
      audioRef.current.setBackgroundActive(false);
      return;
    }

    const engine = createGameEngine({
      onStateChange: (nextSnapshot) => {
        frameSnapshotRef.current = nextSnapshot;

        const nextHudSnapshot = createHudSnapshot(nextSnapshot);
        const previousHudSnapshot = hudSnapshotRef.current;
        const now = performance.now();
        const hasImportantHudChange =
          !previousHudSnapshot ||
          previousHudSnapshot.packetLoss !== nextHudSnapshot.packetLoss ||
          previousHudSnapshot.activeIncidents !== nextHudSnapshot.activeIncidents ||
          previousHudSnapshot.timeLeftSeconds !== nextHudSnapshot.timeLeftSeconds;

        if (!hasImportantHudChange && now - lastHudCommitAtRef.current < 120) {
          return;
        }

        hudSnapshotRef.current = nextHudSnapshot;
        lastHudCommitAtRef.current = now;
        startTransition(() => {
          setHudSnapshot((current) =>
            current &&
            current.packetLoss === nextHudSnapshot.packetLoss &&
            current.activeIncidents === nextHudSnapshot.activeIncidents &&
            current.timeLeftSeconds === nextHudSnapshot.timeLeftSeconds
              ? current
              : nextHudSnapshot,
          );
        });
      },
      onFinish: async (payload: FinishPayload) => {
        setSaving(true);
        try {
          const result = await completeSession(sessionId, payload);
          onCompletedRef.current(result);
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить результат.");
        } finally {
          setSaving(false);
          audioRef.current.setBackgroundActive(false);
        }
      },
      onSound: (cue) => {
        audioRef.current.play(cue);
      },
    });

    controlsRef.current = engine;
    engine.start();
    audioRef.current.resume();
    audioRef.current.setBackgroundActive(true);

    function handleKeyDown(event: KeyboardEvent) {
      if (!controlsRef.current) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        controlsRef.current.moveLeft();
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        controlsRef.current.moveRight();
      } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        controlsRef.current.rotate();
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        controlsRef.current.softDrop();
      } else if (event.key === " ") {
        event.preventDefault();
        controlsRef.current.hardDrop();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      audioRef.current.setBackgroundActive(false);
      engine.stop();
      controlsRef.current = null;
    };
  }, [enabled, sessionId]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    audioRef.current.resume();
    gestureRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const start = gestureRef.current;
    const controls = controlsRef.current;
    if (!start || !controls) {
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const duration = Date.now() - start.time;
    gestureRef.current = null;

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      controls.rotate();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 24) {
      if (dx > 0) {
        controls.moveRight();
      } else {
        controls.moveLeft();
      }
      return;
    }
    if (dy > 110 || (dy > 70 && duration > 220)) {
      controls.hardDrop();
      return;
    }
    if (dy > 28) {
      controls.softDrop();
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    gestureRef.current = null;
  }

  return {
    frameSnapshotRef,
    hudSnapshot,
    error,
    saving,
    stageHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onContextMenu: (event: MouseEvent<HTMLDivElement>) => event.preventDefault(),
    },
  };
}
