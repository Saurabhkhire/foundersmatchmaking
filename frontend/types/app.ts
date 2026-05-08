export type PublicUser = {
  id: string;
  companyName: string;
  username: string;
  role: "founder" | "investor" | "admin";
};

export type MatchView = {
  id: string;
  score: number;
  matchType: "founder_founder" | "founder_investor" | "investor_investor";
  aiReason: string;
  aiQuestions: string[];
  counterpart: PublicUser;
};
