# 嘉立創模式（agent 面備份）

這個資料夾是**「嘉立創模式」的 agent 面模組備份** —— 也就是使用者選了那個模式之後，
真正疊加到系統提示上的那段常駐脈絡（約 1100 字：第一原則、技能對照表、領域紅線、回報風格）。

## 這個模式的四塊拼圖

| # | 拼圖 | 放哪裡 | 在這 repo 裡 |
|---|---|---|---|
| 1 | **agent 面模組**（`agent.js`） | `<家目錄>/.dsh/agent-plugins/jlcpcb/agent.js` | `sync/agent/jlcpcb/agent.js` ← **本檔** |
| 2 | **preset 宣告列**（掛上那個模組） | `<家目錄>/.dsh/profiles/<profile>/cordis.patch.yml` | `machines/<host>.json` 的 `presetRow` |
| 3 | **五個領域技能** | `<家目錄>/.dsh/skills/<name>/SKILL.md` | `sync/skills/`（已在那裡） |
| 4 | 本模式的設計說明 | 同 1 的 `HANDOFF.md` | **不進 repo**（機器專屬的交接稿） |

缺任何一塊都不會動：沒有 1 就是空模式，沒有 2 連選擇器都不會出現，沒有 3 只剩常駐脈絡而沒有可呼叫的深度知識。

## preset 宣告列的形狀

`machines/<host>.json` 裡存的是**帶樣板的列**，不是任何機器的真實路徑：

```yaml
- insert:
    - id: preset-jlcpcb
      name: "@deepseek-ai/dsh-agent-preset"
      config:
        id: jlcpcb
        name: 嘉立創模式
        description: PCB／EasyEDA Pro／嘉立創下單。常駐領域脈絡與紅線，不用重新交代前情提要
        order: 800
        plugins:
          - id: jlcpcb-mode-agent
            name: 'file:///<家目錄>/.dsh/agent-plugins/jlcpcb/agent.js'
```

三個**不能省**的地方：

1. **整個包在 `- insert:` 裡。** 使用者層的 `cordis.patch.yml` 不是「直接追加一列」——
   純列表的每一列是**依 id 覆寫既有列**，目標不存在就靜默跳過（`patch: entry ... not found`）。
2. **子外掛的 `name` 必須是 `file://` URL，不是 Windows 反斜線路徑。**
   反斜線的 `C:\...` 不會被當成絕對路徑，而是被當成**裸套件名**去解析 → 靜默失敗。
   症狀是模式有出現但被標成損壞（`never started`）。細節見 `notes/pitfalls.md`。
3. **`description` 是選擇器裡顯示的那行字**，不是給模型看的觸發詞（模式沒有觸發引擎，選了就一定在）。

## 怎麼確認它活著

`broken` 欄位是最直接的判準——模式**有出現**不代表它健康：

```powershell
# 用 CLI 在一個非 app 管理的 profile 上印組合樹（desktop profile 不接受 CLI 啟動）
DSH_HOME=<家目錄>\.dsh dsh --profile <profile> --dump-config |
  Select-String '^- id: preset-|not found'
```

- 看得到 `- id: preset-jlcpcb` → **宣告被接受了**
- 完全沒有上面那行，只有 `patch: entry "preset-jlcpcb" not found` → 少了 `- insert:`
- 要在**跑著的**實例裡看健康狀態，查運行中宿主自己的 preset 清單
  （GUI 網路面板可見 `POST /api/agentPresets/list`）；
  `broken` 有值就是子外掛沒起來，`broken` 不存在才是真的可用。

## 同步方向

**這個 repo 是來源。** 要改常駐脈絡時：改這裡 → 複製到 `<家目錄>/.dsh/agent-plugins/jlcpcb/agent.js`
→ 重啟 GUI（desktop profile 由 Electron 應用程式啟動，CLI 不能單獨開它）。

> ⚠️ 這個檔案是**逐字備份**，刻意不加任何 header。
> 加了 header 就不是同一份檔案了，之後比對會永遠不一致。
