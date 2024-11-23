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

export class FileBasedCachingDataProvider {
    /**
     * @param {filepath} file path to read/write the cached result
     * @param {deserializeFunction}
     * @param {postProcessFunction} (optional) function to run after retrieving the data either from file or from fetching
     * @param {serializeFunction}
     * @param {expiredPredicate} predicate function to check whether the data is expired
     * @param {fetchFunction} lazily invoked when the cached data is expired
     */
    constructor(filepath, deserializeFunction, postProcessFunction, serializeFunction, expiredPredicate, fetchFunction) {
        this.filepath = filepath;
        this.deserializeFunction = deserializeFunction;
        this.postProcessFn = postProcessFunction ?? (d => d);
        this.serializeFunction = serializeFunction;
        this.expiredPredicate = expiredPredicate;
        this.fetchFunction = fetchFunction;
        this.data = null;
    }

    async getData() {
        if (this.data == null) {
            this.data = await fs.promises.readFile(this.filepath, { encoding: 'utf8' })
                .then((data) => this.postProcessFn(this.deserializeFunction(data)))
		.catch(err => {
                    console.log(err);
                    return null;
		});
	}
        if (this.data == null || this.expiredPredicate(this.data)) {
            this.data = this.postProcessFn(await this.fetchFunction());
            await fs.promises.writeFile(this.filepath, this.serializeFunction(this.data), 'utf8');
	}
        return this.data;
    }
}

export class FileBasedCachingJSONDataProvider extends FileBasedCachingDataProvider {
    /**
     * @param {postProcessFunction} (optional) transform to run on the JSON after parsing
     */
    constructor(filepath, postProcessFunction, expiredPredicate, fetchFunction) {
        super(filepath,
	    JSON.parse,
            postProcessFunction,
            (data) => JSON.stringify(data, null, 2),
            expiredPredicate,
            fetchFunction);
    }
}

const TOKEN_EXPIRY_KEY = 'expiryTime';

export class FileBasedCachingAccessTokenProvider extends FileBasedCachingJSONDataProvider {
    constructor(filepath, fetchFunction) {
        super(filepath,
            (token) => {
                try {
                    /**
		     * Don't re-process the expiry time if we've already put it
		     * in the token. For Bearer tokens, this can cause our token
		     * to never register as expired
		     */
                    if (token[TOKEN_EXPIRY_KEY] !== undefined) {
                        return token;
                    }
                    let expiryTime = undefined;
                    /**
		     * Guess whether the token is a full JWT or just a bearer token
		     * based on the access token field name
		     */
                    if (token['access_token'] !== undefined) {
                        expiryTime = token['expires_in'] + new Date() / 1000;
                    } else {
                        expiryTime = JSON.parse(atob(token['accessToken'].split('.')[1]))['exp'];
		    }
                    token[TOKEN_EXPIRY_KEY] = Math.floor(expiryTime ?? 0);
		} catch (err) {
                    console.error('Unable to determine expiry key for token', err);
                }
                return token;
            },
            (token) => token[TOKEN_EXPIRY_KEY] < new Date() / 1000,
            fetchFunction);
    }

    async getToken() {
        return this.getData();
    }
}

class BaseService {
    /**
     * @param {baseUrl} base url for API calls
     * @param {tokenProvider} provider for JWT tokens
     */
    constructor(baseUrl, tokenProvider) {
        this.baseUrl = baseUrl;
        this.tokenProvider = tokenProvider;
    }

    /**
     * gets access token
     * @returns {Promise<JSON>}
     */
    async getAccessToken() {
        return (await this.tokenProvider.getToken()).accessToken;
    }

    async getAuthorization() {
        throw new Error("OVERRIDE ME");
    }

    async getRequestHeaders() {
        return {
            "User-Agent": 'trackmania-bot Discord Bot : https://github.com/Khujou/trackmania-bot',
            Authorization: await this.getAuthorization(),
        }
    }

    /**
     * fetches json from endpoint
     * @param {string} endpoint 
     * @returns {Promise<JSON>}
     */
    async fetchEndpoint(endpoint) {
        console.log(`Fetching endpoint "${this.baseUrl + endpoint}"`);
        const finalEndpoint = this.baseUrl + endpoint;
        return await fetch(finalEndpoint, {
            headers: await this.getRequestHeaders()
        })
        .then(async res => await res.json())
        .catch(err => {
            console.error(`Error fetching "${finalEndpoint}": `, err);
        });
    }
}

class BaseNadeoService extends BaseService {
    constructor(url, audience, tokenProviderFactory) {
        super(url, tokenProviderFactory(audience, () => this.fetchAccessToken()));
        this.audience = audience;
    }


