# Chrome Web Store Listing — MarkBridge

Use this document when filling out the Chrome Web Store Developer Dashboard at
https://chrome.google.com/webstore/devconsole

---

## Extension Name

```
MarkBridge — Confluence to Markdown
```

> 45 characters max. The name includes the core value proposition for search.

## Summary (short description)

```
Convert Confluence wiki pages to clean Markdown with one click. Supports Cloud, Server & Data Center. Privacy-first — no data leaves your browser.
```

> 132 characters max. This appears in search results and the store tile.

## Detailed Description

```
MarkBridge converts Confluence wiki pages to clean, well-formatted Markdown — instantly, with a single click.

FEATURES
• One-click conversion — Open any Confluence page, click the extension icon, and get Markdown in seconds
• Clean Markdown output — Produces well-structured GitHub Flavored Markdown with proper headings, lists, tables, and code blocks
• Image embedding — Downloads and embeds images as base64 so they render everywhere, no broken links
• Confluence macro support — Properly handles code blocks (with language detection), info/note/warning/tip panels, expand/collapse sections, task lists, status macros, user mentions, JIRA links, and emoticons
• YAML front matter — Optionally includes page metadata (title, space, author, labels, source URL)
• Copy or download — Copy to clipboard or download as a .md file

SUPPORTED VERSIONS
• Confluence Cloud (new & legacy editor)
• Confluence Server
• Confluence Data Center

PRIVACY-FIRST
MarkBridge processes everything locally in your browser. No data is sent to any server — ever. No analytics, no tracking, no accounts. Your Confluence content stays on your machine.

PERMISSIONS
• activeTab — Read the current page content when you click the extension icon
• scripting — Inject the content extraction script into Confluence pages
• storage — Save your local usage counter on your device

PERFECT FOR
• Developers who want docs-as-code from Confluence
• Teams migrating from Confluence to GitHub, Notion, or Obsidian
• Technical writers who need portable Markdown
• Anyone who prefers Markdown over Confluence's editor

Built with care for the Markdown community.
Website: https://markbridge.io
```

---

## Category

```
Productivity
```

## Language

```
English
```

---

## Store Assets Required

### Icon
- **128x128 PNG** — Already generated at `extension/icons/icon128.png`
- Must have no transparency (Chrome Web Store requirement for the tile)
- Consider creating a polished version with a design tool for the store

### Screenshots (required, 1–5)

Dimensions: **1280x800** or **640x400** (PNG or JPEG)

Capture these screenshots with Chrome DevTools (responsive mode):

1. **Popup on Confluence page** — Show the extension popup open on a real Confluence page with the "Confluence page detected" status. Title: "One-click Confluence to Markdown conversion"

2. **Conversion result** — Show the popup after a successful conversion with the Markdown preview visible, word/line count, and copy/download buttons. Title: "Clean, well-formatted Markdown output"

3. **Options panel** — Show the popup with all three options visible (front matter, title, image embedding). Title: "Customize your Markdown output"

4. **Before/After comparison** — Side-by-side of a Confluence page and the resulting Markdown. Title: "From messy HTML to clean Markdown"

5. **Privacy message** — Show the "No data leaves your browser" messaging. Title: "Privacy-first. Zero external requests."

### How to capture screenshots:

```bash
# 1. Load the extension in Chrome (developer mode)
# 2. Navigate to a sample Confluence page
# 3. Open the popup and use Chrome DevTools to screenshot:
#    - Right-click popup → Inspect
#    - Ctrl+Shift+P → "Capture screenshot"
# 4. For full-page screenshots, use a screen capture tool at 1280x800
```

### Promotional Images (optional but recommended)

- **Small tile**: 440x280 PNG — Used in the Chrome Web Store browse/search
- **Marquee**: 1400x560 PNG — Used if featured in the store

Design guidelines:
- Use the MarkBridge blue (#0052CC) as the primary brand color
- Show the before/after conversion visual from the website
- Include the MarkBridge logo and tagline
- Keep text minimal and readable

---

## Single Purpose Description

> Required by Chrome Web Store review. Explains the extension's single purpose.

```
This extension converts Confluence wiki pages to Markdown format. It reads the current page's content, converts it to clean Markdown using Turndown.js, and lets the user copy or download the result. All processing happens locally in the browser.
```

---

## Privacy Policy URL

```
https://markbridge.io/privacy.html
```

---

## Submission Checklist

- [ ] Developer account created ($5 one-time fee at https://chrome.google.com/webstore/devconsole)
- [ ] Extension ZIP built (`npm run package` in the extension directory)
- [ ] 128x128 icon ready (check for transparency issues)
- [ ] At least 1 screenshot at 1280x800 or 640x400
- [ ] Privacy policy published at https://markbridge.io/privacy.html
- [ ] All listing text filled in (name, summary, description)
- [ ] Category set to "Productivity"
- [ ] Single purpose description provided
- [ ] Test the extension on at least 3 different Confluence pages before submitting
- [ ] Verify the extension works without errors in a clean Chrome profile

---

## Post-Submission

- Review typically takes 1–3 business days
- Common rejection reasons:
  - Missing privacy policy
  - Description doesn't match actual functionality
  - Screenshots show content not in the extension
  - Permissions not justified
- After approval, the extension URL will be:
  `https://chromewebstore.google.com/detail/markbridge/[EXTENSION_ID]`
- Update the website CTA buttons with the real Chrome Web Store URL
