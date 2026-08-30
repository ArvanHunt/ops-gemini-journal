import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Save,
  Check,
  Tag,
  Pin,
  Trash2,
  Download,
  FileText,
  FileDown,
  Flame,
  Brain,
  Smile,
  Compass,
  RefreshCw,
  Clock,
  ChevronRight,
  Hourglass,
  AlertTriangle,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import type { JournalEntry, ChatMessage, ReflectionMode, JournalSummary } from '../types';
import { SummaryCard } from './SummaryCard';
import { ErrorBanner } from './ErrorBanner';
import { exportSingleEntryToPdf } from '../lib/pdfExport';
import { fetchRecentUserEntries } from '../lib/firebase';
import { deriveEntryTitle, isPlaceholderTitle } from '../lib/titleGenerator';

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<void>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  onRetrySave: () => void;
}

const MODE_OPTIONS: Array<{
  id: ReflectionMode;
  label: string;
  desc: string;
  icon: any;
}> = [
  {
    id: 'reflection',
    label: 'Deep Reflection',
    desc: 'Explore emotional clarity, subconscious patterns, and meaning.',
    icon: Compass,
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm & Ideas',
    desc: 'Generate creative solutions, alternative paths, and next actions.',
    icon: Brain,
  },
  {
    id: 'clarity',
    label: 'Mental Clarity',
    desc: 'Untangle friction, prioritize essentials, and resolve indecision.',
    icon: Flame,
  },
  {
    id: 'gratitude',
    label: 'Gratitude & Joy',
    desc: 'Anchor positive experiences, growth moments, and appreciation.',
    icon: Smile,
  },
  {
    id: 'future_self',
    label: 'Future Self',
    desc: 'Converse with your future self, drawing wisdom from your past journey.',
    icon: Hourglass,
  },
  {
    id: 'incident_retro',
    label: 'Incident Retro',
    desc: 'Structured blameless postmortem: timeline, root cause, contributing factors, and action items.',
    icon: AlertTriangle,
  },
  {
    id: 'oncall_handover',
    label: 'On-Call Handover',
    desc: 'Shift handover report: what happened, what is still open, and what the next engineer should watch.',
    icon: Radio,
  },
  {
    id: 'cve_triage',
    label: 'CVE Triage',
    desc: 'Contextual vulnerability assessment: stack applicability, environmental severity, and remediation.',
    icon: ShieldAlert,
  },
];

