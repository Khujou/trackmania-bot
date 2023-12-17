import { 
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes 
} from 'discord-interactions';
import 'dotenv/config';
import fetch from 'node-fetch';
import * as NodeCache from 'node-cache';
import * as schedule from 'node-schedule';
import * as fs from 'node:fs';
import { convertMillisecondsToFormattedTime as convertMS } from './utils.js';

// JSON of all trackmania.exchange map tags
export const map_tags = [
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

const day = ['Mon.', 'Tue.', 'Wed.', 'Thur.', 'Fri.', 'Sat.', 'Sun.'];

let currentDay = new Date().getDate();
const changeDay = schedule.scheduleJob('0 0 * * *', () => {
    currentDay = new Date().getDate();
});

class BaseService {
    constructor(url, audience) {
        this.url = url;
        this.audience = audience;

    }

    async getAccessToken() {
        // if (JSON.parse(fs.readFile('data', (err, data) => {
        //     if (err) throw err
        //         console.log(err);
        // })).expirationTime < Math.round(Date.now() / 1000)) {
        //     //refresh token
        // } else {
        const at = await nadeoAuthentication(this.audience);
        const unencoded_at = JSON.parse(atob(at.accessToken.split('.')[1]));
        const res = {'accessToken': at.accessToken,
            'refreshToken': at.refreshToken,
            'refreshTime': unencoded_at.rat,
            'expirationTime': unencoded_at.exp};
        // }

        return res;
    }

    async fetchEndpoint(endpoint) {
        const res = await fetch(this.url + endpoint, {
            headers: {
                Authorization: `nadeo_v1 t=${await this.getAccessToken().then(response => response.accessToken)}`,
            }
        });

        if (!res.ok) {
            const data = await res.json();
            console.log(res.status);
            throw new Error(JSON.stringify(data));
        }

        return res.json();
    }
}

export class CoreService extends BaseService {
    constructor() {
        super('https://prod.trackmania.core.nadeo.online', 'NadeoServices');
    }

    async getMapInfo(mapIdList, mapUidList) {
        let data;
        if (mapIdList !== null) {
            data = await this.fetchEndpoint(`/maps/?mapIdList=${mapIdList}`);
        }
        else if (mapUidList !== null) {
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

    async trackOfTheDay(offset = 0, day = currentDay - 1) {
        const tracks_of_the_month = (await this.fetchEndpoint(`/api/token/campaign/month?length=1&offset=${offset}`)).monthList[0];
        if (tracks_of_the_month.days[day]?.relativeStart > 0) {
            return tracks_of_the_month.days[day - 1];
        } else {
            return tracks_of_the_month.days[day];
        }
    }
}

export class MeetService extends BaseService {
    constructor() {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices');
    }
}

async function fetchAccountName(account_id_list) {
    const token = await fetch('https://api.trackmania.com/api/access_token', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `grant_type=client_credentials&client_id=${process.env.TM_OAUTH2_CLIENT_ID}&client_secret=${process.env.TM_OAUTH2_CLIENT_SECRET}`
    });

    let endpoint = `https://api.trackmania.com/api/display-names`; let tmp = true;
    account_id_list.forEach((account_id) => {
        if (tmp === false) {
            endpoint += '&';
        } else {
            endpoint += '?'
            tmp = false;
        }
        endpoint += `accountId[]=${account_id}`
    });

    const account_name_list = await fetch(endpoint, {
        headers: {
            Authorization: `Bearer ${(await token.json()).access_token}`,
        },
    });

    return await account_name_list.json();
}

async function fetchManiaExchange(endpoint) {
    const url = 'https://trackmania.exchange';
    const res = await fetch(url + endpoint, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/0.1)',
        }
    })

    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res.json();
}

