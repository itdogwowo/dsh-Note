---
name: easyeda-eprj3-format
description: '讀寫或診斷 EasyEDA Pro／嘉立創 EDA 的 .eprj3 專案檔（.epcb2、.esch2、.epan2、專案索引）。當使用者提到「嘉立創」「立創」「EasyEDA」「eprj3」「PCB 檔」「原理圖檔」，要把資料寫進 PCB 或原理圖，或問「為什麼 EasyEDA 看不到我做的東西」「這個檔是不是壞了」時載入。內含：單位（PCB=mil、原理圖=0.01in）、板框寫法（POLY＋BOARD_OUTLINE）、空白 PCB 前導、記錄與位元組慣例、九個會讓檔案靜默失效的陷阱，以及用 lceda-pro CLI 控制「正在執行的編輯器」。Load before reading, writing or diagnosing EasyEDA Pro / JLCPCB .eprj3 files by hand.'
---

# EasyEDA Pro `.eprj3` 檔案格式與陷阱

`.eprj3` 是**資料夾式**工程：一個目錄，內含 `<工程名>.eprj3` 索引、
`pcb/*.epcb2`、`sch/<原理圖>/<圖頁>.esch2`、`panel/*.epan2`。

**這份技能只講「怎麼正確讀寫它」與「哪裡會靜默壞掉」。**
要大量產生元件／用官方腳本，看 `easyeda-eprj3-authoring`。

---

## ⚠️ 鐵則 1：單位搞錯，圖會「消失」

| 領域 | 單位 | 依據 |
|---|---|---|
| **PCB**（`.epcb2`、封裝） | **mil** | 1 mm = **39.3700787** mil |
| **原理圖**（`.esch2`） | **0.01 inch** | A4 圖框 = **1170 × 825** |
| `CANVAS.unit` | **只是顯示單位** | 不影響資料本身，別被它騙 |

**症狀**：把 mm 數值直接寫進 PCB → 整張圖小 **39 倍**（例：259mm 的板變成 6.6mm），
在畫布上就是一個小點，使用者會說「**我什麼都看不見**」。

**快速自查**：一條普通走線的 `width` 合理值是 **6～23**；一片 PCB 的座標量級是**數千到數萬**。
看到 `width: 0.1`、座標 `258.88`，那就是寫成 mm 了。

> 「圖元型別都對、欄位都對、JSON 也合法，但就是看不見」→ **先懷疑單位**。

---

## ⚠️ 鐵則 2：板框是 `POLY`，不是線

板框不是「畫在板框層上的線」，而是一個帶型別的折線圖元：

```json
{"type":"POLY","id":"<16位十六進位>","ticket":1534}||{"partitionId":"","groupId":0,"netName":"","layerId":11,"width":10,"path":["R",0,3000,4000,3000,0,0],"locked":false,"zIndex":-1,"polyType":"BOARD_OUTLINE"}|
```

| 欄位 | 值 |
|---|---|
| `layerId` | `11`（板框層） |
| `polyType` | **`"BOARD_OUTLINE"`** ← 沒有這個就不是板框 |
| `width` | 10（mil） |

**`path` 是「單多邊形」扁平陣列**，前兩個數字是起點，之後是「指令＋參數」重複：

- 直線：`x0,y0, "L", x1,y1, "L", x2,y2, …`
- 圓弧：`… "ARC", angle, endX, endY …`（angle **逆時針為正**）
- 矩形：`["R", x, y, w, h, 0, 0]`（**獨立形態**，anchor 是 min-x/max-y，h 往 −y 長）
- 整圓：`["CIRCLE", cx, cy, r]`

**用 `LINE`／`ARC` 畫在 layer 11 上不是板框**——那只是幾條普通線。
（實際踩過：這樣寫出來的檔案，使用者回報「板框看不見」。）

**多片板**：`BOARD` 是**固定單例**（`id:"BOARD"`，一份文件只有一條）而且**只取第一個子路徑**
——所以**一個文件裡要放多片獨立板，只能用多個 `POLY`＋`BOARD_OUTLINE`**，不能用 `BOARD`。

