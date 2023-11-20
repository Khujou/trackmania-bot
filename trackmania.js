import 'dotenv/config';
import fetch from 'node-fetch';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
} from 'discord-interactions';

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

class CoreService extends BaseService {
    constructor() {
        super('https://prod.trackmania.core.nadeo.online', 'NadeoServices');
    }

    async getMapInfo(mapIdList) {
        return await this.fetchEndpoint(`/maps/?mapIdList=${mapIdList}`);
    }
}

class LiveService extends BaseService {
    constructor() {
        super('https://live-services.trackmania.nadeo.live', 'NadeoLiveServices');
    }

    async trackOfTheDay(offset) {
        const totdMonth = await this.fetchEndpoint(`/api/token/campaign/month?length=1&offset=0`);
        //const currentTime = Math.round(Date.now() / 1000);
        return totdMonth.monthList[0].days[18];
    }

    async getMapInfo(mapUid) {
        return await this.fetchEndpoint(`/api/token/map/${mapUid}`);
    }
}

class MeetService extends BaseService {
    constructor() {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices');
    }

    async cupOfTheDay() {
        return await this.fetchEndpoint('/api/cup-of-the-day/current');
    }
}

async function fetchAccountName(accountId) {
    const url = `https://api.trackmania.com/api/display-names?accountId[]=${accountId}`;
    const token = await fetch('https://api.trackmania.com/api/access_token', {
        method: 'POST',
        body: JSON.stringify({
            'grant_type': 'client-credentials',
            'client_id': `${process.env.CLIENT_ID}`,
            'client_secret': `${process.env.CLIENT_SECRET}`,
        }),
    });

    console.log(token);

    const accountName = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return accountName;
}

export async function trackmaniaAuthRequest(audience) {
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

export async function trackmaniaCommands(req, res, data) {
    const { name } = data;
    const core_service = new CoreService();
    const live_service = new LiveService();
    const meet_service = new MeetService();
    
    if (name === 'totd') {
        /**
         * Obtain track of the day information, then display the track name, 
         * the track author, the track thumbnail, the times for the medals, 
         * and the leaderboard.
         */
        const trackOfTheDay = await live_service.trackOfTheDay();
        const mapInfo = await live_service.getMapInfo(trackOfTheDay.mapUid);
        const authorName = await fetchAccountName(mapInfo.author);

        //console.log(mapInfo);

        return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "```" +
                JSON.stringify(trackOfTheDay, null, 2) +
                JSON.stringify(mapInfo, null, 2) +
                JSON.stringify(authorName, null, 2) +
                "```",
            },
        });
    }

    if (name === 'cotd') {
        /**
         * Obtain cup of the day information, then display the info regarding 
         * what map it's played on, as well as the competition and challenges.
         */
        const cotdInfo = await meet_service.cupOfTheDay();

        return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "```" + 
                JSON.stringify(cotdInfo, null, 2) + 
                "```",
            },
        });
    }

}