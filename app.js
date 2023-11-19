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
import { DiscordRequest } from './utils.js';
import { trackmaniaCommands } from './trackmania.js';

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

        try {
            return trackmaniaCommands(req, res, data);
        } catch (err) {
            console.error(err);
        }

    }
});

app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});