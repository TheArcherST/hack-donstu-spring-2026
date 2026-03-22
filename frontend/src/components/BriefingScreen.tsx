import type { Participant } from "../types";

interface BriefingScreenProps {
  participant: Participant;
  onStart: () => void;
}

export function BriefingScreen({ participant, onStart }: BriefingScreenProps) {
  return (
    <section className="game-panel briefing-panel">
      <div className="game-stage briefing-stage">
        <div className="game-overlay game-overlay-center briefing-center">
          <div className="briefing-copy">
            <p className="eyebrow">Игрок: {participant.first_name}</p>
            <h2>Защити канал связи</h2>
            <p className="lead">Задача: уменьшить потерю пакетов, защищая канал связи от атак.</p>
            <div className="briefing-points">
              <p>Ограждай линию связи от DDoS-атак с боковых сторон.</p>
              <p>Пока не произошло инцедентов безопасности, сеть в пордяке.</p>
              <p>Следи за устойчивостью конструкции.</p>
              <p>Твоя цель: не допустить потерю более 30% пакетов.</p>
            </div>
            <button type="button" className="primary-button" onClick={onStart}>
              Начать защиту
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
