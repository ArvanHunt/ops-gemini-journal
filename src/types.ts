export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface JournalSummary {
  title?: string;
  summary?: string;
  keyInsights?: string[];
  actionableSteps?: string[];
  sentiment?: string;
  suggestedPrompts?: string[];
  generatedAt?: number;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  initialContent: string;
  mode:
    | 'reflection'
    | 'brainstorm'
    | 'clarity'
    | 'gratitude'
    | 'future_self'
    | 'incident_retro'
    | 'oncall_handover'
    | 'cve_triage';
  messages: ChatMessage[];
  summary?: JournalSummary;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  isPinned?: boolean;
}

export type ReflectionMode =
  | 'reflection'
  | 'brainstorm'
  | 'clarity'
  | 'gratitude'
  | 'future_self'
  | 'incident_retro'
  | 'oncall_handover'
  | 'cve_triage';

export interface PatternTheme {
  theme: string;
  occurrenceCount?: number;
  description: string;
  exampleEvidence?: string;
}

export interface PatternAnalysisResult {
  summary: string;
  headline: string;
  entryCountAnalyzed: number;
  recurringThemes: PatternTheme[];
  dominantEmotionalTones: string[];
  growthHighlights: string[];
  suggestedReflectionPrompts: string[];
  analyzedAt: number;
  modelUsed?: string;
}

export interface UserProfile {

  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

