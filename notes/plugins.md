# 插件與 profile

## profile 的結構

```
~/.dsh/profiles/web/
├── package.json      dependencies ＋ dsh.profile.bundles（**順序有意義**）
├── cordis.yml        profile 根，內容是空的 `[]`
│                     註解明說：「改 cordis.patch.yml，不要改這個檔案」
├── cordis.patch.yml  ★ 使用者層覆寫（你自己改的地方）
├── cordis.patch.yml.bak-plugin-manager   plugin manager 改動前的備份
└── node_modules/     動輒幾百 MB，不要同步
```

`package.json` 的 `dsh.profile.bundles` 決定 DSH 依序組出哪棵插件樹。
**順序有意義**，不要隨便重排。

## 啟停一個插件：兩層

1. **bundle 層**（插件作者寫的）
   插件自己的 `cordis.patch.yml` 可以宣告 `disabled: true`
   —— 那就是「預設關閉、要你另外打開」的 **opt-in 插件**

2. **使用者層**（你寫的）
   `~/.dsh/profiles/web/cordis.patch.yml`

```yaml
# 使用者層覆寫會蓋過 bundle 層
[ { id: web-ui-skill-explorer, name: "@linxin666/dsh-web-all/skill-explorer", disabled: false } ]
```

一個 bundle 裡常常掛了很多列（例如「全家桶」型插件）。
要看某個功能是不是 opt-in，去翻該 bundle 的 `cordis.patch.yml` 尾巴，通常有註解說明。

> 實測：改完使用者層**不需要重啟** `dsh web` —— 宿主路由會熱掛載。
> 但不保證所有插件都這樣，不確定的時候重啟最保險。

## ⭐ 怎麼分辨「插件沒生效」vs「插件活了但沒內容」

**兩者症狀可能完全一樣**（面板是空的）。只看畫面永遠分不出來。

要分開驗：

```powershell
# ① 插件本體活著嗎 → 打它的路由或 health 端點
Invoke-WebRequest 'http://127.0.0.1:<port>/api/<plugin>/health' -UseBasicParsing

# ② 有內容嗎 → 去看它讀的那個目錄存不存在
Test-Path ~/.dsh/skills
```

**實際發生過**：技能中心面板是空的，於是判斷「技能跟 DSH 不互通」。
實際上插件活得好好的（health 回 `200 {"ok":true}`），空的真正原因是
**磁碟上一個 `SKILL.md` 都沒有**——那個目錄根本不存在。

> 對照組：不存在的不會是 404 而是 **401**（DSH 的認證閘先擋）。
> 看到 401 不代表路由不存在。

## 埠與 token 每次都可能變

`dsh web` 啟動時埠被佔用就換一個，token 也每次不同。

```powershell
Select-String -Path ~/.dsh/dsh-web.log -Pattern 'dsh web: http' | Select-Object -Last 1
```

日誌裡也會有「if the browser session is gone, reopen: …」這種直接可用的網址。

## 插件的依賴形狀

| 寫法 | 可攜 | 說明 |
|---|---|---|
| npm 版本號 | ✅ | `"pkg": "1.2.3"` |
| 遠端 URL | ✅ | `"https://…/archive/refs/heads/main.tar.gz"` |
| `link:<絕對路徑>` | ❌ | 指向本機工作目錄，**機器專屬** |
| `file:<絕對路徑>.tgz` | ❌ | 指向本機 tarball，**機器專屬** |

同步的時候只存前兩種，見 [`sync.md`](sync.md)。

## 插件壞掉的代價不一樣

DSH 插件通常有「兩個面」，載入路徑不同，**壞掉的後果差很多**：

| 面 | 壞掉會怎樣 |
|---|---|
| 宿主半（Node 那一半） | 可能**整個 `dsh web` 起不來** |
| 瀏覽器半（前端那一半） | 可能**整個 GUI 白畫面** |
| Agent 面（只在 preset 裡跑的） | 只有那個對話壞掉 |

