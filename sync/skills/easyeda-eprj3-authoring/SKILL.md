---
name: easyeda-eprj3-authoring
description: '用官方腳本大量產生或修改 EasyEDA Pro／嘉立創 EDA 工程：批次放元件、建符號與封裝、畫板框、產生原理圖。當使用者說「幫我放幾百顆 LED」「批次放元件」「建一個封裝」「產生原理圖」「用官方腳本」，或要對 .eprj3 做大量編輯時載入。內含：官方兩個倉庫的分工、單行程批次模式（千萬不要呼叫 CLI N 次）、元件庫暫存、DEVICE 組成，以及四個會產出壞資料的陷阱。Load when generating or batch-editing EasyEDA Pro projects with the official toolchain.'
---

# EasyEDA Pro 官方工具鏈：批次產生工程

官方有**兩個必須搭配**的倉庫，缺一不可：

| 倉庫 | 角色 |
|---|---|
| <https://github.com/easyeda/easyeda-eprj3-skill> | **程序**：`scripts/`（init／add-*／generate-*／validate／cleanup）、`templates/`、`scripts/lib/eprj3.js` |
| <https://github.com/easyeda/easyeda-pro-format-skill> | **規範**：JSON Schema、逐欄位說明、真機樣本與範例 |

> 官方明文要求：**不得只憑 eprj3-skill 就產生檔案**，必須先讀過格式 skill。
> 檔案格式本身的陷阱，見 `easyeda-eprj3-format`。

先把兩個都 clone 到一個工作目錄（例如 `<repo>/.git/scratch/`，那個位置 git 不追蹤），
之後所有 `node scripts/…` 都以該目錄為基準。

---

## ⭐ 鐵則：用**一個行程**批次做，不要呼叫 CLI N 次

官方 CLI（`add-footprint.js`、`add-symbol.js`…）**每呼叫一次就重讀重寫整個檔案**。
要放 808 顆元件時這樣做會是 O(n²)，實務上跑不完。

**正確做法**：寫一支 Node 腳本，`require('<skill>/scripts/lib/eprj3.js')`，
在**同一個行程**裡跑完整批，最後寫檔一次。

`add-footprint.js` 的原始碼就是最好的範本——照它的順序，但把迴圈包在外面：

```js
const E = require('<skill>/scripts/lib/eprj3.js');
const project = E.Project.load(DIR);              // 只載入一次
const sym = project.loadLibrary('<符號名>');
const fp  = project.loadLibrary('<封裝名>');
const file = project.pcbFile(project.requirePcb('<PCB名>'));

// 1) 嵌入 SYMBOL + FOOTPRINT + DEVICE 文件（一次）
E.insertDocsBeforeMain(file, [
  E.rewriteDocHeads(sym.symbolDoc, project.client),
  E.rewriteDocHeads(fp.footprintDoc, project.client),
  E.rewriteDocHeads(deviceDoc, project.client),
]);

// 2) 網路（一次）
E.ensurePcbNets(file, [...nets]);

// 3) 迴圈放元件，累積在記憶體
let lines = E.readLines(file);
let ticket = E.maxTicketOfLines(lines) + 1;
for (const item of items) {
  const blk = E.pcbComponentBlock({ ...ticketBase: ticket });
  lines = lines.concat(blk.lines);
  ticket = blk.nextTicket;                        // 它會回傳用到的最大 ticket
}
E.writeLines(file, lines);                        // 只寫一次
project.save();
```

**需要的函式**：`Project.load`／`loadLibrary`／`pcbFile`／`ms`／`save`、
`buildDeviceDoc`／`insertDocsBeforeMain`／`rewriteDocHeads`、
`pcbComponentBlock`／`schComponentBlock`／`pcbNetLine`／`ensurePcbNets`、
`readLines`／`writeLines`／`maxTicketOfLines`／`nextUniqueId`／`randId`／`uuid16`／`parseRecord`。

---

## 元件庫的兩層

| 層 | 位置 | 生命週期 |
|---|---|---|
| **預設條目** | skill 的 `templates/library/`（RES／CAP／LED… 與 A3／A4 圖框） | 隨 skill 提供 |
| **暫存條目** | `<工程>/.tmp/library/{symbol,footprint}/<名>.json` | 產生時建立，`cleanup.js` 刪掉 |

產生暫存條目用官方兩支腳本（**單位是 mil**）：

```sh
node scripts/generate-symbol.js from-pins --dir <工程> --name <名> --designator D \
     --pins "3:DI:-20:5:0;2:GND:-20:-5:0;4:VDD:20:5:180;1:DO:20:-5:180"
node scripts/generate-footprint.js from-pads --dir <工程> --name <名> \
     --pads "1:-36.025:21.655:35.433:27.559;…" \
     --outline "R,-39.37,-39.37,78.74,78.74" \
     --silk "path,-39.37,43.31,39.37,43.31"
```

