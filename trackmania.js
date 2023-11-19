import 'dotenv/config';
import fetch from 'node-fetch';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
    verifyKeyMiddleware,
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

        console.log(res);

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
        super('https://prod.trackmania.core.nadeo.online/', 'NadeoServices');
    }

    async getMapInfo(mapUidList) {
        return this.fetchEndpoint(`/maps/?mapUidList=${mapUidList}`);
    }
}

class LiveService extends BaseService {
    constructor() {
        super('https://live-services.trackmania.nadeo.live', 'NadeoLiveServices');
    }

    async trackOfTheDay(offset) {
        const totdMonth = await this.fetchEndpoint(`/api/token/campaign/month?length=1&offset=0`);
        console.log(totdMonth.monthList[0].days);
        return totdMonth;
    }
}

class MeetService extends BaseService {
    constructor() {
        super('https://meet.trackmania.nadeo.club', 'NadeoClubServices');
    }

    async cupOfTheDay() {
        return this.fetchEndpoint('/api/cup-of-the-day/current');
    }
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
        return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "```" + JSON.stringify(await live_service.trackOfTheDay(), null, 2) + "```",
            },
        });
    }

    if (name === 'cotd') {

        return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "```" + JSON.stringify(await meet_service.cupOfTheDay(), null, 2) + "```",
            },
        });
    }

}