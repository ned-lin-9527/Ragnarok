# 攻略網站

本站由專案根目錄的 `Role/` 與 `裝備/` Markdown 產生。原始攻略仍是唯一內容來源；不需另行編輯 HTML。

`Role/初心者/` 等單層職業目錄也會進入職業索引。初心者一轉前攻略固定為首頁的新手入口與職業列表首篇；新增攻略後請確認此入口、首頁職業標籤、文章連結與搜尋結果。

## 本機建置

在專案根目錄執行：

```bash
node site/build.cjs
python3 -m http.server 8000 --directory site/dist
```

然後開啟 `http://localhost:8000/`。建置只需要 Node.js，Markdown 解析器已隨網站原始碼保存於 `site/vendor/`。

## 發佈

公開網址：[RO 放置仙境攻略索引](https://ned-lin-9527.github.io/Ragnarok/)。`.github/workflows/pages.yml` 會在 `main` 分支的攻略或網站檔案更新後，自動重新建置並部署 GitHub Pages，也可手動執行。GitHub Pages 的建置來源為 **GitHub Actions**；網站採相對路徑，支援 `/Ragnarok/` 子路徑。

網站原始碼與已產生的 `site/dist/` 也可由 Sites 工作流程部署。修改攻略後，先重新執行 `node site/build.cjs`，檢查產生的文章、首頁與 `site/dist/search.json`，再提交變更；GitHub Actions 會在部署時再次建置。

## 設計原則

- 每篇 Markdown 各有獨立頁面，保留表格、原始連結與最後查證日期。
- 同內容的詩人／舞孃攻略合併成一頁，兩個原始檔仍保留。
- 搜尋索引由攻略全文產生，搜尋只在瀏覽器內執行。
- 靜態網站沒有帳號、資料庫與伺服器 API；更新內容只需重新建置與發佈。
- 技能配點模擬器（`skills.html`）由 `build.cjs` 依 `data/` 最新的技能樹快照產生，前端邏輯在 `site/skills.js`；配點狀態只存在網址 hash，不寫入瀏覽器儲存。
