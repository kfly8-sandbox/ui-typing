import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import "./TypingDialogue.css";

interface Props {
  name: string;
  text: string;
  speed?: number;
  onComplete?: () => void;
  onNext?: () => void;
}

// Shared AudioContext (created lazily on first user interaction)
let audioCtx: AudioContext | undefined;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Map a character to its vowel (a=0, i=1, u=2, e=3, o=4)
// Supports hiragana, katakana, and latin alphabet
// Returns -1 for punctuation, whitespace, etc.
function getVowelIndex(ch: string): number {
  // --- Japanese kana ---
  const kanaVowelMap: Record<string, number> = {
    "あ":0,"か":0,"さ":0,"た":0,"な":0,"は":0,"ま":0,"や":0,"ら":0,"わ":0,
    "が":0,"ざ":0,"だ":0,"ば":0,"ぱ":0,
    "い":1,"き":1,"し":1,"ち":1,"に":1,"ひ":1,"み":1,"り":1,
    "ぎ":1,"じ":1,"ぢ":1,"び":1,"ぴ":1,
    "う":2,"く":2,"す":2,"つ":2,"ぬ":2,"ふ":2,"む":2,"ゆ":2,"る":2,
    "ぐ":2,"ず":2,"づ":2,"ぶ":2,"ぷ":2,
    "え":3,"け":3,"せ":3,"て":3,"ね":3,"へ":3,"め":3,"れ":3,
    "げ":3,"ぜ":3,"で":3,"べ":3,"ぺ":3,
    "お":4,"こ":4,"そ":4,"と":4,"の":4,"ほ":4,"も":4,"よ":4,"ろ":4,"を":4,
    "ご":4,"ぞ":4,"ど":4,"ぼ":4,"ぽ":4,
    "ん":2,
    "ア":0,"カ":0,"サ":0,"タ":0,"ナ":0,"ハ":0,"マ":0,"ヤ":0,"ラ":0,"ワ":0,
    "ガ":0,"ザ":0,"ダ":0,"バ":0,"パ":0,
    "イ":1,"キ":1,"シ":1,"チ":1,"ニ":1,"ヒ":1,"ミ":1,"リ":1,
    "ギ":1,"ジ":1,"ヂ":1,"ビ":1,"ピ":1,
    "ウ":2,"ク":2,"ス":2,"ツ":2,"ヌ":2,"フ":2,"ム":2,"ユ":2,"ル":2,
    "グ":2,"ズ":2,"ヅ":2,"ブ":2,"プ":2,
    "エ":3,"ケ":3,"セ":3,"テ":3,"ネ":3,"ヘ":3,"メ":3,"レ":3,
    "ゲ":3,"ゼ":3,"デ":3,"ベ":3,"ペ":3,
    "オ":4,"コ":4,"ソ":4,"ト":4,"ノ":4,"ホ":4,"モ":4,"ヨ":4,"ロ":4,"ヲ":4,
    "ゴ":4,"ゾ":4,"ド":4,"ボ":4,"ポ":4,
    "ン":2,
  };
  if (kanaVowelMap[ch] !== undefined) return kanaVowelMap[ch];

  // --- Latin alphabet ---
  // Map each letter to the vowel it most commonly represents or
  // the vowel in its typical pronunciation context
  const lower = ch.toLowerCase();
  const latinVowelMap: Record<string, number> = {
    // Direct vowels
    "a": 0, "i": 1, "u": 2, "e": 3, "o": 4,
    // Consonants mapped to the vowel they typically pair with
    "b": 1, "c": 1, "d": 1,       // bee, cee, dee
    "f": 3, "g": 1, "h": 0,       // ef, gee, aitch
    "j": 0, "k": 0, "l": 3,       // jay, kay, el
    "m": 3, "n": 3, "p": 1,       // em, en, pee
    "q": 2, "r": 0, "s": 3,       // cue, ar, es
    "t": 1, "v": 1, "w": 2,       // tee, vee, double-u
    "x": 3, "y": 0, "z": 1,       // ex, way, zee
  };
  if (latinVowelMap[lower] !== undefined) return latinVowelMap[lower];

  return -1;
}

