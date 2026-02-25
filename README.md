# Extract API

A simple paid text extraction API using x402 payment protocol.

## Endpoints

### GET /health
Free. Returns server status.
```json
{"status":"ok","uptime":123.4}
```

### POST /extract
Paid endpoint. Extracts emails, URLs, phones, dates, money, hashtags, and mentions from text.

**Request:**
```json
{"text": "Contact john@example.com or visit https://example.com"}
```

**Without payment header — returns 402:**
```json
{
  "error": "payment_required",
  "protocol": "x402",
  "pricing": {"currency": "USDC", "network": "base", "amount": "0.05"},
  "payTo": "0x948A0c3c9C7De343dfB2b06C008DF091F0702f9b"
}
```

**With header `x402-paid: true` — returns results:**
```json
{
  "ok": true,
  "result": {
    "emails": ["john@example.com"],
    "urls": ["https://example.com"],
    "phones": [],
    "dates": [],
    "money": [],
    "hashtags": [],
    "mentions": [],
    "wordCount": 7
  }
}
```

## Rate Limiting
60 requests per minute per IP.

## Deploy
Designed for Railway. Set PORT environment variable if needed (defaults to 3000).
