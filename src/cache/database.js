import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { setLogLevel, getLogger, logProfile } from '../log.js';

const log = getLogger();

class BaseDatabase {
    /**
     * 
     * @param {string} databaseFilepath filepath of db starting from root folder of project
     */
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
        await db.exec(sqlCode);
        db.close();
    }

    /**
     * 
     * @param {string} table 
     * @param {{col: val}} key 
     */
    checkRow = async (table, key) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const col = Object.keys(key);
        const sqlCode = 
            `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${col}=?)`;
        const res = await db.get(sqlCode, key[col]);
        db.close();
        const reskey = Object.keys(res);
        return Boolean(res[reskey[0]]);
    }
    
    /**
     * 
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
     * @param {{any: any}} cols
     */
    insertRow = async (table, cols) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const params = Object.keys(cols);
        if (params && params.length > 0) {
            const sqlCode = `INSERT INTO ${table}(${params.join(', ')}) VALUES(${params.map(e => `$${e}`).join(', ')})`;
            await db.run(sqlCode, params.map(param => cols[param]))
            .catch(err => log.error(err));
        }
        db.close();
    }

    /**
     * 
     * @param {string} table 
     * @param {{col: val}} pk
     * @param {{col: val}} cols 
     */
    updateRow = async (table, pk, cols) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const pkCol = Object.keys(pk);
        const setCol = Object.keys(cols);
        if (setCol && setCol.length > 0) {
            const sqlCode = `UPDATE ${table} SET ${ setCol.map(col => `${col} = >`).join(', ') } WHERE ${pkCol} = ?`;
            await db.run(sqlCode, setCol.map(col => cols[col]). pk[pkCol])
            .catch(err => log.error(err));
        }
        db.close();
    }

}

class TrackmaniaDatabase extends BaseDatabase {
    constructor(databaseFilepath) {
        super(databaseFilepath);

    }

    setUpTables = async () => {
        await this.createTable('accounts', {
            accountUid: 'TEXT PRIMARY KEY NOT NULL',
            accountName: 'TEXT NOT NULL',
            accountNameTMX: 'TEXT',
        });
        
        await this.createTable('tracks', {
            mapUid: 'TEXT PRIMARY KEY NOT NULL',
            mapId: 'TEXT NOT NULL',
            mapName: 'TEXT NOT NULL',
            accountName:'TEXT NOT NULL',
            accountUid: 'TEXT NOT NULL',
            thumbnail: 'TEXT NOT NULL',
            mapType: 'TEXT NOT NULL',
            authorTime: 'INTEGER NOT NULL',
            goldTime: 'INTEGER NOT NULL',
            silverTime: 'INTEGER NOT NULL',
            bronzeTime: 'INTEGER NOT NULL',
            refreshTime: 'INTEGER',
        }, {
            accountUid: ['accounts', 'accountUid'],
        });
        
        await this.createTable('tmxtracks', {
            mapUid: 'TEXT PRIMARY KEY NOT NULL',
            tags: 'TEXT NOT NULL',
            website: 'TEXT NOT NULL',
            styleName: 'INTEGER NOT NULL',
        }, {
            mapUid: ['tracks', 'mapUid'],
        });
        
        await this.createTable('totd', {
            mapUid: 'TEXT PRIMARY KEY NOT NULL',
            groupUid: 'TEXT NOT NULL',
            startTimestamp: 'INTEGER NOT NULL',
            endTimestamp: 'INTEGER NOT NULL',
        }, {
            mapUid: ['tracks', 'mapUid'],
        });
    }

    getTOTD = async (date = new Date()) => {
        date.setUTCHours(18);
        const timestamp = Math.floor(date.valueOf()/1000);
        const totd = await this.getRow('totd', { startTimestamp: timestamp }).catch(err => log.error(`Unable to complete operation - ${err}`));
        if (totd !== undefined) {
            const track = await this.getRow('tracks', { mapUid: totd.mapUid }).catch(err => log.error(`Unable to complete operation - ${err}`));
            return Object.assign(totd, track);
        }
        return undefined;
    }

    getTrack = async(mapUid) => {
        const totd = await this.getRow('totd', { mapUid: mapUid }).catch(err => log.error(`Unable to complete operation - ${err}`));
        const track = await this.getRow('tracks', { mapUid: mapUid }).catch(err => log.error(`Unable to complete operation - ${err}`));
        if (totd !== undefined) {
            return Object.assign(totd, track);
        }
        return track;
    }

    /**
     * 
     * @param {{}} trackJson 
     */
    insertOrUpdateTrack = async (trackJson) => {
        if (trackJson.hasOwnProperty('groupUid') && await this.checkRow('totd', { mapUid: trackJson.mapUid }) === false) {
            console.log('hi');
            const { mapUid, groupUid, startTimestamp, endTimestamp } = trackJson;
            await this.insertRow('totd', {
                mapUid: mapUid,
                groupUid: groupUid,
                startTimestamp: startTimestamp,
                endTimestamp: endTimestamp
            });
        }
        for (const key of ['groupUid', 'startTimestamp', 'endTimestamp']) {
            delete trackJson[key];
        }

        trackJson.refreshTime = Math.floor(Date.now()/1000) + 600;

        if (await this.checkRow('accounts', { accountUid: trackJson.accountUid }) === false) {
            await this.insertRow('accounts', {
                accountUid: trackJson.accountUid,
                accountName: trackJson.authorName,
                accountNameTMX: trackJson.authorNameTMX | null
            });
        } else if (trackJson.hasOwnProperty('authorNameTMX') && await this.getRow('accounts', { accountUid: trackJson.accountUid }).accountNameTMX === null) {
            await this.updateRow('accounts', {
                accountNameTMX: trackJson.authorNameTMX,
            })
        }
        delete trackJson.authorNameTMX;

        if (trackJson.hasOwnProperty('website') && await this.checkRow('tmxtracks', { mapUid: trackJson.mapUid }) === false) {
            await this.insertRow('tmxtracks', {
                mapUid: trackJson.mapUid,
                tags: trackJson.tags,
                website: trackJson.website,
                styleName: trackJson.styleName
            });
        }
        for (const key of ['tags', 'website', 'styleName']) {
            delete trackJson[key];
        }

        if (await this.checkRow('tracks', { mapUid: trackJson.mapUid }) === false) {
            await this.insertRow('tracks', trackJson);
        }
    }

    updateTrack = async (trackJson) => {

    }
}

class UsersDatabase extends BaseDatabase {
    constructor(databaseFilepath) {
        super(databaseFilepath);
    }

    setUpTables = async () => {
        await this.createTable('users', {
            discordUserId: 'INTEGER PRIMARY KEY NOT NULL',
        });
    }

}

export class DatabaseFacade {
    constructor() {
        this.trackmaniaDB = new TrackmaniaDatabase('src/cache/dbs/trackmania.db');
        this.usersDB = new UsersDatabase('src/cache/dbs/discordUsers.db');
    }

    setUpTables = async () => {
        this.trackmaniaDB.setUpTables();
        this.usersDB.setUpTables();
    }

}

export async function getDatabaseFacade() {
    const databaseFacade = new DatabaseFacade();
    await databaseFacade.setUpTables();
    return databaseFacade;
}