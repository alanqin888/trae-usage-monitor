document.addEventListener('DOMContentLoaded', () => {
    const msg = document.getElementById('msg');
    const btnSync = document.getElementById('btnSync');
    const btnCopy = document.getElementById('btnCopy');
    const btnOpen = document.getElementById('btnOpen');

    chrome.storage.local.get(['traeToken'], (result) => {
        if (result.traeToken) {
            msg.textContent = "Token ready! (If expired, click Open Trae)";
            msg.style.color = "green";
            btnSync.style.display = "block";
            btnCopy.style.display = "block";
            
            // Allow opening Trae even if token exists (to force refresh)
            btnOpen.style.display = "block";
            btnOpen.textContent = "🔄 Refresh Token";
            btnOpen.style.marginTop = "10px";
            btnOpen.style.backgroundColor = "#f0f0f0";
            btnOpen.style.color = "#333";

            // Sync Action
            btnSync.onclick = () => {
                const token = result.traeToken;
                chrome.tabs.create({ 
                    url: `vscode://alanqin.trae-ai-usage-monitor/update?token=${token}`
                });
            };

            // Copy Action
            // ... (keep copy action same) ...
             btnCopy.onclick = () => {
                navigator.clipboard.writeText(result.traeToken).then(() => {
                    btnCopy.textContent = "Copied!";
                    setTimeout(() => btnCopy.textContent = "📋 Copy to Clipboard", 2000);
                });
            };

        } else {
            msg.textContent = "No token found. Please open Trae to capture.";
            btnOpen.style.display = "block";
        }
        
        // Open/Refresh Action
        btnOpen.onclick = () => {
            chrome.tabs.create({ url: 'https://www.trae.ai/account-setting#usage' });
        };
    });
});
