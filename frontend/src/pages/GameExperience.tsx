import { ContactForm } from "../components/ContactForm";
import { BriefingScreen } from "../components/BriefingScreen";
import { GameScreen } from "../components/GameScreen";
import { ResultScreen } from "../components/ResultScreen";
import { useGameFlow } from "./useGameFlow";

export function GameExperience() {
  const flow = useGameFlow();

  return (
    <main className={`app-shell screen-${flow.screen}`}>
      <div className="app-backdrop" />
      <div className={`app-content screen-${flow.screen}`}>
        {flow.screen === "form" ? (
          <div className="experience-grid">
            <ContactForm onCreated={flow.handleCreated} />
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
