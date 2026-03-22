import { formatSeconds } from "../lib/format";
import type { CompletionResult } from "../types";
import { PacketLossChart } from "./PacketLossChart";

interface ResultScreenProps {
  result: CompletionResult;
  onReset: () => void;
}

export function ResultScreen({ result, onReset }: ResultScreenProps) {
  const { session, rank } = result;
  const success = session.won;
  const { network_metrics, stability_window } = session.result_details;

  return (
    <div className="experience-grid">
      <section className="panel hero-panel">
        <div className="panel-header">
          <p className="eyebrow">{success ? "Победа" : "Поражение"}</p>
          <h2>{success ? "Линия устояла" : "Линия не выдержала"}</h2>
          <p className="lead">
            {success
              ? "Итог определён по среднему packet loss за всю сессию."
              : session.failure_reason ?? "Итог определён по среднему packet loss за всю сессию."}
          </p>
        </div>

        <div className="result-summary-strip">
          <article>
            <span>Средний packet loss</span>
            <strong>{network_metrics.packet_loss}%</strong>
          </article>
          <article>
            <span>Место в рейтинге</span>
            <strong>#{rank}</strong>
          </article>
        </div>

        <PacketLossChart
          points={session.result_details.packet_loss_timeline}
          durationSeconds={session.duration_seconds}
          averagePacketLoss={network_metrics.packet_loss}
        />

        <div className="result-metrics">
          <article>
            <span>Доставка</span>
            <strong>{network_metrics.delivery_rate}%</strong>
          </article>
          <article>
            <span>Доставлено пакетов</span>
            <strong>{network_metrics.delivered_packets}</strong>
          </article>
          <article>
            <span>Потеряно пакетов</span>
            <strong>{network_metrics.dropped_packets}</strong>
          </article>
          <article>
            <span>Длительность</span>
            <strong>{formatSeconds(session.duration_seconds)}</strong>
          </article>
          <article>
            <span>Защищённость опоры</span>
            <strong>{session.protection_level}%</strong>
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
    </div>
  );
}
