export type ProviderId = "perplexity";

export type ScanMode = "demo" | "live";

export type Tier = "free" | "report" | "monitor";

export type Plan = "report" | "monitor";

export type Source = {
  url: string;
  title?: string;
};

export type Question = {
  id: string;
  text: string;
  index: number;
};

export type ParsedCompetitor = {
  name: string;
  rank: number | null;
};

export type ParsedAnswer = {
  mentioned: boolean;
  rank: number | null;
  competitors: ParsedCompetitor[];
  sources: Source[];
};

export type AnswerRecord = {
  questionId: string;
  question: string;
  providerId: ProviderId;
  providerName: string;
  demo: boolean;
  text: string;
  mentioned: boolean;
  rank: number | null;
  competitors: ParsedCompetitor[];
  sources: Source[];
  error?: string;
  points: number;
};

export type CompetitorStat = {
  name: string;
  mentions: number;
  bestRank: number | null;
};

export type FindingArea =
  | "google"
  | "reviews"
  | "website"
  | "schema"
  | "nap"
  | "faq"
  | "content";

export type Finding = {
  id: string;
  priority: number;
  area: FindingArea;
  title: string;
  why: string;
  fix: string;
};

export type SiteCheck = {
  url: string;
  ok: boolean;
  error?: string;
  finalUrl?: string;
  title: string | null;
  metaDescription: string | null;
  hasViewport: boolean;
  hasLocalBusinessSchema: boolean;
  schemaTypes: string[];
  hasBusinessName: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  hasFaq: boolean;
};

export type ProviderStat = {
  id: ProviderId;
  name: string;
  demo: boolean;
  mentions: number;
  answers: number;
  errors: number;
  error?: string;
};

export type ScanPayload = {
  questions: Question[];
  answers: AnswerRecord[];
  competitors: CompetitorStat[];
  findings: Finding[];
  siteCheck: SiteCheck | null;
  score: number;
  mentionCount: number;
  answerCount: number;
  complete: boolean;
  providers: ProviderStat[];
};

export type ScanInput = {
  businessName: string;
  category: string;
  city: string;
  state: string;
  websiteUrl: string | null;
};

export type ScanRecord = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
  ipHash: string;
  mode: ScanMode;
  cacheKey: string;
  score: number;
  tier: Tier;
  email: string | null;
  stripeSessionId: string | null;
  stripeSubscriptionId: string | null;
  nextRunAt: string | null;
  previousScore: number | null;
  payload: ScanPayload;
};

export type LeadInput = {
  scanId: string | null;
  name: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  message: string;
};
