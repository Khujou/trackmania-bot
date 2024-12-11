import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { getDate, hourDST } from '../utils.js';
import { setLogLevel, getLogger, logProfile } from '../log.js';
import { TrackmaniaWrapper, FileBasedCachingAccessTokenProvider } from '../trackmania/trackmaniaWrapper.js';

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
        console.log(res);
        db.close();
        const reskey = Object.keys(res);
        return Boolean(res[reskey[0]]);
    }
    
    /**
     * 
     * @param {string} table 
     * @param {{pkCol: pkVal}} pk 
     * @returns {Promise<{}> | undefined}
     */
    getRow = async (table, pk) => {
        const db = await open({
            filename: this.databaseFilepath,
            driver: sqlite3.Database
        });
        const pkName = Object.keys(pk)[0];
        const sqlCode = 
            `SELECT * FROM ${table} WHERE ${pkName} = ?`;
        const res = await db.get(sqlCode, pk[pkName]);
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
        this.trackmaniaWrapper = new TrackmaniaWrapper((identifier, fetchFunction) => 
            new FileBasedCachingAccessTokenProvider(`accessToken-${identifier}.json`, fetchFunction));
    }

    setUpTables = async () => {
        await this.createTable('accounts', {
            accountUid: 'TEXT PRIMARY KEY NOT NULL',
            accountName: 'TEXT NOT NULL',
        });
        
        await this.createTable('tracks', {
            mapUid: 'TEXT PRIMARY KEY NOT NULL',
            mapId: 'TEXT NOT NULL',
            mapName: 'TEXT NOT NULL',
            accountUid: 'TEXT NOT NULL',
            mapType: 'TEXT NOT NULL',
            authorTime: 'INTEGER NOT NULL',
            goldTime: 'INTEGER NOT NULL',
            silverTime: 'INTEGER NOT NULL',
            bronzeTime: 'INTEGER NOT NULL',
            updateTimestamp: 'INTEGER NOT NULL', // when it was updated on nadeo servers
            refreshTimestamp: 'INTEGER', // will either be a timestamp for when the bot will try and get info from tmx, or null if the info is already stored
        }, {
            accountUid: ['accounts', 'accountUid'],
        });
        
        await this.createTable('tmxtracks', {
            trackID: 'INTEGER PRIMARY KEY NOT NULL',
            mapUid: 'TEXT NOT NULL',
            userID: 'INTEGER NOT NULL',
            userNameTMX: 'TEXT NOT NULL',
            tags: 'TEXT NOT NULL',
            style: 'INTEGER',
            difficulty: 'TEXT NOT NULL',
            awardCount: 'INTEGER NOT NULL',
        }, {
            mapUid: ['tracks', 'mapUid'],
        });
        
        await this.createTable('totd', {
            startTimestamp: 'INTEGER PRIMARY KEY NOT NULL',
            endTimestamp: 'INTEGER NOT NULL',
            mapUid: 'TEXT NOT NULL',
            groupUid: 'TEXT NOT NULL',
        }, {
            mapUid: ['tracks', 'mapUid'],
        });
    }

    getTOTD = async (date = getDate()) => {
        date.setUTCHours(hourDST(date), 0, 0, 0);
        const timestamp = Math.floor(date.valueOf()/1000);
        let totd = await this.getRow('totd', { startTimestamp: timestamp });
        console.log(totd);
        if (totd === undefined) {
            const { mapUid, groupUid, startTimestamp, endTimestamp } = await this.trackmaniaWrapper.trackOfTheDay(date);
            let trackJSON = await this.trackmaniaWrapper.getTrackInfo(mapUid, groupUid);
            trackJSON.startTimestamp = startTimestamp;
            trackJSON.endTimestamp = endTimestamp;
            console.log(trackJSON);
            await this.insertTrack(trackJSON);
            totd = await this.getRow('totd', { startTimestamp: startTimestamp });
            console.log(totd);
        }
        const track = await this.getRow('tracks', { mapUid: totd.mapUid });
        const account = await this.getRow('accounts', { accountUid: track.accountUid });
        const tmx = await this.getRow('tmxtracks', { mapUid: totd.mapUid });
        
        return Object.assign(track, account, totd, tmx);
    }

    getTrack = async(mapUid) => {
        let track = await this.getRow('tracks', { mapUid: mapUid });
        if (track === undefined) {
            await this.insertTrack(await this.trackmaniaWrapper.getTrackInfo(mapUid));
            track = await this.getRow('tracks', { mapUid: mapUid });
        }
        const account = await this.getRow('accounts', { accountUid: track.accountUid });
        const totd = await this.getRow('totd', { mapUid: mapUid });
        const tmx = await this.getRow('tmxtracks', { mapUid: mapUid });

        return Object.assign(track, account, totd, tmx);
    }

    /**
     * First assert that the account of the map creator is in the accounts db, 
     * then insert the base nadeo info of the track into the tracks table,
     * then, if available, insert the totd and tmx info into the respective tables
     * @param {{}} trackJSON 
     */
    insertTrack = async (trackJSON) => {

        if (await this.checkRow('accounts', { accountUid: trackJSON.accountUid }) === false) {
            await this.insertRow('accounts', {
                accountUid: trackJSON.accountUid,
                accountName: trackJSON.accountName,
            });
        }
        delete trackJSON.accountName;


        if (trackJSON.hasOwnProperty('startTimestamp') && await this.checkRow('totd', { mapUid: trackJSON.mapUid }) === false) {
            const { mapUid, groupUid, startTimestamp, endTimestamp } = trackJSON;
            await this.insertRow('totd', {
                mapUid: mapUid,
                groupUid: groupUid,
                startTimestamp: startTimestamp,
                endTimestamp: endTimestamp
            });
        }
        for (const key of ['groupUid', 'startTimestamp', 'endTimestamp']) {
            delete trackJSON[key];
        }

        trackJSON.refreshTimestamp = Math.floor(Date.now()/1000) + 600;

        if (trackJSON.hasOwnProperty('trackID') && await this.checkRow('tmxtracks', { mapUid: trackJSON.mapUid }) === false) {
            await this.insertRow('tmxtracks', {
                trackID: trackJSON.trackID,
                mapUid: trackJSON.mapUid,
                userID: trackJSON.userID,
                userNameTMX: trackJSON.userNameTMX,
                tags: trackJSON.tags,
                style: trackJSON.style,
                difficulty: trackJSON.difficulty,
                awardCount: trackJSON.awardCount,
            });
        }
        for (const key of ['userID', 'trackID', 'userNameTMX', 'tags', 'style', 'difficulty', 'awardCount']) {
            delete trackJSON[key];
        }

        if (await this.checkRow('tracks', { mapUid: trackJSON.mapUid }) === false) {
            await this.insertRow('tracks', trackJSON);
        }
    }

    updateTrack = async (trackJSON) => {

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