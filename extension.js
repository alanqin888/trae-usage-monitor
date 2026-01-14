const vscode = require('vscode');
const https = require('https');
const { Buffer } = require('buffer');

// Fallback defaults for immediate usage
const DEFAULT_URL = "https://api-sg-central.trae.ai/trae/api/v1/pay/user_current_entitlement_list";
const DEFAULT_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."; // Truncated for brevity

let itemPro;
let itemExtra;
let intervalId;

function activate(context) {
    console.log('Trae Usage Monitor active');

    // Item 1: Pro Plan (Priority 100)
    itemPro = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    itemPro.text = "$(zap) Trae Init...";
    context.subscriptions.push(itemPro);
    itemPro.show(); 

    // Item 2: Extra Package (Legacy, hidden by default now)
    itemExtra = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    context.subscriptions.push(itemExtra);
    itemExtra.hide();

    // Clipboard Listener: Auto-detect token on window focus
    let lastClipboardToken = "";
    context.subscriptions.push(vscode.window.onDidChangeWindowState(async (e) => {
        if (e.focused) {
            try {
                const text = await vscode.env.clipboard.readText();
                // Check if it looks like a JWT (starts with eyJ, has 2 dots, long enough)
                if (text && text.startsWith("eyJ") && text.includes(".") && text.length > 50) {
                     // Check if it's different from current config
                     const config = vscode.workspace.getConfiguration('traeMonitor');
                     const currentToken = config.get('token');
                     
                     if (text !== currentToken && text !== lastClipboardToken) {
                         const selection = await vscode.window.showInformationMessage(
                             "📋 Detected a new Token in clipboard. Update Trae Monitor?", 
                             "Yes", "No"
                         );
                         
                         lastClipboardToken = text; // Remember we asked about this one
                         
                         if (selection === "Yes") {
                             await config.update('token', text, vscode.ConfigurationTarget.Global);
                             vscode.window.showInformationMessage("Token updated from clipboard!");
                             updateUsage();
                         }
                     }
                }
            } catch (err) {
                // Ignore clipboard errors
            }
        }
    }));

    // Delay initial update slightly to ensure UI is ready
    setTimeout(updateUsage, 1000);
    intervalId = setInterval(updateUsage, 10 * 60 * 1000); // 10 mins

    let disposable = vscode.commands.registerCommand('traeMonitor.refresh', () => {
        updateUsage();
    });
    context.subscriptions.push(disposable);
    
    // Command: Set Token
    let setTokenCmd = vscode.commands.registerCommand('traeMonitor.setToken', async () => {
        const token = await vscode.window.showInputBox({
            placeHolder: "Paste your Trae Token here (starting with eyJ...)",
            prompt: "Enter Trae Access Token",
            ignoreFocusOut: true
        });
        if (token) {
            await vscode.workspace.getConfiguration('traeMonitor').update('token', token, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage("Token updated!");
            updateUsage();
        }
    });
    context.subscriptions.push(setTokenCmd);
    
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('traeMonitor')) {
            updateUsage();
        }
    });

    itemPro.command = 'traeMonitor.refresh';
    itemExtra.command = 'traeMonitor.refresh';

    // URI Handler: Allow updating token from external links
    // Example: vscode://alanqin.trae-ai-usage-monitor/update?token=eyJ...
    context.subscriptions.push(vscode.window.registerUriHandler({
        handleUri(uri) {
            try {
                const query = new URLSearchParams(uri.query);
                if (query.has('token')) {
                    const newToken = query.get('token');
                    if (newToken && newToken.length > 20) {
                        const config = vscode.workspace.getConfiguration('traeMonitor');
                        config.update('token', newToken, vscode.ConfigurationTarget.Global).then(() => {
                            vscode.window.showInformationMessage("⚡ Trae Token updated successfully from Browser!");
                            updateUsage(); // Refresh immediately
                        });
                    }
                }
            } catch (e) {
                console.error("URI Handler Error:", e);
            }
        }
    }));
}

