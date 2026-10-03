# 指令表網站（GitHub Pages）

兩個頁面、一個儲存庫：

| 頁面 | 網址 | 用途 |
|---|---|---|
| 瀏覽頁 | `index.html` | 給觀眾看的指令表（搜尋、分類、權限、冷卻、別名） |
| 編輯頁 | `admin.html` | 你自己用：新增／刪除／拖曳排序指令方塊、修改內容 |

資料存在 `commands.json`，編輯頁透過 GitHub API 直接把變更提交回儲存庫，瀏覽頁約 1 分鐘後自動更新。

---

## 第一次部署

1. 到 <https://github.com/new> 建立儲存庫（建議名稱 `command-website`，選 **Public**），先不要加入任何初始化檔案。
2. 在電腦上開啟終端機，執行：

   ```powershell
   cd "C:\Users\user\Desktop\command website"
   git remote add origin https://github.com/<你的使用者名稱>/command-website.git
   git push -u origin main
   ```

3. 到儲存庫的 **Settings → Pages**：
   - Source：**Deploy from a branch**
   - Branch：`main` / `/ (root)` → **Save**
4. 等約 1 分鐘，開 `https://<你的使用者名稱>.github.io/command-website/` 就能看到瀏覽頁。

## 編輯頁設定（只需設定一次）

第一次打開 `.../admin.html` 時：

1. **GitHub 儲存設定** 區塊會自動帶入儲存庫位置（若偵測不到就手動填 `使用者名稱/儲存庫名稱`）。
2. 建立一顆 Personal Access Token：
   - 推薦 Fine-grained token：<https://github.com/settings/personal-access-tokens/new>
     - Repository access：**Only select repositories** → 選這個儲存庫
     - Permissions → Repository permissions → **Contents: Read and write**
   - 或經典 token：<https://github.com/settings/tokens>（勾選 `repo`）
3. 貼上 Token → 按 **儲存設定**。Token 只存在你瀏覽器的 localStorage，不會出現在網站程式碼裡。

## 編輯頁使用方式

- **＋ 新增分類**／**＋ 新增指令**：加入新的分類區塊或指令方塊
- 每個方塊可修改：**指令名稱、說明、權限、冷卻、別名**（別名用逗號分隔）
- **拖曳方塊左上角的 ⠿**：重新排序指令（可在分類之間拖曳）；拖曳分類標題列可調整分類順序
- **儲存到 GitHub**：把目前內容提交到 `commands.json`（約 1 分鐘後瀏覽頁更新）
- **重新載入**：捨弃未儲存的變更，抓取 GitHub 上最新版本
- **匯出／匯入**：下載或讀取 `commands.json` 備份

> 編輯頁本身是公開的，但沒有你的 Token 就無法把變更發佈出去；別人最多只能在自己的瀏覽器裡編輯。

## 本機測試

```powershell
cd "C:\Users\user\Desktop\command website"
python -m http.server 8000
```

開 <http://localhost:8000/>（瀏覽頁）、<http://localhost:8000/admin.html>（編輯頁）。
