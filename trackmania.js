import 'dotenv/config';
import fetch from 'node-fetch';

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