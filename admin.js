/* admin.js — 指令表編輯器（新增／拖曳／GitHub 儲存） */
(function () {
  "use strict";

  var KEY_SET = "cmd_site_settings";
  var KEY_DRAFT = "cmd_site_draft";
  var DEFAULT_DATA = { title: "我的指令表", prefix: "!", groups: [] };

  var data = clone(DEFAULT_DATA);
  var settings = { slug: "", token: "" };
  var dirty = false;
  var saving = false;
  var drag = null;
  var draftTimer = null;
  var toastTimer = null;
  var pendingFocus = null;

  var el = {
    groups: document.getElementById("groups"),
    adminEmpty: document.querySelector("[data-admin-empty]"),
    pill: document.querySelector("[data-pill]"),
    toast: document.getElementById("toast"),
    tokenPanel: document.getElementById("token-panel"),
    repoInput: document.querySelector("[data-repo]"),
    tokenInput: document.querySelector("[data-token]"),
    tokenState: document.querySelector("[data-token-state]"),
    draftBanner: document.querySelector("[data-draft-banner]"),
    draftTs: document.querySelector("[data-draft-ts]"),
    metaTitle: document.querySelector("[data-meta-title]"),
    metaPrefix: document.querySelector("[data-meta-prefix]"),
    importFile: document.getElementById("import-file"),
    btnAddGroup: document.querySelector("[data-add-group]"),
    btnSave: document.querySelector("[data-save]"),
    btnReload: document.querySelector("[data-reload]"),
    btnExport: document.querySelector("[data-export]"),
    btnSaveSettings: document.querySelector("[data-save-settings]"),
    btnClearSettings: document.querySelector("[data-clear-settings]"),
    btnDiscardDraft: document.querySelector("[data-discard-draft]"),
    btnKeepDraft: document.querySelector("[data-keep-draft]")
  };

  /* ================= 工具函式 ================= */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function uid(p) {
    return p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.className = "show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = ""; }, 4500);
  }

  function parseAliases(str) {
    return String(str == null ? "" : str)
      .split(/[,，、]/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function sanitize(raw) {
    var d = raw && typeof raw === "object" ? raw : {};
    var out = {
      title: (typeof d.title === "string" && d.title.trim()) ? d.title : DEFAULT_DATA.title,
      prefix: (typeof d.prefix === "string" && d.prefix) ? d.prefix : DEFAULT_DATA.prefix,
      groups: []
    };
    (Array.isArray(d.groups) ? d.groups : []).forEach(function (g) {
      if (!g || typeof g !== "object") return;
      var grp = {
        id: String(g.id || uid("g")),
        name: String(g.name || "未命名分類"),
        commands: []
      };
      (Array.isArray(g.commands) ? g.commands : []).forEach(function (c) {
        if (!c || typeof c !== "object") return;
        grp.commands.push({
          id: String(c.id || uid("c")),
          name: String(c.name || ""),
          description: String(c.description || ""),
          permission: String(c.permission || ""),
          cooldown: String(c.cooldown || ""),
          aliases: Array.isArray(c.aliases) ? c.aliases.map(String) : parseAliases(c.aliases)
        });
      });
      out.groups.push(grp);
    });
    return out;
  }

  function findGroup(gid) {
    for (var i = 0; i < data.groups.length; i++) {
      if (data.groups[i].id === gid) return data.groups[i];
    }
    return null;
  }

  function findCmd(gid, cid) {
    var g = findGroup(gid);
    if (!g) return null;
    for (var i = 0; i < g.commands.length; i++) {
      if (g.commands[i].id === cid) return g.commands[i];
    }
    return null;
  }

  /* ================= 渲染 ================= */

  function cmdHtml(c, prefix) {
    return '<article class="cmd cmd-editor" data-cid="' + c.id + '">' +
      '<div class="cmd-head" draggable="true" title="拖曳排序">' +
        '<span class="handle">⠿</span>' +
        '<span class="preview" data-preview>' + esc(prefix + (c.name || "未命名")) + "</span>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-cmd>刪除</button>' +
      "</div>" +
      '<div class="grid2">' +
        '<label class="field">指令名稱' +
          '<input type="text" data-f="name" value="' + esc(c.name) + '" placeholder="新指令" spellcheck="false">' +
        "</label>" +
        '<label class="field">權限' +
          '<input type="text" data-f="permission" list="perm-list" value="' + esc(c.permission) + '" placeholder="例如：所有觀眾">' +
        "</label>" +
        '<label class="field full">說明' +
          '<input type="text" data-f="description" value="' + esc(c.description) + '" placeholder="這個指令做什麼">' +
        "</label>" +
        '<label class="field">冷卻' +
          '<input type="text" data-f="cooldown" value="' + esc(c.cooldown) + '" placeholder="例如：每人 15 秒">' +
        "</label>" +
        '<label class="field">別名（逗號分隔）' +
          '<input type="text" data-f="aliases" value="' + esc(c.aliases.join(", ")) + '" placeholder="help, commands">' +
        "</label>" +
      "</div>" +
    "</article>";
  }

  function groupHtml(g) {
    var h = '<section class="group" data-gid="' + g.id + '">';
    h += '<div class="group-head" draggable="true" title="拖曳可調整分類順序">';
    h += '<span class="handle">⠿</span>';
    h += '<input type="text" class="group-name" data-gname value="' + esc(g.name) + '" placeholder="分類名稱" spellcheck="false">';
    h += '<span class="count muted small">（' + g.commands.length + " 個指令）</span>";
    h += '<span class="actions">' +
           '<button type="button" class="btn btn-sm" data-add-cmd>＋ 新增指令</button>' +
           '<button type="button" class="btn btn-sm btn-danger" data-del-group>刪除分類</button>' +
         "</span>";
    h += "</div>";
    h += '<div class="cmd-list" data-list>';
    g.commands.forEach(function (c) { h += cmdHtml(c, data.prefix); });
    h += "</div>";
    h += '<div class="add-row"><button type="button" class="btn btn-sm btn-ghost" data-add-cmd>＋ 新增指令</button></div>';
    h += "</section>";
    return h;
  }

  function render() {
    var html = "";
    data.groups.forEach(function (g) { html += groupHtml(g); });
    el.groups.innerHTML = html;
    el.adminEmpty.hidden = data.groups.length > 0;

    if (pendingFocus) {
      var sel = '[data-cid="' + pendingFocus.cid + '"] [data-f="name"]';
      var grpSel = '[data-gid="' + pendingFocus.gid + '"] [data-gname]';
      var input = pendingFocus.kind === "group"
        ? el.groups.querySelector(grpSel)
        : el.groups.querySelector(sel);
      if (input) { input.focus(); input.select(); }
      pendingFocus = null;
    }
  }

  function updatePreview(card) {
    var nameInput = card.querySelector('[data-f="name"]');
    var preview = card.querySelector("[data-preview]");
    if (nameInput && preview) {
      preview.textContent = data.prefix + (nameInput.value.trim() || "未命名");
    }
  }

  function updatePreviews() {
    Array.prototype.forEach.call(
      el.groups.querySelectorAll(".cmd-editor"),
      updatePreview
    );
  }

  function updatePill() {
    el.pill.textContent = dirty ? "未儲存的變更" : "已儲存";
    el.pill.className = "pill " + (dirty ? "dirty" : "saved");
  }

  function setMetaInputs() {
    el.metaTitle.value = data.title;
    el.metaPrefix.value = data.prefix;
  }

  /* ================= 草稿（localStorage） ================= */

  function markDirty() {
    dirty = true;
    updatePill();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }

  function saveDraft() {
    try {
      localStorage.setItem(KEY_DRAFT, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* storage full / private mode */ }
  }

  window.addEventListener("beforeunload", function () {
    if (dirty) saveDraft();
  });

  function readDraft() {
    try {
      var s = localStorage.getItem(KEY_DRAFT);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(KEY_DRAFT); } catch (e) {}
  }

  function showDraftBanner(ts) {
    el.draftTs.textContent = new Date(ts).toLocaleString("zh-TW");
    el.draftBanner.hidden = false;
  }

  function hideDraftBanner() { el.draftBanner.hidden = true; }

  /* ================= 編輯操作 ================= */

  function addGroup() {
    var g = { id: uid("g"), name: "新分類", commands: [] };
    data.groups.push(g);
    pendingFocus = { kind: "group", gid: g.id };
    markDirty();
    render();
    el.groups.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function delGroup(gid) {
    data.groups = data.groups.filter(function (g) { return g.id !== gid; });
    markDirty();
    render();
  }

  function addCmd(gid) {
    var g = findGroup(gid);
    if (!g) return;
    var c = {
      id: uid("c"), name: "", description: "",
      permission: "", cooldown: "", aliases: []
    };
    g.commands.push(c);
    pendingFocus = { kind: "cmd", gid: gid, cid: c.id };
    markDirty();
    render();
    var card = el.groups.querySelector('[data-cid="' + c.id + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function delCmd(gid, cid) {
    var g = findGroup(gid);
    if (!g) return;
    g.commands = g.commands.filter(function (c) { return c.id !== cid; });
    markDirty();
    render();
  }

  /* ================= 拖曳排序 ================= */

  function clearIndicators() {
    Array.prototype.forEach.call(
      el.groups.querySelectorAll(".drop-before, .drop-after, .drop-inside"),
      function (n) { n.classList.remove("drop-before", "drop-after", "drop-inside"); }
    );
  }

  function clearDragVisual() {
    Array.prototype.forEach.call(
      el.groups.querySelectorAll(".dragging"),
      function (n) { n.classList.remove("dragging"); }
    );
    clearIndicators();
  }

  el.groups.addEventListener("dragstart", function (e) {
    if (e.target.closest && e.target.closest("input, textarea, button, label")) {
      e.preventDefault();
      return;
    }
    var cmdHead = e.target.closest(".cmd-head");
    var groupHead = e.target.closest(".group-head");
    if (cmdHead) {
      var card = cmdHead.closest(".cmd-editor");
      var grp = card.closest(".group");
      drag = { type: "cmd", gid: grp.dataset.gid, cid: card.dataset.cid };
      card.classList.add("dragging");
      try { e.dataTransfer.setDragImage(card, 24, 24); } catch (err) {}
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "cmd");
    } else if (groupHead) {
      var section = groupHead.closest(".group");
      drag = { type: "group", gid: section.dataset.gid };
      section.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "group");
    } else {
      e.preventDefault();
    }
  });

  el.groups.addEventListener("dragend", function () {
    drag = null;
    clearDragVisual();
  });

  el.groups.addEventListener("dragover", function (e) {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearIndicators();

    if (drag.type === "cmd") {
      var overCmd = e.target.closest(".cmd-editor");
      var overList = e.target.closest("[data-list]");
      if (overCmd && overCmd.dataset.cid !== drag.cid) {
        var rect = overCmd.getBoundingClientRect();
        var after = (e.clientY - rect.top) > rect.height / 2;
        overCmd.classList.add(after ? "drop-after" : "drop-before");
      } else if (!overCmd && overList) {
        overList.classList.add("drop-inside");
      } else if (!overCmd && e.target.closest(".group")) {
        var list = e.target.closest(".group").querySelector("[data-list]");
        if (list) list.classList.add("drop-inside");
      }
    } else if (drag.type === "group") {
      var overHead = e.target.closest(".group-head");
      if (overHead) {
        var sec = overHead.closest(".group");
        if (sec.dataset.gid !== drag.gid) {
          var gRect = sec.getBoundingClientRect();
          var gAfter = (e.clientY - gRect.top) > gRect.height / 2;
          overHead.classList.add(gAfter ? "drop-after" : "drop-before");
        }
      } else if (e.target.closest("#groups")) {
        var sections = el.groups.querySelectorAll(".group");
        var last = sections[sections.length - 1];
        if (last && last.dataset.gid !== drag.gid) {
          last.querySelector(".group-head").classList.add("drop-after");
        }
      }
    }
  });

  function nextCard(card) {
    var n = card.nextElementSibling;
    return n && n.classList.contains("cmd-editor") ? n : null;
  }

  el.groups.addEventListener("drop", function (e) {
    if (!drag) return;
    e.preventDefault();

    if (drag.type === "cmd") {
      var target = null;
      var beforeEl = el.groups.querySelector(".cmd-editor.drop-before");
      var afterEl = el.groups.querySelector(".cmd-editor.drop-after");
      var insideEl = el.groups.querySelector("[data-list].drop-inside");
      if (beforeEl) {
        target = { gid: beforeEl.closest(".group").dataset.gid, before: beforeEl.dataset.cid };
      } else if (afterEl) {
        var nxt = nextCard(afterEl);
        target = { gid: afterEl.closest(".group").dataset.gid, before: nxt ? nxt.dataset.cid : null };
      } else if (insideEl) {
        target = { gid: insideEl.closest(".group").dataset.gid, before: null };
      }
      if (target) {
        moveCmd(drag.gid, drag.cid, target.gid, target.before);
        markDirty();
      }
    } else {
      var beforeGid;
      var bHead = el.groups.querySelector(".group-head.drop-before");
      var aHead = el.groups.querySelector(".group-head.drop-after");
      if (bHead) {
        beforeGid = bHead.closest(".group").dataset.gid;
      } else if (aHead) {
        var aSec = aHead.closest(".group");
        var nextSec = aSec.nextElementSibling;
        beforeGid = nextSec ? nextSec.dataset.gid : null;
      } else {
        beforeGid = undefined;
      }
      if (beforeGid !== undefined) {
        moveGroup(drag.gid, beforeGid);
        markDirty();
      }
    }
    clearDragVisual();
    render();
  });

  function moveCmd(fromGid, cid, toGid, beforeCid) {
    var src = findGroup(fromGid);
    var dst = findGroup(toGid);
    if (!src || !dst) return;
    var idx = -1;
    for (var i = 0; i < src.commands.length; i++) {
      if (src.commands[i].id === cid) { idx = i; break; }
    }
    if (idx < 0) return;
    var cmd = src.commands.splice(idx, 1)[0];
    var di = dst.commands.length;
    if (beforeCid) {
      for (var j = 0; j < dst.commands.length; j++) {
        if (dst.commands[j].id === beforeCid) { di = j; break; }
      }
    }
    dst.commands.splice(di, 0, cmd);
  }

  function moveGroup(gid, beforeGid) {
    var idx = -1;
    for (var i = 0; i < data.groups.length; i++) {
      if (data.groups[i].id === gid) { idx = i; break; }
    }
    if (idx < 0) return;
    var g = data.groups.splice(idx, 1)[0];
    var di = data.groups.length;
    if (beforeGid) {
      for (var j = 0; j < data.groups.length; j++) {
        if (data.groups[j].id === beforeGid) { di = j; break; }
      }
    }
    data.groups.splice(di, 0, g);
  }

  /* ================= 內容輸入 ================= */

  el.groups.addEventListener("input", function (e) {
    var t = e.target;
    if (t.matches("[data-f]")) {
      var card = t.closest(".cmd-editor");
      var grp = t.closest(".group");
      var c = findCmd(grp.dataset.gid, card.dataset.cid);
      if (!c) return;
      var f = t.getAttribute("data-f");
      if (f === "aliases") c.aliases = parseAliases(t.value);
      else c[f] = t.value;
      if (f === "name") updatePreview(card);
      markDirty();
    } else if (t.matches("[data-gname]")) {
      var g = findGroup(t.closest(".group").dataset.gid);
      if (g) { g.name = t.value; markDirty(); }
    }
  });

  el.groups.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var grp = btn.closest(".group");
    if (!grp) return;
    if (btn.hasAttribute("data-add-cmd")) {
      addCmd(grp.dataset.gid);
    } else if (btn.hasAttribute("data-del-cmd")) {
      var card = btn.closest(".cmd-editor");
      if (confirm("刪除這個指令？")) delCmd(grp.dataset.gid, card.dataset.cid);
    } else if (btn.hasAttribute("data-del-group")) {
      if (confirm("刪除這個分類及裡面的所有指令？")) delGroup(grp.dataset.gid);
    }
  });

  /* ================= 站點設定輸入 ================= */

  el.metaTitle.addEventListener("input", function () {
    data.title = el.metaTitle.value.trim() || DEFAULT_DATA.title;
    markDirty();
  });

  el.metaPrefix.addEventListener("input", function () {
    data.prefix = el.metaPrefix.value || DEFAULT_DATA.prefix;
    updatePreviews();
    markDirty();
  });

  /* ================= GitHub API ================= */

  function parseSlug() {
    var m = /^([^/\s]+)\/([^/\s]+)$/.exec(String(settings.slug || "").trim());
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  function ghHeaders() {
    return {
      Authorization: "Bearer " + settings.token,
      Accept: "application/vnd.github+json"
    };
  }

  function ghErr(r) {
    if (r.status === 401) return "Token 無效或已過期";
    if (r.status === 403) return "沒有權限（檢查 Token 權限或儲存庫位置）";
    if (r.status === 404) return "找不到儲存庫或檔案（檢查「使用者名稱/儲存庫名稱」）";
    if (r.status === 429) return "請求過於頻繁，稍後再試";
    return "GitHub 回應 HTTP " + r.status;
  }

  async function ghGet() {
    var p = parseSlug();
    if (!p) throw new Error("儲存庫格式應為 使用者名稱/儲存庫名稱");
    var url = "https://api.github.com/repos/" + p.owner + "/" + p.repo + "/contents/commands.json";
    var r = await fetch(url, { headers: ghHeaders() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(ghErr(r));
    return r.json();
  }

  function fromB64(b64) {
    var bin = atob(String(b64).replace(/[\r\n]/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function toB64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function ghLoad() {
    var j = await ghGet();
    if (!j || !j.content) return null;
    return JSON.parse(fromB64(j.content));
  }

  async function ghSave() {
    var p = parseSlug();
    if (!p) throw new Error("儲存庫格式應為 使用者名稱/儲存庫名稱");
    var url = "https://api.github.com/repos/" + p.owner + "/" + p.repo + "/contents/commands.json";

    for (var attempt = 0; attempt < 2; attempt++) {
      var sha = null;
      try {
        var j = await ghGet();
        if (j) sha = j.sha;
      } catch (e) {
        if (attempt > 0) throw e;
        throw e;
      }
      var body = {
        message: "更新指令表 " + new Date().toISOString(),
        content: toB64(JSON.stringify(data, null, 2) + "\n")
      };
      if (sha) body.sha = sha;
      var r = await fetch(url, {
        method: "PUT",
        headers: Object.assign({}, ghHeaders(), { "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });
      if (r.ok) return;
      if ((r.status === 409 || r.status === 422) && attempt === 0) continue;
      throw new Error(ghErr(r));
    }
  }

  /* ================= 載入 ================= */

  async function localLoad() {
    var r = await fetch("./commands.json?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function loadBase() {
    if (settings.slug && settings.token) {
      try {
        var g = await ghLoad();
        if (g) return g;
      } catch (e) {
        toast("GitHub 載入失敗：" + e.message, "err");
      }
    }
    try {
      return await localLoad();
    } catch (e) {
      toast("載入 commands.json 失敗", "err");
      return null;
    }
  }

  async function reloadFromBase() {
    var base = await loadBase();
    if (!base) return false;
    data = sanitize(base);
    dirty = false;
    clearDraft();
    hideDraftBanner();
    updatePill();
    setMetaInputs();
    render();
    return true;
  }

  /* ================= 設定 ================= */

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY_SET) || "null");
      if (s && typeof s === "object") {
        settings.slug = String(s.slug || "");
        settings.token = String(s.token || "");
      }
    } catch (e) {}
    el.repoInput.value = settings.slug;
    el.tokenInput.value = settings.token;
    refreshSettingsState();
  }

  function refreshSettingsState() {
    if (settings.slug && settings.token) {
      el.tokenState.hidden = false;
      el.tokenState.textContent = "已設定：" + settings.slug;
      el.tokenState.className = "token-state ok";
    } else {
      el.tokenState.hidden = true;
    }
  }

  function deriveSlug() {
    var host = location.hostname;
    if (/\.github\.io$/i.test(host)) {
      var owner = host.slice(0, -(".github.io".length));
      var segs = location.pathname.split("/").filter(Boolean);
      var repo = segs.length ? segs[0] : host;
      return owner + "/" + repo;
    }
    return "";
  }

  el.btnSaveSettings.addEventListener("click", function () {
    var slug = el.repoInput.value.trim();
    var token = el.tokenInput.value.trim();
    if (!/^[^/\s]+\/[^/\s]+$/.test(slug)) {
      toast("儲存庫格式應為 使用者名稱/儲存庫名稱", "err");
      el.repoInput.focus();
      return;
    }
    if (!token) {
      toast("請輸入 GitHub Token", "err");
      el.tokenInput.focus();
      return;
    }
    settings.slug = slug;
    settings.token = token;
    try {
      localStorage.setItem(KEY_SET, JSON.stringify(settings));
    } catch (e) {}
    refreshSettingsState();
    toast("設定已儲存", "ok");
  });

  el.btnClearSettings.addEventListener("click", function () {
    settings = { slug: "", token: "" };
    try { localStorage.removeItem(KEY_SET); } catch (e) {}
    el.repoInput.value = "";
    el.tokenInput.value = "";
    refreshSettingsState();
    toast("已清除設定", "ok");
  });

  /* ================= 工具列動作 ================= */

  el.btnSave.addEventListener("click", async function () {
    if (saving) return;
    if (!settings.slug || !settings.token) {
      toast("請先完成上方「GitHub 儲存設定」", "err");
      el.tokenPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      el.repoInput.focus();
      return;
    }
    saving = true;
    el.btnSave.disabled = true;
    el.btnSave.textContent = "儲存中…";
    try {
      await ghSave();
      dirty = false;
      clearDraft();
      hideDraftBanner();
      updatePill();
      toast("已儲存到 GitHub（瀏覽頁約 1 分鐘後更新）", "ok");
    } catch (e) {
      toast("儲存失敗：" + e.message, "err");
    } finally {
      saving = false;
      el.btnSave.disabled = false;
      el.btnSave.textContent = "儲存到 GitHub";
    }
  });

  el.btnReload.addEventListener("click", async function () {
    if (dirty && !confirm("確定要捨弃未儲存的變更，重新載入已儲存的版本？")) return;
    var ok = await reloadFromBase();
    if (ok) toast("已重新載入", "ok");
  });

  el.btnExport.addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "commands.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  el.importFile.addEventListener("change", function () {
    var file = el.importFile.files && el.importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        data = sanitize(parsed);
        markDirty();
        setMetaInputs();
        render();
        toast("已匯入（記得儲存到 GitHub）", "ok");
      } catch (e) {
        toast("匯入失敗：不是有效的 JSON", "err");
      }
      el.importFile.value = "";
    };
    reader.readAsText(file, "utf-8");
  });

  el.btnAddGroup.addEventListener("click", addGroup);

  el.btnDiscardDraft.addEventListener("click", async function () {
    var ok = await reloadFromBase();
    if (ok) toast("已捨弃變更並重新載入", "ok");
  });

  el.btnKeepDraft.addEventListener("click", hideDraftBanner);

  /* ================= 啟動 ================= */

  async function init() {
    loadSettings();
    if (!settings.slug) {
      var derived = deriveSlug();
      if (derived) el.repoInput.value = derived;
    }

    var base = await loadBase();
    data = sanitize(base || DEFAULT_DATA);

    var draft = readDraft();
    if (draft && draft.data && typeof draft.data === "object") {
      data = sanitize(draft.data);
      dirty = true;
      showDraftBanner(draft.ts || Date.now());
    }

    setMetaInputs();
    updatePill();
    render();
  }

  init();
})();
