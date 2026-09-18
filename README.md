# dsh-Note

**DSH 的跨機器同步 ＋ 使用筆記。**

兩件事放在一起：

1. **`notes/`** — 實際上被絆到過的經驗與小技巧（不是官方文件轉抄），按子系統分類
2. **`sync/`** — 讓另一台電腦的 DSH 變成同一副樣子的可攜內容

## 筆記

從 [`notes/README.md`](notes/README.md) 開始（索引 ＋ 寫作慣例）。

| 檔案 | 範圍 |
|---|---|
| [`notes/skills.md`](notes/skills.md) | 技能系統：格式、目錄、**觸發原理**、開關、兩個入口 |
| [`notes/instructions.md`](notes/instructions.md) | `AGENTS.md` / 全域指示 |
| [`notes/plugins.md`](notes/plugins.md) | 插件、profile、兩層啟停、怎麼判斷有沒有生效 |
| [`notes/ui.md`](notes/ui.md) | GUI：輸入框的 `/` 與 `@`、側邊欄、工具列 |
| [`notes/sync.md`](notes/sync.md) | 跨機器同步：什麼能同步、只存 URL 的鐵則 |
| [`notes/privacy.md`](notes/privacy.md) | 公開 repo 的隱私紅線 |
| [`notes/pitfalls.md`](notes/pitfalls.md) | **踩過的坑**，每條有日期（append-only） |
| [`notes/open.md`](notes/open.md) | 還沒解的問題、想做的事 |

> 子系統文件是**活文件**（錯了就改）；`pitfalls.md` 是**append-only**
> （每條是歷史事件，後來的理解可以補充但不覆蓋原症狀）。

## 維護筆記的技能

`.dsh/skills/note-sync/` 是一個**專案技能**——在這個 repo 裡工作時，
DSH 會從 `<專案>/.dsh/skills/` 掃到它。說「記到 notes」「這個坑記一下」「更新筆記」
就會載入。

它做兩件事：

- **記錄踩坑** → append 進 `notes/pitfalls.md`（有日期，格式固定）
- **更新子系統文件** → 改寫 `notes/skills.md` 這類活文件

**為什麼放 repo 裡而不是 `~/.dsh/skills/`**：跟著 repo 走、會被同步，
而且技能裡不需要寫死任何路徑（`~/.dsh/skills/` 是使用者層，跨機器要另外同步）。

> 代價：只有在 `dsh-Note` 這個目錄裡工作時才叫得到。
> 想在其他 repo 隨手記的話，把整個資料夾複製到 `~/.dsh/skills/`——但那就變成兩份副本了。

---

## 核心設計：只存 URL，不存路徑

DSH 的 profile 依賴有四種形狀，其中兩種**機器專屬**：

| 寫法 | 可攜 | 處置 |
|---|---|---|
| npm 版本號 `"pkg": "1.2.3"` | ✅ | 直接存 |
| 遠端 URL `"https://…/main.tar.gz"` | ✅ | 直接存 |
| `"link:C:/Users/<你>/code/my-plugin"` | ❌ | **換成該專案的 GitHub URL** |
| `"file:C:/Users/<你>/.dsh/plugins-src/x.tgz"` | ❌ | **換成來源套件的 URL** |

所以這個 repo 裡**沒有任何一個絕對路徑**。每台機器自己的 `link:` 覆寫放
`machines/<hostname>.json`，那個檔案**已 gitignore**，不會公開。

> 用 `archive/refs/heads/main.tar.gz` 而不是 `archive/<SHA>.tar.gz`：
> SHA 會隨歷史重寫而死，實際踩過。

## 目錄

```
dsh-Note/
├── notes/                   經驗與技巧（見上面的索引）
├── .dsh/skills/note-sync/   維護 notes/ 的技能（見下）
├── sync/
│   ├── skills/            ← ~/.dsh/skills/ 的鏡像
│   ├── settings.yaml      ← ~/.dsh/settings.yaml
│   └── plugins/
│       ├── dependencies.json   插件來源（URL／npm spec）
│       ├── bundles.json        dsh.profile.bundles 的順序
│       └── rows.yml            cordis.patch.yml（插件啟停覆寫）
└── machines/
    ├── example.json       本機覆寫的格式範例
    └── <host>.json        你自己的（已 gitignore）
```

## 換一台新電腦

```sh
git clone https://github.com/itdogwowo/dsh-Note
cd dsh-Note
```

1. **技能** → 複製 `sync/skills/` 到 `~/.dsh/skills/`
2. **設定** → 複製 `sync/settings.yaml` 到 `~/.dsh/settings.yaml`
3. **插件啟停** → 複製 `sync/plugins/rows.yml` 到 `~/.dsh/profiles/web/cordis.patch.yml`
4. **插件** → 照 `sync/plugins/dependencies.json` 逐個安裝（`dsh plugin --profile web add <URL>`），
   順序照 `bundles.json`
5. 重啟 `dsh web`

> 本機開發的插件（`link:` 到工作目錄）不要從 URL 裝：
> 複製 `machines/example.json` 成 `machines/<hostname>.json`，把本機路徑填進去。

細節見 [`notes/sync.md`](notes/sync.md)。

## 同步回去（這台 → repo）

```sh
cp -r ~/.dsh/skills/. sync/skills/
cp ~/.dsh/settings.yaml sync/settings.yaml
cp ~/.dsh/profiles/web/cordis.patch.yml sync/plugins/rows.yml
git add -A && git commit -m "sync: <做了什麼>" && git push
```

**提交前先掃一次**（這個 repo 是公開的）：

```powershell
# 只掃真的會被 commit 的檔案（不要用 git status，它會把 gitignore 的也算進來）
git ls-files -o --exclude-standard | ForEach-Object {
  Select-String -Path $_ -Pattern 'C:\\Users\\[A-Za-z0-9]|/Users/[A-Za-z0-9]|/home/[A-Za-z0-9]'
}
```

## 沒有同步的東西

| 不同步 | 為什麼 |
|---|---|
| `.credentials.yaml` | 憑證 |
| `sessions/` | 上百 MB，體積＋隱私 |
| `attachments/`／`storages/` | 同上 |
| `profiles/*/node_modules` | 重裝就好 |
| `taverns.json` | 存的是絕對路徑 |
| `dsh-web.log` | 每次啟動的埠與 token 都不同 |

要同步的實際上只有**約 1.7 MB**。

## 隱私

這個 repo 是 **public**。裡面的內容必須是「可公開」的：

- 只有樣板路徑（`<你的帳號>`、`<專案>`），沒有真實路徑
- 沒有公司名、內部專案名、客戶名
- 不放截圖（畫面裡的側邊欄有工作區名稱與完整路徑）

而且要知道：**`force push` 不會刪掉 GitHub 上的舊 commit**——
只要記得 SHA 就還讀得出來。詳見 [`notes/privacy.md`](notes/privacy.md)。

## 授權

`notes/` 與 `sync/plugins/` 的內容是這個 repo 自己的。

`sync/skills/` 底下是第三方技能，各自帶自己的 LICENSE：

- Apache-2.0（`algorithmic-art`、`brand-guidelines`、`frontend-design`、`mcp-builder`、`theme-factory`、`web-artifacts-builder`、`webapp-testing`）
- MIT（`git-commit`、`react-best-practices`、`react-native-skills`、`redis-development`）

兩者都允許再散布，**條件是 LICENSE 檔要跟著**（repo 裡已包含）。
著作權屬於各自的作者，不是這個 repo。
