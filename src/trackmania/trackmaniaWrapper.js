import 'dotenv/config';
import { MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import fetch from 'node-fetch';
import * as fs from 'node:fs';
import { getLogger, logProfile } from '../log.js';
import { convertMillisecondsToFormattedTime as convertMS, convertNumberToBase, getDate } from '../utils.js';

const log = getLogger();

class FileBasedCachingDataProvider {
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

    getData = async () => {
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

    getToken = async () => {
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

    getEndpointMetricName = (endpointLogName) => {
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
     * @returns 
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
    fetchAccessToken = async () => {
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
class CoreService extends BaseNadeoService {
    constructor(tokenProviderFactory) {
        super('https://prod.trackmania.core.nadeo.online', 'NadeoServices', tokenProviderFactory);
    }

    getMapInfo = async (mapIdList = undefined, mapUidList = undefined) => {
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
        log.info(gameMode);
        let endpoint = '/v2/mapRecords/?accountIdList=' +
        accountIdList.join(',') + '&mapId=' + mapId;
        if (seasonId !== undefined) endpoint +=  `&seasonId=${seasonId}`;
        if (gameMode !== undefined && gameMode !== 'Race') endpoint += `&gameMode=${gameMode}`;
        log.info(endpoint);
        return await this.fetchEndpoint('getMapRecords', endpoint);
    }
}

/**
 * Live API endpoints. Docs: https://webservices.openplanet.dev/live
 */
class LiveService extends BaseNadeoService {
    constructor(tokenProviderFactory) {
        super('https://live-services.trackmania.nadeo.live', 'NadeoLiveServices', tokenProviderFactory);
    }

    /**
     * 
     * @param {number} offset 
     * @param {number} day 
     * @returns {Promise<JSON>}
     */
    trackOfTheDay = async (offset, day) => {
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
        const mapLeaderboard = await this.fetchEndpoint('GetMapLeaderboard', `/api/token/leaderboard/group/${customId}/top?length=${length}&onlyWorld=${onlyWorld}&offset=${offset}`).then(response => response.tops[0].top);
        return mapLeaderboard;
    }
}

/**
 * Meet API endpoints. Docs: https://webservices.openplanet.dev/meet
 */
class MeetService extends BaseNadeoService {
    constructor(tokenProviderFactory) {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices', tokenProviderFactory);
    }

    cupOfTheDay = async () => {
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
class TrackmaniaOAuthService extends BaseService {
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
        return await this.tokenProvider.getToken().then(res => res.access_token);
    }

    async getAuthorization() {
        return `Bearer ${await this.getAccessToken()}`
    }

    /**
     * https://webservices.openplanet.dev/oauth/reference/accounts/id-to-name
     *
     * @param {string[]} account_ids
     * @returns {Promise<{}>}
     */
    async fetchAccountNames(account_ids) {
        const query = account_ids
        .map(account_id => `accountId[]=${account_id}`)
        .join('&');
        return await this.fetchEndpoint('GetAccountDisplayNames', `/api/display-names?${query}`);
    }
}

/**
 * Fetches info from API endpoints on trackmania.exchange website
 */
class TrackmaniaExchangeService extends BaseService {
    constructor() {
        super('https://trackmania.exchange', undefined);
    }

    getRequestHeaders = async () => {
        return {
            'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/0.1)',
        };
    }

    getMapInfo = async (mapUid) => {
        return await this.fetchEndpoint('GetMapInfo', `/api/maps/get_map_info/uid/${mapUid}`);
    }
}

/**
 *  JSON of all trackmania.exchange map tags with ID, Name, and Color associated
 */ 
const MAP_TAGS = [
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

const DAYS = ['Mon.', 'Tue.', 'Wed.', 'Thur.', 'Fri.', 'Sat.', 'Sun.'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export class TrackmaniaWrapper {
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
     * @returns {Promise<{}>}
     */
    trackOfTheDay = async (inputDate = new Date()) => {
        /**
         * Obtain track of the day information
         */
        const currDate = getDate();
        const offset = ((currDate.getUTCFullYear() - inputDate.getUTCFullYear()) * 12) + ((currDate.getUTCMonth()) - inputDate.getUTCMonth());
        const totd = await this.liveService.trackOfTheDay(offset, inputDate.getUTCDate());
        const command = `Track of the Day - ${DAYS[totd.day]} ${MONTHS[inputDate.getUTCMonth()]} ${totd.monthDay}, ${inputDate.getUTCFullYear()}`;

        console.log(totd);

        return {
            command: command,
            mapUid: totd.mapUid,
            groupUid: totd.seasonUid,
            startTimestamp: totd.startTimestamp,
            endTimestamp: totd.endTimestamp,
        };
    }

    /**
     *
     * @param {string} command
     * @param {string} mapUid
     * @param {string} [groupUid='Personal_Best']
     * @returns {Promise<{}>}
     */
    getTrackInfo = async (command, mapUid, groupUid = 'Personal_Best') => {
        const promises = await Promise.all([
            await this.coreService.getMapInfo(undefined, mapUid).then(response => response[0]),
            await this.exchangeService.getMapInfo(mapUid).catch(err => log.info(err)),
        ]);

        const nadeo_map_info = promises[0];
        const tmx_map_info = promises[1];

        console.log(nadeo_map_info);

        let track_json = {
            command: command,
            title: nadeo_map_info.filename.slice(0,-8),
            author: null,
            authorUid: nadeo_map_info.author,
            authortime: nadeo_map_info.authorScore,
            goldtime: nadeo_map_info.goldScore,
            silverTime: nadeo_map_info.silverScore,
            bronzeTime: nadeo_map_info.bronzeScore,
            tags: 'not available',
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
            track_json.tags = tmx_map_info.Tags.split(',').map(tag => MAP_TAGS[parseInt(tag) - 1]?.Name).join('\n');
            track_json.website = `https://trackmania.exchange/s/tr/${tmx_map_info.TrackID}`;
            track_json.stylename = parseInt(MAP_TAGS.find(tag => tag.Name === tmx_map_info.StyleName)?.Color, 16);
            track_json.provision += ' and Trackmania.Exchange';
        } else {
            log.error('Couldn\'t retrieve data from trackmania.exchange');
            track_json.author = await this.getAccountName([nadeo_map_info.author])
            .then(response => response[nadeo_map_info.author])
            .catch(err => {
                log.error('Can\'t get author WTF', err);
            });
        };

        console.log(track_json);

        return track_json;
    }

    cupOfTheDay = async () => {
        let res = await this.meetService.cupOfTheDay();
        log.info(res);
        return res;
    }

    getAccountName = async (accountIds) => {
        return await this.oauthService.fetchAccountNames(accountIds);
    }

    /**
     * 
     * @param {Callback} callback 
     * @param {any[]} args 
     * @param {Callback} getTime 
     * @returns {Promise<{}>}
     */
    getMapRecords = async (callback, args, getTime) => {
        let records = {};
        await callback(...args).then(response => response.forEach(record => {
            record.position = (record.position === undefined) ? 'xxxxx' : record.position;
            records[record.accountId] = {
                position: record.position,
                time: convertMS(getTime(record)),
            };
        }));
        return records;
    }

    getLeaderboard = async (custom_id, length = 25, onlyWorld = true, offset = 0)  => {
        return await this.getMapRecords(this.liveService.getMapLeaderboard, [custom_id, length, onlyWorld, offset], (record => record.score));
    }

    getWatchedAccountsMapRecords = async (accountIdList, mapId, gameMode = 'Race', seasonId = undefined) => {
        return await this.getMapRecords(this.coreService.getMapRecords, [accountIdList, mapId, gameMode, seasonId], (record => record.recordScore.time));
    }

}