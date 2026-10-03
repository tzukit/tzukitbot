/* viewer.js — 瀏覽者指令表 */
(function () {
  "use strict";

  var DATA = { title: "我的指令表", prefix: "!", groups: [] };
  var query = "";

  var el = {
    title: document.querySelector("[data-site-title]"),
    footTitle: document.querySelector("[data-foot-title]"),
    prefix: document.querySelector("[data-site-prefix]"),
    total: document.querySelector("[data-total]"),
    search: document.querySelector("[data-cmd-search]"),
    count: document.querySelector("[data-cmd-count]"),
    groups: document.getElementById("groups"),
    empty: document.querySelector("[data-empty]"),
    note: document.querySelector("[data-note]"),
    loading: document.querySelector("[data-loading]")
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function normalize(s) {
    return String(s == null ? "" : s).toLowerCase();
  }

  function sanitize(raw) {
    var d = raw && typeof raw === "object" ? raw : {};
    var data = {
      title: typeof d.title === "string" && d.title.trim() ? d.title : "我的指令表",
      prefix: typeof d.prefix === "string" ? d.prefix : "!",
      groups: []
    };
    if (Array.isArray(d.groups)) {
      d.groups.forEach(function (g) {
        if (!g || typeof g !== "object") return;
        var group = {
          name: typeof g.name === "string" ? g.name : "未命名分類",
          commands: []
        };
        if (Array.isArray(g.commands)) {
          g.commands.forEach(function (c) {
            if (!c || typeof c !== "object") return;
            group.commands.push({
              name: String(c.name || ""),
              description: String(c.description || ""),
              permission: String(c.permission || ""),
              cooldown: String(c.cooldown || ""),
              aliases: Array.isArray(c.aliases) ? c.aliases.map(String) : []
            });
          });
        }
        data.groups.push(group);
      });
    }
    return data;
  }

  function matches(cmd, q) {
    if (!q) return true;
    var hay = normalize(cmd.name) + " " +
      normalize(cmd.description) + " " +
      normalize(cmd.permission) + " " +
      normalize(cmd.cooldown) + " " +
      cmd.aliases.map(normalize).join(" ");
    return hay.indexOf(q) !== -1;
  }

  function cmdHtml(c, prefix) {
    var h = '<article class="cmd">';
    h += '<span class="usage">' + esc(prefix + c.name) + "</span>";
    if (c.description) {
      h += '<p class="sum">' + esc(c.description) + "</p>";
    }
    var meta = [];
    if (c.permission) {
      meta.push('<span class="badge brand">' + esc(c.permission) + "</span>");
    }
    if (c.cooldown) {
      meta.push('<span class="chip">冷卻：' + esc(c.cooldown) + "</span>");
    }
    if (c.aliases.length) {
      meta.push('<span class="chip">也可以打：' +
        c.aliases.map(function (a) { return esc(prefix + a); }).join("、") + "</span>");
    }
    if (meta.length) h += '<p class="meta">' + meta.join("") + "</p>";
    h += "</article>";
    return h;
  }

  function render() {
    var prefix = DATA.prefix;
    var q = normalize(query.trim());
    var shownTotal = 0;
    var total = 0;
    var html = "";

    DATA.groups.forEach(function (g) {
      total += g.commands.length;
      var cmds = g.commands.filter(function (c) { return matches(c, q); });
      if (!cmds.length) return;
      shownTotal += cmds.length;
      html += '<section class="cmd-group">';
      html += "<h2>" + esc(g.name) +
        ' <span class="muted small">（' + cmds.length + "）</span></h2>";
      html += '<div class="cmd-list">';
      cmds.forEach(function (c) { html += cmdHtml(c, prefix); });
      html += "</div></section>";
    });

    el.groups.innerHTML = html;
    el.total.textContent = String(total);
    el.title.textContent = DATA.title;
    el.footTitle.textContent = DATA.title;
    document.title = DATA.title;
    el.prefix.textContent = prefix;

    var searching = q.length > 0;
    el.count.hidden = !searching;
    if (searching) {
      el.count.textContent = "顯示 " + shownTotal + " / " + total + " 個指令";
    }

    var nothing = DATA.groups.length === 0 ||
      (searching && shownTotal === 0);
    el.empty.hidden = !nothing;
    if (DATA.groups.length === 0) {
      el.empty.textContent = "還沒有任何指令。";
    } else if (searching && shownTotal === 0) {
      el.empty.textContent = "沒有符合的指令。換個關鍵字試試看。";
    }
    el.note.hidden = DATA.groups.length === 0;
  }

  async function load() {
    try {
      var res = await fetch("./commands.json?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      DATA = sanitize(await res.json());
      el.loading = null;
      render();
    } catch (err) {
      el.groups.innerHTML = "";
      el.empty.hidden = false;
      el.empty.textContent = "載入指令資料失敗，請稍後再試。";
      console.error(err);
    }
  }

  el.search.addEventListener("input", function () {
    query = el.search.value;
    render();
  });

  load();
})();
