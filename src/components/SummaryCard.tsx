import React, { useState } from 'react';
import { Sparkles, Check, Copy, ChevronDown, ChevronUp, Lightbulb, ListChecks, Heart, Compass } from 'lucide-react';
import type { JournalSummary } from '../types';

interface SummaryCardProps {
  summary: JournalSummary;
  onApplyPrompt?: (prompt: string) => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary, onApplyPrompt }) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = () => {
    const text = `Title: ${summary.title || 'Reflection'}\n\nSummary:\n${summary.summary || ''}\n\nKey Insights:\n${(summary.keyInsights || []).map((i) => `- ${i}`).join('\n')}\n\nActionable Steps:\n${(summary.actionableSteps || []).map((s) => `- ${s}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-stone-900/90 border border-amber-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden my-4">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-stone-100 text-base">
              {summary.title || 'Gemini Synthesis'}
            </h3>
            {summary.sentiment && (
              <span className="inline-block mt-0.5 text-[11px] font-medium text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Tone: {summary.sentiment}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors text-xs flex items-center space-x-1"
            title="Copy summary"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px] hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-4 text-sm">
          {summary.summary && (
            <p className="text-stone-300 leading-relaxed italic bg-stone-950/40 p-3 rounded-lg border border-stone-800/60">
              "{summary.summary}"
            </p>
          )}

          {summary.keyInsights && summary.keyInsights.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5 mb-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Key Insights</span>
              </h4>
              <ul className="space-y-1 pl-1">
                {summary.keyInsights.map((insight, idx) => (
                  <li key={idx} className="text-stone-300 flex items-start space-x-2 text-xs sm:text-sm">
                    <span className="text-amber-500 mt-1">&bull;</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.actionableSteps && summary.actionableSteps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5 mb-1.5">
                <ListChecks className="w-3.5 h-3.5" />
                <span>Actionable Steps</span>
              </h4>
              <ul className="space-y-1 pl-1">
                {summary.actionableSteps.map((step, idx) => (
                  <li key={idx} className="text-stone-300 flex items-start space-x-2 text-xs sm:text-sm">
                    <span className="text-emerald-500 mt-1">&bull;</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.suggestedPrompts && summary.suggestedPrompts.length > 0 && (
            <div className="pt-1 border-t border-stone-800/60">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5 mb-2">
                <Compass className="w-3.5 h-3.5" />
                <span>Suggested Follow-ups</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {summary.suggestedPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => onApplyPrompt?.(p)}
                    className="text-left text-xs bg-stone-800/90 hover:bg-amber-500/20 hover:border-amber-500/40 text-stone-300 hover:text-amber-200 border border-stone-700/60 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    &ldquo;{p}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
