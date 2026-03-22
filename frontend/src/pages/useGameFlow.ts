import { useEffect, useState } from "react";

import type { BootstrapResponse, CompletionResult } from "../types";

export type ScreenState = "form" | "briefing" | "game" | "result";

export function useGameFlow() {
  const [screen, setScreen] = useState<ScreenState>("form");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  function reset() {
    setScreen("form");
    setBootstrap(null);
    setResult(null);
  }

  function handleCreated(response: BootstrapResponse) {
    setBootstrap(response);
    setScreen("briefing");
  }

  function handleCompleted(completion: CompletionResult) {
    setResult(completion);
    setScreen("result");
  }

  useEffect(() => {
    document.body.classList.toggle("game-active", screen === "game");
    if (screen === "game") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    return () => {
      document.body.classList.remove("game-active");
    };
  }, [screen]);

  return {
    screen,
    bootstrap,
    result,
    soundEnabled,
    setScreen,
    toggleSound: () => setSoundEnabled((value) => !value),
    handleCreated,
    handleCompleted,
    reset,
  };
}
