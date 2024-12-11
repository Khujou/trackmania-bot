import 'dotenv/config';
import { InstallGlobalCommands, InstallGuildCommands } from '../utils.js';

console.log('Running npm run register');

const TEST_COMMAND = {
    name: 'test',
    description: 'basic command',
    type: 1,
};

const SETTINGS = {
    name: 'settings',
    description: 'settings command',
    type: 1,
};

const SEARCH = {
    name: 'search',
    description: 'search command',
    type: 1,
    options: [{
        name: 'account',
        description: 'Get information for a Trackmania Account using their accountId',
        type: 1,
        options: [{
            name: 'uid',
            description: 'uid of the account',
            type: 3,
            required: true,
        }],
    },{
        name: 'map',
        description: 'Get information for a Map using its mapUid',
        type: 1,
        options: [{
            name: 'uid',
            description: 'uid of the map',
            type: 3,
            required: true,
            min_length: 27,
            max_length: 27,
        }],
    },{
        name: 'totd',
        description: 'Input a date to get a specific Track of the Day',
        type: 1,
        options: [{
            name: 'year',
            description: 'year',
            type: 4,
            required: true,
            min_value: 2020,
        },{
            name: 'month',
            description: 'month',
            type: 4,
            required: true,
            min_value: 1,
            max_value: 12,
        },{
            name: 'day',
            description: 'day',
            type: 4,
            required: true,
            min_value: 1,
            max_value: 31,
        },]
    }],
}

const TRACK_OF_THE_DAY_COMMAND = {
    name: 'totd',
    description: 'Get the current Track of the Day',
    type: 1,
};

const TUCKER = {
    name: 'tucker',
    description: 'besto furendo',
    type: 1,
}

const GLOBAL_COMMANDS = [
    SETTINGS,
    SEARCH,
    TRACK_OF_THE_DAY_COMMAND
];

const GUILD_COMMANDS = [
    TEST_COMMAND,
    TUCKER
];

InstallGlobalCommands(process.env.APP_ID, GLOBAL_COMMANDS);
InstallGuildCommands(process.env.APP_ID, process.env.TEST_SERVER_ID, GUILD_COMMANDS);