---

## ⚠️ 鐵則 3：空白 PCB 有「前導」，不是只有 DOCHEAD+META

官方空白模板的記錄組成（順序大致如下）：

```
DOCHEAD → META → PRIMITIVE×N → LAYER×N → LAYER_PHYS → RULE → RULE_TEMPLATE
→ RULE_SELECTOR → SILK_OPTS → ACTIVE_LAYER → CANVAS → PREFERENCE → PANELIZE
→ NET（空佔位）→ … → 板框 POLY
```

`LAYER` 可達 **60 筆**。**只有 DOCHEAD＋META＋圖元**的檔案，
在用戶端可能整批不顯示——因為層堆疊根本沒有定義。

**取得方式**：官方 skill 倉庫的 `templates/pcb.epcb2` 就是一份可直接用的空白 PCB
（<https://github.com/easyeda/easyeda-eprj3-skill>）。
做法是**以它為底，只替換 DOCHEAD／META／板框**，其餘前導照抄。

---

## 記錄結構與位元組慣例

```
{外層}||{內層}|
 ↑type/id/ticket   ↑實際資料（可為空字串）
```

| 慣例 | 值 |
|---|---|
| 換行 | **LF**（不是 CRLF） |
| 每行結尾 | `\|` |
| **最後一行** | **沒有** `\|` |
| 檔尾 | **沒有**換行 |

**它是追加式日誌，不是快照**：

- **刪除一筆**＝再寫一行、**內層留空**（`{"type":"X","id":"…","ticket":N}||`）
- **空 body ≠ 壞檔。** 一份檔案有 **70% 空 body 完全可能是正常的墓碑累積**——
  不要看到大量空 body 就喊「檔案損毀」（實際誤判過，虛驚一場）。
- 同一個 id 出現多行時的判優：**ticket 大者勝**；ticket 相同時比**文件頭的 `client`**，
  **字典序大者勝**（注意方向，舊文件寫反了）。

---

## 欄位慣例（照這個寫，不要自創）

| 欄位 | 正確值 | 備註 |
|---|---|---|
| `groupId` | **數字 `0`** | ⚠️ 未分組時。官方 JSON Schema 寫 `string` 是**錯的**——實測真機資料 `"groupId":0` 五千餘筆、`"groupId":"0"` **一筆都沒有**。以說明為準，不是以 schema |
| `partitionId` | `""` | 非 `null` |
| `zIndex` | `-1` | 未設定時 |
| `locked` | `false` | |
| `width` | mil | 板框慣用 10 |
| `id` | 16 位十六進位 | 單例原子直接用型別名：`META`／`CANVAS`／`BOARD` |
| 座標精度 | 4 位小數足夠 | 0.0001 mil ≈ 2.5 nm |

---

## 九個會靜默失效的陷阱

