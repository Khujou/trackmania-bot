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
import sqlite3 from 'sqlite3';
import { TestingClass, TrackmaniaBotFunctions } from './commands/commandFunctions.js';
import { DiscordRequest } from './utils.js';
import { setLogLevel, getLogger, logProfile } from './log.js';

setLogLevel('info');
const log = getLogger();

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

const Testing = new TestingClass();
const TrackmaniaBot = new TrackmaniaBotFunctions();

const accountWatchers = {
    '205541764206034944': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
    '500722458056327196': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
};
const TOTD_TIME = new Date(Date.UTC(0, 0, 0, 18));

const debugData = await logProfile(log, 'GetCachedTmData', () => TrackmaniaBot.track.cachingTOTDProvider.getData());
log.info(JSON.stringify(debugData));

const totdChannels = ['1183478764856942642',
    '1313152767820566598'];

checkIfTOTDPostedToday(totdChannels[0]);

const fetchTOTDDaily = schedule.scheduleJob(`0 ${TOTD_TIME.getHours()} * * *`, async() => {
    do {

    } while (false)
});

const sendTOTDDaily = schedule.scheduleJob(`1 ${TOTD_TIME.getHours()} * * *`, async() => {
    const embeddedTotd = await TrackmaniaBot.track.getAndEmbedTrackInfo(TrackmaniaBot.track.cachingTOTDProvider.getData);
    for (const totdChannel of totdChannels) {
        await DiscordRequest(`channels/${totdChannel}/messages`, {
            method: 'POST',
            body: embeddedTotd,
        }).catch(err => console.error(err));
    };
    
});

app.get('/', (req, res) => {
    res.send('whats up');
});

// Interactions endpoint URL where Discord will send HTTP requests
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
    // Interaction type and data
    const { type, id, data, token, message, member } = req.body;
    const C_endpoint = `webhooks/${process.env.APP_ID}/${token}`;
    const RUD_endpoint = `${C_endpoint}/messages/@original`;

    // Handle verification requests
    if (type === InteractionResponseType.PING) {
        return res.send({ type: InteractionResponseType.PONG});
    }

    // Handle slash command requests
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data;

        switch (name) {
            case 'test':
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: Testing.testEmbed(),
                });

                break;
            case 'tucker':
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: Testing.tuckerEmbed(),
                });

                break;
            case 'totd':
                res.send({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        flags: InteractionResponseFlags.EPHEMERAL,
                    }
                });

                await DiscordRequest(RUD_endpoint, {
                    method: 'PATCH',
                    body: await TrackmaniaBot.track.commandTOTD(options),
                })
                .catch(err => embeddedErrorMessage(RUD_endpoint, 'PATCH', err));

                break;
            default:
                res.send({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        flags: InteractionResponseFlags.EPHEMERAL,
                    }
                });
                embeddedErrorMessage(RUD_endpoint, 'PATCH', new Error('Not yet implemented'));
        }

    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
        const postendpoint = `channels/${message.channel_id}/messages`;
        const endpoint = `${postendpoint}}/${message.id}`;
        const params = data.custom_id.split(';');
        const command_queries = params[0].split('+');
        const updatePath = command_queries[0]; //no clue what to call this

        switch(updatePath) {
            case 'test':
                console.log(data);
                res.send({
                    type: InteractionResponseType.UPDATE_MESSAGE,
                    data: {
                        content: 'test',
                    }
                });

                break;
            case 'cotd':
                //const res = await trackmaniaFacade.cupOfTheDay();
                //log.info(res);

                break;
            case 'lb':
                const embedChangeState = command_queries[command_queries.length - 1];

                const endpoints = [RUD_endpoint, C_endpoint];
                const methods = ['PATCH', 'POST'];
                let method = 0;

                switch (embedChangeState) {
                    case 'i':
                        res.send({
                            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                            data: { flags: InteractionResponseFlags.EPHEMERAL, },
                        });
                        method = 1;
                        break;
                    default:
                        res.send({
                            type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
                        });
                }
                
        
                await DiscordRequest(endpoints[method], {
                    method: methods[method],
                    body: await TrackmaniaBot.leaderboard.buttonGetLeaderboard(data, message, member, params, command_queries, embedChangeState, accountWatchers),
                })
                .catch(err => {
                    log.error(err);
                    embeddedErrorMessage(endpoints[method], methods[method], err)
                });

                break;
            case 'track':
                res.send({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { flags: InteractionResponseFlags.EPHEMERAL, },
                });
    
                await DiscordRequest(C_endpoint, {
                    method: 'POST',
                    body: await TrackmaniaBot.track.buttonGetTrackInfo(params, command_queries),
                })
                .catch(err => embeddedErrorMessage(C_endpoint, 'POST', err));
                
                break;
            default:
                break;
        }

    }
});

async function embeddedErrorMessage(endpoint, method = 'POST', err) {
    log.info(err.stack);
    await DiscordRequest(endpoint, {
        flags: InteractionResponseFlags.EPHEMERAL,
        method: method,
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
    }).catch((error) => log.error(`Error sending error message: ${error}`));
}

function checkIfTOTDPostedToday(announcementChannel) {

}

app.listen(PORT, () => {
    log.info('Listening on port', PORT);
});
