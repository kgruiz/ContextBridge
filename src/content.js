import DOMPurify from 'dompurify';

let sidebarVisible = false;
let sidebarIframe = null;
let lastInjectedPayload = '';
let editorPreviousValue = '';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PROBE_CHATGPT') {
        const editor = document.querySelector('#prompt-textarea');
        const dialog = document.querySelector(
            'div[role="dialog"][data-state="open"]'
        );
        let needsLogin = false;
        if (dialog) {
            for (let btn of dialog.querySelectorAll('button')) {
                if (/(log in|sign up)/i.test(btn.textContent || '')) {
                    needsLogin = true;
                    break;
                }
            }
        }
        sendResponse({
            canInject: !!editor && !needsLogin,
            reason: needsLogin ? 'login' : editor ? null : 'selector',
        });
        return true;
    } else if (request.type === 'INJECT_CONTENT') {
        editorPreviousValue =
            document.querySelector('#prompt-textarea')?.value || '';
        lastInjectedPayload = request.payload;
        injectText(request.payload, request.autoSubmit);
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'TOGGLE_SIDEBAR_VISIBILITY') {
        toggleSidebar();
        sendResponse({ success: true, visible: sidebarVisible });
    }
});

function injectText(payload, autoSubmit) {
    const editor = document.querySelector('#prompt-textarea'); // Fragile selector
    if (!editor) {
        showToast('Error: ChatGPT textarea not found.', 'error');
        if (navigator.clipboard)
            navigator.clipboard
                .writeText(payload)
                .then(() =>
                    showToast('Textarea not found. Content copied.', 'warning')
                );
        return;
    }

    editor.focus();
    editor.value = payload;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.style.height = 'auto';
    editor.style.height = editor.scrollHeight + 'px';
    editor.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showToast('Context added', 'success', true);

    if (autoSubmit) {
        const submitButton = editor
            .closest('form')
            ?.querySelector(
                'button[type="submit"], button:has(svg[data-icon="paper-airplane"])'
            );
        if (submitButton && !submitButton.disabled) submitButton.click();
        else showToast('Auto-submit failed: Button not found.', 'warning');
    }
}

let toastTimeout;
function showToast(message, type = 'info', showUndo = false) {
    let toast = document.getElementById('contextBridgeToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'contextBridgeToast';
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: '5px',
            color: 'white',
            zIndex: '99999',
            fontSize: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            opacity: '0',
            transition: 'opacity 0.3s ease, bottom 0.3s ease',
        });
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.backgroundColor =
        type === 'error'
            ? '#d32f2f'
            : type === 'success'
            ? '#388e3c'
            : type === 'warning'
            ? '#ffa000'
            : '#1976d2';

    if (showUndo) {
        const undoButton = document.createElement('button');
        undoButton.textContent = 'Undo';
        Object.assign(undoButton.style, {
            marginLeft: '10px',
            padding: '3px 8px',
            border: '1px solid white',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '3px',
        });
        undoButton.onclick = () => {
            const editor = document.querySelector('#prompt-textarea');
            if (editor && editor.value.includes(lastInjectedPayload)) {
                editor.value = editorPreviousValue;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                editor.dispatchEvent(new Event('change', { bubbles: true }));
                editor.style.height = 'auto';
                editor.style.height = editor.scrollHeight + 'px';
                showToast('Injection undone.', 'info');
            } else {
                showToast('Undo failed or content changed.', 'warning');
            }
            toast.style.opacity = '0';
            toast.style.bottom = '-50px';
        };
        toast.appendChild(undoButton);
    }

    toast.style.opacity = '1';
    toast.style.bottom = '20px';
    clearTimeout(toastTimeout);
    if (!showUndo || type !== 'success') {
        toastTimeout = setTimeout(
            () => {
                toast.style.opacity = '0';
                toast.style.bottom = '-50px';
                if (showUndo && toast.contains(toast.querySelector('button')))
                    toast.innerHTML = message;
            },
            showUndo && type === 'success' ? 8000 : 4000
        );
    }
}

function createSidebar() {
    if (document.getElementById('contextBridgeSidebar')) return;
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = 'contextBridgeSidebar';
    sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
    sidebarIframe.style.display = 'none';
    document.body.appendChild(sidebarIframe);

    const toggleButton = document.createElement('button');
    toggleButton.id = 'contextBridgeSidebarToggle';
    toggleButton.textContent = 'CB';
    Object.assign(toggleButton.style, {
        position: 'fixed',
        top: '100px',
        right: '0px',
        zIndex: '9998',
        padding: '8px',
        backgroundColor: '#1a73e8',
        color: 'white',
        border: 'none',
        borderTopLeftRadius: '5px',
        borderBottomLeftRadius: '5px',
        cursor: 'pointer',
        boxShadow: '-2px 2px 5px rgba(0,0,0,0.2)',
        fontSize: '12px',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
    });
    toggleButton.onclick = toggleSidebar;
    document.body.appendChild(toggleButton);
}

function toggleSidebar() {
    if (!sidebarIframe) createSidebar();
    sidebarVisible = !sidebarVisible;
    sidebarIframe.style.display = sidebarVisible ? 'block' : 'none';
    const toggleButton = document.getElementById('contextBridgeSidebarToggle');
    if (toggleButton)
        toggleButton.style.right = sidebarVisible ? '300px' : '0px'; // Assumes sidebar width 300px
    if (sidebarVisible && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage(
            { type: 'SIDEBAR_ACTIVATED' },
            '*'
        );
    }
}

if (window.self === window.top) createSidebar();
