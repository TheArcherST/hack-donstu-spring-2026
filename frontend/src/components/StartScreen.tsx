import type { LeaderboardEntry, Participant } from "../types";
import { LeaderboardCard } from "./LeaderboardCard";

interface StartScreenProps {
  participant: Participant;
  leaderboard: LeaderboardEntry[];
  onStart: () => void;
}

export function StartScreen({ participant, leaderboard, onStart }: StartScreenProps) {
  return (
    <div className="experience-grid">
      <section className="panel hero-panel">
        <img className="brand-logo" src="/logo.svg" alt="DDoS-Guard" />
        <div className="panel-header">
          <p className="eyebrow">Игрок: {participant.first_name}</p>
          <h2>Стабилизируй поток в столбе связи</h2>
          <p className="lead">
            Ты видишь не абстрактный статус, а сам трафик внутри линии. Чем чище и быстрее поднимаются световые пакеты,
            тем ближе связь к восстановлению.
          </p>
        </div>
        <div className="mission-card">
          <p>Закрывай нижние уязвимые секции раньше верхних: слабый низ замедляет, тускнит и рвёт весь поток выше.</p>
          <div className="signal-legend">
            <article>
              <strong>Чистый голубой поток</strong>
              <span>Линия держится, пакеты доходят вверх.</span>
            </article>
            <article>
              <strong>Редкий / тусклый поток</strong>
              <span>Связь нестабильна, сегменты перегружены.</span>
            </article>
            <article>
              <strong>Красные срывы</strong>
              <span>Пакеты теряются, нижние зоны надо срочно закрыть.</span>
            </article>
          </div>
          <button type="button" className="primary-button" onClick={onStart}>
            Запустить линию
          </button>
        </div>
      </section>
      <LeaderboardCard items={leaderboard.slice(0, 6)} />
    </div>
  );
}
