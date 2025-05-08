try {
    importScripts(
        'turndown.js',
        'readability.js',
        'dompurify.js',
        'storage.js'
    );
} catch (e) {
    console.error('Failed to import scripts:', e);
}

const MAX_PAYLOAD_CHARS = 5000;
const MAX_EXTRACTION_SIZE_BYTES = 5 * 1024 * 1024;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ADD_CONTEXT') {
        handleAddContext(request.data, sender.tab)
            .then((result) => sendResponse({ success: true, ...result }))
            .catch((error) =>
                sendResponse({
                    success: false,
                    error: error.message,
                    reason: error.reason || 'unknown',
                })
            );
        return true;
    }
    if (request.type === 'INJECT_PREVIOUS_CONTEXT') {
        handleInjectPreviousContext(request.payload, request.autoSubmit)
            .then((result) => sendResponse({ success: true, ...result }))
            .catch((error) =>
                sendResponse({
                    success: false,
                    error: error.message,
                    reason: error.reason || 'unknown',
                })
            );
        return true;
    }
    if (request.type === 'GET_SETTINGS') {
        getSettings().then(sendResponse);
        return true;
    }
    if (request.type === 'SAVE_SETTINGS') {
        saveSettings(request.settings).then(() =>
            sendResponse({ success: true })
        );
        return true;
    }
    if (request.type === 'GET_HISTORY') {
        getContextHistory().then(sendResponse);
        return true;
    }
    if (request.type === 'UPDATE_HISTORY_ITEM') {
        updateContextInHistory(request.hash, request.updates).then((success) =>
            sendResponse({ success })
        );
        return true;
    }
    if (request.type === 'DELETE_HISTORY_ITEM') {
        deleteContextFromHistory(request.hash).then(() =>
            sendResponse({ success: true })
        );
        return true;
    }
    if (request.type === 'CLEAR_HISTORY') {
        clearHistory().then(() => sendResponse({ success: true }));
        return true;
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-sidebar') {
        chrome.tabs.query(
            { url: '*://chat.openai.com/*', active: true },
            (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'TOGGLE_SIDEBAR_VISIBILITY',
                    });
                }
            }
        );
    }
});

async function handleAddContext(data, sourceTab) {
    const settings = await getSettings();
    let { contextType, notes, autoSubmitOverride } = data;
    let pageTitle = sourceTab.title;
    let pageUrl = sourceTab.url;
    let domain = new URL(pageUrl).hostname;

    if (settings.blockListDomains) {
        try {
            if (new RegExp(settings.blockListDomains, 'i').test(domain)) {
                throw new Error(`Domain ${domain} is blocklisted.`);
            }
        } catch (e) {
            console.warn('Invalid blocklist regex:', settings.blockListDomains);
        }
    }

    let markdownContent = '';
    if (contextType === 'Selection') {
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: sourceTab.id },
            func: () => window.getSelection().toString(),
        });
        markdownContent =
            (injectionResults && injectionResults[0]?.result) || '';
        if (!markdownContent) throw new Error('Could not get selection.');
    } else if (contextType === 'Full page' || contextType === 'Summary') {
        const extractionResult = await extractPageContent(
            sourceTab.id,
            settings.stripAdsScripts
        );
        pageTitle = extractionResult.title || pageTitle;
        let htmlContent = extractionResult.content;

        if (
            new TextEncoder().encode(htmlContent).length >
                MAX_EXTRACTION_SIZE_BYTES &&
            contextType === 'Full page'
        ) {
            if (settings.summarizeWithApiKey && settings.openaiApiKey) {
                contextType = 'Summary';
            } else {
                throw new Error(
                    `Page content too large. Enable summarization or select text.`,
                    'size_exceeded_full'
                );
            }
        }

        if (contextType === 'Summary') {
            if (!settings.summarizeWithApiKey || !settings.openaiApiKey) {
                throw new Error(
                    'Summarization not enabled or API key missing.'
                );
            }
            markdownContent = await summarizeContent(
                htmlContent,
                settings.openaiApiKey,
                pageTitle
            );
        } else {
            markdownContent = new TurndownService().turndown(htmlContent);
        }
    }

    const payload = formatPayload(domain, pageTitle, notes, markdownContent);

    if (settings.persistContextHistory) {
        await addContextToHistory({
            url: pageUrl,
            title: pageTitle,
            notes: notes,
            markdownContent: markdownContent,
            type: contextType,
        });
    }

    return injectIntoChatGPT(
        payload,
        autoSubmitOverride !== undefined
            ? autoSubmitOverride
            : settings.autoSubmit,
        sourceTab.id
    );
}

async function handleInjectPreviousContext(payload, autoSubmit) {
    const settings = await getSettings(); // Needed for autoOpenChatGPT
    return injectIntoChatGPT(payload, autoSubmit, null); // sourceTabId not strictly needed if not copying to clipboard on failure
}

