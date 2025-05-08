document.addEventListener('DOMContentLoaded', () => {
    const historyListDiv = document.getElementById('historyList');
    const searchInput = document.getElementById('historySearch');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const editModal = document.getElementById('editModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const editNotesTextarea = document.getElementById('editNotesTextarea');
    const saveEditBtn = document.getElementById('saveEditBtn');
    const editHashInput = document.getElementById('editHash');

    async function loadHistory(searchTerm = '') {
        chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (history) => {
            if (chrome.runtime.lastError) {
                historyListDiv.innerHTML =
                    '<p class="error-message">Error loading history.</p>';
                return;
            }
            historyListDiv.innerHTML = '';
            if (!history || history.length === 0) {
                historyListDiv.innerHTML =
                    '<p class="empty-message">No history yet.</p>';
                return;
            }

            const filteredHistory = history
                .filter((item) => {
                    const s = searchTerm.toLowerCase();
                    return (
                        item.title?.toLowerCase().includes(s) ||
                        item.url?.toLowerCase().includes(s) ||
                        item.notes?.toLowerCase().includes(s) ||
                        item.markdownContent?.toLowerCase().includes(s)
                    );
                })
                .sort((a, b) => b.ts - a.ts);

            if (filteredHistory.length === 0) {
                historyListDiv.innerHTML = `<p class="empty-message">No items match${
                    searchTerm ? ' search' : ''
                }.</p>`;
                return;
            }

            filteredHistory.forEach((item) => {
                const itemDiv = document.createElement('div');
                itemDiv.className =
                    'history-item' + (item.pinned ? ' pinned' : '');
                itemDiv.dataset.hash = item.hash;
                let domain;
                try {
                    domain = new URL(item.url).hostname;
                } catch (e) {
                    domain = 'Invalid URL';
                }
                itemDiv.innerHTML = `
            <div class="item-header"><img src="https://www.google.com/s2/favicons?sz=16&domain_url=${domain}" alt="" class="favicon"><strong class="item-title" title="${
                    item.title
                }">${
                    item.title?.substring(0, 50) +
                        (item.title?.length > 50 ? '...' : '') || 'No Title'
                }</strong></div>
            <div class="item-meta"><span class="item-domain" title="${
                item.url
            }">${domain}</span><span class="item-timestamp">${new Date(
                    item.ts
                ).toLocaleString()}</span></div>
            ${
                item.notes
                    ? `<p class="item-notes">${
                          item.notes.substring(0, 100) +
                          (item.notes.length > 100 ? '...' : '')
                      }</p>`
                    : ''
            }
            <div class="item-actions"><button class="action-btn inject-btn" title="Inject">➤</button><button class="action-btn edit-btn" title="Edit Notes">✏️</button><button class="action-btn pin-btn" title="${
                item.pinned ? 'Unpin' : 'Pin'
            }">${
                    item.pinned ? '📌' : '📍'
                }</button><button class="action-btn delete-btn" title="Delete">🗑️</button></div>`;
                historyListDiv.appendChild(itemDiv);
            });
        });
    }

    historyListDiv.addEventListener('click', async (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const itemDiv = target.closest('.history-item');
        const hash = itemDiv.dataset.hash;
        const history = await new Promise((resolve) =>
            chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, resolve)
        );
        const currentItem = history.find((itm) => itm.hash === hash);
        if (!currentItem) return;

        if (target.classList.contains('inject-btn')) {
            const settings = await new Promise((resolve) =>
                chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve)
            );
            let domain;
            try {
                domain = new URL(currentItem.url).hostname;
            } catch (e) {
                domain = 'hist';
            }
            let payload = `--- Context from ${domain} (History) ---\nTitle: ${currentItem.title}\n`;
            if (currentItem.notes?.trim())
                payload += `Notes: ${currentItem.notes}\n`;
            payload += `---\n${currentItem.markdownContent}`;
            if (payload.length > 5000)
                payload = payload.substring(0, 5000 - 15) + '...[truncated]';
            chrome.runtime.sendMessage(
                {
                    type: 'INJECT_PREVIOUS_CONTEXT',
                    payload: payload,
                    autoSubmit: settings.autoSubmit,
                },
                (response) => {
                    if (!response?.success)
                        alert('Failed to re-inject: ' + response?.error);
                }
            );
        } else if (target.classList.contains('edit-btn')) {
            editHashInput.value = hash;
            editNotesTextarea.value = currentItem.notes || '';
            editModal.style.display = 'block';
        } else if (target.classList.contains('pin-btn')) {
            chrome.runtime.sendMessage(
                {
                    type: 'UPDATE_HISTORY_ITEM',
                    hash,
                    updates: { pinned: !currentItem.pinned },
                },
                (r) => {
                    if (r.success) loadHistory(searchInput.value);
                }
            );
        } else if (target.classList.contains('delete-btn')) {
            if (confirm('Delete this history item?')) {
                chrome.runtime.sendMessage(
                    { type: 'DELETE_HISTORY_ITEM', hash },
                    (r) => {
                        if (r.success) loadHistory(searchInput.value);
                    }
                );
            }
        }
    });

    saveEditBtn.onclick = () => {
        chrome.runtime.sendMessage(
            {
                type: 'UPDATE_HISTORY_ITEM',
                hash: editHashInput.value,
                updates: { notes: editNotesTextarea.value },
            },
            (r) => {
                if (r.success) {
                    editModal.style.display = 'none';
                    loadHistory(searchInput.value);
                } else {
                    alert('Failed to save.');
                }
            }
        );
    };
    closeModalBtn.onclick = () => (editModal.style.display = 'none');
    window.onclick = (event) => {
        if (event.target == editModal) editModal.style.display = 'none';
    };
    searchInput.addEventListener('input', (e) => loadHistory(e.target.value));
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear ALL history?'))
            chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, (r) => {
                if (r.success) loadHistory();
            });
    });
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'SIDEBAR_ACTIVATED')
            loadHistory(searchInput.value);
    });
    loadHistory();
});