| # | 陷阱 | 症狀 | 怎麼辦 |
|---|---|---|---|
| 1 | **單位寫成 mm** | 圖小 39 倍、「看不見」 | 見鐵則 1 |
| 2 | **板框用 LINE/ARC** | 板框不顯示、板子不成形 | 見鐵則 2 |
| 3 | **缺層堆疊前導** | 圖元存在但不顯示 | 見鐵則 3 |
| 4 | **`groupId` 寫字串** | 可能被判為無效而丟棄 | 寫數字 `0` |
| 5 | **DOCHEAD 的 ticket 變體** | 官方 `validate.js` **解析出 0 個文件後崩潰**（`Cannot read properties of undefined`） | 官方驗證器的 `docsOf()` 只認**完全等於** `{"type":"DOCHEAD"}` 的行；用戶端寫的是 `{"type":"DOCHEAD","ticket":192}`。**這是驗證器的限制，不是檔案的錯**——不要為了迎合它去改檔案 |
| 6 | **`yAxisDirection` 混用** | 電路與圖框**上下鏡像**（電氣沒錯，但看起來整片跑到圖框下方） | 這個鍵**只有原理圖家族**有（PCB 沒有）。缺省 ≡ `"down"`。同一份檔案裡新舊記錄要**一致**；用戶端存檔時會自動正規化（把 y 取負並補上標記），所以「開檔後存一次」就能修 |
| 7 | **只認 CRLF 的解析器 × 用戶端存成 LF** | 用戶端存檔後整個檔案「變一行」，誤判為全部損壞 | 用戶端**會把換行改成 LF**（實測 `\r` 0 個），位元組數因此少約 1%。解析一律用 `split(/\r?\n/)` |
| 8 | **`STRING` 的 `fontFamily` 填了不在清單裡的字體** | 開檔跳「未找到该字体，已自动切换为浏览器默认字」 | 實測只有 **10 種**可用：`default`、`default2`、`宋体`、`黑体`、`隶书`、`楷体`、`仿宋`、`Arial`、`Times New Roman`、`Verdana`。用 API 查：`eda.sys_FontManager.getFontsList()` |
| 9 | **手寫 `STRING` 記錄會被靜默丟棄** | 檔案裡有 3 筆文字，編輯器只認得 2 筆（第 3 筆消失、沒有任何錯誤） | 文字這類編輯器語意重的圖元**走 API 建立**（見下一節），不要手寫 |

---

## 控制**正在執行的**編輯器：`lceda-pro` CLI

2026-10-15 實測。**不需要叫使用者關掉 EDA。** `.eprj3` 是資料夾格式，官方文件寫明
"disk edits reload automatically, editor saves land on disk automatically"（雙向同步）。

| 做法 | 怎麼做 | 什麼時候用 |
|---|---|---|
| **A. 寫檔 + 請他按 F5** | 直接改 `.epcb2`／`.esch2` | 批次幾何：大量 via／走線／鋪銅 |
| **B. 走 CLI 讓編輯器自己改**（推薦） | `lceda-pro invoke` 對**開著的視窗**跑 JS，改完 `pcb_Document.save()` | 文字、字體、需要編輯器語意的地方；可順便導航與截圖 |

### 三個前置（少一個就不會動）

1. **CLI 與 bridge 由 `lceda-pro.exe` 本身提供**（V4.1.60+）。文件在裝機目錄：
   `<安裝目錄>/docs/{cli-for-ai.md, easyeda-cli_zh.md, easyeda-format.md}`。
2. ⚠️ **一定要先清掉環境變數 `ELECTRON_RUN_AS_NODE`**。它在 Electron 環境裡常被設成 `1`，
   會讓 `lceda-pro.exe` 被當成純 Node 執行 → **每個子命令都變成「找不到模組」**。
   ```powershell
   Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
   & "<安裝目錄>\lceda-pro.exe" doctor
   # → {"ok":true,"value":{"connected":true,"bridgeVersion":"…","versionMatch":true}}
   ```
3. **引號**：命令行用 PowerShell 腳本包起來（`& <exe> @Args 2>&1`）。用 `cmd /c` 加多層引號很容易把參數打爛。

### 常用命令

```shell
lceda-pro doctor                       # 探測 bridge
lceda-pro session list                 # 列出所有編輯器視窗（origin: user = 使用者自己開的）
lceda-pro invoke --session <id> --code-file <x.js>   # 在那個視窗裡跑 JS（async function body，用 return 回傳）
lceda-pro doc api                      # 列出 eda 命名空間的類別（381 個）
lceda-pro doc api --class-name PCB_PrimitiveString --method-name create   # 完整簽名＋官方範例
lceda-pro doc api --class-name EPCB_PrimitiveStringAlignMode              # 列舉值
```

> `--code-file` 是實測可用的寫法；`--code` 的引號在 PowerShell 下容易被打爛。

### 好用的 API（`eda.` 命名空間）

