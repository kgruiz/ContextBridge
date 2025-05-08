# ContextBridge for ChatGPT

## Overview

ContextBridge is a powerful Chrome extension designed to streamline your workflow with ChatGPT. It allows you to effortlessly push content from any webpage or selected text directly into your ChatGPT conversations as structured, easy-to-read context. Say goodbye to manual copy-pasting and hello to enhanced productivity.

With ContextBridge, you can quickly provide ChatGPT with the necessary background information from articles, documents, or any online source, enabling more informed and relevant interactions.

## Features

* **Seamless Context Injection:** Send full webpage content, selected text, or an AI-generated summary to ChatGPT with a few clicks.
* **Structured Formatting:** Context is automatically formatted with clear headers (source, title, user notes) for optimal readability within ChatGPT.
* **ChatGPT Tab Management:**
  * Automatically locates an open ChatGPT tab.
  * Opens a new ChatGPT tab if one isn't available (configurable).
* **Content Processing:**
  * Utilizes Mozilla's Readability.js for clean, article-focused content extraction.
  * Converts HTML to Markdown using Turndown.js for a clean input to ChatGPT.
  * Optional AI-powered summarization via OpenAI API (requires user-provided API key).
  * Attempts to strip ads and unnecessary scripts for cleaner context (configurable).
* **In-ChatGPT Sidebar History:**
  * Access a history of your sent contexts directly within the ChatGPT interface.
  * Hotkey `Ctrl+Shift+H` (or `Cmd+Shift+H` on Mac) to toggle the sidebar.
  * Features: search, re-inject, edit notes, pin, and delete history items.
* **User Configuration:**
  * Comprehensive settings page to customize behavior (auto-open, auto-submit, summarization, blocklists, etc.).
  * Blocklist domains using regular expressions to prevent accidental context sending from specific sites.
* **Robust Error Handling:**
  * Provides clear feedback for common issues (e.g., ChatGPT login required, UI changes).
  * Fallback to copying context to clipboard if direct injection fails.
* **Security & Privacy Focused:**
  * All user data (settings, history, API key) is stored locally using `chrome.storage.local`.
  * No telemetry or external data collection by the extension itself (OpenAI API calls for summarization are user-initiated and direct).
  * Uses DOMPurify for sanitizing HTML content during extraction.

## Installation

1. **Download the Extension:**
    * Clone the repository: `git clone https://github.com/kgruiz/ContextBridge.git`
    * Alternatively, download the source code as a ZIP file from [https://github.com/kgruiz/ContextBridge](https://github.com/kgruiz/ContextBridge) and extract it.
    * Ensure you have the following external libraries in the root directory of the extension (these are typically included or you may need to download them separately if not bundled):
        * `readability.js` (from Mozilla)
        * `turndown.js`
        * `dompurify.js`

2. **Load in Chrome:**
    * Open Google Chrome and navigate to `chrome://extensions/`.
    * Enable "Developer mode" using the toggle switch (usually in the top-right corner).
    * Click the "Load unpacked" button.
    * Select the directory where you cloned/extracted the ContextBridge extension files.

3. **Verify Installation:**
    * The ContextBridge icon should appear in your Chrome toolbar.
    * You can now start using the extension.

## Usage

1. **Open a Webpage:** Navigate to the webpage from which you want to send context.
2. **Click the ContextBridge Icon:** This will open the extension's popup.
3. **Choose Context Type:**
    * **Full page:** Sends the main content of the current page.
    * **Selection:** Sends only the text you have selected on the page (this option is enabled only if text is selected).
    * **Summary:** Sends an AI-generated summary of the page (requires OpenAI API key configured in settings).
4. **Add Optional Notes:** Enter any relevant notes you want to include with the context.
5. **Click "➕ Add to ChatGPT":**
    * ContextBridge will process the content and find/open a ChatGPT tab.
    * The structured context will be injected into the ChatGPT prompt input area.
    * A toast notification will confirm the action.

### Sidebar Usage (within ChatGPT)

* **Toggle:** Press `Ctrl+Shift+H` (Windows/Linux) or `Cmd+Shift+H` (Mac), or click the "CB" tab button on the right edge of the ChatGPT page.
* **Functionality:**
  * **Search:** Filter your context history.
  * **Inject (▶️ or similar icon):** Re-injects the selected history item into the current ChatGPT prompt.
  * **Edit (✏️):** Modify the notes associated with a history item.
  * **Pin (📌/📍):** Pin important items to the top (visual cue, sorting may vary).
  * **Delete (🗑️):** Remove an item from the history.
  * **Clear All (🗑️ All):** Deletes all items from the history.

### Settings

* Access the settings page via the "⚙️ Settings" button in the popup or by right-clicking the extension icon and choosing "Options" (if available).
* **Available Settings:**
  * `Auto-open ChatGPT tab`: If a ChatGPT tab isn't found, create one.
  * `Auto-submit after inject`: Automatically press "Send" in ChatGPT after context is added.
  * `Enable page summarization`: Activates the summary feature.
  * `OpenAI API Key`: Your personal key for the summarization feature.
  * `Attempt to strip ads/scripts`: Use Readability.js to clean content.
  * `Persist context history`: Save history across browser sessions.
  * `Max history items`: Control the size of the stored history.
  * `Blocklist domains`: Prevent context extraction from specified domains (supports regex).

## Technical Details

* **Manifest Version:** 3
* **Permissions:** `tabs`, `activeTab`, `scripting`, `storage`
* **Host Permissions:** `https://chat.openai.com/*`, `https://api.openai.com/*`, `<all_urls>`
* **Key Libraries:** Readability.js, Turndown.js, DOMPurify.js

## Known Limitations & Considerations

* **ChatGPT UI Changes:** The extension relies on specific DOM selectors within ChatGPT's interface (e.g., for the prompt textarea). If OpenAI updates its UI, these selectors may break, potentially requiring an update to the extension. The extension includes basic error handling for this ("Chat UI changed").
* **Content Extraction Quality:** While Readability.js is excellent, the quality of extracted content can vary depending on website structure.
* **Summarization Costs:** Using the summarization feature will incur costs on your OpenAI API account based on token usage.
* **Large Pages:** Very large web pages might take longer to process or hit size limits for injection/summarization.

## Contributing

Contributions, bug reports, and feature requests are welcome! Please feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/kgruiz/ContextBridge).

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

---

**Disclaimer:** This extension is a third-party tool and is not officially affiliated with or endorsed by OpenAI. Use of the OpenAI API for summarization is subject to OpenAI's terms of service and pricing.
