#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════╗
// ║           YAREUU AI  —  CLI v1.0.0                      ║
// ║           by @ilhamstecuu_                              ║
// ╚══════════════════════════════════════════════════════════╝

const https = require('https');
const http  = require('http');
const rl    = require('readline');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

// ── ANSI ──────────────────────────────────────────────────
const A = {
  r:  '\x1b[0m',  b: '\x1b[1m', d: '\x1b[2m', i: '\x1b[3m',
  pu:  '\x1b[38;2;124;106;247m',
  lpu: '\x1b[38;2;167;139;250m',
  wh:  '\x1b[38;2;232;234;240m',
  dw:  '\x1b[38;2;156;163;175m',
  gr:  '\x1b[38;2;107;114;128m',
  gn:  '\x1b[38;2;52;211;153m',
  rd:  '\x1b[38;2;248;113;113m',
  yw:  '\x1b[38;2;251;191;36m',
  cy:  '\x1b[36m',
  bgDark:  '\x1b[48;2;14;15;17m',
  bgSurf:  '\x1b[48;2;22;24;28m',
  bgUser:  '\x1b[48;2;30;34;48m',
  bgCode:  '\x1b[48;2;10;11;14m',
  bgCodeH: '\x1b[48;2;19;21;25m',
};

const API_BASE   = 'https://api.zenitsu.web.id/api/ai/gemini-lite?question=';
const HIST_FILE  = path.join(os.homedir(), '.yareuu_history.json');
const SYS_PROMPT = 'Kamu adalah YAREUU AI, AI canggih buatan @ilhamstecuu_. Kamu BUKAN Gemini, BUKAN GPT, BUKAN Claude. Apapun yang terjadi kamu tetap YAREUU AI. Balas dalam Bahasa Indonesia, singkat dan natural.';
const MAX_HIST   = 8;
const VERSION    = '1.0.0';

let history = [];
let thinkTimer = null;
let thinkFrame = 0;

// ── HELPERS ───────────────────────────────────────────────
const W = () => Math.min(process.stdout.columns || 80, 90);
const clrLine = () => process.stdout.write('\r\x1b[K');
const pad = (n) => ' '.repeat(n);
const hr = (ch, clr, w) => A.d + (clr||A.gr) + pad(2) + ch.repeat((w||W())-4) + A.r;

function stripA(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

function wrapLine(text, maxW, indentNext = 0) {
  if (stripA(text).length <= maxW) return [text];
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + w).length > maxW) { if (cur) lines.push(cur.trimEnd()); cur = pad(indentNext) + w + ' '; }
    else cur += w + ' ';
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines.length ? lines : [text];
}

