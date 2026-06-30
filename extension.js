const vscode = require("vscode");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Buffer } = require("buffer");
const crypto = require("crypto");

// Fallback defaults for immediate usage
const DEFAULT_URL =
  "https://api-sg-central.trae.ai/trae/api/v1/pay/user_current_entitlement_list";

// Trae local storage paths (macOS)
const TRAE_STORAGE_PATHS = [
  path.join(os.homedir(), "Library", "Application Support", "Trae", "User", "globalStorage", "storage.json"),
  path.join(os.homedir(), "Library", "Application Support", "Trae CN", "User", "globalStorage", "storage.json"),
];

// Cache for auto-read token to avoid excessive file reads
let cachedTraeAuth = null;
let cachedTraeAuthTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min cache

let itemPro;
let itemExtra;
let intervalId;

// Decryption obfuscation key material for Trae local storage
const JG = Buffer.from([
  82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124, 227, 57, 130,
  155, 47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203, 84, 123, 148, 50, 166, 194, 35, 61,
  238, 76, 149, 11, 66, 250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73,
  109, 139, 209, 37
]);
const KG = Buffer.from([
  31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95, 96, 81, 127, 169, 25,
  181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176,
  200, 235, 187, 60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99,
  85, 33, 12, 125
]);
const MAGIC = Buffer.from([0x74, 0x63, 0x05, 0x10, 0x00, 0x00]);

/**
 * Decrypt base64-encoded encrypted credential blobs used by newer Trae clients
 */
function decryptBase64Blob(b64) {
  const blob = Buffer.from(b64.trim(), "base64");
  if (blob.length < MAGIC.length + 32 + 16) {
    throw new Error("Blob too short");
  }
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Magic mismatch");
  }

  const salt = blob.subarray(MAGIC.length, MAGIC.length + 32);
  const ciphertext = blob.subarray(MAGIC.length + 32);

  const hardcodedPassword = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    hardcodedPassword[i] = JG[i] ^ KG[i];
  }

  const shaSalt = crypto.createHash("sha512").update(salt).digest();
  const kdfBuf = Buffer.concat([shaSalt, hardcodedPassword]);
  const kdfOut = crypto.createHash("sha512").update(kdfBuf).digest();

  const aesKey = kdfOut.subarray(0, 16);
  const iv = kdfOut.subarray(16, 32);

  const decipher = crypto.createDecipheriv("aes-128-cbc", aesKey, iv);
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);

  if (plaintext.length < 64) {
    throw new Error("Plaintext too short");
  }

  const expectedHash = plaintext.subarray(0, 64);
  const data = plaintext.subarray(64);

  const actualHash = crypto.createHash("sha512").update(data).digest();
  if (!expectedHash.equals(actualHash)) {
    throw new Error("Integrity check failed");
  }

  return data.toString("utf8");
}

/**
 * Read Trae's auth info directly from its local storage.
 * Returns { token, refreshToken, expiredAt, refreshExpiredAt, host } or null.
 */
function getTokenFromTraeStorage() {
  // Use cache if fresh
  if (cachedTraeAuth && Date.now() - cachedTraeAuthTime < CACHE_TTL) {
    return cachedTraeAuth;
  }

  for (const storagePath of TRAE_STORAGE_PATHS) {
    try {
      if (!fs.existsSync(storagePath)) continue;

      const content = fs.readFileSync(storagePath, "utf-8");

      // Find the iCubeAuthInfo://icube.cloudide key
      const regex = /"iCubeAuthInfo:\/\/icube\.cloudide"\s*:\s*"((?:[^"\\]|\\.)*)"/;
      const match = content.match(regex);
      if (!match) continue;

      // The value is a JSON string that's been escaped (double-encoded)
      const rawValue = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");

      let authData = null;
      if (rawValue.trim().startsWith("{")) {
        authData = JSON.parse(rawValue);
      } else {
        try {
          const decrypted = decryptBase64Blob(rawValue);
          authData = JSON.parse(decrypted);
        } catch (decErr) {
          console.warn(`[TraeMonitor] Failed to decrypt blob: ${decErr.message}`);
          authData = JSON.parse(rawValue); // fallback
        }
      }

      if (authData && authData.token) {
        console.log(`[TraeMonitor] Auto-read token from: ${storagePath}`);
        console.log(`[TraeMonitor] Token expires: ${authData.expiredAt}`);
        console.log(`[TraeMonitor] Refresh expires: ${authData.refreshExpiredAt}`);

        cachedTraeAuth = {
          token: authData.token,
          refreshToken: authData.refreshToken,
          expiredAt: authData.expiredAt,
          refreshExpiredAt: authData.refreshExpiredAt,
          host: authData.host || "https://api-sg-central.trae.ai",
          userId: authData.userId,
          storagePath,
        };
        cachedTraeAuthTime = Date.now();
        return cachedTraeAuth;
      }
    } catch (e) {
      console.error(`[TraeMonitor] Failed to read ${storagePath}:`, e.message);
    }
  }
  return null;
}

