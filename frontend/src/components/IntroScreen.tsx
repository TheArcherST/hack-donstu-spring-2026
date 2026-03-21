import { useEffect } from "react";

interface IntroScreenProps {
  onDone: () => void;
}

export function IntroScreen({ onDone }: IntroScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 900);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <section className="intro-toast-wrap" aria-live="polite">
      <div className="intro-toast">
        <p className="eyebrow">Внимание</p>
        <strong>Защити линию связи от атаки</strong>
      </div>
    </section>
  );
}