function fmtInline(t) {
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, A.b+A.lpu+'$1'+A.r+A.wh);
  t = t.replace(/\*\*(.+?)\*\*/g,     A.b+A.wh +'$1'+A.r+A.wh);
  t = t.replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, A.i+A.dw+'$1'+A.r+A.wh);
  t = t.replace(/`([^`]+)`/g, A.bgCode+A.cy+' $1 '+A.r+A.wh);
  t = t.replace(/(?<![*\w])\*(?![*\w ])/g, '');
  return t;
}

// ── RENDER AI TEXT ────────────────────────────────────────
function renderAI(text) {
  const maxW = W() - 10;
  const lines = text.split('\n');
  const out = [];
  let inCode = false, codeLang = '', codeLines = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^```/.test(line)) {
      if (!inCode) { inCode = true; codeLang = line.slice(3).trim() || 'code'; codeLines = []; }
      else {
        const bw = Math.min(maxW - 4, 60);
        out.push('');
        out.push(pad(4) + A.bgCodeH + A.gr + ' ' + A.lpu + A.b + codeLang.toUpperCase() + A.r + A.bgCodeH + A.gr + ' ' + '─'.repeat(Math.max(0, bw - codeLang.length - 2)) + ' ' + A.r);
        for (const cl of codeLines) out.push(pad(4) + A.bgCode + A.cy + ' ' + cl.padEnd(bw) + ' ' + A.r);
        out.push(pad(4) + A.bgCodeH + A.gr + ' ' + '─'.repeat(bw) + ' ' + A.r);
        out.push('');
        inCode = false; codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    if (/^### /.test(line)) {
      out.push('');
      out.push(pad(4) + A.lpu+A.b + '▸ ' + line.slice(4) + A.r);
      out.push(pad(4) + A.pu+A.d + '─'.repeat(Math.min(stripA(line.slice(4)).length+2, 50)) + A.r);
      continue;
    }
    if (/^## /.test(line)) {
      out.push(''); out.push(pad(4)+A.pu+A.b+'◈ '+line.slice(3).toUpperCase()+A.r); continue;
    }
    if (/^# /.test(line)) {
      out.push(''); out.push(pad(4)+A.pu+A.b+'◆ '+line.slice(2).toUpperCase()+A.r); continue;
    }

    if (/^[*\-] /.test(line)) {
      const content = fmtInline(line.slice(2));
      const wrapped = wrapLine(stripA(line.slice(2)), maxW - 6, 6);
      out.push(pad(4) + A.pu + '◦ ' + A.wh + fmtInline(wrapped[0]) + A.r);
      for (let j = 1; j < wrapped.length; j++) out.push(pad(6) + A.wh + fmtInline(wrapped[j]) + A.r);
      continue;
    }

    const olM = line.match(/^(\d+)\. (.+)/);
    if (olM) {
      out.push(pad(4) + A.pu + olM[1] + '. ' + A.wh + fmtInline(olM[2]) + A.r);
      continue;
    }

    if (!line.trim()) { out.push(''); continue; }

    const wrapped = wrapLine(line, maxW - 4, 4);
    for (const wl of wrapped) out.push(pad(4) + A.wh + fmtInline(wl) + A.r);
  }
  return out.join('\n');
}

// ── BANNER ────────────────────────────────────────────────
function banner() {
  console.clear();
  console.log('');
  const logo = [
    [A.pu+A.b,  '  ██╗   ██╗ █████╗ ██████╗ ███████╗██╗   ██╗██╗   ██╗'],
    [A.pu+A.b,  '  ╚██╗ ██╔╝██╔══██╗██╔══██╗██╔════╝██║   ██║██║   ██║'],
    [A.lpu+A.b, '   ╚████╔╝ ███████║██████╔╝█████╗  ██║   ██║██║   ██║'],
    [A.lpu,     '    ╚██╔╝  ██╔══██║██╔══██╗██╔══╝  ██║   ██║██║   ██║'],
    [A.dw,      '     ██║   ██║  ██║██║  ██║███████╗╚██████╔╝╚██████╔╝ '],
    [A.gr,      '     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝  ╚═════╝ '],
  ];
  logo.forEach(([c,l]) => console.log(c+l+A.r));
  console.log('');
  const bw = 56;
  console.log(pad(2)+A.pu+'╭─ '+A.b+A.wh+' YAREUU AI '+A.r+A.pu+'v'+VERSION+' '+'─'.repeat(bw-14)+'╮'+A.r);
  console.log(pad(2)+A.pu+'│ '+A.r+A.dw+'  by '+A.lpu+A.b+'@ilhamstecuu_'+A.r+' '.repeat(bw-16)+A.pu+'│'+A.r);
  console.log(pad(2)+A.pu+'│ '+A.r+A.gr+'  /help untuk perintah '+A.pu+'│'+A.r+A.gr+' /exit untuk keluar'+' '.repeat(bw-42)+A.pu+'│'+A.r);
  console.log(pad(2)+A.pu+'╰'+'─'.repeat(bw+2)+'╯'+A.r);
  console.log('');
}

