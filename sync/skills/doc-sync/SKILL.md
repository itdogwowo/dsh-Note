---
name: "doc-sync"
description: 'Sync or rebuild a project doc set from code. Invoke when API/model/config files or the project directory structure change, or the user says: sync docs / update docs / 同步文件 / 更新文件 / rebuild docs / init docs / 重建文件 / 初始化文件 / setup project context / 建立專案脈絡. Skip for test-only, asset-only, vendor, or formatting-only changes.'
---

# Doc Sync — Documentation Auto-Sync & Rebuild

This skill keeps project documentation in sync with code.
Two modes: **Incremental Sync** (patch existing docs) and **Full Rebuild** (regenerate all docs from scratch).

Core philosophy: **write notes for the future** — record repeated emphasis, solved problems, and cross-AI consistency rules into `doc/notes.md`, so *any* AI (across tools/models) can read it later and solve the same problem the same way.

---

## Trigger Conditions

> ⚠️ **這一節不會觸發這個技能。**
> 模型每一輪只看得到 frontmatter 的 `description`；這一節要等技能被載入之後才讀得到。
> 它的用途是**載入後的自我檢查**——發現其實只是 test-only 改動就退出，不要硬做。
> 真正的觸發條件寫在 `description` 裡；改這一節不會改變觸發行為。

**Invoke when:**

1. API route handlers, database models/schemas, or core business logic files are modified
2. Config files that change runtime behavior are modified
3. Project directory structure changes (modules added/removed)
4. User says "sync docs", "update docs", "同步文件", "更新文件"
5. User says "rebuild docs", "init docs", "重建文件", "初始化文件" → **Full Rebuild**
6. User says "setup project context", "init design context" → **Project Context Setup**

**Do NOT invoke for:**
- Test-only changes (`*_test.*`, `*.spec.*`, `test_*.*`)
- Static asset changes (CSS, images, fonts)
- Generated/vendor code changes
- Comment-only or formatting-only changes

---

## Tool Naming (cross-platform)

這份技能要能在多個 AI 工具裡跑，所以**不寫死工具名**。需要平台專屬的操作時用通用說法，
執行的時候換成你手上那套：

| 這裡的說法 | DSH | Claude Code / Trae |
|---|---|---|
| 提問工具 | `ask_user_question` | `AskUserQuestion` |
| 局部替換工具 | `edit` | `Edit` / `SearchReplace` |
| 子代理 | `subagent` | `Task` |
| 專案指示檔 | `AGENTS.md` | `CLAUDE.md` |
| 搜尋 / 列出檔案 | `grep` / `glob` | `Grep` / `Glob` |

**改這份技能時也請維持這個規則**：寫「用你的局部替換工具」，不要寫「用 `edit`」。

---

## Mode Selection

```
1. Does doc/project-context.md exist?
   ├─ No  → Run Project Context Setup, then Full Rebuild
   └─ Yes ↓

2. Does doc/ folder have module docs?
   ├─ No  → Full Rebuild Mode
   └─ Yes ↓

3. User explicitly said "rebuild" / "init" / "重建" / "初始化"?
   ├─ Yes → Full Rebuild Mode
   └─ No  → Incremental Sync Mode (default)
```

---

## Exclusion Rules

Follow `.gitignore`. If a file is git-ignored, skip it entirely.

Additionally, always exclude:
- `node_modules/`, `venv/`, `.venv/`, `__pycache__/`, `dist/`, `build/`, `.next/`, `vendor/`
- Lock files (`package-lock.json`, `yarn.lock`, `Podfile.lock`, etc.)
- Migration files (`migrations/`, `db/migrate/`)
- `.env` files (never document secrets; use `.env.example` instead)

---

## Project Context File

**Location: `doc/project-context.md`** (always this path; the skill creates it automatically)

Stores the user's design philosophy, architecture decisions, and documentation conventions. It is the **single source of truth** for how all docs in this project should be written.

