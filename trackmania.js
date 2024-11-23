import { MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import 'dotenv/config';
import fetch from 'node-fetch';
import * as NodeCache from 'node-cache';
import * as schedule from 'node-schedule';
import * as fs from 'node:fs';
import { convertMillisecondsToFormattedTime as convertMS } from './utils.js';

/**
 *  JSON of all trackmania.exchange map tags with ID, Name, and Color associated
 */ 
const map_tags = [
    { ID: 1, Name: 'Race', Color: '' },
    { ID: 2, Name: 'FullSpeed', Color: '' },
    { ID: 3, Name: 'Tech', Color: '' },
    { ID: 4, Name: 'RPG', Color: '' },
    { ID: 5, Name: 'LOL', Color: '' },
    { ID: 6, Name: 'Press Forward', Color: '' },
    { ID: 7, Name: 'SpeedTech', Color: '' },
    { ID: 8, Name: 'MultiLap', Color: '' },
    { ID: 9, Name: 'Offroad', Color: '705100' },
    { ID: 10, Name: 'Trial', Color: '' },
    { ID: 11, Name: 'ZrT', Color: '1a6300' },
    { ID: 12, Name: 'SpeedFun', Color: '' },
    { ID: 13, Name: 'Competitive', Color: '' },
    { ID: 14, Name: 'Ice', Color: '05767d' },
    { ID: 15, Name: 'Dirt', Color: '5e2d09' },
    { ID: 16, Name: 'Stunt', Color: '' },
    { ID: 17, Name: 'Reactor', Color: 'd04500' },
    { ID: 18, Name: 'Platform', Color: '' },
    { ID: 19, Name: 'Slow Motion', Color: '004388' },
    { ID: 20, Name: 'Bumper', Color: 'aa0000' },
    { ID: 21, Name: 'Fragile', Color: '993366' },
    { ID: 22, Name: 'Scenery', Color: '' },
    { ID: 23, Name: 'Kacky', Color: '' },
    { ID: 24, Name: 'Endurance', Color: '' },
    { ID: 25, Name: 'Mini', Color: '' },
    { ID: 26, Name: 'Remake', Color: '' },
    { ID: 27, Name: 'Mixed', Color: '' },
    { ID: 28, Name: 'Nascar', Color: '' },
    { ID: 29, Name: 'SpeedDrift', Color: '' },
    { ID: 30, Name: 'Minigame', Color: '7e0e69' },
    { ID: 31, Name: 'Obstacle', Color: '' },
    { ID: 32, Name: 'Transitional', Color: '' },
    { ID: 33, Name: 'Grass', Color: '06a805' },
    { ID: 34, Name: 'Backwards', Color: '83aa00' },
    { ID: 35, Name: 'Freewheel', Color: 'f2384e' },
    { ID: 36, Name: 'Signature', Color: 'f1c438' },
    { ID: 37, Name: 'Royal', Color: 'ff0010' },
    { ID: 38, Name: 'Water', Color: '69dbff' },
    { ID: 39, Name: 'Plastic', Color: 'fffc00' },
    { ID: 40, Name: 'Arena', Color: '' },
    { ID: 41, Name: 'Freestyle', Color: '' },
    { ID: 42, Name: 'Educational', Color: '' },
    { ID: 43, Name: 'Sausage', Color: '' },
    { ID: 44, Name: 'Bobsleigh', Color: '' },
    { ID: 45, Name: 'Pathfinding', Color: '' },
    { ID: 46, Name: 'FlagRush', Color: '7a0000' },
    { ID: 47, Name: 'Puzzle', Color: '459873' },
    { ID: 48, Name: 'Freeblocking', Color: 'ffffff' },
    { ID: 49, Name: 'Altered Nadeo', Color: '3a3a3a' },
    { ID: 50, Name: 'SnowCar', Color: 'd3d3d3' },
    { ID: 51, Name: 'Wood', Color: '814b00' }
];

const dayOfTheWeek = ['Mon.', 'Tue.', 'Wed.', 'Thur.', 'Fri.', 'Sat.', 'Sun.'];
const monthOfTheYear = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function getUpToDateNadeoAuthToken(filepath, callback, audience) {
    let filehandle;
    filehandle = await fs.promises.open(filepath, 'r+', 0o666)
    .catch(async err => {
        console.error(err);
        await fs.promises.writeFile(filepath, JSON.stringify({ 
            'NadeoServices': { expirationTime: 0 },
            'NadeoLiveServices': { expirationTime: 0 },
            'NadeoClubServices': { expirationTime: 0 },
        }, null, 2), 'utf8');
    });
    let token = await fs.promises.readFile(filepath, { encoding: 'utf8' }).then(data => JSON.parse(data));
    if (token[audience].expirationTime < (Math.floor(Date.now() / 1000)) ) {
        console.log('retrieving new token');
        const at = await callback(audience);
        const unencoded_at = JSON.parse(atob(at.accessToken.split('.')[1]));
        token[audience] = {
            'accessToken': at.accessToken,
            'refreshToken': at.refreshToken,
            'refreshTime': unencoded_at.rat,
            'expirationTime': unencoded_at.exp
        };
        fs.promises.writeFile(filepath, JSON.stringify(token, null, 2), 'utf8');
    }
    filehandle.close().catch(err => console.log(`wtf ${err}`));
    return token[audience];
}

class BaseService {
    /**
     * sets the url and audience for this service
     * @param {string} url 
     * @param {string} audience 
     */
    constructor(url, audience) {
        this.url = url;
        this.audience = audience;
    }

    /**
     * gets access token
     * @returns {Promise<JSON>}
     */
    async getAccessToken() {
        return await getUpToDateNadeoAuthToken('nadeoAuthToken.json', nadeoAuthentication, this.audience);
    }

    /**
     * fetches json from endpoint
     * @param {string} endpoint 
     * @returns {Promise<JSON>}
     */
    async fetchEndpoint(endpoint) {
        return await fetch(this.url + endpoint, {
            headers: {
                "User-Agent": 'trackmania-bot Discord Bot : https://github.com/Khujou/trackmania-bot',
                Authorization: `nadeo_v1 t=${await this.getAccessToken().then(response => response.accessToken)}`,
            }
        })
        .then(async res => await res.json())
        .catch(err => {
            console.error(err);
        });
    }
}

export class CoreService extends BaseService {
    constructor() {
        super('https://prod.trackmania.core.nadeo.online', 'NadeoServices');
    }

    async getMapInfo(mapIdList = undefined, mapUidList = undefined) {
        let data;
        if (mapIdList !== undefined) {
            data = await this.fetchEndpoint(`/maps/?mapIdList=${mapIdList}`);
        }
        else if (mapUidList !== undefined) {
            data = await this.fetchEndpoint(`/maps/?mapUidList=${mapUidList}`);
        }
        else {
            throw new Error('No values given for map info');
        }
        return data;
    }
}

export class LiveService extends BaseService {
    constructor() {
        super('https://live-services.trackmania.nadeo.live', 'NadeoLiveServices');
    }

    /**
     * 
     * @param {number} offset 
     * @param {number} day 
     * @returns {Promise<JSON>}
     */
    async trackOfTheDay(offset, day) {
        const tracks_of_the_month = await this.fetchEndpoint(`/api/token/campaign/month?length=1&offset=${offset}`).then(response => response.monthList[0]);
        if (tracks_of_the_month.days[day - 1]?.relativeStart > 0) {
            return tracks_of_the_month.days[day - 2];
        } else {
            return tracks_of_the_month.days[day - 1];
        }
    }

    /**
     * 
     * @param {string} customId Combine the groupUid and the mapUid of the map that you would like the leaderboard of into a string like this - `${groupUid}/map/${mapUid}`
     * @param {number} [length=5]
     * @param {boolean} [onlyWorld=true]
     * @param {number} [offset=0]
     * @returns {Promise<JSON>}
     */
    async getMapLeaderboard(customId, length = 5, onlyWorld = true, offset = 0) {
        const map_leaderboard = await this.fetchEndpoint(`/api/token/leaderboard/group/${customId}/top?length=${length}&onlyWorld=${onlyWorld}&offset=${offset}`).then(response => response.tops[0].top);
        return map_leaderboard;
    }
}

export class MeetService extends BaseService {
    constructor() {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices');
    }

    async cupOfTheDay() {
        const current_cotd = await this.fetchEndpoint('/api/cup-of-the-day/current');
        return current_cotd;
    }
}

/**
 * 
 * @param {JSON} account_id_list 
 * @returns {Promise<JSON>}
 */
async function fetchAccountName(account_id_list) {
    const token = await fetch('https://api.trackmania.com/api/access_token', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `grant_type=client_credentials&client_id=${process.env.TM_OAUTH2_CLIENT_ID}&client_secret=${process.env.TM_OAUTH2_CLIENT_SECRET}`
    }).then(response => response.json());

    let endpoint = `https://api.trackmania.com/api/display-names`;
    account_id_list.forEach((account_id, i) => {
        if (i === 0) endpoint += '?';
        else endpoint += '&';
        endpoint += `accountId[]=${account_id}`
    });

    return await fetch(endpoint, {
        headers: {
            Authorization: `Bearer ${token.access_token}`,
        },
    }).then(response => response.json());
}

