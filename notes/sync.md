# 跨機器同步

目標：讓另一台電腦的 DSH 變成同一副樣子——插件、技能、設定。

## 什麼可以同步、什麼絕對不行

| 類別 | 路徑 | 判斷 |
|---|---|---|
| 技能 | `~/.dsh/skills/` | ✅ |
| 使用者設定 | `~/.dsh/settings.yaml` | ✅ |
| 插件啟停 | `profiles/web/cordis.patch.yml` | ✅ |
| 插件依賴清單 | `profiles/web/package.json` 的 deps | ⚠️ 見下節 |
| Agent preset | `~/.dsh/.agent-presets/` | ⚠️ 常含機器路徑 |
| 自動核准規則 | `auto-approve/allowlist.json` | ⚠️ 可能含機器路徑 |
| **憑證** | `.credentials.yaml` | ❌ **絕對不行** |
| 對話紀錄 | `sessions/` | ❌ 上百 MB ＋ 隱私 |
| 附件 | `attachments/` | ❌ |
| 儲存庫 | `storages/` | ❌ |
| `node_modules` | `profiles/*/node_modules` | ❌ 重裝就好 |
| 酒館清單 | `taverns.json` | ❌ 存的是絕對路徑 |
| 日誌 | `dsh-web.log` | ❌ 每次啟動的埠與 token 都不同 |

**要同步的其實只有一兩 MB。**

## ⭐ 鐵則：只存 URL，不存路徑

`package.json` 裡的依賴有四種形狀（見 [`plugins.md`](plugins.md)），
其中 `link:` 和 `file:` 是**機器專屬**的絕對路徑：

```
"link:C:/Users/<你>/code/my-plugin"        ← 換一台就錯
"file:/Users/<你>/.dsh/plugins-src/x.tgz"  ← 換一台就錯
```

**同步的是 URL。** 每個插件通常都有可攜來源：

- 本機開發的插件 → 它的 GitHub repo
- 本機 tarball → 查 tarball 裡 `package.json` 的 `repository.url`
- npm 套件 → 版本號本身就是可攜的

每台機器自己的 `link:` 覆寫放**已 gitignore** 的 `machines/<hostname>.json`。

### 用 `main` 而不是 SHA

```
✅ https://github.com/<owner>/<repo>/archive/refs/heads/main.tar.gz
❌ https://github.com/<owner>/<repo>/archive/<SHA>.tar.gz
```

前者永遠抓最新；後者在 commit 被重寫（見 [`privacy.md`](privacy.md)）之後會 **404**。
實際發生過：profile 裡指著一個已經不存在的 SHA，裝好的照常運作，
但任何一次重裝都會失敗。

## 帶什麼、怎麼帶

```
sync/skills/            ← 複製 ~/.dsh/skills/ 整個目錄
sync/settings.yaml      ← 複製 ~/.dsh/settings.yaml
sync/plugins/rows.yml   ← 複製 ~/.dsh/profiles/web/cordis.patch.yml
sync/plugins/*.json     ← 插件 URL 清單與 bundles 順序
```

**另一台機器**：把 `sync/` 的內容複製回 `~/.dsh/` 對應位置 → 照 `dependencies.json`
逐個裝插件（順序照 `bundles.json`）→ 重啟 `dsh web`。

## 提交前一定要掃

因為這個 repo 是公開的。**只掃真的會被 commit 的檔案**：

```powershell
git ls-files -o --exclude-standard | ForEach-Object {
  Select-String -Path $_ -Pattern 'C:\\Users\\[A-Za-z0-9]|/Users/[A-Za-z0-9]|/home/[A-Za-z0-9]'
}
```

> **不要用 `git status` 掃。** 它會把已 ignore 的檔案也列進來（未追蹤目錄被摺疊成
> `?? machines/`），造成誤報。`ls-files -o --exclude-standard` 才是「會被 commit 的」。

### 誤判的來源

- `/users/${id}`、`/users/{id}` —— Express／FastAPI 的 **API 路由**，不是家目錄。
  用**大小寫敏感**的比對可以濾掉大部分
- `/Users/...` —— 樣板寫法用了三個點，嚴格說不算洩漏，但掃描器會叫。
  改用 `<家目錄>` 這種寫法最省事

## 兩份副本會漂移

複製過去之後，兩台的技能就是**兩份獨立副本**——改一邊不會同步另一邊。

要單一來源的話可以用目錄連結（Windows 的 `mklink /J`、macOS 的 `ln -s`），
但那樣兩邊的目錄結構就綁死了，而且 git 對連結的處理各平台不一致。

**目前選擇：兩份副本 ＋ 明確的同步方向（這個 repo 是來源）。**
