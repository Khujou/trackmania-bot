import 'dotenv/config';
import fetch from 'node-fetch';

export async function DiscordRequest(endpoint, options) {
    const url = 'https://discord.com/api/v10/' + endpoint;
    
    if (options.body) options.body = JSON.stringify(options.body);

    const res = await fetch (url, {
        headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        ...options
    });

    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res;
}

export async function InstallGlobalCommands(appId, commands) {
    const endpoint = `applications/${appId}/commands`;

    try {
        await DiscordRequest(endpoint, { method: 'PUT', body: commands });
    } catch (err) {
        console.error(err);
    }
}

export async function InstallGuildCommands(appId, guild_id, commands) {
    const endpoint = `applications/${appId}/guilds/${guild_id}/commands`;

    try {
        await DiscordRequest(endpoint, {method: 'PUT', body: commands});
    } catch (err) {
        console.error(err);
    }
}

export function convertMillisecondsToFormattedTime(milliseconds) {
    const ms = milliseconds % 1000;
    const seconds = Math.floor((milliseconds / 1000) %  60);
    const minutes = Math.floor((milliseconds / 1000 / 60));
    //const hours = Math.floor((milliseconds / 1000 / 60 / 60) % 24);

    const formattedTime = [
        //hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0'),
        ms.toString().padStart(3, '0')
    ].join(':');

    return formattedTime;
}