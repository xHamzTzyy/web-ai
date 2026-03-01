const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const CHAT_FILE = path.join(__dirname, 'chat-user.json');
const HTML_FILE = path.join(__dirname, 'index.html');

// Buat file JSON kalau belum ada
if (!fs.existsSync(CHAT_FILE)) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify({}, null, 2), 'utf8');
}

function readChatData() {
  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeChatData(data) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}`;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Serve index.html ──
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(404);
      res.end('index.html tidak ditemukan');
    }
    return;
  }

  // ── POST /api/save-chat ──
  // Body: { user: "nama", chat: "isi pesan", role: "user"|"ai" }
  if (pathname === '/api/save-chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { user, chat, role } = JSON.parse(body);
        if (!user || !chat) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'user dan chat wajib diisi' }));
          return;
        }

        const allData = readChatData();

        // Inisialisasi array kalau user baru
        if (!allData[user]) allData[user] = [];

        // Tambah entry baru
        allData[user].push({
          chat: chat,
          date: getDate(),
          role: role || 'user'
        });

        writeChatData(allData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, user, total: allData[user].length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── GET /api/get-chat?user=nama ──
  // Return hanya chat milik user tersebut
  if (pathname === '/api/get-chat' && req.method === 'GET') {
    const user = parsed.query.user;
    if (!user) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'parameter user wajib ada' }));
      return;
    }

    const allData = readChatData();
    const userChats = allData[user] || [];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ [user]: userChats }));
    return;
  }

  // ── GET /api/chat-file ── (download raw JSON untuk user tertentu)
  if (pathname === '/api/chat-file' && req.method === 'GET') {
    const user = parsed.query.user;
    const allData = readChatData();

    // Kalau ada query user, filter hanya user itu
    const output = user
      ? { [user]: (allData[user] || []).map(m => ({ chat: m.chat, date: m.date })) }
      : {};

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="chat-user.json"'
    });
    res.end(JSON.stringify(output, null, 2));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n✅ YAREUU AI Server jalan di http://localhost:${PORT}`);
  console.log(`📁 Chat tersimpan otomatis ke: chat-user.json`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  POST /api/save-chat     → simpan 1 pesan`);
  console.log(`  GET  /api/get-chat?user=nama → ambil chat user`);
  console.log(`  GET  /api/chat-file?user=nama → download JSON\n`);
});