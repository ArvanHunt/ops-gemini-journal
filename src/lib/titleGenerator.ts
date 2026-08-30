import type { ChatMessage, JournalEntry, ReflectionMode } from '../types';

/**
 * Checks if a given title is empty, whitespace, or a placeholder like "Untitled" / "Untitled Reflection"
 */
export function isPlaceholderTitle(title?: string | null): boolean {
  if (!title) return true;
  const trimmed = title.trim();
  if (!trimmed) return true;
  return /^untitled(\s+reflection|\s+entry|\s+session)?$/i.test(trimmed);
}

/**
 * Clean and truncate a string cleanly at word boundary
 */
function cleanAndTruncate(text: string, maxLen = 42): string {
  // Strip markdown, bullet points, asterisks, hash headers
  let cleaned = text
    .replace(/^[#*•\->\s:]+/, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLen) return cleaned;

  const truncated = cleaned.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 18) {
    return truncated.slice(0, lastSpace).trim() + '...';
  }
  return truncated.trim() + '...';
}

/**
 * Automatically derive a short, descriptive title from entry content, mode, and messages
 */
export function deriveEntryTitle(
  currentTitle?: string,
  content?: string,
  messages: ChatMessage[] = [],
  mode?: ReflectionMode
): string {
  const trimmedCurrent = currentTitle?.trim();
  // If user provided an explicit custom title that isn't a placeholder, preserve it
  if (trimmedCurrent && !isPlaceholderTitle(trimmedCurrent)) {
    return trimmedCurrent;
  }

  const cleanContent = (content || '').trim();

  // 1. Contextual title extraction based on mode and content
  if (cleanContent) {
    // CVE Triage: Match CVE ID if present
    if (mode === 'cve_triage') {
      const cveMatch = cleanContent.match(/CVE-\d{4}-\d{4,7}/i);
      if (cveMatch) {
        return `${cveMatch[0].toUpperCase()} Triage`;
      }
    }

    // Incident Retro: match incident title or first timeline event
    if (mode === 'incident_retro') {
      const incidentMatch = cleanContent.match(/(?:incident(?:\s+summary)?|outage|issue|timeline)[:\s-]+([^\n.]+)/i);
      if (incidentMatch && incidentMatch[1]?.trim()) {
        const candidate = cleanAndTruncate(incidentMatch[1].trim(), 40);
        if (candidate.length >= 4) return candidate;
      }
    }

    // On-Call Handover: match shift summary
    if (mode === 'oncall_handover') {
      const shiftMatch = cleanContent.match(/(?:shift(?:\s+summary)?|handover(?:\s+notes)?)[:\s-]+([^\n.]+)/i);
      if (shiftMatch && shiftMatch[1]?.trim()) {
        const candidate = cleanAndTruncate(shiftMatch[1].trim(), 40);
        if (candidate.length >= 4) return candidate;
      }
    }

    // General first meaningful line
    const lines = cleanContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^(timeline|notes|summary|details):?$/i.test(l));

    if (lines.length > 0) {
      const firstLineCandidate = cleanAndTruncate(lines[0], 42);
      if (firstLineCandidate.length >= 3) {
        return firstLineCandidate;
      }
    }
  }

  // 2. Extract from first user message if raw content was blank
  const firstUserMessage = messages.find((m) => m.role === 'user')?.text?.trim();
  if (firstUserMessage) {
    const candidate = cleanAndTruncate(firstUserMessage, 42);
    if (candidate.length >= 3) {
      return candidate;
    }
  }

  // 3. Extract from first model message if available
  const firstModelMessage = messages.find((m) => m.role === 'model')?.text?.trim();
  if (firstModelMessage) {
    const candidate = cleanAndTruncate(firstModelMessage, 42);
    if (candidate.length >= 3) {
      return candidate;
    }
  }

  // 4. Mode-based fallback
  const modeDefaults: Record<ReflectionMode, string> = {
    reflection: 'Daily Reflection',
    brainstorm: 'Brainstorm Session',
    clarity: 'Mental Clarity',
    gratitude: 'Gratitude Reflection',
    future_self: 'Future Self Dialogue',
    incident_retro: 'Incident Retrospective',
    oncall_handover: 'On-Call Handover',
    cve_triage: 'CVE Triage Assessment',
  };

  return (mode && modeDefaults[mode]) || 'Reflection';
}

/**
 * Derive the preview text snippet to display in the history list
 */
export function deriveContentSnippet(entry: JournalEntry): string {
  // 1. Structured summary if available
  if (entry.summary?.summary && entry.summary.summary.trim().length > 0) {
    return entry.summary.summary.trim();
  }

  // 2. User's raw initialContent
  if (entry.initialContent && entry.initialContent.trim().length > 0) {
    return entry.initialContent.trim();
  }

  // 3. Conversation snippet (prefer model response, then user message)
  if (entry.messages && entry.messages.length > 0) {
    const latestModelMsg = [...entry.messages].reverse().find((m) => m.role === 'model')?.text?.trim();
    if (latestModelMsg) return latestModelMsg;

    const firstUserMsg = entry.messages.find((m) => m.role === 'user')?.text?.trim();
    if (firstUserMsg) return firstUserMsg;
  }

  return '(Empty reflection)';
}