const WRITING_STARTERS: Record<ReflectionMode, string[]> = {
  reflection: [
    'What has been occupying my mind lately is...',
    'Today I felt a sudden wave of emotion when...',
    'A pattern I am starting to notice about how I respond to pressure is...',
  ],
  brainstorm: [
    'I want to build a creative solution for...',
    'If I had zero constraints, the ideal outcome for this challenge would look like...',
    'What are 3 completely different ways I could approach...',
  ],
  clarity: [
    'I feel stuck between two decisions right now: ',
    'The core source of friction in my day today was...',
    'What truly matters in this situation is...',
  ],
  gratitude: [
    'Three small, quiet moments that brought me peace today were...',
    'A person I am deeply grateful for right now is...',
    'A recent challenge that taught me something valuable was...',
  ],
  future_self: [
    'If you could see me right now, what perspective would you give me on...',
    'I am worried about where this path is leading. What do you remember about this time?',
    'What is something I am overthinking right now that won’t matter in the long run?',
    'How did we navigate through this feeling of uncertainty?',
  ],
  incident_retro: [
    'Timeline: 14:00 Alert fired for 500 error spike on API Gateway -> 14:12 On-call engaged -> 14:35 Scaled pod replicas -> 14:50 Traffic stabilized.',
    'Incident Summary: Customer-facing latency spike in Checkout Service during peak flash sale. Root cause appears to be database connection pool exhaustion...',
    'Production Outage: Kubernetes worker node kernel panic caused cascading restarts on stateful redis nodes. Mitigation was draining tainted nodes...',
  ],
  oncall_handover: [
    'Shift summary: Paged 3 times for queue worker latency. Applied hotfix PR #412. DB replica lag is elevated—watch dashboard X closely.',
    'Handover notes: Cloud provider reported degraded networking in us-central1. Ticket #9201 is open. Scheduled database maintenance at 02:00 UTC.',
    'Ongoing shift items: 1 flaky alert silenced until 20:00 UTC. Review pending deploy for payment-gateway before tomorrow morning.',
  ],
  cve_triage: [
    'CVE ID: CVE-2024-3094\nStack: Debian Linux containers on Cloud Run, Node.js 20 microservices, public HTTP endpoints.\nContext: Evaluated liblzma dependency...',
    'CVE ID: CVE-2023-4863\nStack: Go 1.22 backend, libwebp C-bindings for avatar processing, worker nodes isolated in private VPC.',
    'CVE ID: CVE-2024-21626\nStack: GKE Kubernetes 1.28 cluster with containerd runtime, multi-tenant pods, no root privileges.',
  ],
};

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onUpdateEntry,
  onDeleteEntry,
  saveStatus,
  saveError,
  onRetrySave,
}) => {
  const [title, setTitle] = useState(entry.title);
  const [initialContent, setInitialContent] = useState(entry.initialContent);
  const [mode, setMode] = useState<ReflectionMode>(entry.mode || 'reflection');
  const [messages, setMessages] = useState<ChatMessage[]>(entry.messages || []);
  const [summary, setSummary] = useState<JournalSummary | undefined>(entry.summary);
  const [isPinned, setIsPinned] = useState(!!entry.isPinned);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(entry.tags || []);

  const [inputMessage, setInputMessage] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastModelUsed, setLastModelUsed] = useState<string>('');

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if entry prop changes (e.g. user selected different entry from history)
  useEffect(() => {
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }
    setTitle(entry.title);
    setInitialContent(entry.initialContent);
    setMode(entry.mode || 'reflection');
    setMessages(entry.messages || []);
    setSummary(entry.summary);
    setIsPinned(!!entry.isPinned);
    setTags(entry.tags || []);
    setAiError(null);
  }, [entry.id]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, []);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiResponding]);

  // Push local changes to parent (with automatic title derivation for untitled entries)
  const syncChanges = async (partial: Partial<JournalEntry>) => {
    const nextContent = partial.initialContent !== undefined ? partial.initialContent : initialContent;
    const nextMessages = partial.messages !== undefined ? partial.messages : messages;
    const nextMode = partial.mode !== undefined ? partial.mode : mode;
    let nextTitle = partial.title !== undefined ? partial.title : title;

    // If title is untitled / placeholder, auto-derive short title from content or messages
    if (isPlaceholderTitle(nextTitle)) {
      const autoTitle = deriveEntryTitle(nextTitle, nextContent, nextMessages, nextMode);
      if (autoTitle) {
        nextTitle = autoTitle;
        setTitle(autoTitle);
      }
    }

    const updated: JournalEntry = {
      ...entry,
      title: nextTitle,
      initialContent: nextContent,
      mode: nextMode,
      messages: nextMessages,
      summary: partial.summary !== undefined ? partial.summary : summary,
      tags: partial.tags !== undefined ? partial.tags : tags,
      isPinned: partial.isPinned !== undefined ? partial.isPinned : isPinned,
      updatedAt: Date.now(),
      ...partial,
    };
    await onUpdateEntry(updated);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = setTimeout(() => {
      syncChanges({ title: val });
    }, 600);
  };

  const handleTitleBlur = () => {
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    const trimmed = title.trim();
    const effectiveTitle = trimmed.length > 0
      ? trimmed
      : deriveEntryTitle('', initialContent, messages, mode);
    setTitle(effectiveTitle);
    syncChanges({ title: effectiveTitle });
  };

  const handleContentChange = (newContent: string) => {
    setInitialContent(newContent);

    // Auto-generate title if currently empty or placeholder
    let nextTitle = title;
    if (isPlaceholderTitle(title)) {
      const derived = deriveEntryTitle(title, newContent, messages, mode);
      if (derived && derived !== title) {
        nextTitle = derived;
        setTitle(derived);
      }
    }

    // Debounce syncing raw content to Firestore so changes persist continuously
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }
    autoSyncTimerRef.current = setTimeout(() => {
      syncChanges({ initialContent: newContent, title: nextTitle });
    }, 600);
  };

  const handleContentBlur = () => {
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }
    const nextTitle = isPlaceholderTitle(title)
      ? deriveEntryTitle(title, initialContent, messages, mode)
      : title;
    if (nextTitle !== title) {
      setTitle(nextTitle);
    }
    syncChanges({ initialContent, title: nextTitle });
  };

  const handleModeChange = (newMode: ReflectionMode) => {
    console.log('[JournalEditor] Mode changed to:', newMode);
    setMode(newMode);
    let nextTitle = title;
    if (isPlaceholderTitle(title)) {
      nextTitle = deriveEntryTitle('', initialContent, messages, newMode);
      setTitle(nextTitle);
    }
    syncChanges({ mode: newMode, title: nextTitle });
  };

  const handleTogglePin = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    syncChanges({ isPinned: newPinned });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().toLowerCase().replace(/^#/, '');
      if (!tags.includes(clean)) {
        const newTags = [...tags, clean];
        setTags(newTags);
        syncChanges({ tags: newTags });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    syncChanges({ tags: newTags });
  };

  // Send message to Gemini Reflection Backend
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage.trim();
    if (!textToSend && !initialContent) return;

    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    setAiError(null);
    setIsAiResponding(true);

    const defaultPromptByMode: Record<ReflectionMode, string> = {
      incident_retro: 'Please generate a structured blameless retrospective analysis with Timeline, Root Cause, Contributing Factors, and Prioritized Action Items.',
      oncall_handover: 'Please compile these shift notes into a factual On-Call Handover report with "What happened", "Still open", and "Watch for" sections.',
      cve_triage: 'Please perform a contextual CVE security triage (applicability to stack, contextual severity, affected components, and remediation steps).',
      future_self: 'What perspective or wisdom can you share with me looking back from where you are now?',
      reflection: 'Please reflect on my journal entry above.',
      brainstorm: 'Please help me brainstorm creative ideas and next steps based on this entry.',
      clarity: 'Please help me break down these thoughts into core priorities and clear next steps.',
      gratitude: 'Please help me explore and anchor these reflections of gratitude.',
    };

    const resolvedText = textToSend || defaultPromptByMode[mode] || 'Please reflect on my journal entry above.';

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      role: 'user',
      text: resolvedText,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customText) setInputMessage('');

    let effectiveTitle = title;
    if (isPlaceholderTitle(title)) {
      effectiveTitle = deriveEntryTitle(title, initialContent, newMessages, mode);
      setTitle(effectiveTitle);
    }

    // Persist immediately to Firestore before waiting on Gemini
    await syncChanges({
      initialContent,
      title: effectiveTitle,
      messages: newMessages,
    });

    try {
      let userPastEntries: any[] = [];
      if (mode === 'future_self' && entry.userId) {
        try {
          const recent = await fetchRecentUserEntries(entry.userId, 15);
          userPastEntries = recent
            .filter((e) => e.id !== entry.id)
            .map((e) => ({
              title: e.title,
              createdAt: e.createdAt,
              initialContent: e.initialContent,
              summary: e.summary,
              mode: e.mode,
            }));
        } catch (fetchErr) {
          console.warn('Could not fetch past entries for Future Self context:', fetchErr);
        }
      }

      console.log('[JournalEditor] Sending /api/gemini/reflect with mode:', mode, 'userPastEntries count:', userPastEntries.length);
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: resolvedText,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          entryTitle: effectiveTitle,
          initialEntry: initialContent,
          mode,
          userPastEntries,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      setLastModelUsed(data.modelUsed || 'Gemini 3.6 Flash');

      const modelMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        role: 'model',
        text: data.reply || 'Reflected on your thought.',
        timestamp: Date.now(),
      };

      const finalMessages = [...newMessages, modelMsg];
      setMessages(finalMessages);

      // Persist complete conversation immediately to Firestore
      await syncChanges({
        initialContent,
        title: effectiveTitle,
        messages: finalMessages,
      });
    } catch (err: any) {
      console.error('Failed to get reflection from Gemini:', err);
      setAiError(err.message || 'Failed to connect to Gemini reflection engine. Please retry.');
    } finally {
      setIsAiResponding(false);
    }
  };

  // Synthesize Summary and Key Takeaways
  const handleSummarize = async () => {
    if (!initialContent && messages.length === 0) {
      setAiError('Please write some journal content or have a dialogue before summarizing.');
      return;
    }

    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    setIsSummarizing(true);
    setAiError(null);

    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: initialContent,
          messages: messages.map((m) => ({ role: m.role, text: m.text })),
          mode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate summary.');
      }

      const data = await response.json();
      const generatedSummary: JournalSummary = {
        title: data.title,
        summary: data.summary,
        keyInsights: data.keyInsights || [],
        actionableSteps: data.actionableSteps || [],
        sentiment: data.sentiment,
        suggestedPrompts: data.suggestedPrompts || [],
        generatedAt: Date.now(),
      };

      setSummary(generatedSummary);
      const finalTitle =
        (data.title && data.title.trim()) ||
        (isPlaceholderTitle(title) ? deriveEntryTitle(title, initialContent, messages, mode) : title);
      setTitle(finalTitle);

      await syncChanges({
        summary: generatedSummary,
        title: finalTitle,
        initialContent,
      });
    } catch (err: any) {
      console.error('Failed to summarize:', err);
      setAiError(err.message || 'Failed to synthesize summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExportMarkdown = () => {
    const text = `# ${title || 'Reflection Journal'}
Date: ${new Date(entry.createdAt).toLocaleString()}
Mode: ${mode.toUpperCase()}
Tags: ${tags.join(', ') || 'None'}

## Initial Reflection
${initialContent || '(None)'}

## Dialogue with Gemini
${messages.map((m) => `### ${m.role === 'user' ? 'You' : 'Gemini'}:\n${m.text}`).join('\n\n')}

${
  summary
    ? `## Gemini Synthesis & Takeaways
**Summary:** ${summary.summary || ''}
**Key Insights:**
${(summary.keyInsights || []).map((i) => `- ${i}`).join('\n')}
**Actionable Steps:**
${(summary.actionableSteps || []).map((s) => `- ${s}`).join('\n')}
`
    : ''
}
`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'reflection').toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    exportSingleEntryToPdf({
      ...entry,
      title,
      mode,
      initialContent,
      messages,
      summary,
      tags,
      isPinned,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800/80 mb-6">
        <div className="flex items-center space-x-2 text-xs text-stone-400">
          <Clock className="w-3.5 h-3.5 text-stone-500" />
          <span>Created {new Date(entry.createdAt).toLocaleDateString()}</span>
          <span>&bull;</span>
          <span className="flex items-center space-x-1">
            {saveStatus === 'saving' && (
              <span className="text-amber-400 flex items-center space-x-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Saving to Firestore...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-emerald-400 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Saved to Firestore</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400 flex items-center space-x-1">
                <span>Save failed</span>
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={handleTogglePin}
            className={`p-2 rounded-lg border transition-colors ${
              isPinned
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-stone-800/60 border-stone-700/60 text-stone-400 hover:text-stone-200'
            }`}
            title={isPinned ? 'Unpin entry' : 'Pin entry'}
          >
            <Pin className="w-4 h-4" />
          </button>

          <button
            id="export-pdf-btn"
            onClick={handleExportPdf}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 text-xs font-semibold transition-colors shadow-sm"
            title="Export this reflection as a formatted PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

          <button
            id="export-markdown-btn"
            onClick={handleExportMarkdown}
            className="p-2 rounded-lg bg-stone-800/60 border border-stone-700/60 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            title="Export as Markdown"
          >
            <Download className="w-4 h-4" />
          </button>

          {onDeleteEntry && (
            <button
              onClick={() => onDeleteEntry(entry.id)}
              className="p-2 rounded-lg bg-stone-800/60 border border-stone-700/60 text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              title="Delete entry"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <ErrorBanner
          message={`Firestore Save Error: ${saveError}`}
          onRetry={onRetrySave}
        />
      )}

      {aiError && (
        <ErrorBanner
          message={`Gemini AI Error: ${aiError}`}
          onRetry={() => handleSendMessage()}
          onDismiss={() => setAiError(null)}
        />
      )}

      {/* Entry Title */}
      <input
        id="entry-title-input"
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder={deriveEntryTitle('', initialContent, messages, mode) || 'Name your reflection...'}
        className="w-full text-2xl sm:text-3xl font-serif font-bold text-stone-100 bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-stone-600 mb-4"
      />

      {/* Reflection Mode Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = mode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleModeChange(opt.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Journal Reflection Content Box */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 mb-6 focus-within:border-stone-700 transition-colors">
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
          {mode === 'incident_retro'
            ? 'Production Incident Notes & Timeline'
            : mode === 'oncall_handover'
            ? 'On-Call Shift Notes & Open Items'
            : mode === 'cve_triage'
            ? 'CVE Advisory & Tech Stack Description'
            : 'Your Journal Thoughts & Raw Entry'}
        </label>
        <textarea
          id="journal-initial-content"
          value={initialContent}
          onChange={(e) => handleContentChange(e.target.value)}
          onBlur={handleContentBlur}
          rows={5}
          placeholder={
            mode === 'incident_retro'
              ? 'Describe what broke, timeline of events, alerts that triggered, mitigation steps, and impacted services...'
              : mode === 'oncall_handover'
              ? 'Paste rough shift notes, alerts paged, deployments made, ongoing investigations, and maintenance schedules...'
              : mode === 'cve_triage'
              ? 'Paste CVE ID (e.g. CVE-2024-XXXX), advisory details, and your tech stack / deployment environment...'
              : mode === 'future_self'
              ? 'What is unfolding in your life today? Share your thoughts, uncertainties, or questions for your future self...'
              : "What's unfolding in your mind today? Write freely without judgment..."
          }
          className="w-full bg-transparent text-stone-200 text-sm sm:text-base leading-relaxed resize-y focus:outline-none placeholder:text-stone-600 font-mono text-[13px] sm:text-sm"
        />

        {/* Prompt Starters */}
        {!initialContent && (
          <div className="mt-3 pt-3 border-t border-stone-800/60">
            <span className="text-xs text-stone-500 block mb-2 font-medium">
              Need a starter? Click any prompt to begin:
            </span>
            <div className="flex flex-wrap gap-2">
              {WRITING_STARTERS[mode].map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleContentChange(starter);
                  }}
                  className="text-xs bg-stone-800/80 hover:bg-stone-700 text-stone-300 px-2.5 py-1.5 rounded-lg border border-stone-700/50 text-left transition-colors font-mono"
                >
                  {starter.length > 90 ? `${starter.slice(0, 90)}...` : starter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Synthesis Summary Card if already generated */}
      {summary && (
        <SummaryCard
          summary={summary}
          onApplyPrompt={(p) => handleSendMessage(p)}
        />
      )}

      {/* Action to Synthesize & Converse */}
      <div className="flex items-center justify-between my-2">
        <div className="flex items-center space-x-2">
          <h3 className="font-serif font-semibold text-stone-200 text-base flex items-center space-x-2">
            <span>
              {mode === 'incident_retro'
                ? 'Blameless Postmortem Analysis'
                : mode === 'oncall_handover'
                ? 'Handover Summary & Review'
                : mode === 'cve_triage'
                ? 'Vulnerability Triage Dialogue'
                : 'Reflective Conversation'}
            </span>
            {lastModelUsed && (
              <span className="text-[10px] text-stone-400 bg-stone-800 px-2 py-0.5 rounded-full border border-stone-700">
                via {lastModelUsed}
              </span>
            )}
          </h3>
        </div>

        <button
          id="summarize-btn"
          onClick={handleSummarize}
          disabled={isSummarizing || (!initialContent && messages.length === 0)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 border border-stone-700 font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSummarizing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>
            {summary
              ? 'Regenerate Insights'
              : mode === 'incident_retro'
              ? 'Synthesize Postmortem'
              : mode === 'oncall_handover'
              ? 'Synthesize Handover'
              : mode === 'cve_triage'
              ? 'Synthesize CVE Triage'
              : 'Synthesize Key Insights'}
          </span>
        </button>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-4 my-4 flex-1">
        {messages.length === 0 && (
          <div className="p-6 rounded-xl border border-dashed border-stone-800 text-center text-stone-500 text-sm">
            {mode === 'future_self' ? (
              <>
                <Hourglass className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-stone-300 font-medium">Receive wisdom from your Future Self.</p>
                <p className="text-xs text-stone-500 mt-1">
                  Your future self writes back to you, drawing on your past reflection history with warm, grounding reassurance.
                </p>
                {initialContent && (
                  <button
                    onClick={() => handleSendMessage('What perspective can you give me from where you are right now?')}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Hourglass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ask your Future Self to write back</span>
                  </button>
                )}
              </>
            ) : mode === 'incident_retro' ? (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-stone-300 font-medium">Generate SRE Incident Retrospective Analysis</p>
                <p className="text-xs text-stone-500 mt-1">
                  Gemini analyzes your incident notes to build a timeline, root cause analysis, contributing factors, and prioritized action items.
                </p>
                {initialContent && (
                  <button
                    onClick={() => handleSendMessage('Please generate a structured blameless retrospective analysis based on these incident notes.')}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Generate Structured Retrospective</span>
                  </button>
                )}
              </>
            ) : mode === 'oncall_handover' ? (
              <>
                <Radio className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-stone-300 font-medium">Generate Clean On-Call Shift Handover</p>
                <p className="text-xs text-stone-500 mt-1">
                  Gemini structures your shift notes into what happened, what is still open, and key watchpoints for the next engineer.
                </p>
                {initialContent && (
                  <button
                    onClick={() => handleSendMessage('Please generate a clean shift handover report from these notes.')}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span>Generate Handover Report</span>
                  </button>
                )}
              </>
            ) : mode === 'cve_triage' ? (
              <>
                <ShieldAlert className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-stone-300 font-medium">Contextual CVE Vulnerability Triage</p>
                <p className="text-xs text-stone-500 mt-1">
                  Gemini assesses whether the CVE applies to your stack, determines environmental severity, and details remediation steps.
                </p>
                {initialContent && (
                  <button
                    onClick={() => handleSendMessage('Please triage this CVE in the context of my tech stack and environment.')}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Run Contextual CVE Triage</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6 text-stone-600 mx-auto mb-2" />
                <p>Start a conversation with Gemini about this reflection.</p>
                <p className="text-xs text-stone-600 mt-1">
                  Ask for alternative perspectives, emotional unpacks, or creative brainstorms.
                </p>
                {initialContent && (
                  <button
                    onClick={() => handleSendMessage()}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask Gemini to reflect on what you wrote</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 shrink-0 mt-0.5 shadow-sm">
                {mode === 'future_self' ? (
                  <Hourglass className="w-4 h-4" />
                ) : mode === 'incident_retro' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : mode === 'oncall_handover' ? (
                  <Radio className="w-4 h-4" />
                ) : mode === 'cve_triage' ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-600/90 text-stone-950 font-medium rounded-tr-none shadow-md'
                  : 'bg-stone-900/90 border border-stone-800 text-stone-200 rounded-tl-none shadow-md whitespace-pre-line'
              }`}
            >
              {msg.text}
              <div
                className={`text-[10px] mt-1.5 ${
                  msg.role === 'user' ? 'text-stone-800 text-right' : 'text-stone-500 text-left'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isAiResponding && (
          <div className="flex items-start space-x-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 shrink-0 animate-pulse">
              {mode === 'future_self' ? (
                <Hourglass className="w-4 h-4" />
              ) : mode === 'incident_retro' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : mode === 'oncall_handover' ? (
                <Radio className="w-4 h-4" />
              ) : mode === 'cve_triage' ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div className="bg-stone-900 border border-stone-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-stone-400 flex items-center space-x-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="text-xs text-stone-400 ml-1">
                {mode === 'future_self'
                  ? 'Your Future Self is writing back...'
                  : mode === 'incident_retro'
                  ? 'Gemini is structuring incident retrospective...'
                  : mode === 'oncall_handover'
                  ? 'Gemini is drafting handover report...'
                  : mode === 'cve_triage'
                  ? 'Gemini is triaging CVE vulnerability...'
                  : 'Gemini is reflecting...'}
              </span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input Box for Conversation */}
      <div className="sticky bottom-0 bg-stone-950/95 pt-2 pb-1 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-2 focus-within:border-amber-500/50 shadow-xl"
        >
          <input
            id="chat-message-input"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              mode === 'future_self'
                ? 'Ask your future self for wisdom, reassurance, or perspective...'
                : mode === 'incident_retro'
                ? 'Ask to refine timeline, dive deeper into root cause, or prioritize action items...'
                : mode === 'oncall_handover'
                ? 'Ask for shift risk summary, checklist items, or watchpoints for next engineer...'
                : mode === 'cve_triage'
                ? 'Ask about patch compatibility, compensating controls, or verification tests...'
                : 'Share a follow-up, ask for clarity, or explore an idea...'
            }
            disabled={isAiResponding}
            className="flex-1 bg-transparent text-stone-100 text-sm px-3 focus:outline-none placeholder:text-stone-500 disabled:opacity-50"
          />

          <button
            id="send-message-btn"
            type="submit"
            disabled={(!inputMessage.trim() && !initialContent) || isAiResponding}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Tags management */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 px-1">
          <Tag className="w-3 h-3 text-stone-500" />
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center space-x-1 text-[11px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded-md border border-stone-700/60"
            >
              <span>#{t}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="hover:text-red-400 ml-1 text-stone-400"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="+ tag (press Enter)"
            className="text-[11px] bg-transparent text-stone-300 placeholder:text-stone-600 focus:outline-none w-28"
          />
        </div>
      </div>
    </div>
  );
};
