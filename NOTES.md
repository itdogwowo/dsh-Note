# DSH 使用筆記

> 這裡記的是**實際上被絆到過**的事，不是官方文件的轉抄。
> 每條都盡量寫出「怎麼驗證的」，因為這個生態變動快，推論會過期、驗證方法不會。
>
> 版本基準：DSH `0.1.5-rc.1` / `0.1.5-rc.2`，2026-09。
> 敘述一律用樣板（`<你的帳號>`、`<專案>`），不要在這個公開 repo 裡寫真實路徑。

---

## 1. 技能（Skill）

### 1.1 它其實是什麼

一份 `SKILL.md`，加上 YAML frontmatter：

```markdown
---
name: my-skill
description: 這個技能做什麼，以及什麼時候該用它。
---

（本體：給 AI 的指示）
```

放在這四個目錄之一就會被掃到：

| 目錄 | 層級 |
|---|---|
| `~/.dsh/skills/<name>/SKILL.md` | 使用者（所有專案） |
| `~/.agents/skills/<name>/SKILL.md` | 使用者（另一套慣例） |
| `<專案>/.dsh/skills/<name>/SKILL.md` | 專案 |
| `<專案>/.agents/skills/<name>/SKILL.md` | 專案（另一套慣例） |

單檔形式 `<name>.md` 也吃。也可以設 `customSkillDirs` 加自訂目錄。

### 1.2 ⭐ 觸發原理：**只有 `description`，沒有條件引擎**

這是整個系統最容易被誤解的地方。

- 模型每一輪看到的**只有一行**：`- \`name\`: description`
- 系統提示說「**若任務明顯符合某個技能的 description，就先呼叫 `skill` 工具**」
- 所以「觸發條件」＝**寫在 description 裡的自然語言**，由**模型每輪自己判斷**

**沒有**關鍵字比對、**沒有**正則、**沒有** glob、**沒有**事件掛鉤。

> 想要確定性的觸發（例如世界書那種關鍵字命中），技能系統做不到。
> 那要換機制：system prompt section 的動態 `text` 或 `agent/pre-step` waterfall。

### 1.3 ⚠️ 三個會讓你白忙的陷阱

**陷阱 1：body 裡寫「## Trigger Conditions」不會觸發**

那一段要**技能被載入之後**才讀得到——而決定要不要載入的只有 frontmatter 的 `description`。
在 body 寫「Invoke when…」是循環的。

（它仍有用途：讓已載入的模型發現「我載錯了」時退出。但它**不能讓技能被載入**。）

**陷阱 2：`whenToUse` 是裝飾品**

`whenToUse` 有被解析、有被驗證，但 `dsh-tool-skill` 的 `catalogSourceEntries` **只吐 `name` + `description`**。
它只進 `toSummary()`（技能中心 UI 顯示用），**不進模型看得到的目錄**。

→ 把觸發時機只寫在 `whenToUse`，那個技能永遠不會自己觸發。

**陷阱 3：description 會被截斷**

`dsh-tool-skill` 的 `DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH = 500`。
超過 500 字的部分**模型看不到**。重要的關鍵字要往前放。

> 怎麼驗證：把兩個技能的描述寫成一個 400 字一個 900 字，看你的對話 context 裡
> `<available_skills>` 那一行實際出現多少。實測 900 字那個被砍在半句話中間。

### 1.4 有效的 description 怎麼寫

用「使用者會怎麼講」的語言，把**觸發時機寫在前面**：

```yaml
description: '修改或建立任何檔案、寫文件、附截圖之前載入。公開 repo 的個資紅線：…'
```

如果常用中文下指令，**把中文觸發詞也寫進去**：

```yaml
description: 'Sync or rebuild project docs. Invoke when API/core files change, or user says 同步文件 / 更新文件 / 重建文件.'
```

模型讀得懂英文，但描述裡有使用者的**實際用詞**，命中率會更高。

### 1.5 兩個控制開關

| 欄位 | 預設 | 作用 |
|---|---|---|
| `disable-model-invocation: true` | false | 關掉「模型自己呼叫」 |
| `user-invocable: false` | false | 關掉「使用者打 `/` 呼叫」 |

⚠️ **一定要用 kebab-case。** camelCase（`disableModelInvocation`、`modelInvocable`、`userInvocable`）
會被 `rejectLegacyInvocationKey` **直接丟錯**，不是忽略。

### 1.6 兩個入口是不同的東西

| 入口 | 誰提供 | 做什麼 |
|---|---|---|
| 對話輸入框打 `/` →「技能」分區 | **DSH 本體** `@deepseek-ai/dsh-client-ui-skill` | 使用者手動把技能塞進這個對話 |
| 側邊欄「技能中心」 | 第三方插件（例如 `@linxin666/dsh-client-ui-skill-explorer`） | 瀏覽／開關／新增／刪除**檔案** |

**關鍵**：技能能不能用**完全不依賴**技能中心。那個插件只是檔案管理器。
把技能中心關掉，`/` 選單和模型的目錄都照常運作。

技能中心掛在哪：`dsh-web-all` 的 bundle patch 裡它是 **opt-in（`disabled: true`）**，
要在使用者層覆寫打開（見 §3.2）。

