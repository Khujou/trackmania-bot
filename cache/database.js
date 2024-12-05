import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { setLogLevel, getLogger, logProfile } from '../log.js';

const log = getLogger();

class Database {
    constructor(databaseFilepath) {
        this.databaseFilepath = databaseFilepath;

    }

    /**
     * 
     * @param {string} table 
     * @param {{col: type}} columnsJson
     * @param {{col: [otherTable, pk]}} foreignKeysJson
     */
    createTable = async (table, columnsJson, foreignKeysJson = {}) => {
        const db = new sqlite3.Database(this.databaseFilepath);
        const columns = Object.keys(columnsJson);
        const foreignKeys = Object.keys(foreignKeysJson);
        const sqlCode = 
            `CREATE TABLE IF NOT EXISTS ${table} (
            ${ columns.map(col => `${col} ${columnsJson[col]}`).join(',\n\t') }
            ${ (foreignKeys.length > 0) ? ',' : '' }
            ${ foreignKeys.map(fk => `FOREIGN KEY (${fk}) REFERENCES ${foreignKeysJson[fk][0]} (${foreignKeysJson[fk][1]})`).join(',\n\t') }
            )`;
        db.exec(sqlCode, (sql, err) => { (sql != null) ? log.info(sql) : ''; (err != undefined) ? log.error(err) : '' });
        db.close();
    }

    checkIfRowExists = async (db, table, primaryKey) => {

    }

    /**
     * sqlCode is an INSERT sql phrase with the values that you wanted inserted 
     * @param {sqlite3.Database} db
     * @param {string} table 
     * @param {string[]} columns 
     * @param {any[]} params
     */
    insertOrUpdateRow = async (db, table, columns, params) => {
        if (params && params.length > 0) {
            const sqlCode = `INSERT OR REPLACE INTO ${table}(${columns.join(', ')}) VALUES(${columns.map(e => '?').join(', ')})`;
            log.info(sqlCode);
            db.run(sqlCode, params, err => (err != undefined) ? log.error(err) : '');
        } else {
            throw new Error('no params given');
        }
    }

    updateRow = async (db, table, columns, params) => {

    }

    getRow = async (db, table) => {
        // const rowJson = get row whatever


    }

}

export class TrackmaniaDatabase extends Database {
    constructor(databaseFilepath) {
        super(databaseFilepath);
    }

    /**
     * 
     * @param {*} trackJson 
     */
    insertTrack = async (trackJson) => {
        const db = new sqlite3.Database(this.databaseFilepath);

        if (trackJson.hasOwnProperty('groupUid')) {
            const { mapUid, groupUid, startTimestamp, endTimestamp } = trackJson;
            await this.insertOrUpdateRow(db, 'totd', ['mapUid', 'groupUid', 'startTimestamp', 'endTimestamp'], [mapUid, groupUid, startTimestamp, endTimestamp]);
            for (const key of ['groupUid', 'startTimestamp', 'endTimestamp']) {
                delete trackJson[key];
            }
        }

        trackJson.refreshTime = Math.floor(Date.now()/1000) + 600;
        const trackKeys = Object.keys(trackJson);

        await this.insertOrUpdateRow(db, 'accounts', ['accountUid', 'accountName'], [trackJson.accountUid, trackJson.authorName]);
        await this.insertOrUpdateRow(db, 'tracks', trackKeys, trackKeys.map(e => trackJson[e]));
        db.close();
    }

    updateTrack = async (trackJson) => {

    }
}

export class UsersDatabase extends Database {
    constructor(databaseFilepath) {
        super(databaseFilepath);
    }

}