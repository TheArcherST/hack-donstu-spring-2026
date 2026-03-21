import { useState } from "react";

import { ContactForm } from "../components/ContactForm";
import { GameScreen } from "../components/GameScreen";
import { IntroScreen } from "../components/IntroScreen";
import { LeaderboardCard } from "../components/LeaderboardCard";
import { ResultScreen } from "../components/ResultScreen";
import { StartScreen } from "../components/StartScreen";
import type { BootstrapResponse, CompletionResult, LeaderboardEntry } from "../types";

interface GameExperienceProps {
  initialLeaderboard: LeaderboardEntry[];
  leaderboardError: string | null;
  onLeaderboardRefresh: (items: LeaderboardEntry[]) => void;
}

type ScreenState = "form" | "start" | "intro" | "game" | "result";

export function GameExperience({
  initialLeaderboard,
  leaderboardError,
  onLeaderboardRefresh,
}: GameExperienceProps) {
  const [screen, setScreen] = useState<ScreenState>("form");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  function reset() {
    setScreen("form");
    setBootstrap(null);
    setResult(null);
  }

  return (
    <main className="app-shell">
      <div className="app-backdrop" />
      <div className="app-content">
        {screen === "form" ? (
          <div className="experience-grid">
            <ContactForm
              onCreated={(response) => {
                setBootstrap(response);
                setScreen("start");
              }}
            />
            <div className="stack-column">
              <LeaderboardCard items={initialLeaderboard.slice(0, 6)} />
              {leaderboardError ? <p className="error-text inline-error">{leaderboardError}</p> : null}
            </div>
          </div>
        ) : null}

        {screen === "start" && bootstrap ? (
          <StartScreen
            participant={bootstrap.participant}
            leaderboard={initialLeaderboard}
            onStart={() => setScreen("intro")}
          />
        ) : null}

        {screen === "intro" ? <IntroScreen onDone={() => setScreen("game")} /> : null}

        {screen === "game" && bootstrap ? (
          <GameScreen
            sessionId={bootstrap.session.id}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((value) => !value)}
            onCompleted={(completion) => {
              setResult(completion);
              setScreen("result");
              onLeaderboardRefresh(completion.leaderboard);
            }}
          />
        ) : null}

        {screen === "result" && result ? <ResultScreen result={result} onReset={reset} /> : null}
      </div>
    </main>
  );
}
