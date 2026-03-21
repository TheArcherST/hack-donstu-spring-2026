import { useEffect } from "react";

interface IntroScreenProps {
  onDone: () => void;
}

export function IntroScreen({ onDone }: IntroScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <section className="panel intro-panel">
      <div className="intro-top">
        <p className="eyebrow">Подключение оборвано</p>
        <h2>Камера уходит в зону атаки</h2>
      </div>
      <div className="intro-shaft">
        <div className="intro-user">USER</div>
        <div className="intro-beam" />
        <div className="intro-noise intro-noise-left" />
        <div className="intro-noise intro-noise-right" />
        <div className="intro-server">SERVER</div>
      </div>
    </section>
  );
}