    /**
     * receives authentication token from official nadeo API
     * @returns {Promise<JSON>}
     */
    async fetchAccessToken() {
        const url = 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/basic';
        const login_password_base64 = btoa(Buffer.from(`${process.env.TM_SERVER_ACC_LOGIN}:${process.env.TM_SERVER_ACC_PASSWORD}`));

        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${login_password_base64}`,
            },
            body: JSON.stringify({
                'audience': this.audience
            }),
        })
        .then(response => response.json())
        .catch(err => {
            console.log(err);
            return;
	});
    }

    async getAuthorization() {
        return `nadeo_v1 t=${await this.getAccessToken()}`
    }
}

/**
 * Covers Core API endpoints. Reference docs: https://webservices.openplanet.dev/core
 */
export class CoreService extends BaseNadeoService {
    constructor(tokenProviderFactory) {
        super('https://prod.trackmania.core.nadeo.online', 'NadeoServices', tokenProviderFactory);
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

/**
 * Live API endpoints. Docs: https://webservices.openplanet.dev/live
 */
export class LiveService extends BaseNadeoService {
    constructor(tokenProviderFactory) {
        super('https://live-services.trackmania.nadeo.live', 'NadeoLiveServices', tokenProviderFactory);
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

/**
 * Meet API endpoints. Docs: https://webservices.openplanet.dev/meet
 */
export class MeetService extends BaseNadeoService {
    constructor(tokenProviderFactory) {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices', tokenProviderFactory);
    }

    async cupOfTheDay() {
        const current_cotd = await this.fetchEndpoint('/api/cup-of-the-day/current');
        return current_cotd;
    }
}

/**
 * Covers endpoints in Trackmania's OAuth API:
 * https://webservices.openplanet.dev/oauth/summary
 *
 * Endpoint reference: https://webservices.openplanet.dev/oauth/reference
 */
export class TrackmaniaOAuthService extends BaseService {
    constructor(tokenProviderFactory) {
        super('https://api.trackmania.com',
            tokenProviderFactory('trackmania', () => this.fetchAccessToken()));
    }

    async fetchAccessToken() {
        return await fetch(`${this.baseUrl}/api/access_token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `grant_type=client_credentials&client_id=${process.env.TM_OAUTH2_CLIENT_ID}&client_secret=${process.env.TM_OAUTH2_CLIENT_SECRET}`
        }).then(response => response.json());
    }

    /**
     * prop name for access token is 'access_token' in TM OAuth API, so need to
     * override this method
     */
    async getAccessToken() {
        return (await this.tokenProvider.getToken()).access_token;
    }

    async getAuthorization() {
        return `Bearer ${await this.getAccessToken()}`
    }

    /**
     * https://webservices.openplanet.dev/oauth/reference/accounts/id-to-name
     *
     * @param {Array<String>} account_ids
     * @returns {Promise<JSON>}
     */
    async fetchAccountNames(account_ids) {
        const endpoint = '/api/display-names?'
	    + account_ids
		.map(account_id => `accountId[]=${account_id}`)
	        .join('&');
	return this.fetchEndpoint(endpoint);
    }
}

/**
 * Fetches info from API endpoints on trackmania.exchange website
 */
export class TrackmaniaExchangeService extends BaseService {
    constructor() {
        super('https://trackmania.exchange', undefined);
    }

    async getRequestHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/0.1)',
        };
    }

    async getMapInfo(mapUid) {
        return this.fetchEndpoint(`/api/maps/get_map_info/uid/${mapUid}`);
    }
}

export class TrackmaniaFacade {
    constructor(tokenProviderFactory) {
        this.coreService = new CoreService(tokenProviderFactory);
        this.liveService = new LiveService(tokenProviderFactory);
        this.meetService = new MeetService(tokenProviderFactory);
        this.oauthService = new TrackmaniaOAuthService(tokenProviderFactory);
        this.exchangeService = new TrackmaniaExchangeService();
    }

    /**
     *
     * @param {Date} [inputDate=new Date()]
     * @returns {Promise<JSON>}
     */
    async trackOfTheDay(inputDate = new Date()) {
        /**
         * Obtain track of the day information, then display the track name,
         * the track author, the track thumbnail, the times for the medals,
         * the style of the track (using trackmania.exchange), and the leaderboard.
         */
        const currDate = new Date();
        const offset = ((currDate.getUTCFullYear() - inputDate.getUTCFullYear()) * 12) + ((currDate.getUTCMonth()) - inputDate.getUTCMonth());
        const totd = await this.liveService.trackOfTheDay(offset, inputDate.getUTCDate());
        const command = `Track of the Day - ${dayOfTheWeek[totd.day]} ${monthOfTheYear[inputDate.getUTCMonth()]} ${totd.monthDay}, ${inputDate.getUTCFullYear()}`;
    
        let track_info = await this.getTrackInfo(command, totd.mapUid, totd.seasonUid);
        track_info.endTimestamp = totd.endTimestamp;
        return track_info;
    }

    /**
     *
     * @param {string} command
     * @param {string} mapUid
     * @param {string} [groupUid='Personal_Best']
     * @returns {JSON}
     */
    async getTrackInfo(command, mapUid, groupUid = 'Personal_Best') {
        const nadeo_map_info = await this.coreService.getMapInfo(undefined, mapUid).then(response => response[0]);

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
        await this.exchangeService.getMapInfo(mapUid)
        .then(response => {
            track_json.title = response.Name
            track_json.author = response.Username;
            track_json.tags = response.Tags;
            track_json.website = `https://trackmania.exchange/s/tr/${response.TrackID}`;
            track_json.stylename = parseInt(map_tags.find(tag => tag.Name === response.StyleName)?.Color, 16);
        })
        .catch(async err => {
            console.error('Couldn\'t retrieve data from trackmania.exchange:', err);
            track_json.author = await this.oauthService.fetchAccountNames([nadeo_map_info.author])
            .then(response => response[nadeo_map_info.author])
            .catch(err => {
                console.log('Can\'t get author WTF');
                console.error(err);
                track_json.author = nadeo_map_info.author;
            });
        });

        return track_json;
    }

    async cupOfTheDay() {
        let res = await this.meet_service.cupOfTheDay();
        console.log(res);
        return res;
    }
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
 * @param {LiveService} live_service 
 * @param {JSON} track_info 
 * @param {Number} [length=10]
 * @param {Boolean} [onlyWorld=true]
 * @param {Number} [offset=0]
 * @returns {Promise<JSON>}
 */
export async function leaderboard(live_service, oauth_service, track_info, length = 25, onlyWorld = true, offset = 0) {
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
        const accounts = await oauth_service.fetchAccountNames(lb_info.accountIds);
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
