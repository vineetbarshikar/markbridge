# MarkBridge

**Convert Confluence wiki pages to clean Markdown with one click.**

MarkBridge is a Chrome extension that instantly converts Confluence pages into well-structured, GitHub Flavored Markdown. Whether you're migrating docs to GitHub, Notion, or Obsidian — or simply prefer Markdown over Confluence's editor — MarkBridge handles the heavy lifting, entirely within your browser.

Website: [markbridge.io](https://markbridge.io)  
Chrome Web Store: [Install MarkBridge](https://chromewebstore.google.com/detail/cjdccchapjhkeiglnaammmfnhjojelcg)

---

## Features

- **One-click conversion** — Open any Confluence page, click the extension icon, and get Markdown in seconds
- **Clean Markdown output** — Produces well-structured [GitHub Flavored Markdown](https://github.github.com/gfm/) with proper headings, lists, tables, and code blocks
- **Image embedding** — Downloads and embeds images as base64 so they render everywhere, no broken links
- **Confluence macro support** — Properly handles:
  - Code blocks (with language detection)
  - Info / Note / Warning / Tip panels → blockquotes
  - Expand/collapse sections → `<details>` tags
  - Task lists → checkbox syntax `- [ ]` / `- [x]`
  - Tables (including merged cells and header detection)
  - Status macros, user mentions, JIRA issue links, emoticons
- **YAML front matter** — Optionally includes page metadata (title, space, author, labels, source URL)
- **Copy or download** — Copy Markdown to clipboard or save as a `.md` file
- **Works everywhere** — Supports Confluence Cloud (new & legacy editor), Server, and Data Center
- **Privacy-first** — All processing happens locally in your browser. No data is sent to any server — ever.

---

## Project Structure

```
markbridge/
├── extension/                        # Chrome extension (Manifest V3)
│   ├── manifest.json                 # Extension configuration
│   ├── package.json                  # Dependencies and scripts
│   ├── popup/
│   │   ├── popup.html                # Extension popup UI
│   │   ├── popup.css                 # Popup styles
│   │   └── popup.js                  # Conversion logic, Turndown config, custom rules
│   ├── content-scripts/
│   │   └── confluence.js             # DOM extraction & Confluence preprocessing
│   ├── lib/
│   │   ├── turndown.js               # Turndown.js – HTML to Markdown converter
│   │   ├── turndown-plugin-gfm.js    # GFM plugin (tables, strikethrough, task lists)
│   │   └── analytics.js              # Local-only usage analytics
│   ├── icons/                        # Extension icons (16, 48, 128 px)
│   ├── scripts/
│   │   └── generate-icons.js         # Icon generation script
│   ├── store/
│   │   └── LISTING.md                # Chrome Web Store listing copy
│   └── dist/                         # Packaged extension ZIP
├── website/                          # Marketing / landing site
│   ├── index.html                    # Landing page
│   ├── privacy.html                  # Privacy policy
│   ├── styles.css                    # Site styles
│   └── script.js                     # Navigation, smooth scroll, contact form
└── README.md                         # This file
```

---

## Getting Started

### Prerequisites

- [Google Chrome](https://www.google.com/chrome/) (or any Chromium-based browser)
- [Node.js](https://nodejs.org/) (only required if you want to modify the source or regenerate icons)

### Installation (Developer Mode)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/vbarshikar/markbridge.git
   cd markbridge/extension
   ```

2. **Install dependencies** (optional — only needed if modifying source):

   ```bash
   npm install
   ```

3. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top-right corner)
   - Click **Load unpacked**
   - Select the `extension/` folder (the one containing `manifest.json`)

4. **Pin the extension** — Click the puzzle icon in Chrome's toolbar and pin "MarkBridge" for easy access.

---

## Usage

1. Navigate to any Confluence page in Chrome
2. Click the **MarkBridge** extension icon in the toolbar
3. The popup will automatically detect the Confluence page
4. (Optional) Toggle conversion options:
   - **Include YAML front matter** — adds a metadata header
   - **Include page title as H1** — adds the page title as a Markdown heading
   - **Embed images inline** — downloads images and embeds as base64 data URIs
5. Click **Convert to Markdown**
6. Review the preview, then:
   - Click **Copy** to copy to clipboard
   - Click **Download** to save as a `.md` file

### Supported Confluence Versions

| Version | Status |
|---|---|
| Confluence Cloud (new editor) | Fully supported |
| Confluence Cloud (legacy editor) | Fully supported |
| Confluence Server / Data Center | Supported (auto-injects content script) |

---

## How It Works

1. **Detection** — When you click the extension icon, the popup checks the current tab's URL for Confluence patterns
2. **Extraction** — A content script is injected that:
   - Finds the main content area using multiple selector strategies
   - Extracts the page title and metadata (author, space, labels)
   - Preprocesses Confluence-specific elements (macros, panels, code blocks, tables) into standard HTML
   - Optionally fetches and embeds images as base64 data URIs
3. **Conversion** — The preprocessed HTML is converted to Markdown using [Turndown.js](https://github.com/mixmark-io/turndown) with GitHub Flavored Markdown support and custom rules for Confluence elements
4. **Post-processing** — Cleans up whitespace, fixes escaped characters, normalizes formatting
5. **Output** — Displays a preview with word/line/image count, plus copy and download buttons

---

## Tech Stack

| Component | Technology |
|---|---|
| Extension | Chrome Extension Manifest V3 |
| HTML → Markdown | [Turndown.js](https://github.com/mixmark-io/turndown) 7.2.x |
| GFM support | [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) 1.0.2 |
| Website | Vanilla HTML, CSS, JavaScript |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| Build | npm scripts (no bundler required) |

---

## Permissions

This extension requests minimal permissions:

| Permission | Purpose |
|---|---|
| `activeTab` | Access the current tab's content when you click the extension icon |
| `scripting` | Inject the content extraction script into Confluence pages |
| `storage` | Save your local usage counter on your device |

**No data is sent anywhere.** All processing happens locally in your browser.

---

## Building for Distribution

To create a ZIP file for Chrome Web Store submission:

```bash
cd extension
npm run package
```

This creates `dist/markbridge.zip` containing only the files needed for the extension.

---

## Website

The `website/` directory contains the static marketing site hosted at [markbridge.io](https://markbridge.io). To serve it locally:

```bash
cd website
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

---

## Roadmap

- [ ] Batch export (multiple pages at once)
- [ ] Confluence space export (full space → folder of `.md` files)
- [ ] Image download and ZIP bundling (images as separate files)
- [ ] Custom Markdown templates
- [ ] Keyboard shortcut support
- [ ] Context menu integration (right-click → "Convert to Markdown")
- [x] Chrome Web Store publication

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

---

## Author

**Vineet Barshikar** — [markbridge.io](https://markbridge.io)
