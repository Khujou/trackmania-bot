import 'dotenv/config';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
} from 'discord-interactions';
import { getLogger, logProfile } from '../log.js';
import { convertNumberToBase, revertUID, getDate } from '../utils.js';
import { TrackmaniaWrapper, FileBasedCachingAccessTokenProvider, FileBasedCachingJSONDataProvider } from '../trackmania/trackmaniaWrapper.js';
import { TrackmaniaView } from '../trackmania/trackmaniaView.js';

const log = getLogger();

export class TestingClass {
    constructor() {

    }

    testEmbed = () => {
        return {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'hello world',
            embeds: [{
                title: 'hello world',
                color: 39423,
                description: 'example embed',
                image: {
                    url: 'https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?q=80&w=1364&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                    height: 100,
                    width: 100,
                },
                fields: [{
                    name: 'Time Called',
                    value: `<t:${Math.floor(Date.now()/1000)}:R>`,
                    inline: true,
                },{
                    name: 'bruh',
                    value: '<:champion:1313817856831651840>',
                    inline: true,
                }],
                author: {
                    name: 'Brungus',
                    url: 'https://github.com/Khujou/trackmania-bot',
                    icon_url: 'https://media.discordapp.net/attachments/501929280729513994/1175598105178152991/IMG_0778.jpg?ex=657e450d&is=656bd00d&hm=b71379906b73849aa7e3fc05e8d20669f93b237ed45a93ce870e099c902f8776&=&format=webp',
                },
                footer: {
                    text: 'bungus',
                    icon_url: 'https://media.discordapp.net/attachments/501929280729513994/1154607848437858374/image.png?ex=657bbc5a&is=6569475a&hm=1a8904ebb68181710d0d9808f20516b2f1f35ce1b09706af3e89a18915ca9f54&=&format=webp&quality=lossless',
                },
                provider: {
                    name: 'blehg',
                    url: 'https://www.youtube.com',
                },
            },],
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.BUTTON,
                    style: 1,
                    label: 'test',
                    custom_id: 'test',
                },{
                    type: MessageComponentTypes.BUTTON,
                    url: 'https://raw.githubusercontent.com/2qar/bigheadgeorge.github.io/master/ogdog.gif',
                    label: 'Click for win',
                    style: 5,
                },{
                    type: MessageComponentTypes.BUTTON,
                    url: 'https://media.tenor.com/FDxMOf3iWhIAAAAM/angry-cute-cat-cat.gif',
                    label: 'Click for lose',
                    style: 5,
                },
                ],
            },
            ],
        };
    }

    tuckerEmbed = () => {
        return {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'i miss him <@203284058673774592>',
        };
    }
}

class Function {
    constructor() {
        this.trackmaniaWrapper = new TrackmaniaWrapper((identifier, fetchFunction) => new FileBasedCachingAccessTokenProvider(`accessToken-${identifier}.json`, fetchFunction));
        this.trackmaniaView = new TrackmaniaView();
    }

    getTOTD = async (dateArg = new Date()) => {
        const { command, mapUid, groupUid, startTimestamp, endTimestamp } = await this.trackmaniaWrapper.trackOfTheDay(dateArg)
        .catch(err => console.error(err));

        let track_json = await this.trackmaniaWrapper.getTrackInfo(command, mapUid, groupUid)
        .catch(err => console.error(err));

        track_json.startTimestamp = startTimestamp;
        track_json.endTimestamp = endTimestamp;

        return track_json;
    }
}



class TrackFunctions extends Function {
    constructor() {
        super();

        // Returns up-to-date TOTD info. Checks if stored TOTD info is out of date and replaces with up-to-date info.
        this.cachingTOTDProvider = new FileBasedCachingJSONDataProvider('totd.json',
            undefined,
            (trackInfo) => trackInfo.endTimestamp <= (Math.floor(Date.now() / 1000)),
            async() => await this.getTOTD()
        );
            
    }
    
    START_DATE = new Date(2020, 6, 1);

    commandTOTD = async (options) => {
        let callback = d => d;
        let callbackArgs = [];
        let dateArg = getDate();
        if (options[0].name === 'past') {
            const fields = options[0].options;
            const inputDate = new Date(fields[0].value, fields[1].value - 1, fields[2].value);
            dateArg = (inputDate < dateArg) ? inputDate : dateArg;
            if (inputDate < this.START_DATE)
                throw new Error('Date given is before Trackmania came out, silly :)');

            console.log(dateArg + inputDate);

            callback = async (dateArg) => await this.getTOTD(dateArg);
            callbackArgs = [dateArg];

        } else {
            callback = this.cachingTOTDProvider.getData;
        }

        let embeddedTOTD = this.getAndEmbedTrackInfo(callback, callbackArgs);
        return embeddedTOTD;
    }
    
    buttonGetTrackInfo = async (params, command_queries) => {
        const groupUid = revertUID(params[1]);
        const mapUid = params[2];
        const isTOTD = command_queries.length > 1 && command_queries[1] === 'totd';
        const command = (isTOTD) ? `Track of the Day - ${params[3]}` : 'Map Search';
        const endTimestamp = (isTOTD) ? Number(convertNumberToBase(command_queries[2], 64, 10)) : 0;
        let callback = d => d;
        let callbackArgs = [];
        if (isTOTD && endTimestamp > Math.floor(Date.now() / 1000)) {
            callback = this.cachingTOTDProvider.getData;
        }
        else {
            callback = TrackmaniaWrapper.getTrackInfo(command, mapUid, groupUid);
        }

        let embeddedTOTD = this.getAndEmbedTrackInfo(callback, callbackArgs);
        return embeddedTOTD;
    }