/**
 * fetches info from API endpoint from trackmania.exchange website
 * @param {string} endpoint 
 * @returns {Promise<JSON>}
 */
async function fetchManiaExchange(endpoint) {
    const res = await fetch('https://trackmania.exchange' + endpoint, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/0.1)',
        }
    })

    if (!res.ok) {
        const data = await res.json();
        console.log(`epic failure ${res.status}`);
        throw new Error(JSON.stringify(data));
    }

    return res.json();
}

/**
 * receives authentication token from official nadeo API
 * @param {string} audience 
 * @returns {Promise<JSON>}
 */
async function nadeoAuthentication(audience) {
    const url = 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/basic';
    const login_password_base64 = btoa(Buffer.from(`${process.env.TM_SERVER_ACC_LOGIN}:${process.env.TM_SERVER_ACC_PASSWORD}`));

    try {
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${login_password_base64}`,
            },
            body: JSON.stringify({
                'audience':`${audience}`,
            }),
        }).then(response => response.json());
    } catch (err) {
        console.log(err);
        return;
    }
    
    /*
    console.log(res);

    if (!res.ok) {
        const data = res;
        console.log(`epic fail ${res.status}`);
        throw new Error(JSON.stringify(data));
    }

    return res;
    */
}

/**
 * 
 * @param {CoreService} core_service 
 * @param {LiveService} live_service 
 * @param {string} command 
 * @param {string} mapUid 
 * @param {string} [groupUid='Personal_Best']
 * @returns {Promise<JSON>}
 */
export async function getTrackInfo(core_service, command, mapUid, groupUid = 'Personal_Best') {
    
    const nadeo_map_info = await core_service.getMapInfo(undefined, mapUid).then(response => response[0]);

    let track_json = {
        command: command,
        title: nadeo_map_info.filename.slice(0,-8),
        author: null,
        authortime: convertMS(nadeo_map_info.authorScore),
        goldtime: convertMS(nadeo_map_info.goldScore),
        tags: null,
        website: null,
        stylename: 0,
        thumbnail: nadeo_map_info.thumbnailUrl,
        groupUid: groupUid,
        mapUid: mapUid,
    }

    /**
     * Tries to find the track on trackmania.exchange. If it can, updates attributes of map
     * with attributes from trackmania.exchange. If it cannot, only updates the Username attribute
     * of map by using an API from Nadeo.
     */
    await fetchManiaExchange(`/api/maps/get_map_info/uid/${mapUid}`)
    .then(response => {
        track_json.title = response.Name
        track_json.author = response.Username;
        track_json.tags = response.Tags;
        track_json.website = `https://trackmania.exchange/s/tr/${response.TrackID}`;
        track_json.stylename = parseInt(map_tags.find(tag => tag.Name === response.StyleName)?.Color, 16);
    })
    .catch(async err => {
        console.error('Couldn\'t retrieve data from trackmania.exchange:', err);
        track_json.author = await fetchAccountName([nadeo_map_info.author])
        .then(response => response[nadeo_map_info.author])
        .catch(err => {
            console.log('Can\'t get author WTF');
            console.error(err);
            track_json.author = nadeo_map_info.author;
        });
    });

    return track_json;
}

