# Trae Usage Monitor ⚡

Real-time monitoring of your **Trae AI Fast Request** usage directly in your IDE status bar. 
在 IDE 状态栏实时监控您的 Trae AI 快速请求额度。

![Preview](./preview.png)

## Features ✨

*   **Real-time Updates**: Status bar updates automatically every 10 minutes.
*   **Detailed Breakdown**: Separately displays **💎 Pro Plan** and **🎁 Extra Packages**.
*   **Visual Indicators**:
    *   Shows **Remaining / Total Limit**.
    *   Shows **Remaining Percentage** (e.g., 82%).
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

---

# Trae 额度监控 ⚡

在 IDE 状态栏实时监控您的 **Trae AI 快速请求** 额度。

## 功能特性 ✨

*   **实时更新**：状态栏每 10 分钟自动刷新一次数据。
*   **详细分类**：分开显示 **💎 Pro 计划** 和 **🎁 加油包** 的额度。
*   **直观展示**：
    *   显示 **剩余 / 总额度**。
    *   显示 **剩余百分比**（例如：82%）。
    *   **过期时间** 提醒（例如：Exp: 02/10）。
    *   **颜色告警**：当额度不足时（剩余 <10%），图标变色提醒。
*   **隐私安全**：您的 Token 仅保存在本地 VS Code 设置中，并仅用于查询 Trae 官方 API，绝不上传至任何第三方服务器。

## 如何获取 Token 🔑

由于 Trae 目前没有提供公开的 API Key，您需要从浏览器会话中提取访问 Token。

1.  登录 [Trae 账户设置](https://www.trae.ai/account-setting)。
2.  打开开发者工具 (**F12** 或 右键 -> 检查)。
3.  切换到 **控制台 (Console)** 标签页。
4.  粘贴以下“魔法脚本”以安全提取您的 Token：

```javascript
// 粘贴此代码到控制台以获取 Token
let token = localStorage.getItem("Cloud-IDE-JWT") || "Token not found in localStorage";
if (token === "Token not found in localStorage") {
    // 尝试从 Cookie 获取
    const match = document.cookie.match(/Authorization=([^;]+)/);
    if(match) token = match[1];
}
console.log("%c 🔑 您的 TOKEN:", "color: green; font-size: 16px; font-weight: bold;");
console.log(token);
// 复制以 'eyJ...' 开头的长字符串
```

*(或者，查看 Network 网络标签页中任意发往 `trae.ai` 的请求，复制 `Authorization` 头部的值)*

5.  复制 Token 字符串。

## 配置方法 ⚙️

1.  打开 IDE 设置 (`Cmd + ,` 或 `Ctrl + ,`)。
2.  搜索 **Trae**。
3.  将您的 Token 粘贴到 **Trae Monitor: Token** 中。
    *   (可选) 即使您填错了 API 地址，插件也会自动纠正为正确的官方接口。

## 手动刷新 🔄

点击状态栏上的图标即可立即强制刷新数据。

## 许可证 📄

MIT
