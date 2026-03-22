import { useEffect, useRef, useState } from "react";

import { GAME_CRITICAL_IMAGE_ASSET_URLS, GAME_DEFERRED_IMAGE_ASSET_URLS } from "../game/assets";
import { advanceCameraLift, getCameraLiftTarget } from "../game/camera";
import { preloadTextureSources, renderSnapshot, type RenderOptions } from "../game/render";
import { useGameSession } from "../game/useGameSession";
import { formatSeconds } from "../lib/format";
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

interface ViewportState {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  dpr: number;
}

interface RenderProfile {
  maxDpr: number;
  renderIntervalMs: number;
  snapshotIntervalMs: number;
  reducedEffects: boolean;
  deferDecorativeAssets: boolean;
}

interface NavigatorWithHints extends Navigator {
  connection?: {
    saveData?: boolean;
  };
  deviceMemory?: number;
}

const DEFAULT_VIEWPORT: ViewportState = { width: 390, height: 844, offsetX: 0, offsetY: 0, dpr: 1 };

function matchesMedia(query: string) {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false;
}

function resolveRenderProfile(width: number, height: number): RenderProfile {
  const navigatorHints = navigator as NavigatorWithHints;
  const coarsePointer = matchesMedia("(pointer: coarse)");
  const reducedMotion = matchesMedia("(prefers-reduced-motion: reduce)");
  const constrainedDevice =
    reducedMotion ||
    navigatorHints.connection?.saveData === true ||
    (typeof navigatorHints.deviceMemory === "number" && navigatorHints.deviceMemory <= 4) ||
    (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 6);
  const mobileViewport = coarsePointer || Math.min(width, height) <= 768;

  if (mobileViewport && constrainedDevice) {
    return {
      maxDpr: 1.25,
      renderIntervalMs: 33.34,
      snapshotIntervalMs: 33.34,
      reducedEffects: true,
      deferDecorativeAssets: true,
    };
  }

  if (mobileViewport) {
    return {
      maxDpr: 1.5,
      renderIntervalMs: 16.67,
      snapshotIntervalMs: 24,
      reducedEffects: true,
      deferDecorativeAssets: true,
    };
  }

  return {
    maxDpr: 2,
    renderIntervalMs: 16.67,
    snapshotIntervalMs: 16.67,
    reducedEffects: false,
    deferDecorativeAssets: false,
  };
}

function isSameRenderProfile(left: RenderProfile, right: RenderProfile) {
  return (
    left.maxDpr === right.maxDpr &&
    left.renderIntervalMs === right.renderIntervalMs &&
    left.snapshotIntervalMs === right.snapshotIntervalMs &&
    left.reducedEffects === right.reducedEffects &&
    left.deferDecorativeAssets === right.deferDecorativeAssets
  );
}

