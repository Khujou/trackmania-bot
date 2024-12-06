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
import { TrackmaniaDatabase, UsersDatabase } from './cache/database.js';
import { setLogLevel, getLogger, logProfile } from './log.js';

setLogLevel('info');
const log = getLogger();

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

const testing = new TestingClass();
const trackmaniaBot = new TrackmaniaBotFunctions();
const usersDB = new UsersDatabase('src/cache/dbs/discordUsers.db');
const trackmaniaDB = new TrackmaniaDatabase('src/cache/dbs/trackmania.db');

console.log(usersDB.databaseFilepath);

await usersDB.createTable('users', {
    discordUserId: 'INTEGER PRIMARY KEY NOT NULL',
});

await trackmaniaDB.createTable('accounts', {
    accountUid: 'TEXT PRIMARY KEY NOT NULL',
    accountName: 'TEXT NOT NULL',
    accountNameTMX: 'TEXT',
});

await trackmaniaDB.createTable('tracks', {
    mapUid: 'TEXT PRIMARY KEY NOT NULL',
    mapId: 'TEXT NOT NULL',
    mapName: 'TEXT NOT NULL',
    authorName:'TEXT NOT NULL',
    accountUid: 'TEXT NOT NULL',
    thumbnail: 'TEXT NOT NULL',
    provision: 'TEXT NOT NULL',
    mapType: 'TEXT NOT NULL',
    authorTime: 'INTEGER NOT NULL',
    goldTime: 'INTEGER NOT NULL',
    silverTime: 'INTEGER NOT NULL',
    bronzeTime: 'INTEGER NOT NULL',
    tags: 'TEXT',
    website: 'TEXT',
    styleName: 'INTEGER',
    refreshTime: 'INTEGER',
}, {
    accountUid: ['accounts', 'accountUid'],
});

await trackmaniaDB.createTable('totd', {
    mapUid: 'TEXT PRIMARY KEY NOT NULL',
    groupUid: 'TEXT NOT NULL',
    startTimestamp: 'INTEGER NOT NULL',
    endTimestamp: 'INTEGER NOT NULL',
});

await trackmaniaDB.insertTrack({
    mapName: 'Formula E - São Paulo E-Prix',
    authorName: 'florenzius_',
    accountUid: '73eba009-a074-4439-916f-d25d7fa7bc1c',
    authortime: 56264,
    goldtime: 60000,
    silverTime: 68000,
    bronzeTime: 85000,
    tags: 'not available',
    website: null,
    stylename: 0,
    thumbnail: 'https://core.trackmania.nadeo.live/maps/3ccc7a5c-5040-452d-acff-45aa9cddd732/thumbnail.jpg',
    groupUid: 'cc1004c0-3bcd-41f9-a1fd-e09f80df7e54',
    mapUid: 'xNv75plrEXTqMQmsBbrsoVjnAA8',
    mapId: '3ccc7a5c-5040-452d-acff-45aa9cddd732',
    provision: 'Map UID: xNv75plrEXTqMQmsBbrsoVjnAA8\nProvided by Nadeo',
    mapType: 'Race',
    startTimestamp: 1733335200,
    endTimestamp: 1733421600,
});

console.log(await trackmaniaDB.getTrack('xNv75plrEXTqMQmsBbrsoVjnAA8')); //returns json
console.log(await trackmaniaDB.getTrack('5L9z1oBNibL2F6rbozHI5wp_5el')); //returns undefined


const accountWatchers = {
    '205541764206034944': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
    '500722458056327196': ['c3ed703f-8a07-49c7-a3b3-06713f548142'],
};
const TOTD_TIME = new Date(Date.UTC(0, 0, 0, 18));

const debugData = await logProfile(log, 'GetCachedTmData', () => trackmaniaBot.track.cachingTOTDProvider.getData());
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
