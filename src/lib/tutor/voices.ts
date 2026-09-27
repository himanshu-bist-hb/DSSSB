// Pure data, no server-only imports — safe to use from client components too.
import type { Language } from "./types";

export const VOICES_BY_LANGUAGE: Record<Language, Record<string, string>> = {
  English: {
    "Aria - US, female, expressive": "en-US-AriaNeural",
    "Andrew - US, male, warm": "en-US-AndrewNeural",
    "Ava - US, female, natural": "en-US-AvaNeural",
    "Brian - US, male, clear": "en-US-BrianNeural",
    "Neerja - Indian English, female": "en-IN-NeerjaNeural",
    "Prabhat - Indian English, male": "en-IN-PrabhatNeural",
    "Sonia - UK, female": "en-GB-SoniaNeural",
    "Ryan - UK, male": "en-GB-RyanNeural",
  },
  Hindi: {
    "Swara - Hindi, female": "hi-IN-SwaraNeural",
    "Madhur - Hindi, male": "hi-IN-MadhurNeural",
  },
  // Hindi voices read the Latin-script English words in the mixed script naturally.
  Hinglish: {
    "Swara - Hindi, female": "hi-IN-SwaraNeural",
    "Madhur - Hindi, male": "hi-IN-MadhurNeural",
  },
};