- `--pins` 兩種模式：全自動 `num:name`，或全明確 `num:name:x:y:rot`
  （**rot `0` = 左欄、`180` = 右欄**；垂直欄位沒有真機樣本，會被拒絕）
- `--pads`：`num:x:y:w:h[:孔徑]`，**mil**
- `--silk`：`;` 分隔，支援 `rect,x1,y1,x2,y2` 與 `path,x1,y1,x2,y2,…`
- `--outline`：`R,x,y,w,h`（**左下角＋尺寸**）

最後跑 `cleanup.js` 清掉 `.tmp/`——**完成的工程不該含元件庫中介資料**。

---

## 四個會產出壞資料的陷阱

### 1. 焊盤編號讀回來是**字串**

`fp.footprintElems.pads[].num` 是 `"1"`、`"2"`……**不是數字**。

```js
// ✗ 全部落到 else，四隻腳全接同一個網路
const netFor = (num) => num === 1 ? vcc : num === 2 ? gnd : sig;
// ✓
const netFor = (num) => String(num) === '1' ? vcc : String(num) === '2' ? gnd : sig;
```

**實際後果**：808 顆 LED 的 3232 個焊盤**全部被接到 +5V**，而且**不報錯**——
產生器很開心，檔案也合法，只有驗證會抓到。

> 這類「靜默錯誤」是這個工具鏈最大的風險。**寫完一定要逐顆抽查焊盤網路**（見下方驗證）。

### 2. ticket 起始值會撞到 DOCHEAD 自己的 ticket

文件頭本身可能也帶 ticket（例如 `{"type":"DOCHEAD","ticket":192}`）。
若只從主文件的 `maxTicketOfLines()` 起算，計數器會**走過 192 並撞上它**。

```js
const ticketBase = Math.max(maxTicketOfLines(lines), docHeadTicket) + 1;
```

### 3. `writeLines` / `insertDocsBeforeMain` 對「用戶端寫的檔」會失效

- `insertDocsBeforeMain` 用 `startsWith('{"type":"DOCHEAD"}')` 找文件頭。
  用戶端寫的是 `{"type":"DOCHEAD","ticket":N}` → **找不到，直接拋錯**。
  → 自己用解析式（`parseRecord`）找最後一個 DOCHEAD。
- `writeLines` 會**補一個 `\n`** 且**保留最後一行的 `|`**。
  工程檔的慣例是「檔尾無換行、最後一行沒有 `|`」。
  → 自己用位元組寫出，或寫完補救。

### 4. 自動產生的符號腳位排法不適合串接

`from-pins` 的自動排版會把**同一側的腳位放在同一欄**。
對需要 daisy-chain 的元件（例如 DI→DO）會變成「輸入輸出都在左邊」，
串接時**訊號線會橫跨自己的本體或撞到對側腳位**。

→ 用**明確腳位**把資料流排成「左進右出」：`DI` 左、`DO` 右、電源上下。

---

## 標準工作流

```
1. init.js                  建立索引／原理圖容器／圖頁／PCB 文件
2. generate-*.js            產生符號與封裝（進 .tmp/library/）
3. 自寫批次腳本             嵌入文件 + 放元件 + 設網路（單行程）
4. add-wire / add-netlabel  原理圖連線與標籤
5. validate.js              驗證
6. cleanup.js               清 .tmp/
```

⚠️ **`validate.js` 可能不適用**：它要求 DOCHEAD 行**完全等於** `{"type":"DOCHEAD"}`，
對用戶端寫的檔案會**解析出 0 個文件後崩潰**。那是驗證器的限制，不是檔案的錯。
遇到時**不要改檔案去迎合它**——改用自己寫的逐行驗證（見下）。

---

## 驗證：永遠從寫出的檔案反推

產生器說「我寫對了」不算。**獨立地從檔案重算**：

| 檢查 | 怎麼做 |
|---|---|
| 記錄數 | 逐行解析，統計 `COMPONENT`／`PAD_NET`／`NET` 各幾筆 |
| 位置角度 | 已知的輸入座標 vs 檔案值，逐顆比對 |
| **焊盤網路** | 每個元件的每一隻腳，比對「應該接什麼」vs「實際接什麼」 |
| 唯一性 | `id`、`Unique ID` 是否重複 |
| 格式 | 每行 `head\|\|body`、JSON 合法、檔尾慣例 |

> 實際戰績：這套檢查抓到「四隻腳全接 +5V」與「多貼一份區塊」。
> **寧可多花幾分鐘寫驗證，也不要送一片全部短路的板去生產。**

---

## 已知的取捨

- 工具鏈**沒有**非同步／串流 API，就是讀整檔、改、寫回。檔案到幾十 MB 時要留意記憶體。
- `.tmp/` 與中間 JSON **不要進版控**（只放工作區）。
- 批次腳本建議**冪等**：先從乾淨備份還原再跑，避免重複疊加。
