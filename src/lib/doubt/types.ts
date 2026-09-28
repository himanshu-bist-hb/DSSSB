export type Confidence = "high" | "medium" | "low";

export type DoubtSolution = {
  subject: string;
  topic: string;
  question: string;
  answer: string;
  explanation: string;
  shortTricks: string[];
  confidence: Confidence;
  notes?: string;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type DoubtHistoryEntry = {
  id: string;
  createdAt: string;
  thumbnail: string;
  solution: DoubtSolution;
};
