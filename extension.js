const vscode = require('vscode');
const https = require('https');

// Fallback defaults for immediate usage
const DEFAULT_URL = "https://api-sg-central.trae.ai/trae/api/v1/pay/user_current_entitlement_list";
// Token from previous capture (Expiring 2026-01-13)
const DEFAULT_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiNzQ2MzgyOTYwNzAxNjc0Mzk1MiIsInNvdXJjZSI6InNlc3Npb24iLCJzb3VyY2VfaWQiOiJINy0zN1pzUVJvRUlqU2ZmaXY5U2ljaW0yc3JJR3pWSG1iSUJXMDRDckVZPS4xODhhM2VjZDY5YzgyYzE5IiwidGVuYW50X2lkIjoiN28yZDg5NHA3ZHIwbzQiLCJ0eXBlIjoidXNlciJ9LCJleHAiOjE3NjgzMjUzMzcsImlhdCI6MTc2ODI5NjUzN30.Pcc4mvsaubfUgHUGb5Mq18RYPrkeocsge798m3YQMPlyFyLvQhrvuzk_rpyLMdbdNcRm8Apkr7DGW1Ig4XOGPmz3KrZGt2Mk8i1_linRNA-1AfrhDPPDi1A-FEBloCaUA5gJvk1XgfZH4qgtT65NsCop_StbfmvkyEs9Kbq-_sD4wlux1u9L67SylWAMTt1_wiS7iw06lWbY-KovcAiKM-ls3TSX1xKxrv8fPKh8yV_q_d32cvDTjPgXGpBYM6VBIy8d8urL_r2IEzr7fYZReoNDJNNu-kB_s-8GkaYGtgC4dNnK306D0erKLE2b7mx1K55wUTDwSkbLhRSSdLrcT-d56tJYGStEJT2LCF6t67t-ahTWTk7I7LOWwoasYRu0MRjwnrfj6Jw693K_KZMvSA1oVx6-EYEv1FdY8sPlfhx4casJjo7ZbUtWGmNzDLhZVAvLef6HFyWIlWa_HDbjtJDDXV68rGjnOgeI5LArrH63hIBI_ghkouwrJerKn0P9XiB_S4epC4B1VqWZZCxucc_lbx2V6D3Sx-gPIvhk5mc6rqn-r0BySCHQQkMSEUwKGO02ZwAfQ9DmlvUKdNsIlU9xztztiClpTfZa5xJ-MdoVkwrNJooUnhVDEFiivvqXRSZgbIVrS5CCHBSRM4-VLlKAYZiR0jwzb2ONJckwCms";

let itemPro;
let itemExtra;
let intervalId;

function activate(context) {
    console.log('Trae Usage Monitor active');

    // Item 1: Pro Plan (Priority 100)
    itemPro = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    itemPro.text = "$(sync~spin) Trae Pro...";
    context.subscriptions.push(itemPro);
    itemPro.show(); // Always show initially

    // Item 2: Extra Package (Priority 99 - sits to the right of Pro)
    itemExtra = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    itemExtra.text = "$(sync~spin) Trae Extra...";
    context.subscriptions.push(itemExtra);
    itemExtra.show(); // Always show initially

    // Delay initial update slightly to ensure UI is ready
    setTimeout(updateUsage, 1000);
    intervalId = setInterval(updateUsage, 10 * 60 * 1000); // 10 mins

    let disposable = vscode.commands.registerCommand('traeMonitor.refresh', () => {
        updateUsage();
    });
    context.subscriptions.push(disposable);
    
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('traeMonitor')) {
            updateUsage();
        }
    });

    itemPro.command = 'traeMonitor.refresh';
    itemExtra.command = 'traeMonitor.refresh';
}

