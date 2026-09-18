# 技能（Skill）

## 它其實是什麼

一份 `SKILL.md`，加上 YAML frontmatter：

```markdown
---
name: my-skill
description: 這個技能做什麼，以及什麼時候該用它。
---

（本體：給 AI 的指示）
```

放在這四個目錄之一就會被掃到：

| 目錄 | 層級 |
|---|---|
| `~/.dsh/skills/<name>/SKILL.md` | 使用者（所有專案） |
| `~/.agents/skills/<name>/SKILL.md` | 使用者（另一套慣例） |
| `<專案>/.dsh/skills/<name>/SKILL.md` | 專案 |
| `<專案>/.agents/skills/<name>/SKILL.md` | 專案（另一套慣例） |

單檔形式 `<name>.md` 也吃。也可以設 `customSkillDirs` 加自訂目錄
（`dsh-skill-filesystem` 和技能中心插件**都**支援這個設定，但各自設定）。

`name` 必須符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。

---

## ⭐ 觸發原理：只有 `description`，沒有條件引擎

這是整個系統最容易被誤解的地方。

- 模型每一輪看到的**只有一行**：`` - `name`: description ``
- 系統提示說「**若任務明顯符合某個技能的 description，就先呼叫 `skill` 工具**」
- 所以「觸發條件」＝**寫在 description 裡的自然語言**，由**模型每輪自己判斷**

**沒有**關鍵字比對、**沒有**正則、**沒有** glob、**沒有**事件掛鉤。

> 想要確定性的觸發（例如世界書那種關鍵字命中），技能系統做不到。
> 那要換機制：system prompt section 的動態 `text`，或 `agent/pre-step` waterfall。

### 這不是 DSH 獨有的

通用的 Agent Skills 規格，其他工具（Trae、Claude Code、Cursor 等）也是同一套。
其他工具的官方文件講法可以互相印證：

> 智能体不会在任务开始时一次性读取所有技能的完整内容。在执行任务前，智能体**先扫描所有技能的简要描述**，
> **仅当判断当前任务与某个技能高度相关时**，才会加载该技能的详细内容。

關鍵詞是「**判断**」——主語是智能體，不是程式。

---

## ⚠️ 三個會讓你白忙的陷阱

### 陷阱 1：body 裡寫「## Trigger Conditions」不會觸發

那一段要**技能被載入之後**才讀得到——而決定要不要載入的只有 frontmatter 的 `description`。
在 body 寫「Invoke when…」是**循環的**。

它仍有用途：讓已載入的模型發現「我載錯了」時退出。
但它**不能讓技能被載入**。

### 陷阱 2：`whenToUse` 是裝飾品

`whenToUse` 有被解析、有被驗證，但 `dsh-tool-skill` 的 `catalogSourceEntries`
**只吐 `name` + `description`**。它只進 `toSummary()`（技能中心 UI 顯示用），
**不進模型看得到的目錄**。

→ 把觸發時機只寫在 `whenToUse`，那個技能永遠不會自己觸發。

**怎麼驗證**：寫一個技能，`description` 和 `whenToUse` 各寫不同的字串，然後看你的對話
context 裡 `<available_skills>` 那一行實際出現哪一個。實測只有 `description`。

### 陷阱 3：description 會被截斷

`dsh-tool-skill` 的 `DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH = 500`。
超過 500 字的部分**模型看不到**。重要的關鍵字要往前放。

**怎麼驗證**：把兩個技能的描述寫成一個 400 字一個 900 字，看目錄那一行實際出現多少。
實測 914 字那個被砍在半句話中間（`…SaaS, portfolio, blog, and mob...`）。

> 順帶：目錄裡的描述會做 HTML 轉義，`<foo>` 會變成 `&lt;foo&gt;`。只影響顯示，不影響觸發。

---

## 有效的 description 怎麼寫

用「使用者會怎麼講」的語言，把**觸發時機寫在前面**：

```yaml
description: '修改或建立任何檔案、寫文件、附截圖之前載入。公開 repo 的個資紅線：…'
```

如果常用中文下指令，**把中文觸發詞也寫進去**：

```yaml
description: 'Sync or rebuild project docs. Invoke when API/core files change, or user says 同步文件 / 更新文件 / 重建文件.'
```

模型讀得懂英文，但描述裡有使用者的**實際用詞**，命中率會更高。

其他工具也這樣做——內建技能的描述裡直接寫「…**当用户意图涉及小程序、Taro…时触发**」。

---

## 兩個控制開關

| 欄位 | 預設 | 作用 |
|---|---|---|
| `disable-model-invocation: true` | false | 關掉「模型自己呼叫」 |
| `user-invocable: false` | false | 關掉「使用者打 `/` 呼叫」 |

⚠️ **一定要用 kebab-case。** camelCase（`disableModelInvocation`、`modelInvocable`、
`userInvocable`）會被 `rejectLegacyInvocationKey` **直接丟錯**，不是忽略。

其他 frontmatter 鍵（`license`、`metadata`、`allowed-tools`……）DSH **直接忽略**，
不會壞掉——但也不會生效。別平台的 `allowed-tools` 限制在 DSH 是**靜默失效**的。

---

## 從別的工具搬技能過來

見 [`pitfalls.md`](pitfalls.md) 的「搬技能過來之後叫錯工具」。
重點是**平台專屬的工具名要先掃掉**，不然技能會叫不存在的工具，而且通常不會報錯。