| API | 用途 |
|---|---|
| `sys_FontManager.getFontsList()` | 可用的字體清單（只有 10 種） |
| `pcb_PrimitiveString.create(layer,x,y,text,fontFamily,fontSize,lineWidth,alignMode,rotation,reverse,expansion,mirror,primitiveLock)` | 建立文字。**參數順序照官方範例**（不是檔案欄位順序） |
| `pcb_PrimitiveString.getAll() / delete(id) / modify(id, props)` | 文字的操作 |
| `pcb_Document.save()` | **讓編輯器自己存檔**（回 boolean） |
| `pcb_Document.getCanvasOrigin()` | 畫布原點相對資料原點的偏移（實測常見 `{0,0}`，即座標無偏移） |
| `pcb_Document.convertDataOriginToCanvasOrigin(x,y)` | 資料座標 → 畫布座標 |
| `pcb_Document.navigateToCoordinates(x,y)` | **移動使用者的視圖**到指定座標 |
| `pcb_Document.zoomToBoardOutline()` / `dmt_EditorControl.zoomToAllPrimitives()` | 縮放至板框／全部 |
| `dmt_EditorControl.getCurrentRenderedAreaImage()` | **抓編輯器畫布影像**（回 PNG Blob） |
| `dmt_Board.getCurrentBoardInfo()` / `dmt_Pcb.getCurrentPcbInfo()` | 確認目前是哪個工程／板子 |

**不需要叫對方操作**：`navigateToCoordinates` 與 `zoomTo…` 會直接改動他那扇視窗的視圖，
`getCurrentRenderedAreaImage` 則讓你看到「他實際看到什麼」。

### 用戶端存檔時會自己改檔案（要知道才不會誤判）

| 項目 | 手寫 | 用戶端存檔後 |
|---|---|---|
| 換行 | 你寫的（常是 CRLF） | **LF** |
| 墓碑記錄（body 空、`…}|||`） | — | 會出現（圖片刪除留下的），**不是損壞** |
| y 座標 | — | **不會**取負（PCB 沒有 y 反轉；只有原理圖家族有 `yAxisDirection`） |

---

## 驗證紀律：從**產出**反推，不信產生器的宣告

寫完檔案後，**獨立地從檔案本身重算**，不要相信產生器說「我寫對了」：

1. **逐行解析**：每行 `head||body`、JSON 合法、統計型別數量
2. **幾何反推**：圓弧用 **弦長 ÷ (2·sin(θ/2))** 反算半徑，比對設計值
   （實測可達 ±0.0003 mm，證明沒有縮放）
3. **閉合檢查**：閉合輪廓的起終點距離應 < 0.05 mm
4. **計數比對**：元件數、焊盤數、網路數是否符合預期
5. **往返比對**：已知的輸入值 vs 檔案裡的值，逐項比對位置與角度

> 這條紀律抓到過：弧頂沒被算進 bounding box（因為只取了端點）、
> 四隻腳全被接到同一個電源網路（因為焊盤編號是**字串**）。

---

## 相關來源

- 格式規範：<https://github.com/easyeda/easyeda-file-format>
  （舊名 `easyeda-pro-file-format`，API 會轉址）
- 官方工程 skill（含 `templates/pcb.epcb2`、`scripts/`）：
  <https://github.com/easyeda/easyeda-eprj3-skill>
- CLI 與擴充 API 文件（**裝機目錄就有**，不需要上網）：
  `<安裝目錄>/docs/`（`cli-for-ai.md` 是給 AI 看的版本；線上版
  <https://prodocs.lceda.cn/storage/texts/api/guide/cli-for-ai.md>）
- 線上擴充 API 手冊：<https://prodocs.lceda.cn/cn/api/>
- 官方格式 skill（JSON Schema 與逐欄位說明，**真機樣本**為準）：
  <https://github.com/easyeda/easyeda-pro-format-skill>

> 三者衝突時：**真機樣本 > 官方說明 > JSON Schema**。
> （`groupId` 就是活例子：schema 與說明不一致，真機樣本才是對的。）
