import { createSignal } from "solid-js";
import { TypingDialogue } from "./TypingDialogue";
import "./App.css";

const dialogues = [
  { name: "しずえ", text: "あら、村長さん！おはようございます！\n今日もいいお天気ですね。" },
  { name: "たぬきち", text: "おや、いらっしゃい だなも！\nなにか お手伝いできることは あるだなも？" },
  { name: "イカ", text: "ヌリヌリ〜！今日もナワバリバトル、\nイカすプレイでいくぜ！" },
  { name: "フータ", text: "おお！これは すばらしい 化石ですね！\nさっそく 鑑定させてください！" },
  { name: "Tom Nook", text: "Welcome to our island, yes yes!\nLet me know if you need anything." },
  { name: "Isabelle", text: "Good morning, Mayor!\nIt's a beautiful day today, isn't it?" },
];

export default function App() {
  const [dialogueIndex, setDialogueIndex] = createSignal(0);

  const currentDialogue = () => dialogues[dialogueIndex()];

  const handleNext = () => {
    setDialogueIndex((i) => (i + 1) % dialogues.length);
  };

  return (
    <div class="app">
      <div class="scene">
        <TypingDialogue
          name={currentDialogue().name}
          text={currentDialogue().text}
          speed={50}
          onComplete={() => {}}
          onNext={handleNext}
        />
      </div>
    </div>
  );
}
