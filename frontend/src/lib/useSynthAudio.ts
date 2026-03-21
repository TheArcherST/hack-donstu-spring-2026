import { useEffect, useRef } from "react";

import type { SoundCue } from "../game/types";

function playTone(
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  destination: GainNode,
  slideTo?: number,
) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, audioContext.currentTime + duration);
  }
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

export function useSynthAudio(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const loopRef = useRef<number | null>(null);

  function ensureContext() {
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
      masterGainRef.current = contextRef.current.createGain();
      masterGainRef.current.gain.value = enabled ? 0.18 : 0;
      masterGainRef.current.connect(contextRef.current.destination);
    }
    return { context: contextRef.current, master: masterGainRef.current! };
  }

  function resume() {
    const { context } = ensureContext();
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  function play(cue: SoundCue) {
    if (!enabled) {
      return;
    }

    const { context, master } = ensureContext();
    if (context.state === "suspended") {
      void context.resume();
    }

    switch (cue) {
      case "lock":
        playTone(context, 220, 0.12, "triangle", 0.1, master, 160);
        break;
      case "attack":
        playTone(context, 150, 0.18, "sawtooth", 0.06, master, 90);
        break;
      case "break":
        playTone(context, 130, 0.2, "square", 0.08, master, 70);
        break;
      case "audit":
        playTone(context, 360, 0.16, "triangle", 0.12, master, 720);
        playTone(context, 540, 0.22, "sine", 0.08, master, 960);
        break;
      case "win":
        playTone(context, 440, 0.18, "triangle", 0.12, master, 660);
        playTone(context, 660, 0.28, "sine", 0.1, master, 880);
        break;
      case "lose":
        playTone(context, 200, 0.22, "sawtooth", 0.08, master, 120);
        break;
    }
  }

  function setBackgroundActive(active: boolean) {
    if (loopRef.current) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (!active || !enabled) {
      return;
    }

    resume();
    loopRef.current = window.setInterval(() => {
      const { context, master } = ensureContext();
      playTone(context, 96, 0.9, "sine", 0.025, master, 82);
      playTone(context, 192, 0.28, "triangle", 0.018, master, 176);
    }, 2400);
  }

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = enabled ? 0.18 : 0;
    }
    if (!enabled && loopRef.current) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (loopRef.current) {
        window.clearInterval(loopRef.current);
      }
      if (contextRef.current) {
        void contextRef.current.close();
      }
    };
  }, []);

  return { play, resume, setBackgroundActive };
}
