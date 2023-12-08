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
import { convertMillisecondsToFormattedTime as convertMS } from './utils.js';
import * as trackmania from './trackmania.js';

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

// Interactions endpoint URL where Discord will send HTTP requests
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
    // Interaction type and data
    const { type, id, data } = req.body;

    // Handle verification requests
    if (type === InteractionResponseType.PING) {
        return res.send({ type: InteractionResponseType.PONG});
    }

    // Handle slash command requests
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;
        const core_service = new trackmania.CoreService();
        const live_service = new trackmania.LiveService();
        const meet_service = new trackmania.MeetService();

        // "test" command
        if (name === 'test') {
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
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
                },
            });
        }

        if (name === 'totd') {
            /**
             * Obtain track of the day information, then display the track name, 
             * the track author, the track thumbnail, the times for the medals,
             * the style of the track (using trackmania.exchange), and the leaderboard.
             */
            const track_of_the_day = await live_service.trackOfTheDay();
            const nadeo_map_info = (await core_service.getMapInfo(null, track_of_the_day.mapUid))[0];
            //const author_name = await trackmania.fetchAccountName(nadeo_map_info.author);
            const mx_map_info = await trackmania.fetchManiaExchange(`/api/maps/get_map_info/uid/${track_of_the_day.mapUid}`);
    
            const medalTimes = `:medal: Author Time: \t ${convertMS(nadeo_map_info.authorScore)}` +
                `\n:first_place: Gold Time: \t ${convertMS(nadeo_map_info.goldScore)}` +
                `\n:second_place: Silver Time: \t ${convertMS(nadeo_map_info.silverScore)}` +
                `\n:third_place: Bronze Time: \t ${convertMS(nadeo_map_info.bronzeScore)}`;

            let map_tags = mx_map_info.Tags.split(',');
            for (let i = 0; i < map_tags.length; i++) {
                map_tags[i] = trackmania.map_tags[parseInt(map_tags[i]) - 1].Name;
            };

            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    embeds: [{
                        title: 'Track of the Day',
                        color: 69420,
                        fields: [{
                            name: 'Map',
                            value: mx_map_info.Name,
                            inline: true,
                        },{
                            name: 'Difficulty',
                            value: mx_map_info.DifficultyName,
                            inline: true,
                        },{
                            name: 'Author',
                            value: mx_map_info.Username,
                        },{
                            name: 'Medal Times',
                            value: medalTimes,
                            inline: true,
                        },{
                            name: 'Map Tags',
                            value: JSON.stringify(map_tags),
                            inline: true,
                        },
                        ],
                        image: {
                            url: nadeo_map_info.thumbnailUrl,
                            height: 100,
                            width: 100,
                        },
                    },],
                },
            });
        }
    
        if (name === 'cotd') {
            /**
             * Obtain cup of the day information, then display the info regarding 
             * what map it's played on, as well as the competition and challenges.
             */
            const cotd_info = await meet_service.cupOfTheDay();
    
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "```" + 
                    JSON.stringify(cotd_info, null, 2) + 
                    "```",
                },
            });
        }

    }
});

app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});