# Uptime Bot

A Discord bot that pulls monitor statuses from [Uptime Kuma](https://github.com/louislam/uptime-kuma)'s Prometheus metrics endpoint and posts live-updating embeds to a channel.

Inspired by and code heavily borrowed from [UptimeKuma-DiscordBot](https://github.com/Lauwy222/UptimeKuma-DiscordBot?tab=readme-ov-file).

## Prerequisites

- An Uptime Kuma instance with an API key (Settings > API Keys). The `username` and `apiKey` fields map to the API token name and key. These also work as standard username/password for basic auth (e.g. if Uptime Kuma is behind an [authentik](https://goauthentik.io/) basic auth proxy).
- A Discord bot — see the [Discord developer docs](https://discord.com/developers/docs/getting-started) to create one

### Required Gateway Intents

Enable these in the [Developer Portal](https://discord.com/developers/applications) under Bot > Privileged Gateway Intents:

- **Server Members Intent** is _not_ required
- **Message Content Intent** is _not_ required

The bot uses the non-privileged `Guilds` and `GuildMessages` intents (enabled by default).

### Required Bot Permissions

| Permission | Reason |
|---|---|
| View Channels | Fetch the target channel |
| Send Messages | Post monitor embeds |
| Embed Links | Rich embed formatting |
| Read Message History | Fetch existing messages to edit them |
| Manage Messages | Bulk-delete bot messages on startup (only needed if `clearMessages: true`) |

## Configuration

Copy the example config and fill in your values:

```bash
cp config.example.yaml config.yaml
```

### `config.yaml`

```yaml
discord:
  token: ""           # or set DISCORD_TOKEN env var
  guildId: ""
  channelId: ""
  clientId: ""

uptimeKuma:
  url: ""
  username: ""         # API token name, or username for basic auth
  apiKey: ""           # API token key, or password for basic auth (or set UPTIME_KUMA_API_KEY env var)

updateInterval: 60     # seconds
clearMessages: true    # clear bot's previous messages on startup

monitors:
  caseSensitive: true
  sections:
    - title: Gaming
      filters:
        - Lobby
        - Skyblock
        - Survival
    - title: Web
      filters:
        - regex: "^web\\d+$"
        - cdn
```

### Monitor Sections

Each section becomes a Discord embed. The `filters` array matches against monitor names from Uptime Kuma. If no monitors match a section's filters, that section is skipped entirely.

Filters can be **plain strings** (exact match) or **regex objects**:

```yaml
filters:
  - Lobby                    # exact match
  - regex: "^web\\d+$"      # regex match
```

Set `caseSensitive: false` at the monitors level to make all matching (both exact and regex) case-insensitive.

### Custom Emojis

Status emojis can be customized globally and/or per filter. Per-filter emojis take precedence over global ones.

**Global** — set at the top level of `config.yaml`:

```yaml
emojis:
  online: "✅"
  offline: "❌"
  warning: "⚠️"
  maintenance: "🔧"
  unknown: "❓"
```

**Per filter** — use the object form and add an `emojis` key:

```yaml
filters:
  - Lobby                        # plain string, uses global emojis
  - name: api                    # exact match with custom emojis
    emojis:
      online: "✅"
      offline: "❌"
  - regex: "^web\\d+$"          # regex with custom emojis
    emojis:
      offline: "🚨"
```

Only the statuses you specify are overridden; the rest fall back to global, then to the built-in defaults.

### Secret Overrides

`DISCORD_TOKEN` and `UPTIME_KUMA_API_KEY` can be set as environment variables to override the YAML values. This is useful for Kubernetes Secrets or CI environments where you don't want tokens in config files.

### Custom Config Path

Set the `CONFIG_PATH` environment variable to load config from a different location (default: `./config.yaml`).

## Run with Node

Requires Node.js 18+.

```bash
git clone https://github.com/djfeldman94/uptime-bot.git
cd uptime-bot
npm install
cp config.example.yaml config.yaml
# Edit config.yaml with your values
node index.js
```

## Run with Docker

### Build

```bash
docker build -t uptime-bot .
```

### Run

Mount your `config.yaml` into the container:

```bash
docker run -d --name uptime-bot \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  uptime-bot
```

To override secrets via env vars:

```bash
docker run -d --name uptime-bot \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e DISCORD_TOKEN="your-token" \
  -e UPTIME_KUMA_API_KEY="your-api-key" \
  uptime-bot
```

## Run on Kubernetes

Create a Secret for your tokens:

```bash
kubectl create namespace uptime-bot
kubectl create secret generic uptime-bot-secrets \
  -n uptime-bot \
  --from-literal=discord-token="your-token" \
  --from-literal=uptime-kuma-api-key="your-api-key"
```

Then apply a manifest like this:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: uptime-bot-config
  namespace: uptime-bot
data:
  config.yaml: |
    discord:
      token: ""
      guildId: "your-guild-id"
      channelId: "your-channel-id"
      clientId: "your-client-id"

    uptimeKuma:
      url: "https://uptime.example.com/metrics"
      username: "uptime-token"
      apiKey: ""

    updateInterval: 60

    monitors:
      caseSensitive: true
      sections:
        - title: Services
          filters:
            - Plex
            - Grafana
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: uptime-bot
  namespace: uptime-bot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: uptime-bot
  template:
    metadata:
      labels:
        app: uptime-bot
    spec:
      containers:
        - name: uptime-bot
          image: ghcr.io/djfeldman94/uptime-bot:latest
          env:
            - name: DISCORD_TOKEN
              valueFrom:
                secretKeyRef:
                  name: uptime-bot-secrets
                  key: discord-token
            - name: UPTIME_KUMA_API_KEY
              valueFrom:
                secretKeyRef:
                  name: uptime-bot-secrets
                  key: uptime-kuma-api-key
            - name: CONFIG_PATH
              value: /config/config.yaml
          volumeMounts:
            - name: config
              mountPath: /config
              readOnly: true
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "200m"
      volumes:
        - name: config
          configMap:
            name: uptime-bot-config
```

Secrets are injected as env vars (`DISCORD_TOKEN`, `UPTIME_KUMA_API_KEY`) which override the empty values in the ConfigMap. The YAML config is mounted read-only at `/config/config.yaml`.

## Default Status Icons

| Icon | Status | Config key |
|---|---|---|
| :green_circle: | Online | `online` |
| :red_circle: | Offline | `offline` |
| :yellow_circle: | Warning | `warning` |
| :large_blue_circle: | Maintenance | `maintenance` |
| :question: | Unknown | `unknown` |
