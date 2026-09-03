/**
 * Arbitrica — "Ask AI about us" widget
 * ------------------------------------------------------------------
 * A small card fixed in the bottom-right corner of the screen (where the
 * old support launcher sat), letting visitors ask ChatGPT or Perplexity
 * for an independent view of Arbitrica. Each button deep-links to the
 * assistant with a pre-filled prompt.
 *
 * Served at /chat-widget.js and included site-wide via
 *   <script src="chat-widget.js?v=2" defer></script>
 *
 * This file REPLACES the former "Found what you're looking for?" support
 * chat widget. That widget (and its /api/chat-notify -> sheet wiring) is
 * preserved in git history on the `arbitrica` branch and can be restored.
 */
(function () {
  'use strict';

  if (window.__arbAiWidgetLoaded) return;
  window.__arbAiWidgetLoaded = true;
  if (document.getElementById('arb-ai-widget')) return;

  /* ── Pre-filled prompt + assistant deep-links ─────────────────────────── */
  var PROMPT = 'Tell me how Arbitrica (arbitrica.com) saves people money on hotels';
  var q = encodeURIComponent(PROMPT);
  var LINKS = {
    chatgpt:    'https://chatgpt.com/?q=' + q,
    perplexity: 'https://www.perplexity.ai/search/new?q=' + q
  };

  /* ── Fonts (idempotent — matches the site: Space Grotesk + Inter) ──────── */
  if (!document.getElementById('arb-widget-fonts')) {
    var fl = document.createElement('link');
    fl.id = 'arb-widget-fonts';
    fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap';
    document.head.appendChild(fl);
  }

  /* ── Brand glyphs (white, inline SVG) ─────────────────────────────────── */
  var GPT_SVG = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.06 6.06 0 0 0 4.98 4.2a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.09 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 22a6.05 6.05 0 0 0 5.77-4.2 5.99 5.99 0 0 0 4-2.9 6.05 6.05 0 0 0-.75-7.08Zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.79-2.77a.78.78 0 0 0 .39-.68v-6.75l2.02 1.17a.07.07 0 0 1 .04.06v5.6a4.5 4.5 0 0 1-4.5 4.49Zm-9.66-4.13a4.48 4.48 0 0 1-.54-3.01l.14.09 4.79 2.77a.78.78 0 0 0 .78 0l5.85-3.38v2.34a.07.07 0 0 1-.03.06l-4.84 2.8a4.5 4.5 0 0 1-6.15-1.66Zm-1.26-10.4a4.48 4.48 0 0 1 2.34-1.97v5.68a.77.77 0 0 0 .39.68l5.84 3.37-2.02 1.17a.07.07 0 0 1-.07 0l-4.83-2.79a4.5 4.5 0 0 1-1.65-6.14Zm16.63 3.87-5.85-3.38 2.02-1.16a.07.07 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.68 8.12v-5.69a.78.78 0 0 0-.39-.68Zm2.01-3.03-.14-.08-4.79-2.77a.78.78 0 0 0-.78 0L9.4 9.23V6.9a.07.07 0 0 1 .03-.07l4.83-2.78a4.5 4.5 0 0 1 6.69 4.66ZM8.3 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.05a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.7 5.45a.78.78 0 0 0-.39.68l-.01 6.73Zm1.1-2.36L12 8.99l2.6 1.51v3l-2.6 1.5-2.6-1.5v-3Z"/></svg>';
  var PLX_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2M4.4 8.2 12 12l7.6-3.8M4.4 15.8 12 12l7.6 3.8"/></svg>';
  var SPARK_SVG = '<svg viewBox="0 0 24 24" fill="url(#arbGrad)" aria-hidden="true"><defs><linearGradient id="arbGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E14BC0"/><stop offset="1" stop-color="#7B4FE0"/></linearGradient></defs><path d="M12 2.5l1.9 5.2a4 4 0 0 0 2.4 2.4l5.2 1.9-5.2 1.9a4 4 0 0 0-2.4 2.4L12 21.5l-1.9-5.2a4 4 0 0 0-2.4-2.4L2.5 12l5.2-1.9a4 4 0 0 0 2.4-2.4L12 2.5Z"/></svg>';

  /* ── Styles ───────────────────────────────────────────────────────────── */
  var css = ''
    + '#arb-ai-widget{position:fixed;bottom:20px;right:20px;z-index:9998;width:300px;max-width:calc(100vw - 28px);'
    +   'box-sizing:border-box;background:#fff;border:1px solid hsl(240 22% 90%);border-radius:14px;padding:11px 13px;'
    +   'font-family:\'Inter\',system-ui,-apple-system,sans-serif;'
    +   'box-shadow:0 10px 32px rgba(30,27,70,0.15),0 2px 8px rgba(0,0,0,0.06);'
    +   'animation:arb-ai-in .45s cubic-bezier(.16,1,.3,1) both;}'
    + '#arb-ai-widget *{box-sizing:border-box;}'
    + '.arb-x{position:absolute;top:7px;right:7px;width:20px;height:20px;border:none;background:transparent;'
    +   'color:hsl(240 6% 60%);font-size:16px;line-height:1;cursor:pointer;border-radius:6px;display:flex;'
    +   'align-items:center;justify-content:center;padding:0;transition:background .15s ease,color .15s ease;}'
    + '.arb-x:hover{background:hsl(240 10% 95%);color:hsl(240 10% 25%);}'
    + '#arb-ai-head{display:flex;align-items:center;gap:7px;margin:0 20px 3px 0;}'
    + '#arb-ai-spark{flex:none;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;'
    +   'background:hsl(280 60% 97%);border:1px solid hsl(280 50% 92%);}'
    + '#arb-ai-spark svg{width:12px;height:12px;display:block;}'
    + '.arb-ai-title{font-family:\'Space Grotesk\',\'Inter\',system-ui,sans-serif;font-weight:700;font-size:14px;'
    +   'line-height:1.2;color:hsl(240 26% 11%);letter-spacing:-0.01em;}'
    + '.arb-ai-sub{font-size:11px;line-height:1.3;color:hsl(240 6% 42%);margin:0 0 9px 0;white-space:nowrap;}'
    + '.arb-ai-btns{display:flex;gap:6px;}'
    + '.arb-ai-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;height:34px;'
    +   'border-radius:9px;font-family:\'Inter\',system-ui,sans-serif;font-size:12px;font-weight:600;text-decoration:none;'
    +   'color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.12);transition:transform .15s ease,filter .15s ease,box-shadow .18s ease;cursor:pointer;}'
    + '.arb-ai-btn:hover{transform:translateY(-1px);filter:brightness(1.09);box-shadow:0 4px 12px rgba(0,0,0,.16);}'
    + '.arb-ai-btn:active{transform:translateY(0);}'
    + '.arb-ai-btn svg{width:14px;height:14px;flex:none;}'
    + '.arb-ai-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1;}'
    + '.arb-gpt{background:#0D0D0D;}'
    + '.arb-plx{background:#20808D;}'
    + '#arb-ai-widget.arb-hidden{opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;}'
    + '@media (max-width:480px){'
    +   '#arb-ai-widget{left:12px;right:12px;bottom:12px;width:auto;max-width:none;}'
    +   '.arb-ai-sub{white-space:normal;}'
    + '}'
    + '@keyframes arb-ai-in{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}'
    + '@media (prefers-reduced-motion:reduce){#arb-ai-widget{animation:none;}.arb-ai-btn{transition:none;}}';

  var style = document.createElement('style');
  style.id = 'arb-ai-widget-style';
  style.textContent = css;
  document.head.appendChild(style);

  /* ── Markup ───────────────────────────────────────────────────────────── */
  function build() {
    var el = document.createElement('div');
    el.id = 'arb-ai-widget';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Ask AI about Arbitrica');
    el.innerHTML = ''
      + '<button class="arb-x" type="button" aria-label="Dismiss">×</button>'
      + '<div id="arb-ai-head">'
      +   '<span id="arb-ai-spark">' + SPARK_SVG + '</span>'
      +   '<div class="arb-ai-title">Want to ask AI about us?</div>'
      + '</div>'
      + '<div class="arb-ai-sub">Ask ChatGPT and Perplexity for an independent view</div>'
      + '<div class="arb-ai-btns">'
      +   '<a class="arb-ai-btn arb-gpt" href="' + LINKS.chatgpt + '" target="_blank" rel="noopener noreferrer">' + GPT_SVG + '<span>Ask ChatGPT</span></a>'
      +   '<a class="arb-ai-btn arb-plx" href="' + LINKS.perplexity + '" target="_blank" rel="noopener noreferrer">' + PLX_SVG + '<span>Ask Perplexity</span></a>'
      + '</div>';
    var x = el.querySelector('.arb-x');
    if (x) x.addEventListener('click', function () { el.classList.add('arb-hidden'); });
    return el;
  }

  /* ── Mount (fixed position, so it lives directly on <body>) ────────────── */
  function mount() {
    if (document.getElementById('arb-ai-widget')) return;
    if (document.body) document.body.appendChild(build());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
