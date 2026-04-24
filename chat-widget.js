/**
 * Arbitrica Customer Support Chat Widget
 * Sends notifications to team@arbitrica.com via the server /api/chat-notify endpoint.
 * No third-party email service required — just set SMTP_USER + SMTP_PASS on the server.
 */
(function () {
  'use strict';

  /* ── EMOJI LIST ─────────────────────────────────────────────────────────── */
  var EMOJIS = [
    '😊','😄','😂','😍','🤔','👍','👎','❤️','🎉','🙏',
    '😅','😭','😤','🤩','😎','🫡','💪','🔥','✅','❌',
    '💡','📧','💬','🔍','🌍','💰','⭐','🏨','✈️','🎯',
    '📎','🖼️','📄','📋','💼','🤝','🚀','⚡','🌟','😇',
  ];

  /* ── INJECT FONTS (idempotent) ──────────────────────────────────────────── */
  if (!document.getElementById('arb-widget-fonts')) {
    var fl = document.createElement('link');
    fl.id   = 'arb-widget-fonts';
    fl.rel  = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600&display=swap';
    document.head.appendChild(fl);
  }

  /* ── STYLES ─────────────────────────────────────────────────────────────── */
  var css = `
    /* ── Mobile: compact launcher + full-width bottom drawer ── */
    @media (max-width: 768px) {
      #arb-launcher {
        bottom:16px; right:16px; min-width:unset; max-width:unset;
        padding:7px 13px; font-size:11px; border-radius:20px;
        flex-direction:row; gap:4px;
      }
      #arb-launcher-top { display:none; }
      #arb-window {
        width:100vw !important; max-width:100vw !important;
        right:0 !important; bottom:0 !important;
        border-radius:20px 20px 0 0 !important;
        max-height:85vh !important;
      }
      #arb-emoji-panel { right:8px !important; width:260px !important; }
    }
    #arb-launcher {
      position:fixed; bottom:24px; right:24px; z-index:9998;
      display:flex; flex-direction:column; align-items:center; gap:3px;
      background:linear-gradient(to bottom,#433BE3,#241CC4);
      color:#EBF0FF; font-family:'Inter',system-ui,sans-serif;
      font-size:11px; font-weight:400; padding:10px 14px;
      border-radius:14px; cursor:pointer; border:none;
      box-shadow:0 3px 16px rgba(67,59,227,0.35),0 2px 6px rgba(0,0,0,0.12);
      transition:transform .2s ease,box-shadow .2s ease,opacity .25s ease;
      text-align:center; user-select:none; min-width:110px; max-width:140px;
      opacity:0.88;
    }
    #arb-launcher:hover { transform:translateY(-2px);
      box-shadow:0 8px 32px rgba(67,59,227,0.5),0 4px 12px rgba(0,0,0,0.2); }
    #arb-launcher.arb-hidden { opacity:0; pointer-events:none; transform:translateY(8px); }
    .arb-wave { font-size:16px; display:inline-block;
      animation:arb-wave-anim 2.5s ease-in-out infinite; transform-origin:70% 70%; }
    @keyframes arb-wave-anim {
      0%,60%,100%{transform:rotate(0)} 10%{transform:rotate(14deg)}
      20%{transform:rotate(-8deg)} 30%{transform:rotate(14deg)}
      40%{transform:rotate(-4deg)} 50%{transform:rotate(10deg)}
    }
    #arb-window {
      position:fixed; bottom:88px; right:24px; z-index:9999;
      width:380px; max-height:570px; display:flex; flex-direction:column;
      background:#fff; border-radius:20px;
      box-shadow:rgba(0,0,0,0.22) 0 24px 64px,0 4px 24px rgba(0,0,0,0.09);
      font-family:'Inter',system-ui,sans-serif; overflow:hidden;
      transition:opacity .25s ease,transform .25s cubic-bezier(.34,1.56,.64,1);
    }
    #arb-window.arb-hidden { opacity:0; pointer-events:none; transform:translateY(12px) scale(.97); }
    #arb-header {
      background:#111; padding:16px 20px;
      display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
    }
    #arb-header-left { display:flex; align-items:center; gap:10px; }
    #arb-avatar {
      width:36px; height:36px; border-radius:50%;
      background:linear-gradient(135deg,hsl(320 80% 55%),hsl(280 70% 50%));
      display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0;
    }
    #arb-title { font-family:'Space Grotesk',system-ui,sans-serif;
      font-size:15px; font-weight:600; color:#EBF0FF; line-height:1.2; }
    #arb-subtitle { font-size:11px; color:rgba(235,240,255,.55); margin-top:1px; }
    #arb-close {
      width:28px; height:28px; border-radius:50%; border:none;
      background:rgba(255,255,255,.1); color:#EBF0FF; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      font-size:14px; transition:background .15s; flex-shrink:0;
    }
    #arb-close:hover { background:rgba(255,255,255,.2); }
    #arb-body {
      flex:1; overflow-y:auto; padding:20px 16px;
      display:flex; flex-direction:column; gap:12px;
      min-height:180px; max-height:290px; scroll-behavior:smooth;
    }
    #arb-body::-webkit-scrollbar{width:4px}
    #arb-body::-webkit-scrollbar-track{background:transparent}
    #arb-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:2px}
    .arb-msg { display:flex; gap:8px; animation:arb-fadein .2s ease; }
    @keyframes arb-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .arb-msg.bot { align-items:flex-start; }
    .arb-msg.user { flex-direction:row-reverse; }
    .arb-msg-av {
      width:28px; height:28px; border-radius:50%; flex-shrink:0; margin-top:2px;
      background:linear-gradient(135deg,hsl(320 80% 55%),hsl(280 70% 50%));
      display:flex; align-items:center; justify-content:center; font-size:12px;
    }
    .arb-bubble {
      max-width:80%; padding:10px 14px; border-radius:16px;
      font-size:14px; line-height:1.5; word-break:break-word;
    }
    .arb-msg.bot  .arb-bubble { background:rgba(76,68,228,.08); color:#171717; border-bottom-left-radius:4px; }
    .arb-msg.user .arb-bubble { background:linear-gradient(135deg,#433BE3,#241CC4); color:#EBF0FF; border-bottom-right-radius:4px; }
    .arb-attach-tag { margin-top:5px; font-size:12px; opacity:.7; display:flex; align-items:center; gap:4px; }
    #arb-email-zone {
      padding:12px 16px; background:rgba(245,247,250,.9);
      border-top:1px solid rgba(0,0,0,.06); flex-shrink:0; display:none;
    }
    #arb-email-zone p { font-size:13px; color:#616161; margin:0 0 8px; line-height:1.45; }
    #arb-email-row { display:flex; gap:8px; }
    #arb-email-in {
      flex:1; font-family:'Inter',system-ui,sans-serif; font-size:14px;
      padding:10px 14px; border:1.5px solid #D4D4D4; border-radius:10px;
      background:#fff; color:#171717; outline:none; transition:border-color .15s;
    }
    #arb-email-in:focus { border-color:#433BE3; }
    #arb-email-go {
      padding:10px 16px; background:linear-gradient(to right,#433BE3,#241CC4);
      color:#EBF0FF; border:none; border-radius:10px;
      font-family:'Inter',system-ui,sans-serif; font-size:14px; font-weight:500;
      cursor:pointer; white-space:nowrap; transition:opacity .15s,transform .15s;
    }
    #arb-email-go:hover { opacity:.9; transform:translateY(-1px); }
    #arb-email-go:disabled { opacity:.5; cursor:default; transform:none; }
    #arb-success {
      padding:12px 16px; background:rgba(48,166,93,.08);
      border-top:1px solid rgba(48,166,93,.2);
      display:none; align-items:center; gap:8px;
      font-size:13px; color:#1a7a3e; flex-shrink:0;
    }
    #arb-success.arb-show { display:flex; }
    #arb-footer {
      padding:12px 14px; border-top:1px solid rgba(0,0,0,.06);
      display:flex; flex-direction:column; gap:8px; flex-shrink:0; background:#fff;
    }
    #arb-attach-bar {
      font-size:12px; color:#8C8C8C; display:none; align-items:center; gap:6px;
    }
    #arb-attach-bar.arb-show { display:flex; }
    #arb-attach-x { cursor:pointer; color:#c00; font-size:14px; border:none; background:none; padding:0; line-height:1; }
    #arb-msg-row { display:flex; align-items:flex-end; gap:6px; }
    #arb-ta {
      flex:1; font-family:'Inter',system-ui,sans-serif; font-size:14px;
      padding:10px 14px; border:1.5px solid #D4D4D4; border-radius:12px;
      background:#fff; color:#171717; outline:none; resize:none;
      min-height:42px; max-height:100px; line-height:1.5; transition:border-color .15s;
    }
    #arb-ta:focus { border-color:#433BE3; }
    #arb-ta::placeholder { color:#8C8C8C; }
    #arb-ta:disabled { background:rgba(0,0,0,.03); }
    .arb-ib {
      width:38px; height:38px; border-radius:10px; border:1.5px solid #D4D4D4;
      background:#fff; color:#616161; cursor:pointer; display:flex;
      align-items:center; justify-content:center; font-size:17px;
      transition:border-color .15s,background .15s; flex-shrink:0;
    }
    .arb-ib:hover { border-color:#433BE3; background:rgba(67,59,227,.05); color:#433BE3; }
    #arb-send {
      width:38px; height:38px; border-radius:10px; border:none;
      background:linear-gradient(135deg,#433BE3,#241CC4); color:#EBF0FF;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      font-size:17px; transition:opacity .15s,transform .15s; flex-shrink:0;
    }
    #arb-send:hover { opacity:.9; transform:translateY(-1px); }
    #arb-send:disabled { opacity:.35; cursor:default; transform:none; }
    #arb-statusbar { font-size:11px; color:#8C8C8C; text-align:center; min-height:14px; }
    #arb-emoji-panel {
      position:fixed; z-index:10001;
      width:280px; background:#fff; border:1.5px solid #D4D4D4;
      border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,.12);
      padding:10px; display:none;
    }
    #arb-emoji-panel.arb-show { display:block; }
    #arb-emoji-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:2px; }
    .arb-emo {
      font-size:20px; cursor:pointer; padding:4px; border-radius:6px;
      border:none; background:none; text-align:center;
      transition:background .1s; line-height:1.3;
    }
    .arb-emo:hover { background:rgba(67,59,227,.1); }
  `;

  var styleEl = document.createElement('style');
  styleEl.id = 'arb-widget-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── BUILD DOM ──────────────────────────────────────────────────────────── */
  // Launcher pill
  var launcher = document.createElement('button');
  launcher.id = 'arb-launcher';
  launcher.innerHTML = '<span id="arb-launcher-top" style="font-size:11px;font-weight:400;font-family:\'Inter\',system-ui,sans-serif;line-height:1.35;color:#EBF0FF;">Found what you\'re looking for?</span><span style="font-size:11px;font-weight:400;font-family:\'Inter\',system-ui,sans-serif;line-height:1.35;color:#c4b5fd;">Chat with us 👋</span>';

  // Emoji panel (floats above everything)
  var emojiPanel = document.createElement('div');
  emojiPanel.id = 'arb-emoji-panel';
  emojiPanel.innerHTML = '<div id="arb-emoji-grid">' +
    EMOJIS.map(function(e){return '<button class="arb-emo" data-e="'+e+'">'+e+'</button>';}).join('') + '</div>';

  // Chat window
  // NOTE: greeting — emoji 👋 is AFTER "Hi there," and BEFORE "Did you find..."
  var win = document.createElement('div');
  win.id = 'arb-window';
  win.className = 'arb-hidden';
  win.innerHTML =
    '<div id="arb-header">' +
      '<div id="arb-header-left">' +
        '<div id="arb-avatar">✦</div>' +
        '<div><div id="arb-title">Arbitrica Support</div>' +
        '<div id="arb-subtitle">We aim to reply as fast as possible</div></div>' +
      '</div>' +
      '<button id="arb-close" title="Close">✕</button>' +
    '</div>' +
    '<div id="arb-body">' +
      '<div class="arb-msg bot">' +
        '<div class="arb-msg-av">✦</div>' +
        '<div class="arb-bubble">Hi there, 👋<br><br>Did you find what you\'re looking for? Ask us anything — we\'d love to help.</div>' +
      '</div>' +
    '</div>' +
    '<div id="arb-success">✉️ <span id="arb-success-txt">We\'ll get back to you shortly!</span></div>' +
    '<div id="arb-email-zone">' +
      '<div id="arb-email-row">' +
        '<input id="arb-email-in" type="email" placeholder="you@example.com" autocomplete="email">' +
        '<button id="arb-email-go">Send ✓</button>' +
      '</div>' +
    '</div>' +
    '<div id="arb-footer">' +
      '<div id="arb-attach-bar"><span id="arb-attach-nm"></span>' +
        '<button id="arb-attach-x" title="Remove">✕</button></div>' +
      '<div id="arb-msg-row">' +
        '<button class="arb-ib" id="arb-emoji-btn" title="Emoji">😊</button>' +
        '<label class="arb-ib" style="cursor:pointer" title="Attach file">' +
          '📎<input type="file" id="arb-file" style="display:none" accept="image/*,.pdf,.doc,.docx,.txt,.csv">' +
        '</label>' +
        '<textarea id="arb-ta" rows="1" placeholder="Type your message…"></textarea>' +
        '<button id="arb-send" title="Send">➤</button>' +
      '</div>' +
      '<div id="arb-statusbar"></div>' +
    '</div>';

  document.body.appendChild(launcher);
  document.body.appendChild(emojiPanel);
  document.body.appendChild(win);

  /* ── STATE ──────────────────────────────────────────────────────────────── */
  var S = { open:false, question:'', file:null, step:'compose' };

  /* ── SHORTCUTS ──────────────────────────────────────────────────────────── */
  function g(id){ return document.getElementById(id); }

  /* ── HELPERS ────────────────────────────────────────────────────────────── */
  function addMsg(html, role, attachName) {
    var body = g('arb-body');
    var d = document.createElement('div');
    d.className = 'arb-msg ' + role;
    var bubble = '<div class="arb-bubble">' + html;
    if (attachName) bubble += '<div class="arb-attach-tag">📎 ' + attachName + '</div>';
    bubble += '</div>';
    d.innerHTML = (role==='bot') ? '<div class="arb-msg-av">✦</div>' + bubble : bubble;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  function setStatus(txt, isErr) {
    var el = g('arb-statusbar');
    el.textContent = txt;
    el.style.color = isErr ? '#c00' : '#8C8C8C';
  }

  function autoResize() {
    var ta = g('arb-ta');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1048576).toFixed(1) + ' MB';
  }

  /* ── SERVER-SIDE EMAIL SENDING ──────────────────────────────────────────── */
  // Email 1: question arrives (sent immediately when user submits message)
  function sendQuestion(question, attachName, cb) {
    fetch('/api/chat-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'question', question: question, attachName: attachName || '' })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d.ok) cb(null); else cb(new Error(d.error || 'Send failed')); })
    .catch(function(e){ cb(e); });
  }

  // Email 2: user provides their email (sent with original question as context)
  function sendEmailCapture(userEmail, question, cb) {
    fetch('/api/chat-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', question: question, userEmail: userEmail })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d.ok) cb(null); else cb(new Error(d.error || 'Send failed')); })
    .catch(function(e){ cb(e); });
  }

  /* ── OPEN / CLOSE ───────────────────────────────────────────────────────── */
  function openChat() {
    S.open = true;
    win.classList.remove('arb-hidden');
    launcher.classList.add('arb-hidden');
    g('arb-ta').focus();
  }
  function closeChat() {
    S.open = false;
    win.classList.add('arb-hidden');
    launcher.classList.remove('arb-hidden');
    emojiPanel.classList.remove('arb-show');
  }

  launcher.addEventListener('click', openChat);
  g('arb-close').addEventListener('click', closeChat);

  /* ── EMOJI PANEL ────────────────────────────────────────────────────────── */
  g('arb-emoji-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    var footerRect = g('arb-footer').getBoundingClientRect();
    emojiPanel.style.bottom = (window.innerHeight - footerRect.top + 8) + 'px';
    emojiPanel.style.right = '24px';
    emojiPanel.classList.toggle('arb-show');
  });
  document.addEventListener('click', function(e){
    if (!emojiPanel.contains(e.target) && e.target.id !== 'arb-emoji-btn') {
      emojiPanel.classList.remove('arb-show');
    }
  });
  emojiPanel.addEventListener('click', function(e){
    var btn = e.target.closest('.arb-emo');
    if (!btn) return;
    var ta = g('arb-ta'), pos = ta.selectionStart, em = btn.dataset.e;
    ta.value = ta.value.slice(0,pos) + em + ta.value.slice(pos);
    ta.selectionStart = ta.selectionEnd = pos + em.length;
    ta.focus();
    emojiPanel.classList.remove('arb-show');
    autoResize();
  });

  /* ── FILE ATTACH ────────────────────────────────────────────────────────── */
  g('arb-file').addEventListener('change', function(e){
    var f = e.target.files[0]; if (!f) return;
    S.file = f;
    g('arb-attach-nm').textContent = f.name + ' (' + fmtSize(f.size) + ')';
    g('arb-attach-bar').classList.add('arb-show');
  });
  g('arb-attach-x').addEventListener('click', function(){
    S.file = null; g('arb-file').value = '';
    g('arb-attach-bar').classList.remove('arb-show');
  });

  /* ── TEXTAREA AUTO-RESIZE ───────────────────────────────────────────────── */
  g('arb-ta').addEventListener('input', autoResize);
  g('arb-ta').addEventListener('keydown', function(e){
    if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); g('arb-send').click(); }
  });

  /* ── SEND MESSAGE ───────────────────────────────────────────────────────── */
  g('arb-send').addEventListener('click', function(){
    var ta = g('arb-ta');
    var txt = ta.value.trim();
    if (!txt && !S.file) return;

    var attachName = S.file ? S.file.name : null;
    S.question = txt || ('(attachment: ' + attachName + ')');

    // Show user message in chat
    var displayTxt = txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                         .replace(/\n/g,'<br>');
    addMsg(displayTxt || '📎', 'user', txt ? attachName : null);

    // Clear & lock input
    ta.value = ''; ta.style.height = 'auto';
    g('arb-send').disabled = true;
    ta.disabled = true;
    g('arb-emoji-btn').disabled = true;
    setStatus('Sending…');

    sendQuestion(S.question, attachName, function(err){
      if (err) {
        // Unlock on error
        g('arb-send').disabled = false; ta.disabled = false;
        g('arb-emoji-btn').disabled = false;
        setStatus('Could not send. Please try again.', true);
        return;
      }
      setStatus('');
      S.step = 'email-capture';
      S.file = null;
      g('arb-attach-bar').classList.remove('arb-show');
      g('arb-footer').style.display = 'none';

      // Bot reply asking for email
      addMsg('Please leave your email to send the answer to.', 'bot');
      g('arb-email-zone').style.display = 'block';
      setTimeout(function(){ g('arb-email-in').focus(); }, 80);
    });

    S.file = null;
  });

  /* ── EMAIL CAPTURE ──────────────────────────────────────────────────────── */
  function submitEmail() {
    var val = g('arb-email-in').value.trim();
    var re  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(val)) {
      g('arb-email-in').style.borderColor = '#d00';
      g('arb-email-in').focus(); return;
    }
    g('arb-email-in').style.borderColor = '';
    var btn = g('arb-email-go');
    btn.disabled = true; btn.textContent = 'Sending…';

    sendEmailCapture(val, S.question, function(err){
      g('arb-email-zone').style.display = 'none';
      if (!err) {
        addMsg('Perfect — we\'ll get back to you at <strong>' + val + '</strong> shortly ✉️', 'bot');
        g('arb-success-txt').textContent = 'We\'ll reply to ' + val + ' soon.';
        g('arb-success').classList.add('arb-show');
      } else {
        addMsg('Something went wrong. Please email us directly at <strong>team@arbitrica.com</strong>', 'bot');
      }
      S.step = 'done';
    });
  }

  g('arb-email-go').addEventListener('click', submitEmail);
  g('arb-email-in').addEventListener('keydown', function(e){
    if (e.key === 'Enter') submitEmail();
  });
  g('arb-email-in').addEventListener('input', function(){
    g('arb-email-in').style.borderColor = '';
  });

})(); // end IIFE