/**
 * Refresh the Trae access token using the refreshToken.
 * Returns the new token string or null on failure.
 */
function refreshTraeToken(authInfo) {
  return new Promise((resolve) => {
    if (!authInfo || !authInfo.refreshToken) {
      resolve(null);
      return;
    }

    const refreshExpired = authInfo.refreshExpiredAt ? new Date(authInfo.refreshExpiredAt) : null;
    if (refreshExpired && refreshExpired <= new Date()) {
      console.log("[TraeMonitor] Refresh token also expired, need manual re-login");
      resolve(null);
      return;
    }

    const host = authInfo.host || "https://api-sg-central.trae.ai";
    const parsedHost = new URL(host);
    const body = JSON.stringify({
      refresh_token: authInfo.refreshToken,
    });

    const options = {
      hostname: parsedHost.hostname,
      path: "/trae/api/v1/user/token/refresh",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "TraeMonitor/1.2",
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result && result.token) {
            console.log("[TraeMonitor] Token refreshed successfully!");
            // Invalidate cache so next read gets fresh data
            cachedTraeAuth = null;
            cachedTraeAuthTime = 0;
            resolve(result.token);
          } else {
            console.log("[TraeMonitor] Token refresh response:", data.substring(0, 200));
            resolve(null);
          }
        } catch (e) {
          console.error("[TraeMonitor] Token refresh parse error:", e.message);
          resolve(null);
        }
      });
    });

    req.on("error", (e) => {
      console.error("[TraeMonitor] Token refresh network error:", e.message);
      resolve(null);
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Get the best available token.
 * Priority: Trae local storage (auto) > user manual config
 * Auto-refreshes if the stored token is expired but refreshToken is still valid.
 */
async function getBestToken() {
  // 1. Try reading from Trae's local storage (zero-config!)
  const traeAuth = getTokenFromTraeStorage();
  if (traeAuth && traeAuth.token) {
    // Check if token is expired
    const tokenExpiry = traeAuth.expiredAt ? new Date(traeAuth.expiredAt) : null;
    if (tokenExpiry && tokenExpiry <= new Date()) {
      console.log("[TraeMonitor] Stored token expired, attempting refresh...");
      const newToken = await refreshTraeToken(traeAuth);
      if (newToken) return newToken;
      // Fall through to manual config
      console.log("[TraeMonitor] Refresh failed, falling back to manual token");
    } else {
      return traeAuth.token;
    }
  }

  // 2. Fall back to manual config
  const config = vscode.workspace.getConfiguration("traeMonitor");
  let token = config.get("token") || "";
  if (token.startsWith("Cloud-IDE-JWT ")) {
    token = token.replace("Cloud-IDE-JWT ", "");
  }
  return token;
}

function activate(context) {
  console.log("Trae Usage Monitor active");

  // Item 1: Pro Plan (Priority 100)
  itemPro = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  itemPro.text = "$(zap) Trae Init...";
  context.subscriptions.push(itemPro);
  itemPro.show();

  // Item 2: Extra Package (Legacy, hidden by default now)
  itemExtra = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99,
  );
  context.subscriptions.push(itemExtra);
  itemExtra.hide();

  // Clipboard Listener: Auto-detect token on window focus
  let lastClipboardToken = "";
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(async (e) => {
      if (e.focused) {
        try {
          const text = await vscode.env.clipboard.readText();
          // Check if it looks like a JWT (starts with eyJ, has 2 dots, long enough)
          if (
            text &&
            text.startsWith("eyJ") &&
            text.includes(".") &&
            text.length > 50
          ) {
            // Check if it's different from current config
            const config = vscode.workspace.getConfiguration("traeMonitor");
            const currentToken = config.get("token");

            if (text !== currentToken && text !== lastClipboardToken) {
              const selection = await vscode.window.showInformationMessage(
                "📋 Detected a new Token in clipboard. Update Trae Monitor?",
                "Yes",
                "No",
              );

              lastClipboardToken = text; // Remember we asked about this one

              if (selection === "Yes") {
                await config.update(
                  "token",
                  text,
                  vscode.ConfigurationTarget.Global,
                );
                vscode.window.showInformationMessage(
                  "Token updated from clipboard!",
                );
                updateUsage();
              }
            }
          }
        } catch (err) {
          // Ignore clipboard errors
        }
      }
    }),
  );

  // Delay initial update slightly to ensure UI is ready
  setTimeout(updateUsage, 1000);
  intervalId = setInterval(updateUsage, 10 * 60 * 1000); // 10 mins

  let disposable = vscode.commands.registerCommand(
    "traeMonitor.refresh",
    async () => {
      try {
        const clipText = await vscode.env.clipboard.readText();
        const config = vscode.workspace.getConfiguration("traeMonitor");
        const currentToken = config.get("token") || "";

        // Check if clipboard has a valid-looking JWT
        if (
          clipText &&
          clipText.startsWith("eyJ") &&
          clipText.includes(".") &&
          clipText.length > 50
        ) {
          if (clipText !== currentToken) {
            // Auto-update with confirmation
            const choice = await vscode.window.showInformationMessage(
              "📋 Detected new Trae Token in clipboard. Update now?",
              "Yes, Update",
              "No, Just Refresh",
            );

            if (choice === "Yes, Update") {
              await config.update(
                "token",
                clipText,
                vscode.ConfigurationTarget.Global,
              );
              vscode.window.showInformationMessage(
                "✅ Token updated from clipboard!",
              );
            }
          }
        }

        // Now refresh
        updateUsage();
      } catch (err) {
        // Clipboard read failed, just refresh
        updateUsage();
      }
    },
  );
  context.subscriptions.push(disposable);

  // Command: Set Token
  let setTokenCmd = vscode.commands.registerCommand(
    "traeMonitor.setToken",
    async () => {
      const token = await vscode.window.showInputBox({
        placeHolder: "Paste your Trae Token here (starting with eyJ...)",
        prompt: "Enter Trae Access Token",
        ignoreFocusOut: true,
      });
      if (token) {
        await vscode.workspace
          .getConfiguration("traeMonitor")
          .update("token", token, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("Token updated!");
        updateUsage();
      }
    },
  );
  context.subscriptions.push(setTokenCmd);

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("traeMonitor")) {
      updateUsage();
    }
  });

  itemPro.command = "traeMonitor.refresh";
  itemExtra.command = "traeMonitor.refresh";

  // URI Handler: Allow updating token from external links
  // Example: vscode://alanqin.trae-ai-usage-monitor/update?token=eyJ...
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri) {
        try {
          const query = new URLSearchParams(uri.query);
          if (query.has("token")) {
            const newToken = query.get("token");
            if (newToken && newToken.length > 20) {
              const config = vscode.workspace.getConfiguration("traeMonitor");
              config
                .update("token", newToken, vscode.ConfigurationTarget.Global)
                .then(() => {
                  vscode.window.showInformationMessage(
                    "⚡ Trae Token updated successfully from Browser!",
                  );
                  updateUsage(); // Refresh immediately
                });
            }
          }
        } catch (e) {
          console.error("URI Handler Error:", e);
        }
      },
    }),
  );
}

