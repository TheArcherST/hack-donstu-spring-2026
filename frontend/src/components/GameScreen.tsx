import { useEffect, useRef, useState } from "react";

import { advanceCameraLift, getCameraLiftTarget } from "../game/camera";
import { useGameSession } from "../game/useGameSession";
import { formatSeconds } from "../lib/format";
import { renderSnapshot } from "../game/render";
import { getSceneLayout } from "../game/scene";
import { fitViewport } from "../game/viewport";
import type { CompletionResult } from "../types";

interface GameScreenProps {
  sessionId: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onCompleted: (result: CompletionResult) => void;
}

function getPacketLossClass(packetLoss: number) {
  if (packetLoss < 10) {
    return "game-hud-value game-hud-value-stable";
  }
  if (packetLoss > 30) {
    return "game-hud-value game-hud-value-danger";
  }
  return "game-hud-value game-hud-value-warn";
}

function getIncidentClass(incidents: number) {
  if (incidents === 0) {
    return "game-hud-value game-hud-value-stable";
  }
  if (incidents >= 3) {
    return "game-hud-value game-hud-value-danger";
  }
  return "game-hud-value game-hud-value-warn";
}

function getTimerClass(timeLeftSeconds: number) {
  return timeLeftSeconds <= 10 ? "game-timer game-timer-critical" : "game-timer";
}

export function GameScreen({ sessionId, soundEnabled, onToggleSound, onCompleted }: GameScreenProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewport, setViewport] = useState({ width: 390, height: 844, offsetX: 0, offsetY: 0, dpr: 1 });
  const { frameSnapshotRef, hudSnapshot, error, saving, stageHandlers } = useGameSession({ sessionId, soundEnabled, onCompleted });
  const viewportRef = useRef({ width: 390, height: 844, offsetX: 0, offsetY: 0, dpr: 1 });
  const cameraLiftRef = useRef(0);
  const renderFrameRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  viewportRef.current = viewport;

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      return;
    }

    let frameId = 0;
    const syncViewport = () => {
      const bounds = stage.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(bounds.width));
      const nextHeight = Math.max(1, Math.round(bounds.height));
      const fitted = fitViewport(nextWidth, nextHeight);
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(fitted.width * dpr);
      canvas.height = Math.round(fitted.height * dpr);
      canvas.style.width = `${fitted.width}px`;
      canvas.style.height = `${fitted.height}px`;
      canvas.style.left = `${fitted.offsetX}px`;
      canvas.style.top = `${fitted.offsetY}px`;
      setViewport((current) =>
        current.width === fitted.width &&
        current.height === fitted.height &&
        current.offsetX === fitted.offsetX &&
        current.offsetY === fitted.offsetY &&
        current.dpr === dpr
          ? current
          : { width: fitted.width, height: fitted.height, offsetX: fitted.offsetX, offsetY: fitted.offsetY, dpr },
      );
    };

    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncViewport);
    };

    const observer = new ResizeObserver(() => {
      scheduleSync();
    });

    observer.observe(stage);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("orientationchange", scheduleSync);
    window.visualViewport?.addEventListener("resize", scheduleSync);
    window.visualViewport?.addEventListener("scroll", scheduleSync);
    scheduleSync();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      window.visualViewport?.removeEventListener("resize", scheduleSync);
      window.visualViewport?.removeEventListener("scroll", scheduleSync);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const renderFrame = (timestamp: number) => {
      const currentViewport = viewportRef.current;
      const currentSnapshot = frameSnapshotRef.current;
      const deltaMs = lastRenderTimeRef.current === 0 ? 16.67 : timestamp - lastRenderTimeRef.current;
      lastRenderTimeRef.current = timestamp;
      const layout = getSceneLayout(currentViewport.width, currentViewport.height);

      context.setTransform(currentViewport.dpr, 0, 0, currentViewport.dpr, 0, 0);

      if (currentSnapshot) {
        const targetLift = getCameraLiftTarget(layout, currentSnapshot);
        cameraLiftRef.current = advanceCameraLift(cameraLiftRef.current, targetLift, deltaMs);
        renderSnapshot(context, currentSnapshot, layout, cameraLiftRef.current, deltaMs);
      } else {
        cameraLiftRef.current = 0;
        context.clearRect(0, 0, currentViewport.width, currentViewport.height);
      }

      renderFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(renderFrameRef.current);
      lastRenderTimeRef.current = 0;
    };
  }, []);

  return (
    <section className="panel game-panel">
      <div
        ref={stageRef}
        className="game-stage"
        onPointerDown={stageHandlers.onPointerDown}
        onPointerMove={stageHandlers.onPointerMove}
        onPointerUp={stageHandlers.onPointerUp}
        onPointerCancel={stageHandlers.onPointerCancel}
        onContextMenu={stageHandlers.onContextMenu}
      >
        <canvas ref={canvasRef} className="game-canvas" width={viewport.width} height={viewport.height} />

        {hudSnapshot ? (
          <>
            <header className="game-overlay game-overlay-top game-hud">
              <div className="game-hud-column game-hud-column-left">
                <div className="game-hud-list">
                  <p>
                    Потери пакетов: <strong className={getPacketLossClass(hudSnapshot.packetLoss)}>{hudSnapshot.packetLoss}%</strong>
                  </p>
                  <p>
                    Инциденты: <strong className={getIncidentClass(hudSnapshot.activeIncidents)}>{hudSnapshot.activeIncidents}</strong>
                  </p>
                </div>
              </div>
              <div className="game-hud-column game-hud-column-center">
                <strong className={getTimerClass(hudSnapshot.timeLeftSeconds)}>{formatSeconds(hudSnapshot.timeLeftSeconds)}</strong>
              </div>
              <div className="game-hud-column game-hud-column-right">
                <button type="button" className="sound-toggle sound-toggle-floating" onClick={onToggleSound}>
                  {soundEnabled ? "🔊" : "🔈"}
                </button>
              </div>
            </header>
          </>
        ) : (
          <div className="game-overlay game-overlay-center game-loading">
            <p className="muted">Подготавливаем игровое поле...</p>
          </div>
        )}
      </div>

      {saving ? <div className="overlay-banner">Сохраняем результат...</div> : null}
      {error ? <div className="overlay-banner overlay-error">{error}</div> : null}
    </section>
  );
}
