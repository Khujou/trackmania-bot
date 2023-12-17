import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

const TEST_COMMAND = {
    name: 'test',
    description: 'basic command',
    type: 1,
};

const SEARCH_MAP = {
    name: 'search',
    description: 'give filters to search for map on trackmania.exchange',
    type: 1,
    options: [{
        name: 'a',
        description: 'a',
        type: 3,
    },{
        name: 'b',
        description: 'b',
        type: 3,
    }],
};

const TRACK_OF_THE_DAY_COMMAND = {
    name: 'totd',
    description: 'track of the day',
    type: 1,
    options: [{
        name: 'month',
        description: 'number of months ago that you want the month of the totds, goes up to 12 months ago',
        type: 4,
        min_value: 0,
        max_value: 12,
    }],
};

const ALL_COMMANDS = [
    TEST_COMMAND,
    SEARCH_MAP,
    TRACK_OF_THE_DAY_COMMAND,
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);