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

const BASE64_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

/**
 * Function that converts a number from up to Base-64 to a decimal
 * @param {string} str
 * @param {string} base Base in which you're converting from
 * @returns {BigInt}
 */
function convertToDecimal(str, base) {
    let res = 0n;

    for (let i = 0; i < str.length; i++) {
        const char = str[str.length - 1 - i];
        const digitVal = BASE64_CHARS.indexOf(char);

        res += BigInt(digitVal) * (BigInt(base) ** BigInt(i));
    }

    return res;
}

/**
 * 
 * @param {string} str str of number of up to base64
 * @param {number} fromBase
 * @param {number} toBase
 * @param {number} [targetLen=0] length of string that will be spit out. Start is padded with 0s.
 * @returns {string}
 */
export function convertNumberToBase(str, fromBase, toBase, targetLen = 0) {
    const bigBase = BigInt(toBase);
    let bigInt = convertToDecimal(str, fromBase);
    let res = '';
    while (bigInt > 0n) {
        res = BASE64_CHARS[Number(bigInt % bigBase)] + res;
        bigInt /= bigBase;
    }

    res = res.padStart(targetLen, '0');
    return res;
}

/**
 * Gets the date, with the time pushed back 13 hours :)
 * @param {*} yearsAgo 
 * @param {*} monthsAgo 
 */
export function getDate() {
    let date = new Date();
    date.setUTCHours(-18);
    return date;
}