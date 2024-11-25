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

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 
 * @param {string} num 
 * @param {number} [base=10] Starting base of number. Max is Base-32. Any value higher will come out as Base-32
 * @returns {string}
 */
export function convertNumberToBase62(num, base = 10) {
    base = parseInt(Math.min(Math.max(base, 2), 32), 10);
    let decimalVal = parseInt(num, base);
    let base62Val = '';

    while (decimalVal > 0) {
        const remainder = decimalVal % 62;
        base62Val = BASE62_CHARS.charAt(remainder) + base62Val;
        decimalVal = Math.floor(decimalVal / 62);
    }
    
    return base62Val;
}

/**
 * 
 * @param {string} base62 String of your number in Base62
 * @param {number} [targetLen=0]
 * @param {num} [base=10] Target base for your Base62 number to become
 * @returns {string}
 */
export function convertBase62ToNumber(base62num, targetLen = 0, base = 10) {
    let val = 0;

    for (let i = 0; i < base62num.length; i++) {
        const char = base62num[base62num.length - 1 - i];
        const digit = BASE62_CHARS.indexOf(char);
        val += digit * Math.pow(62, i);
    }

    return val.toString(base).padStart(targetLen, '0');
}