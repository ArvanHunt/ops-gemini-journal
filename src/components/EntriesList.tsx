import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Pin,
  Calendar,
  Sparkles,
  ChevronRight,
  BookOpen,
  Filter,
  Trash2,
  Smile,
  Compass,
  Brain,
  Flame,
  Activity,
  X,
  Check,
  FileDown,
  Hourglass,
  AlertTriangle,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import type { JournalEntry, ReflectionMode } from '../types';
import { exportMultipleEntriesToPdf } from '../lib/pdfExport';
import { deriveEntryTitle, deriveContentSnippet } from '../lib/titleGenerator';

interface EntriesListProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onOpenPatternDetector?: () => void;
}

const MOOD_TAGS: Array<{
  id: ReflectionMode;
  label: string;
  shortLabel: string;
  icon: any;
}> = [
  { id: 'reflection', label: 'Deep Reflection', shortLabel: 'Reflection', icon: Compass },
  { id: 'brainstorm', label: 'Brainstorm & Ideas', shortLabel: 'Brainstorm', icon: Brain },
  { id: 'clarity', label: 'Mental Clarity', shortLabel: 'Clarity', icon: Flame },
  { id: 'gratitude', label: 'Gratitude & Joy', shortLabel: 'Gratitude', icon: Smile },
  { id: 'future_self', label: 'Future Self', shortLabel: 'Future Self', icon: Hourglass },
  { id: 'incident_retro', label: 'Incident Retro', shortLabel: 'Incident Retro', icon: AlertTriangle },
  { id: 'oncall_handover', label: 'On-Call Handover', shortLabel: 'On-Call', icon: Radio },
  { id: 'cve_triage', label: 'CVE Triage', shortLabel: 'CVE Triage', icon: ShieldAlert },
];

const MODE_ICONS: Record<ReflectionMode, any> = {
  reflection: Compass,
  brainstorm: Brain,
  clarity: Flame,
  gratitude: Smile,
  future_self: Hourglass,
  incident_retro: AlertTriangle,
  oncall_handover: Radio,
  cve_triage: ShieldAlert,
};

