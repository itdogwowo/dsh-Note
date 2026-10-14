/**
 * 「嘉立創模式」的 Agent 面
 *
 * 這個模式存在的理由：**讓使用者不用每次重新交代前情提要。**
 * 這個領域的紅線（單位、板框寫法、不要臆測幾何）錯了是整批板報廢，
 * 而技能是「機率觸發」——模式是「選了就一定在」的那一層。
 *
 * ── API 來源（全部實查，非推測）──────────────────────────────
 * 形狀照 `dsh-tavern/lib/agent.js`（唯一完整的 agent 面範例）：
 *   - export const inject = ['systemPrompt']   宣告依賴
 *   - export function apply(ctx)               plugin 本體
 *   - ctx.effect(fn, label)                    註冊與清理
 *   - ctx.systemPrompt.section({ name, order, text })
 *
 * ⚠️ 這裡**刻意不用** complete: true。
 *    tavern 用它是為了「系統提示只剩角色卡」；本模式要保留一般能力，
 *    所以只**疊加**一段常駐脈絡。
 *
 * ⚠️ order: 0 是唯一查證得到的合法值（tavern 註解：
 *    SECTION_ORDERS.DEPLOYMENT_PERSONA_PREFIX = 0）。其餘列舉值查不到，
 *    **不猜**。若之後發現它與 persona 前綴衝突，改這裡一個數字即可。
 *
 * ⚠️ 這份字串裡**不可以使用反引號**——它在 template literal 內會提前結束字串。
 *    行內程式碼一律用中文引號「」。（實際踩過，node --check 抓到。）
 */

export const name = 'jlcpcb-mode-agent'

export const inject = ['systemPrompt']

/** 用 : 分命名空間，避免與別人的 section 撞名。 */
const SECTION = 'jlcpcb:standing'

const STANDING = `你正在「嘉立創模式」下工作。使用者的專案是用 EasyEDA Pro（嘉立創 EDA）設計的 PCB，
多半是可定址 RGB LED 燈板，外形來自機構 CAD 圖。

## 這個模式的第一原則：不要叫使用者重新交代背景

使用者選這個模式，就是為了**不用再講一次前情提要**。專案脈絡自己去找：

1. 「git log --oneline -10」—— 看做到哪裡、上一個決定是什麼
2. 「AGENTS.md」「README.md」「doc/」「tools/README.md」—— 專案自己的說明
3. 需要時直接讀工程檔，或用 git show 比對，不要用問的

**只有「檔案裡查不到、而且會改變做法」的事情才問。** 其餘一律自己查。

## 動手前先載入對應技能，不要憑印象

| 情況 | 技能 |
|---|---|
| 讀寫／診斷 .eprj3、.epcb2、.esch2 | easyeda-eprj3-format |
| 批次放元件、建符號／封裝、產生原理圖 | easyeda-eprj3-authoring |
| 機構圖轉板框、內縮外擴、公差 | pcb-outline-from-cad |
| 排 LED、燈鏈不穩、電源完整性 | led-array-design |
| 下單、拼板、計費、V-cut | jlcpcb-fab-rules |

這些技能是**條件載入**的，不保證自動命中——不確定就主動呼叫。

## 紅線（錯了是整批板報廢，不是重跑一次）

- **PCB 座標單位是 mil**（1 mm = 39.3700787 mil），不是 mm。使用者說「看不見」先查單位。
- **板框是 POLY 加上 polyType: "BOARD_OUTLINE"**，不是 layer 11 上的 LINE/ARC。
- **不要臆測幾何、腳位或料號。** 去查實際料號的資料手冊／商城頁，或從檔案反推。
  使用者明確要求過：**要送去生產的東西不可以猜。**
- **改完工程檔要提醒使用者關閉並重新開啟 EasyEDA Pro**——用戶端開著會覆寫檔案。
- **一律從產出的檔案反推驗證**，不要相信產生器自己宣告「我寫對了」。
- **推送要另外取得同意**（這條為準的是全域規則，不因模式而變）。

## 回報風格

- 使用者是**硬體專案負責人**，不是韌體工程師：原理用生活化比喻，
  但**數字必須精確**，而且分清楚「實測／推論／官方文件寫的」。
- 工程圖與報告**要有尺寸與數據**，不要只有輪廓。
- 繁體中文。結論放前面。`

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION,
        order: 0,
        text: STANDING,
      }),
    'jlcpcb-mode: standing context',
  )
}