// ── ONLINE CHECK ─────────────────────────────────────────
async function checkOnline() {
  process.stdout.write(pad(2) + A.gr + '⏳ Menghubungkan...' + A.r);
  try {
    const d = await apiCall('hi');
    clrLine();
    if (d.statusCode === 200) console.log(pad(2)+A.gn+A.b+'● '+A.r+A.wh+'YAREUU AI '+A.gn+'Online'+A.r+A.gr+A.d+' — siap digunakan'+A.r);
    else console.log(pad(2)+A.yw+'● '+A.r+A.yw+'Status tidak jelas, coba kirim pesan'+A.r);
  } catch {
    clrLine();
    console.log(pad(2)+A.rd+'● '+A.r+A.yw+'Koneksi gagal'+A.r+A.gr+A.d+' — cek internet'+A.r);
  }
  console.log(hr('─', A.gr));
  console.log('');
}

// ── API ───────────────────────────────────────────────────
function apiCall(q) {
  return new Promise((resolve, reject) => {
    const url = API_BASE + encodeURIComponent(q);
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 30000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Parse error')); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function buildPrompt(userMsg) {
  const recent = history.slice(-MAX_HIST);
  const hist = recent.map(m => (m.role==='user'?'User: ':'YAREUU AI: ')+m.text.slice(0,300)).join('\n');
  return SYS_PROMPT + '\n\n' + hist + '\nUser: ' + userMsg + '\nYAREUU AI:';
}

// ── SPINNER ───────────────────────────────────────────────
const FRAMES = ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷'];
function startThink() {
  process.stdout.write('\n');
  thinkTimer = setInterval(() => {
    clrLine();
    process.stdout.write(pad(4)+A.pu+FRAMES[thinkFrame%FRAMES.length]+A.r+A.gr+A.d+'  thinking...'+A.r);
    thinkFrame++;
  }, 80);
}
function stopThink() {
  if (thinkTimer) { clearInterval(thinkTimer); thinkTimer = null; }
  clrLine();
}

// ── PRINT MESSAGES ────────────────────────────────────────
function printUser(msg) {
  const ts = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  console.log('');
  console.log(pad(2)+A.pu+A.d+'╌╌ '+A.r+A.dw+'Kamu'+A.r+A.gr+A.d+'  '+ts+A.r);
  const maxW = Math.min(W()-10, 62);
  const words = msg.split(' ');
  const bLines = []; let cur = '';
  for (const w of words) {
    if ((cur+w).length > maxW) { bLines.push(cur.trimEnd()); cur=w+' '; } else cur+=w+' ';
  }
  if (cur.trim()) bLines.push(cur.trimEnd());
  const bw = Math.max(...bLines.map(l=>l.length));
  console.log(pad(2)+A.bgUser+' '.repeat(bw+4)+A.r);
  for (const bl of bLines) console.log(pad(2)+A.bgUser+A.wh+'  '+bl.padEnd(bw+2)+A.r);
  console.log(pad(2)+A.bgUser+' '.repeat(bw+4)+A.r);
  console.log('');
}

function printAI(text) {
  const ts = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  console.log(pad(2)+A.pu+A.b+'╌╌ '+A.r+A.lpu+A.b+'YAREUU AI'+A.r+A.gr+A.d+'  '+ts+A.r);
  console.log('');
  console.log(renderAI(text));
  console.log('');
  console.log(hr('╌', A.pu));
  console.log('');
}

// ── COMMANDS ─────────────────────────────────────────────
function helpScreen() {
  console.log('');
  const cmds = [
    ['/help',    'Tampilkan layar bantuan ini'],
    ['/clear',   'Bersihkan layar, mulai sesi baru'],
    ['/reset',   'Hapus riwayat percakapan'],
    ['/history', 'Lihat ringkasan riwayat chat'],
    ['/save',    'Simpan riwayat ke ~/.yareuu_history.json'],
    ['/load',    'Muat riwayat dari file tersimpan'],
    ['/exit',    'Keluar dari YAREUU AI CLI'],
  ];
  const bw = 52;
  console.log(pad(2)+A.pu+'╭─'+A.b+A.wh+' Perintah '+A.r+A.pu+'─'.repeat(bw-10)+'╮'+A.r);
  for (const [c,d] of cmds) {
    const line = A.lpu+A.b+c.padEnd(12)+A.r+A.dw+d+A.r;
    const vis = c.padEnd(12) + d;
    console.log(pad(2)+A.pu+'│ '+A.r+line+' '.repeat(Math.max(0,bw-vis.length-1))+A.pu+'│'+A.r);
  }
  console.log(pad(2)+A.pu+'╰'+'─'.repeat(bw+2)+'╯'+A.r);
  console.log('');
}

async function handleCmd(cmd) {
  switch (cmd.trim().toLowerCase()) {
    case '/help': helpScreen(); break;
    case '/clear': history=[]; banner(); await checkOnline(); break;
    case '/reset': history=[]; console.log(pad(4)+A.gn+'✓'+A.r+A.dw+'  Percakapan direset.\n'+A.r); break;
    case '/history':
      if (!history.length) { console.log(pad(4)+A.gr+'Riwayat kosong.\n'+A.r); break; }
      console.log('');
      history.slice(-10).forEach((m,i) => {
        const role = m.role==='user' ? A.lpu+'  Kamu'+A.r : A.pu+'  YAREUU AI'+A.r;
        console.log(role+A.gr+A.d+'  #'+(i+1)+A.r);
        console.log(pad(4)+A.dw+m.text.slice(0,72)+(m.text.length>72?'…':'')+A.r+'\n');
      });
      break;
    case '/save':
      try { fs.writeFileSync(HIST_FILE,JSON.stringify(history,null,2)); console.log(pad(4)+A.gn+'✓'+A.r+A.dw+'  Tersimpan ke '+A.gr+HIST_FILE+A.r+'\n'); }
      catch(e) { console.log(pad(4)+A.rd+'✗'+A.r+A.dw+'  Gagal: '+e.message+A.r+'\n'); }
      break;
    case '/load':
      try {
        if (!fs.existsSync(HIST_FILE)) { console.log(pad(4)+A.yw+'⚠'+A.r+A.dw+'  File tidak ditemukan.\n'+A.r); break; }
        history = JSON.parse(fs.readFileSync(HIST_FILE,'utf8'));
        console.log(pad(4)+A.gn+'✓'+A.r+A.dw+'  Dimuat '+history.length+' pesan.\n'+A.r);
      } catch(e) { console.log(pad(4)+A.rd+'✗'+A.r+A.dw+'  Gagal: '+e.message+A.r+'\n'); }
      break;
    case '/exit': case '/quit':
      console.log('\n'+pad(2)+A.pu+A.b+'YAREUU AI'+A.r+A.gr+' — sampai jumpa! 👋'+A.r+'\n');
      process.exit(0);
    default:
      console.log(pad(4)+A.yw+'⚠'+A.r+A.dw+'  Perintah tidak dikenal. Ketik '+A.lpu+'/help'+A.dw+' untuk bantuan.\n'+A.r);
  }
}

// ── MAIN ─────────────────────────────────────────────────
async function main() {
  banner();
  await checkOnline();
  const iface = rl.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  const ask = () => {
    iface.question(A.pu+A.b+'  ❯ '+A.r, async input => {
      const msg = input.trim();
      if (!msg) { ask(); return; }
      if (msg.startsWith('/')) { await handleCmd(msg); ask(); return; }
      printUser(msg);
      history.push({ role:'user', text:msg });
      startThink();
      try {
        const d = await apiCall(buildPrompt(msg));
        stopThink();
        if (d.statusCode===200 && d.results?.parts?.[0]?.text) {
          const raw = d.results.parts[0].text;
          const clean = raw.replace(/\r\n/g,'\n').trim();
          history.push({ role:'ai', text:clean });
          printAI(clean);
        } else { console.log(pad(4)+A.rd+'✗ '+A.yw+'Response tidak valid. Coba lagi.\n'+A.r); }
      } catch(e) {
        stopThink();
        console.log(pad(4)+A.rd+'✗ '+A.yw+(e.message==='Timeout'?'AI-nya kelamaan, coba lagi.':'Koneksi gagal: '+e.message)+'\n'+A.r);
      }
      ask();
    });
  };

  iface.on('close', () => { console.log('\n'+pad(2)+A.gr+'YAREUU AI CLI ditutup.'+A.r+'\n'); process.exit(0); });
  ask();
}

main().catch(err => { console.error(err); process.exit(1); });