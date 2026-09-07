(function () {
  'use strict';

  /* 知识库由 kb/faq.js 通过 window.CHATBOT_KB 注入（脚本标签加载，file:// 与 GitHub Pages 均可，无 CORS 问题） */
  var KB = (window.CHATBOT_KB || []).slice();

  /* ---------------- 索引与匹配（纯前端，无外部依赖） ---------------- */
  function latinWords(s) { return (s.toLowerCase().match(/[a-z0-9]+/g) || []); }
  function cjkChars(s) { return (s.match(/[一-鿿]/g) || []); }
  function cjkBigrams(s) {
    var cs = cjkChars(s), out = [];
    for (var i = 0; i < cs.length - 1; i++) out.push(cs[i] + cs[i + 1]);
    if (cs.length === 1) out.push(cs[0]);
    return out;
  }
  function signals(s) {
    var set = {};
    latinWords(s).forEach(function (w) { set[w] = 1; });
    cjkBigrams(s).forEach(function (b) { set[b] = 1; });
    return set;
  }

  var INDEX = KB.map(function (e) {
    var sig = {};
    (e.keywords || []).forEach(function (k) {
      var sk = signals(k);
      for (var t in sk) sig[t] = (sig[t] || 0) + 5; /* 显式关键词权重高 */
    });
    var qs = signals(e.q || '');
    for (var t in qs) sig[t] = (sig[t] || 0) + 1;     /* 问题文本权重低 */
    return { e: e, sig: sig };
  });

  function bestMatch(query) {
    var qs = signals(query), top = null, topScore = 0, second = 0;
    INDEX.forEach(function (item) {
      var s = 0;
      for (var t in qs) if (item.sig[t]) s += item.sig[t];
      if (s > topScore) { second = topScore; topScore = s; top = item.e; }
      else if (s > second) second = s;
    });
    return { entry: top, score: topScore, second: second };
  }

  function resolve(query) {
    var r = bestMatch(query);
    if (r.entry && r.score >= 3 && r.score > r.second * 1.1) {
      return { ok: true, text: r.entry.a, entry: r.entry };
    }
    return { ok: false };
  }

  /* ---------------- UI ---------------- */
  var ACCENT = '#0E9F6E';
  var STYLE = '' +
    '#cb-bubble{position:fixed;right:22px;bottom:86px;display:inline-flex;align-items:center;gap:8px;' +
    'background:' + ACCENT + ';color:#fff;cursor:pointer;z-index:999999;padding:12px 20px;border-radius:999px;' +
    'font:600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
    'box-shadow:0 6px 18px rgba(0,0,0,.22);transition:transform .15s,box-shadow .15s}' +
    '#cb-bubble:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.28)}' +
    '#cb-panel{position:fixed;right:22px;bottom:150px;width:360px;max-width:calc(100vw - 44px);height:480px;' +
    'max-height:calc(100vh - 212px);background:#fff;border:1px solid #e5e7eb;border-radius:14px;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:999999;display:none;flex-direction:column;overflow:hidden;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}' +
    '#cb-head{background:' + ACCENT + ';color:#fff;padding:12px 14px;font-size:14px;font-weight:600;' +
    'display:flex;align-items:center;justify-content:space-between}' +
    '#cb-close{cursor:pointer;opacity:.85;font-size:18px;line-height:1}' +
    '#cb-body{flex:1;overflow-y:auto;padding:12px;background:#f8fafc}' +
    '#cb-foot{border-top:1px solid #e5e7eb;display:flex;padding:8px;background:#fff}' +
    '#cb-input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:13px;outline:none}' +
    '#cb-send{margin-left:8px;background:' + ACCENT + ';color:#fff;border:none;border-radius:8px;' +
    'padding:0 14px;font-size:13px;cursor:pointer}' +
    '.cb-msg{margin:8px 0;max-width:82%;padding:8px 11px;border-radius:12px;font-size:13px;line-height:1.6;word-break:break-word}' +
    '.cb-bot{background:#fff;border:1px solid #e5e7eb;color:#1f2937;align-self:flex-start;border-bottom-left-radius:4px}' +
    '.cb-user{background:' + ACCENT + ';color:#fff;margin-left:auto;border-bottom-right-radius:4px}' +
    '.cb-row{display:flex;flex-direction:column}' +
    '.cb-chip{display:inline-block;margin:4px 6px 0 0;padding:6px 10px;background:#eef2f0;color:' + ACCENT + ';' +
    'border:1px solid #cfe3da;border-radius:16px;font-size:12px;cursor:pointer}' +
    '.cb-chip:hover{background:#e0ece6}';

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function init() {
    if (document.getElementById('cb-bubble')) return;
    var style = el('style'); style.textContent = STYLE; document.head.appendChild(style);

    var bubble = el('div', { id: 'cb-bubble', title: '客服助手' });
    bubble.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.4A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg><span>客服助手</span>';

    var panel = el('div', { id: 'cb-panel' });
    var head = el('div', { id: 'cb-head' }, '<span>客服助手</span><span id="cb-close">×</span>');
    var body = el('div', { id: 'cb-body' });
    var foot = el('div', { id: 'cb-foot' });
    var input = el('input', { id: 'cb-input', type: 'text', placeholder: '输入您的问题…' });
    var send = el('button', { id: 'cb-send' }, '发送');
    foot.appendChild(input); foot.appendChild(send);
    panel.appendChild(head); panel.appendChild(body); panel.appendChild(foot);

    document.body.appendChild(bubble); document.body.appendChild(panel);

    function openPanel() {
      panel.style.display = 'flex';
      if (!panel.dataset.started) { panel.dataset.started = '1'; greet(); }
      input.focus();
    }
    function closePanel() { panel.style.display = 'none'; }
    bubble.addEventListener('click', function () {
      panel.style.display === 'flex' ? closePanel() : openPanel();
    });
    document.getElementById('cb-close').addEventListener('click', closePanel);

    function addMsg(text, who) {
      var row = el('div', { 'class': 'cb-row' });
      var safe = escapeHtml(text).replace(/\n/g, '<br>');
      var m = el('div', { 'class': 'cb-msg ' + (who === 'user' ? 'cb-user' : 'cb-bot') }, safe);
      row.appendChild(m); body.appendChild(row); body.scrollTop = body.scrollHeight;
    }
    function addChips(list) {
      var row = el('div', { 'class': 'cb-row' });
      list.forEach(function (q) {
        var c = el('span', { 'class': 'cb-chip' }, escapeHtml(q));
        c.addEventListener('click', function () { handle(q); });
        row.appendChild(c);
      });
      body.appendChild(row); body.scrollTop = body.scrollHeight;
    }

    function greet() {
      addMsg('您好，我是碳市场分析平台客服助手，可解答安装、激活、使用等一般问题。您可以直接输入，或选择下方常见问题：', 'bot');
      addChips(KB.slice(0, 5).map(function (e) { return e.q; }));
    }

    function fallback() {
      addMsg('抱歉，未能精准匹配您的问题。您可以：① 点击下方常见问题；② 到页面底部「意见反馈」留言，我们会尽快回复。', 'bot');
      addChips(KB.slice(0, 5).map(function (e) { return e.q; }));
    }

    function handle(q) {
      if (!q) return;
      addMsg(q, 'user');
      var r = resolve(q);
      if (r.ok) addMsg(r.text, 'bot');
      else fallback();
    }

    function doSend() {
      var v = input.value.trim();
      if (!v) return;
      input.value = '';
      handle(v);
    }
    send.addEventListener('click', doSend);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSend(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
