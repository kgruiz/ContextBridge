const DEFAULT_SETTINGS = {
    autoOpenChatGPT: true,
    autoSubmit: false,
    summarizeWithApiKey: false,
    openaiApiKey: '',
    stripAdsScripts: true,
    blockListDomains: '',
    persistContextHistory: true,
    maxHistoryItems: 100,
};

const CONTEXT_HISTORY_KEY = 'contextHistory';
const SETTINGS_KEY = 'contextBridgeSettings';

export async function getSettings() {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

export async function saveSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getContextHistory() {
    if (!(await getSettings()).persistContextHistory) return [];
    const data = await chrome.storage.local.get(CONTEXT_HISTORY_KEY);
    return data[CONTEXT_HISTORY_KEY] || [];
}

export async function saveContextHistory(history) {
    const settings = await getSettings();
    if (!settings.persistContextHistory) {
        await chrome.storage.local.remove(CONTEXT_HISTORY_KEY);
        return;
    }
    const limitedHistory = history.slice(-settings.maxHistoryItems);
    await chrome.storage.local.set({ [CONTEXT_HISTORY_KEY]: limitedHistory });
}

export async function addContextToHistory(item) {
    const settings = await getSettings();
    if (!settings.persistContextHistory) return;

    const history = await getContextHistory();
    const newItemHash =
        item.hash ||
        `${item.url}-${(item.notes || item.title || '').substring(0, 100)}`;
    const existingIndex = history.findIndex((h) => h.hash === newItemHash);

    if (existingIndex > -1 && item.hash) {
        history[existingIndex] = {
            ...history[existingIndex],
            ...item,
            ts: Date.now(),
        };
    } else {
        history.push({
            ...item,
            ts: Date.now(),
            pinned: false,
            hash: newItemHash,
        });
    }
    await saveContextHistory(history);
}

export async function updateContextInHistory(hash, updates) {
    let history = await getContextHistory();
    const itemIndex = history.findIndex((item) => item.hash === hash);
    if (itemIndex > -1) {
        history[itemIndex] = {
            ...history[itemIndex],
            ...updates,
            ts: Date.now(),
        };
        await saveContextHistory(history);
        return true;
    }
    return false;
}

export async function deleteContextFromHistory(hash) {
    let history = await getContextHistory();
    history = history.filter((item) => item.hash !== hash);
    await saveContextHistory(history);
}

export async function clearHistory() {
    await saveContextHistory([]);
}

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        const currentSettings = await chrome.storage.local.get(SETTINGS_KEY);
        if (!currentSettings[SETTINGS_KEY]) {
            await saveSettings(DEFAULT_SETTINGS);
        }
    }
});
