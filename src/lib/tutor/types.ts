export type Language = "English" | "Hindi" | "Hinglish";
export type Level = "Beginner" | "Intermediate" | "Advanced";
export type Mode = "story" | "teach";
export type TeachStyle =
  | "Friendly and conversational, with analogies"
  | "Structured and rigorous, exam-focused"
  | "Quick revision, crisp and high-yield";

export const EXAMS = ["DSSSB TGT Social Science"] as const;
export type Exam = (typeof EXAMS)[number];

export type StorySection = {
  title: string;
  time_span?: string;
  beats?: string[];
  key_facts?: string[];
  handoff?: string;
};

export type TeachSection = {
  title: string;
  goal?: string;
};

export type LessonPlan = {
  title: string;
  frame?: string;
  sections: (StorySection | TeachSection)[];
};

export type LessonRequest = {
  topic: string;
  exam: string;
  level: Level;
  minutes: number;
  focus: string;
  mode: Mode;
  style: TeachStyle;
  language: Language;
};
