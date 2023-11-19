import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

const TEST_COMMAND = {
    name: 'test',
    description: 'basic command',
    type: 1,
};

const TRACK_OF_THE_DAY_COMMAND = {
    name: 'totd',
    description: 'track of the day',
    type: 1,
};

const CUP_OF_THE_DAY_COMMAND = {
    name: 'cotd',
    description: 'cup of the day',
    type: 1,
};

const ALL_COMMANDS = [
    TEST_COMMAND, 
    TRACK_OF_THE_DAY_COMMAND, 
    CUP_OF_THE_DAY_COMMAND
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);