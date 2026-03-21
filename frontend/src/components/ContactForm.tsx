import { useState, type FormEvent } from "react";

import { createParticipant } from "../lib/api";
import type { BootstrapResponse, ParticipantPayload } from "../types";

interface ContactFormProps {
  onCreated: (response: BootstrapResponse) => void;
}

export function ContactForm({ onCreated }: ContactFormProps) {
  const [formState, setFormState] = useState<ParticipantPayload>({
    first_name: "",
    last_name: "",
    phone: "",
    telegram: "",
    consent: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await createParticipant({
        ...formState,
        telegram: formState.telegram?.trim() || null,
      });
      onCreated(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить данные.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel hero-panel">
      <div className="panel-header">
        <p className="eyebrow">DDoS-Guard Event Game</p>
        <h1>Линия защиты</h1>
        <p className="lead">
          Сайт недоступен. Наружный кабельный канал под атакой. Прикрой уязвимые уровни и попади в рейтинг стенда.
        </p>
      </div>

      <form className="contact-form" onSubmit={handleSubmit}>
        <label>
          <span>Имя</span>
          <input
            required
            value={formState.first_name}
            onChange={(event) => setFormState((state) => ({ ...state, first_name: event.target.value }))}
            placeholder="Алексей"
          />
        </label>
        <label>
          <span>Фамилия</span>
          <input
            required
            value={formState.last_name}
            onChange={(event) => setFormState((state) => ({ ...state, last_name: event.target.value }))}
            placeholder="Смирнов"
          />
        </label>
        <label>
          <span>Телефон</span>
          <input
            required
            type="tel"
            value={formState.phone}
            onChange={(event) => setFormState((state) => ({ ...state, phone: event.target.value }))}
            placeholder="+7 999 123-45-67"
          />
        </label>
        <label>
          <span>Telegram</span>
          <input
            value={formState.telegram ?? ""}
            onChange={(event) => setFormState((state) => ({ ...state, telegram: event.target.value }))}
            placeholder="@nickname"
          />
        </label>
        <label className="consent-row">
          <input
            checked={formState.consent}
            type="checkbox"
            onChange={(event) => setFormState((state) => ({ ...state, consent: event.target.checked }))}
          />
          <span>Согласен на обработку персональных данных</span>
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Сохраняем..." : "Перейти к защите"}
        </button>
      </form>
    </section>
  );
}