### 1.7 技能是「跨工具」的格式

`SKILL.md` + `name`/`description` 是通用規格，其他 AI 工具（Trae、Claude Code、Cursor 等）也用同一套。

- **格式互通、目錄不互通**：不同工具的技能根目錄不同（`~/.trae/skills` vs `~/.dsh/skills`），
  搬過去就是複製資料夾
- 搬過去之後是**兩份獨立副本**，改一邊不會同步另一邊
- 搬之前要檢查**平台專屬的工具名**（見 §6.2）

---

## 2. 全域指示 `AGENTS.md`

DSH 的 `dsh-agent-instructions` 會**自動注入**，不用手動貼。

| 檔案 | 範圍 |
|---|---|
| `<專案根>/AGENTS.md` 或 `CLAUDE.md` | 該專案 |
| `<專案根>/AGENTS.local.md` 或 `CLAUDE.local.md` | 該專案，個人覆蓋層（通常 gitignore） |
| `~/.dsh/AGENTS.md` | 你所有專案 |

- **注入時機**：第一次模型請求**之前**（baseline）
- **動態補充**：`read`／`write`／`edit` 碰到子目錄裡的 `AGENTS.md` 時會補進來——所以子目錄可以放更嚴的規則
- **單檔上限**：1 MiB
- **專案根怎麼找**：從 cwd 往上找 `.git`

### 與技能的取捨

| | 載入方式 | 成本 |
|---|---|---|
| `AGENTS.md` | 每次對話**全量**注入 | 每個對話都付 |
| 技能 | 常駐只有一行描述，本體**按需** | 用到才付 |

→ **通則：不放棄地都要遵守的規則放 `AGENTS.md`；只在特定情境用的長篇指示放技能。**
兩者可以搭配：`AGENTS.md` 寫觸發條件＋一句「細節見 X 技能」。

---

## 3. 插件與 profile

### 3.1 profile 的結構

```
~/.dsh/profiles/web/
├── package.json      dependencies ＋ dsh.profile.bundles（**順序有意義**）
├── cordis.yml        profile 根，空的；註解說「改 cordis.patch.yml，不要改這個」
├── cordis.patch.yml  ★ 使用者層覆寫（你自己改的地方）
└── node_modules/     449 MB，不要同步
```

`package.json` 的 `dsh.profile.bundles` 決定 DSH 依序組出哪棵插件樹。

### 3.2 啟停一個插件：兩層

1. **bundle 層**（插件作者寫的）：插件自己的 `cordis.patch.yml` 可以宣告 `disabled: true`
   —— 那就是「預設關閉、要你另外打開」的 opt-in 插件
2. **使用者層**（你寫的）：`~/.dsh/profiles/web/cordis.patch.yml`

```yaml
# 使用者層覆寫會蓋過 bundle 層
[ { id: web-ui-skill-explorer, name: "@linxin666/dsh-web-all/skill-explorer", disabled: false } ]
```

**plugin manager 會把改動前的版本備份成 `cordis.patch.yml.bak-plugin-manager`。**

> 實測：改完這個檔案**不需要重啟** `dsh web` —— 宿主路由會熱掛載。
> （但不保證所有插件都這樣；不確定的時候重啟最保險。）

### 3.3 怎麼分辨「插件沒生效」vs「插件活了但沒內容」

兩者症狀可能一樣（面板是空的）。要分開驗：

```powershell
# ① 插件本體活著嗎 → 打它的路由或 health 端點
Invoke-WebRequest 'http://127.0.0.1:<port>/api/<plugin>/health' -UseBasicParsing

# ② 有內容嗎 → 去看它讀的那個目錄存不存在
Test-Path ~/.dsh/skills
```

**只看畫面永遠分不出來。**

### 3.4 埠與 token 會變

`dsh web` 每次啟動的埠和 token 都可能不同（被佔用就換）。看日誌：

```powershell
Select-String -Path ~/.dsh/dsh-web.log -Pattern 'dsh web: http' | Select-Object -Last 1
```

---

## 4. 跨機器同步（這個 repo 在做的事）

### 4.1 什麼可以同步、什麼絕對不行

| 類別 | 路徑 | 判斷 |
|---|---|---|
| 技能 | `~/.dsh/skills/` | ✅ |
| 使用者設定 | `~/.dsh/settings.yaml` | ✅ |
| 插件啟停 | `profiles/web/cordis.patch.yml` | ✅ |
| 插件依賴清單 | `profiles/web/package.json` 的 deps | ⚠️ 見 §4.2 |
| Agent preset | `~/.dsh/.agent-presets/` | ⚠️ 常含機器路徑 |
| **憑證** | `.credentials.yaml` | ❌ **絕對不行** |
| 對話紀錄 | `sessions/` | ❌ 149 MB＋隱私 |
| 附件 | `attachments/` | ❌ |
| 儲存庫 | `storages/` | ❌ |
| `node_modules` | `profiles/*/node_modules` | ❌ 449 MB，重裝就好 |

**要同步的其實只有一兩 MB。**

