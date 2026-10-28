// ── Colour test (the user, 28-10-2026) ──
// Four colour versions take turns on every page of the site, three days each, switching at midnight UK time:
//   test5 (deep darks) → test (navy and beige) → test2 (violet) → test7 (earthy), then the normal colours come back.
// The homepage gets the exact colours of the matching /testN.html page; every other page (and the chat widget)
// gets the same colours mapped onto its own styles. Nothing on disk changes: the colours are swapped as pages are sent.
// Preview any version with ?colour=test5 (or ?colour=off for the normal colours).
const DATA = require('./colour-test-data.json');

const SCHEDULE = [
  { key: 'test5', from: '2026-10-29T00:00:00Z', to: '2026-11-01T00:00:00Z' },
  { key: 'test',  from: '2026-11-01T00:00:00Z', to: '2026-11-04T00:00:00Z' },
  { key: 'test2', from: '2026-11-04T00:00:00Z', to: '2026-11-07T00:00:00Z' },
  { key: 'test7', from: '2026-11-07T00:00:00Z', to: '2026-11-10T00:00:00Z' },
];

function scheduledTheme(now = Date.now()) {
  for (const s of SCHEDULE) if (now >= Date.parse(s.from) && now < Date.parse(s.to)) return s.key;
  return '';
}

function themeFor(req) {
  const q = req && req.query && req.query.colour;
  if (typeof q === 'string') {
    if (q === 'off') return '';
    if (DATA.themes[q]) return q;
  }
  return scheduledTheme();
}

// ── colour parsing ──
const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|(?:hsla?|rgba?)\([^()]*\)/g;

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function parseColour(str) {
  const s = str.trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (![3, 4, 6, 8].includes(h.length)) return null;
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    const a = h.length === 8 ? n(6) / 255 : 1;
    const [H, S, L] = rgbToHsl(n(0), n(2), n(4));
    return { h: H, s: S, l: L, a, aText: h.length === 8 ? String(+a.toFixed(3)) : null };
  }
  const m = s.match(/^(hsla?|rgba?)\(([^()]*)\)$/i);
  if (!m) return null;
  if (/var|calc|from/i.test(m[2])) return null;
  const parts = m[2].replace(/\//g, ' / ').split(/[\s,]+/).filter(Boolean);
  let alpha = null;
  const slash = parts.indexOf('/');
  let nums = parts;
  if (slash >= 0) { alpha = parts[slash + 1]; nums = parts.slice(0, slash); }
  else if (parts.length === 4) { alpha = parts[3]; nums = parts.slice(0, 3); }
  if (nums.length !== 3) return null;
  const a = alpha == null ? 1 : (alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha));
  if (m[1].toLowerCase().startsWith('hsl')) {
    const H = parseFloat(nums[0]), S = parseFloat(nums[1]), L = parseFloat(nums[2]);
    if ([H, S, L].some(Number.isNaN)) return null;
    return { h: ((H % 360) + 360) % 360, s: S, l: L, a, aText: alpha };
  }
  const v = nums.map((x) => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)));
  if (v.some(Number.isNaN)) return null;
  const [H, S, L] = rgbToHsl(v[0], v[1], v[2]);
  return { h: H, s: S, l: L, a, aText: alpha };
}

const r0 = (x) => Math.round(x);
function fmt(h, s, l, aText) {
  const base = `${r0(h)} ${r0(Math.max(0, Math.min(100, s)))}% ${r0(Math.max(0, Math.min(100, l)))}%`;
  return aText != null ? `hsl(${base} / ${aText})` : `hsl(${base})`;
}
const lerp = (a, b, t) => a + (b - a) * t;
function interp(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  }
  return pts[pts.length - 1][1];
}

// role of a colour from the CSS property (or attribute) it sits in
function roleOf(prop) {
  const p = (prop || '').toLowerCase().trim();
  if (p.startsWith('--')) {
    if (/border|line|ring|divider/.test(p)) return 'border';
    if (/fg|text|muted|ink|foreground/.test(p)) return 'fg';
    if (/shadow|glow/.test(p)) return 'shadow';
    return 'bg';
  }
  if (/shadow/.test(p)) return 'shadow';
  if (/^(color|fill|stroke|stop-color|caret-color|-webkit-text-fill-color|text-decoration-color|accent-color|column-rule-color)$/.test(p)) return 'fg';
  if (/^(border|outline)/.test(p)) return 'border';
  if (/background|^bg/.test(p)) return 'bg';
  return 'fg';
}

// brand hues of the normal site: indigo (225–265), purple (266–290), magenta (291–335)
function family(c) {
  if (c.s < 14) return 'neutral';
  if (c.h >= 200 && c.h < 225 && c.l >= 88) return 'neutral';
  if (c.h >= 225 && c.h < 266) return 'indigo';
  if (c.h >= 266 && c.h < 291) return 'purple';
  if (c.h >= 291 && c.h <= 335) return 'magenta';
  return 'other';
}