async function injectIntoChatGPT(
    payload,
    autoSubmitConfig,
    sourceTabIdForClipboardFallback
) {
    const settings = await getSettings();
    try {
        const chatGptTab = await findOrCreateChatGPTTab(
            settings.autoOpenChatGPT
        );
        if (!chatGptTab) {
            throw new Error(
                'Could not open or find ChatGPT tab.',
                'no_chatgpt_tab'
            );
        }

        const probeResponse = await chrome.tabs.sendMessage(chatGptTab.id, {
            type: 'PROBE_CHATGPT',
        });
        if (!probeResponse || !probeResponse.canInject) {
            const reason = probeResponse?.reason;
            let userMessage = 'ChatGPT tab not ready.';
            if (reason === 'login') userMessage = 'Please log in to ChatGPT.';
            else if (reason === 'selector')
                userMessage = 'ChatGPT UI might have changed.';
            throw new Error(userMessage, reason);
        }

        await chrome.tabs.sendMessage(chatGptTab.id, {
            type: 'INJECT_CONTENT',
            payload: payload,
            autoSubmit: autoSubmitConfig,
        });
        return {
            chatGptTabId: chatGptTab.id,
            message: 'Context sent to ChatGPT.',
        };
    } catch (e) {
        console.error(
            'Error during ChatGPT interaction:',
            e.message,
            'Reason:',
            e.reason
        );
        if (
            sourceTabIdForClipboardFallback &&
            (e.reason === 'login' ||
                e.reason === 'selector' ||
                e.reason === 'no_chatgpt_tab' ||
                e.reason === 'probe_failed')
        ) {
            await copyToClipboard(payload, sourceTabIdForClipboardFallback);
            throw new Error(
                `${e.message} Content copied to clipboard.`,
                e.reason
            );
        }
        throw e;
    }
}

async function extractPageContent(tabId, stripScriptsAds) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['readability.js', 'dompurify.js'],
            func: (shouldStrip) => {
                let docClone = document.cloneNode(true);
                if (shouldStrip) {
                    Array.from(
                        docClone.querySelectorAll(
                            'script, style, iframe, link[rel="stylesheet"]'
                        )
                    ).forEach((el) => el.remove());
                }
                const article = new Readability(docClone).parse();
                return { title: article.title, content: article.content };
            },
            args: [stripScriptsAds],
        });
        if (results && results[0]?.result) return results[0].result;
        throw new Error('Readability extraction failed.');
    } catch (e) {
        const fallbackResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => ({
                title: document.title,
                content: document.body.innerHTML,
            }),
        });
        if (fallbackResults && fallbackResults[0]?.result)
            return fallbackResults[0].result;
        throw new Error('Page content extraction failed.');
    }
}

async function summarizeContent(htmlContent, apiKey, pageTitle = 'this page') {
    const textContent = new TurndownService()
        .turndown(htmlContent)
        .replace(/\s+/g, ' ')
        .trim();
    const prompt = `Summarize concisely for context: "${pageTitle}"\n\n"${textContent.substring(
        0,
        15000
    )}"`;

    try {
        const response = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 300,
                }),
            }
        );
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                `OpenAI API: ${response.status} ${
                    errorData.error?.message || ''
                }`
            );
        }
        const data = await response.json();
        return (
            data.choices[0]?.message?.content?.trim() ||
            'Summary not available.'
        );
    } catch (error) {
        throw new Error(`Failed to summarize: ${error.message}`);
    }
}

function formatPayload(domain, title, userNotes, markdownContent) {
    let content = `--- Context from ${domain} ---\nTitle: ${title}\n`;
    if (userNotes?.trim()) content += `Notes: ${userNotes}\n`;
    content += `---\n${markdownContent}`;
    if (content.length > MAX_PAYLOAD_CHARS) {
        content =
            content.substring(0, MAX_PAYLOAD_CHARS - 15) + '...[truncated]';
    }
    return content;
}

async function findOrCreateChatGPTTab(autoOpen) {
    let tabs = await chrome.tabs.query({ url: '*://chat.openai.com/*' });
    let chatGptTab = tabs.find((tab) =>
        tab.url.startsWith('https://chat.openai.com/')
    );

    if (chatGptTab) {
        await chrome.tabs.update(chatGptTab.id, { active: true });
        await chrome.windows.update(chatGptTab.windowId, { focused: true });
        if (chatGptTab.status !== 'complete') {
            await new Promise((resolve) => {
                const listener = (tabId, info) => {
                    if (tabId === chatGptTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }
        return chatGptTab;
    } else if (autoOpen) {
        chatGptTab = await chrome.tabs.create({
            url: 'https://chat.openai.com/chat',
            active: true,
        });
        await new Promise((resolve) => {
            const listener = (id, info, tab) => {
                if (id === chatGptTab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve(tab);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
        return chatGptTab;
    }
    return null;
}

async function copyToClipboard(text, tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (content) => navigator.clipboard.writeText(content),
            args: [text],
        });
        return true;
    } catch (e) {
        return false;
    }
}
