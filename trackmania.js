import { MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import 'dotenv/config';
import fetch from 'node-fetch';
import * as NodeCache from 'node-cache';
import * as schedule from 'node-schedule';
import * as fs from 'node:fs';
import { getLogger, logProfile } from './log.js';
import { convertMillisecondsToFormattedTime as convertMS, convertNumberToBase } from './utils.js';

const log = getLogger();

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
     * @param {filepath} filepath path to read/write the cached result
     * @param {callbackfn} deserializeFunction
     * @param {callbackfn} postProcessFunction (optional) function to run after retrieving the data either from file or from fetching
     * @param {callbackfn} serializeFunction
     * @param {callbackfn} expiredPredicate function to check whether the data is expired
     * @param {callbackfn} fetchFunction invoked when the cached data is expired
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
                log.warn(`Failed to read cached data from ${this.filepath}, fetching instead. `, err);
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
     * @param {callbackfn} postProcessFunction (optional) transform to run on the JSON after parsing
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
                    log.error('Unable to determine expiry key for token', err);
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
     * @param {baseUrl} baseUrl url for API calls
     * @param {tokenProvider} tokenProvider for JWT tokens
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

    getEndpointMetricName(endpointLogName) {
        /**
         * Using constructor name could break this if we start minifying the JS:
         * https://stackoverflow.com/a/10314492
         * Keeping for now since it's less ugly than constructing this class with a name
         */
        return `${this.constructor.name}.${endpointLogName}`
    }

    /**
     * fetches json from endpoint
     * @param {string} endpointLogName logging name for the endpoint, e.g. 'GetUsername'
     * @param {endpoint} endpoint relative path to endpoint from baseUrl, e.g. '/api/username'
     * @returns {Promise<JSON>}
     */
    async fetchEndpoint(endpointLogName, endpoint) {
        if (endpoint == undefined) {
            throw new Error('Undefined endpoint!');
        }
        const finalEndpoint = this.baseUrl + endpoint;
        log.http(`Fetching endpoint "${finalEndpoint}"`);
        const callable = async () => fetch(finalEndpoint, {
            headers: await this.getRequestHeaders()
        })
        .then(async res => await res.json())
        .catch(err => {
            log.error(`Error fetching "${finalEndpoint}": `, err);
        });
        return logProfile(log, this.getEndpointMetricName(endpointLogName), callable);
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
            log.error(err);
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
            data = await this.fetchEndpoint('GetMapsById', `/maps/?mapIdList=${mapIdList}`);
        }
        else if (mapUidList !== undefined) {
            data = await this.fetchEndpoint('GetMapsByUid', `/maps/?mapUidList=${mapUidList}`);
        }
        else {
            throw new Error('No values given for map info');
        }
        return data;
    }

    /**
     * 
     * @param {*} accountIdList 
     * @param {*} mapId 
     * @param {*} gameMode 
     * @param {*} seasonId 
     * @returns {Promise<any[]>}
     */
    getMapRecords = async (accountIdList, mapId, gameMode, seasonId = undefined) => {
        console.log(gameMode);
        let endpoint = '/v2/mapRecords/?accountIdList=' +
        accountIdList.join(',') + '&mapId=' + mapId;
        if (seasonId !== undefined) endpoint +=  `&seasonId=${seasonId}`;
        if (gameMode !== undefined && gameMode !== 'Race') endpoint += `&gameMode=${gameMode}`;
        console.log(endpoint);
        return await this.fetchEndpoint('getMapRecords', endpoint);
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
        const tracks_of_the_month = await this.fetchEndpoint('TrackOfTheMonth', `/api/token/campaign/month?length=1&offset=${offset}`).then(response => response.monthList[0]);
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
    getMapLeaderboard = async (customId, length = 5, onlyWorld = true, offset = 0) => {
        const map_leaderboard = await this.fetchEndpoint('GetMapLeaderboard', `/api/token/leaderboard/group/${customId}/top?length=${length}&onlyWorld=${onlyWorld}&offset=${offset}`).then(response => response.tops[0].top);
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
        const current_cotd = await this.fetchEndpoint('CupOfTheDay', '/api/cup-of-the-day/current');
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
        const query = account_ids
        .map(account_id => `accountId[]=${account_id}`)
        .join('&');
        return this.fetchEndpoint('GetAccountDisplayNames', `/api/display-names?${query}`);
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
        return this.fetchEndpoint('GetMapInfo', `/api/maps/get_map_info/uid/${mapUid}`);
    }
}

