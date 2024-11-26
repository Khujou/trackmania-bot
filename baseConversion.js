const BASE64_CHARS = '0123456789abcdef-ghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';

/**
 * Function that converts a number from up to Base-64 to a decimal
 * @param {string} str
 * @param {string} base Base in which you're converting from
 * @returns {BigInt}
 */
function convertToDecimal(str, base) {
    let res = 0n;

    for (let i = 0; i < str.length; i++) {
        const char = str[str.length - 1 - i];
        const digitVal = BASE64_CHARS.indexOf(char);

        res += BigInt(digitVal) * (BigInt(base) ** BigInt(i));
    }

    return res;
}

/**
 * 
 * @param {string} str str of number of up to base64
 * @param {number} fromBase
 * @param {number} toBase
 * @param {number} [targetLen=0] length of string that will be spit out. Start is padded with 0s.
 * @returns {string}
 */
function convertNumberToBase(str, fromBase, toBase, targetLen = 0) {
    const bigBase = BigInt(toBase);
    let bigInt = convertToDecimal(str, fromBase);
    let res = '';
    while (bigInt > 0n) {
        res = BASE64_CHARS[Number(bigInt % bigBase)] + res;
        bigInt /= bigBase;
    }

    return res.padStart(targetLen, '0');
}

/**
 * 
 * @param {*} str 
 * @param {*} startBase 
 * @param {*} changeBase 
 * @param {*} targetLen 
 * @returns 
 */
function baseConversion(str, startBase, changeBase, targetLen = 0) {
    const res = convertNumberToBase(str, startBase, changeBase);
    return convertNumberToBase(res, changeBase, startBase, targetLen);
}

module.exports = { 
    convertNumberToBase: convertNumberToBase, 
    baseConversion: baseConversion 
};