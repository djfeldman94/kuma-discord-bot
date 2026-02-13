# Uptime Bot

A Discord bot that pulls monitor statuses from [Uptime Kuma](https://github.com/louislam/uptime-kuma)'s Prometheus metrics endpoint and posts live-updating embeds to a channel.

## Prerequisites

- An Uptime Kuma instance with an API key (Settings > API Keys)
- A Discord bot token with `Guilds` and `GuildMessages` intents enabled

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
  apiKey: ""           # or set UPTIME_KUMA_API_KEY env var

updateInterval: 60     # seconds

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

### Secret Overrides

`DISCORD_TOKEN` and `UPTIME_KUMA_API_KEY` can be set as environment variables to override the YAML values. This is useful for Kubernetes Secrets or CI environments where you don't want tokens in config files.

### Custom Config Path

Set the `CONFIG_PATH` environment variable to load config from a different location (default: `./config.yaml`).

## Run with Node

Requires Node.js 18+.

```bash
git clone https://github.com/youruser/uptime-bot.git
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

## Status Icons

| Icon | Meaning |
|---|---|
| :green_circle: | Online |
| :red_circle: | Offline |
| :yellow_circle: | Warning |
| :large_blue_circle: | Maintenance |
