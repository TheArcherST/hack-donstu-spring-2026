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
          <h2>Канал связи под атакой</h2>
          <p className="lead">
            Пользователь не может открыть сайт. Проведи маршрут от сервера к пользователю и укрепи его синими
            блоками DDoS-Guard.
          </p>
        </div>
        <div className="mission-card">
          <p>Сайт недоступен. Канал связи под атакой. Восстанови защищённое соединение.</p>
          <button type="button" className="primary-button" onClick={onStart}>
            Начать защиту
          </button>
        </div>
      </section>
      <LeaderboardCard items={leaderboard.slice(0, 6)} />
    </div>
  );
}
