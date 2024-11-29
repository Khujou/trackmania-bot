import 'dotenv/config';
import express from 'express';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
    verifyKeyMiddleware,
} from 'discord-interactions';
import * as schedule from 'node-schedule';
import * as trackmania from './trackmania.js';
import { DiscordRequest, convertMillisecondsToFormattedTime, convertNumberToBase } from './utils.js';
import { MongoClient, ServerApiVersion } from 'mongodb';
import * as fs from 'fs';
import { setLogLevel, getLogger, logProfile } from './log.js';
const uri = process.env.MONGODB_URI;

setLogLevel('info');
const log = getLogger();

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;
const accountWatchers = {
    '205541764206034944': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
    '500722458056327196': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
};

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db('admin').command({ ping: 1});
        log.info('Pinged your deployment. You successfully connected to MongoDB!');
    } finally {
        await client.close();
    }
}
run().catch(log.error);

const tokenProviderFactory = (identifier, fetchFunction) =>
        new trackmania.FileBasedCachingAccessTokenProvider(`accessToken-${identifier}.json`, fetchFunction);
const trackmaniaFacade = new trackmania.TrackmaniaFacade(tokenProviderFactory);

// Returns up-to-date TOTD info. Checks if stored TOTD info is out of date and replaces with up-to-date info.
const cachingTOTDProvider = new trackmania.FileBasedCachingJSONDataProvider('totd.json',
    undefined,
    (trackInfo) => trackInfo.endTimestamp < (Math.floor(Date.now() / 1000)),
    async () => { 
        const { command, mapUid, groupUid, endTimestamp } = await trackmaniaFacade.trackOfTheDay();
        let track_json = await trackmaniaFacade.getTrackInfo(command, mapUid, groupUid);
        track_json.endTimestamp = endTimestamp;
        return track_json;
    });
const debugData = await logProfile(log, 'GetCachedTmData', () => cachingTOTDProvider.getData());
log.info(JSON.stringify(debugData));

const startDate = new Date(2020, 6, 1);
let totd_channel = '1183478764856942642';

app.get('/', (req, res) => {
    res.send('whats up');
});

