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
import { DiscordRequest } from './utils.js';

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

const core_service = new trackmania.CoreService();
const live_service = new trackmania.LiveService();
const meet_service = new trackmania.MeetService();

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
        const { name } = data;
        const endpoint = `webhooks/${process.env.APP_ID}/${token}/messages/@original`;

        if (name ==='tucker') {
            res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: {
                    content: 'i miss him <@203284058673774592>'
                }
            });
        }

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
                    },],
                    components: [{
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [{
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
            })
        } 
        else if (name === 'totd') {
            console.log(req.body);
            res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            try {
                await DiscordRequest(endpoint, {
                    method: 'PATCH',
                    body: await trackmania.trackOfTheDay(core_service, live_service),
                });
            } catch (err) {
                await DiscordRequest(endpoint, {
                    method: 'PATCH',
                    body: {
                        content: `Unable to complete request: ${err.stack}`,
                    }
                });
            }
        }

    }
    if (type === InteractionType.MESSAGE_COMPONENT) {
        const componentId = data.custom_id;

        if (componentId === 'cotd_button') {
            const endpoint = `channels/${message.channel_id}/messages/${message.id}`;

            try {
                await DiscordRequest(endpoint, { 
                    method: 'PATCH',
                    body: {
                        content: 'epic failure this feature doesnt exist yet lolol',
                        embeds: [],
                        components: [{
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [{
                                type: MessageComponentTypes.BUTTON,
                                style: ButtonStyleTypes.PRIMARY,
                                label: 'Track of the Day',
                                custom_id: 'totd_button',
                                emoji: {
                                    id: null,
                                    name: '📋',
                                },
                            },],
                        },],
                    },
                });
            } catch (err) {
                console.error(`Error sending message: ${err}`);
            }
        } else if (componentId === 'totd_button') {
            const endpoint = `channels/${message.channel_id}/messages/${message.id}`;

            try {
                await DiscordRequest(endpoint, {
                    method: 'PATCH',
                    body: await trackmania.trackOfTheDay(core_service, live_service, InteractionResponseFlags.EPHEMERAL),
                });
            } catch (err) {
                console.error(`Error sending message: ${err}`);
            }
        }
    }
});

const daily_totd = schedule.scheduleJob('0 13 * * *', async() => {
    await DiscordRequest(`channels/${totd_channel}/messages`, {
        method: 'POST',
        body: await trackmania.trackOfTheDay(core_service, live_service),
    });
});


app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});