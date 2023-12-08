import 'dotenv/config';
import fetch from 'node-fetch';

// JSON of all trackmania map map tags
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

class BaseService {
    constructor(url, audience) {
        this.url = url;
        this.audience = audience;

    }

    async getAccessToken() {
       return (await trackmaniaAuthRequest(this.audience)).accessToken;
    }

    async fetchEndpoint(endpoint) {
        const res = await fetch(this.url + endpoint, {
            headers: {
                Authorization: `nadeo_v1 t=${await this.getAccessToken()}`,
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
        return await data;
    }
}

export class LiveService extends BaseService {
    constructor() {
        super('https://live-services.trackmania.nadeo.live', 'NadeoLiveServices');
    }

    async trackOfTheDay() {
        const tracks_of_the_month = (await this.fetchEndpoint(`/api/token/campaign/month?length=1&offset=0`)).monthList[0];

        const currentTime = Math.round(Date.now() / 1000);
        const currentDay = new Date().getDate();

        if (tracks_of_the_month.days[currentDay-1]?.startTimestamp > currentTime) {
            return tracks_of_the_month.days[currentDay - 2];
        } else {
            return tracks_of_the_month.days[currentDay - 1];
        }
    }

    async getMapInfo(mapUid) {
        return await this.fetchEndpoint(`/api/token/map/${mapUid}`);
    }
}

export class MeetService extends BaseService {
    constructor() {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices');
    }

    async cupOfTheDay() {
        return await this.fetchEndpoint('/api/cup-of-the-day/current');
    }
}

export async function fetchAccountName(account_id_list) {
    const token = await fetch('https://api.trackmania.com/api/access_token', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `grant_type=client_credentials&client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}`
    });

    const account_name_list = await fetch(`https://api.trackmania.com/api/display-names?accountId[]=${account_id_list}`, {
        headers: {
            Authorization: `Bearer ${(await token.json()).access_token}`,
        },
    });

    return (await account_name_list.json())[account_id_list];
}

export async function fetchManiaExchange(endpoint) {
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

async function trackmaniaAuthRequest(audience) {
    const url = 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/basic';
    const login_password_base64 = Buffer.from(`${process.env.LOGIN}:${process.env.PASSWORD}`).toString('base64');

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