---
name: git-push
description: '準備推送並取得逐次同意。當使用者說「幫我推」「推上去」「push 上去」「commit 然後推」「發佈」時載入。流程：偵測可用的推送工具 → 挑選要提交的檔案 → 擬 commit 訊息 → 顯示完整計畫 → 使用者選自己推或讓 AI 推。⚠️ 授權只對這一次有效；force push 必須另外同意。'
whenToUse: '使用者表達要推送、或要 commit 之後推上去的時候。'
---

# Git Push — 準備、確認、推送

commit 的**格式**細節見 `git-commit` 技能（conventional commits、type 表、breaking change）。
這份技能管的是**流程**：偵測工具、挑檔案、擬訊息、**取得同意**、執行。

---

## 鐵則：一次授權只對一次有效

使用者說「幫我推」＝ 授權**這一次**的推送。
下一個 commit 要推，**要重新問**。

> ⚠️ **這一條就是這個技能存在的理由。** 實際發生過：AI 拿到兩次針對特定任務的推送同意
> 之後，就把它當成常設授權，接下來**四次推送都沒問**。
> **單次同意 ≠ 常設授權。**

推出去是公開且不可逆的。commit 是本機的、可以 reset；push 不是。
所以界線畫在 push：**commit 自己做，push 每次問**。

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
> 用它的絕對路徑也許跑得動，但 **push 失敗於憑證時不要反覆重試**：
> `SEC_E_NO_CREDENTIALS`、`could not read Username` 這類錯誤，
> 換 TLS 後端或換指令只會換一個症狀。
> 正確做法：**停下來，請使用者開他的 GUI 按推送**——那裡有憑證。
>
> 提醒他：GUI 可能還沒看到新的 commit，要**重新整理**。

---

## 步驟 1 — 決定要提交什麼

**不要 `git add -A`。** 先看：

```sh
git status --porcelain
git diff --stat
```

排除這些（就算使用者沒說）：

- 憑證、`.env`、私鑰
- 暫存檔、建置產物、`node_modules`
- 大的二進位檔

**如果 repo 是公開的**，順便掃一次洩漏（見 `privacy-guard` 技能）：

```sh
git ls-files -o --exclude-standard \
  | xargs grep -l -E 'C:\\Users\\[A-Za-z0-9]|/Users/[A-Za-z0-9]|/home/[A-Za-z0-9]'
```

⚠️ 用 `git ls-files -o --exclude-standard`，**不要用 `git status`**——
它會把 gitignore 掉的也算進來，造成誤報。

---

## 步驟 2 — 擬 commit 訊息

- **看這個 repo 自己的習慣**：`git log --oneline -10`，它是中文就寫中文，英文就寫英文
- 一行摘要 **< 72 字**，祈使語氣
- 訊息裡**不要**寫出敏感字串（真實路徑、公司名、客戶名）
- 有 body 的話寫「為什麼」，不要重複 diff 說了什麼

格式與 type 表見 `git-commit`。

---

## 步驟 3 — ⛔ 停在這裡，把完整計畫給使用者

**這是整個技能的重點。** 不要跳過、不要用反問句帶過、不要「我這就推上去」。

用提問工具真的問（DSH：`ask_user_question`；Claude Code：`AskUserQuestion`），
內容長這樣：

```
📦 準備推送

repo      <owner>/<repo>    分支 <branch>    ⚠️ 公開
remote    <url>
新增 commit  1 個
  <sha>   <訊息第一行>

將提交（3）
  M  path/a.js
  A  path/b.md
  ?? path/c.txt
刻意不提交（1）
  M  .env.example.local        ← 排除原因：疑似本機設定

⚠️ 推出去就公開了，而且收不回來。
   （就算之後 force push，GitHub 上的舊物件還在——要刪 repo 重建才清得掉）

你要怎麼做？
  ① 我自己推（給我操作步驟）
  ② 你幫我推
  ③ 只 commit，先不推
```

**「刻意不提交」那份清單不可以省。** 使用者要看到你排除了什麼，
否則他不知道你有沒有漏掉他要的東西。

---

## 步驟 4 — 依選擇執行

| 選擇 | 做什麼 |
|---|---|
| ① 我自己推 | commit 做好，給他操作步驟（含「GUI 要重新整理」） |
| ② 你幫我推 | 用偵測到的 git 推。**失敗就停**，換方法重試不超過一次 |
| ③ 只 commit | commit 完就停，不要再問一次要不要推 |

推送成功後回報：**推到哪個 remote、哪個分支、推了幾個 commit**。

---

## force push 要另外同意

`--force` / `--force-with-lease` **不能沿用一般推送的授權**，必須另外、明確地問。

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
