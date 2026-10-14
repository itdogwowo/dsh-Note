# 插件與 profile

## profile 的結構

**一台機器上可以同時有多個 profile，互不相干**（各有自己的 `package.json`
與 `cordis.patch.yml`）。實際上會遇到兩個名字：

| profile | 誰在跑它 |
|---|---|
| `desktop` | **GUI（Electron 應用程式）**——CLI 不能單獨啟動它 |
| `web` | `dsh web`（瀏覽器介面） |

> ⚠️ **`dsh web` 是 `--profile web` 的寫死別名。**
> 所以 `dsh web --profile desktop` 的那個 `--profile` 會被忽略
> （或報 `select a profile only once`）——你以為在測 desktop，其實在測 web。
>
> 反過來，`desktop` 用 CLI 起會**直接拒絕**：
> `error: profile "desktop" is managed exclusively by the Electron application`。
>
> **改設定之前，先確認 GUI 跑的是哪一個**（見 [`pitfalls.md`](pitfalls.md)
> 「你改的那個 profile，不是 GUI 正在跑的那個」）。

```
~/.dsh/profiles/<profile>/
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
   `~/.dsh/profiles/<profile>/cordis.patch.yml`

```yaml
# 使用者層覆寫會蓋過 bundle 層
[ { id: web-ui-skill-explorer, name: "@linxin666/dsh-web-all/skill-explorer", disabled: false } ]
```

⚠️ **純列表的每一列是「依 id 覆寫既有列」，不是「新增」。**
要**新增**一列（例如一個新的 Agent 模式）必須包在 `- insert:` 裡，
否則目標不存在，那一列會被**靜默跳過**，只留一行警告：

    patch: entry "<你的 id>" not found

```yaml
# 新增一列（沒有 id 的 insert = 追加到最後）
- insert:
    - id: <新的 loader 位址>
      name: <套件名或 file:// URL>
      config: { ... }
```

**`- insert:` 不是 bundle 層專屬的語法**——它就是 patch 檔的通用格式，
官方出貨的 `dsh-web-app/presets/*.patch.yml` 也是這樣寫的。
（bundle 層之所以常見，是因為套件作者要插自己那一列。）

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

> 2026-10-14 實查 `@deepseek-ai/dsh-agent-preset-registry` 與 `@deepseek-ai/dsh-agent-preset`
> 的**官方 README** 之後寫成。
> ⚠️ **這一節的第一版是錯的**（以為目錄會被掃描），錯在哪見 `pitfalls.md`。

### 它其實是什麼

**模式 ＝ profile 裡的一列 `@deepseek-ai/dsh-agent-preset`。**

> 官方 README 原句：**「註冊表不掃描目錄，也不接受 preset 路徑。」**

`~/.dsh/.agent-presets/` **不是**註冊機制——那只是 `dsh-tavern` 這個插件**自己的資料目錄**
（它的 `agent.cordis.yml` 裡寫著 `generated-by: dsh-tavern`）。
看到一個目錄長得像設定，不代表系統會讀它。

宣告寫在 profile 的 `cordis.patch.yml`。
**使用者層與 bundle 層用的是同一種 patch 格式**；
「新增」一律要包在 `- insert:` 裡（純列表的列是**依 id 覆寫**，目標不存在就靜默跳過）：

```yaml
- insert:
    - id: preset-<loader 位址>
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: <穩定的 preset 識別符>      # 必填，session 存的就是這個
        plugins: []                    # 必填，子插件行列表
        name: <展示名稱>                # 選填
        description: <展示說明>         # 選填
        order: <列表排序>               # 選填
```

`plugins` 裡的每一項就是**普通插件列**（`id` + `name`，`name` 指向一個 JS 模組）。
模式要掛的 agent 面模組就放在那裡。

### ⭐ 子外掛的 `name` 必須是 `file://` URL

這條踩過，**症狀是靜默的**：模式會出現在選擇器裡，但被標成損壞
（`<模組> (路徑): never started`），等於「模式在，裡面是空的」。

```yaml
plugins:
  - id: my-agent-side
    name: 'file:///C:/Users/<你>/.dsh/agent-plugins/<模式>/agent.js'   # ✅
#   name: 'C:\Users\<你>\.dsh\agent-plugins\<模式>\agent.js'          # ❌ 靜默失敗
```

loader 只把「以 `/` 開頭」或「`./`、`../` 開頭」的字串當成路徑；
**Windows 反斜線的 `C:\...` 兩者都不是**，於是被當成**裸套件名**去安裝目錄解析 → 找不到。

產生的方式（把反斜線換成正斜線、前面加 `file:///`）：

```powershell
'file:///' + '<絕對路徑>'.Replace('\', '/')
```

> ⚠️ **`--dump-config-schema` 顯示 `status: schema` 不代表它會跑起來。**
> 那隻證明模組能被 import。要驗「有沒有啟動」，
> 必須看宿主回報的 preset 清單裡那個模式**有沒有 `broken` 欄位**
> （GUI 網路面板可見 `POST /api/agentPresets/list`）。

- **內建模式**（standard／ptc／minimal／cordis）的定義來自 `dsh-web-app` bundle
- **新增或覆蓋 preset 都是 bundle 補丁**——官方指定用 `plugin_manager` 安裝，
  或由**創造模式**在對話中編寫
- 註冊表**不寫入任何宣告**：沒有介面接受 YAML 寫回

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

- **preset 列本身不可攜，但它可以樣板化。** 子外掛的 `name` 一定是**機器專屬的
  `file://` 絕對路徑**；要同步就拆成「帶樣板的列」（存 repo）與
  「本機實際路徑」（存已 gitignore 的 `machines/<host>.json`）。做法見
  [`../sync/agent/jlcpcb/README.md`](../sync/agent/jlcpcb/README.md)。
- **改哪個 profile 比怎麼改更容易錯**：GUI 跑 `desktop`、`dsh web` 跑 `web`，
  兩者不繼承。改完要**重啟那個 profile 的宿主**（GUI 要整個結束再開，
  不是重整頁面）——而且**只有 CLI 管得到的 profile 才能用 `--dump-config` 先驗**。
- 寫模組時**不要在 template literal 裡用反引號** —— 見 `pitfalls.md`。
- ⚠️ **有兩個不同的 `order`，不要混用**：
  - preset `config.order` → 模式在**列表裡的排序**（官方 README 有列，選填）
  - `ctx.systemPrompt.section({ order })` → 提示**片段在系統提示裡的排序**。
    這個只查證得到一個合法值（`0`，酒館用的 persona 前綴位置），其餘列舉值查不到。
- 讀官方 README 的位置在 npx 快取：
  `%LOCALAPPDATA%\npm-cache\_npx\<hash>\node_modules\@deepseek-ai\`
  （`<hash>` 每次更新可能不同；可用 `dsh-web.log` 回推）
