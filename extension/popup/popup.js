/**
 * MarkBridge – Popup Logic
 *
 * Handles:
 * 1. Page detection (is this a Confluence page?)
 * 2. Communication with the content script
 * 3. HTML → Markdown conversion via Turndown.js
 * 4. Copy-to-clipboard & file download
 */

/* global TurndownService, turndownPluginGfm, MarkBridgeAnalytics */

(function () {
  'use strict';

  // ─── DOM References ──────────────────────────────────────────────
  const statusEl = document.getElementById('status');
  const statusTextEl = statusEl.querySelector('.status-text');
  const optionsEl = document.getElementById('options');
  const convertBtn = document.getElementById('convert-btn');
  const convertBtnText = document.getElementById('convert-btn-text');
  const progressEl = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const resultsEl = document.getElementById('results');
  const resultsStats = document.getElementById('results-stats');
  const previewEl = document.getElementById('preview');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');

  let markdownContent = '';
  let pageTitle = 'untitled';
  let detectedPageType = null;

  // ─── Initialization ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Track popup open and show usage stats
    MarkBridgeAnalytics.trackPopupOpen();
    renderUsageStats();

    const tab = await getCurrentTab();

    if (!tab || !tab.url) {
      setStatus('error', 'Cannot access the current tab.');
      return;
    }

    const confluenceType = detectConfluence(tab.url);
    detectedPageType = confluenceType;

    if (confluenceType) {
      setStatus('success', `Confluence page detected (${confluenceType}). Ready to convert.`);
      convertBtn.disabled = false;
    } else {
      setStatus(
        'warning',
        'This doesn\'t look like a Confluence page. You can still try converting.'
      );
      convertBtn.disabled = false; // Allow trying on any page
    }

    // ── Event Listeners ────────────────────────────────────────────
    convertBtn.addEventListener('click', () => handleConvert(tab));
    copyBtn.addEventListener('click', handleCopy);
    downloadBtn.addEventListener('click', handleDownload);
  }

  // ─── Page Detection ──────────────────────────────────────────────
  function detectConfluence(url) {
    if (!url) return null;

    if (/\.atlassian\.net\/wiki\//i.test(url)) return 'Cloud';
    if (/\.atlassian\.net\/.*\/pages\//i.test(url)) return 'Cloud';
    if (/\/display\/[A-Za-z0-9]+\//i.test(url)) return 'Server/DC';
    if (/\/pages\/viewpage\.action/i.test(url)) return 'Server/DC';
    if (/\/confluence\//i.test(url)) return 'Server/DC';

    return null;
  }

  // ─── Conversion Handler ──────────────────────────────────────────
  async function handleConvert(tab) {
    try {
      convertBtn.disabled = true;
      convertBtnText.textContent = 'Converting…';
      showProgress('Extracting content…');

      // Ensure content script is loaded
      await ensureContentScript(tab.id);

      // Read options
      const embedImages = document.getElementById('opt-embed-images').checked;

      updateProgress(20, 'Extracting content…');

      // Request extraction from content script
      const response = await sendMessageToTab(tab.id, {
        action: 'extract',
        embedImages,
      });

      if (embedImages) {
        updateProgress(50, 'Images embedded…');
      }

      if (!response || !response.success) {
        throw new Error(
          response?.error || 'Failed to extract content. Is this a Confluence page?'
        );
      }

      const { title, html, metadata } = response.data;

      if (!html || html.trim().length === 0) {
        throw new Error('No content found on this page.');
      }

      pageTitle = title || 'untitled';
      updateProgress(70, 'Converting to Markdown…');

      const includeFrontMatter = document.getElementById('opt-frontmatter').checked;
      const includeTitle = document.getElementById('opt-title').checked;

      // Convert HTML to Markdown
      markdownContent = convertToMarkdown(html, {
        title,
        metadata,
        includeFrontMatter,
        includeTitle,
      });

      updateProgress(100, 'Done!');

      // Show results
      showResults(markdownContent);
      setStatus('success', 'Conversion complete!');

      // Track conversion analytics
      MarkBridgeAnalytics.trackConversion(detectedPageType, {
        frontmatter: includeFrontMatter,
        title: includeTitle,
        embedImages: document.getElementById('opt-embed-images').checked,
      });
      renderUsageStats();
    } catch (err) {
      setStatus('error', err.message);
      hideProgress();
    } finally {
      convertBtn.disabled = false;
      convertBtnText.textContent = 'Convert to Markdown';
    }
  }

  // ─── Content Script Management ───────────────────────────────────

  async function ensureContentScript(tabId) {
    try {
      // Check if content script is already loaded
      await sendMessageToTab(tabId, { action: 'ping' });
    } catch (_) {
      // Content script not loaded – inject it dynamically
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/confluence.js'],
      });
      // Small delay to let the script initialize
      await sleep(100);
    }
  }

  function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ─── HTML → Markdown Conversion ──────────────────────────────────

  function convertToMarkdown(html, options = {}) {
    const { title, metadata, includeFrontMatter, includeTitle } = options;

    // Configure Turndown
    const td = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
    });

    // Add GFM plugin components individually (strikethrough, task lists)
    // We use our own table handler instead of the GFM plugin's, because
    // the plugin silently drops tables without a <th>-based heading row.
    td.use(turndownPluginGfm.strikethrough);
    td.use(turndownPluginGfm.taskListItems);
    td.use(turndownPluginGfm.highlightedCodeBlock);

    // Register our robust table rules + Confluence-specific rules
    addTableRules(td);
    addConfluenceRules(td);

    // Convert
    let markdown = td.turndown(html);

    // Post-process
    markdown = postProcess(markdown);

    // Build final document
    const parts = [];

    if (includeFrontMatter && metadata) {
      parts.push(buildFrontMatter(title, metadata));
    }

    if (includeTitle && title) {
      parts.push(`# ${title}\n`);
    }

    parts.push(markdown);

    return parts.join('\n').trim() + '\n';
  }

  // ─── Robust Table Conversion ────────────────────────────────────────
  //
  // The GFM Turndown plugin only converts tables with a <th>-based heading
  // row and drops everything else as raw HTML. Confluence tables rarely
  // satisfy that, so we replace the plugin's table handling entirely.

  function addTableRules(td) {
    // Table cell: <th> or <td>
    td.addRule('tableCell', {
      filter: ['th', 'td'],
      replacement: function (content, node) {
        const cleanContent = content
          .replace(/\n{2,}/g, '<br>')  // Collapse multi-line into <br>
          .replace(/\n/g, ' ')         // Single newlines → spaces
          .replace(/\|/g, '\\|')       // Escape pipes inside cells
          .trim();

        const index = Array.prototype.indexOf.call(
          node.parentNode.childNodes,
          node
        );
        const prefix = index === 0 ? '| ' : ' ';
        return prefix + cleanContent + ' |';
      },
    });

    // Table row: <tr>
    td.addRule('tableRow', {
      filter: 'tr',
      replacement: function (content, node) {
        let separator = '';

        // If this is a heading row, add the separator line after it
        if (isHeadingRow(node)) {
          const cells = node.childNodes;
          const separatorCells = [];
          for (let i = 0; i < cells.length; i++) {
            if (cells[i].nodeType !== 1) continue; // skip text nodes
            const align = (cells[i].getAttribute('align') || '').toLowerCase();
            let border = '---';
            if (align === 'left') border = ':--';
            else if (align === 'right') border = '--:';
            else if (align === 'center') border = ':-:';

            const idx = separatorCells.length;
            const prefix = idx === 0 ? '| ' : ' ';
            separatorCells.push(prefix + border + ' |');
          }
          separator = '\n' + separatorCells.join('');
        }

        return '\n' + content + separator;
      },
    });

    // Table section: <thead>, <tbody>, <tfoot> — pass-through
    td.addRule('tableSection', {
      filter: ['thead', 'tbody', 'tfoot'],
      replacement: function (content) {
        return content;
      },
    });

    // Table: <table> — the main handler
    td.addRule('table', {
      filter: function (node) {
        return node.nodeName === 'TABLE';
      },
      replacement: function (content, node) {
        // Ensure the separator line exists (it's generated by the heading row)
        // If not present, the table has no header — inject a synthetic one
        const lines = content.trim().split('\n').filter((l) => l.trim());

        if (lines.length === 0) return '';

        // Check if there's a separator line (all dashes/colons between pipes)
        const hasSeparator = lines.some((line) =>
          /^\|[\s:|-]+\|$/.test(line.trim())
        );

        if (!hasSeparator && lines.length > 0) {
          // Count columns from first data row
          const colCount = (lines[0].match(/\|/g) || []).length - 1;
          if (colCount > 0) {
            // Insert a separator after the first line (treat first row as header)
            const sep =
              '| ' + Array(colCount).fill('---').join(' | ') + ' |';
            lines.splice(1, 0, sep);
          }
        }

        // Normalize: ensure no blank lines inside the table
        const cleaned = lines.join('\n').replace(/\n{2,}/g, '\n');
        return '\n\n' + cleaned + '\n\n';
      },
    });
  }

  /**
   * Determine if a <tr> is a heading row.
   * Checks: parent is <thead>, or all children are <th>.
   */
  function isHeadingRow(tr) {
    const parent = tr.parentNode;
    if (parent.nodeName === 'THEAD') return true;

    // First row of <table> or first <tbody> where every cell is <th>
    if (parent.firstElementChild === tr) {
      const isTableOrFirstTbody =
        parent.nodeName === 'TABLE' ||
        (parent.nodeName === 'TBODY' && isFirstTbody(parent));

      if (isTableOrFirstTbody) {
        const cells = Array.from(tr.children).filter(
          (n) => n.nodeName === 'TH' || n.nodeName === 'TD'
        );
        return cells.length > 0 && cells.every((n) => n.nodeName === 'TH');
      }
    }

    return false;
  }

  function isFirstTbody(element) {
    const prev = element.previousElementSibling;
    return (
      element.nodeName === 'TBODY' &&
      (!prev ||
        (prev.nodeName === 'THEAD' && prev.textContent.trim() === ''))
    );
  }

  function addConfluenceRules(td) {
    // ── Task list items ────────────────────────────────────────────
    td.addRule('taskListItem', {
      filter: (node) =>
        node.nodeName === 'LI' && node.hasAttribute('data-task'),
      replacement: (content, node) => {
        const isChecked = node.getAttribute('data-task') === 'checked';
        const checkbox = isChecked ? '[x]' : '[ ]';
        const text = content.trim().replace(/^\n+/, '');
        return `- ${checkbox} ${text}\n`;
      },
    });

    // ── Details/summary (expand sections) ──────────────────────────
    td.addRule('detailsSummary', {
      filter: 'details',
      replacement: (content, node) => {
        const summary = node.querySelector('summary');
        const summaryText = summary ? summary.textContent.trim() : 'Details';

        // Get content without the summary text
        let body = content;
        if (summary) {
          body = body.replace(summaryText, '').trim();
        }

        return (
          `\n<details>\n<summary>${summaryText}</summary>\n\n` +
          `${body}\n\n</details>\n\n`
        );
      },
    });

    // ── Confluence images with data attributes ─────────────────────
    td.addRule('confluenceImage', {
      filter: (node) =>
        node.nodeName === 'IMG' &&
        (node.classList.contains('confluence-embedded-image') ||
          node.hasAttribute('data-media-id') ||
          node.hasAttribute('data-base-url')),
      replacement: (_content, node) => {
        const alt = node.getAttribute('alt') || node.getAttribute('title') || 'image';
        const src =
          node.getAttribute('src') ||
          node.getAttribute('data-src') ||
          node.getAttribute('data-media-src') ||
          '';
        return src ? `![${alt}](${src})` : `![${alt}]`;
      },
    });

    // ── Remove empty paragraphs and divs ───────────────────────────
    td.addRule('removeEmpty', {
      filter: (node) =>
        (node.nodeName === 'P' || node.nodeName === 'DIV') &&
        node.textContent.trim() === '' &&
        !node.querySelector('img'),
      replacement: () => '',
    });

    // ── Preserve line breaks in table cells ────────────────────────
    td.addRule('tableLineBreak', {
      filter: (node) =>
        node.nodeName === 'BR' &&
        node.closest &&
        node.closest('td, th'),
      replacement: () => '<br>',
    });
  }

  // ─── Post-Processing ─────────────────────────────────────────────

  function postProcess(markdown) {
    let result = markdown;

    // Collapse 3+ consecutive blank lines into 2
    result = result.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from lines
    result = result.replace(/[ \t]+$/gm, '');

    // Ensure code blocks have proper spacing
    result = result.replace(/```(\w*)\n/g, '```$1\n');

    // Clean up status macro artifacts
    result = result.replace(/\s+`([A-Z ]+)`\s+/g, ' `$1` ');

    // Table cleanup: ensure table rows don't have leading/trailing whitespace
    // that breaks rendering
    result = result.replace(/^(\|.+\|)\s*$/gm, '$1');

    // Remove any stray <table>, <tr>, <td>, <th>, <thead>, <tbody> HTML tags
    // that survived conversion (these appear when conversion partially fails)
    result = result.replace(/<\/?(table|thead|tbody|tfoot|tr|th|td|colgroup|col|caption)[^>]*>/gi, '');

    return result;
  }

  // ─── YAML Front Matter ───────────────────────────────────────────

  function buildFrontMatter(title, metadata) {
    const lines = ['---'];

    if (title) lines.push(`title: "${escapeYaml(title)}"`);
    if (metadata.space) lines.push(`space: "${escapeYaml(metadata.space)}"`);
    if (metadata.author) lines.push(`author: "${escapeYaml(metadata.author)}"`);
    if (metadata.lastModified) lines.push(`last_modified: "${escapeYaml(metadata.lastModified)}"`);
    if (metadata.sourceUrl) lines.push(`source_url: "${escapeYaml(metadata.sourceUrl)}"`);

    if (metadata.labels && metadata.labels.length) {
      lines.push('labels:');
      metadata.labels.forEach((label) => {
        lines.push(`  - "${escapeYaml(label)}"`);
      });
    }

    lines.push(`converted_at: "${new Date().toISOString()}"`);
    lines.push('---\n');

    return lines.join('\n');
  }

  function escapeYaml(str) {
    return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
  }

  // ─── Copy to Clipboard ──────────────────────────────────────────

  function handleCopy() {
    navigator.clipboard.writeText(markdownContent).then(() => {
      copyBtn.classList.add('copied');
      copyBtn.querySelector('svg + text, span')?.remove();
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = copyBtn.innerHTML.replace('Copy', 'Copied!');
      MarkBridgeAnalytics.trackCopy();
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = originalHTML;
      }, 2000);
    });
  }

  // ─── Download .md File ──────────────────────────────────────────

  function handleDownload() {
    const filename = sanitizeFilename(pageTitle) + '.md';
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    MarkBridgeAnalytics.trackDownload();

    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[/\\?%*:|"<>]/g, '-') // Remove invalid chars
      .replace(/\s+/g, '-')            // Spaces to hyphens
      .replace(/-+/g, '-')             // Collapse multiple hyphens
      .replace(/^-|-$/g, '')           // Trim leading/trailing hyphens
      .substring(0, 100)               // Limit length
      .toLowerCase();
  }

  // ─── UI Helpers ──────────────────────────────────────────────────

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function setStatus(type, message) {
    statusEl.className = `status ${type}`;
    statusTextEl.textContent = message;
  }

  function showProgress(text) {
    progressEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
    progressFill.classList.add('indeterminate');
    progressText.textContent = text;
  }

  function updateProgress(percent, text) {
    progressFill.classList.remove('indeterminate');
    progressFill.style.width = `${percent}%`;
    progressText.textContent = text;
  }

  function hideProgress() {
    progressEl.classList.add('hidden');
  }

  function showResults(markdown) {
    setTimeout(() => {
      progressEl.classList.add('hidden');
      resultsEl.classList.remove('hidden');

      const lines = markdown.split('\n').length;
      const chars = markdown.length;
      const words = markdown.split(/\s+/).filter(Boolean).length;

      // Count embedded images
      const embeddedImages = (markdown.match(/!\[.*?\]\(data:image\//g) || []).length;
      const linkedImages = (markdown.match(/!\[.*?\]\(https?:\/\//g) || []).length;
      let stats = `${words} words · ${lines} lines · ${formatBytes(chars)}`;
      if (embeddedImages > 0 || linkedImages > 0) {
        const imgParts = [];
        if (embeddedImages > 0) imgParts.push(`${embeddedImages} embedded`);
        if (linkedImages > 0) imgParts.push(`${linkedImages} linked`);
        stats += ` · ${imgParts.join(', ')} image${embeddedImages + linkedImages > 1 ? 's' : ''}`;
      }
      resultsStats.textContent = stats;

      // For large outputs (with embedded images), truncate the preview
      // to avoid making the popup unresponsive
      const MAX_PREVIEW_CHARS = 50000;
      if (markdown.length > MAX_PREVIEW_CHARS) {
        previewEl.textContent =
          markdown.substring(0, MAX_PREVIEW_CHARS) +
          `\n\n… [Preview truncated — full content is ${formatBytes(chars)}. Use Copy or Download for the complete file.]`;
      } else {
        previewEl.textContent = markdown;
      }
    }, 300);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Usage Stats Display ───────────────────────────────────────

  async function renderUsageStats() {
    try {
      const summary = await MarkBridgeAnalytics.getSummary();
      const statsTextEl = document.getElementById('stats-text');
      if (!statsTextEl) return;

      if (summary.totalConversions === 0) {
        statsTextEl.textContent = 'No conversions yet — try your first one!';
      } else {
        const parts = [];
        parts.push(`${summary.totalConversions} page${summary.totalConversions !== 1 ? 's' : ''} converted`);
        if (summary.todayConversions > 0) {
          parts.push(`${summary.todayConversions} today`);
        }
        statsTextEl.textContent = parts.join(' · ');
      }
    } catch (_) {
      // Analytics should never break the main UI
    }
  }
})();
