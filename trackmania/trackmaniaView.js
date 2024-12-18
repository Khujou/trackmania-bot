import { MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { getLogger, logProfile } from '../log.js';
import { convertMillisecondsToFormattedTime as convertMS, convertNumberToBase, getDate } from '../utils.js';

const log = getLogger();

const MAX_LEADERBOARD_GET = 1000;

export class TrackmaniaView {
    constructor() {

    }

    generateLeaderboardField = (recordsJSON) => {
        const { name, records } = recordsJSON;
        let field = {
            name: name,
            value: `\`\`\`RANK | TIME      | PLAYER\n-----+-----------+-----------------`,
            inline: false,
        };
        const accountIds = Object.keys(records);
        let players = [];
        if (accountIds.length > 0) {
            for (const accountId of accountIds) {
                field.value += `\n${records[accountId].position.toString().padStart(5)}: ${records[accountId].time} - ${records[accountId].name}`;
                players.push({
                    label: `${records[accountId].name}`,
                    value: `${accountId}`,
                });
            }
            field.value += '```';
        }
        else { 
            field.value += '\n\nNo records available at this time :(```'; 
            players.push({
                label: 'No accounts available rn',
                value: 'na',
            });
        }

        const res = {
            field: field,
            players: players,
        };
        return res;
    }

    updateLeaderboard = (leaderboard, mapUid, groupUid, endTimestamp, length = 25, onlyWorld = true, offset = 0) => {
        const { encodedGroupUid, encodedTimestamp } = toBase64(groupUid, endTimestamp);

        let pages = [];
        for (let i = 0; i < 25; i++) {
            pages.push({
                label: `Page ${((Number(offset)+(Number(length)*i))/Number(length))+1}`,
                value: `${length};${Number(offset)+(Number(length)*i)}`,
                description: `Leaderboard positions ${Number(offset)+(Number(length)*i)} - ${(Number(offset)+Number(length))+(Number(length)*i)}`,
            });
        }

        const leaderboardKeys = Object.keys(leaderboard);

        const recordsJSON = {
            name: `${pages[0].label} : ${leaderboard[leaderboardKeys[0]]?.position} - ${leaderboard[leaderboardKeys[leaderboardKeys.length-1]]?.position}`,
            records: leaderboard,
        };

        const records = this.generateLeaderboardField(recordsJSON);

        let buttons = [{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'First',
            custom_id: `lb+${encodedTimestamp}+f;${encodedGroupUid};${mapUid};${length};0`,
            disabled: false,
            emoji: {
                id: null,
                name: '⏪'
            },
        },{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'Back',
            custom_id: `lb+${encodedTimestamp};${encodedGroupUid};${mapUid};${length};${offset-length}`,
            disabled: false,
            emoji: {
                id: null,
                name: '⬅️',
            },
        },{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'Next',
            custom_id: `lb+${encodedTimestamp};${encodedGroupUid};${mapUid};${length};${Number(offset)+Number(length)}`,
            disabled: false,
            emoji: {
                id: null,
                name: '➡️',
            },
        },{
            type: MessageComponentTypes.BUTTON,
            style: ButtonStyleTypes.SECONDARY,
            label: 'Last',
            custom_id: `lb+${encodedTimestamp}+l;${encodedGroupUid};${mapUid};${length};${MAX_LEADERBOARD_GET-length}`,
            disabled: false,
            emoji: {
                id: null,
                name: '⏩'
            },
        }];
    
        if (offset === 0) buttons[0].disabled = true;
        if (offset-length < 0) buttons[1].disabled = true;
        if (offset+length >= 1000) buttons[2].disabled = true;
        if (offset >= 1000-length) buttons[3].disabled = true;

        const pageSelecter = {
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.STRING_SELECT,
                custom_id: `lb+${encodedTimestamp}+p;${encodedGroupUid};${mapUid}`,
                placeholder: 'Select page',
                options: pages,
            },],
        };

        const res = {
            records: records,
            buttons: buttons,
            pageSelecter: pageSelecter,
            encodedGroupUid: encodedGroupUid,
            encodedTimestamp: encodedTimestamp,
        };

        return res;
    }

    /**
     * 
     * @param {JSON} track_info 
     * @param {Number} [length=10]
     * @param {Boolean} [onlyWorld=true]
     * @param {Number} [offset=0]
     * @param {JSON} [watchedAccounts={}]
     * @returns {Promise<JSON>}
     */
    getLeaderboardInfo = (track_info, length = 25, onlyWorld = true, offset = 0) => {
        const { leaderboard, groupUid, mapUid, endTimestamp, author } = track_info;
        const { records, buttons, pageSelecter, encodedGroupUid, encodedTimestamp } = this.updateLeaderboard(leaderboard, mapUid, groupUid, endTimestamp, Number(length), onlyWorld, Number(offset));

        const fields = [records.field];

        const leaderboard_info = {
            author: author,
            timestamp: encodedTimestamp,
            groupUid: encodedGroupUid,
            mapUid: mapUid,
            fields: fields,
            buttons: buttons,
            accounts: records.players,
            watchedAccounts: [{label: 'no players', value: 'na'}],
            pageSelecter: pageSelecter,
        };

        return leaderboard_info;
    }

    /**
     * creates a discord-compatible json using parsed info from Nadeo and Trackmania.Exchange
     * @param {{}}} track_json
     * @returns
     */
    embedTrackInfo = (track_json) => {
        const { command, title, author, authortime, goldtime, silverTime, bronzeTime, tags, website, stylename, thumbnail, mapUid, groupUid, provision, mapType, endTimestamp } = track_json;

        const medal_times = [
            `<:author:1313817834391998534> ${authortime}`,
            `<:gold:1313817803534635050> ${goldtime}`,
            `<:silver:1313819850094678056> ${silverTime}`,
            `<:bronze:1313819823452721202> ${bronzeTime}`
        ].join('\n');

        const { encodedGroupUid, encodedTimestamp } = toBase64(groupUid, endTimestamp);
        const encodedMapId = convertNumberToBase(track_json.mapId.split('-').join(''), 16, 64);

        const res = {
            embeds: [{
                author: { name: `${command}`, },
                title: title,
                color: stylename,
                fields: [{
                    name: 'Author',
                    value: author,
                    inline: true,
                },{
                    name: 'Medal Times',
                    value: medal_times,
                    inline: true,
                },{
                    name: 'Map Tags',
                    value: tags,
                    inline: true,
                },
                ],
                image: {
                    url: thumbnail,
                    height: 100,
                    width: 100,
                },
                footer: {
                    text: provision,
                },
            },],
            components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [{
                    type: MessageComponentTypes.BUTTON,
                    style: ButtonStyleTypes.PRIMARY,
                    label: 'Leaderboard',
                    custom_id: `lb+${encodedTimestamp}+${mapType}+${encodedMapId}+i;${encodedGroupUid};${mapUid};25;0`,
                    emoji: {
                        id: null,
                        name: '📋',
                    },
                },{
                    type: MessageComponentTypes.BUTTON,
                    style: ButtonStyleTypes.LINK,
                    label: 'Trackmania.io',
                    url: `https://trackmania.io/#/totd/leaderboard/${groupUid}/${mapUid}`,
                }],
            },],
        };

        if (track_json.website !== null) {
            res['components'][0]['components'].push({
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.LINK,
                label: 'Trackmania.Exchange',
                url: website,
                emoji: {
                    id: null,
                    name: '💻',
                },
            });
        }

        return res;
    }


    embedLeaderboardInfo = (lb_info) => {
        const { author, timestamp, groupUid, mapUid, fields, buttons, accounts, watchedAccounts, pageSelecter } = lb_info;

        const res = {
        embeds: [{
            author: { name: author, },
            title: `Leaderboard`,
            color: parseInt('ffffff', 16),
            fields: fields,
        }],
        components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: buttons,
        },{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.STRING_SELECT,
                custom_id: 'acc+lb',
                placeholder: 'Search info of a Player',
                options: accounts,
                disabled: (accounts[0].value === 'na'),
            }],
        },{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.STRING_SELECT,
                custom_id: 'acc+w',
                placeholder: 'Search info of a Watched Player',
                options: watchedAccounts,
                disabled: (watchedAccounts[0].value === 'na'),
            }],
        }, pageSelecter, {
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
                type: MessageComponentTypes.BUTTON,
                style: ButtonStyleTypes.PRIMARY,
                label: 'Track Info',
                custom_id: `track+${timestamp};${groupUid};${mapUid};${author.split('-')[1].slice(1)}`,
                emoji: {
                    id: null,
                    name: '🏁'
                },
            },],
        },],
        };

        return res;
    }

}

function toBase64(groupUid, timestamp = undefined) {
    if (timestamp !== undefined)
        timestamp = `totd+${convertNumberToBase(timestamp.toString(), 10, 64)}`;
    else timestamp = '0';

    if (groupUid !== 'Personal_Best') {
        groupUid = convertNumberToBase(groupUid.split('-').join(''), 16, 64);
    }

    const res = {
        encodedGroupUid: groupUid,
        encodedTimestamp: timestamp
    }

    return res;
}