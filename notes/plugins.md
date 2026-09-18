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
