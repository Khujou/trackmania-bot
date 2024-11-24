import * as winston from 'winston';

let logLevel = 'info';

export function setLogLevel(level) {
    logLevel = level;
}

/**
 * Configure logging. Usage in your code:
 * 
 *   import { setLogLevel, getLogger } from './log.js';
 *
 *   setLogLevel('info'); // once on app startup
 *   const log = getLogger();
 *   log.info('what the dog doin?'); // shown
 *   log.debug('idk'); // not shown
 * 
 * https://www.npmjs.com/package/winston#usage
 */
export function getLogger() {
    const log = winston.createLogger({
        level: logLevel,
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp(),
            winston.format.printf((log) => {
                let msg = `${log.timestamp} [${log.level}] ${log.message}`;
                if (log.stack) {
                    msg += `- ${log.stack}`;
                }
                return msg;
            }),
        ),
        transports: [
            new winston.transports.Console(),
        ],
    });
    return log;
}