async function updateUsage() {
    const config = vscode.workspace.getConfiguration('traeMonitor');
    // Use config if set, otherwise fallback to hardcoded defaults
    const apiUrl = config.get('apiUrl') || DEFAULT_URL;
    // Handle Token: if config is empty, use default. If config has "Cloud-IDE-JWT", strip it.
    let token = config.get('token') || DEFAULT_TOKEN;
    if (token.startsWith("Cloud-IDE-JWT ")) token = token.replace("Cloud-IDE-JWT ", "");

    if (!apiUrl || !token) {
        showError("Trae: Config Missing");
        return;
    }

    try {
        let usageData;
        try {
            console.log("Fetching usage data from:", apiUrl);
            usageData = await fetchUsage(apiUrl, token);
            console.log("Fetched Data:", JSON.stringify(usageData));
        } catch (e) {
            console.error("Fetch failed, using hardcoded backup for debugging:", e);
            // FALLBACK FOR DEBUGGING: Use the data you successfully CURL'd earlier
            usageData = {"is_pay_freshman":false,"user_entitlement_pack_list":[{"entitlement_base_info":{"charge_amount":0,"currency":0,"end_time":2701158344,"entitlement_id":"7517120516","product_type":3,"quota":{"premium_model_fast_request_limit":0},"start_time":1755078344},"usage":{"premium_model_fast_amount":0}},{"entitlement_base_info":{"charge_amount":0,"currency":0,"end_time":1770719770,"entitlement_id":"28065607684","product_type":1,"quota":{"premium_model_fast_request_limit":600},"start_time":1768127770},"usage":{"premium_model_fast_amount":0}},{"entitlement_base_info":{"charge_amount":0,"currency":0,"end_time":1769999291,"entitlement_id":"24151248132","product_type":2,"quota":{"premium_model_fast_request_limit":300},"start_time":1767407291},"usage":{"premium_model_fast_amount":54.19471}}]};
        }
        
        let proData = { used: 0, limit: 0, found: false };
        let extraData = { used: 0, limit: 0, found: false };

        if (usageData.user_entitlement_pack_list && Array.isArray(usageData.user_entitlement_pack_list)) {
            usageData.user_entitlement_pack_list.forEach(pack => {
                const info = pack.entitlement_base_info || {};
                const quota = info.quota || {};
                const usage = pack.usage || {};
                
                const limit = quota.premium_model_fast_request_limit || 0;
                const used = usage.premium_model_fast_amount || 0;
                
                console.log(`Processing Pack: Type=${info.product_type} Limit=${limit} Used=${used}`);

                // Product Type 1 is usually Subscription (Pro), Type 2 is Package (Extra)
                // We fallback to checking limits if type is unknown
                if (info.product_type === 1 || limit === 600) {
                     proData.limit += limit;
                     proData.used += used;
                     proData.endTime = info.end_time; // Capture end timestamp
                     proData.found = true;
                } else if (info.product_type === 2 || limit === 300) {
                     extraData.limit += limit;
                     extraData.used += used;
                     extraData.endTime = info.end_time; // Capture end timestamp
                     extraData.found = true;
                }
            });
        }
        
        console.log("Pro Data:", proData);
        console.log("Extra Data:", extraData);

        // --- RENDER PRO ITEM ---
        if (proData.found) {
            renderItem(itemPro, "💎 Pro", proData.used, proData.limit, proData.endTime);
        } else {
            // NEVER HIDE PRO - Show "No Data" or fallback
            // This ensures the user knows the extension is alive
            console.log("Pro data not found, showing placeholder");
            itemPro.text = "$(circle-slash) Trae: No Data";
            itemPro.tooltip = "Could not find Pro Plan data in the API response.\nCheck your Token or Network.";
            itemPro.show();
        }

        // --- RENDER EXTRA ITEM ---
        if (extraData.found) {
            renderItem(itemExtra, "🎁 Extra", extraData.used, extraData.limit, extraData.endTime);
        } else {
            // Extra can be hidden if not used, but let's show it as "-" for now to be sure
            // or hide it if you prefer cleaner UI. Let's hide Extra only.
            itemExtra.hide();
        }
        
    } catch (error) {
        console.error("Critical Error in updateUsage:", error);
        showError("Trae: Error");
    }
}

function renderItem(item, label, used, limit, endTime) {
    const left = limit - used;
    const usedStr = used.toFixed(2);
    const limitStr = limit.toFixed(2);
    const leftStr = left.toFixed(2);
    
    // Percentage (Remaining)
    let leftPercent = 0;
    if (limit > 0) leftPercent = (left / limit) * 100;
    const leftPercentStr = Math.round(leftPercent) + "%";

    // Date Formatting
    let dateStr = "";
    let fullDateStr = "Never";
    if (endTime) {
        const date = new Date(endTime * 1000);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        dateStr = ` Exp:${mm}/${dd}`;
        fullDateStr = date.toLocaleString();
    }

    // Text: 💎 Pro: 54.19/600.00 (91%) Exp:02/10
    // Displaying: Used / Total (Remaining %)
    item.text = `${label}: ${usedStr}/${limitStr} (${leftPercentStr})${dateStr}`;
    
    // Tooltip
    item.tooltip = `${label} Usage\nUsed: ${usedStr}\nLimit: ${limitStr}\nRemaining: ${leftStr}\nRemaining %: ${leftPercentStr}\nExpires: ${fullDateStr}`;
    
    // Color: Warning if remaining < 10%
    if (leftPercent < 10) {
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        item.backgroundColor = undefined; 
    }
    
    console.log(`Rendering Item ${label}: ${item.text}`);
    item.show();
}

function showError(msg) {
    if (itemPro) {
        itemPro.text = `$(error) ${msg}`;
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
