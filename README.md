# 指令表網站

只有三個檔案：

- **`index.html`** — 指令表頁面（JS 內嵌）
- **`style.css`** — 樣式（Apple 深色風格）
- **`commands.json`** — 指令資料，要改指令就編輯這個檔

## 怎麼改指令

用任何文字編輯器打開 `commands.json`，改完存檔、push，約 1 分鐘後網站更新。

```json
{
  "title": "我的指令表",
  "prefix": "!",
  "groups": [
    {
      "name": "核心",
      "commands": [
        {
          "name": "help",
          "description": "列出所有指令",
          "permission": "所有觀眾",
          "cooldown": "每人 15 秒",
          "aliases": ["指令表", "commands"]
        }
      ]
    }
  ]
}
```

欄位說明：`name` 指令名稱、`description` 說明、`permission` 權限、`cooldown` 冷卻、`aliases` 別名（陣列）。分類就是 `groups` 裡的每一個物件，可自由增減。

## 部署到 GitHub Pages

1. 到 <https://github.com/new> 建立 **Public** 儲存庫（建議名稱 `command-website`），不要加入初始化檔案
2. 在此資料夾執行：

   ```powershell
   git remote add origin https://github.com/<你的使用者名稱>/command-website.git
   git push -u origin main
   ```

3. 儲存庫 **Settings → Pages** → Source：Deploy from a branch → `main` / `/ (root)` → Save
4. 網址：`https://<你的使用者名稱>.github.io/command-website/`

## 本機預覽

```powershell
python -m http.server 8000
```

開 <http://localhost:8000/>。（直接雙擊 `index.html` 無法載入 JSON，瀏覽器會擋。）