async function nadeoAuthentication(audience) {
    const url = 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/basic';
    const login_password_base64 = btoa(Buffer.from(`${process.env.TM_SERVER_ACC_LOGIN}:${process.env.TM_SERVER_ACC_PASSWORD}`));

    const res = await fetch (url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${login_password_base64}`,
        },
        body: JSON.stringify({
            'audience':`${audience}`,
        }),
    });

    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res.json();
}

/**
 * 
 * @param {string} title 
 * @param {CoreService} core_service 
 * @param {string} groupUid 
 * @param {string} mapUid 
 * @param {InteractionResponseFlags} flags 
 * @returns {Promise<JSON>}
 */
export async function embedTrackInfo(title, core_service, groupUid, mapUid, flags = null) {
    const nadeo_map_info = (await core_service.getMapInfo(null, mapUid))[0];

    let map = {
        'Name': nadeo_map_info.filename.slice(0,-8),
        'Username': null,
        'Difficulty': null,
        'AuthorTime': convertMS(nadeo_map_info.authorScore),
        'GoldTime': convertMS(nadeo_map_info.goldScore),
        'SilverTime': convertMS(nadeo_map_info.silverScore),
        'BronzeTime': convertMS(nadeo_map_info.bronzeScore),
        'Tags': null,
        'StyleName': null,
        'Thumbnail': nadeo_map_info.thumbnailUrl,
    }

    /**
     * Tries to find the track on trackmania.exchange. If it can, updates attributes of map
     * with attributes from trackmania.exchange. If it cannot, only updates the Username attribute
     * of map by using an API from Nadeo.
     */
    let mx_map_info;
    try {
        mx_map_info = await fetchManiaExchange(`/api/maps/get_map_info/uid/${mapUid}`);
        map.Username = mx_map_info.Username;
        map.Difficulty = mx_map_info.DifficultyName;
        map.Tags = mx_map_info.Tags;
        map.Website = `https://trackmania.exchange/s/tr/${mx_map_info.TrackID}`
        map.StyleName = parseInt(map_tags.find(tag => tag.Name === mx_map_info.StyleName).Color, 16)
    } catch (err) {
        console.error('Couldn\'t retrieve data from trackmania.exchange:', err);
        map.Username = fetchAccountName([nadeo_map_info.author])[nadeo_map_info.author];
    }

    const medal_times = 
        `:medal: ${map.AuthorTime}\n` +
        `:first_place: ${map.GoldTime}\n` +
        `:second_place: ${map.SilverTime}\n` +
        `:third_place: ${map.BronzeTime}\n`;

    let tags_str = '';
    if (map.Tags !== 'not available') {
        const tags = map.Tags.split(',');
        for (let i = 0; i < tags.length; i++) {
            tags_str += map_tags[parseInt(tags[i]) - 1]?.Name;
            tags_str += '\n';
        };
    } else {tags_str = map.Tags}

    const res = {
        flags: flags,
        embeds: [{
            title: title,
            color: map.StyleName,
            fields: [{
                name: 'Map',
                value: map.Name,
                inline: true,
            },{
                name: 'Difficulty',
                value: map.Difficulty,
                inline: true,
            },{
                name: 'Author',
                value: map.Username,
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
                url: map.Thumbnail,
                height: 100,
                width: 100,
            },
        },],
        components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.PRIMARY,
                label: 'Leaderboard',
                custom_id: `map_leaderboard_${groupUid}_${mapUid}`,
                emoji: {
                    id: null,
                    name: '📋',
                },
            },],
        },],
    }

    if (map.Website !== null) {
        res['components'][0]['components'].push({
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.LINK,
            label: 'Map on TMX',
            url: map.Website,
            emoji: {
                id: null,
                name: '💻',
            },
        });
    }

    return res;
}

/**
 * 
 * @param {CoreService} core_service 
 * @param {LiveService} live_service 
 * @param {InteractionResponseFlags} flags 
 * @returns {Promise<JSON>}
 */
export async function trackOfTheDay(core_service, live_service, flags = null) {
    /**
     * Obtain track of the day information, then display the track name, 
     * the track author, the track thumbnail, the times for the medals,
     * the style of the track (using trackmania.exchange), and the leaderboard.
     * 
     * TEMPORARY FILE to CACHE totd data for the day once requested
     */
    const totd = await live_service.trackOfTheDay();
    console.log(totd);
    const title = `Track of the Day - ${day[totd.day]} ${totd.monthDay}`;
    let res = await embedTrackInfo(title, core_service, totd.seasonUid, totd.mapUid, flags);
    res['components'][0]['components'].unshift({
        type: MessageComponentTypes.BUTTON,
        style: ButtonStyleTypes.DANGER,
        label: 'Cup of the Day',
        custom_id: `cotd_button`,
        emoji: {
            id: null,
            name: '🏆',
        },
    });
    return res;
}

export async function leaderboard() {
    const prev_button = {
        type: MessageComponentTypes.BUTTON,
        style: ButtonStyleTypes.PRIMARY,
        label: 'Back',
        custom_id: 'back_button',
        emoji: {
            id: null,
            name: '⬅️',
        },
    };

    const next_button = {
        type: MessageComponentTypes.BUTTON,
        style: ButtonStyleTypes.PRIMARY,
        label: 'Next',
        custom_id: 'next_button',
        emoji: {
            id: null,
            name: '➡️',
        },
    };
}