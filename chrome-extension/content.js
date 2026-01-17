// Trae Token Sync - Content Script
// Automatically copies token to clipboard when detected on the page

let lastCopiedToken = "";

// Create a Toast notification element
function showToast(message) {
    let toast = document.getElementById('trae-sync-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'trae-sync-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #007acc;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: system-ui, sans-serif;
            font-size: 14px;
            z-index: 10000;
            transition: opacity 0.3s;
            opacity: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `⚡ ${message}`;
    toast.style.opacity = '1';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// Listen for storage changes (Token updates from background)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.traeToken) {
        const newToken = changes.traeToken.newValue;
        if (newToken && newToken !== lastCopiedToken) {
            handleNewToken(newToken);
        }
    }
});

// Check manually on load
chrome.storage.local.get(['traeToken'], (result) => {
    if (result.traeToken) {
        // Don't auto-copy immediately on load to avoid overwriting clipboard unexpectedly
        // unless it's very fresh? Let's stick to update events or manual trigger.
        // Actually, user requested "auto copy".
        // We'll try to copy on next user interaction to ensure browser allows it.
    }
});

function handleNewToken(token) {
    // Attempt to write to clipboard
    // Note: This may fail if document is not focused, so we wrap it
    navigator.clipboard.writeText(token).then(() => {
        showToast("Trae Token Auto-Copied!");
        lastCopiedToken = token;
    }).catch(() => {
        // Fallback: Show a clickable element if auto-write failed
        showToast("Token captured! Click here to copy.");
        const toast = document.getElementById('trae-sync-toast');
        toast.style.cursor = 'pointer';
        toast.onclick = () => {
            navigator.clipboard.writeText(token);
            showToast("Copied!");
        };
    });
}