function mapLight(c, T) {
  const f = family(c);
  if (f === 'neutral') {
    if (c.l >= 99.5 || c.l <= 0.5) return null; // pure white / black stay
    const n = c.l <= 20 ? T.fg : c.l <= 60 ? T.muted : T.border;
    return fmt(n[0], Math.min(n[1], c.s + n[1] * 0.6), c.l, c.aText);
  }
  if (f === 'other') return null; // green, red, amber… keep their meaning
  const hue = f === 'magenta' ? T.alt[0] : T.primary[0];
  const sat = f === 'magenta' ? T.alt[1] : T.primary[1];
  if (c.l >= 85) return fmt(hue, Math.min(c.s, T.tintS), c.l, c.aText);
  if (f === 'indigo') return fmt(hue, sat, Math.max(14, c.l - 26), c.aText);
  return fmt(hue, sat, c.l, c.aText);
}

function mapDark(c, T, role, ctx) {
  const f = family(c);
  const alpha = c.a;
  if (role === 'shadow') {
    if (c.l <= 12 || c.l >= 95) return null;
    return fmt(T.primary[0], T.primary[1], 60, c.aText);
  }
  if (f === 'neutral' || f === 'other') {
    const S = f === 'other' ? c.s * 0.5 : 0;
    const H = f === 'other' ? c.h : null;
    const nh = (n) => (H == null ? n[0] : H);
    const ns = (n) => (H == null ? n[1] : S);
    if (role === 'bg') {
      if (alpha < 1 && c.l <= 12) return null; // dark veils / overlays stay
      if (f === 'other' && c.l < 85) return null; // other brands' buttons (ChatGPT, Perplexity), green / red badges stay
      if (c.l >= 99.5) return fmt(nh(T.card), ns(T.card), T.card[2], c.aText);
      if (c.l >= 96) return fmt(nh(T.bg), ns(T.bg), T.bg[2], c.aText);
      if (c.l >= 70) return fmt(nh(T.card), ns(T.card), interp(c.l, [[70, 26], [96, 12]]), c.aText);
      return fmt(nh(T.bg), ns(T.bg), Math.max(4, c.l * 0.55), c.aText);
    }
    if (role === 'border') {
      if (c.l >= 60) return fmt(nh(T.border), ns(T.border), interp(c.l, [[60, 34], [95, 20]]), c.aText);
      return fmt(nh(T.border), ns(T.border), 40, c.aText);
    }
    // text / icons
    if (ctx && ctx.onBrand && c.l >= 85) return fmt(T.ink[0], T.ink[1], T.ink[2], c.aText);
    if (c.l >= 75) return f === 'other' ? null : fmt(T.fg[0], T.fg[1], Math.max(c.l, 88), c.aText);
    if (c.l <= 15) return fmt(nh(T.fg), ns(T.fg), T.fg[2], c.aText);
    return fmt(nh(T.muted), ns(T.muted), interp(c.l, [[15, 88], [38, 68], [75, 50]]), c.aText);
  }
  // brand colours
  const isAlt = f === 'magenta';
  const A = isAlt ? T.alt : T.primary;
  if (role === 'bg') {
    if (c.l >= 85) return fmt(T.card[0], T.card[1] + 6, interp(c.l, [[85, 18], [98, 11]]), c.aText);
    if (alpha < 1) return fmt(A[0], A[1], A[2], c.aText);
    return fmt(A[0], A[1], interp(c.l, [[20, 50], [45, 66], [60, 74]]), c.aText);
  }
  if (role === 'border') {
    if (c.l >= 80) return fmt(T.border[0], T.border[1] + 8, interp(c.l, [[80, 32], [97, 20]]), c.aText);
    return fmt(A[0], A[1] * 0.8, 48, c.aText);
  }
  if (c.l >= 85) return fmt(T.fg[0], T.fg[1], 90, c.aText);
  return fmt(A[0], A[1], interp(c.l, [[20, 82], [50, 74], [70, 80]]), c.aText);
}

function mapColour(str, key, role, ctx) {
  const T = DATA.themes[key];
  const exact = T.map[str];
  if (exact && !T.dark) return exact;
  const c = parseColour(str);
  if (!c) return str;
  const out = T.dark ? mapDark(c, T.p, role, ctx) : mapLight(c, T.p);
  return out == null ? str : out;
}

