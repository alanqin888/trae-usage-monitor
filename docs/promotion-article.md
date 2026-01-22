# Trae Usage Monitor 公众号推文

---

## 标题（任选一个）

**主标题**：我用 AI 写了个插件，解决了 Trae 用户都头疼的问题

**备选**：
- 产品经理亲自下场写代码？用 AI 3小时做了个爆款工具
- Trae 重度用户必备：我做了一个额度监控插件
- 从"看不到用量"到"一键同步"：一个产品人的 AI 编程实践

---

## 正文

### 引子：一个小痛点

作为一个从 2025 年 1 月就开始用 Trae 做产品原型的早期用户，我对这个国产 AI IDE 是充满感情的。

但有一个小问题一直困扰着我——**看不到自己的用量**。

每次想确认一下"今天还剩多少次快速请求"，都得打开浏览器、登录官网、点进设置页面。对于一个整天泡在编辑器里的人来说，这个动作虽然不复杂，但足够打断心流。

后来我找到了一个第三方插件，本以为问题解决了。结果这插件三天两头失效，Token 过期也不提醒，最后我连它什么时候坏的都不知道，直到某天突然发现自己裸奔了好久。

**既然如此，不如自己动手。**

---

### 从想法到上架：3小时

是的，你没看错，**3 小时**。

这不是因为我代码写得有多快（事实上我的主业是产品经理），而是因为我有一个强力队友——**AI**。

整个开发过程，我用的是 Trae 自带的 AI 编程能力。从第一行代码到最终上架 VS Code 插件市场，全程都是"我说需求，AI 写代码"的模式。

**我做的事情**：
- 描述我想要的功能
- 测试 AI 生成的代码
- 指出问题和优化方向
- 最终拍板"可以发布了"

**AI 做的事情**：
- 写 VS Code 插件代码
- 调用 API、解析 JWT Token
- 处理各种边界情况
- 甚至帮我做了一个配套的 Chrome 浏览器插件

这让我深刻体会到：**在 AI 时代，"不会写代码"已经不是做产品的障碍了。**

---

### 这个插件解决了什么问题？

**核心功能**：在 IDE 状态栏实时显示你的 Trae 额度用量，鼠标悬停还能看到详细信息。

**痛点对应**：
| 之前 | 现在 |
|------|------|
| 想看用量要切到浏览器 | 抬眼就能看到 |
| Token 过期了不知道 | 自动检测并提醒 |
| 第三方插件经常失效 | 自己的代码，随时能改 |

**额外惊喜**：
- **一键同步**：配合浏览器插件，Token 更新只需点一下鼠标
- **智能剪贴板**：复制 Token 后切回 IDE，自动提示是否要更新
- **过期直达**：Token 失效时，一键跳转到网页刷新

---

### 迭代过程中学到的

开发过程中遇到了几个有意思的卡点，简单记录一下：

**1. API 返回了一个神秘的 "Type 3"**

Trae 的接口返回了一个"Type 3"的套餐，额度是 0/0，有效期到 2055 年。这是什么鬼？

最后我猜测这可能是内部的占位符或者免费层级标记。解决方案很简单：**过滤掉无意义的数据**。

**2. Token 频繁过期怎么办？**

Trae 的网页 Token 有效期大概只有 8 小时。对于一个要常开的监控插件来说，这太短了。

既然不能改后端，那就优化前端体验。我做了三件事：
- Tooltip 里显示 Token 过期时间
- 过期时自动弹窗提醒
- 提供一键跳转到网页刷新的按钮

**3. 浏览器安全限制**

最初我想做一个 Bookmarklet（书签脚本）来自动同步 Token。结果发现现代浏览器的安全策略非常严格，这条路走不通。

最后的方案是做一个正式的 Chrome 插件，通过监听网络请求来抓取 Token——这是浏览器允许的"正规渠道"。

---

### 写在最后

这个小项目让我再次确认了一件事：**AI 正在改变"谁能做产品"的门槛。**

以前，一个产品经理想把自己的想法变成可用的工具，要么求人帮忙，要么从零学编程。现在，只要你能清楚地描述需求、有耐心迭代调试，AI 就能帮你完成大部分"脏活累活"。

当然，这不意味着技术不重要。恰恰相反，**你得懂技术才能提出靠谱的需求，才能识别 AI 犯的错误**。只是这个"懂"的标准，从"能写出来"变成了"能看懂、能调试"。

---

### 试用链接

**VS Code 插件**（搜索 "Trae Usage Monitor" 或点击链接）：
🔗 https://marketplace.visualstudio.com/items?itemName=alanqin.trae-ai-usage-monitor

**GitHub 开源**（包含浏览器插件）：
🔗 https://github.com/alanqin888/trae-usage-monitor

如果你也是 Trae 用户，欢迎试用和反馈。有问题可以直接在 GitHub 提 Issue，我会尽快响应。

---

**#Trae #AI编程 #产品经理 #开源 #VSCode插件**

---

## X/Twitter 短文案

```
🔌 刚用 AI 做了个 Trae 额度监控插件

痛点：Trae 没法直接看用量，每次都要开网页
方案：写了个状态栏插件，抬眼就能看到

整个过程 3 小时，代码全是 AI 写的，我只负责"当产品经理"

开源了：github.com/alanqin888/trae-usage-monitor

#Trae #AI编程 #开源
```

---

## LinkedIn 文案

```
✨ Side Project: Trae Usage Monitor

As a product manager who's been using Trae (a Chinese AI-powered IDE) since January 2025, I noticed a small but annoying problem: there's no easy way to check your usage quota without leaving the editor.

So I built a solution — with AI.

📍 The Result:
- A VS Code extension that shows real-time usage in the status bar
- A companion Chrome extension for seamless token sync
- From idea to marketplace: 3 hours

📍 What I Learned:
1. AI is lowering the barrier for building tools. I described features, AI wrote the code.
2. Being technical still matters — you need to debug and guide the AI.
3. Small problems are big opportunities.

Open-sourced on GitHub: github.com/alanqin888/trae-usage-monitor

Curious about AI-assisted development? Happy to share more details.

#AIEngineering #ProductManagement #OpenSource #Trae #BuildInPublic
```

---

## 配图建议

1. **封面图**：状态栏截图 + 大标题"我用 AI 写了个插件"
2. **过程图**：GitHub Commit 历史截图（展示迭代）
3. **对比图**：之前（网页截图） vs 现在（插件截图）
4. **技术图**：浏览器插件 + IDE 插件的联动示意图

---