### When to Create / Update

- **Auto-create**: When `doc/project-context.md` doesn't exist, create it before doing anything else
- **Update**: When user says "update project context", or when architecture fundamentally changes
- **Never auto-overwrite**: Always confirm with user before rewriting this file (except inventory/mapping tables, which auto-sync)

### File Template

```markdown
# Project Context — <Project Name>

> This file defines the design philosophy and documentation conventions.
> All doc generation (sync & rebuild) MUST respect the rules defined here.

## 1. Project Overview

- **Name**: <project name>
- **Purpose**: <one paragraph>
- **Tech Stack**: <languages, frameworks, key dependencies>

## 2. Design Philosophy

<!-- User's core design principles. Free-form. -->
- <principle 1>
- <principle 2>

## 3. Architecture Decisions

<!-- Key choices and rationale -->
- <decision>: <reason>

## 4. Module Architecture

<!-- Describe HOW this project is divided into modules. This is the authoritative
     source — sync and rebuild read this section to know what a "module" means
     in this project. Setup flow auto-generates this; user can edit afterwards. -->

### Framework / Structure
- **Type**: <Django apps / Next.js routes / Swift Package targets / Flask blueprints / flat files / etc.>
- **Module definition**: <what counts as one module — e.g., "each Django app directory", "each top-level .py file", "each package/ in monorepo">

### Module Layout

<!-- Tree showing how source files are grouped into modules -->
```
<project-root>/
├── <module-name>/          → doc/<module-name>-module.md
│   ├─ <file1.ext>
│   ├─ <file2.ext>
│   └─ <file3.ext>
├── <module-name>/          → doc/<module-name>-module.md
│   └─ <file1.ext>
└── <standalone-file.ext>   → doc/<filename>-module.md
```

### Module Boundaries Rules
<!-- How to decide which files belong to which module -->
- <rule 1, e.g., "All files under an app/ directory belong to that app's module">
- <rule 2, e.g., "Shared utilities in utils/ are documented in a separate utils-module.md">
- <rule 3, e.g., "Config files are documented in data-dictionary.md, not as modules">

### Significant File Criteria
<!-- What makes a file worth documenting as part of a module -->
- Must contain: <class / function / interface / route handler / model definition>
- Skip: <pure data files, generated code, migrations, static assets>

## 5. Documentation Conventions

### Language
- Documentation language: <English / Traditional Chinese / etc.>

### Naming
- Module docs: doc/<module-name>-module.md
- Architecture: doc/architecture.md
- Config reference: doc/data-dictionary.md
- Roadmap: doc/roadmap.md

### Format
- Class docs: property tables + method descriptions
- Line numbers: reference only, format `(L41-75)`
- Tree diagrams: ASCII (├── └──)

## 6. Doc-Code Mapping Contract

| Module | Source Files | Doc File | Notes |
|--------|-------------|----------|-------|
| <users> | <users/models.py, users/views.py, ...> | doc/users-module.md | <notes> |
| <config> | <config.example.json> | doc/data-dictionary.md | Config reference |

## 7. Module Inventory

| Module | Responsibility | Key Classes/Functions |
|--------|---------------|----------------------|
| ... | ... | ... |

## 8. Manual Docs (Do Not Auto-Overwrite)

<!-- List docs that are hand-maintained. Rebuild must skip these. -->
- doc/roadmap.md
- doc/website-analysis.md
- doc/notes.md (append-only — see Notes for the Future)
- <any user-specified manual docs>

## 9. Change Log

| Date | Change |
|------|--------|
| <YYYY-MM-DD> | Initial context created |
```

### Project Context Setup Flow

