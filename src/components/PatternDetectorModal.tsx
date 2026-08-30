import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Heart,
  Compass,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import type { PatternAnalysisResult } from '../types';

interface PatternDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: PatternAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  entryCount: number;
  onAnalyze: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

export const PatternDetectorModal: React.FC<PatternDetectorModalProps> = ({
  isOpen,
  onClose,
  analysis,
  isLoading,
  error,
  entryCount,
  onAnalyze,
  onSelectPrompt,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedThemeIndex, setExpandedThemeIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!analysis) return;
    const themesText = (analysis.recurringThemes || [])
      .map((t) => `- ${t.theme} (${t.occurrenceCount || 'Multiple'} entries): ${t.description}`)
      .join('\n');
    const tonesText = (analysis.dominantEmotionalTones || []).join(', ');
    const growthText = (analysis.growthHighlights || []).map((g) => `- ${g}`).join('\n');

    const text = `Pattern Analysis: ${analysis.headline || 'Cross-Entry Insights'}\n\nSummary:\n${analysis.summary}\n\nRecurring Themes:\n${themesText}\n\nDominant Emotional Tones:\n${tonesText}\n\nGrowth Highlights:\n${growthText}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="pattern-detector-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="pattern-detector-modal"
        className="bg-stone-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col relative"
      >
        {/* Decorative ambient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-800 flex items-center justify-between shrink-0 bg-stone-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif font-bold text-stone-100 text-lg sm:text-xl">
                  Cross-Entry Pattern Detector
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  AI Trend Synthesis
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Analyzes recurring themes, emotional shifts, and growth across your recent reflections.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {analysis && (
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors text-xs flex items-center space-x-1"
                title="Copy pattern report"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-stone-200">
          {/* Insufficient entries state */}
          {entryCount < 3 ? (
            <div id="insufficient-entries-notice" className="text-center py-10 px-4 bg-stone-950/40 border border-stone-800 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="font-serif font-semibold text-stone-200 text-base">
                Write a few more reflections to unlock pattern detection
              </h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto mt-2 leading-relaxed">
                Pattern detection works best with at least 3 historical journal reflections. You currently have{' '}
                <strong className="text-amber-400">{entryCount}</strong> {entryCount === 1 ? 'reflection' : 'reflections'}.
              </p>
              <div className="mt-5">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  Return to Journal
                </button>
              </div>
            </div>
          ) : isLoading ? (
            /* Loading State */
            <div id="pattern-detector-loading" className="text-center py-12 space-y-4">
              <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <p className="text-sm font-serif font-semibold text-stone-200">
                  Synthesizing themes across your last {Math.min(entryCount, 20)} reflections...
                </p>
                <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                  Gemini is evaluating recurring emotional tones, perspectives, and mindset patterns.
                </p>
              </div>
            </div>
          ) : error ? (
            /* Error State */
            <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-xl text-red-200 text-xs space-y-3">
              <p className="font-semibold text-red-300">Analysis Error</p>
              <p>{error}</p>
              <button
                onClick={onAnalyze}
                className="px-3.5 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Retry Analysis
              </button>
            </div>
          ) : !analysis ? (
            /* Initial State Before Analysis */
            <div className="text-center py-10 px-4 bg-stone-950/40 border border-stone-800 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h4 className="font-serif font-semibold text-stone-200 text-base">
                Ready to Analyze {Math.min(entryCount, 20)} Reflections
              </h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto mt-2 leading-relaxed">
                Gemini will scan across your journal entries to uncover hidden threads, recurring emotional states, and insights into your evolution over time.
              </p>
              <button
                id="start-pattern-detection-btn"
                onClick={onAnalyze}
                className="mt-5 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg inline-flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Detect Cross-Entry Patterns</span>
              </button>
            </div>
          ) : (
            /* Analysis Results View */
            <div id="pattern-detector-results" className="space-y-5">
              {/* Headline & Summary Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 sm:p-5 rounded-xl space-y-2 relative">
                <div className="flex items-center justify-between text-xs text-amber-400 font-semibold uppercase tracking-wider">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cross-Entry Pattern Synthesis</span>
                  </span>
                  <span className="text-[11px] text-stone-400 font-normal">
                    Based on {analysis.entryCountAnalyzed} reflections
                  </span>
                </div>
                <h4 className="font-serif font-bold text-stone-100 text-base sm:text-lg">
                  &ldquo;{analysis.headline}&rdquo;
                </h4>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed italic">
                  {analysis.summary}
                </p>
              </div>

              {/* Dominant Emotional Tones */}
              {analysis.dominantEmotionalTones && analysis.dominantEmotionalTones.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5 mb-2">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>Dominant Emotional Tones</span>
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.dominantEmotionalTones.map((tone, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-amber-300 font-medium"
                      >
                        {tone}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recurring Themes */}
              {analysis.recurringThemes && analysis.recurringThemes.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Recurring Themes & Frequency</span>
                  </h5>
                  <div className="space-y-2">
                    {analysis.recurringThemes.map((item, idx) => {
                      const isExpanded = expandedThemeIndex === idx;
                      return (
                        <div
                          key={idx}
                          className="bg-stone-950/60 border border-stone-800 rounded-xl p-3.5 hover:border-stone-700 transition-colors"
                        >
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedThemeIndex(isExpanded ? null : idx)}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span className="font-semibold text-xs sm:text-sm text-stone-100">
                                {item.theme}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {item.occurrenceCount && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold border border-amber-500/30">
                                  {item.occurrenceCount} {item.occurrenceCount === 1 ? 'entry' : 'entries'}
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-stone-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-stone-400" />
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                            {item.description}
                          </p>

                          {isExpanded && item.exampleEvidence && (
                            <div className="mt-2.5 pt-2 border-t border-stone-800 text-[11px] text-stone-400 italic">
                              <strong className="not-italic text-stone-300">Context:</strong> {item.exampleEvidence}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Growth Highlights */}
              {analysis.growthHighlights && analysis.growthHighlights.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Growth Highlights & Resilience</span>
                  </h5>
                  <div className="space-y-1.5">
                    {analysis.growthHighlights.map((gh, idx) => (
                      <div
                        key={idx}
                        className="bg-stone-950/40 border border-emerald-950/40 p-2.5 rounded-lg flex items-start space-x-2 text-xs text-stone-300"
                      >
                        <span className="text-emerald-400 mt-0.5">&bull;</span>
                        <span>{gh}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Follow-up Prompts */}
              {analysis.suggestedReflectionPrompts && analysis.suggestedReflectionPrompts.length > 0 && (
                <div className="pt-2 border-t border-stone-800">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5 mb-2">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Prompts to Explore These Patterns</span>
                  </h5>
                  <div className="space-y-1.5">
                    {analysis.suggestedReflectionPrompts.map((promptText, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onSelectPrompt?.(promptText);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 bg-stone-800/80 hover:bg-amber-500/20 hover:border-amber-500/40 border border-stone-700/60 rounded-xl text-xs text-stone-200 transition-all flex items-center justify-between group"
                      >
                        <span>&ldquo;{promptText}&rdquo;</span>
                        <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-300 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-run button */}
              <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  Analyzed at {new Date(analysis.analyzedAt).toLocaleTimeString()}
                </span>
                <button
                  onClick={onAnalyze}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Re-analyze Trends</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