function toBase64(groupUid, timestamp = undefined) {
    if (timestamp !== undefined)
        timestamp = `totd+${convertNumberToBase(timestamp.toString(), 10, 64)}`;
    else timestamp = '0';

    if (groupUid !== 'Personal_Best') {
        groupUid = convertNumberToBase(groupUid.split('-').join(''), 16, 64);
    }

    const res = {
        encodedGroupUid: groupUid,
        encodedTimestamp: timestamp
    }

    return res;
}

const MAX_LEADERBOARD_GET = 1000;

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
    trackOfTheDay = async (inputDate = new Date()) => {
        /**
         * Obtain track of the day information, then display the track name,
         * the track author, the track thumbnail, the times for the medals,
         * the style of the track (using trackmania.exchange), and the leaderboard.
         */
        const currDate = new Date();
        const offset = ((currDate.getUTCFullYear() - inputDate.getUTCFullYear()) * 12) + ((currDate.getUTCMonth()) - inputDate.getUTCMonth());
        const totd = await this.liveService.trackOfTheDay(offset, inputDate.getUTCDate());
        const command = `Track of the Day - ${dayOfTheWeek[totd.day]} ${monthOfTheYear[inputDate.getUTCMonth()]} ${totd.monthDay}, ${inputDate.getUTCFullYear()}`;

        return {
            command: command,
            mapUid: totd.mapUid,
            groupUid: totd.seasonUid,
            endTimestamp: totd.endTimestamp,
        };
    
        let track_info = await this.getTrackInfo(command, totd.mapUid, totd.seasonUid);
        track_info.endTimestamp = totd.endTimestamp;
        return track_info;
    }

    /**
     *
     * @param {string} command
     * @param {string} mapUid
     * @param {string} [groupUid='Personal_Best']
     * @returns {Promise<JSON>}
     */
    getTrackInfo = async (command, mapUid, groupUid = 'Personal_Best') => {
        const promises = await Promise.all([
            await this.coreService.getMapInfo(undefined, mapUid).then(response => response[0]),
            await this.exchangeService.getMapInfo(mapUid).catch(err => log.info(err)),
        ]);

        const nadeo_map_info = promises[0];
        const tmx_map_info = promises[1];

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
            mapId: nadeo_map_info.mapId,
            provision: `Map UID: ${mapUid}\nProvided by Nadeo`,
            mapType: nadeo_map_info.mapType.slice(14),
        }

        /**
         * Tries to find the track on trackmania.exchange. If it can, updates attributes of map
         * with attributes from trackmania.exchange. If it cannot, only updates the Username attribute
         * of map by using an API from Nadeo.
         */

        if (tmx_map_info !== undefined) {
            track_json.title = tmx_map_info.Name
            track_json.author = tmx_map_info.Username;
            track_json.tags = tmx_map_info.Tags;
            track_json.website = `https://trackmania.exchange/s/tr/${tmx_map_info.TrackID}`;
            track_json.stylename = parseInt(map_tags.find(tag => tag.Name === tmx_map_info.StyleName)?.Color, 16);
            track_json.provision += ' and Trackmania.Exchange';
        } else {
            log.error('Couldn\'t retrieve data from trackmania.exchange');
            track_json.author = await this.oauthService.fetchAccountNames([nadeo_map_info.author])
            .then(response => response[nadeo_map_info.author])
            .catch(err => {
                log.error('Can\'t get author WTF', err);
                track_json.author = nadeo_map_info.author;
            });
        };

        return track_json;
    }

    cupOfTheDay = async () => {
        let res = await this.meetService.cupOfTheDay();
        log.info(res);
        return res;
    }

    generateLeaderboardField = async (recordsJSON) => {
        const { name, records } = recordsJSON;
        let field = {
            name: name,
            value: `\`\`\`RANK | TIME      | PLAYER\n-----+-----------+-----------------`,
            inline: false,
        };
        let accountIds = [];
        let players = [];
        if (records.length > 0) {
            records.forEach(record => accountIds.push(record.accountId));
            const accounts = await this.oauthService.fetchAccountNames(accountIds);
            records.forEach(record => {
                field.value += `\n${record.position.toString().padStart(5)}: ${record.time} - ${accounts[record.accountId]}`;
                players.push({
                    label: `${accounts[record.accountId]}`,
                    value: `${record.accountId}`,
                });
            });
            field.value += '```';
        }
        else { 
            field.value += '\n\nNo records available at this time :(```'; 
            players.push({
                label: 'No accounts available rn',
                value: 'na',
            });
        }

        const res = {
            field: field,
            players: players,
        };
        return res;
    }

    getLeaderboard = async (custom_id, length = 25, onlyWorld = true, offset = 0)  => {
        let lb_info = [];
        await this.liveService.getMapLeaderboard(custom_id, length, onlyWorld, offset)
        .then(response => response.forEach(record => {
            lb_info.push({
                position: record.position,
                accountId: record.accountId,
                time: convertMS(record.score),
            });
        }));
        return lb_info;
    }

    updateLeaderboard = async (leaderboard, mapUid, groupUid, endTimestamp, length = 25, onlyWorld = true, offset = 0) => {
        const { encodedGroupUid, encodedTimestamp } = toBase64(groupUid, endTimestamp);

        let pages = [];
        for (let i = 0; i < 25; i++) {
            pages.push({
                label: `Page ${((Number(offset)+(Number(length)*i))/Number(length))+1}`,
                value: `${length};${Number(offset)+(Number(length)*i)}`,
                description: `Leaderboard positions ${Number(offset)+(Number(length)*i)} - ${(Number(offset)+Number(length))+(Number(length)*i)}`,
            });
        }

        const recordsJSON = {
            name: `${pages[0].label} : ${leaderboard[0].position} - ${leaderboard[leaderboard.length-1].position}`,
            records: leaderboard,
        };

        const records = await this.generateLeaderboardField(recordsJSON);

        let buttons = [{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'First',
            custom_id: `lb+${encodedTimestamp}+f;${encodedGroupUid};${mapUid};${length};0`,
            disabled: false,
            emoji: {
                id: null,
                name: '⏪'
            },
        },{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'Back',
            custom_id: `lb+${encodedTimestamp};${encodedGroupUid};${mapUid};${length};${offset-length}`,
            disabled: false,
            emoji: {
                id: null,
                name: '⬅️',
            },
        },{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'Next',
            custom_id: `lb+${encodedTimestamp};${encodedGroupUid};${mapUid};${length};${Number(offset)+Number(length)}`,
            disabled: false,
            emoji: {
                id: null,
                name: '➡️',
            },
        },{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'Last',
            custom_id: `lb+${encodedTimestamp}+l;${encodedGroupUid};${mapUid};${length};${MAX_LEADERBOARD_GET-length}`,
            disabled: false,
            emoji: {
                id: null,
                name: '⏩'
            },
        }];
    
        if (offset === 0) buttons[0].disabled = true;
        if (offset-length < 0) buttons[1].disabled = true;
        if (offset+length >= 1000) buttons[2].disabled = true;
        if (offset >= 1000-length) buttons[3].disabled = true;

        const pageSelecter = {
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.STRING_SELECT,
                custom_id: `lb+${encodedTimestamp}+p;${encodedGroupUid};${mapUid}`,
                placeholder: 'Select page',
                options: pages,
            },],
        };

        const res = {
            records: records,
            buttons: buttons,
            pageSelecter: pageSelecter,
            encodedGroupUid: encodedGroupUid,
            encodedTimestamp: encodedTimestamp,
        };

        return res;
    }

    /**
     * 
     * @param {JSON} track_info 
     * @param {Number} [length=10]
     * @param {Boolean} [onlyWorld=true]
     * @param {Number} [offset=0]
     * @param {JSON} [watchedAccounts={}]
     * @returns {Promise<JSON>}
     */
    getLeaderboardInfo = async (track_info, length = 25, onlyWorld = true, offset = 0) => {
        const { leaderboard, groupUid, mapUid, endTimestamp, author } = track_info;
        const { records, buttons, pageSelecter, encodedGroupUid, encodedTimestamp } = await this.updateLeaderboard(leaderboard, mapUid, groupUid, endTimestamp, Number(length), onlyWorld, Number(offset));

        const fields = [records.field];

        const leaderboard_info = {
            author: author,
            timestamp: encodedTimestamp,
            groupUid: encodedGroupUid,
            mapUid: mapUid,
            fields: fields,
            buttons: buttons,
            accounts: records.players,
            watchedAccounts: ['no players'],
            pageSelecter: pageSelecter,
        };

        return leaderboard_info;
    }

    getWatchedAccounts = async (accountIdList, mapId, gameMode = 'Race', seasonId = undefined) => {
        let records = [];
        await this.coreService.getMapRecords(accountIdList, mapId, gameMode, seasonId)
        .then(response => response.forEach(record => {
            records.push({
                position: 'xxxxx',
                accountId: record.accountId,
                time: convertMS(record.recordScore.time),
            })
        }));

        return records;
    }
}