```
Step 1: Scan the project
  - Glob all source files (respecting .gitignore)
  - Read package.json / requirements.txt / go.mod / Package.swift / etc.
  - Read README.md and the project instruction file (see Tool Naming) if they exist
  - Detect framework (Django apps, Next.js routes, Swift targets, etc.)

Step 2: Detect module architecture
  - Run auto-detection (see Module Detection → Auto-Detection)
  - Determine framework type, module layout, boundary rules, significant file criteria

Step 3: Ask the user (use your question tool — see Tool Naming)
  - "What is the main purpose of this project?"
  - "What language should documentation be written in?"
  - "Any key design principles to document?"
  - "Are there any hand-maintained docs that should not be auto-overwritten?"
  - Show detected module layout: "I detected these modules: <list>. Does this look right?"
  - (Allow user to skip — use auto-detected defaults)

Step 4: Generate doc/project-context.md
  - Fill template with discovered + user-provided info
  - Write module architecture into §4 (framework type, layout tree, boundary rules, significant file criteria)
  - Auto-populate §6 Module Inventory from detected modules
  - Auto-populate §7 Doc-Code Mapping Contract
  - Auto-populate §8 Manual Docs list (include roadmap.md by default)
  - Auto-create doc/notes.md from the template (see Notes for the Future)

Step 5: Confirm with user
  - Show the generated context
  - Let user review and approve
```

---

## Notes for the Future

The core philosophy of this skill: **write notes for the future**. When a problem is solved, a principle is repeatedly emphasized, or a consistency rule is established, record it so that *any* AI (across different tools/models) can read it later and solve the same problem consistently — without re-discovering it from scratch.

### Notes File

**Location: `doc/notes.md`** (always this path; auto-created by the skill)

A chronological, **append-only** log. Never auto-overwritten — only new entries are added. Every future session (sync, rebuild, or any AI tool working on this project) MUST read `doc/notes.md` and `doc/project-context.md` before starting work.

### When to Write

- **Auto-append**: at the end of every Sync / Rebuild run, append new discoveries from this session
- **On request**: whenever the user says "記下來" / "take a note" / "remember this"
- **During work**: when a problem is solved, a repeated emphasis is heard, or a cross-AI consistency rule is established

### What to Record