### 4.2 ⭐ 鐵則：只存 URL，不存路徑

`package.json` 裡的依賴有三種形狀：

| 寫法 | 可攜？ | 例 |
|---|---|---|
| npm 版本號 | ✅ | `"@scope/pkg": "1.2.3"` |
| 遠端 URL | ✅ | `"https://github.com/<owner>/<repo>/archive/refs/heads/main.tar.gz"` |
| `link:<絕對路徑>` | ❌ **機器專屬** | `"link:C:/Users/<你>/code/my-plugin"` |
| `file:<絕對路徑>.tgz` | ❌ **機器專屬** | `"file:/Users/<你>/.dsh/plugins-src/x.tgz"` |

**同步的是 URL，每台機器自己的 `link:` 覆寫放本機的 `machines/<host>.json`（已 gitignore）。**

> 用 `archive/refs/heads/main.tar.gz` 而不是 `archive/<SHA>.tar.gz`：
> 前者永遠抓最新，後者在 commit 被重寫（見 §5.2）之後會 404。

### 4.3 要同步的東西怎麼帶

```
sync/skills/          ← 複製 ~/.dsh/skills/ 整個目錄
sync/settings.yaml    ← 複製 ~/.dsh/settings.yaml
sync/plugins/rows.yml ← 複製 ~/.dsh/profiles/web/cordis.patch.yml
sync/plugins/*.json   ← 插件 URL 清單與 bundles 順序
```

另一台機器：把 `sync/` 的內容複製回 `~/.dsh/` 對應位置 → 重啟 `dsh web`。

---

## 5. 隱私紅線（公開 repo）

> 這一節是血淚。真實發生過：公開 repo 的第一顆 commit 的 README 示意圖裡，
> 貼了側邊欄截圖，裡面是**公司的內部專案名**；另一份文件有 9 處完整家目錄路徑
> （夾帶使用者名稱）。

### 5.1 會洩漏的三種東西

| 種類 | 長什麼樣 |
|---|---|
| 絕對路徑 | `C:\Users\<帳號>\…`、`/Users/<帳號>/…` |
| 名稱 | 公司名、內部專案名、客戶名 |
| 截圖 | 畫面裡的側邊欄有工作區名稱與完整路徑 |

⚠️ **`.gitignore` 擋不住 GitHub 網頁拖檔上傳。** ignore 只對 `git add` 有效。

### 5.2 ⭐ `force push` **不會**刪掉 GitHub 上的東西

重寫歷史後，舊 commit 不再被任何分支指向，但**只要你還記得 SHA，它照樣整份讀得出來**——包含完整的 patch 全文。

驗證方法：

```
https://api.github.com/repos/<owner>/<repo>/commits/<舊的完整 SHA>
  200 = 東西還在（API 會把 commit 全文吐回來）
  422 = 真的沒了
```

**徹底清除的唯一保證**：刪掉 repo 重建（前提是 `forks_count` 為 0，否則別人也有一份）。
重建後 commit 的 SHA **不會變**（內容定址）。

### 5.3 本地也要清

```powershell
git reflog expire --expire=now --all
git gc --prune=now
```

reflog 會讓「已經刪掉的 commit」繼續活著。

### 5.4 黑名單要放本機

把公司名寫進公開檔案來「防止公司名外洩」是自相矛盾的。
黑名單放**已 gitignore 的本機檔**，掃描工具讀它比對。

---

## 6. 疑難排解

### 6.1 「我改了但畫面沒變」

兩個面是**分開載入**的：

- 改 `lib/client.js`（瀏覽器半）→ 通常**不用重啟**，HMR 會推 `rebuilt` 並重載模組
- 改 `lib/index.js`（宿主半）→ **一定要重啟 `dsh web`**

判斷頁面跑的是新是舊：看插件回報的 build 標記（或側邊欄 tooltip）。

### 6.2 從別的工具搬技能過來：先掃工具名

不同平台的工具名不一樣，搬過來之後技能會**叫錯工具**，而且通常不會報錯，只是行為怪。

| 別的平台 | DSH |
|---|---|
| `AskUserQuestion` | `ask_user_question` |
| `SearchReplace` | `edit` |
| `Task subagent` / `general_purpose_task` | `subagent` |
| `CLAUDE.md` | `AGENTS.md` |
| `Bash(...)` 的 `allowed-tools` 限制 | 不支援，**靜默失效** |

### 6.3 空的面板不一定是壞掉

見 §3.3：先打 health 端點，再看目錄存不存在。

### 6.4 沙箱裡的 git push 失敗

`schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS` 或
`CreateFileMapping ... Win32 error 5` —— 那不是 git 壞了、也不是 token 過期，
是**權限限制**擋住了憑證 helper 和 Windows 憑證存放區。

換 `-c http.sslBackend=openssl` 只會換一個症狀（credential helper 是 shell script，一樣跑不起來）。

---

## 7. 還沒解的問題

- 世界書只掃「進來的那則訊息」，不是「最近 N 則」
- 技能的觸發是機率性的，沒有確定性觸發機制
- `~/.dsh/skills` 和別的工具的技能目錄是兩份獨立副本，改一邊不會同步
