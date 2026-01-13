# Trae Usage Monitor ⚡

Real-time monitoring of your **Trae AI Fast Request** usage directly in your IDE status bar. 
在 IDE 状态栏实时监控您的 Trae AI 快速请求额度。

![Preview](https://i.imgur.com/example.png) <!-- Placeholder, optional -->

## Features ✨

*   **Real-time Updates**: Status bar updates automatically every 10 minutes.
*   **Detailed Breakdown**: Separately displays **💎 Pro Plan** and **🎁 Extra Packages**.
*   **Visual Indicators**:
    *   Shows **Used / Total Limit**.
    *   Shows **Percentage** usage (e.g., 18%).
    *   **Expiration Date** warning (e.g., Exp: 02/10).
    *   **Color Alerts**: Turns yellow/red when quota is running low (<10% remaining).
*   **Privacy Focused**: Your token is stored locally in your VS Code settings and only used to query the official Trae API.

## How to Get Your Token 🔑

Since Trae does not currently provide a public API key, you need to extract your access token from the browser session.

1.  Log in to [Trae Account Settings](https://www.trae.ai/account-setting).
2.  Open Developer Tools (**F12** or Right Click -> Inspect).
3.  Go to the **Console** tab.
4.  Paste the following "Magic Script" to safely extract your token:

```javascript
// Paste this into Console to get your Trae Token
let token = localStorage.getItem("Cloud-IDE-JWT") || "Token not found in localStorage";
if (token === "Token not found in localStorage") {
    // Try cookie fallback
    const match = document.cookie.match(/Authorization=([^;]+)/);
    if(match) token = match[1];
}
console.log("%c 🔑 YOUR TOKEN:", "color: green; font-size: 16px; font-weight: bold;");
console.log(token);
// Copy the long string starting with 'eyJ...'
```

*(Alternatively, look at the Network tab for any request to `trae.ai` and copy the `Authorization` header value).*

5.  Copy the token string.

## Configuration ⚙️

1.  Open IDE Settings (`Cmd + ,` or `Ctrl + ,`).
2.  Search for **Trae**.
3.  Paste your token into **Trae Monitor: Token**.
    *   (Optional) If current API URL changes, update **Trae Monitor: Api Url**.

## Manual Refresh 🔄

Click on the status bar item to trigger an immediate refresh.

## License 📄

MIT
