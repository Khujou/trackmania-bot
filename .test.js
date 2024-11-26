const baseConversion = require('./baseConversion.js');

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
    }
]

BASE_CONVERSION_TESTS.forEach(e => {
    test(`Converts ${e.str} from Base-${e.startBase} to Base-${e.changeBase} then back to Base-${e.startBase}, becoming ${e.str} again.`, () => {
        expect(baseConversion.baseConversion(e.str, e.startBase, e.changeBase, e.padToLen)).toBe(e.str);
    });
});
