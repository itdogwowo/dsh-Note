# EasyEDA Pro／嘉立創 EDA：CLI 與工程檔

> 這個領域的安排：**領域知識放技能**（`~/.dsh/skills/easyeda-eprj3-format\SKILL.md`、
> `easyeda-eprj3-authoring`、`pcb-outline-from-cad`、`led-array-design`、`jlcpcb-fab-rules`），
> 這裡只記**跨專案、跟 DSH 本身有關**的部分：怎麼從 DSH 驅動那個編輯器，以及它會怎麼動我們的檔案。

---

## ⭐ 最重要的一件事：不用叫使用者關掉 EDA

**舊做法**（錯誤）：「改完工程檔要提醒使用者關閉並重新開啟 EasyEDA Pro」。
**2026-10-15 實測推翻**：`.eprj3` 是**資料夾格式**，官方文件寫明與編輯器**雙向同步**：

> `open` — ".eprj3 folder projects stay in two-way sync with the editor
> (disk edits reload automatically, editor saves land on disk automatically)"

| 做法 | 怎麼做 | 什麼時候用 |
|---|---|---|
| **A. 寫檔 + 請他按 F5** | 直接改 `.epcb2`／`.esch2` | 批次幾何（大量 via／走線／鋪銅） |
| **B. 走 CLI 讓編輯器自己改**（推薦） | `lceda-pro invoke` 對**開著的視窗**跑 JS | 文字、字體、需要編輯器語意的地方 |

實測時間軸（EDA 全程開著）：

| 時間 | 事件 |
|---|---|
| 02:56 | 寫入 39 個 via 到 `.epcb2` |
| 02:56–02:57 | 取樣 6 次／25 秒 → **完全沒被動**、檔案**沒被鎖**（可讀寫、可 rename） |
| 03:05 | 使用者按 **F5** → `.eprj3` 被碰（專案索引），**PCB 檔本身沒變** |
| 03:09 | 使用者另一個操作後 → **EDA 自己重寫整個 PCB 檔** |

**推論（有實測支持）**：EDA **不會週期性自動存檔**。舊筆記說「幾十秒內被蓋回」，
那次時間點正好落在 **git pull／外部檔案變動之後** → 那是**它偵測到檔案變了、自己重載再重存**。

---

## CLI：`lceda-pro` 就是那個可執行檔本身

GUI 與 CLI 是同一個 `lceda-pro.exe`（V4.1.60+）。文件**裝機就有**：
`<安裝目錄>/docs/{cli-for-ai.md, easyeda-cli_zh.md, easyeda-format.md}`。

### ⚠️ 前置：一定要清掉 `ELECTRON_RUN_AS_NODE`

DSH 的行程環境裡這個變數常是 `1`。留著的話，`lceda-pro.exe` 會被當成**純 Node**執行 →
`lceda-pro doctor` 變成「Cannot find module ...\doctor」，**每個子命令都失敗**，而且訊息完全不像權限或路徑問題。

```powershell
# 包成一支腳本最省事（PowerShell 的引號處理比 cmd 可靠）
param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "<安裝目錄>\lceda-pro.exe" @Args 2>&1
```

```
> lceda.ps1 doctor
{"ok":true,"value":{"endpoint":"JLCEDAPro…","connected":true,"bridgeVersion":"4.1.71…","versionMatch":true}}
```

### 常用命令

| 命令 | 用途 |
|---|---|
| `doctor` | 探測 bridge 與版本是否相符 |
| `session list` | 列出所有編輯器視窗。**`origin: user` = 使用者自己開的那個** |
| `invoke --session <id> --code-file <x.js>` | 在該視窗跑 JS（async function body，`return` 的值放在 `value`）|
| `doc api [--class-name C] [--method-name M]` | 查擴充 API（381 個類別）＋**官方範例** |
| `doc format …` | 查設計檔格式 |

> `--code-file` 實測可用；`--code` 的字串引號在 PowerShell／cmd 下很容易被打爛。

### 已驗證好用的 API（`eda.`）

| API | 用途 |
|---|---|
| `sys_FontManager.getFontsList()` | **可用的字體清單**（實測只有 10 種） |
| `pcb_PrimitiveString.create(layer,x,y,text,fontFamily,fontSize,lineWidth,alignMode,rotation,reverse,expansion,mirror,primitiveLock)` | 建立文字。**順序照官方範例**，不是檔案欄位順序 |
| `pcb_PrimitiveString.getAll() / delete(id) / modify(id, props)` | 文字操作 |
| `pcb_Document.save()` | **讓編輯器自己存檔**（回 boolean） |
| `pcb_Document.getCanvasOrigin()` | 畫布原點偏移（實測 `{0,0}`） |
| `pcb_Document.convertDataOriginToCanvasOrigin(x,y)` | 資料座標 → 畫布座標 |
| `pcb_Document.navigateToCoordinates(x,y)` | **移動使用者的視圖** |
| `pcb_Document.zoomToBoardOutline()` / `dmt_EditorControl.zoomToAllPrimitives()` | 縮放 |
| `dmt_EditorControl.getCurrentRenderedAreaImage()` | **抓他畫布的實際畫面**（PNG Blob） |

**「讓使用者馬上看到」不需要他動手**：`navigateToCoordinates` 與 `zoomTo…` 直接改他那扇視窗。

---

## 用戶端重寫檔案時會改什麼

| 項目 | 手寫 | 用戶端存檔後 | 怎麼驗 |
|---|---|---|---|
| 換行 | 常是 CRLF | **LF**（實測 `\r` 0 個），位元組數少約 1% | `grep -c $'\r'` 或 `raw.includes('\r\n')` |
| 墓碑記錄 | — | 會出現（`{"type":"X",…}|||`，**body 空**） | 解析時**跳過 body 為空的行**，不要當損壞 |
| y 座標 | — | **不取負**（PCB 沒有 y 反轉） | 比對元件 y 的正負 |
| 圖元內容 | — | 保留（實測 via／line／string／component 計數不變） | 逐型別計數 |

---

## 三條「只有踩過才知道」的細節

1. **`STRING` 的座標欄位是 `x`／`y`，不是官方 md 寫的 `positionX`／`positionY`。**
   `origin` 是**字串**（`LEFT_BOTTOM` 等），而 API 的 `alignMode` 是**數字**（3 = 左下）。
   兩者不一致是常態——**以 JSON Schema 與真機樣本為準**。
2. **手寫的文字會被靜默丟棄。** 同一批 3 個文字：手寫進檔 → 編輯器只認 **2/3**（沒有錯誤訊息）；
   走 API `create` → **3/3**。**文字走 API，批次幾何才手寫檔案。**
3. **字體只有 10 種**：`default`、`default2`、`宋体`、`黑体`、`隶书`、`楷体`、`仿宋`、`Arial`、`Times New Roman`、`Verdana`。
   填別的 → 開檔跳「未找到该字体，已自动切换为浏览器默认字」。

---

## 怎麼知道它活著

```powershell
> lceda.ps1 doctor
{"ok":true,"value":{"endpoint":"JLCEDAPro…","connected":true,"bridgeVersion":"4.1.71…","versionMatch":true}}
```

`connected: true` 且 `versionMatch: true` 才算通。只有 `endpoint` 有值不算。
