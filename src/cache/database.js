import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { setLogLevel, getLogger, logProfile } from '../log.js';

const log = getLogger();

class BaseDatabase {
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
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const columns = Object.keys(columnsJson);
        const foreignKeys = Object.keys(foreignKeysJson);
        const sqlCode = 
            `CREATE TABLE IF NOT EXISTS ${table} (
            ${ columns.map(col => `${col} ${columnsJson[col]}`).join(',') }${ (foreignKeys.length > 0) ? ',' : '' }
            ${ foreignKeys.map(fk => `FOREIGN KEY (${fk}) REFERENCES ${foreignKeysJson[fk][0]} (${foreignKeysJson[fk][1]})`).join(',') })`;
        console.log(sqlCode);
        await db.exec(sqlCode);
        db.close();
    }

    /**
     * 
     * @param {string} table 
     * @param {{pkCol: pkVal}} primaryKey 
     */
    checkIfRowExists = async (table, primaryKey) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });

        db.close();
    }
    
    /**
     * 
     * @param {Database} db 
     * @param {string} table 
     * @param {{pkCol: pkVal}} pk 
     */
    getRow = async (table, pk) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const pkName = Object.keys(pk)[0];
        const sqlCode = 
            `SELECT * FROM ${table} WHERE ${pkName} = ?`;
        const res = await db.get(sqlCode, pk[pkName]).catch(err => log.error(err));
        db.close();
        return res;
        
    }

    /**
     * sqlCode is an INSERT sql phrase with the values that you wanted inserted 
     * @param {string} table 
     * @param {{any: any}}} params
     */
    insertOrUpdateRow = async (table, paramsJson) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const params = Object.keys(paramsJson);
        if (params && params.length > 0) {
            const sqlCode = `INSERT OR REPLACE INTO ${table}(${params.join(', ')}) VALUES(${params.map(e => `$${e}`).join(', ')})`;
            log.info(sqlCode);
            await db.run(sqlCode, params.map(param => paramsJson[param]))
            .catch(err => log.error(err));
        } else {
            throw new Error('no params given');
        }
        db.close();
    }

    updateRow = async (db, table, columns, params) => {

    }

}

export class TrackmaniaDatabase extends BaseDatabase {
    constructor(databaseFilepath) {
        super(databaseFilepath);
    }

    getTOTD = async (startTimestamp) => {

    }

    getTrack = async(mapUid) => {
        const totd = await this.getRow('totd', { mapUid: mapUid });
        const track = await this.getRow('tracks', { mapUid: mapUid });
        if (totd != undefined) {
            return Object.assign(totd, track);
        }
        return track;
    }

    /**
     * 
     * @param {{}} trackJson 
     */
    insertTrack = async (trackJson) => {
        if (trackJson.hasOwnProperty('groupUid')) {
            const { mapUid, groupUid, startTimestamp, endTimestamp } = trackJson;
            await this.insertOrUpdateRow('totd', {
                mapUid: mapUid,
                groupUid: groupUid,
                startTimestamp: startTimestamp,
                endTimestamp: endTimestamp
            });
            for (const key of ['groupUid', 'startTimestamp', 'endTimestamp']) {
                delete trackJson[key];
            }
        }

        trackJson.refreshTime = Math.floor(Date.now()/1000) + 600;
        const trackKeys = Object.keys(trackJson);

        await this.insertOrUpdateRow('accounts', {
            accountUid: trackJson.accountUid,
            accountName: trackJson.authorName
        });
        await this.insertOrUpdateRow('tracks', trackJson);
    }

    updateTrack = async (trackJson) => {

    }
}

export class UsersDatabase extends BaseDatabase {
    constructor(databaseFilepath) {
        super(databaseFilepath);
    }

}