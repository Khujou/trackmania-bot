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
            name: 'accountId',
            description: 'accountId',
            type: 4,
            required: true,
        }],
    },{
        name: 'map',
        description: 'Get information for a Map using its mapId',
        type: 1,
        options: [{
            name: 'mapId',
            description: 'mapId',
            type: 4,
            required: true,
        }],
    }],
}

const TRACK_OF_THE_DAY_COMMAND = {
    name: 'totd',
    description: 'track of the day command',
    type: 1,
    options: [{
        name: 'today',
        description: 'Get today\'s Track of the Day',
        type: 1,
    },{
        name: 'past',
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