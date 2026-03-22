import { ContactForm } from "../components/ContactForm";
import { BriefingScreen } from "../components/BriefingScreen";
import { GameScreen } from "../components/GameScreen";
import { LeaderboardCard } from "../components/LeaderboardCard";
import { ResultScreen } from "../components/ResultScreen";
import type { LeaderboardEntry } from "../types";
import { useGameFlow } from "./useGameFlow";

interface GameExperienceProps {
  initialLeaderboard: LeaderboardEntry[];
  leaderboardError: string | null;
  onLeaderboardRefresh: (items: LeaderboardEntry[]) => void;
}

export function GameExperience({
  initialLeaderboard,
  leaderboardError,
  onLeaderboardRefresh,
}: GameExperienceProps) {
  const flow = useGameFlow({ onLeaderboardRefresh });

  return (
    <main className={`app-shell screen-${flow.screen}`}>
      <div className="app-backdrop" />
      <div className={`app-content screen-${flow.screen}`}>
        {flow.screen === "form" ? (
          <div className="experience-grid">
            <ContactForm
              onCreated={flow.handleCreated}
            />
            <div className="stack-column">
              <LeaderboardCard items={initialLeaderboard.slice(0, 6)} />
              {leaderboardError ? <p className="error-text inline-error">{leaderboardError}</p> : null}
            </div>
          </div>
        ) : null}

        {flow.screen === "briefing" && flow.bootstrap ? (
          <BriefingScreen participant={flow.bootstrap.participant} onStart={() => flow.setScreen("game")} />
        ) : null}

        {flow.screen === "game" && flow.bootstrap ? (
          <GameScreen
            sessionId={flow.bootstrap.session.id}
            soundEnabled={flow.soundEnabled}
            onToggleSound={flow.toggleSound}
            onCompleted={flow.handleCompleted}
          />
        ) : null}

        {flow.screen === "result" && flow.result ? <ResultScreen result={flow.result} onReset={flow.reset} /> : null}
      </div>
    </main>
  );
}
