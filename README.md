# Trae Usage Monitor ⚡

Real-time monitoring of your **Trae AI Fast Request** usage directly in your IDE status bar. 
在 IDE 状态栏实时监控您的 Trae AI 快速请求额度。

![Preview](./preview.png)

## One-Click Sync (New!) 🚀

Instead of manually copying the token, you can use this "Magic Bookmark" to sync your Trae token to VS Code in one click.

### Method 2: Browser Extension (Recommended) 🧩

For the best experience, install our helper browser extension directly from the Chrome Web Store. It automatically captures your token when you visit Trae.ai.

**Installation:**
1.  Go to the [Trae Token Sync on Chrome Web Store](https://chromewebstore.google.com/detail/fpciknhekbebbbkblhdpddngcgpogbcj).
2.  Click **Add to Chrome**.
3.  The ⚡ icon will appear. Pin it for easy access!

### Method 3: Manual Token (Fallback)
1.  Open VS Code command palette (`Cmd/Ctrl + Shift + P`).
2.  Run `Trae Monitor: Set Token`.
3.  Paste your token.

## Features ✨

*   **Real-time Updates**: Status bar updates automatically every 10 minutes.
*   **Detailed Breakdown**: Separately displays **💎 Pro Plan** and **🎁 Extra Packages**.
*   **Visual Indicators**:
    *   Shows **Used / Total Limit**.
    *   Shows **Remaining Percentage** (e.g., 82%).
    *   **Expiration Date** warning (e.g., Exp: 02/10).
    *   **Color Alerts**: Turns yellow/red when quota is running low (<10% remaining).
*   **Privacy Focused**: Your token is stored locally in your VS Code settings and only used to query the official Trae API.

## How to Get Your Token 🔑

1.  Log in to [Trae Account Settings](https://www.trae.ai/account-setting).
2.  Open Developer Tools (**F12** or Right Click -> Inspect) and go to the **Network** tab.
3.  Refresh the page.
4.  Find any request to `trae.ai` (e.g., `user_current_entitlement_list`).
5.  In the **Request Headers** section, find **Authorization**.
6.  Copy the entire value (starts with `Cloud-IDE-JWT ...` or just `eyJ...`).

## Configuration ⚙️

1.  Open IDE Settings (`Cmd + ,` or `Ctrl + ,`).
2.  Search for **Trae**.
3.  Paste your token into **Trae Monitor: Token**.
    *   (Optional) The **Trae Monitor: Api Url** is auto-configured, you usually don't need to touch it.

## Manual Refresh 🔄

Click on the status bar item to trigger an immediate refresh.

## License 📄

MIT

---

# Trae 额度监控 ⚡

在 IDE 状态栏实时监控您的 Trae AI 快速请求额度。

## 一键同步 Token (新功能!) 🚀

无需手动复制粘贴，您可以使用“魔法书签”一键将浏览器中的 Token 同步到 VS Code 插件中。

### 方法 2: 浏览器插件 (推荐) 🧩

为了获得最佳体验，建议直接从 Chrome 插件商店安装我们的辅助插件。它可以在您访问 Trae.ai 时自动抓取 Token。

**安装步骤：**
1.  访问 [Trae Token Sync - Chrome 插件商店](https://chromewebstore.google.com/detail/fpciknhekbebbbkblhdpddngcgpogbcj)。
2.  点击 **添加至 Chrome** (Add to Chrome)。
3.  ⚡ 图标出现后，建议将其固定在工具栏以便随时使用。

### 方法 3: 手动输入 (保底方案)
1.  在 VS Code 中打开命令面板 (`Cmd/Ctrl + Shift + P`)。
2.  输入并运行 `Trae Monitor: Set Token`。
3.  粘贴您的 Token。

## 功能特性 ✨

*   **实时更新**：状态栏每 10 分钟自动刷新一次数据。
*   **详细分类**：分开显示 **💎 Pro 计划** 和 **🎁 加油包** 的额度。
*   **直观展示**：
    *   显示 **已用 / 总额度**。
    *   显示 **剩余百分比**（例如：82%）。
    *   **过期时间** 提醒（例如：Exp: 02/10）。
    *   **颜色告警**：当额度不足时（剩余 <10%），图标变色提醒。
*   **隐私安全**：您的 Token 仅保存在本地 VS Code 设置中，并仅用于查询 Trae 官方 API，绝不上传至任何第三方服务器。

## 如何获取 Token 🔑

1.  登录 [Trae 账户设置](https://www.trae.ai/account-setting)。
2.  打开开发者工具 (**F12** 或 右键 -> 检查)，并切换到 **网络 (Network)** 标签页。
3.  刷新页面。
4.  在列表中找到任意发往 `trae.ai` 的请求（例如搜索 `entitlement`）。
5.  在右侧的 **请求头 (Request Headers)** 中找到 **Authorization** 字段。
6.  复制其值（通常以 `Cloud-IDE-JWT` 或 `eyJ` 开头）。

## 配置方法 ⚙️

1.  打开 IDE 设置 (`Cmd + ,` 或 `Ctrl + ,`)。
2.  搜索 **Trae**。
3.  将您的 Token 粘贴到 **Trae Monitor: Token** 中。
    *   (可选) **API 地址** 通常无需修改，插件会自动使用默认地址。

## 手动刷新 🔄

点击状态栏上的图标即可立即强制刷新数据。

## 许可证 📄

MIT
