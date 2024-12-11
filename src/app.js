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
import { TestingClass, TrackmaniaBotFunctions } from './commands/commandFunctions.js';
import { DiscordRequest } from './utils.js';
import { getDatabaseFacade } from './cache/database.js';
import { setLogLevel, getLogger, logProfile } from './log.js';

setLogLevel('info');
const log = getLogger();

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

const testing = new TestingClass();
const trackmaniaBot = new TrackmaniaBotFunctions();
const databaseFacade = await getDatabaseFacade();

log.info('hi hi hi ');

let track;

track = await logProfile(log, 'GetCachedDBData', async() => await databaseFacade.trackmaniaDB.getTrack('lbytViu4krWqqid5fhP4S80plz1')); //returns json
console.log(track);
track = await logProfile(log, 'GetCachedDBData', async() => await databaseFacade.trackmaniaDB.getTrack('5L9z1oBNibL2F6rbozHI5wp_5el')); //returns undefined
console.log(track);

track = await logProfile(log, 'GetCachedDBData', async() => await databaseFacade.trackmaniaDB.getTOTD(new Date(2024, 11, 10))); //return json
console.log(track);
track = await logProfile(log, 'GetCachedDBData', async() => await databaseFacade.trackmaniaDB.getTOTD(new Date(2024, 11, 5))); //return undefined
console.log(track);

const accountWatchers = {
    '205541764206034944': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
    '500722458056327196': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
};
const TOTD_TIME = new Date(Date.UTC(0, 0, 0, 18));

const debugData = await logProfile(log, 'GetCachedTmData', async() => await trackmaniaBot.track.cachingTOTDProvider.getData());
log.info(JSON.stringify(debugData));

const totdChannels = ['1183478764856942642',
    '1313152767820566598'];

checkIfTOTDPostedToday(totdChannels[0]);

const sendTOTDDaily = schedule.scheduleJob(`1 ${TOTD_TIME.getHours()} * * *`, async() => {
    const embeddedTotd = await trackmaniaBot.track.getAndEmbedTrackInfo(trackmaniaBot.track.cachingTOTDProvider.getData);
    for (const totdChannel of totdChannels) {
        await DiscordRequest(`channels/${totdChannel}/messages`, {
            method: 'POST',
            body: embeddedTotd,
        }).catch(err => log.error(err));
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
                    data: testing.testEmbed(),
                });

                break;
            case 'tucker':
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: testing.tuckerEmbed(),
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
                    body: await trackmaniaBot.track.commandTOTD(options),
                })
                .catch(err => embeddedErrorMessage(RUD_endpoint, 'PATCH', err));

                break;
            case 'search':
                res.send({
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        flags: InteractionResponseFlags.EPHEMERAL,
                    }
                });

                const commandSpec = options[0];
                const fields = commandSpec.options;
                let body;

                switch(commandSpec.name) {
                    case 'account':

                        break;
                    case 'map':
                        body = await trackmaniaBot.track.commandSearchTrack(fields[0].value);

                        break;
                    case 'totd':
                        body = await trackmaniaBot.track.commandSearchTOTD(new Date(fields[0].value, fields[1].value - 1, fields[2].value));

                        break;
                    default:
                        embeddedErrorMessage(RUD_endpoint, 'PATCH', new Error('Not yet implemented'));
                }

                await DiscordRequest(RUD_endpoint, {
                    method: 'PATCH',
                    body: body
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
                    body: await trackmaniaBot.leaderboard.buttonGetLeaderboard(data, message, member, params, command_queries, embedChangeState, accountWatchers),
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
                    body: await trackmaniaBot.track.buttonGetTrackInfo(params, command_queries),
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
