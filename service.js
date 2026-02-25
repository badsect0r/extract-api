const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json({ limit: '256kb' }));
const PORT = process.env.PORT || 3000;
const ACCESS_LOG = path.join(__dirname, 'access.log');

function logLine(line) {
  try {
    fs.appendFileSync(ACCESS_LOG, line + '\n');
  } catch (e) {}
}

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    logLine(`${new Date().toISOString()}\t${ip}\t${req.method}\t${req.originalUrl}\t${res.statusCode}\t${ms}ms`);
  });
  next();
});

// Rate limiting: 60 req/min per IP
const rl = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQ = 60;
app.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const entry = rl.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  rl.set(ip, entry);
  if (entry.count > MAX_REQ) {
    res.set('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited', detail: 'Max 60 requests per minute per IP' });
  }
  next();
});

// Payment gate stub - accepts x402-paid: true header
function requirePayment(req, res, next) {
  const paid = (req.headers['x402-paid'] || '').toString().toLowerCase() === 'true';
  if (paid) return next();
  res.status(402)
    .set('Content-Type', 'application/json')
    .set('X-Payment-Required', 'x402')
    .json({
      error: 'payment_required',
      protocol: 'x402',
      pricing: { currency: 'USDC', network: 'base', amount: '0.05' },
      payTo: '0x948A0c3c9C7De343dfB2b06C008DF091F0702f9b',
      instructions: 'Send 0.05 USDC on Base to payTo. Then retry with header x402-paid: true.'
    });
}

// Extraction logic
function extract(text) {
  const out = {
    emails: [],
    urls: [],
    phones: [],
    dates: [],
    money: [],
    hashtags: [],
    mentions: [],
    wordCount: 0,
  };
  if (!text || typeof text !== 'string') return out;
  out.wordCount = (text.trim().match(/\S+/g) || []).length;
  out.emails   = Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])).slice(0, 50);
  out.urls     = Array.from(new Set(text.match(/\bhttps?:\/\/[^\s)\]]+/gi) || [])).slice(0, 50);
  out.phones   = Array.from(new Set(text.match(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g) || [])).slice(0, 50);
  out.dates    = Array.from(new Set(text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g) || [])).slice(0, 50);
  out.money    = Array.from(new Set(text.match(/\b\$\s?\d+(?:,\d{3})*(?:\.\d{2})?\b/g) || [])).slice(0, 50);
  out.hashtags = Array.from(new Set(text.match(/#[A-Za-z0-9_]+/g) || [])).slice(0, 50);
  out.mentions = Array.from(new Set(text.match(/@[A-Za-z0-9_]+/g) || [])).slice(0, 50);
  return out;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/extract', requirePayment, (req, res) => {
  const text = req.body && req.body.text;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'bad_request', detail: 'Expected JSON body {"text":"..."}' });
  }
  res.json({ ok: true, result: extract(text) });
});

app.listen(PORT, () => {
  logLine(`${new Date().toISOString()}\tSERVER_START\tport=${PORT}`);
  console.log(`Service listening on port ${PORT}`);
});
