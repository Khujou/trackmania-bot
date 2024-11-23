import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

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

const ALL_COMMANDS = [
    TEST_COMMAND,
    SETTINGS,
    TRACK_OF_THE_DAY_COMMAND,
    TUCKER
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);