/**
 * creates a discord-compatible json using parsed info from Nadeo and Trackmania.Exchange
 * @param {JSON} track_json
 * @returns {Promise<JSON>}
 */
export async function embedTrackInfo(track_json) {
    const { command, title, author, firstPlace, authortime, goldtime, tags, website, stylename, thumbnail, mapUid, provision, mapType } = track_json;

    const medal_times = [
        `:first_place: ${firstPlace}`,
        `:green_circle: ${authortime}`,
        `:yellow_circle: ${goldtime}`
    ].join('\n');

    let tags_str = '';
    if (tags !== null) {
        tags.split(',').forEach((tag) => {
            tags_str += map_tags[parseInt(tag) - 1]?.Name;
            tags_str += '\n';
        });
    } else {tags_str = 'not available'}

    const { encodedGroupUid, encodedTimestamp } = toBase64(track_json.groupUid, track_json.endTimestamp);
    const encodedMapId = convertNumberToBase(track_json.mapId.split('-').join(''), 16, 64);

    const res = {
        embeds: [{
            author: { name: `${command}`, },
            title: title,
            color: stylename,
            fields: [{
                name: 'Author',
                value: author,
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
                url: thumbnail,
                height: 100,
                width: 100,
            },
            footer: {
                text: provision,
            },
        },],
        components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.PRIMARY,
                label: 'Leaderboard',
                custom_id: `lb+${encodedTimestamp}+${mapType}+${encodedMapId}+i;${encodedGroupUid};${mapUid};25;0`,
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
            url: website,
            emoji: {
                id: null,
                name: '💻',
            },
        });
    }

    return res;
}


export function embedLeaderboardInfo(lb_info) {
    const { author, timestamp, groupUid, mapUid, fields, buttons, accounts, watchedAccounts, pageSelecter } = lb_info;

    const res = {
    embeds: [{
        author: { name: author, },
        title: `Leaderboard`,
        color: parseInt('ffffff', 16),
        fields: fields,
    }],
    components: [{
        type: MessageComponentTypes.ACTION_ROW,
        components: buttons,
    },{
        type: MessageComponentTypes.ACTION_ROW,
        components: [{
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: 'acc+lb',
            placeholder: 'Search info of a Player',
            options: accounts,
        }],
    },{
        type: MessageComponentTypes.ACTION_ROW,
        components: [{
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: 'acc+w',
            placeholder: 'Search info of a Watched Player',
            options: watchedAccounts,
        }],
    }, pageSelecter, {
        type: MessageComponentTypes.ACTION_ROW,
        components: [{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.PRIMARY,
            label: 'Track Info',
            custom_id: `track+${timestamp};${groupUid};${mapUid};${author.split('-')[1].slice(1)}`,
            emoji: {
                id: null,
                name: '🏁'
            },
        },],
    },],
    };

    return res;
}
