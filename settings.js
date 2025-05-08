document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const autoOpenCb = document.getElementById('autoOpenChatGPT');
    const autoSubmitCb = document.getElementById('autoSubmit');
    const summarizeCb = document.getElementById('summarizeWithApiKey');
    const apiKeyInput = document.getElementById('openaiApiKey');
    const apiKeySection = document.getElementById('apiKeySection');
    const stripCb = document.getElementById('stripAdsScripts');
    const persistCb = document.getElementById('persistContextHistory');
    const maxHistInput = document.getElementById('maxHistoryItems');
    const maxHistSection = document.getElementById('maxHistorySection');
    const blockListTa = document.getElementById('blockListDomains');
    const statusDiv = document.getElementById('statusMessage');

    const s = await getSettings();
    autoOpenCb.checked = s.autoOpenChatGPT;
    autoSubmitCb.checked = s.autoSubmit;
    summarizeCb.checked = s.summarizeWithApiKey;
    apiKeyInput.value = s.openaiApiKey || '';
    stripCb.checked = s.stripAdsScripts;
    persistCb.checked = s.persistContextHistory;
    maxHistInput.value = s.maxHistoryItems || 100;
    blockListTa.value = s.blockListDomains || '';

    function toggleDeps() {
        apiKeySection.style.display = summarizeCb.checked ? 'flex' : 'none';
        maxHistSection.style.display = persistCb.checked ? 'flex' : 'none';
    }
    summarizeCb.addEventListener('change', toggleDeps);
    persistCb.addEventListener('change', toggleDeps);
    toggleDeps();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        statusDiv.textContent = '';
        statusDiv.className = 'status';
        const newSettings = {
            autoOpenChatGPT: autoOpenCb.checked,
            autoSubmit: autoSubmitCb.checked,
            summarizeWithApiKey: summarizeCb.checked,
            openaiApiKey: apiKeyInput.value.trim(),
            stripAdsScripts: stripCb.checked,
            persistContextHistory: persistCb.checked,
            maxHistoryItems: parseInt(maxHistInput.value, 10) || 100,
            blockListDomains: blockListTa.value.trim(),
        };
        if (newSettings.blockListDomains) {
            try {
                new RegExp(newSettings.blockListDomains);
            } catch (err) {
                statusDiv.textContent = 'Error: Invalid Regex in blocklist.';
                statusDiv.className = 'status error';
                return;
            }
        }
        await saveSettings(newSettings);
        statusDiv.textContent = 'Settings saved!';
        statusDiv.className = 'status success';
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 2000);
    });
});
