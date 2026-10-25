import { useEffect, useState } from 'react';
import { language } from './languages';

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Voices load asynchronously on Android; this hook re-renders once they are known. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => synth()?.getVoices() ?? []);
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const update = () => setVoices(s.getVoices());
    update();
    s.addEventListener('voiceschanged', update);
    return () => s.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

function normalize(tag: string) {
  return tag.toLowerCase().replace('_', '-');
}

export function voicesFor(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice[] {
  const tag = normalize(language(langCode).speech);
  const primary = tag.split('-')[0];
  const exact = voices.filter((v) => normalize(v.lang) === tag);
  // Cantonese voices are sometimes tagged yue-* instead of zh-HK.
  const extra = voices.filter(
    (v) => normalize(v.lang) !== tag && (langCode === 'yue' ? normalize(v.lang).startsWith('yue') : normalize(v.lang).startsWith(primary + '-')),
  );
  return [...exact, ...extra];
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  synth()?.cancel();
  currentAudio?.pause();
  currentAudio = null;
}

export function speak(text: string, langCode: string, voiceURI = '') {
  const s = synth();
  if (!s || !text) return;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language(langCode).speech;
  const voices = s.getVoices();
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voicesFor(voices, langCode)[0];
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  s.speak(utterance);
}

/** Plays the recorded audio when there is one, otherwise the synthetic voice. */
export function playWord(text: string, langCode: string, voiceURI: string, audio: Blob | null) {
  if (audio) {
    stopSpeaking();
    const url = URL.createObjectURL(audio);
    currentAudio = new Audio(url);
    currentAudio.onended = () => URL.revokeObjectURL(url);
    void currentAudio.play();
    return;
  }
  speak(text, langCode, voiceURI);
}

export function speechSupported(): boolean {
  return synth() !== null;
}
