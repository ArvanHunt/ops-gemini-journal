/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  subscribeToAuth,
  subscribeToUserEntries,
  fetchRecentUserEntries,
  saveJournalEntry,
  deleteJournalEntry,
  logOut,
} from './lib/firebase';
import type { JournalEntry, UserProfile, PatternAnalysisResult } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { EntriesList } from './components/EntriesList';
import { JournalEditor } from './components/JournalEditor';
import { PatternDetectorModal } from './components/PatternDetectorModal';
import { Menu, X, Sparkles, BookOpen } from 'lucide-react';
import { deriveEntryTitle } from './lib/titleGenerator';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Pattern Detector State
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [patternAnalysis, setPatternAnalysis] = useState<PatternAnalysisResult | null>(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((fbUser: User | null) => {
      if (fbUser) {
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
        });
      } else {
        setUser(null);
        setEntries([]);
        setActiveEntry(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore entries subscription for active user
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        // If no active entry selected, pick the first one or create new
        if (fetchedEntries.length > 0) {
          setActiveEntry((curr) => {
            if (!curr) return fetchedEntries[0];
            const found = fetchedEntries.find((e) => e.id === curr.id);
            return found || fetchedEntries[0];
          });
        }
      },
      (err) => {
        setSaveError(`Failed to load entries from Firestore: ${err.message}`);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Create a brand new reflection entry
  const handleCreateNewEntry = () => {
    if (!user) return;
    const newEntry: JournalEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: user.uid,
      title: 'Untitled Reflection',
      initialContent: '',
      mode: 'reflection',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      isPinned: false,
    };

    setActiveEntry(newEntry);
    setMobileSidebarOpen(false);
    // Persist skeleton immediately
    handleSaveEntry(newEntry);
  };

  // Save entry to Firestore with error resilience
  const handleSaveEntry = async (entryToSave: JournalEntry) => {
    if (!user) return;
    setSaveStatus('saving');
    setSaveError(null);

    const effectiveTitle = deriveEntryTitle(
      entryToSave.title,
      entryToSave.initialContent,
      entryToSave.messages,
      entryToSave.mode
    );

    const sanitizedEntry: JournalEntry = {
      ...entryToSave,
      title: effectiveTitle || entryToSave.title || 'Reflection',
    };

    try {
      await saveJournalEntry(sanitizedEntry);
      setSaveStatus('saved');
      setActiveEntry(sanitizedEntry);
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 3000);
    } catch (err: any) {
      console.error('Error saving to Firestore:', err);
      setSaveStatus('error');
      setSaveError(err?.message || 'Failed to save entry to Cloud Firestore.');
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (activeEntry?.id === entryId) {
        const remaining = entries.filter((e) => e.id !== entryId);
        setActiveEntry(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      console.error('Error deleting entry:', err);
      setSaveError(`Failed to delete: ${err?.message || err}`);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Cross-Entry Pattern Analysis Handler (Directive 8: Cross-Entry Pattern Analysis)
  const handleAnalyzePatterns = async () => {
    if (!user) return;
    setPatternModalOpen(true);
    setPatternError(null);

    // If user has fewer than 3 entries, modal will gracefully show friendly unlock notice
    if (entries.length < 3) {
      return;
    }

    setPatternLoading(true);
    try {
      // 1. Query current user's last 10-20 entries directly from isolated Firestore
      const recentEntries = await fetchRecentUserEntries(user.uid, 20);

      if (recentEntries.length < 3) {
        setPatternLoading(false);
        return;
      }

      // 2. Call server-side pattern analysis endpoint
      const response = await fetch('/api/gemini/analyze-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: recentEntries.map((e) => ({
            id: e.id,
            title: e.title,
            mode: e.mode,
            createdAt: e.createdAt,
            initialContent: e.initialContent,
            summary: e.summary,
          })),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${response.status}) while analyzing patterns.`);
      }

      const analysisData: PatternAnalysisResult = await response.json();
      setPatternAnalysis(analysisData);
    } catch (err: any) {
      console.error('Pattern detection error:', err);
      setPatternError(err?.message || 'Failed to analyze cross-entry patterns. Please try again.');
    } finally {
      setPatternLoading(false);
    }
  };

  // When user selects a suggested reflection prompt from pattern analysis
  const handleApplyPatternPrompt = (promptText: string) => {
    if (!user) return;
    const newEntry: JournalEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: user.uid,
      title: `Reflection on Patterns`,
      initialContent: `Exploring pattern insight: "${promptText}"\n\n`,
      mode: 'reflection',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['pattern-insight'],
      isPinned: false,
    };
    setActiveEntry(newEntry);
    setMobileSidebarOpen(false);
    handleSaveEntry(newEntry);
  };

  // Loading state during auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-200">
        <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-sans text-stone-400">Loading your private reflection journal...</p>
      </div>
    );
  }

  // Unauthenticated: Show Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col">
        <Navbar
          user={null}
          onNewEntry={() => {}}
          onSignOut={() => {}}
          entryCount={0}
        />
        <LandingPage />
      </div>
    );
  }

  // Authenticated Dashboard
  return (
    <div className="min-h-screen bg-stone-950 flex flex-col text-stone-100 font-sans">
      <Navbar
        user={user}
        onNewEntry={handleCreateNewEntry}
        onSignOut={handleSignOut}
        onOpenPatternDetector={handleAnalyzePatterns}
        entryCount={entries.length}
      />

      {/* Mobile Toggle Bar */}
      <div className="md:hidden bg-stone-900 border-b border-stone-800 px-4 py-2.5 flex items-center justify-between">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex items-center space-x-2 text-xs font-medium text-stone-300 hover:text-stone-100 bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-700"
        >
          {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>{mobileSidebarOpen ? 'Close History' : 'Reflection History'}</span>
        </button>

        <span className="text-xs text-stone-400 font-serif">
          {activeEntry?.title || 'No active reflection'}
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for Desktop */}
        <div className="hidden md:flex h-full">
          <EntriesList
            entries={entries}
            selectedEntryId={activeEntry?.id || null}
            onSelectEntry={(entry) => setActiveEntry(entry)}
            onNewEntry={handleCreateNewEntry}
            onDeleteEntry={handleDeleteEntry}
            onOpenPatternDetector={handleAnalyzePatterns}
          />
        </div>

        {/* Sidebar Drawer for Mobile */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-stone-950/90 backdrop-blur-sm flex">
            <div className="w-4/5 max-w-sm bg-stone-900 h-full shadow-2xl border-r border-stone-800 flex flex-col">
              <div className="p-3 border-b border-stone-800 flex items-center justify-between">
                <span className="font-serif font-semibold text-sm text-stone-200">Past Reflections</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded text-stone-400 hover:text-stone-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <EntriesList
                  entries={entries}
                  selectedEntryId={activeEntry?.id || null}
                  onSelectEntry={(entry) => {
                    setActiveEntry(entry);
                    setMobileSidebarOpen(false);
                  }}
                  onNewEntry={() => {
                    handleCreateNewEntry();
                    setMobileSidebarOpen(false);
                  }}
                  onDeleteEntry={handleDeleteEntry}
                  onOpenPatternDetector={() => {
                    setMobileSidebarOpen(false);
                    handleAnalyzePatterns();
                  }}
                />
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 flex flex-col h-full bg-stone-950 overflow-hidden">
          {activeEntry ? (
            <JournalEditor
              key={activeEntry.id}
              entry={activeEntry}
              onUpdateEntry={handleSaveEntry}
              onDeleteEntry={handleDeleteEntry}
              saveStatus={saveStatus}
              saveError={saveError}
              onRetrySave={() => activeEntry && handleSaveEntry(activeEntry)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
              <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
                <BookOpen className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-serif font-bold text-stone-200">
                Welcome to your Reflection Journal
              </h2>
              <p className="text-sm text-stone-400 max-w-md mt-2 leading-relaxed">
                Your entries are saved in private Firestore storage. Select a past reflection from history or create a new entry to converse with Gemini.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  id="empty-state-new-entry-btn"
                  onClick={handleCreateNewEntry}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-sm transition-colors shadow-md flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start New Reflection</span>
                </button>
                {entries.length >= 3 && (
                  <button
                    id="empty-state-pattern-btn"
                    onClick={handleAnalyzePatterns}
                    className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 rounded-xl text-sm font-medium transition-colors shadow-md flex items-center space-x-2"
                  >
                    <span>Detect Patterns</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Pattern Detector Modal Dialog */}
      <PatternDetectorModal
        isOpen={patternModalOpen}
        onClose={() => setPatternModalOpen(false)}
        analysis={patternAnalysis}
        isLoading={patternLoading}
        error={patternError}
        entryCount={entries.length}
        onAnalyze={handleAnalyzePatterns}
        onSelectPrompt={handleApplyPatternPrompt}
      />
    </div>
  );
}

