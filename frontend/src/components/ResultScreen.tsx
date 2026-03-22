import { formatSeconds } from "../lib/format";
import type { CompletionResult } from "../types";
import { LeaderboardCard } from "./LeaderboardCard";

interface ResultScreenProps {
  result: CompletionResult;
  onReset: () => void;
}

export function ResultScreen({ result, onReset }: ResultScreenProps) {
  const { session, rank, leaderboard } = result;
  const success = session.won;
  const protectionLevel = session.protection_level;
  const { network_metrics, stability_window } = session.result_details;

  return (
    <div className="experience-grid">
      <section className="panel hero-panel">
        <div className="panel-header">
          <p className="eyebrow">{success ? "Потери удержаны в норме" : "Потери канала вышли за предел"}</p>
          <h2>
            {success ? "Общий packet loss остался в допустимом диапазоне" : "Итоговый packet loss оказался слишком высоким"}
          </h2>
          <p className="lead">
            {success
              ? "Матч шёл до конца таймера, а итог определился по минимальному проценту потерянных пакетов."
              : session.failure_reason ?? "Поток остался слишком редким и рваным для устойчивой связи."}
          </p>
        </div>

        <div className="result-metrics">
          <article>
            <span>Packet loss</span>
            <strong>{network_metrics.packet_loss}%</strong>
          </article>
          <article>
            <span>Доставка</span>
            <strong>{network_metrics.delivery_rate}%</strong>
          </article>
          <article>
            <span>Пакеты</span>
            <strong>{network_metrics.delivered_packets}</strong>
          </article>
          <article>
            <span>Защита</span>
            <strong>{protectionLevel}%</strong>
          </article>
          <article>
            <span>Место</span>
            <strong>#{rank}</strong>
          </article>
          <article>
            <span>Длительность</span>
            <strong>{formatSeconds(session.duration_seconds)}</strong>
          </article>
          <article>
            <span>Потери</span>
            <strong>{network_metrics.dropped_packets}</strong>
          </article>
          <article>
            <span>Латентность</span>
            <strong>{network_metrics.latency_ms} мс</strong>
          </article>
          <article>
            <span>Поток</span>
            <strong>{network_metrics.throughput}%</strong>
          </article>
          <article>
            <span>Уронено пакетов</span>
            <strong>{network_metrics.dropped_packets}</strong>
          </article>
          <article>
            <span>Качество линии</span>
            <strong>{network_metrics.link_quality}%</strong>
          </article>
          <article>
            <span>Стабильный режим</span>
            <strong>{stability_window.hold_seconds} сек</strong>
          </article>
        </div>

        <button type="button" className="primary-button" onClick={onReset}>
          Следующий участник
        </button>
      </section>
      <LeaderboardCard items={leaderboard} title="Актуальный рейтинг" />
    </div>
  );
}