// Interactions endpoint URL where Discord will send HTTP requests
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
    // Interaction type and data
    const { type, id, data, token, message } = req.body;

    // Handle verification requests
    if (type === InteractionResponseType.PING) {
        return res.send({ type: InteractionResponseType.PONG});
    }

    // Handle slash command requests
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data;
        const postendpoint = `webhooks/${process.env.APP_ID}/${token}`;
        const endpoint = `${postendpoint}/messages/@original`;

        if (name === 'test') {
            res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            })
            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: {
                    content: 'hello world',
                    embeds: [{
                        title: 'hello world',
                        color: 39423,
                        description: 'example embed',
                        image: {
                            url: 'https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?q=80&w=1364&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                            height: 100,
                            width: 100,
                        },
                        fields: [{
                            name: 'field name',
                            value: 'field value\nfield value',
                        },],
                        author: {
                            name: 'Brungus',
                            url: 'https://github.com/Khujou/trackmania-bot',
                            icon_url: 'https://media.discordapp.net/attachments/501929280729513994/1175598105178152991/IMG_0778.jpg?ex=657e450d&is=656bd00d&hm=b71379906b73849aa7e3fc05e8d20669f93b237ed45a93ce870e099c902f8776&=&format=webp',
                        },
                        footer: {
                            text: 'bungus',
                            icon_url: 'https://media.discordapp.net/attachments/501929280729513994/1154607848437858374/image.png?ex=657bbc5a&is=6569475a&hm=1a8904ebb68181710d0d9808f20516b2f1f35ce1b09706af3e89a18915ca9f54&=&format=webp&quality=lossless',
                        },
                        provider: {
                            name: 'blehg',
                            url: 'https://www.youtube.com',
                        },
                    },],
                    components: [{
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [{
                            type: MessageComponentTypes.BUTTON,
                            style: 1,
                            label: 'test',
                            custom_id: 'test_button',
                        },{
                            type: MessageComponentTypes.BUTTON,
                            url: 'https://raw.githubusercontent.com/2qar/bigheadgeorge.github.io/master/ogdog.gif',
                            label: 'Click for win',
                            style: 5,
                        },{
                            type: MessageComponentTypes.BUTTON,
                            url: 'https://media.tenor.com/FDxMOf3iWhIAAAAM/angry-cute-cat-cat.gif',
                            label: 'Click for lose',
                            style: 5,
                        },
                        ],
                    },
                    ],
                }
            }).catch(err => embeddedErrorMessage(endpoint, err));
        }

        else if (name ==='tucker') {
            try {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: 'i miss him <@203284058673774592>',
                        flags: InteractionResponseFlags.EPHEMERAL,
                    },
                });
            } catch (err) {
                embeddedErrorMessage(endpoint, err);
            }
        }

        else if (name === 'totd') {
            res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                /* data: { flags: InteractionResponseFlags.EPHEMERAL, } */
            });

            let track_json;
            let dateArg = new Date();
            if (options[0].name === 'past') {
                const fields = options[0].options;
                const inputDate = new Date(fields[0].value, fields[1].value - 1, fields[2].value);
                dateArg = (inputDate < dateArg) ? inputDate : dateArg;
                if (inputDate < startDate)
                    embeddedErrorMessage(endpoint, Error('Date given is before Trackmania came out, silly :)'));

                const { command, mapUid, groupUid, endTimestamp } = await trackmaniaFacade.trackOfTheDay(dateArg).catch(err => embeddedErrorMessage(endpoint, err));
                const api_calls = await Promise.all([
                    trackmaniaFacade.getTrackInfo(command, mapUid, groupUid),
                    trackmaniaFacade.getLeaderboard(`Personal_Best/map/${mapUid}`, 1).then(response => response[0].time ),
                ]);
                track_json = api_calls[0];
                track_json.endTimestamp = endTimestamp;
                track_json.firstPlace = api_calls[1];

            } else {
                track_json = await cachingTOTDProvider.getData().catch(err => embeddedErrorMessage(endpoint, err));
                track_json.firstPlace = await trackmaniaFacade.getLeaderboard(`Personal_Best/map/${track_json.mapUid}`, 1).then(response => response[0].time );
            }

            console.log(track_json);
            
            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: trackmania.embedTrackInfo(track_json),
            })
            .catch(err => embeddedErrorMessage(endpoint, err));
        }

    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
        console.log(message.interaction);
        const endpoint = `channels/${message.channel_id}/messages/${message.id}`;
        const params = data.custom_id.split(';');
        const command_queries = params[0].split('+');
        const updatePath = command_queries[0]; //no clue what to call this

        res.send({
            type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
        });

        if (updatePath === 'test') {
            log.info(message);
        }

        else if (updatePath === 'cotd') {
            const res = await trackmaniaFacade.cupOfTheDay();
            log.info(res);
        }

        else if (updatePath === 'lb') {
            log.info(params);

            const embedChangeState = command_queries[command_queries.length - 1];

            const track_json = {
                author: message.embeds[0].author.name,
                groupUid: (params[1] !== 'Personal_Best') ? revertUID(params[1]) : params[1],
                mapUid: params[2],
                endTimestamp: undefined,
            };

            if (command_queries[1] === 'totd') { track_json.endTimestamp = Number(convertNumberToBase(command_queries[2], 64, 10)); }
            let body;

            
            if (embedChangeState === 'i') { // 'i' for initialize 🤓
                const userId = message.interaction.user.id;
                const userName = message.interaction.user.username;
                const length = Number(params[3]);
                const offset = Number(params[4]);
                let getLeaderboards = [trackmaniaFacade.getLeaderboard];
                let getLeaderboardsArgs = {
                    "0": [`${track_json.groupUid}/map/${track_json.mapUid}`, length, true, offset],
                };
                let FEGens = [trackmaniaFacade.getLeaderboardInfo];
                let FEGensArgs = {};
                if (accountWatchers.hasOwnProperty(userId) && accountWatchers[userId].length > 0) {
                    const mapType = command_queries[command_queries.length-3];
                    const mapId = revertUID(command_queries[command_queries.length-2]);
                    getLeaderboards.push(trackmaniaFacade.getWatchedAccounts);
                    getLeaderboardsArgs['1'] = [accountWatchers[userId], mapId, mapType];
                    FEGens.push(trackmaniaFacade.generateLeaderboardField);
                }

                const leaderboards = await Promise.all(
                    getLeaderboards.map((e, i) => e(...getLeaderboardsArgs[i]))
                ).catch(err => embeddedErrorMessage(endpoint, err));
                track_json.leaderboard = leaderboards[0];
                FEGensArgs['0'] = [track_json, length, true, offset];
                if (leaderboards.length > 1) {
                    FEGensArgs['1'] = [{ name: `${userName}'s Watched Players`, records: leaderboards[1] }];
                }

                const FEs = await Promise.all(
                    FEGens.map((e,i) => e(...FEGensArgs[i]))
                ).catch(err => embeddedErrorMessage(endpoint, err));
                let embed = FEs[0];
                if (FEs.length > 1) {
                    embed.fields.push(FEs[1].field);
                    embed.watchedAccounts = FEs[1].players;
                }

                body = trackmania.embedLeaderboardInfo(embed);

            } else {
                let args = [];
                switch (embedChangeState) {
                    case 'p': // p for page selector
                        args = data.values[0].split(';');
                        break;
                    default:
                        args = [params[3], params[4]];
                }
                const length = Number(args[0]);
                const offset = Number(args[1]);

                const leaderboard = await trackmaniaFacade.getLeaderboard(`${track_json.groupUid}/map/${track_json.mapUid}`, length, true, offset);

                const { records, buttons, pageSelecter } = await trackmaniaFacade.updateLeaderboard(leaderboard, track_json.mapUid, track_json.groupUid, track_json.endTimestamp, length, true, offset);

                let embeds = message.embeds;
                let components = message.components;

                embeds[0].fields[0] = records.field;
                components[0].components = buttons;
                components[1].components[0].options = records.players;
                components[3] = pageSelecter;

                body = {
                    embeds: embeds,
                    components: components,
                };
            }

            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: body,
            })
            .catch(err => {
                log.error(JSON.stringify(err));
                embeddedErrorMessage(endpoint, err)
            });
        }
        
        else if (updatePath === 'track') {
            const groupUid = revertUID(params[1]);
            const mapUid = params[2];
            const isTOTD = command_queries.length > 1 && command_queries[1] === 'totd';
            const command = (isTOTD) ? `Track of the Day - ${params[3]}` : 'Map Search';
            const endTimestamp = (isTOTD) ? Number(convertNumberToBase(command_queries[2], 64, 10)) : 0;
            let track_json;
            let api_calls;
            if (isTOTD && endTimestamp > Math.floor(Date.now() / 1000)) {
                api_calls = await Promise.all([
                    cachingTOTDProvider.getData(),
                    trackmaniaFacade.getLeaderboard(`Personal_Best/map/${mapUid}`, 1).then(response => response[0].time)
                ]).catch(err => embeddedErrorMessage(endpoint, err));
            }
            else {
                api_calls = await Promise.all([
                    trackmaniaFacade.getTrackInfo(command, mapUid, groupUid),
                    trackmaniaFacade.getLeaderboard(`Personal_Best/map/${mapUid}`, 1).then(response => response[0].time)
                ]);
            }
            track_json = api_calls[0];
            track_json.firstPlace = api_calls[1];
            track_json.endTimestamp = endTimestamp;

            log.info(track_json);

            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: await trackmania.embedTrackInfo(track_json),
            })
            .catch(err => embeddedErrorMessage(endpoint, err));
        }

    }
});