**為什麼宿主半會拖垮整個 DSH**：DSH 的 loader 在啟動時**同步導入**每個 bundle 的
loader entry。任何一個插件的頂層 import 解析失敗，**不是降級跳過，是直接開不了機**。

→ 所以插件作者有一條常見的硬規則：**宿主半零執行期依賴**，只 import `node:` 內建模組
與自己的相對檔案。

**應急**：如果裝了某個插件之後 `dsh web` 起不來，把它從 profile 移除：
`dsh plugin --profile web remove <name>`。

## 診斷插件渲染期崩潰

前端插件「退位」（render 時丟錯導致整個座位不渲染）以前是**完全靜默**的。
DSH 有官方接縫可以攔：

- slot 服務的 `slots.onEntryError(fn)`
- 有些插件會自己開一個 debug 全域（例如 `window.__dshXxx`）回報 build 與 mount 狀態

寫前端插件時**務必**掛一個，否則使用者只會看到空白，沒有任何線索。

---

## Agent 預設（模式）

> 2026-10-14 實查 `~/.dsh/.agent-presets/` 與 `dsh-tavern` 的原始碼之後寫成。

### 它其實是什麼

**模式 ＝ 一個 preset 目錄 ＋ 一個 agent 面插件。**

```
~/.dsh/.agent-presets/<模式名>/
├── preset.yml          顯示用：name / description / order
├── agent.cordis.yml    ★ 唯一決定「這個模式的 session 長什麼樣」
└── lib/agent.js        agent 面模組（由上面那一列指定路徑）
```

`preset.yml`：

```yaml
name: 嘉立創模式
description: 顯示在模式選擇器上的說明
order: 800
```

`agent.cordis.yml`：一個 Cordis 列，指向 JS 模組的**絕對路徑**（所以機器專屬）：

```yaml
- id: <唯一 id>
  name: 'C:\...\lib\agent.js'
```

### agent 面模組的 API

| 能力 | 呼叫 |
|---|---|
| plugin 身分 | `export const name = '...'` |
| 宣告依賴 | `export const inject = ['systemPrompt']` |
| plugin 本體 | `export function apply(ctx) { … }` |
| 註冊與清理 | `ctx.effect(fn, '標籤')` |
| **系統提示 section** | `ctx.systemPrompt.section({ name, order, text })` |
| 動態變數 | `ctx.systemPrompt.variable(名稱, fn)`；section 內寫 `{{名稱}}` |
| 遮蔽 runtime context | `ctx.systemPrompt.suppressRuntimeContext()` |
| **每輪前置鉤** | `ctx.on('agent/pre-step', async (payload, next) => { const d = await next(); …; return d })` |
| 另一個鉤 | `ctx.on('agent/request', …)` |
| 限制工具 | `ctx.tools.restrict({ deny: [...] })`（要先 `ctx.inject(['tools'], …)`）|

### 三個關鍵事實

1. **`complete: true` 會讓系統提示「只剩」那個 section** —— harness 身分、工具說明、
   部署 persona **全部消失**。酒館模式靠它把角色卡變成整個系統提示。
   **要保留一般能力就絕對不要用。**
2. **同一個 scope 只能有一個 `complete: true`**，多掛一個會讓系統提示組裝**直接失敗**。
   （沒有用 `complete` 的 section 是安全的疊加。）
3. **`agent/pre-step` 比系統提示組裝更早、而且在同一個回合內**
   （順序：`agent/pre-step` → `agent/request` → 送出）。
   所以「掃這一輪的訊息，影響**同一輪**的提示」是做得到的 ——
   做法是把掃到的文字存起來，讓 section 的動態變數去讀。

### 邊界

- **路徑是機器專屬的絕對路徑**，preset **不可攜**（見 `sync.md`）。
- 新增 preset 後**模式選擇器不一定立刻更新**，重新整理或重啟最保險。
- 寫模組時**不要在 template literal 裡用反引號** —— 見 `pitfalls.md`。
- `order` 目前只查證得到一個合法值（`0`，酒館用的 persona 前綴位置），
  其餘列舉值查不到。**不確定就不要亂填。**
