import { Suspense, lazy } from "react";

import { ContactForm } from "../components/ContactForm";
import { BriefingScreen } from "../components/BriefingScreen";
import { useGameFlow } from "./useGameFlow";

const GameScreen = lazy(async () => {
  const module = await import("../components/GameScreen");
  return { default: module.GameScreen };
});

const ResultScreen = lazy(async () => {
  const module = await import("../components/ResultScreen");
  return { default: module.ResultScreen };
});

function ExperienceLoader({ title }: { title: string }) {
  return (
    <section className="panel hero-panel">
      <div className="panel-header">
        <p className="eyebrow">Загрузка</p>
        <h2>{title}</h2>
        <p className="lead">Подгружаем только тот экран, который действительно нужен сейчас.</p>
      </div>
    </section>
  );
}

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
          <Suspense fallback={<ExperienceLoader title="Подготавливаем игровую сцену" />}>
            <GameScreen
              sessionId={flow.bootstrap.session.id}
              soundEnabled={flow.soundEnabled}
              onToggleSound={flow.toggleSound}
              onCompleted={flow.handleCompleted}
            />
          </Suspense>
        ) : null}

        {flow.screen === "result" && flow.result ? (
          <Suspense fallback={<ExperienceLoader title="Собираем результат сессии" />}>
            <ResultScreen result={flow.result} onReset={flow.reset} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}
