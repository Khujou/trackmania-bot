import 'dotenv/config';
import { InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes
 } from 'discord-interactions';
import fetch from 'node-fetch';
import { getLogger } from './log.js';

const log = getLogger();

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
        log.error(`Unable to send discord request: Error ${res.status}`);
        throw new Error(JSON.stringify(data));
    }

    return res;
}

export async function InstallGlobalCommands(appId, commands) {
    const endpoint = `applications/${appId}/commands`;

    await DiscordRequest(endpoint, { method: 'PUT', body: commands })
    .catch(err => log.error(err));
}

export async function InstallGuildCommands(appId, guild_id, commands) {
    const endpoint = `applications/${appId}/guilds/${guild_id}/commands`;

    await DiscordRequest(endpoint, { method: 'PUT', body: commands })
    .catch(err => log.error(err));
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

const UID_LENGTH = 32;
const UID_DASH_INDICES = [0, 8, 12, 16, 20, 32];

/**
 * UID in this instance being any string that was formatted as ( xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx )
 * before it was converted to Base-64
 * @param {string} UID 
 * @returns 
 */
export function revertUID(UID) {
    UID = convertNumberToBase(UID, 64, 16, UID_LENGTH);
    let arr = [];
    for (let i = 1; i < UID_DASH_INDICES.length; i++)
        arr.push(UID.slice(UID_DASH_INDICES[i-1], UID_DASH_INDICES[i]));
    return arr.join('-');
}

/**
 * whatever :|
 */
export function getDate() {
    let date = Date.now();
    date -= 64800000; // minus 18 hours
    return new Date(date);
}