/**
 * creates a discord-compatible json using parsed info from Nadeo and Trackmania.Exchange
 * @param {JSON} track_json
 * @returns {Promise<JSON>}
 */
export async function embedTrackInfo(live_service, track_json) {

    console.log(track_json);

    const medal_times = 
        `:first_place: ${await live_service.getMapLeaderboard(`${track_json.groupUid}/map/${track_json.mapUid}`, 1).then(response => convertMS(response[0].score))}\n` +
        `:green_circle: ${track_json.authortime}\n` +
        `:yellow_circle: ${track_json.goldtime}`;

    let tags_str = '';
    if (track_json.tags !== null) {
        track_json.tags.split(',').forEach((tag) => {
            tags_str += map_tags[parseInt(tag) - 1]?.Name;
            tags_str += '\n';
        });
    } else {tags_str = 'not available'}

    const res = {
        embeds: [{
            author: { name: `${track_json.command}`, },
            title: track_json.title,
            color: track_json.stylename,
            fields: [{
                name: 'Author',
                value: track_json.author,
                inline: true,
            },{
                name: 'Medal Times',
                value: medal_times,
                inline: true,
            },{
                name: 'Map Tags',
                value: tags_str,
                inline: true,
            },
            ],
            image: {
                url: track_json.thumbnail,
                height: 100,
                width: 100,
            },
            footer: {
                text: `MapUid:\n${track_json.mapUid}`,
            },
        },],
        components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.PRIMARY,
                label: 'Leaderboard',
                custom_id: `lb;${track_json.groupUid};${track_json.mapUid};25;0`,
                emoji: {
                    id: null,
                    name: '📋',
                },
            },],
        },],
    };

    if (track_json.website !== null) {
        res['components'][0]['components'].push({
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.LINK,
            label: 'Map on TMX',
            url: track_json.website,
            emoji: {
                id: null,
                name: '💻',
            },
        });
    }

    return res;
}