export function GameScreen({ sessionId, soundEnabled, onToggleSound, onCompleted }: GameScreenProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialRenderProfileRef = useRef(
    resolveRenderProfile(
      typeof window === "undefined" ? DEFAULT_VIEWPORT.width : window.innerWidth,
      typeof window === "undefined" ? DEFAULT_VIEWPORT.height : window.innerHeight,
    ),
  );
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const [renderProfile, setRenderProfile] = useState(initialRenderProfileRef.current);
  const [assetsReady, setAssetsReady] = useState(false);
  const [decorativeAssetsReady, setDecorativeAssetsReady] = useState(!initialRenderProfileRef.current.deferDecorativeAssets);
  const [assetError, setAssetError] = useState<string | null>(null);
  const { frameSnapshotRef, hudSnapshot, error, saving, stageHandlers } = useGameSession({
    sessionId,
    soundEnabled,
    enabled: assetsReady,
    snapshotIntervalMs: initialRenderProfileRef.current.snapshotIntervalMs,
    onCompleted,
  });
  const viewportRef = useRef(DEFAULT_VIEWPORT);
  const renderOptionsRef = useRef<RenderOptions>({
    reducedEffects: initialRenderProfileRef.current.reducedEffects,
    showDecorativeAssets: !initialRenderProfileRef.current.deferDecorativeAssets,
  });
  const renderProfileRef = useRef(initialRenderProfileRef.current);
  const cameraLiftRef = useRef(0);
  const renderFrameRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  viewportRef.current = viewport;
  renderProfileRef.current = renderProfile;
  renderOptionsRef.current = {
    reducedEffects: renderProfile.reducedEffects,
    showDecorativeAssets: decorativeAssetsReady,
  };

  useEffect(() => {
    let cancelled = false;
    setAssetsReady(false);
    setDecorativeAssetsReady(!initialRenderProfileRef.current.deferDecorativeAssets);
    setAssetError(null);

    preloadTextureSources(GAME_CRITICAL_IMAGE_ASSET_URLS)
      .then(() => {
        if (!cancelled) {
          setAssetsReady(true);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setAssetError(loadError instanceof Error ? loadError.message : "Не удалось загрузить игровые ресурсы.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assetsReady) {
      return;
    }

    if (GAME_DEFERRED_IMAGE_ASSET_URLS.length === 0) {
      setDecorativeAssetsReady(true);
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    const preloadDeferredAssets = () => {
      void preloadTextureSources(GAME_DEFERRED_IMAGE_ASSET_URLS)
        .then(() => {
          if (!cancelled) {
            setDecorativeAssetsReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDecorativeAssetsReady(true);
          }
        });
    };

    if (!renderProfile.deferDecorativeAssets) {
      preloadDeferredAssets();
      return () => {
        cancelled = true;
      };
    }

    timeoutId = window.setTimeout(preloadDeferredAssets, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [assetsReady, renderProfile.deferDecorativeAssets]);

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
      const nextRenderProfile = resolveRenderProfile(nextWidth, nextHeight);
      const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), nextRenderProfile.maxDpr);
      const canvasWidth = Math.round(fitted.width * dpr);
      const canvasHeight = Math.round(fitted.height * dpr);

      if (canvas.width !== canvasWidth) {
        canvas.width = canvasWidth;
      }
      if (canvas.height !== canvasHeight) {
        canvas.height = canvasHeight;
      }
      const cssWidth = `${fitted.width}px`;
      const cssHeight = `${fitted.height}px`;
      const cssLeft = `${fitted.offsetX}px`;
      const cssTop = `${fitted.offsetY}px`;

      if (canvas.style.width !== cssWidth) {
        canvas.style.width = cssWidth;
      }
      if (canvas.style.height !== cssHeight) {
        canvas.style.height = cssHeight;
      }
      if (canvas.style.left !== cssLeft) {
        canvas.style.left = cssLeft;
      }
      if (canvas.style.top !== cssTop) {
        canvas.style.top = cssTop;
      }

      setRenderProfile((current) => (isSameRenderProfile(current, nextRenderProfile) ? current : nextRenderProfile));
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
    const context =
      canvas.getContext("2d", { alpha: false, desynchronized: true }) ??
      canvas.getContext("2d");
    if (!context) {
      return;
    }

    const renderFrame = (timestamp: number) => {
      const currentViewport = viewportRef.current;
      const currentRenderProfile = renderProfileRef.current;
      const currentSnapshot = frameSnapshotRef.current;
      const elapsedSinceLastPaint = timestamp - lastRenderTimeRef.current;
      if (
        lastRenderTimeRef.current !== 0 &&
        elapsedSinceLastPaint < currentRenderProfile.renderIntervalMs - 1
      ) {
        renderFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }
      const deltaMs = lastRenderTimeRef.current === 0 ? currentRenderProfile.renderIntervalMs : elapsedSinceLastPaint;
      lastRenderTimeRef.current = timestamp;
      const layout = getSceneLayout(currentViewport.width, currentViewport.height);

      context.setTransform(currentViewport.dpr, 0, 0, currentViewport.dpr, 0, 0);

      if (currentSnapshot) {
        const targetLift = getCameraLiftTarget(layout, currentSnapshot);
        cameraLiftRef.current = advanceCameraLift(cameraLiftRef.current, targetLift, deltaMs);
        renderSnapshot(context, currentSnapshot, layout, cameraLiftRef.current, deltaMs, renderOptionsRef.current);
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
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={viewport.width}
          height={viewport.height}
          style={{ opacity: assetsReady ? 1 : 0 }}
        />

        {assetError ? (
          <div className="game-overlay game-overlay-center game-loading">
            <p className="muted">{assetError}</p>
          </div>
        ) : !assetsReady ? (
          <div className="game-overlay game-overlay-center game-loading">
            <p className="muted">Загружаем игровые ресурсы...</p>
          </div>
        ) : hudSnapshot ? (
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
