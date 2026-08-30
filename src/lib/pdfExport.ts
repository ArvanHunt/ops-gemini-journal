import { jsPDF } from 'jspdf';
import type { JournalEntry, ReflectionMode } from '../types';

const MODE_LABELS: Record<ReflectionMode, string> = {
  reflection: 'Deep Reflection',
  brainstorm: 'Brainstorm & Ideas',
  clarity: 'Mental Clarity',
  gratitude: 'Gratitude & Joy',
  future_self: 'Future Self',
  incident_retro: 'Incident Retro',
  oncall_handover: 'On-Call Handover',
  cve_triage: 'CVE Triage',
};

interface PdfRenderState {
  doc: jsPDF;
  cursorY: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  pageNumber: number;
}

function cleanTextForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // en/em dashes
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-') // bullet points
    .replace(/[\u2726\u2727\u2728\u2605\u2606]/g, '*') // stars/sparkles
    // Strip emojis and non-standard characters outside standard Latin range to avoid font encoding issues
    .replace(/[^\x20-\x7E\t\n\r\u00A0-\u00FF]/g, '');
}

function checkPageBreak(state: PdfRenderState, neededHeight: number) {
  if (state.cursorY + neededHeight > state.pageHeight - state.margin - 30) {
    state.doc.addPage();
    state.pageNumber++;
    state.cursorY = state.margin + 20;
    renderPageHeaderFooter(state);
  }
}

function renderPageHeaderFooter(state: PdfRenderState) {
  const { doc, pageWidth, pageHeight, margin } = state;
  // Header subtle rule
  doc.setDrawColor(220, 215, 205);
  doc.setLineWidth(0.5);
  doc.line(margin, margin, pageWidth - margin, margin);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140, 130, 120);
  doc.text('AuraMind - AI Reflection Journal', margin, margin - 6);

  // Footer page number
  doc.text(
    `Page ${state.pageNumber}`,
    pageWidth - margin,
    pageHeight - margin + 15,
    { align: 'right' }
  );
  doc.text(
    `Exported ${new Date().toLocaleDateString()}`,
    margin,
    pageHeight - margin + 15
  );
}