export function embedLeaderboardInfo() {

}

/**
 * 
 * @param {CoreService} core_service 
 * @param {LiveService} live_service 
 * @param {Date} [inputDate=new Date()]
 * @returns {Promise<JSON>}
 */
export async function trackOfTheDay(core_service, live_service, inputDate = new Date()) {
    /**
     * Obtain track of the day information, then display the track name, 
     * the track author, the track thumbnail, the times for the medals,
     * the style of the track (using trackmania.exchange), and the leaderboard.
     * 
     * TEMPORARY FILE to CACHE totd data for the day once requested
     */
    const currDate = new Date();
    const offset = ((currDate.getUTCFullYear() - inputDate.getUTCFullYear()) * 12) + ((currDate.getUTCMonth()) - inputDate.getUTCMonth());
    const totd = await live_service.trackOfTheDay(offset, inputDate.getUTCDate());
    const command = `Track of the Day - ${dayOfTheWeek[totd.day]} ${monthOfTheYear[inputDate.getUTCMonth()]} ${totd.monthDay}, ${inputDate.getUTCFullYear()}`;

    let track_info = await getTrackInfo(core_service, command, totd.mapUid, totd.seasonUid);
    track_info.endTimestamp = totd.endTimestamp;
    return track_info;
    
}

export async function cupOfTheDay(meet_service) {
    let res = await meet_service.cupOfTheDay();
    console.log(res);
    return res;
}

/**
 * 
 * @param {LiveService} live_service 
 * @param {JSON} track_info 
 * @param {Number} [length=10]
 * @param {Boolean} [onlyWorld=true]
 * @param {Number} [offset=0]
 * @returns {Promise<JSON>}
 */
