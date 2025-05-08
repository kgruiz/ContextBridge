document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('contextForm');
    const addBtn = document.getElementById('addToChatGPT');
    const settingsBtn = document.getElementById('settingsBtn');
    const urlSpan = document.getElementById('currentUrl');
    const statusDiv = document.getElementById('statusMessage');
    const summaryRadio = document.getElementById('typeSummary');
    const summaryWarning = document.getElementById('summaryApiKeyWarning');
    const selectionRadio = document.getElementById('typeSelection');

    let currentTab;
    let settings = await getSettings();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            currentTab = tabs[0];
            try {
                const url = new URL(currentTab.url);
                urlSpan.textContent =
                    url.hostname +
                    (url.pathname.length > 1
                        ? url.pathname.substring(0, 30) + '...'
                        : '');
                if (url.protocol === 'chrome:' || url.protocol === 'about:') {
                    addBtn.disabled = true;
                    statusDiv.textContent =
                        'Cannot process special browser pages.';
                    statusDiv.className = 'status error';
                }
            } catch (e) {
                urlSpan.textContent = 'Invalid URL';
                addBtn.disabled = true;
            }
        } else {
            urlSpan.textContent = 'N/A';
            addBtn.disabled = true;
        }

        chrome.scripting.executeScript(
            {
                target: { tabId: currentTab.id },
                func: () => window.getSelection().toString(),
            },
            (results) => {
                selectionRadio.disabled = !results || !results[0]?.result;
                if (selectionRadio.disabled)
                    document.querySelector('label[for="typeSelection"]').title =
                        'Select text on page first.';
            }
        );
    });

    if (!settings.summarizeWithApiKey || !settings.openaiApiKey) {
        summaryWarning.style.display = 'inline';
        summaryRadio.addEventListener('change', () => {
            if (summaryRadio.checked) {
                statusDiv.textContent =
                    'API Key for summary missing in settings.';
                statusDiv.className = 'status warning';
            } else {
                statusDiv.textContent = '';
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (addBtn.disabled || !currentTab) return;

        const contextType = document.querySelector(
            'input[name="contextType"]:checked'
        ).value;
        const notes = document.getElementById('notes').value;

        addBtn.disabled = true;
        addBtn.textContent = 'Processing...';
        statusDiv.textContent = '';
        statusDiv.className = 'status';

        if (
            contextType === 'Summary' &&
            (!settings.summarizeWithApiKey || !settings.openaiApiKey)
        ) {
            statusDiv.textContent = 'Summary requires API key in Settings.';
            statusDiv.className = 'status error';
            addBtn.disabled = false;
            addBtn.textContent = '➕ Add to ChatGPT';
            return;
        }

        chrome.runtime.sendMessage(
            { type: 'ADD_CONTEXT', data: { contextType, notes } },
            (response) => {
                if (chrome.runtime.lastError) {
                    statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
                    statusDiv.className = 'status error';
                } else if (response?.success) {
                    statusDiv.textContent =
                        response.message || 'Context added!';
                    statusDiv.className = 'status success';
                    setTimeout(() => window.close(), 1500);
                } else if (response && !response.success) {
                    let msg = `Failed: ${response.error || 'Unknown error'}`;
                    if (
                        [
                            'login',
                            'selector',
                            'size_exceeded_full',
                            'probe_failed',
                        ].includes(response.reason)
                    ) {
                        msg += ' Content copied to clipboard.';
                    }
                    statusDiv.textContent = msg;
                    statusDiv.className = 'status error';
                    if (response.reason === 'login') {
                        const openChatBtn = document.createElement('button');
                        openChatBtn.textContent = 'Open ChatGPT';
                        openChatBtn.onclick = () =>
                            chrome.tabs.create({
                                url: 'https://chat.openai.com/chat',
                            });
                        statusDiv.appendChild(document.createElement('br'));
                        statusDiv.appendChild(openChatBtn);
                    }
                }
                addBtn.disabled = false;
                addBtn.textContent = '➕ Add to ChatGPT';
            }
        );
    });

    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage
            ? chrome.runtime.openOptionsPage()
            : chrome.tabs.create({ url: 'settings.html' });
    });
});