async function updateUsage() {
  const config = vscode.workspace.getConfiguration("traeMonitor");
  const apiUrl = config.get("apiUrl") || DEFAULT_URL;

  // Auto-read token: Trae local storage first, then manual config
  let token = await getBestToken();
  const tokenSource = (getTokenFromTraeStorage()?.token === token) ? "auto" : "manual";

  // Validation: Check for missing token
  if (!apiUrl || !token) {
    showError(
      "Trae: Token Missing",
      "No token found. If running inside Trae IDE, token should be auto-detected. Otherwise run 'Trae Monitor: Set Token'.",
    );
    const choice = await vscode.window.showInformationMessage(
      "⚠️ Trae Token not detected. Configure now?",
      "Set Token",
      "Later",
    );
    if (choice === "Set Token") {
      await vscode.commands.executeCommand("traeMonitor.setToken");
    }
    return;
  }

  // Validation: Check token format (simple heuristic)
  const looksLikeJwt = (t) =>
    t.startsWith("eyJ") && t.includes(".") && t.length > 50;

  if (!looksLikeJwt(token)) {
    showError(
      "Trae: Token Invalid",
      "Token format incorrect. Please paste a valid JWT starting with 'eyJ'.",
    );
    const choice = await vscode.window.showInformationMessage(
      "⚠️ Token format looks invalid. Re-enter?",
      "Set Token",
      "Ignore",
    );
    if (choice === "Set Token") {
      await vscode.commands.executeCommand("traeMonitor.setToken");
    }
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
    let activePack = null;

    // 1. Parse Token Expiry
    let tokenExpStr = "Unknown";
    let tokenExpiring = false;

    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString(),
      );
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

    // Detect billing mode: dollar-based (new) vs request-count (legacy)
    const isDollarBilling = usageData.is_dollar_usage_billing === true;

    if (
      usageData.user_entitlement_pack_list &&
      Array.isArray(usageData.user_entitlement_pack_list)
    ) {
      usageData.user_entitlement_pack_list.forEach((pack) => {
        const info = pack.entitlement_base_info || {};
        const quota = info.quota || {};
        const usage = pack.usage || {};

        let limit, used, left, bonusUsed, autoCompleteUsed, autoCompleteLimit;
        const premiumLimit = quota.premium_model_fast_request_limit || 0;
        const premiumUsed = usage.premium_model_fast_request_usage || usage.premium_model_fast_amount || 0;

        if (isDollarBilling) {
          // ===== NEW: Token/Dollar-based billing =====
          limit = quota.basic_usage_limit || 0;
          used = usage.basic_usage_amount || 0;
          bonusUsed = usage.bonus_usage_amount || 0;
          autoCompleteLimit = quota.auto_completion_limit || 0;
          autoCompleteUsed = usage.auto_completion_amount || 0;
          left = limit - used;
        } else {
          // ===== LEGACY: Request count billing =====
          limit = quota.premium_model_fast_request_limit || 0;
          used = usage.premium_model_fast_amount || 0;
          bonusUsed = 0;
          autoCompleteLimit = 0;
          autoCompleteUsed = 0;
          left = limit - used;
        }

        // Filter out empty/placeholder packs (e.g. feature-flag packs with all zeros)
        if (limit <= 0 && used <= 0 && bonusUsed <= 0 && premiumLimit <= 0) return;

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

        const isConsuming = isDollarBilling
          ? usage.is_flash_consuming === true
          : left > 0 && used > 0;

        const packData = {
          name,
          limit,
          used,
          left,
          bonusUsed,
          autoCompleteUsed,
          autoCompleteLimit,
          premiumLimit,
          premiumUsed,
          percent: limit > 0 ? (Math.max(0, left) / limit) * 100 : 0,
          expDate,
          isConsuming,
          isDollarBilling,
          productType: info.product_type,
        };

        // Priority Score Logic
        let priority = 0;
        if (packData.isConsuming) priority += 100;
        if (info.product_type === 2 && left > 0) priority += 50;
        if (info.product_type === 1) priority += 10;
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
    const sourceIcon = tokenSource === "auto" ? "🤖 Auto" : "🔧 Manual";
    if (tokenExpStr && tokenExpStr !== "Unknown") {
      tooltip.appendMarkdown(`**🔑 Token:** ${sourceIcon} | Expires: ${tokenExpStr}\n\n`);
    } else {
      tooltip.appendMarkdown(`**🔑 Token:** ${sourceIcon}\n\n`);
    }

    if (isDollarBilling) {
      // Summary line: total remaining across all packs
      const totalBasicLeft = packs.reduce(
        (sum, p) => sum + Math.max(0, p.left),
        0,
      );
      const totalBonusUsed = packs.reduce((sum, p) => sum + p.bonusUsed, 0);
      const effectiveRemaining = Math.max(0, totalBasicLeft - totalBonusUsed);
      tooltip.appendMarkdown(
        `**💰 Total Remaining: $${effectiveRemaining.toFixed(2)}**`,
      );
      if (totalBonusUsed > 0) {
        tooltip.appendMarkdown(
          ` _(Bonus Used: $${totalBonusUsed.toFixed(2)})_`,
        );
      }
      tooltip.appendMarkdown(`\n\n`);
    }

    tooltip.appendMarkdown(`---\n\n`);

    if (isDollarBilling) {
      // Dollar billing table
      tooltip.appendMarkdown(
        `| Package | Basic | Used | Bonus | Status | Exp |\n`,
      );
      tooltip.appendMarkdown(`| :--- | :--- | :--- | :--- | :--- | :--- |\n`);

      packs.forEach((p) => {
        const icon = p.isConsuming
          ? "$(pulse)"
          : p.name.includes("Pro")
            ? "$(zap)"
            : "$(gift)";
        const nameStr = p.isConsuming ? `**${p.name}**` : p.name;
        const basicStr = `$${Math.max(0, p.left).toFixed(2)} / $${p.limit.toFixed(2)}`;
        const usedStr = `$${p.used.toFixed(2)}`;
        const bonusStr = p.bonusUsed > 0 ? `$${p.bonusUsed.toFixed(2)}` : `-`;
        const statusStr = p.isConsuming ? `🔴 Active` : `⏳ Queued`;
        const expStr = p.expDate.split(",")[0] || p.expDate.split(" ")[0];
        
        tooltip.appendMarkdown(
          `| ${icon} ${nameStr} | ${basicStr} | ${usedStr} | ${bonusStr} | ${statusStr} | ${expStr} |\n`,
        );

        // Add detailed metrics for Autocomplete & Premium Models
        let subDetails = [];
        if (p.premiumLimit > 0) {
          subDetails.push(`⚡ Premium: ${p.premiumUsed} / ${p.premiumLimit}`);
        }
        if (p.autoCompleteLimit !== 0) {
          const limitStr = p.autoCompleteLimit === -1 ? "Unlimited" : p.autoCompleteLimit;
          subDetails.push(`⌨️ Autocomplete: ${p.autoCompleteUsed} / ${limitStr}`);
        }
        if (subDetails.length > 0) {
          tooltip.appendMarkdown(`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_${subDetails.join(" | ")}_\n\n`);
        }
      });
    } else {
      // Legacy request-count table
      tooltip.appendMarkdown(`| Package | Left | Used | Exp |\n`);
      tooltip.appendMarkdown(`| :--- | :--- | :--- | :--- |\n`);

      packs.forEach((p) => {
        const icon = p.isConsuming
          ? "$(pulse)"
          : p.name.includes("Pro")
            ? "$(zap)"
            : "$(gift)";
        const nameStr = p.isConsuming ? `**${p.name}**` : p.name;
        const usageStr = `${p.left.toFixed(0)} / ${p.limit.toFixed(0)} (${Math.round(p.percent)}%)`;
        tooltip.appendMarkdown(
          `| ${icon} ${nameStr} | ${usageStr} | ${p.used.toFixed(0)} | ${p.expDate.split(" ")[0]} |\n`,
        );
      });
    }

    // 4. Render
    if (activePack) {
      renderItem(
        itemPro,
        activePack,
        tooltip,
        tokenExpiring,
        isDollarBilling,
        packs,
      );
    } else {
      console.log("No active pack found");
      itemPro.text = "$(circle-slash) Trae: No Data";
      itemPro.tooltip = "No entitlement packages found.";
      itemPro.show();
    }

  } catch (error) {
    console.error("Critical Error in updateUsage:", error);
    if (error.message.includes("401") || error.message.includes("403")) {
      showError(
        "Trae: Token Invalid",
        "API returned 401/403. Please update your token.",
      );
    } else {
      showError(
        "Trae: Error",
        `Error Details: ${error.message}\n${error.stack}`,
      );
    }
  }
}

function renderItem(
  item,
  pack,
  tooltip,
  tokenExpiring,
  isDollarBilling,
  allPacks,
) {
  const icon = pack.name.includes("Pro") ? "$(zap)" : "$(gift)";

  if (isDollarBilling) {
    // Show total effective remaining across all packs
    const totalBasicLeft = allPacks.reduce(
      (sum, p) => sum + Math.max(0, p.left),
      0,
    );
    const totalBonusUsed = allPacks.reduce((sum, p) => sum + p.bonusUsed, 0);
    const effectiveRemaining = Math.max(0, totalBasicLeft - totalBonusUsed);
    item.text = `${icon} Trae: $${effectiveRemaining.toFixed(2)} Left`;
  } else {
    item.text = `${icon} Trae: ${pack.left.toFixed(0)} Left`;
  }

  item.tooltip = tooltip;
  item.backgroundColor = undefined;
  item.show();
}

async function showError(msg, detail) {
  if (itemPro) {
    itemPro.text = `$(error) ${msg}`;
    itemPro.tooltip =
      detail || "An error occurred. Check Developer Console for details.";
    itemPro.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
    itemPro.show();
  }
  if (itemExtra) itemExtra.hide();

  // If it's a token error, offer to open Trae website
  if (msg.includes("Token Invalid") || msg.includes("Token Exp")) {
    const action = await vscode.window.showErrorMessage(
      "🔑 Trae Token is invalid or expired. Refresh it from the website?",
      "Open Trae Website",
      "Dismiss",
    );
    if (action === "Open Trae Website") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://www.trae.ai/account-setting#usage"),
      );
    }
  }
}