export async function leaderboard(live_service, track_info, length = 25, onlyWorld = true, offset = 0) {
    let lb_info = {
        positions: [],
        accountIds: [],
        times: [],
    };
    await live_service.getMapLeaderboard(`${track_info.groupUid}/map/${track_info.mapUid}`, length, onlyWorld, offset)
    .then(response => response.forEach(record => {
        lb_info.positions.push(record.position);
        lb_info.accountIds.push(record.accountId);
        lb_info.times.push(`${convertMS(record.score)}`);
    }));

    let pages = [];
    for (let i = 0; i < 25; i++) {
        pages.push({
            label: `Page ${((Number(offset)+(Number(length)*i))/Number(length))+1}`,
            value: `${length};${Number(offset)+(Number(length)*i)}`,
            description: `Leaderboard positions ${Number(offset)+(Number(length)*i)} - ${(Number(offset)+Number(length))+(Number(length)*i)}`,
        });
    }
    
    let records = [];
    let s_accounts = [];
    if (lb_info.accountIds.length > 0) {
        const accounts = await fetchAccountName(lb_info.accountIds);
        let field = {
            name: `${lb_info.positions[0]} - ${lb_info.positions[lb_info.positions.length - 1]}`,
            value: '```',
            inline: true,
        };
        lb_info.accountIds.forEach((accountId, i) => {
            field.value += `${lb_info.positions[i].toString().padStart(5)}: ${lb_info.times[i]} - ${accounts[accountId]}\n`;
            s_accounts.push({
                label: `${accounts[accountId]}`,
                value: `${accountId}`,
            });
        });
        field.value += '```';
        records.push(field);
    }
    else {
        records.push({
            name: `no records available`,
            value: `come back later :(`,
            inline: true,
        });
    }

    let buttons = [{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.SECONDARY,
                label: 'First',
                custom_id: `lb_f;${track_info.groupUid};${track_info.mapUid};${length}`,
                disabled: false,
                emoji: {
                    id: null,
                    name: '⏪'
                },
            },{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.SECONDARY,
                label: 'Back',
                custom_id: `lb;${track_info.groupUid};${track_info.mapUid};${length};${Number(offset)-Number(length)}`,
                disabled: false,
                emoji: {
                    id: null,
                    name: '⬅️',
                },
            },{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.SECONDARY,
                label: 'Next',
                custom_id: `lb;${track_info.groupUid};${track_info.mapUid};${length};${Number(offset)+Number(length)}`,
                disabled: false,
                emoji: {
                    id: null,
                    name: '➡️',
                },
            },{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.SECONDARY,
                label: 'Last',
                custom_id: `lb_l;${track_info.groupUid};${track_info.mapUid};${length}`,
                disabled: false,
                emoji: {
                    id: null,
                    name: '⏩'
                },
            }];
    
    if (Number(offset) === 0) buttons[0].disabled = true;
    if (Number(offset)-Number(length) < 0) buttons[1].disabled = true;
    if (Number(offset)+Number(length) >= 1000) buttons[2].disabled = true;
    if (Number(offset) >= 1000-Number(length)) buttons[3].disabled = true;

    const res = {
        embeds: [{
            author: { name: track_info.author, },
            title: `Leaderboard`,
            color: parseInt('ffffff', 16),
            fields: records,
        }],
        components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: buttons,
        },{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.STRING_SELECT,
                custom_id: 'acc',
                placeholder: 'Search player info',
                options: s_accounts,
            }],
        },{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.STRING_SELECT,
                custom_id: `lb_p;${track_info.groupUid};${track_info.mapUid}`,
                placeholder: 'Select page',
                options: pages,
            },],
        },{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.PRIMARY,
                label: 'Track Info',
                custom_id: `track;totd;${track_info.mapUid};${track_info.groupUid};${track_info.author.split('-')[1].slice(1)}`,
                emoji: {
                    id: null,
                    name: '🏁'
                },
            },],
        },],
    };

    return res;
}