export const EntriesList: React.FC<EntriesListProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onOpenPatternDetector,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilters, setSelectedMoodFilters] = useState<ReflectionMode[]>([]);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  // Calculate entry count per mood tag across authenticated user's entries
  const moodCounts = useMemo(() => {
    const counts: Record<ReflectionMode, number> = {
      reflection: 0,
      brainstorm: 0,
      clarity: 0,
      gratitude: 0,
      future_self: 0,
      incident_retro: 0,
      oncall_handover: 0,
      cve_triage: 0,
    };
    entries.forEach((entry) => {
      const mode = (entry.mode || 'reflection') as ReflectionMode;
      if (counts[mode] !== undefined) {
        counts[mode]++;
      }
    });
    return counts;
  }, [entries]);

  // Toggle mood tag in multi-select filter
  const toggleMoodFilter = (mode: ReflectionMode) => {
    setSelectedMoodFilters((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const clearAllFilters = () => {
    setSelectedMoodFilters([]);
    setSearchQuery('');
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Filter by selected mood tags (multi-select: must match at least one selected tag if any selected)
      const entryMode = (entry.mode || 'reflection') as ReflectionMode;
      if (selectedMoodFilters.length > 0 && !selectedMoodFilters.includes(entryMode)) {
        return false;
      }

      // Filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const derivedTitle = deriveEntryTitle(entry.title, entry.initialContent, entry.messages, entry.mode).toLowerCase();
      const matchTitle = (entry.title || '').toLowerCase().includes(q) || derivedTitle.includes(q);
      const matchContent = (entry.initialContent || '').toLowerCase().includes(q);
      const matchSummary = (entry.summary?.summary || '').toLowerCase().includes(q);
      const matchMessages = (entry.messages || []).some((m) => (m.text || '').toLowerCase().includes(q));
      const matchTags = (entry.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchSentiment = (entry.summary?.sentiment || '').toLowerCase().includes(q);

      return matchTitle || matchContent || matchSummary || matchMessages || matchTags || matchSentiment;
    });
  }, [entries, searchQuery, selectedMoodFilters]);

  const pinnedEntries = useMemo(() => {
    return filteredEntries.filter((e) => e.isPinned);
  }, [filteredEntries]);

  const unpinnedEntries = useMemo(() => {
    return filteredEntries.filter((e) => !e.isPinned);
  }, [filteredEntries]);

  return (
    <aside
      id="entries-sidebar"
      className="w-full md:w-80 lg:w-96 border-r border-stone-800 bg-stone-900/50 flex flex-col h-full shrink-0"
    >
      {/* Header & Search */}
      <div className="p-4 border-b border-stone-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h2 className="font-serif font-semibold text-stone-200 text-base">
              Reflection History
            </h2>
          </div>
          <div className="flex items-center space-x-1.5">
            {selectedMoodFilters.length > 0 && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                {filteredEntries.length} of {entries.length}
              </span>
            )}
            <span className="text-xs text-stone-400 bg-stone-800 px-2 py-0.5 rounded-full border border-stone-700">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>

        {/* Pattern Detector Trigger Button */}
        {onOpenPatternDetector && (
          <button
            id="open-pattern-detector-btn"
            onClick={onOpenPatternDetector}
            className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-amber-300 text-xs font-semibold flex items-center justify-between transition-all group shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Detect Cross-Entry Patterns</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              Gemini AI
            </span>
          </button>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            id="search-entries-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflections, tags, insights..."
            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Mood Tag Multi-Select Filter Controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400 px-0.5">
            <span className="flex items-center space-x-1 font-medium">
              <Filter className="w-3 h-3 text-amber-400" />
              <span>Filter by Mood</span>
            </span>
            {(selectedMoodFilters.length > 0 || searchQuery.trim().length > 0) && (
              <button
                id="clear-filters-btn"
                onClick={clearAllFilters}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors flex items-center space-x-0.5 font-medium underline underline-offset-2"
              >
                <span>Clear filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {MOOD_TAGS.map((tag) => {
              const Icon = tag.icon;
              const isSelected = selectedMoodFilters.includes(tag.id);
              const count = moodCounts[tag.id] || 0;

              return (
                <button
                  key={tag.id}
                  id={`filter-mood-${tag.id}`}
                  onClick={() => toggleMoodFilter(tag.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-left transition-all text-xs flex items-center justify-between border ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-semibold shadow-sm'
                      : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                  }`}
                  title={`Filter by ${tag.label} (${count} entries)`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-stone-500'}`} />
                    <span className="truncate text-[11px]">{tag.shortLabel}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0 ml-1 ${
                      isSelected
                        ? 'bg-amber-500/30 text-amber-200 font-bold'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Entries Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {entries.length === 0 ? (
          <div className="text-center py-12 px-4 text-stone-500 text-xs">
            <Sparkles className="w-6 h-6 text-stone-600 mx-auto mb-2" />
            <p className="font-medium text-stone-400">No reflections yet.</p>
            <p className="mt-1 text-stone-600">
              Click &quot;New Reflection&quot; to begin your first dialogue with Gemini.
            </p>
            <button
              onClick={onNewEntry}
              className="mt-4 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg font-semibold inline-flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Entry</span>
            </button>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-10 px-4 text-stone-500 text-xs bg-stone-950/30 rounded-xl border border-stone-800/60">
            <Filter className="w-5 h-5 text-stone-600 mx-auto mb-2" />
            <p className="font-medium text-stone-400">No reflections found</p>
            <p className="mt-1 text-stone-500">
              No entries match the selected mood filters or search query.
            </p>
            <button
              onClick={clearAllFilters}
              className="mt-3 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-lg text-xs font-medium transition-colors inline-flex items-center space-x-1"
            >
              <X className="w-3 h-3" />
              <span>Reset all filters</span>
            </button>
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedEntries.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 px-2 mb-1.5 flex items-center space-x-1">
                  <Pin className="w-3 h-3" />
                  <span>Pinned Reflections</span>
                </div>
                <div className="space-y-1.5">
                  {pinnedEntries.map((entry) => renderEntryCard(entry))}
                </div>
              </div>
            )}

            {/* Unpinned Section */}
            {unpinnedEntries.length > 0 && (
              <div>
                {pinnedEntries.length > 0 && (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 px-2 mb-1.5">
                    Recent Reflections
                  </div>
                )}
                <div className="space-y-1.5">
                  {unpinnedEntries.map((entry) => renderEntryCard(entry))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Actions Footer: Export PDF Digest */}
      {entries.length > 0 && (
        <div className="p-3 border-t border-stone-800/80 bg-stone-900/80 shrink-0">
          <button
            id="export-digest-pdf-btn"
            onClick={() => {
              const collectionTitle = selectedMoodFilters.length > 0
                ? `Filtered Reflections (${filteredEntries.length})`
                : 'Complete Reflection Journal Digest';
              exportMultipleEntriesToPdf(filteredEntries, collectionTitle);
            }}
            disabled={filteredEntries.length === 0}
            className="w-full py-2 px-2.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed border border-stone-700/60 text-stone-300 hover:text-amber-300 text-xs font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm"
            title={`Export ${filteredEntries.length} reflections as formatted PDF digest`}
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {selectedMoodFilters.length > 0
                ? `Export Filtered PDF (${filteredEntries.length})`
                : `Export All to PDF (${entries.length})`}
            </span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-serif font-bold text-stone-100">
              Delete Reflection?
            </h3>
            <p className="text-xs text-stone-400 mt-2">
              This will permanently delete this reflection and all associated Gemini conversations from your isolated Firestore.
            </p>
            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                onClick={() => setEntryToDelete(null)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteEntry(entryToDelete);
                  setEntryToDelete(null);
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  function renderEntryCard(entry: JournalEntry) {
    const isSelected = selectedEntryId === entry.id;
    const Icon = MODE_ICONS[entry.mode || 'reflection'] || Compass;
    const messageCount = entry.messages?.length || 0;
    const displayTitle = deriveEntryTitle(entry.title, entry.initialContent, entry.messages, entry.mode);
    const displaySnippet = deriveContentSnippet(entry);

    return (
      <div
        key={entry.id}
        onClick={() => onSelectEntry(entry)}
        className={`group relative p-3 rounded-xl border transition-all cursor-pointer text-left ${
          isSelected
            ? 'bg-amber-500/10 border-amber-500/40 text-stone-100 shadow-sm'
            : 'bg-stone-950/40 border-stone-800/80 hover:bg-stone-800/40 hover:border-stone-700/80 text-stone-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-1.5 min-w-0">
            <Icon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <h4 className="font-medium text-xs truncate max-w-[170px] text-stone-100" title={displayTitle}>
              {displayTitle}
            </h4>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {entry.isPinned && <Pin className="w-3 h-3 text-amber-400" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEntryToDelete(entry.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity rounded text-stone-500"
              title="Delete reflection"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Content Snippet */}
        <p className="text-[11px] text-stone-400 line-clamp-2 mt-1.5 leading-relaxed">
          {displaySnippet}
        </p>

        {/* Meta badges & tags */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-stone-500 pt-2 border-t border-stone-800/50">
          <div className="flex items-center space-x-1.5">
            <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
            {messageCount > 0 && (
              <>
                <span>&bull;</span>
                <span className="text-amber-400/90 flex items-center space-x-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{messageCount}</span>
                </span>
              </>
            )}
          </div>

          {entry.summary?.sentiment && (
            <span className="bg-stone-800/80 text-stone-300 px-1.5 py-0.5 rounded text-[9px] border border-stone-700/50">
              {entry.summary.sentiment}
            </span>
          )}
        </div>
      </div>
    );
  }
};
