/**
 * Confluence Content Extractor
 * 
 * This content script extracts page content from Confluence pages
 * (Cloud, Server, and Data Center) and preprocesses the HTML for
 * clean Markdown conversion.
 * 
 * It handles:
 * - Multiple Confluence DOM structures (new editor, legacy, Server/DC)
 * - Code blocks with language detection
 * - Info/Note/Warning/Tip panels
 * - Expand/collapse sections
 * - Task lists / checkboxes
 * - Status macros
 * - User mentions
 * - Emoticons
 * - JIRA issue links
 * - Table of contents removal
 */

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__markBridgeLoaded) return;
  window.__markBridgeLoaded = true;

  // ─── Message Listener ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'extract') {
      const embedImages = message.embedImages || false;
      extractPage(embedImages)
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
    }

    if (message.action === 'ping') {
      sendResponse({ success: true });
    }

    return true; // keep channel open for async
  });

  // ─── Main Extraction ───────────────────────────────────────────────
  async function extractPage(embedImages) {
    const contentEl = findContentElement();
    if (!contentEl) {
      throw new Error(
        'Could not locate the Confluence page content. Make sure you are viewing a Confluence page.'
      );
    }

    const title = findTitle();
    const metadata = extractMetadata();

    // Work on a clone so we never modify the live page
    const clone = contentEl.cloneNode(true);
    preprocessContent(clone);

    // Embed images as base64 data URIs if requested
    if (embedImages) {
      await embedImagesAsBase64(clone);
    }

    return {
      title,
      html: clone.innerHTML,
      metadata,
    };
  }

  // ─── Content Element Detection ─────────────────────────────────────
  function findContentElement() {
    const selectors = [
      // Confluence Cloud – new Fabric / Atlassian editor
      '[data-testid="renderer-page"]',
      '.ak-renderer-document',
      // Confluence Cloud – legacy editor
      '#content .wiki-content',
      '#main-content .wiki-content',
      // Confluence Server / Data Center
      '.wiki-content',
      '#main-content',
      // Generic fallbacks
      '#content',
      'article[role="main"]',
      'main',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerHTML.trim().length > 100) return el;
    }

    // Fallback: try any element with significant content
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerHTML.trim().length > 0) return el;
    }

    return null;
  }

  // ─── Title Detection ───────────────────────────────────────────────
  function findTitle() {
    const selectors = [
      '#title-text',
      '[data-testid="title-text"]',
      '#content-title-heading',
      'h1#title-heading span',
      'h1#title-heading',
      'h1.pagetitle',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }

    // Fallback to document title, stripping common Confluence suffixes
    return document.title
      .replace(/\s*[-–—]\s*Confluence.*$/i, '')
      .replace(/\s*[-–—]\s*Atlassian.*$/i, '')
      .trim();
  }

  // ─── Metadata Extraction ───────────────────────────────────────────
  function extractMetadata() {
    const meta = { sourceUrl: window.location.href };

    // Space name
    const spaceEl = document.querySelector(
      '#breadcrumb-section a, .breadcrumbs-section a, [data-testid="breadcrumb-space"] a'
    );
    if (spaceEl) meta.space = spaceEl.textContent.trim();

    // Author
    const authorEl = document.querySelector(
      '.page-metadata-modification-info .author a, [data-testid="page-metadata-author"]'
    );
    if (authorEl) meta.author = authorEl.textContent.trim();

    // Last modified date
    const dateEl = document.querySelector(
      '.page-metadata-modification-info .date, .last-modified, [data-testid="page-metadata-date"]'
    );
    if (dateEl) meta.lastModified = dateEl.textContent.trim();

    // Labels
    const labels = document.querySelectorAll(
      '.label-list .label, .aui-label, [data-testid="label"]'
    );
    if (labels.length) {
      meta.labels = Array.from(labels).map((l) => l.textContent.trim());
    }

    return meta;
  }

  // ─── Content Preprocessing ─────────────────────────────────────────
  //
  // Transforms Confluence-specific DOM elements into standard HTML
  // structures that Turndown.js can convert cleanly.

  function preprocessContent(container) {
    removeUnwantedElements(container);
    convertEmoticons(container);
    convertUserMentions(container);
    convertJiraLinks(container);
    convertCodeBlocks(container);
    convertPanels(container);
    convertExpandSections(container);
    convertStatusMacros(container);
    convertTaskLists(container);
    normalizeConfluenceTables(container);
    cleanupImages(container);
  }

  // ── Remove noise ────────────────────────────────────────────────────
  function removeUnwantedElements(container) {
    const removeSelectors = [
      // Table of contents
      '.toc-macro',
      '.toc-zone',
      '[data-macro-name="toc"]',
      // Page breaks
      '.page-break',
      '.confluence-page-break',
      // Social / interactive elements
      '.like-button',
      '.page-comments',
      '#comments-section',
      '#likes-and-labels-container',
      // Edit buttons and action menus
      '.confluence-page-action',
      '.page-metadata-modification-info',
      // Macro placeholders that add no content
      '.wysiwyg-macro-placeholder',
    ];
    removeSelectors.forEach((sel) => {
      container.querySelectorAll(sel).forEach((el) => el.remove());
    });
  }

  // ── Emoticons ───────────────────────────────────────────────────────
  function convertEmoticons(container) {
    container.querySelectorAll('img.emoticon, img[data-emoji-short-name]').forEach((img) => {
      const alt =
        img.getAttribute('data-emoji-short-name') ||
        img.getAttribute('alt') ||
        img.getAttribute('title') ||
        '';
      img.replaceWith(document.createTextNode(alt));
    });
  }

  // ── User mentions ──────────────────────────────────────────────────
  function convertUserMentions(container) {
    container
      .querySelectorAll('.confluence-userlink, [data-node-type="mention"]')
      .forEach((el) => {
        const name = el.textContent.trim();
        el.replaceWith(document.createTextNode(`@${name}`));
      });
  }

  // ── JIRA issue links ──────────────────────────────────────────────
  function convertJiraLinks(container) {
    container
      .querySelectorAll('.jira-issue-key, [data-node-type="inlineCard"]')
      .forEach((el) => {
        const text = el.textContent.trim();
        const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
        if (href) {
          const link = document.createElement('a');
          link.href = href;
          link.textContent = text;
          el.replaceWith(link);
        }
      });
  }

  // ── Code blocks ────────────────────────────────────────────────────
  function convertCodeBlocks(container) {
    // Old Confluence editor: <div class="code panel"> wrapping <pre>
    container
      .querySelectorAll('.code.panel, .codeContent, .preformatted.panel')
      .forEach((panel) => {
        const pre = panel.querySelector('pre');
        if (!pre) return;

        const lang = detectCodeLanguage(pre, panel);
        const newPre = document.createElement('pre');
        const code = document.createElement('code');
        if (lang) code.className = `language-${lang}`;
        code.textContent = pre.textContent;
        newPre.appendChild(code);
        panel.replaceWith(newPre);
      });

    // New Confluence editor: data-node-type="codeBlock"
    container.querySelectorAll('[data-node-type="codeBlock"]').forEach((block) => {
      const lang = block.getAttribute('data-language') || '';
      const newPre = document.createElement('pre');
      const code = document.createElement('code');
      if (lang) code.className = `language-${lang}`;
      code.textContent = block.textContent;
      newPre.appendChild(code);
      block.replaceWith(newPre);
    });
  }

  function detectCodeLanguage(pre, panel) {
    // Check syntaxhighlighter params
    const params = pre.getAttribute('data-syntaxhighlighter-params') || '';
    const brushMatch = params.match(/brush:\s*(\w+)/);
    if (brushMatch) return normalizeLanguage(brushMatch[1]);

    // Check class on pre or code element
    const code = pre.querySelector('code');
    const classStr = (pre.className || '') + ' ' + (code?.className || '') + ' ' + (panel?.className || '');
    const langMatch = classStr.match(/language-(\w+)|lang-(\w+)|brush-(\w+)/);
    if (langMatch) return normalizeLanguage(langMatch[1] || langMatch[2] || langMatch[3]);

    // Check data attributes
    const dataLang = pre.getAttribute('data-language') || panel?.getAttribute('data-language');
    if (dataLang) return normalizeLanguage(dataLang);

    return '';
  }

  function normalizeLanguage(lang) {
    const map = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      rb: 'ruby',
      sh: 'bash',
      shell: 'bash',
      yml: 'yaml',
      'c#': 'csharp',
      'c++': 'cpp',
    };
    return map[lang.toLowerCase()] || lang.toLowerCase();
  }

  // ── Info / Note / Warning / Tip panels ─────────────────────────────
  function convertPanels(container) {
    const panelClasses = {
      'confluence-information-macro-information': 'Info',
      'confluence-information-macro-note': 'Note',
      'confluence-information-macro-warning': 'Warning',
      'confluence-information-macro-tip': 'Tip',
      'confluence-information-macro-success': 'Success',
    };

    // Old-style panels
    container.querySelectorAll('.confluence-information-macro').forEach((macro) => {
      let type = 'Note';
      for (const [cls, label] of Object.entries(panelClasses)) {
        if (macro.classList.contains(cls)) {
          type = label;
          break;
        }
      }

      const body =
        macro.querySelector('.confluence-information-macro-body') || macro;
      const blockquote = document.createElement('blockquote');
      const prefix = document.createElement('p');
      prefix.innerHTML = `<strong>${getEmojiForPanel(type)} ${type}:</strong>`;
      blockquote.appendChild(prefix);

      // Move body children into blockquote
      const bodyClone = body.cloneNode(true);
      while (bodyClone.firstChild) {
        blockquote.appendChild(bodyClone.firstChild);
      }
      macro.replaceWith(blockquote);
    });

    // New-style panels (data-panel-type)
    container.querySelectorAll('[data-panel-type]').forEach((panel) => {
      const type = panel.getAttribute('data-panel-type') || 'info';
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const content = panel.querySelector('[data-panel-content]') || panel;

      const blockquote = document.createElement('blockquote');
      const prefix = document.createElement('p');
      prefix.innerHTML = `<strong>${getEmojiForPanel(label)} ${label}:</strong>`;
      blockquote.appendChild(prefix);

      const contentClone = content.cloneNode(true);
      while (contentClone.firstChild) {
        blockquote.appendChild(contentClone.firstChild);
      }
      panel.replaceWith(blockquote);
    });

    // Generic Confluence panels (colored panels)
    container.querySelectorAll('.panel:not(.code)').forEach((panel) => {
      const header = panel.querySelector('.panelHeader');
      const body = panel.querySelector('.panelContent') || panel;

      const blockquote = document.createElement('blockquote');
      if (header) {
        const h = document.createElement('p');
        h.innerHTML = `<strong>${header.textContent.trim()}</strong>`;
        blockquote.appendChild(h);
      }

      const bodyClone = body.cloneNode(true);
      while (bodyClone.firstChild) {
        blockquote.appendChild(bodyClone.firstChild);
      }
      panel.replaceWith(blockquote);
    });
  }

  function getEmojiForPanel(type) {
    const emojis = {
      Info: 'ℹ️',
      Note: '📝',
      Warning: '⚠️',
      Tip: '💡',
      Success: '✅',
      Error: '❌',
    };
    return emojis[type] || 'ℹ️';
  }

  // ── Expand / collapse sections ─────────────────────────────────────
  function convertExpandSections(container) {
    container
      .querySelectorAll('.expand-container, [data-node-type="expand"]')
      .forEach((el) => {
        const titleEl = el.querySelector(
          '.expand-control-text, [data-testid="expand-title"]'
        );
        const contentEl = el.querySelector(
          '.expand-content, [data-testid="expand-content"]'
        );

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = titleEl
          ? titleEl.textContent.trim()
          : 'Click to expand';
        details.appendChild(summary);

        if (contentEl) {
          const clone = contentEl.cloneNode(true);
          while (clone.firstChild) {
            details.appendChild(clone.firstChild);
          }
        }

        el.replaceWith(details);
      });
  }

  // ── Status macros ──────────────────────────────────────────────────
  function convertStatusMacros(container) {
    container
      .querySelectorAll(
        '.status-macro, .aui-lozenge, [data-node-type="status"]'
      )
      .forEach((el) => {
        const text = el.textContent.trim().toUpperCase();
        el.replaceWith(document.createTextNode(` \`${text}\` `));
      });
  }

  // ── Task lists / checkboxes ────────────────────────────────────────
  function convertTaskLists(container) {
    container
      .querySelectorAll(
        '.inline-task-list, [data-node-type="taskList"]'
      )
      .forEach((list) => {
        const items = list.querySelectorAll(
          '.inline-task-item, [data-node-type="taskItem"]'
        );
        const ul = document.createElement('ul');
        ul.setAttribute('data-task-list', 'true');

        items.forEach((item) => {
          const li = document.createElement('li');
          const isChecked =
            item.querySelector('input[checked], .task-status-complete') !==
              null ||
            item.getAttribute('data-task-state') === 'DONE';
          li.setAttribute('data-task', isChecked ? 'checked' : 'unchecked');

          // Clone and remove original checkbox inputs
          const clone = item.cloneNode(true);
          clone
            .querySelectorAll('input[type="checkbox"], .task-status')
            .forEach((cb) => cb.remove());
          li.innerHTML = clone.innerHTML;
          ul.appendChild(li);
        });

        list.replaceWith(ul);
      });
  }

  // ── Table normalization ─────────────────────────────────────────────
  //
  // Confluence tables are notoriously non-standard:
  //  - Header cells use <td class="confluenceTh"> instead of <th>
  //  - No <thead> / <tbody> separation
  //  - colspan / rowspan for merged cells
  //  - Wrapper divs (.table-wrap, .tablesorter, etc.)
  //  - New editor uses data attributes instead of classes
  //
  // The GFM Turndown plugin ONLY converts tables whose first row is
  // a proper heading row (all <th> inside <thead> or first <tbody>).
  // Everything else is kept as raw HTML. This function normalizes
  // Confluence tables so they meet that requirement.

  function normalizeConfluenceTables(container) {
    // Unwrap Confluence table wrappers
    container
      .querySelectorAll('.table-wrap, .tablesorter-header-inner, div.scroll-wrapper')
      .forEach((wrapper) => {
        const table = wrapper.querySelector('table');
        if (table) {
          wrapper.replaceWith(table);
        }
      });

    container.querySelectorAll('table').forEach((table) => {
      normalizeTable(table);
    });
  }

  function normalizeTable(table) {
    // Step 1: Expand colspan and rowspan into real cells
    expandMergedCells(table);

    // Step 2: Convert Confluence "header" <td>s to real <th> elements
    promoteHeaderCells(table);

    // Step 3: Ensure the first row is wrapped in <thead> if it's all <th>
    ensureThead(table);

    // Step 4: If there's still no <th> header row, synthesize one
    // (the GFM plugin silently drops the whole table otherwise)
    ensureHeaderRow(table);

    // Step 5: Clean cell content — remove nested block elements that
    //         break pipe-table formatting
    cleanCellContent(table);
  }

  /**
   * Expand colspan/rowspan into individual cells so every row has
   * the same number of columns (required for Markdown tables).
   */
  function expandMergedCells(table) {
    const rows = Array.from(table.rows);
    if (!rows.length) return;

    // Build a 2D grid that accounts for row/col spans
    const grid = [];
    const maxCols = getMaxColumns(table);

    for (let r = 0; r < rows.length; r++) {
      if (!grid[r]) grid[r] = new Array(maxCols).fill(null);
      let cellIdx = 0;

      for (const cell of Array.from(rows[r].cells)) {
        // Find the next free column in this row
        while (cellIdx < maxCols && grid[r][cellIdx] !== null) cellIdx++;
        if (cellIdx >= maxCols) break;

        const colspan = parseInt(cell.getAttribute('colspan'), 10) || 1;
        const rowspan = parseInt(cell.getAttribute('rowspan'), 10) || 1;

        // Mark cells occupied by this span
        for (let dr = 0; dr < rowspan; dr++) {
          for (let dc = 0; dc < colspan; dc++) {
            const gr = r + dr;
            const gc = cellIdx + dc;
            if (!grid[gr]) grid[gr] = new Array(maxCols).fill(null);
            if (gr < rows.length && gc < maxCols) {
              grid[gr][gc] = {
                originRow: r,
                originCol: cellIdx,
                isOrigin: dr === 0 && dc === 0,
                cell: cell,
              };
            }
          }
        }

        // Remove span attributes from the original cell
        cell.removeAttribute('colspan');
        cell.removeAttribute('rowspan');
        cellIdx += colspan;
      }
    }

    // Rebuild rows: insert cloned cells where spans created gaps
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      // Clear existing cells
      while (row.cells.length) row.deleteCell(0);

      for (let c = 0; c < maxCols; c++) {
        const info = grid[r] && grid[r][c];
        if (info && info.isOrigin) {
          // Original cell — re-append it
          row.appendChild(info.cell);
        } else if (info) {
          // Spanned cell — create a duplicate with the same content
          const dup = info.cell.cloneNode(false); // empty clone, same tag
          dup.textContent = ''; // spanned cells are typically empty duplicates
          // Preserve the tag type (th/td) of the origin cell
          row.appendChild(dup);
        } else {
          // Missing cell — pad with empty <td>
          row.appendChild(document.createElement('td'));
        }
      }
    }
  }

  function getMaxColumns(table) {
    let max = 0;
    for (const row of Array.from(table.rows)) {
      let count = 0;
      for (const cell of Array.from(row.cells)) {
        count += parseInt(cell.getAttribute('colspan'), 10) || 1;
      }
      if (count > max) max = count;
    }
    return max;
  }

  /**
   * Convert <td> cells that Confluence treats as headers into real <th>.
   *
   * Confluence marks headers with:
   *  - class="confluenceTh" (legacy & Server/DC)
   *  - class="highlight-grey" or "highlight" (legacy)
   *  - data-highlight-colour attribute (Cloud legacy)
   *  - <b> or <strong> wrapping all cell content (common pattern)
   *  - th-like styling (background-color in inline style)
   */
  function promoteHeaderCells(table) {
    const firstRow = table.rows[0];
    if (!firstRow) return;

    const isHeaderCell = (td) => {
      if (td.nodeName === 'TH') return true;

      const cls = td.className || '';
      if (/confluenceTh|highlight-grey|highlight/i.test(cls)) return true;

      if (td.hasAttribute('data-highlight-colour')) return true;

      // Check inline style for header-like background
      const style = td.getAttribute('style') || '';
      if (/background-color\s*:\s*#(?:f0f0f0|e0e0e0|dfe1e5|f4f5f7|deebff)/i.test(style)) {
        return true;
      }

      // If the entire cell content is wrapped in <b> or <strong>, likely a header
      const children = Array.from(td.childNodes).filter(
        (n) => !(n.nodeType === 3 && n.textContent.trim() === '')
      );
      if (
        children.length === 1 &&
        (children[0].nodeName === 'B' || children[0].nodeName === 'STRONG')
      ) {
        return true;
      }

      return false;
    };

    // Check if the entire first row looks like headers
    const firstRowCells = Array.from(firstRow.cells);
    const allHeaders = firstRowCells.length > 0 && firstRowCells.every(isHeaderCell);

    if (allHeaders) {
      // Convert all first-row cells to <th>
      firstRowCells.forEach((td) => {
        if (td.nodeName !== 'TH') {
          const th = document.createElement('th');
          th.innerHTML = td.innerHTML;
          // Copy attributes
          for (const attr of Array.from(td.attributes)) {
            th.setAttribute(attr.name, attr.value);
          }
          td.replaceWith(th);
        }
      });
    }

    // Also promote header cells in subsequent rows that are clearly <th>-like
    // (e.g. first column used as row headers) — but only convert them to <th>
    // tag so Turndown can style them. This is cosmetic for now.
    for (let r = 1; r < table.rows.length; r++) {
      for (const cell of Array.from(table.rows[r].cells)) {
        if (cell.nodeName === 'TD' && /confluenceTh/i.test(cell.className || '')) {
          const th = document.createElement('th');
          th.innerHTML = cell.innerHTML;
          for (const attr of Array.from(cell.attributes)) {
            th.setAttribute(attr.name, attr.value);
          }
          cell.replaceWith(th);
        }
      }
    }
  }

  /**
   * If the first row is all <th> but not inside <thead>, wrap it.
   */
  function ensureThead(table) {
    const firstRow = table.rows[0];
    if (!firstRow) return;

    // Already in <thead>? Nothing to do.
    if (firstRow.parentNode.nodeName === 'THEAD') return;

    const allTh = Array.from(firstRow.cells).every((c) => c.nodeName === 'TH');
    if (!allTh) return;

    // Create <thead> and move the first row into it
    let thead = table.querySelector('thead');
    if (!thead) {
      thead = document.createElement('thead');
      table.insertBefore(thead, table.firstChild);
    }
    thead.appendChild(firstRow);

    // Ensure remaining rows are in <tbody>
    let tbody = table.querySelector('tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      // Move all remaining <tr> into <tbody>
      const remainingRows = Array.from(table.querySelectorAll(':scope > tr'));
      remainingRows.forEach((row) => tbody.appendChild(row));
      table.appendChild(tbody);
    }
  }

  /**
   * Last resort: if the table still has no <th> header row, create a
   * synthetic header using column indices (Col 1, Col 2, …).
   * Without this, the GFM plugin emits raw HTML instead of a table.
   */
  function ensureHeaderRow(table) {
    const firstRow = table.rows[0];
    if (!firstRow) return;

    const hasTh = Array.from(firstRow.cells).some((c) => c.nodeName === 'TH');
    if (hasTh) return; // Already has header cells

    const numCols = firstRow.cells.length;
    if (numCols === 0) return;

    // Build a synthetic header row
    const headerRow = document.createElement('tr');
    for (let i = 0; i < numCols; i++) {
      const th = document.createElement('th');
      // Try to infer a label from the first row content if it looks header-ish
      // Otherwise use generic "Column N"
      const firstCellText = firstRow.cells[i]?.textContent?.trim() || '';
      // Heuristic: if first row cells are short and text-only, they might be headers
      const looksLikeHeader =
        firstCellText.length > 0 &&
        firstCellText.length < 50 &&
        !firstRow.cells[i]?.querySelector('img, pre, code, table');

      if (looksLikeHeader) {
        th.textContent = firstCellText;
      } else {
        th.textContent = `Column ${i + 1}`;
      }
      headerRow.appendChild(th);
    }

    // If first row looked like headers, replace it; otherwise insert before it
    const looksLikeHeaderRow = Array.from(firstRow.cells).every((c) => {
      const text = c.textContent.trim();
      return text.length > 0 && text.length < 50 && !c.querySelector('img, pre, code, table');
    });

    let thead = table.querySelector('thead');
    if (!thead) {
      thead = document.createElement('thead');
      table.insertBefore(thead, table.firstChild);
    }

    thead.appendChild(headerRow);

    if (looksLikeHeaderRow) {
      // The original first row was likely the header — remove it to avoid duplication
      firstRow.remove();
    }
    // Otherwise keep it as a data row
  }

  /**
   * Clean cell content for pipe-table compatibility.
   * Markdown pipe tables require single-line cell content.
   */
  function cleanCellContent(table) {
    for (const cell of table.querySelectorAll('th, td')) {
      // Replace block-level elements with their inner content + line breaks
      cell.querySelectorAll('p, div').forEach((block) => {
        // Don't unwrap if it's the only child
        if (block.parentNode === cell && cell.children.length === 1) {
          // Just unwrap the <p>/<div> — move its children up
          while (block.firstChild) {
            block.parentNode.insertBefore(block.firstChild, block);
          }
          block.remove();
        } else {
          // Multiple blocks — add <br> between them
          const br = document.createElement('br');
          block.parentNode.insertBefore(br, block.nextSibling);
          while (block.firstChild) {
            block.parentNode.insertBefore(block.firstChild, block);
          }
          block.remove();
        }
      });

      // Strip newlines from cell text (pipe tables are single-line per cell)
      // We replace them with <br> which our Turndown rule preserves
      for (const child of Array.from(cell.childNodes)) {
        if (child.nodeType === 3 /* TEXT_NODE */) {
          child.textContent = child.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        }
      }

      // Remove width/height styles that add no value in Markdown
      cell.removeAttribute('width');
      cell.removeAttribute('height');
      cell.style.removeProperty('width');
      cell.style.removeProperty('height');
    }
  }

  // ── Image cleanup ──────────────────────────────────────────────────
  function cleanupImages(container) {
    container.querySelectorAll('img').forEach((img) => {
      // Resolve the best available URL for this image
      const bestSrc = resolveBestImageUrl(img);
      if (bestSrc) {
        img.setAttribute('src', bestSrc);
      }

      // Ensure alt text exists
      if (!img.alt) {
        img.alt = img.getAttribute('title') || img.getAttribute('data-alt') || 'image';
      }

      // Remove Confluence-specific attributes that clutter the output
      const removeAttrs = [
        'data-media-id', 'data-media-type', 'data-base-url',
        'data-linked-resource-id', 'data-linked-resource-type',
        'data-linked-resource-version', 'data-linked-resource-default-alias',
        'data-resource-id', 'data-resource-type', 'loading',
        'data-unresolved-comment-count', 'data-location',
        'data-image-src', 'data-width', 'data-height',
      ];
      removeAttrs.forEach((attr) => img.removeAttribute(attr));
    });
  }

  /**
   * Find the best available URL for a Confluence image.
   *
   * Confluence images can have their URL in many places:
   *  - src (may be blob:, relative, thumbnail, or full-size)
   *  - data-src / data-media-src (lazy-loaded images)
   *  - data-image-src (older Confluence)
   *  - Attachment download URL pattern
   */
  function resolveBestImageUrl(img) {
    const candidates = [
      img.getAttribute('data-image-src'),
      img.getAttribute('data-media-src'),
      img.getAttribute('data-src'),
      img.getAttribute('src'),
    ].filter(Boolean);

    // Prefer non-blob, non-placeholder, absolute URLs
    for (const url of candidates) {
      if (url.startsWith('data:')) return url; // Already embedded
      if (url.startsWith('blob:')) continue;   // Skip blobs (can't survive outside page)
      if (url.includes('placeholder')) continue;

      // Make absolute if relative
      if (!url.startsWith('http')) {
        try {
          return new URL(url, window.location.origin).href;
        } catch (_) {
          continue;
        }
      }
      return url;
    }

    // Fallback: try to construct attachment download URL from data attributes
    const resourceId = img.getAttribute('data-linked-resource-id') ||
                       img.getAttribute('data-media-id') ||
                       img.getAttribute('data-resource-id');
    const baseUrl = img.getAttribute('data-base-url') || window.location.origin;

    if (resourceId) {
      // Confluence attachment download pattern
      return `${baseUrl}/download/attachments/${resourceId}`;
    }

    // Last resort: return whatever src we have, even if it's a blob
    return img.getAttribute('src') || '';
  }

  // ── Embed images as base64 data URIs ───────────────────────────────
  //
  // Fetches each image from within the page context (where the user's
  // session cookies are available) and converts to base64 data URIs.
  // This ensures images render anywhere the Markdown file is opened.

  async function embedImagesAsBase64(container) {
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) return;

    // Process images in parallel with a concurrency limit
    const CONCURRENCY = 4;
    const TIMEOUT_MS = 8000; // 8 seconds per image

    const results = [];
    for (let i = 0; i < images.length; i += CONCURRENCY) {
      const batch = images.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((img) => fetchAndEmbedImage(img, TIMEOUT_MS))
      );
      results.push(...batchResults);
    }

    return results;
  }

  async function fetchAndEmbedImage(img, timeoutMs) {
    const src = img.getAttribute('src') || '';

    // Skip if already a data URI
    if (src.startsWith('data:')) return;

    // Skip if no valid URL
    if (!src || src === 'about:blank') return;

    try {
      const dataUri = await fetchImageAsDataUri(src, timeoutMs);
      if (dataUri) {
        img.setAttribute('src', dataUri);
      }
    } catch (_) {
      // Fetching failed — keep the original URL as fallback.
      // The image won't render outside Confluence, but at least
      // the alt text and URL will be in the Markdown.
    }
  }

  /**
   * Fetch an image URL and return a base64 data URI.
   *
   * Uses two strategies:
   * 1. fetch() with credentials — works for same-origin & CORS-enabled images
   * 2. Canvas drawImage — works for images the browser already has cached
   */
  async function fetchImageAsDataUri(url, timeoutMs) {
    // Strategy 1: fetch() — most reliable for same-origin
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        credentials: 'include', // Send cookies for authenticated images
        signal: controller.signal,
        cache: 'force-cache',   // Use cached version if available
      });

      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();

      // Validate it's actually an image
      if (!blob.type.startsWith('image/')) {
        throw new Error('Not an image: ' + blob.type);
      }

      // Skip very large images (> 5MB) to avoid bloating the output
      if (blob.size > 5 * 1024 * 1024) {
        return null; // Keep as URL
      }

      return await blobToDataUri(blob);
    } catch (fetchErr) {
      // Strategy 2: Canvas — fallback for cached/cross-origin images
      try {
        return await imageToDataUriViaCanvas(url, timeoutMs);
      } catch (_) {
        throw fetchErr; // Both strategies failed
      }
    }
  }

  function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Canvas-based fallback: draw the image onto a canvas and export as data URI.
   * Works for images already in the browser's cache, even some cross-origin ones.
   */
  function imageToDataUriViaCanvas(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Try CORS
      const timer = setTimeout(() => {
        reject(new Error('Canvas image load timed out'));
      }, timeoutMs);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          // Determine format: use PNG for transparency, JPEG for photos
          const format = hasTransparency(ctx, canvas.width, canvas.height)
            ? 'image/png'
            : 'image/jpeg';
          const quality = format === 'image/jpeg' ? 0.85 : undefined;
          const dataUri = canvas.toDataURL(format, quality);
          resolve(dataUri);
        } catch (e) {
          reject(e); // Canvas tainted by cross-origin data
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Image load failed'));
      };

      img.src = url;
    });
  }

  /**
   * Quick check if an image has any transparent pixels.
   * Samples a few pixels rather than scanning every pixel.
   */
  function hasTransparency(ctx, width, height) {
    try {
      // Sample corners and center
      const points = [
        [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
        [Math.floor(width / 2), Math.floor(height / 2)],
      ];
      for (const [x, y] of points) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[3] < 255) return true;
      }
    } catch (_) {
      // getImageData may fail on tainted canvas
    }
    return false;
  }
})();

