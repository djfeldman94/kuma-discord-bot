const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load YAML config
const configPath = process.env.CONFIG_PATH || './config.yaml';
let yamlConfig;
try {
    yamlConfig = yaml.load(fs.readFileSync(path.resolve(configPath), 'utf8'));
} catch (err) {
    console.error(`Failed to load config from ${configPath}:`, err.message);
    process.exit(1);
}

const config = {
    token: process.env.DISCORD_TOKEN || yamlConfig.discord.token,
    guildID: yamlConfig.discord.guildId,
    channelID: yamlConfig.discord.channelId,
    clientID: yamlConfig.discord.clientId,
    updatetime: yamlConfig.updateInterval || 60,
    uptimeKumaUrl: yamlConfig.uptimeKuma.url,
    uptimeKumaApiKey: process.env.UPTIME_KUMA_API_KEY || yamlConfig.uptimeKuma.apiKey,
    monitors: yamlConfig.monitors.sections || [],
    caseSensitive: yamlConfig.monitors.caseSensitive !== false,
};

// Build a filter function — each filter is either a plain string (exact match)
// or an object { regex: "pattern" } for regex matching
function matchesFilter(monitorName, filter) {
    if (typeof filter === 'object' && filter.regex) {
        const flags = config.caseSensitive ? '' : 'i';
        return new RegExp(filter.regex, flags).test(monitorName);
    }
    if (config.caseSensitive) {
        return monitorName === filter;
    }
    return monitorName.toLowerCase() === String(filter).toLowerCase();
}
// Create a new Discord client instance with specified intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Object to store the IDs of the monitor messages, built from config
const monitorMessages = {};
for (const section of config.monitors) {
    monitorMessages[section.title] = null;
}

// Event listener for when the bot is ready
client.once('clientReady', async () => {
    console.log('Bot is online!');

    // Fetch the channel using the channel ID from the config
    const channel = await client.channels.fetch(config.channelID);
    
    if (channel && channel.isTextBased()) {
        // Clear the channel if it's a text-based channel
        await clearChannel(channel);
    } else {
        console.error(`Unable to find text channel with ID ${config.channelID}`);
    }

    // Call the function to update messages immediately
    await updateMessages();
    // Set interval to update messages every configured seconds
    setInterval(updateMessages, config.updatetime * 1000);
});

// Function to update monitor messages
async function updateMessages() {
    try {
        // Fetch the guild using the guild ID from the config
        const guild = await client.guilds.fetch(config.guildID);
        if (!guild) {
            console.error(`Unable to find guild with ID ${config.guildID}`);
            return;
        }

        // Fetch the channel using the channel ID from the config
        const channel = await guild.channels.fetch(config.channelID);
        if (!channel || !channel.isTextBased()) {
            console.error(`Unable to find text channel with ID ${config.channelID}`);
            return;
        }

        // Fetch monitor data from Uptime Kuma's Prometheus metrics endpoint
        const credentials = Buffer.from(`uptime-token:${config.uptimeKumaApiKey}`).toString('base64');
        const response = await fetch(config.uptimeKumaUrl, {
            headers: { 'Authorization': `Basic ${credentials}` }
        });

        if (!response.ok) {
            console.error(`Failed to fetch metrics: HTTP ${response.status}`);
            return;
        }

        const body = await response.text();

        // Parse monitor_status lines from Prometheus text format
        const monitors = [];
        const regex = /monitor_status\{(.*?)\} (\d+)/g;
        let match;
        while ((match = regex.exec(body)) !== null) {
            const labels = {};
            match[1].split(',').forEach(part => {
                const [key, value] = part.split('=');
                labels[key.trim()] = value.trim().replace(/"/g, '');
            });
            monitors.push({
                monitor_name: labels.monitor_name,
                monitor_type: labels.monitor_type,
                monitor_url: labels.monitor_url,
                monitor_hostname: labels.monitor_hostname,
                monitor_port: labels.monitor_port,
                status: parseInt(match[2])
            });
        }

        // Filter and send monitors for each configured section
        for (const section of config.monitors) {
            const filtered = monitors.filter(monitor =>
                section.filters.some(filter => matchesFilter(monitor.monitor_name, filter))
            );
            if (filtered.length === 0) {
                console.log(`${new Date().toLocaleString()} | No matches for "${section.title}", skipping`);
                continue;
            }
            await sendMonitorsMessage(channel, section.title, filtered);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to send or update a monitor message in the channel
async function sendMonitorsMessage(channel, category, monitors) {
    // Create the description for the embed message
    let description = monitors.map(monitor => {
        let statusEmoji = '';
        switch (monitor.status) {
            case 0:
                statusEmoji = '🔴'; // Offline
                break;
            case 1:
                statusEmoji = '🟢'; // Online
                break;
            case 2:
                statusEmoji = '🟡'; // Warning
                break;
            case 3:
                statusEmoji = '🔵'; // Maintenance
                break;
            default:
                statusEmoji = '❓'; // Unknown
        }
        return `${statusEmoji} | ${monitor.monitor_name}`;
    }).join('\n');

    // Create the embed message
    let embed = new EmbedBuilder()
        .setTitle(`${category} Monitor`)
        .setColor('#0099ff')
        .setDescription(description)
        .setFooter({ text: `Last updated: ${new Date().toLocaleString()}` })
        .setURL(config.uptimeKumaUrl);

    try {
        // Check if there is an existing message to update or send a new one
        if (monitorMessages[category]) {
            const message = await channel.messages.fetch(monitorMessages[category]);
            if (message) {
                // Update the existing message
                await message.edit({ embeds: [embed] });
                console.log(`${new Date().toLocaleString()} | Updated ${category} monitors message`);
            } else {
                // Send a new message if the existing one was not found
                const newMessage = await channel.send({ embeds: [embed] });
                monitorMessages[category] = newMessage.id;
                console.log(`${new Date().toLocaleString()} | Sent new ${category} monitors message`);
            }
        } else {
            // Send a new message if there is no existing message ID
            const newMessage = await channel.send({ embeds: [embed] });
            monitorMessages[category] = newMessage.id;
            console.log(`${new Date().toLocaleString()} | Sent ${category} monitors message`);
        }
    } catch (error) {
        console.error(`Failed to send/update ${category} monitors message:`, error);
    }
}

// Function to clear the messages in a channel
async function clearChannel(channel) {
    try {
        // Fetch all messages in the channel and bulk delete them
        const fetchedMessages = await channel.messages.fetch();
        await channel.bulkDelete(fetchedMessages);
        console.log('Cleared channel');
    } catch (error) {
        console.error('Error clearing channel:', error);
    }
}

// Log in to Discord with the bot token from the config
client.login(config.token).catch(error => {
    console.error('Error logging in:', error);
});
