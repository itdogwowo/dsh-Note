# GUI：入口在哪裡

DSH 的 GUI 有很多「東西存在但找不到」的情況。這一頁把入口集中起來。

## 輸入框：`/` 和 `@`

輸入框的 placeholder 自己就寫了答案：**「… , `/` 调用指令, `@` 文件或对话」**。

打 `/` 會跳出一份**分區選單**：

```
指令
  compact     压缩以上对话内容
  export      将当前会话内容导出为 ZIP
  feedback    发送关于当前会话的反馈
  goal        设置或查看长期任务目标
  permission  切换权限预设（沙箱模式与审批策略）
  plan        进入或退出计划模式
  model       选择本会话使用的模型
技能
  <你的技能>…
```

**「技能」那一區是 DSH 本體提供的**（`@deepseek-ai/dsh-client-ui-skill`），
不是第三方技能中心插件。

> 這兩個東西名字很像但完全不同：
> **技能中心**是側邊欄的一個面板（第三方插件，管理檔案），
> **技能**是 `/` 選單裡的一區（DSH 本體，把技能塞進對話）。

## 側邊欄

- **上方那排是全局面板**（`sidebar.panellist` 座位）：例如「新会话」「任务看板」「技能中心」
- **中間那一塊**（`.regionArea`）只渲染 **single 座位** `sidebar.workspaces`，原生工作區住在那裡
- **下方**是設定等

⚠️ **DSH 沒有給外部插件「註冊側邊欄項目」的官方座位。**
所以像技能中心這種插件是用**純 DOM 注入**一列進去的（找一個既有列當錨點，
自己插一個 `<button>`，並且在 React 重繪後自我修復）。

**這代表**：那一列出現的時機會比插件掛載晚一點，而且如果錨點不存在就可能不出現。

## 座位（slot）的三個坑

寫前端插件時會遇到，找問題時也用得到：

1. **single 座位的 priority**：同一個 priority 不能註冊第二次。
   **priority 最小的才會被渲染**（核心把 entries 依 priority 遞增排序，取第一個還活著的）。
   `order` 只對 list／keyed 座位有意義，**對 single 完全沒作用**。
2. **接管一個座位要接手它的 `inject`／`store`／`locale`**，
   而且這些欄位在 entry 是**頂層**（`entry.inject`，不是 `entry.options.inject`）。
   少了就會出現 `useHostInfo is not a function` 之類的錯。
3. **要鏡射它宣告的子座位**：`renderSlot` 這個 prop 只發給「有宣告 `children`」的 entry，
   而且會檢查 `entry.children[key]`，否則丟 `SlotOwnershipError`。

## 工具列（tool rows）

對話裡的工具呼叫會渲染成一列一列。DSH 本體的 `dsh-client-ui-skill` 負責
`skill` 工具那一列的樣式（標題「Skill」）。

有些工具列可以**展開**看細節，有些不行——那取決於插件有沒有註冊對應的渲染器。

## 設置

- **設置 → 插件**：每個插件自己的設定卡片（schema 由插件宣告）
- **plugin manager**（第三方）可以視覺化地開關插件列，它改的就是
  [`plugins.md`](plugins.md) 說的 `cordis.patch.yml`，並且會留備份

## 判斷「我看到的是新是舊」

改了插件之後，頁面跑的可能是舊版。兩個地方可以看：

- 插件回報的 **build 標記**（通常寫在原始碼最上面，例如 `const X_BUILD = 'x-2.5.1'`）
- 側邊欄那一列的 **tooltip**

改了**瀏覽器半**通常不用重啟（HMR 會推 `rebuilt` 並重載模組）；
改了**宿主半**一定要重啟 `dsh web`。