async function updateUsage() {
    const config = vscode.workspace.getConfiguration('traeMonitor');
    const apiUrl = config.get('apiUrl') || DEFAULT_URL;
    let token = config.get('token') || DEFAULT_TOKEN;
    if (token.startsWith("Cloud-IDE-JWT ")) token = token.replace("Cloud-IDE-JWT ", "");

    if (!apiUrl || !token) {
        showError("Trae: Config Missing");
        return;
    }

    // Hide the legacy extra item if it exists
    if (itemExtra) itemExtra.hide();

    // Visual feedback
    if (itemPro) {
        itemPro.text = "$(sync~spin) Trae: ...";
        itemPro.show();
    }

    try {
        let packs = [];
        let activePack = null; // Defined here

        // 1. Parse Token Expiry
        let tokenExpStr = "Unknown";
        let tokenExpiring = false;

        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.exp) {
                const expMs = payload.exp * 1000;
                const expDate = new Date(expMs);
                tokenExpStr = expDate.toLocaleString();
                
                // Warn if expiring in less than 3 days
                const daysLeft = (expMs - Date.now()) / (1000 * 60 * 60 * 24);
                if (daysLeft < 3) tokenExpiring = true;
            }
        } catch (e) {
            console.error("Token parse error", e);
        }

        // 2. Fetch Data
        console.log("Fetching usage data from:", apiUrl);
        const usageData = await fetchUsage(apiUrl, token);
        console.log("Fetched Data:", JSON.stringify(usageData));
        
        if (usageData.user_entitlement_pack_list && Array.isArray(usageData.user_entitlement_pack_list)) {
            usageData.user_entitlement_pack_list.forEach(pack => {
                const info = pack.entitlement_base_info || {};
                const quota = info.quota || {};
                const usage = pack.usage || {};
                
                const limit = quota.premium_model_fast_request_limit || 0;
                const used = usage.premium_model_fast_amount || 0;
                const left = limit - used;
                
                // Filter out empty/placeholder packs (like "Type 3" with 0/0)
                if (limit <= 0 && used <= 0) return;

                // Determine Name
                let name = "Unknown";
                if (info.product_type === 1) name = "💎 Pro Plan";
                else if (info.product_type === 2) name = "🎁 Extra Package";
                else name = `Type ${info.product_type}`;

                // Format Dates
                let expDate = "Never";
                if (info.end_time) {
                    expDate = new Date(info.end_time * 1000).toLocaleString();
                }

                const packData = {
                    name,
                    limit,
                    used,
                    left,
                    percent: limit > 0 ? (left / limit * 100) : 0,
                    expDate,
                    isConsuming: (left > 0 && used > 0) // Simple heuristic for "Consuming"
                };
                
                // Priority Score Logic
                let priority = 0;
                if (packData.isConsuming) priority += 100;
                if (info.product_type === 2 && left > 0) priority += 50;
                if (info.product_type === 1 && left > 0) priority += 10;
                if (left > 0) priority += 1;
                
                packData.priority = priority;
                packs.push(packData);
            });
            
            // Sort packs
            packs.sort((a, b) => {
                if (b.priority !== a.priority) return b.priority - a.priority;
                return new Date(a.expDate) - new Date(b.expDate);
            });
        }

        // Active is the top one
        if (packs.length > 0) activePack = packs[0];

        // 3. Build Tooltip
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        
        tooltip.appendMarkdown(`### ⚡ Trae Usage Monitor\n\n`);
        if (tokenExpStr && tokenExpStr !== "Unknown") {
            tooltip.appendMarkdown(`**🔑 Token Expires:** ${tokenExpStr}\n\n`);
        }
        tooltip.appendMarkdown(`---\n\n`);
        
        // Table Header
        tooltip.appendMarkdown(`| Package | Left | Used | Exp |\n`);
        tooltip.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);
        
        packs.forEach(p => {
             const icon = p.isConsuming ? "$(pulse)" : (p.name.includes("Pro") ? "$(zap)" : "$(gift)");
             const nameStr = p.isConsuming ? `**${p.name}**` : p.name;
             const usageStr = `${p.left.toFixed(2)} / ${p.limit.toFixed(2)} (${Math.round(p.percent)}%)`;
             tooltip.appendMarkdown(`| ${icon} ${nameStr} | ${usageStr} | ${p.used.toFixed(2)} | ${p.expDate.split(' ')[0]} |\n`);
        });

        // 4. Render
        if (activePack) {
            renderItem(itemPro, activePack, tooltip, tokenExpiring);
        } else {
            console.log("No active pack found");
            itemPro.text = "$(circle-slash) Trae: No Data";
            itemPro.tooltip = "No entitlement packages found.";
            itemPro.show();
        }
        
    } catch (error) {
        console.error("Critical Error in updateUsage:", error);
        if (error.message.includes("401") || error.message.includes("403")) {
             showError("Trae: Token Invalid", "API returned 401/403. Please update your token.");
        } else {
             showError("Trae: Error", `Error Details: ${error.message}\n${error.stack}`);
        }
    }
}

function renderItem(item, pack, tooltip, tokenExpiring) {
    const icon = pack.name.includes("Pro") ? "$(zap)" : "$(gift)";
    item.text = `${icon} Trae: ${pack.left.toFixed(2)} Left`;
    
    // User requested no token warnings in status bar. 
    // Warnings will only be evident if usage drops to 0 (implicit in the text).

    item.tooltip = tooltip;
    item.backgroundColor = undefined; // Clean look, no background colors
    item.show();
}

function showError(msg, detail) {
    if (itemPro) {
        itemPro.text = `$(error) ${msg}`;
        itemPro.tooltip = detail || "An error occurred. Check Developer Console for details.";
        itemPro.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        itemPro.show();
    }
    if (itemExtra) itemExtra.hide();
}

function fetchUsage(url, token) {
    const parsedUrl = new URL(url);
    
    // AUTO-CORRECT: The user often copies the wrong URL (ide_user_pay_status)
    // We force standard Trae endpoint if we detect it's a Trae API call
    if (parsedUrl.hostname.includes('trae.ai') && !parsedUrl.pathname.includes('user_current_entitlement_list')) {
        console.log("Auto-correcting URL to user_current_entitlement_list");
        parsedUrl.pathname = '/trae/api/v1/pay/user_current_entitlement_list';
    }

    const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Cloud-IDE-JWT ${token.replace('Cloud-IDE-JWT ', '')}`, // Ensure clean token
            'User-Agent': 'TraeMonitor/1.0'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    console.error(`API Request Failed: ${res.statusCode} ${res.statusMessage}`);
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON'));
                }
            });
        });
        req.on('error', (e) => {
            console.error("Network Error:", e);
            reject(e);
        });
        req.write(JSON.stringify({require_usage: true})); 
        req.end();
    });
}

function deactivate() {
    clearInterval(intervalId);
}

module.exports = { activate, deactivate };