const UID_LENGTH = 32;
const UID_DASH_INDICES = [0, 8, 12, 16, 20, 32];

function revertUID(UID) {
    UID = convertNumberToBase(UID, 64, 16, UID_LENGTH);
    let arr = [];
    for (let i = 1; i < UID_DASH_INDICES.length; i++)
        arr.push(UID.slice(UID_DASH_INDICES[i-1], UID_DASH_INDICES[i]));
    return arr.join('-');
}

const daily_totd = schedule.scheduleJob('0 13 * * *', async() => {
    let track_json;
    track_json = await cachingTOTDProvider.getData().catch(err => embeddedErrorMessage(endpoint, err));
    track_json.firstPlace = await trackmaniaFacade.getLeaderboard(`Personal_Best/map/${track_json.mapUid}`, 1).then(response => response[0].time );
    await DiscordRequest(`channels/${totd_channel}/messages`, {
        method: 'POST',
        body: trackmania.embedTrackInfo(track_json),
    }).catch(err => console.log(err));
});

async function embeddedErrorMessage(endpoint, err) {
    log.info(err.stack);
    try {
        await DiscordRequest(endpoint, {
            method: 'PATCH',
            body: {
                flags: InteractionResponseFlags.EPHEMERAL,
                embeds: [{
                    title: 'Error: Unable to handle request',
                    color: parseInt('ff0000', 16),
                    fields: [{
                        name: 'Reason',
                        value: `${err}`,
                    }]
                }],
                components: [{
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [{
                        type: MessageComponentTypes.BUTTON,
                        label: 'Back',
                        style: ButtonStyleTypes.PRIMARY,
                        custom_id: 'back',
                    }],
                }],
            }
        });
    } catch (error) {
        log.error(`Error sending error message: ${error}`);
    }
}


app.listen(PORT, () => {
    log.info('Listening on port', PORT);
});
