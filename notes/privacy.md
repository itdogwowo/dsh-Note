# 隱私紅線（公開 repo）

> 這一節是血淚。真實發生過：一個公開 repo 的**第一顆 commit** 的 README 示意圖裡，
> 貼了側邊欄截圖——裡面是**公司的內部專案名**；另一份交接文件有 9 處完整家目錄路徑
> （夾帶使用者名稱），外加 8 張截圖。

## 會洩漏的三種東西

| 種類 | 長什麼樣 | 為什麼會發生 |
|---|---|---|
| **絕對路徑** | `C:\Users\<帳號>\…`、`/Users/<帳號>/…` | 寫文件圖方便，直接貼終端機的路徑 |
| **名稱** | 公司名、內部專案名、客戶名、同事名 | 貼截圖、或拿真實專案當例子 |
| **截圖** | `.png` | 畫面裡的側邊欄有工作區名稱與完整路徑 |

**共同點**：它們在你看畫面的時候「看起來只是路徑／只是示意圖」，
要等 repo 公開之後才會變成「我公開了我的帳號和公司在做什麼」。

> ⚠️ **側邊欄的「工作區名稱」就是內部專案名。** 它在畫面上看起來只是一個標籤，
> 所以你會忘了它算。

## ⚠️ `.gitignore` 擋不住網頁上傳

`.gitignore` 只對 `git add` 有效。**用 GitHub 網頁拖檔案進去，它完全不管 ignore。**

所以圖片不能靠 ignore 防——**要附圖就先裁掉側邊欄，或改用文字描述。**

## ⭐ `force push` **不會**刪掉 GitHub 上的東西

重寫歷史（squash、`--orphan`、filter-branch）之後，舊 commit 不再被任何分支指向，
**但只要你還記得 SHA，它照樣整份讀得出來**——包含完整的 patch 全文。

**驗證方法**：

```
https://api.github.com/repos/<owner>/<repo>/commits/<舊的完整 SHA>

  200 = 東西還在（API 會把 commit 全文吐回來，連 diff 都有）
  422 = 真的沒了（"No commit found for SHA"）
```

實際測過：force push 之後打舊 SHA，回的是 **200 加完整 patch**，不是 404。
**所以「推上去了、分支看起來乾淨」不能當成完成。**

其他要一起看的：

- 那顆 commit 的 `node_id` 有沒有換（`C_kwDO<base64 的 repo id>…`，換了就代表是新的物件庫）
- repo 的 `size` 有沒有掉（沒掉就是舊物件還在帳上）

### 徹底清除：刪掉 repo 重建

**唯一保證清乾淨的方法。** 先算代價：

| 看什麼 | 為什麼 |
|---|---|
| `forks_count` | **不是 0 就代表別人有一份，重建也救不回來** |
| `stargazers_count`／`subscribers_count` | 重建會歸零 |
| `open_issues_count`／`/releases` | 重建會全部消失 |

代價可接受就做：

1. `https://github.com/<owner>/<repo>/settings` → 最底 **Danger Zone** → Delete
2. **馬上**建一個同名、同 visibility 的 repo，⚠️ **不要勾** Add README／.gitignore／license
   —— 要完全空的，否則推上去會撞
3. 推回去

**commit 的 SHA 不會變**（內容定址：內容一樣，雜湊就一樣），
所以 `…/commit/<sha>` 這種連結照樣有效。

不想刪 repo 的另一條路：寄 GitHub Support 要求清除不可達物件（unreachable objects）。
保留 stars／issues，但要等幾天，而且不保證一定執行。

### 本地也要清

```powershell
git reflog expire --expire=now --all
git gc --prune=now
```

**reflog 會讓「已經刪掉的 commit」繼續活著**，所以要連它一起過期。

## 黑名單要放本機

把公司名寫進一個公開檔案來「防止公司名外洩」，是**自相矛盾**——你會親手把要保護的
字串 commit 出去。

所以掃描器的黑名單放**已 gitignore 的本機檔**：

```
.privacy-denylist.txt      # 一行一個詞，# 是註解
```

命中的時候**只報「檔案:行號（第幾個詞）」**，不報命中哪個詞——
因為檢查失敗的輸出最常被整段貼進對話或 issue。

## 掃描器的三個誤判來源

1. **描述裡的引號會截斷簡陋的正則**。用 `[^"]*` 抓 YAML 值，遇到 `"/commit"` 就斷了，
   於是「沒有 description」。要用真正的 YAML 解析或處理引號。
2. **API 路由長得像家目錄**。`/users/${id}`、`/users/{id}` 是 Express／FastAPI 的路由。
   用大小寫敏感的比對可濾掉大部分。
3. **不要掃 gitignore 掉的檔案**。用 `git ls-files -o --exclude-standard`
   （見 [`sync.md`](sync.md)），不要用 `git status`。

## 最容易發生的那一刻：寫說明的時候

實際案例：在**解釋「為什麼黑名單比對要不分大小寫」的註解裡**，
直接寫出了公司名的**實際大小寫**當例子。防線第一次跑就抓到作者自己。

**規則：講「上次洩漏了什麼」只講形狀，不講內容。** 要舉例就用 `<公司專案名>`。
