# MarkBridge

A Chrome extension that converts Confluence wiki pages to clean, well-formatted Markdown with one click. Learn more at [markbridge.io](https://markbridge.io).

## Features

- **One-click conversion** – Open any Confluence page and click the extension icon
- **Clean Markdown output** – Produces well-structured Markdown using [GitHub Flavored Markdown](https://github.github.com/gfm/)
- **Image embedding** – Downloads and embeds images as base64 so they render everywhere
- **Confluence macro support** – Properly handles:
  - Code blocks (with language detection)
  - Info / Note / Warning / Tip panels → blockquotes
  - Expand/collapse sections → `<details>` tags
  - Task lists → checkbox syntax `- [ ]` / `- [x]`
  - Tables (including Confluence-style headers, merged cells)
  - Status macros → inline code badges
  - User mentions → `@name`
  - JIRA issue links → preserved as links
  - Emoticons → text equivalents
- **YAML front matter** – Optionally includes metadata (title, space, author, labels, source URL)
- **Works everywhere** – Supports Confluence Cloud, Server, and Data Center
- **Copy or download** – Copy Markdown to clipboard or download as `.md` file
- **Privacy-first** – No data leaves your browser. Zero external requests.

## Installation (Developer Mode)

Since this extension is not yet on the Chrome Web Store, install it in developer mode:

1. **Clone or download** this repository:

   ```bash
   git clone <repo-url>
   cd markbridge/extension
   ```

2. **Install dependencies** (only needed if you want to modify the source):

   ```bash
   npm install
   ```

3. **Generate icons** (already included, but you can regenerate):

   ```bash
   npm run generate-icons
   ```

4. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top-right corner)
   - Click **Load unpacked**
   - Select the `markbridge/extension` folder (the one containing `manifest.json`)

5. **Pin the extension** – Click the puzzle icon in Chrome's toolbar and pin "MarkBridge" for easy access.

## Usage

1. Navigate to any Confluence page in Chrome
2. Click the **MarkBridge** extension icon in the toolbar
3. The popup will detect the Confluence page automatically
4. (Optional) Toggle options:
   - **Include YAML front matter** – adds metadata header
   - **Include page title as H1** – adds the page title as a Markdown heading
   - **Embed images inline** – downloads images and embeds as base64 data URIs
5. Click **Convert to Markdown**
6. Review the preview, then:
   - Click **Copy** to copy to clipboard
   - Click **Download** to save as a `.md` file

## Supported Confluence Versions

| Version | Status |
|---|---|
| Confluence Cloud (new editor) | Fully supported |
| Confluence Cloud (legacy editor) | Fully supported |
| Confluence Server / Data Center | Supported (auto-injects content script) |

## Project Structure

```
markbridge/
└── extension/
    ├── manifest.json              # Chrome Extension Manifest V3
    ├── popup/
    │   ├── popup.html             # Extension popup UI
    │   ├── popup.css              # Popup styles
    │   └── popup.js               # Popup logic, Turndown config, custom rules
    ├── content-scripts/
    │   └── confluence.js          # Confluence DOM extraction & preprocessing
    ├── lib/
    │   ├── turndown.js            # Turndown.js – HTML to Markdown converter
    │   └── turndown-plugin-gfm.js # GFM plugin (tables, strikethrough, etc.)
    ├── icons/
    │   ├── icon16.png             # Toolbar icon
    │   ├── icon48.png             # Extensions page icon
    │   └── icon128.png            # Chrome Web Store icon
    ├── scripts/
    │   └── generate-icons.js      # Icon generation script
    ├── package.json               # Node.js package config
    └── README.md                  # This file
```

## How It Works

1. **Detection** – When you click the extension icon, the popup checks the current tab's URL for Confluence patterns
2. **Extraction** – A content script is injected (or messaged if already loaded) that:
   - Finds the main content area using multiple selector strategies
   - Extracts the page title and metadata (author, space, labels)
   - Preprocesses Confluence-specific elements (macros, panels, code blocks, tables) into standard HTML
   - Optionally fetches and embeds images as base64 data URIs
3. **Conversion** – The preprocessed HTML is converted to Markdown using [Turndown.js](https://github.com/mixmark-io/turndown) with:
   - GitHub Flavored Markdown support (tables, task lists, strikethrough)
   - Custom rules for Confluence-specific elements
4. **Post-processing** – Cleans up whitespace, fixes escaped characters, normalizes formatting
5. **Output** – Displays a preview with word/line/image count, plus copy and download buttons

## Permissions

This extension requests minimal permissions:

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab's content when you click the extension icon |
| `scripting` | Inject the content extraction script into Confluence pages |

**No data is sent anywhere.** All processing happens locally in your browser.

## Building for Distribution

To create a ZIP file for Chrome Web Store submission:

```bash
npm run package
```

This creates `dist/markbridge.zip` containing only the files needed for the extension.

## Roadmap

- [ ] Batch export (multiple pages at once)
- [ ] Confluence space export (full space → folder of `.md` files)
- [ ] Image download & bundling (ZIP with images as separate files)
- [ ] Custom Markdown templates
- [ ] Keyboard shortcut support
- [ ] Context menu integration (right-click → "Convert to Markdown")
- [ ] Chrome Web Store publication

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
