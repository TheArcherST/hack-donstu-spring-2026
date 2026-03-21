import { useEffect, useRef, useState, type PointerEvent } from "react";

import { createGameEngine } from "../game/engine";
import { renderSnapshot } from "../game/render";
import type { EngineControls, FinishPayload, GameSnapshot } from "../game/types";
import { completeSession } from "../lib/api";
import { formatSeconds } from "../lib/format";
import { useSynthAudio } from "../lib/useSynthAudio";
import type { CompletionResult } from "../types";

interface GameScreenProps {
  sessionId: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onCompleted: (result: CompletionResult) => void;
}

export function GameScreen({ sessionId, soundEnabled, onToggleSound, onCompleted }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<EngineControls | null>(null);
  const gestureRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const onCompletedRef = useRef(onCompleted);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const audio = useSynthAudio(soundEnabled);
  const audioRef = useRef(audio);

  onCompletedRef.current = onCompleted;
  audioRef.current = audio;

  useEffect(() => {
    const engine = createGameEngine({
      onStateChange: (nextSnapshot) => {
        setSnapshot(nextSnapshot);
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
        controlsRef.current.moveLeft();
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        controlsRef.current.moveRight();
      } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        controlsRef.current.rotate();
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
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
  }, [sessionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    renderSnapshot(context, snapshot);
  }, [snapshot]);

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    audioRef.current.resume();
    gestureRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    };
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
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

  if (!snapshot) {
    return (
      <section className="panel game-panel">
        <p className="muted">Подготавливаем игровое поле...</p>
      </section>
    );
  }

  return (
    <section className="panel game-panel">
      <header className="hud">
        <div className="hud-card">
          <span>Таймер</span>
          <strong>{formatSeconds(snapshot.timeLeftSeconds)}</strong>
        </div>
        <div className="hud-card">
          <span>Очки</span>
          <strong>{snapshot.score}</strong>
        </div>
        <div className="hud-card hud-protection">
          <span>Защита канала</span>
          <strong>{snapshot.protectionLevel}%</strong>
          <div className="progress-bar">
            <i style={{ width: `${snapshot.protectionLevel}%` }} />
          </div>
        </div>
        <button type="button" className="sound-toggle" onClick={onToggleSound}>
          {soundEnabled ? "Звук: вкл" : "Звук: выкл"}
        </button>
      </header>

      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={400}
        height={760}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />

      <footer className="hud-footer">
        <p>Свайп влево/вправо: сдвиг. Тап: поворот. Свайп вниз: ускорение. Длинный свайп вниз: сброс.</p>
        <div className="hud-meta">
          <span>Интенсивность атаки: {snapshot.attackIntensity}%</span>
          <span>Защищённых сегментов: {snapshot.preservedSegments}</span>
          <span>Разрушено: {snapshot.destroyedSegments}</span>
        </div>
      </footer>

      {saving ? <div className="overlay-banner">Сохраняем результат...</div> : null}
      {error ? <div className="overlay-banner overlay-error">{error}</div> : null}
    </section>
  );
}