function fetchUsage(url, token, retries = 2) {
  const parsedUrl = new URL(url);

  // AUTO-CORRECT: The user often copies the wrong URL (ide_user_pay_status)
  // We force standard Trae endpoint if we detect it's a Trae API call
  if (
    parsedUrl.hostname.includes("trae.ai") &&
    !parsedUrl.pathname.includes("user_current_entitlement_list")
  ) {
    console.log("Auto-correcting URL to user_current_entitlement_list");
    parsedUrl.pathname = "/trae/api/v1/pay/user_current_entitlement_list";
  }

  const body = JSON.stringify({ require_usage: true });

  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "Accept": "application/json, text/plain, */*",
      "Authorization": `Cloud-IDE-JWT ${token.replace("Cloud-IDE-JWT ", "")}`,
      "User-Agent": "TraeMonitor/1.1",
      "Origin": "https://www.trae.ai",
      "Referer": "https://www.trae.ai/",
    },
    timeout: 15000,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          console.error(
            `API Request Failed: ${res.statusCode} ${res.statusMessage}`,
          );
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON"));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      if (retries > 0) {
        console.log(`Request timeout, retrying... (${retries} left)`);
        fetchUsage(url, token, retries - 1).then(resolve).catch(reject);
      } else {
        reject(new Error("Request timeout"));
      }
    });

    req.on("error", (e) => {
      console.error("Network Error:", e.message);
      if (retries > 0 && (e.message.includes("socket hang up") || e.code === "ECONNRESET")) {
        console.log(`Retrying after ${e.message}... (${retries} left)`);
        setTimeout(() => {
          fetchUsage(url, token, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(e);
      }
    });

    req.write(body);
    req.end();
  });
}

function deactivate() {
  clearInterval(intervalId);
}

module.exports = { activate, deactivate };