function renderEntry(state: PdfRenderState, entry: JournalEntry, isMulti: boolean = false) {
  const { doc, margin, contentWidth, pageWidth } = state;

  if (isMulti && state.pageNumber > 1) {
    checkPageBreak(state, 120);
  }

  // --- Title & Metadata ---
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(35, 30, 25);

  const titleText = cleanTextForPdf(entry.title || 'Untitled Reflection');
  const splitTitle = doc.splitTextToSize(titleText, contentWidth);
  checkPageBreak(state, splitTitle.length * 24 + 60);

  doc.text(splitTitle, margin, state.cursorY);
  state.cursorY += splitTitle.length * 22 + 4;

  // Metadata row (Date, Mood, Tags)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 110, 100);

  const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const modeLabel = MODE_LABELS[entry.mode || 'reflection'] || 'Deep Reflection';
  const tagsStr = (entry.tags || []).length > 0 ? `  |  Tags: ${entry.tags.map((t) => `#${cleanTextForPdf(t)}`).join(' ')}` : '';

  doc.text(`${dateStr}  |  Mood: ${modeLabel}${tagsStr}`, margin, state.cursorY);
  state.cursorY += 12;

  // Subtle separator line
  doc.setDrawColor(215, 175, 110);
  doc.setLineWidth(1);
  doc.line(margin, state.cursorY, margin + 80, state.cursorY);
  state.cursorY += 16;

  // --- Initial Reflection Section ---
  if (entry.initialContent && entry.initialContent.trim()) {
    checkPageBreak(state, 50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(80, 60, 30);
    doc.text('INITIAL REFLECTION', margin, state.cursorY);
    state.cursorY += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(45, 40, 35);

    const splitContent = doc.splitTextToSize(cleanTextForPdf(entry.initialContent.trim()), contentWidth - 16);
    const boxHeight = splitContent.length * 14 + 16;

    checkPageBreak(state, boxHeight + 10);

    // Light beige background box
    doc.setFillColor(250, 248, 243);
    doc.setDrawColor(230, 220, 205);
    doc.roundedRect(margin, state.cursorY, contentWidth, boxHeight, 4, 4, 'FD');

    doc.text(splitContent, margin + 8, state.cursorY + 12);
    state.cursorY += boxHeight + 18;
  }

  // --- Dialogue with Gemini ---
  if (entry.messages && entry.messages.length > 0) {
    checkPageBreak(state, 40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(80, 60, 30);
    doc.text('DIALOGUE WITH GEMINI AI', margin, state.cursorY);
    state.cursorY += 14;

    entry.messages.forEach((msg) => {
      const isUser = msg.role === 'user';
      const label = isUser ? 'You' : 'GEMINI AI';
      const sanitizedMsg = cleanTextForPdf(msg.text.trim());
      const textLines = doc.splitTextToSize(sanitizedMsg, contentWidth - 24);
      const msgBoxHeight = textLines.length * 13 + 24;

      checkPageBreak(state, msgBoxHeight + 8);

      if (isUser) {
        // User message bubble styling
        doc.setFillColor(242, 243, 245);
        doc.setDrawColor(215, 220, 225);
        doc.roundedRect(margin, state.cursorY, contentWidth, msgBoxHeight, 4, 4, 'FD');

        // Speaker label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(90, 100, 115);
        doc.text(label, margin + 10, state.cursorY + 10);

        // Body text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 35, 45);
        doc.text(textLines, margin + 10, state.cursorY + 22);
      } else {
        // Gemini AI message bubble styling (warm amber tint)
        doc.setFillColor(254, 250, 240);
        doc.setDrawColor(240, 215, 170);
        doc.roundedRect(margin, state.cursorY, contentWidth, msgBoxHeight, 4, 4, 'FD');

        // Speaker label - clean text label with no icons
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(175, 115, 20);
        doc.text(label, margin + 10, state.cursorY + 10);

        // Body text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(45, 35, 20);
        doc.text(textLines, margin + 10, state.cursorY + 22);
      }

      state.cursorY += msgBoxHeight + 8;
    });

    state.cursorY += 8;
  }

  // --- Gemini Synthesis & Takeaways ---
  if (entry.summary) {
    const s = entry.summary;
    checkPageBreak(state, 70);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(175, 115, 20);
    doc.text('SYNTHESIZED INSIGHTS & TAKEAWAYS', margin, state.cursorY);
    state.cursorY += 14;

    // Synthesis summary box
    if (s.summary) {
      const sanitizedSummary = cleanTextForPdf(s.summary);
      const summaryLines = doc.splitTextToSize(sanitizedSummary, contentWidth - 20);
      const sumBoxHeight = summaryLines.length * 13 + 18;
      checkPageBreak(state, sumBoxHeight + 10);

      doc.setFillColor(255, 252, 245);
      doc.setDrawColor(245, 220, 175);
      doc.roundedRect(margin, state.cursorY, contentWidth, sumBoxHeight, 4, 4, 'FD');

      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(60, 45, 25);
      doc.text(summaryLines, margin + 10, state.cursorY + 13);

      state.cursorY += sumBoxHeight + 12;
    }

    // Sentiment badge if present
    if (s.sentiment) {
      checkPageBreak(state, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(140, 95, 20);
      doc.text(`Emotional Tone: ${cleanTextForPdf(s.sentiment)}`, margin, state.cursorY);
      state.cursorY += 14;
    }

    // Key Insights
    if (s.keyInsights && s.keyInsights.length > 0) {
      checkPageBreak(state, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(80, 60, 30);
      doc.text('Key Insights:', margin, state.cursorY);
      state.cursorY += 12;

      s.keyInsights.forEach((insight) => {
        const sanitizedInsight = cleanTextForPdf(insight);
        const insightLines = doc.splitTextToSize(`- ${sanitizedInsight}`, contentWidth - 12);
        checkPageBreak(state, insightLines.length * 12 + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 45, 40);
        doc.text(insightLines, margin + 6, state.cursorY);
        state.cursorY += insightLines.length * 12 + 3;
      });
      state.cursorY += 6;
    }

    // Actionable Steps
    if (s.actionableSteps && s.actionableSteps.length > 0) {
      checkPageBreak(state, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(80, 60, 30);
      doc.text('Actionable Next Steps:', margin, state.cursorY);
      state.cursorY += 12;

      s.actionableSteps.forEach((step, idx) => {
        const sanitizedStep = cleanTextForPdf(step);
        const stepLines = doc.splitTextToSize(`${idx + 1}. ${sanitizedStep}`, contentWidth - 12);
        checkPageBreak(state, stepLines.length * 12 + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 45, 40);
        doc.text(stepLines, margin + 6, state.cursorY);
        state.cursorY += stepLines.length * 12 + 3;
      });
      state.cursorY += 6;
    }

    // Suggested Follow-up Prompts
    if (s.suggestedPrompts && s.suggestedPrompts.length > 0) {
      checkPageBreak(state, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(80, 60, 30);
      doc.text('Recommended Reflection Prompts:', margin, state.cursorY);
      state.cursorY += 12;

      s.suggestedPrompts.forEach((prompt) => {
        const sanitizedPrompt = cleanTextForPdf(prompt);
        const promptLines = doc.splitTextToSize(`"${sanitizedPrompt}"`, contentWidth - 16);
        checkPageBreak(state, promptLines.length * 12 + 4);
        doc.setFont('times', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(70, 65, 60);
        doc.text(promptLines, margin + 8, state.cursorY);
        state.cursorY += promptLines.length * 12 + 3;
      });
      state.cursorY += 6;
    }
  }

  // Add dividing space after entry
  state.cursorY += 20;
}

/**
 * Export a single journal reflection to a cleanly formatted PDF.
 */
export function exportSingleEntryToPdf(entry: JournalEntry): void {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const state: PdfRenderState = {
    doc,
    cursorY: margin + 25,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    pageNumber: 1,
  };

  renderPageHeaderFooter(state);
  renderEntry(state, entry, false);

  const safeFilename = (entry.title || 'reflection')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);

  doc.save(`${safeFilename || 'journal-entry'}.pdf`);
}

/**
 * Export multiple reflections (e.g. filtered or all history) into a unified PDF digest.
 */
export function exportMultipleEntriesToPdf(
  entries: JournalEntry[],
  collectionTitle: string = 'Reflection Journal History'
): void {
  if (!entries || entries.length === 0) return;

  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const state: PdfRenderState = {
    doc,
    cursorY: margin + 25,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    pageNumber: 1,
  };

  renderPageHeaderFooter(state);

  // Digest Cover Header
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 25, 20);
  doc.text(collectionTitle, margin, state.cursorY);
  state.cursorY += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 100, 90);
  doc.text(
    `Digest containing ${entries.length} reflections  |  Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    margin,
    state.cursorY
  );
  state.cursorY += 20;

  doc.setDrawColor(200, 160, 90);
  doc.setLineWidth(1.5);
  doc.line(margin, state.cursorY, pageWidth - margin, state.cursorY);
  state.cursorY += 28;

  // Render each entry sequentially
  entries.forEach((entry, idx) => {
    if (idx > 0) {
      doc.addPage();
      state.pageNumber++;
      state.cursorY = margin + 25;
      renderPageHeaderFooter(state);
    }
    renderEntry(state, entry, true);
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`auramind-journal-digest-${dateTag}.pdf`);
}
