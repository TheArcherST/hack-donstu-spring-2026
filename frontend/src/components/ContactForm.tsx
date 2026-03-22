import { useState, type FormEvent } from "react";

import { createParticipant } from "../lib/api";
import type { BootstrapResponse, ParticipantPayload } from "../types";

interface ContactFormProps {
  onCreated: (response: BootstrapResponse) => void;
}

type ContactField = "first_name" | "last_name" | "phone" | "telegram" | "consent";

type ContactFieldErrors = Partial<Record<ContactField, string>>;

function validateContactForm(payload: ParticipantPayload): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const firstName = payload.first_name.trim();
  const lastName = payload.last_name.trim();
  const phone = payload.phone.trim();
  const telegram = payload.telegram?.trim() ?? "";

  if (firstName.length < 2) {
    errors.first_name = "Введите имя не короче 2 символов.";
  }
  if (lastName.length < 2) {
    errors.last_name = "Введите фамилию не короче 2 символов.";
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 6) {
    errors.phone = "Укажите телефон в понятном формате, чтобы можно было связаться.";
  }

  if (telegram.length > 120) {
    errors.telegram = "Telegram слишком длинный.";
  }

  if (!payload.consent) {
    errors.consent = "Нужно согласие на обработку данных, иначе мы не можем сохранить заявку.";
  }

  return errors;
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
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});

  function updateField<K extends ContactField>(field: K, value: ParticipantPayload[K]) {
    setFormState((state) => ({ ...state, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFieldErrors = validateContactForm(formState);
    setFieldErrors(nextFieldErrors);
    setError(null);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await createParticipant({
        ...formState,
        first_name: formState.first_name.trim(),
        last_name: formState.last_name.trim(),
        phone: formState.phone.trim(),
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
            aria-invalid={Boolean(fieldErrors.first_name)}
            className={fieldErrors.first_name ? "input-error" : undefined}
            value={formState.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            placeholder="Алексей"
          />
          {fieldErrors.first_name ? <small className="field-error">{fieldErrors.first_name}</small> : null}
        </label>
        <label>
          <span>Фамилия</span>
          <input
            required
            aria-invalid={Boolean(fieldErrors.last_name)}
            className={fieldErrors.last_name ? "input-error" : undefined}
            value={formState.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            placeholder="Смирнов"
          />
          {fieldErrors.last_name ? <small className="field-error">{fieldErrors.last_name}</small> : null}
        </label>
        <label>
          <span>Телефон</span>
          <input
            required
            type="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
            className={fieldErrors.phone ? "input-error" : undefined}
            value={formState.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+7 999 123-45-67"
          />
          {fieldErrors.phone ? <small className="field-error">{fieldErrors.phone}</small> : null}
        </label>
        <label>
          <span>Telegram</span>
          <input
            aria-invalid={Boolean(fieldErrors.telegram)}
            className={fieldErrors.telegram ? "input-error" : undefined}
            value={formState.telegram ?? ""}
            onChange={(event) => updateField("telegram", event.target.value)}
            placeholder="@nickname"
          />
          {fieldErrors.telegram ? <small className="field-error">{fieldErrors.telegram}</small> : null}
        </label>
        <label className="consent-row">
          <input
            checked={formState.consent}
            type="checkbox"
            onChange={(event) => updateField("consent", event.target.checked)}
          />
          <span>Согласен на обработку персональных данных</span>
        </label>
        {fieldErrors.consent ? <p className="error-text inline-error">{fieldErrors.consent}</p> : null}
        {error ? <p className="error-text inline-error">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Сохраняем..." : "Перейти к защите"}
        </button>
      </form>
    </section>
  );
}
