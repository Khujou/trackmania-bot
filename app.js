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
import { DiscordRequest, TMRequest } from './utils.js';

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;

console.log(process.env.PASSWORD);

// Store for in-progress games. In production, you'd want to use a database
const activeGames = {};

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

        // "test" command
        if (name === 'test') {
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: 'hello world',
                },
            });
        }

        if (name === 'cotd') {
            const access_token = (await TMRequest()).accessToken;
            const cotd = await fetch('https://meet.trackmania.nadeo.club/api/cup-of-the-day/current', {
                headers: {
                    Authorization: `nadeo_v1 t=${access_token}`,
                }
            });

            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: JSON.stringify(await cotd.json()),
                },
            });
        }

    }
});

app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});