// Frequency offsets per vowel, modelling natural Japanese formant tendencies
// a: open vowel (mid), i: high, u: low, e: mid-high, o: mid-low
const VOWEL_FREQ: Record<number, number> = {
  0: 0,    // a - base
  1: 25,   // i - slightly higher
  2: -15,  // u - slightly lower
  3: 15,   // e - between a and i
  4: -8,   // o - between a and u
};

// Track pitch contour state across a single dialogue
let pitchCursor = 0;
let pitchTotal = 1;

function initPitchContour(totalChars: number) {
  pitchCursor = 0;
  pitchTotal = Math.max(totalChars, 1);
}

// Play a vowel-aware blip with natural pitch contour
function playBlip(ch: string) {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();

  // Skip sound for whitespace and punctuation
  if (" 　\n。、！？…，〜".includes(ch)) {
    pitchCursor++;
    return;
  }

  const now = ctx.currentTime;

  // Gradual pitch descent over the sentence (natural Japanese intonation)
  // Starts slightly above base, ends slightly below
  const progress = pitchCursor / pitchTotal;
  const contour = 20 - progress * 40; // +20Hz -> -20Hz over the sentence

  // Vowel-based frequency offset
  const vowelIdx = getVowelIndex(ch);
  const vowelOffset = vowelIdx >= 0 ? VOWEL_FREQ[vowelIdx] : 0;

  // For kanji/unknown chars, use a neutral mid-range with tiny variation
  const baseFreq = 340;
  const freq = baseFreq + contour + vowelOffset + (Math.random() - 0.5) * 6;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);

  // Soft, short envelope
  const duration = 0.07;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);

  pitchCursor++;
}

export function TypingDialogue(props: Props) {
  const [displayedCount, setDisplayedCount] = createSignal(0);
  const [isComplete, setIsComplete] = createSignal(false);

  const baseSpeed = () => props.speed ?? 50;
  const chars = () => [...props.text];
  const displayedText = () => chars().slice(0, displayedCount()).join("");

  // Compute delay after displaying the given character
  function delayFor(ch: string): number {
    const base = baseSpeed();
    // Sentence-ending punctuation: long pause
    if ("。！？…\n".includes(ch)) return base * 8;
    // Clause-level punctuation: medium pause
    if ("、，〜ー".includes(ch)) return base * 4;
    // Space / half-width punctuation: word boundary pause
    if (" 　".includes(ch)) return base * 2;
    if ("!?,.".includes(ch)) return base * 3;
    // Latin characters: faster typing (lower info density per char)
    if (/[a-zA-Z]/.test(ch)) return base * 0.4;
    return base;
  }

  createEffect(() => {
    // Reset when text changes
    const textChars = [...props.text];
    setDisplayedCount(0);
    setIsComplete(false);
    initPitchContour(textChars.length);

    let timerId: number | undefined;

    function tick(index: number) {
      if (index >= textChars.length) {
        setIsComplete(true);
        props.onComplete?.();
        return;
      }
      setDisplayedCount(index + 1);
      playBlip(textChars[index]);
      const delay = delayFor(textChars[index]);
      timerId = window.setTimeout(() => tick(index + 1), delay);
    }

    timerId = window.setTimeout(() => tick(0), baseSpeed());

    onCleanup(() => {
      if (timerId !== undefined) clearTimeout(timerId);
    });
  });

  const handleClick = () => {
    if (isComplete()) {
      props.onNext?.();
    } else {
      // Skip to end on click
      setDisplayedCount(chars().length);
      setIsComplete(true);
      props.onComplete?.();
    }
  };

  return (
    <div class="dialogue-box" onClick={handleClick}>
      <div class="dialogue-name">{props.name}</div>
      <div class="dialogue-text">
        {displayedText()}
        <Show when={!isComplete()}>
          <span class="cursor" />
        </Show>
      </div>
      <Show when={isComplete()}>
        <div class="dialogue-next">&#x25BC;</div>
      </Show>
    </div>
  );
}
