---
name: git-push
description: '一次同意完成提交與推送。當使用者說「幫我推」「推上去」「push 上去」「commit 然後推」「提交」「發佈」，或 push / commit and push / publish 時載入。流程：偵測 git → 挑檔案並 stage → 寫出可編輯的待提交狀態（訊息檔與計畫）→ 使用者核對後取得**一次**同意 → commit 與 push 一次做完。⚠️ 同意只對那一次有效；force push 必須另外同意；沒回答不等於同意。'
whenToUse: '使用者要提交、要推送、或要 commit 之後推上去的時候。'
---

# Git Push — 準備、一次同意、提交並推送

這份技能是**自足的**：偵測工具、挑檔案、擬訊息、取得同意、commit 與推送，
全部都在這裡，**不需要其他技能配合**。

> 為什麼要自足：技能是**條件載入**的，你沒辦法保證另一個技能也被載入。
> 任何「詳見某技能」的引用在對方沒被載入時就是斷的。

---

## 鐵則

### ① 同意點在「提交」，而且同意提交＝同意一併推送

使用者同意提交的那一刻，**就是同意了推送**。不要再問第二次。

**所以同意卡必須明講這件事**（見步驟 3），不能讓他以為只是在同意一個本機 commit。

### ② 一次同意只對一次有效

這次同意了，下一個 commit 要推，**要重新問**。

> ⚠️ **這一條就是這個技能存在的理由。** 實際發生過：AI 拿到兩次針對特定任務的推送同意
> 之後，就把它當成常設授權，接下來**四次推送都沒問**。
> **單次同意 ≠ 常設授權。**

### ③ 沒回答 ≠ 同意

使用者沒選、關掉提問、或回了不相關的東西，**就是還沒同意**。
停在那裡，不要自動往下走，也不要「那我就先推了」。

---

## 步驟 0 — 偵測可用的推送工具

**依序試，第一個成功的就是它。不要假設 `git` 在 PATH 上。**

```sh
git --version
```

失敗就找常見安裝位置：

**Windows**

| 工具 | 路徑 |
|---|---|
| SourceTree | `%LOCALAPPDATA%\Atlassian\SourceTree\git_local\cmd\git.exe` |
| Git for Windows | `%ProgramFiles%\Git\cmd\git.exe` |
| GitHub Desktop | `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe` |

**macOS**

| 工具 | 路徑 |
|---|---|
| Xcode CLT | `/usr/bin/git`（沒裝 CLT 時這只是個會跳安裝提示的 shim） |
| Homebrew | `/opt/homebrew/bin/git`（Apple Silicon）、`/usr/local/bin/git`（Intel） |
| SourceTree | `/Applications/SourceTree.app/Contents/Resources/git_local/bin/git` |

### 一個都找不到 → 使用者是用 GUI 推的

**不要硬推。** 改成：把 commit 做好，然後**產出給他自己操作的步驟**。

> **GUI 工具通常有自己的 git，而憑證綁在那個 GUI 的環境裡。**
> 用它的絕對路徑跑得動（實測：SourceTree 的 `git_local\cmd\git.exe` 推得上去）。
> 提醒使用者：GUI 可能還沒看到新的 commit，要**重新整理**。

### ⚠️ 憑證錯誤要先分辨是哪一種

同樣是 `SEC_E_NO_CREDENTIALS`、`could not read Username`，有**兩種完全不同的原因**：

| 原因 | 特徵 | 怎麼辦 |
|---|---|---|
| **執行環境擋住** | 錯誤裡有**權限／沙箱**字眼，例如憑證 helper 是 shell script、執行時噴 `CreateFileMapping … Win32 error 5` | **這不是憑證問題。** 放寬權限重試**一次**通常就會成功 |
| **真的沒有憑證** | 沒有任何權限錯誤，就是問不到帳密 | **停下來**，請使用者開他的 GUI 按推送 |

**分辨方法**：錯誤訊息裡有沒有**權限／沙箱**的字眼。
有 → 先放寬權限試一次；沒有 → 直接轉手動。

> ❌ **不要做**：換 `http.sslBackend=openssl`（只會換一個症狀）、
> 反覆重試同一個指令、自己 `git config` 塞帳密。
>
> **實測過的反例**：某個環境裡 `schannel: AcquireCredentialsHandle failed:
> SEC_E_NO_CREDENTIALS` 看起來完全像憑證過期，其實是執行環境擋住了憑證存放區
> ——**放寬權限之後，同一個指令直接成功。**
> 如果當時照「憑證問題就轉手動」處理，就會白白放棄一個做得到的操作。

