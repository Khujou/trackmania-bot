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
import { DiscordRequest, convertNumberToBase } from './utils.js';
import { MongoClient, ServerApiVersion } from 'mongodb';
import * as fs from 'fs';
import { setLogLevel, getLogger, logProfile } from './log.js';
const uri = process.env.MONGODB_URI;

setLogLevel('info');
const log = getLogger();

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

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

console.log(await trackmaniaFacade.trackOfTheDay());

// Returns up-to-date TOTD info. Checks if stored TOTD info is out of date and replaces with up-to-date info.
const cachingTOTDProvider = new trackmania.FileBasedCachingJSONDataProvider('totd.json',
    undefined,
    (trackInfo) => trackInfo.endTimestamp < (Math.floor(Date.now() / 1000)),
    () => trackmaniaFacade.trackOfTheDay());
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

            let track_json = null;
            const totdDate = new Date();
            if (options[0].name === 'past') {
                const fields = options[0].options;
                let inputDate = new Date(fields[0].value, fields[1].value - 1, fields[2].value);
                if (inputDate > totdDate)
                    inputDate = totdDate;
                else if (inputDate < startDate)
                    embeddedErrorMessage(endpoint, Error('Date given is before Trackmania came out, silly :)'));

                track_json = await trackmaniaFacade.trackOfTheDay(inputDate).catch(err => embeddedErrorMessage(endpoint, err));
            } else {
                log.debug('about to open file');
                track_json = await cachingTOTDProvider.getData().catch(err => embeddedErrorMessage(endpoint, err));
                log.debug('finished file ops');
            }

            log.debug(track_json);
            
            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: await trackmania.embedTrackInfo(trackmaniaFacade.liveService, track_json),
            })
            .catch(err => embeddedErrorMessage(endpoint, err));
        }

    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
        const componentId = data.custom_id;
        const endpoint = `channels/${message.channel_id}/messages/${message.id}`;
        const args = componentId.split(';');

        res.send({
            type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
        });

        if (args[0] === 'test') {
            log.info(message);
        }

        else if (args[0] === 'cotd') {
            const res = await trackmaniaFacade.cupOfTheDay();
            log.info(res);
        }

        else if (args[0].slice(0,2) === 'lb') {
            log.info(args);
            let groupUid = args[1];
            if (groupUid !== 'Personal_Best') {
                groupUid = revertUID(groupUid);
            }

            const track_info = {
                author: message.embeds[0].author.name,
                groupUid: groupUid,
                mapUid: args[2],
            };

            const lbargs = args[0].split('+');
            if (lbargs[1] ==='totd') {
                track_info.endTimestamp = Number(convertNumberToBase(lbargs[2], 64, 10));
            }
            if (lbargs[lbargs.length - 1] === 'f') {
                args.push(0);
            } else if (lbargs[lbargs.length - 1] === 'l') {
                args.push(1000-args[3]);
            } else if (lbargs[lbargs.length - 1] === 'p') {
                data.values[0].split(';').forEach((e) => {
                    args.push(e);
                });
            }

            const lb_info = await trackmaniaFacade.getLeaderboardInfo(track_info, args[3], true, args[4]);

            log.info(args);



            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: trackmania.embedLeaderboardInfo(lb_info),
            })
            .catch(err => {
                log.error(JSON.stringify(err));
                embeddedErrorMessage(endpoint, err)
            });
        }
        
        else if (args[0].slice(0, 5) === 'track') {
            const targs = args[0].split('+');
            console.log(targs);
            console.log(args);
            const groupUid = revertUID(args[1]);
            let command;
            let track_info;
            if (targs[1] === 'totd') { 
                command = `Track of the Day - ${args[3]}`;
                if (Number(convertNumberToBase(targs[2], 64, 10)) > Math.floor(Date.now() / 1000)) 
                    track_info = await cachingTOTDProvider.getData().catch(err => embeddedErrorMessage(endpoint, err));
                else track_info = await trackmaniaFacade.getTrackInfo(command, args[2], groupUid).catch(err => embeddedErrorMessage(endpoint, err));
            }
            else { 
                command = 'Map Search';
                track_info = await trackmaniaFacade.getTrackInfo(command, args[2], groupUid).catch(err => embeddedErrorMessage(endpoint, err));
            }

            log.info(track_info);

            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: await trackmania.embedTrackInfo(trackmaniaFacade.liveService, track_info),
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
    await DiscordRequest(`channels/${totd_channel}/messages`, {
        method: 'POST',
        body: await trackmaniaFacade.trackOfTheDay(),
    });
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