    /**
     * 
     * @param {(...args: any) => Promise<{}>} callback 
     * @param {any[] = []} callbackArgs 
     * @returns 
     */
    getAndEmbedTrackInfo = async (callback, callbackArgs = []) => {
        const track_json = await callback(...callbackArgs);
        return this.trackmaniaView.embedTrackInfo(track_json);
    }

    commandSearchTrack = async () => {
        return;
    }

    
}

class LeaderboardFunctions extends Function {
    constructor() {
        super();
    }

    createLeaderboard = async (member, params, command_queries, track_json, accountWatchers) => {
        const userId = member.user.id;
        const userName = member.user.username;
        const length = Number(params[3]);
        const offset = Number(params[4]);
        let getLeaderboards = [this.trackmaniaWrapper.getLeaderboard];
        let getLeaderboardsArgs = {
            "0": [`${track_json.groupUid}/map/${track_json.mapUid}`, length, true, offset],
        };
        let FEGens = [this.trackmaniaView.getLeaderboardInfo, this.trackmaniaView.generateLeaderboardField];
        let FEGensArgs = {};
        if (accountWatchers.hasOwnProperty(userId) && accountWatchers[userId].length > 0) {
            const mapType = command_queries[command_queries.length-3];
            const mapId = revertUID(command_queries[command_queries.length-2]);
            getLeaderboards.push(this.trackmaniaWrapper.getWatchedAccountsMapRecords);
            getLeaderboardsArgs['1'] = [accountWatchers[userId], mapId, mapType];
        }

        const leaderboards = await Promise.all(
            getLeaderboards.map((e, i) => e(...getLeaderboardsArgs[i]))
        ).catch(err => console.error(err));

        let mainLeaderboard = leaderboards[0];
        let watchedLeaderboard = (leaderboards.length > 1) ? leaderboards[1] : [];

        let accounts = [];
        leaderboards.forEach((leaderboard) => {
            accounts = accounts.concat(Object.keys(leaderboard));
        });
        const accountNames = await this.trackmaniaWrapper.getAccountName(accounts);
        accounts.forEach((e, i) => {
            if (i < length) {
                mainLeaderboard[e].name = accountNames[e];
            }
            else {
                watchedLeaderboard[e].name = accountNames[e];
            }
        });

        track_json.leaderboard = mainLeaderboard;
        FEGensArgs['0'] = [track_json, length, true, offset];
        FEGensArgs['1'] = [{ name: `${userName}'s Watched Players`, }];
        FEGensArgs['1'][0].records = watchedLeaderboard;

        const FEs = FEGens.map((e,i) => e(...FEGensArgs[i]));

        let embed = FEs[0];
        if (FEs.length > 1) {
            embed.fields.push(FEs[1].field);
            embed.watchedAccounts = FEs[1].players;
        }

        return this.trackmaniaView.embedLeaderboardInfo(embed);
    }

    updateLeaderboard = async (data, message, params, embedChangeState, track_json) => {
        let args = [];
        switch (embedChangeState) {
            case 'p': // p for page selector
                args = data.values[0].split(';');
                break;
            default:
                args = [params[3], params[4]];
        }
        const length = Number(args[0]);
        const offset = Number(args[1]);

        let leaderboard = await this.trackmaniaWrapper.getLeaderboard(`${track_json.groupUid}/map/${track_json.mapUid}`, length, true, offset);
        const accountIds = Object.keys(leaderboard);
        const accountNames = await this.trackmaniaWrapper.getAccountName(accountIds);
        accountIds.forEach(accountId => {
            leaderboard[accountId].name = accountNames[accountId];
        });

        const { records, buttons, pageSelecter } = this.trackmaniaView.updateLeaderboard(leaderboard, track_json.mapUid, track_json.groupUid, track_json.endTimestamp, length, true, offset);

        let embeds = message.embeds;
        let components = message.components;

        embeds[0].fields[0] = records.field;
        components[0].components = buttons;
        components[1].components[0].options = records.players;
        components[3] = pageSelecter;

        return {
            embeds: embeds,
            components: components,
        };
    }

    buttonGetLeaderboard = async (data, message, member, params, command_queries, embedChangeState, accountWatchers) => {
        const track_json = {
            author: message.embeds[0].author.name,
            groupUid: (params[1] !== 'Personal_Best') ? revertUID(params[1]) : params[1],
            mapUid: params[2],
            endTimestamp: undefined,
        };
        if (command_queries[1] === 'totd') { track_json.endTimestamp = Number(convertNumberToBase(command_queries[2], 64, 10)); }
        
        if (embedChangeState === 'i') { // 'i' for initialize 🤓
            return await this.createLeaderboard(member, params, command_queries, track_json, accountWatchers);
        } else {
            return await this.updateLeaderboard(data, message, params, embedChangeState, track_json);
        }
    }

}

class AccountsFunctions extends Function {
    constructor() {
        super();
    }
}

export class TrackmaniaBotFunctions {
    constructor() {
        this.track = new TrackFunctions();
        this.leaderboard = new LeaderboardFunctions();
        this.accounts = new AccountsFunctions();
    }
}