1. **Repeated emphasis & decisions** — design principles / architecture decisions the user stresses more than once
2. **Solved problems & solutions** — pitfalls hit, bugs fixed, and the working fix (so the next AI doesn't re-debug the same issue)
3. **Cross-AI consistency rules** — conventions (naming, format, workflow) that must stay consistent across different AI tools

### Template

```markdown
# Notes — <Project Name>

> 給未來的筆記 (Notes for the future): record repeated emphasis, solved problems,
> and cross-AI consistency rules so any future AI can solve the same problem the same way.
> This file is append-only. Never overwrite; only add entries.
> Written in the documentation language defined in Project Context §5.

## 1. Repeated Emphasis & Decisions
- <YYYY-MM-DD> <principle/decision> — <reason>

## 2. Solved Problems & Solutions

<!-- 一條坑一個區塊。「當時以為」不可省 —— 那正是下一個人會誤判的方向。 -->
### <YYYY-MM-DD> — <症狀的一句話>
- **症狀**：<觀察到什麼>
- **當時以為**：<一開始的判斷>　← 必填
- **真正原因**：<實際上是什麼>
- **怎麼驗證**：<具體指令或步驟，讓下一個人能自己重現這個判斷>
- **學到什麼**：<可轉移的教訓，或指向哪份文件>

## 3. Cross-AI Consistency Rules
- <YYYY-MM-DD> <rule>
```

### Rules

- Append entries with today's date; never edit or remove existing entries
- **同一條坑又踩到時，加一條新的**（append-only），在裡面寫「又踩了一次，這次的差別是…」
  —— 不要改舊的那一條
- **「當時以為」必填。** 只寫正確答案的版本對下一個人沒有用，因為他不會在那裡停下來
- 超過約 30 條時拆成 `doc/notes/` 資料夾 ＋ 一份索引，`doc/notes.md` 保留為索引
- `doc/notes.md` is listed in Project Context §8 Manual Docs — never overwritten by Rebuild
- Follow the documentation language defined in Project Context §5 (template above is bilingual)
- Verify existing notes are still accurate when relevant code changes

---

## Module Detection

Rebuild and sync operate on **modules** (logical groups), not individual files.

### Rule: Context First

```
If doc/project-context.md §4 Module Architecture exists and is filled:
  → Use it directly. Do NOT re-detect.
  → The module layout, boundaries, and significant file criteria defined
    there are authoritative.

If §4 is empty or project-context.md doesn't exist:
  → Run auto-detection (below) during Project Context Setup
  → Write results into §4 so future runs don't need to re-detect
```

### Auto-Detection (Setup Only)

Used during Project Context Setup to populate §4 Module Architecture.

```
1. Framework-aware grouping (check in order):
   a. Django      → each app/ directory is a module
   b. Next.js     → each app/<route>/ subdirectory is a module
   c. Rails       → conventional dirs (models/, controllers/, etc.) are modules
   d. Swift PM    → each target in Package.swift is a module
   e. Node monorepo → each package/ directory is a module
   f. Flask/FastAPI → each blueprint/router is a module

2. If no framework detected:
   a. Group by top-level source directory (e.g., src/auth/, src/api/)
   b. If flat (all files in root): each significant source file is a module

3. Significant file = contains class/function/interface definitions
   (skip pure config, data, or utility files with no logic)
```

### Example (What Gets Written to §4)

```
Django project §4 Module Architecture:

  Framework / Structure:
    Type: Django apps
    Module definition: each top-level app directory (users/, posts/, ...)

  Module Layout:
    project-root/
    ├── users/               → doc/users-module.md
    │   ├─ models.py
    │   ├─ views.py
    │   ├─ serializers.py
    │   └─ urls.py
    ├── posts/               → doc/posts-module.md
    │   ├─ models.py
    │   └─ views.py
    └── config/              → doc/data-dictionary.md (not a module)

  Module Boundaries Rules:
    - All files under an app/ directory belong to that app's module
    - Shared utilities in utils/ get their own utils-module.md
    - Config files go to data-dictionary.md, not as modules

  Significant File Criteria:
    Must contain: class, function, or model definition
    Skip: __init__.py, migrations/, static/, templates/
```

---

## Full Rebuild Mode

Use when: first-time setup, user explicitly requests, or docs severely out of sync.

### Rebuild Flow

```
Step 1: Read Project Context
  - Read doc/project-context.md
  - If missing → run Project Context Setup first
  - Extract module layout from §4 Module Architecture (defines what to scan and how to group)
  - Read doc/notes.md if it exists (absorb prior notes before scanning)

Step 2: Full Source Scan
  - Glob ALL source files (respecting .gitignore + exclusion rules)
  - Group files into modules using §4 Module Architecture rules
  - For each module, read its source files to extract:
    * Classes, functions, interfaces, types
    * Line numbers
    * Dependencies / imports
    * Config field definitions
    * Output format structures

Step 3: Safety Check
  - If git repo has uncommitted changes → warn user, suggest committing first
  - Check Project Context §8 Manual Docs list → these will NOT be overwritten

Step 4: Generate Doc Set (with batching — see Batching Strategy)

  For EACH module:
  a) Create doc/<module>-module.md
     - File overview (list files in module with line ranges)
     - Class/function descriptions
     - Properties tables, method descriptions
     - Inter-module dependencies

  Then generate project-level docs:
  b) doc/architecture.md
     - Directory tree
     - Module relationship diagram (ASCII)
     - Data flow
  c) doc/data-dictionary.md
     - All config fields with types, defaults, descriptions
     - Output data structures
  d) doc/README.md
     - Doc index with links to all module docs
  e) Update the project instruction file / README.md file structure section

Step 5: Update Project Context
  - Refresh Module Inventory table
  - Refresh Doc-Code Mapping Contract table
  - Add Change Log entry

Step 6: Verify (see Verification section)

Step 7: Append Notes
  - Append new discoveries to doc/notes.md (repeated emphasis, solved problems, cross-AI rules from this session)
  - Append-only: never edit or remove existing entries
```

### Rebuild Rules

- **Overwrite allowed** for module docs — this is the only mode that rewrites entire docs
- **Never overwrite** `doc/project-context.md` (only update inventory/mapping tables) and files in Manual Docs list (§8)
- **Follow Project Context conventions** — language, format, naming from context file
- **Read actual code** — every doc based on real source, not guessing

---

## Incremental Sync Mode

Default mode for ongoing maintenance.

### Sync Flow

```
Step 1: Read Project Context
  - Read doc/project-context.md for conventions, mapping, module list
  - Extract module layout from §4 Module Architecture (defines how to map changed files to modules)
  - Read doc/notes.md if it exists (absorb prior notes)

Step 2: Detect What Changed
  - If git repo: run `git diff --name-only HEAD` to get changed files
  - If no git: Glob all source files, compare against §7 Module Inventory
  - Map changed files to their modules (using §4 Module Architecture + §6 Doc-Code Mapping Contract)
  - Only process modules that have changed files

Step 3: Scan Changed Modules
  - For each changed module, Grep for:
    * New/removed classes, functions, interfaces
    * Changed function signatures
    * Changed config fields
    * Changed output structures
    * Line number drift

Step 4: Generate Diff Report

  Example:
  [users-module.md] UserSerializer: doc says L45-80, actual L45-92 → update
  [users-module.md] New function get_user_profile() not documented → add
  [data-dictionary.md] Config field `max_retries` changed default 3→5 → update
  [architecture.md] New module `billing/` not in diagram → add

Step 5: Fix Each Difference
  - Use your local-edit tool (see Tool Naming) to patch only the diff parts
  - Re-confirm line numbers with Grep before writing
  - Follow existing doc format
  - If new module added: create module doc + update architecture + update context inventory

Step 6: Verify (see Verification section)

Step 7: Append Notes
  - Append new discoveries to doc/notes.md (repeated emphasis, solved problems, cross-AI rules from this session)
  - Append-only: never edit or remove existing entries
```

---

## Batching Strategy

For large projects where reading all source files at once would exceed context limits.

### When to Batch

```
Modules to process ≤ 10  → Process in current context (no batching)
Modules to process 11-25 → Split into 2-3 batches via subagents
Modules to process > 25  → Split into 4-5 batches via subagents
```

### Batch Execution

```
1. Main agent: scan project, detect modules, build the module list
2. Split modules into batches (aim for ≤ 8 modules per batch)
3. For each batch, launch a subagent:
   - Pass: module names, source file paths, Project Context conventions
   - Subagent: reads source files, generates module docs, returns summary
4. After all subagents complete:
   - Main agent generates architecture.md (using subagent summaries)
   - Main agent generates data-dictionary.md
   - Main agent generates README.md index
   - Main agent updates Project Context inventory
5. Verify
```

### Batch Rules

- Each subagent only reads its assigned source files (not the whole project)
- Architecture doc is always generated by the main agent (needs full picture)
- If a subagent fails, retry that batch only (don't redo everything)
- Subagents write directly to `doc/<module>-module.md`

---

## Verification

After sync or rebuild, verify **only the docs touched in this session**.

### Verification Checklist

```
For each doc that was created or modified:

1. Existence Check
   - Every class/function name mentioned in the doc → Grep source to confirm it exists
   - If not found → flag as error

2. Line Number Check
   - For each (Lxx-yy) reference → Grep the actual line, confirm within ±5 lines
   - If drifted beyond ±5 → flag for update

3. Cross-Reference Check
   - If doc A says "see doc B §section" → confirm doc B exists and has that section
   - If broken → flag as error

4. Context Inventory Check
   - If modules were added/removed → confirm project-context.md §7 Module Inventory updated
   - If mapping changed → confirm §6 Doc-Code Mapping Contract updated

5. Manual Docs Check
   - Confirm no file in §8 Manual Docs list was overwritten

6. Privacy Check (REQUIRED whenever doc/ is committed)
   - No real username or absolute home path in any doc
     (patterns: C:\Users\<name>, /Users/<name>, /home/<name>)
   - No company / internal project / client names — use placeholders like <Project A>
   - No UI screenshots: the sidebar shows workspace names AND full paths
   - .gitignore does NOT protect against drag-and-drop upload in the web UI
   - Scan only what would actually be committed:
     `git ls-files -o --exclude-standard`  (NOT `git status` — it lists ignored files too)
```

### Output Format

```
Verification Report:
✓ doc/users-module.md — 5 functions checked, all exist
✓ doc/posts-module.md — 3 classes checked, line numbers within range
✗ doc/billing-module.md — function `process_payment()` not found in source (may be renamed)
✓ doc/data-dictionary.md — 8 config fields verified
✓ doc/project-context.md — Module Inventory updated
✓ Manual docs — none overwritten

Errors: 1 — investigate doc/billing-module.md
```

If errors found, fix them immediately before reporting to user.

---

## Format Guidelines

Follow the Project Context's conventions. Defaults if not specified:

### Module Doc Structure

```markdown
# <Module Name> Module

## Overview
<one paragraph>

## Files
<file-tree of files in this module with line ranges>

## Classes & Functions

### ClassName (responsibility)
| Property | Type | Description |
|----------|------|-------------|

#### `method_name(params) -> return_type`
Description.

### function_name(params) -> return_type
Description.

## Dependencies
- Depends on: <other modules>
- Used by: <other modules>
```

### Line Number Format

```markdown
├── ClassName       (L41-75)    Responsibility
```
> Confirmed via Grep, rounded to nearest integer. Use function/class names as primary locator.

### Language Patterns

| Language | Class | Function | Interface/Type | Export |
|----------|-------|----------|----------------|--------|
| Python | `^class ` | `^def `, `^    def ` | — | — |
| JS/TS | `^export class`, `^class` | `^export function`, `^function` | `^interface `, `^type ` | `^export const` |
| Go | `^type .* struct` | `^func ` | `^type ` | — |
| Rust | `^pub struct`, `^struct` | `^pub fn`, `^fn` | `^pub trait`, `^trait` | `^pub use` |
| Java | `^public class`, `^class` | `^public.*void`, `^public static` | `^public interface` | — |
| Swift | `^class `, `^struct `, `^actor ` | `^func `, `^    func ` | `^protocol ` | — |
| SwiftUI | `^struct .*: View` | `^var body: some View` | `^protocol ` | — |

---

## Important Notes

1. **Project Context is king** — Always read `doc/project-context.md` first. If missing, create it first.
2. **Module-based, not file-based** — Group source files into logical modules (framework apps, directories). One doc per module.
3. **Sync patches, rebuild regenerates** — Sync only touches changed modules. Rebuild can overwrite module docs (never context or manual docs).
4. **Respect .gitignore** — Never process git-ignored files.
5. **Batch when needed** — Large projects use subagents to avoid context overflow.
6. **Verify only what changed** — Don't re-scan the entire project during verification.
7. **Line numbers are reference** — Use function/class names as primary locator.
8. **Protect manual docs** — Project Context §8 lists hand-maintained docs. Never overwrite them.
9. **Report to user** — After completion, list all updated/created docs and verification results.
10. **Write notes for the future** — The core philosophy: append discoveries (repeated emphasis, solved problems, cross-AI rules) to `doc/notes.md` so any AI can solve the same problem consistently later. Append-only, never overwrite.
