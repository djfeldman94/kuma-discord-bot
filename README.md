# Uptime Bot

A Discord bot that pulls monitor statuses from [Uptime Kuma](https://github.com/louislam/uptime-kuma)'s Prometheus metrics endpoint and posts live-updating embeds to a channel.

## Prerequisites

- An Uptime Kuma instance with an API key (Settings > API Keys)
- A Discord bot token with `Guilds` and `GuildMessages` intents enabled

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_GUILD_ID` | Yes | Server (guild) ID |
| `DISCORD_CHANNEL_ID` | Yes | Channel ID to post embeds in |
| `DISCORD_CLIENT_ID` | Yes | Bot application client ID |
| `UPTIME_KUMA_URL` | Yes | Uptime Kuma metrics endpoint (e.g. `https://uptime.example.com/metrics`) |
| `UPTIME_KUMA_API_KEY` | Yes | Uptime Kuma API key |
| `UPDATE_INTERVAL` | No | Refresh interval in seconds (default: `60`) |
| `MONITORS` | No | JSON array defining monitor sections (see below) |
| `MONITOR_CASE_SENSITIVE` | No | Case-sensitive filter matching (default: `true`) |
| `MONITOR_REGEX` | No | Interpret filters as regex patterns (default: `false`) |

### Monitor Sections

The `MONITORS` variable is a JSON array of sections. Each section has a `title` (the embed heading) and `filters` (an array of strings to match against monitor names). If `MONITORS` is not set, no embeds will be posted.

**Exact match (default):**

```json
[
  {"title": "Gaming", "filters": ["Lobby", "Skyblock", "Survival"]},
  {"title": "Discord", "filters": ["Discord bot", "Status bot"]},
  {"title": "Web", "filters": ["web1", "web2", "web3"]}
]
```

**Case-insensitive match** (`MONITOR_CASE_SENSITIVE=false`):

```json
[
  {"title": "Web", "filters": ["Web1", "WEB2"]}
]
```

Filters `"Web1"` and `"WEB2"` will match `"web1"` and `"web2"`.

**Regex mode** (`MONITOR_REGEX=true`):

```json
[
  {"title": "All Services", "filters": [".*"]},
  {"title": "Web", "filters": ["^web\\d+$"]}
]
```

Regex mode and case-insensitive mode can be combined.

## Run with Node

Requires Node.js 18+.

```bash
git clone https://github.com/youruser/uptime-bot.git
cd uptime-bot
npm install
```

Set the environment variables and run:

```bash
export DISCORD_TOKEN="your-token"
export DISCORD_GUILD_ID="your-guild-id"
export DISCORD_CHANNEL_ID="your-channel-id"
export DISCORD_CLIENT_ID="your-client-id"
export UPTIME_KUMA_URL="https://uptime.example.com/metrics"
export UPTIME_KUMA_API_KEY="your-api-key"
export MONITORS='[{"title":"All Services","filters":[".*"]}]'
export MONITOR_REGEX="true"

node index.js
```

## Run with Docker

### Build

```bash
docker build -t uptime-bot .
```

### Run

```bash
docker run -d --name uptime-bot \
  -e DISCORD_TOKEN="your-token" \
  -e DISCORD_GUILD_ID="your-guild-id" \
  -e DISCORD_CHANNEL_ID="your-channel-id" \
  -e DISCORD_CLIENT_ID="your-client-id" \
  -e UPTIME_KUMA_URL="https://uptime.example.com/metrics" \
  -e UPTIME_KUMA_API_KEY="your-api-key" \
  -e UPDATE_INTERVAL="60" \
  -e MONITORS='[{"title":"All Services","filters":[".*"]}]' \
  -e MONITOR_REGEX="true" \
  uptime-bot
```

### Using an env file

Create a `.env` file:

```
DISCORD_TOKEN=your-token
DISCORD_GUILD_ID=your-guild-id
DISCORD_CHANNEL_ID=your-channel-id
DISCORD_CLIENT_ID=your-client-id
UPTIME_KUMA_URL=https://uptime.example.com/metrics
UPTIME_KUMA_API_KEY=your-api-key
UPDATE_INTERVAL=60
MONITORS=[{"title":"All Services","filters":[".*"]}]
MONITOR_REGEX=true
```

Then run with:

```bash
docker run -d --name uptime-bot --env-file .env uptime-bot
```

## Status Icons

| Icon | Meaning |
|---|---|
| :green_circle: | Online |
| :red_circle: | Offline |
| :yellow_circle: | Warning |
| :large_blue_circle: | Maintenance |