---

## 步驟 1 — 挑檔案，**只 stage，不要 commit**

**不要 `git add -A`。** 先看：

```sh
git status --porcelain
git diff --stat
```

排除這些（就算使用者沒說）：

- 憑證、`.env`、私鑰
- 暫存檔、建置產物、`node_modules`
- 大的二進位檔

挑好之後 `git add <那些檔案>` —— **只 stage，不 commit**。
這樣使用者就能在自己的 GUI 工具裡看到「即將提交什麼」，逐檔看 diff。

**如果 repo 是公開的**，順便掃一次洩漏（見 `privacy-guard` 技能）：

```sh
git ls-files -o --exclude-standard \
  | xargs grep -l -E 'C:\\Users\\[A-Za-z0-9]|/Users/[A-Za-z0-9]|/home/[A-Za-z0-9]'
```

⚠️ 用 `git ls-files -o --exclude-standard`，**不要用 `git status`**——
它會把 gitignore 掉的也算進來，造成誤報。

---

## 步驟 2 — 擬訊息，寫出待提交狀態

- **看這個 repo 自己的習慣**：`git log --oneline -10`，它是中文就寫中文，英文就寫英文
- 一行摘要 **< 72 字**，祈使語氣
- 訊息裡**不要**寫出敏感字串（真實路徑、公司名、客戶名）
- 有 body 的話寫「為什麼」，不要重複 diff 說了什麼

格式與 type 表見下面的「commit 訊息格式」。

然後寫出 `.git/DSH-PENDING/`（見下一節）。

---

## commit 訊息格式

Conventional Commits：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 只動文件 |
| `style` | 格式（不影響邏輯） |
| `refactor` | 重構（不是 feat 也不是 fix） |
| `perf` | 效能 |
| `test` | 測試 |
| `build` | 建置系統／依賴 |
| `ci` | CI／設定 |
| `chore` | 雜項維護 |
| `revert` | 回退 |

**破壞性變更**：type/scope 後面加 `!`，或在 footer 寫 `BREAKING CHANGE:`。

### 安全規則

- **NEVER** 改 git config
- **NEVER** 執行破壞性指令（`--force`、hard reset）除非使用者明確要求
- **NEVER** 跳過 hooks（`--no-verify`）除非使用者要求
- **NEVER** force push 到 main／master
- commit 因 hook 失敗時，**修好後做一個新的 commit**，不要 amend

---

## 待提交狀態 `.git/DSH-PENDING/`

```
<repo>/.git/DSH-PENDING/
├── message.txt    擬好的 commit 訊息（**使用者可以直接編輯**）
└── plan.md        檔案清單、排除清單、remote、分支、怎麼同意
```

**為什麼放 `.git/`**：git 永遠不會追蹤它（`.git/` 本身就被排除），而且語意正確
——它跟 index 一樣是「待提交的狀態」。

### `message.txt`

**只有訊息本體**，不含任何裝飾。commit 時直接讀它：

```sh
git commit -F .git/DSH-PENDING/message.txt
```

使用者**直接編輯這個檔案**就能改訊息，不用在對話裡描述「幫我把第二段改成…」。
這比來回問答快得多。

### `plan.md`

```markdown
# 待提交計畫

時間     <YYYY-MM-DD HH:MM>
repo     <owner>/<repo>    分支 <branch>
remote   <url>    ⚠️ 公開 ／ 🔒 私有

## 將提交（N）
- M   path/a.js
- A   path/b.md

## 刻意不提交（N）
- M   .env.example.local        ← 疑似本機設定

## 怎麼同意
- 回「好」→ 我用 message.txt 的內容 commit 並推送
- 要改訊息 → 直接編輯 message.txt，回「好」我就用你改過的送出去
- 要改檔案 → 告訴我，我重新 stage
```

**清單必須從 git 的實際狀態產生，不要手寫。**

```sh
git diff --cached --name-status    # 「將提交」這份，照抄它的輸出
git status --porcelain             # 用來判斷哪些被排除、為什麼
```

> ⚠️ **實際踩過**：手寫的「將提交（4）」比實際多一個——多列的那個**上一輪已經推過**，
> 而我沒去查，是憑印象寫的。
>
> 手寫的數字會跟真實狀態漂移，**而且漂移時不會報錯**——那份 plan.md 看起來完全正常，
> 只是多了一個不存在的項目。**使用者無從發現。**