// recolour a CSS text (stylesheet body or style="" attribute)
function recolourCss(css, key) {
  // rule by rule, so a white label on a brand button can be told apart from white text elsewhere
  return css.replace(/([^{}]*)\{([^{}]*)\}|([^{}]+)$/g, (all, sel, body, tail) => {
    if (body == null) return recolourDecls(all, key, {});
    const onBrand = /background[^;]*?(?:hsla?|rgba?)\(|background[^;]*#/i.test(body) && brandBg(body);
    return sel + '{' + recolourDecls(body, key, { onBrand }) + '}';
  });
}
function brandBg(body) {
  const m = body.match(/background(?:-color|-image)?\s*:([^;]*)/i);
  if (!m) return false;
  const cols = m[1].match(COLOUR_RE) || [];
  return cols.some((x) => { const c = parseColour(x); return c && c.a > 0.6 && c.l < 75 && ['indigo', 'purple', 'magenta'].includes(family(c)); });
}
function recolourDecls(body, key, ctx) {
  return body.replace(/(^|[;{\s])([-a-zA-Z]+)(\s*:\s*)([^;]*)/g, (all, pre, prop, colon, val) => {
    if (!COLOUR_RE.test(val)) { COLOUR_RE.lastIndex = 0; return all; }
    COLOUR_RE.lastIndex = 0;
    const role = roleOf(prop);
    return pre + prop + colon + val.replace(COLOUR_RE, (c) => mapColour(c, key, role, ctx));
  });
}

// recolour a whole HTML page (style blocks, style attributes, SVG colour attributes)
function recolourHtml(html, key) {
  let out = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (a, o, css, c) => o + recolourCss(css, key) + c);
  out = out.replace(/(\sstyle\s*=\s*)(["'])([^"']*)\2/gi, (a, pre, q, css) => pre + q + recolourDecls(css, key, {}) + q);
  out = out.replace(/<([a-zA-Z][\w-]*)(\s[^<>]*?(?:fill|stroke|stop-color|color)\s*=[^<>]*)>/g, (tag, name, attrs) => {
    const el = name.toLowerCase();
    const a2 = attrs.replace(/(\s(fill|stroke|stop-color|color)\s*=\s*)(["'])([^"']+)\3/gi, (a, pre, attr, q, val) =>
      pre + q + val.replace(COLOUR_RE, (c) => {
        let role = 'fg';
        const k = attr.toLowerCase();
        if (k === 'fill' && (el === 'rect' || el === 'svg')) role = 'bg';
        else if (k === 'stroke') { const p = parseColour(c); if (p && p.l >= 80) role = 'border'; }
        return mapColour(c, key, role, {});
      }) + q);
    return '<' + name + a2 + '>';
  });
  return out;
}

const SKIP_START = '\u0001', SKIP_END = '\u0002';

const CACHE = new Map();
function themeHtml(html, relPath, key) {
  const T = DATA.themes[key];
  if (!T) return html;
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const ck = key + '|' + rel;
  const hit = CACHE.get(ck);
  if (hit && hit.src === html) return hit.out;
  const res = themeHtmlUncached(html, rel, T, key);
  if (CACHE.size > 600) CACHE.clear();
  CACHE.set(ck, { src: html, out: res });
  return res;
}

function themeHtmlUncached(html, rel, T, key) {
  if (/^test\d*\.html$/.test(rel)) return html; // the test pages keep their own colours
  const homeLike = rel === 'index.html' || rel === 'amazon.html' || rel === 'events.html';
  let out = html;
  let missed = 0;
  if (homeLike) {
    // exact homepage edits of the test page, kept out of the general recolouring below
    for (const [oldText, newText] of T.pairs) {
      const i = out.indexOf(oldText);
      if (i < 0 || !oldText) { missed++; continue; }
      out = out.slice(0, i) + SKIP_START + newText + SKIP_END + out.slice(i + oldText.length);
    }
  }
  if (!(rel === 'index.html' && missed === 0)) {
    out = out.split(SKIP_START).map((part, idx) => {
      if (idx === 0) return recolourHtml(part, key);
      const j = part.indexOf(SKIP_END);
      return part.slice(0, j + 1) + recolourHtml(part.slice(j + 1), key);
    }).join(SKIP_START);
  }
  out = out.split(SKIP_START).join('').split(SKIP_END).join('');
  out = out.replace(/(<meta name="theme-color" content=")[^"]*(")/i, `$1${T.themeColor}$2`);
  const extra = (homeLike ? T.homeCss : T.pageCss) || '';
  if (extra && /<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `<style id="colour-test">${extra}</style></head>`);
  return out;
}

function themeJs(js, key) {
  const T = DATA.themes[key];
  if (!T) return js;
  // the chat widget: colours sit in CSS strings inside the script
  return js.replace(/([-a-zA-Z]+)(\s*:\s*)([^;'"`{}]*)/g, (all, prop, colon, val) => {
    if (!COLOUR_RE.test(val)) { COLOUR_RE.lastIndex = 0; return all; }
    COLOUR_RE.lastIndex = 0;
    return prop + colon + val.replace(COLOUR_RE, (c) => mapColour(c, key, roleOf(prop), {}));
  });
}

module.exports = { themeFor, scheduledTheme, themeHtml, themeJs, SCHEDULE };
