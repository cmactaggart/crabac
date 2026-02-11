# Infrastructure — Coraza WAF (Caddy Reverse Proxy)

Architecture: `cloudflared → Caddy (Coraza WAF) :3030 → Express :3001`

## Prerequisites

- Go 1.21+ installed
- `xcaddy` for building Caddy with plugins

## Setup

### 1. Install xcaddy and build Caddy with Coraza

```bash
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
xcaddy build --with github.com/corazawaf/coraza-caddy/v2
```

This produces a `./caddy` binary in the current directory.

### 2. Run Caddy

```bash
./caddy run --config infra/Caddyfile
```

Caddy will listen on `:3030` and reverse-proxy to Express on `:3001`.

### 3. Configure cloudflared

Point your cloudflared tunnel to `http://localhost:3030` instead of `http://localhost:3001`.

## Testing WAF

Verify that OWASP CRS blocks common attacks:

```bash
# SQL injection attempt — should be blocked (403)
curl -v "http://localhost:3030/api/users?id=1%20OR%201=1"

# XSS attempt — should be blocked (403)
curl -v "http://localhost:3030/api/health" -H "X-Test: <script>alert(1)</script>"

# Normal request — should pass through (200)
curl -v "http://localhost:3030/api/health"
```

## Configuration

- `Caddyfile` — main Caddy config with Coraza WAF directives and reverse proxy
- `coraza.conf` — additional Coraza directives, anomaly scoring thresholds, and rule exclusions

## Rule Exclusions

The config includes exclusions for known false positives:
- **Health check**: `/api/health` bypasses WAF entirely
- **WebSocket**: Upgrade requests bypass WAF (Socket.io needs this)
- **Message content**: Chat message bodies skip XSS (941xxx) and SQLi (942xxx) rules on the `content` field, since user messages can legitimately contain code snippets