### 分工：兩個地方各自看它擅長的

| 看什麼 | 在哪看 |
|---|---|
| 哪些檔案、逐行 diff | **GUI 工具**（SourceTree 等）的「Staged / 已暫存」欄 |
| commit 訊息 | **`message.txt`**（可以直接編輯） |

⚠️ GUI 工具**不會即時更新**——切回那個視窗，或按重新整理（SourceTree 是 F5）。
⚠️ **commit 訊息在 GUI 裡看不到**（commit 之前它不存在），所以訊息只能在檔案／對話裡看。

### 推完要清掉

推送成功後**刪掉** `.git/DSH-PENDING/`。它是**待提交狀態**不是紀錄——
留著的話下一次可能會誤用舊的訊息。

---

## 步驟 3 — ⛔ 停在這裡，取得一次同意

**這是整個技能的重點。** 不要跳過、不要用反問句帶過、不要「我這就推上去」。

用提問工具真的問（DSH：`ask_user_question`；Claude Code：`AskUserQuestion`）：

```
📦 準備提交並推送

repo      <owner>/<repo>    分支 <branch>    ⚠️ 公開
remote    <url>

將提交（3）
  M   path/a.js
  A   path/b.md
  ??  path/c.txt
刻意不提交（1）
  M   .env.example.local        ← 排除原因：疑似本機設定

commit 訊息
  <type>(<scope>): <一句話>

📝 完整訊息與檔案清單在 .git/DSH-PENDING/
   要改訊息 → 直接編輯 message.txt
   要看 diff → GUI 工具的「Staged」欄（記得重新整理）

⚠️ 同意後會**一次做完 commit 和 push**。
   推出去就公開且收不回來——就算之後 force push，
   GitHub 上的舊物件還在，要刪 repo 重建才清得掉。

你要怎麼做？
  ① 同意，提交並推送
  ② 只提交，先不推
  ③ 訊息或檔案要改
```

**三個不可以省的地方：**

- **「同意後會一次做完 commit 和 push」**——不寫清楚，使用者會以為只是在同意本機 commit
- **「刻意不提交」清單**——使用者要看到你排除了什麼，否則他不知道你有沒有漏掉他要的東西
- **待提交檔案的路徑**——他才知道去哪裡核對與修改

---

## 步驟 4 — 依選擇執行

| 選擇 | 做什麼 |
|---|---|
| ① 同意 | `git commit -F .git/DSH-PENDING/message.txt` ＋ push，**一次做完**，不要再問第二次 |
| ② 只提交 | 同上但不 push。**不要再問一次要不要推** |
| ③ 要改 | 改完**重新寫待提交狀態並重新顯示同意卡**，再問一次 |
| 沒回答 | **停住**。不要推、也不要 commit |

推送成功後：

1. **刪掉 `.git/DSH-PENDING/`**
2. 回報：**推到哪個 remote、哪個分支、推了幾個 commit**

### 推送失敗時

**失敗就停**，換方法重試**不超過一次**。特別是憑證類的錯誤——那是環境問題，
不是 git 問題，重試幾次都一樣（見步驟 0 的 GUI 說明）。
失敗時**不要刪 `.git/DSH-PENDING/`**，留著讓使用者手动接手。

---

## force push 要另外同意

`--force` / `--force-with-lease` **不能沿用一般推送的同意**，必須另外、明確地問。

而且要同時告訴使用者：

> **force push 不會刪掉 GitHub 上的舊 commit。** 舊物件只要記得 SHA 就還讀得出來。
> 徹底清除只有刪 repo 重建（前提是沒有 fork）。

---

## 邊界情況

| 情況 | 怎麼辦 |
|---|---|
| 沒有 remote | 停下來問要不要加，不要自己加 |
| detached HEAD | 先問要開哪個分支，不要自己決定 |
| 有未追蹤的大檔案 | 列出來問，不要默默提交 |
| 推送被拒絕（non-fast-forward） | **不要自己 pull／rebase／force**，回報並問 |
| 使用者在 GUI 裡有未提交的東西 | 提醒他先處理，你的 commit 可能跟他衝突 |
| 沙箱／權限擋住憑證 | 這是**環境問題不是 git 問題**，直接轉成手動推送 |
| 已經有舊的 `.git/DSH-PENDING/` | 先問使用者那是什麼，**不要直接覆蓋** |
