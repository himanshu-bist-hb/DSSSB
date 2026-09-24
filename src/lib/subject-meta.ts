export const SUBJECT_META: Record<string, { icon: string; color: string; soft: string }> = {
  geography: { icon: "🌍", color: "#2f6f76", soft: "#e5f0ef" },
  history: { icon: "🏛️", color: "#8a5a2b", soft: "#f3ebe0" },
  economics: { icon: "📈", color: "#3f7a53", soft: "#e7f2ea" },
  "political-science": { icon: "⚖️", color: "#5b4b8a", soft: "#ece8f5" },
  mathematics: { icon: "📐", color: "#2f5f8a", soft: "#e6eef5" },
  reasoning: { icon: "🧩", color: "#a3672b", soft: "#f8ecdd" },
  hindi: { icon: "अ", color: "#a13a3a", soft: "#f8e6e6" },
  english: { icon: "Aa", color: "#7a1f2b", soft: "#f6e9ea" },
  "teaching-methodology": { icon: "🎓", color: "#2f6b5e", soft: "#e4f0ec" },
  "current-affairs": { icon: "📰", color: "#3a6b8a", soft: "#e6eff5" },
};

export function subjectMeta(slug: string) {
  return SUBJECT_META[slug] ?? { icon: "📘", color: "#7a1f2b", soft: "#f6e9ea" };
}
