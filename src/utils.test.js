import { jest } from '@jest/globals';
import { convertNumberToBase } from "./utils";


const BASE_CONVERSION_TESTS = [{
        str: '64',
        startBase: 10,
        changeBase: 64,
        padToLen: 0,
    },{
        str: 'ff',
        startBase: 16,
        changeBase: 10,
        padToLen: 0,
    },{
        str: '010101',
        startBase: 2,
        changeBase: 10,
        padToLen: 6,
    },{
        str: '000Z0_0zz00z',
        startBase: 64,
        changeBase: 10,
        padToLen: 12,
    },{
        str: 'ffffffffffffffffffffffffffffffff',
        startBase: 16,
        changeBase: 64,
        padToLen: 32,
    },{
        str: 'd567dcf11477449b935707be76662dbd',
        startBase: 16,
        changeBase: 64,
        padToLen: 32,
    }
]

const baseConversion = jest.fn( (str, startBase, changeBase, targetLen = 0) => {
    let res = convertNumberToBase(str, startBase, changeBase);
    console.log(res);
    res = convertNumberToBase(res, changeBase, startBase, targetLen);
    console.log(res);
    return res;
});

BASE_CONVERSION_TESTS.forEach(e => {
    test(`Converts ${e.str} from Base-${e.startBase} to Base-${e.changeBase} then back to Base-${e.startBase}, becoming ${e.str} again.`, () => {
        expect(baseConversion(e.str, e.startBase, e.changeBase, e.padToLen)).toBe(e.str);
    });
});
