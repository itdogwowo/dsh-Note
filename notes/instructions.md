# 全域指示 `AGENTS.md`

DSH 的 `dsh-agent-instructions` 會**自動注入**，不用手動貼。

## 檔案與層級

| 檔案 | 範圍 |
|---|---|
| `<專案根>/AGENTS.md` 或 `CLAUDE.md` | 該專案 |
| `<專案根>/AGENTS.local.md` 或 `CLAUDE.local.md` | 該專案，個人覆蓋層（**通常 gitignore**） |
| `~/.dsh/AGENTS.md` | 你所有專案 |

- **注入時機**：第一次模型請求**之前**（baseline）
- **動態補充**：`read`／`write`／`edit` 碰到子目錄裡的 `AGENTS.md` 時會**補進來**
  —— 所以子目錄可以放更嚴的規則，只有真的動到那裡才會載入
- **單檔上限**：1 MiB（`maxSourceBytes`）
- **專案根怎麼找**：從 cwd 往上找 `.git`（`projectRootMarkers`，預設 `['.git']`）
- **需要 `ctx.get('fs')`**：沒有 fs provider 的產品會 mount 成 no-op

## 改完會即時生效

`AGENTS.md` 改動之後，DSH 會**重新注入**一份完整內容取代舊的——不需要重開對話。

> 實測：編輯存檔後，下一輪就收到 `Updated instructions from: AGENTS.md` 加新全文。

## 與技能的取捨

| | 載入方式 | 成本 |
|---|---|---|
| `AGENTS.md` | 每次對話**全量**注入 | 每個對話都付 |
| 技能 | 常駐只有一行描述，本體**按需** | 用到才付 |

**通則**：

- **不放棄地都要遵守的規則** → `AGENTS.md`
- **只在特定情境用的長篇指示** → 技能
- 兩者可以搭配：`AGENTS.md` 寫**觸發條件**＋一句「細節見 X 技能」

### 省錢的迷思

把 `AGENTS.md` 的內容搬進技能**省不了多少**——因為描述那一行本來就常駐。

實測：`AGENTS.md` 從 2070 砍到 1600 bytes（省 622 B ≈ 30%），但技能目錄那一行要 110 字，
**淨省約 137 字／對話**。那是零錢。

**真正貴的是工具輸出**：整份 dump 檔案、把幾十 KB 的 API 回應貼進 context。
那才是幾千字級別的浪費。

## 子目錄的 `AGENTS.md` 是好東西

因為它按需載入，所以可以：

- 在 `lib/` 放「這一區不准 import 外部套件」
- 在 `docs/` 放「這一區不准寫真實路徑」
- 在 `tests/` 放「假物件要忠實模擬真實行為」

只有 AI 真的去動那個目錄時才會讀到，平常不佔 context。
