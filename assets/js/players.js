import { teams, weekLengthInfo } from './data.js';

let db = null;

// Initialize SQL.js
initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}` // Point to wasm file
}).then(async SQL => {
    // Fetch the pre-hosted .db file
    const response = await fetch('assets/data/nfl_2026.db');
    const buffer = await response.arrayBuffer();

    // Load the database from the buffer
    db = new SQL.Database(new Uint8Array(buffer));
    console.log("Database loaded successfully.");

    // broadcast db ready
    document.dispatchEvent(new Event("db-ready"));
});

// player data object
class Player {
    constructor(player_id, name, position, current_team, revenge_type, former_team, team_history, curr_headshot, grudge_headshot, game_date, game_time, game_has_passed) {
        this.player_id = player_id;
        this.name = name;
        this.position = position;
        this.current_team = current_team;
        this.revenge_type = revenge_type;
        this.former_team = former_team;
        this.team_history = team_history;
        this.curr_headshot = curr_headshot;
        this.grudge_headshot = grudge_headshot;
        this.game_date = game_date;
        this.game_time = game_time;
        this.game_has_passed = game_has_passed;
    }
}

// matchup data object
class Matchup {
    constructor(away_team, home_team, game_date, game_time, game_has_passed) {
        this.away_team = away_team;
        this.home_team = home_team;
        this.game_date = game_date;
        this.game_time = game_time;
        this.game_has_passed = game_has_passed;
    }
}

// translate modern team id to database id
const team_name_map = {'LAC': 'SDG', 'TEN': 'OTI', 'NE': 'NWE'};

// translate database id to modern team id
const team_db_name_to_irl_name = {'SDG': 'LAC', 'OTI': 'TEN', 'NWE': 'NE'};

// define position order for use in tables
const positionGroup = {"QB": "QB", // fantasy
                        "RB": "RB",
                        "WR": "WR",
                        "TE": "TE",
                        "K": "UTIL",
                        "DE": "DL-LB", // defense
                        "DT": "DL-LB",
                        "DL": "DL-LB",
                        "OLB": "DL-LB",
                        "MLB": "DL-LB",
                        "ILB": "DL-LB",
                        "LB": "DL-LB",
                        "CB": "DB",
                        "FS": "DB",
                        "SS": "DB",
                        "S": "DB",
                        "DB": "DB",
                        "C": "OL", // offensive line
                        "T": "OL",
                        "G": "OL",
                        "OL": "OL",
                        "LS": "UTIL", // utility
                        "FB": "UTIL",
                        "P": "UTIL",
                        "Unknown": "UTIL"}

// position categories
const positions = ["QB", "RB", "WR", "TE", "OL", "DL/LB", "DB", "UTIL"];

// Wait for all content to load
document.addEventListener('DOMContentLoaded', () => {

    // Wait for DB to load
    document.addEventListener("db-ready", () => {

        // Get current week number of NFL regular season
        let weekNum = 1;
        console.log('Getting current week...')
        // get current date/time
        const now = new Date();
        for (let weekI in weekLengthInfo) {
            let weekStart = new Date(weekLengthInfo[weekI]['start']);
            let weekEnd = new Date(weekLengthInfo[weekI]['end']);
            console.log(`Trying week ${weekI}....`);
            console.log(`Start: ${weekStart}`);
            console.log(`End: ${weekEnd}`);
            console.log(`Current Date: ${now}`);
            if (now >= weekStart && now <= weekEnd) {
                weekNum = weekI;
                console.log(`The week number is ${weekNum}.`);
                break;
            }
            console.log("---");
        }

        function hasGamePassed(gameDate, gameTime) {
            const cleanDate = gameDate.replace(/(st|nd|rd|th)/, '');
            const seasonYear = new Date(`${weekLengthInfo[weekNum].start}T00:00:00`).getFullYear();
            const gameDateTime = new Date(`${cleanDate}, ${seasonYear} ${gameTime}`);
            return gameDateTime < now;
        }

        // Get current week's matchups from database
        let matchups = [];
        const weekSlate = db.exec(`SELECT matchups FROM schedule WHERE week == '${weekNum}';`);
        const jsonWeekSlate = JSON.parse(weekSlate[0].values[0]);
        for (const [gameDate, matchupDate] of Object.entries(jsonWeekSlate)) {
            for (const matchupObj of matchupDate) {
                let awayTeam = matchupObj["awayTeam"];
                let homeTeam = matchupObj["homeTeam"];
                if (["LAC", "NE", "TEN"].includes(awayTeam)) {
                    awayTeam = team_name_map[awayTeam];
                }
                if (["LAC", "NE", "TEN"].includes(homeTeam)) {
                    homeTeam = team_name_map[homeTeam];
                }
                const gameTime = matchupObj["time"];
                const matchup = new Matchup(awayTeam, homeTeam, gameDate, gameTime, hasGamePassed(gameDate, gameTime));
                console.log(matchup);
                matchups.push(matchup);
            }
        }

        /**
        * Find all players on 'currTeam' who have previously played for 'opposingTeam'.
        *
        * @param {string} currTeam - Abbreviation of the current team.
        * @param {string} opposingTeam - Abbreviation of the opposing team.
        * @returns {list[list[Player], string]} - List of players with revenge on opposingTeam.
        */
        function findPlayersWithRevenge(currTeam, opposingTeam, gameDate, gameTime, gameHasPassed) {
            const query = `SELECT gsis_id, name, position, team, team_history, initial_team, 
                            headshot_url FROM players WHERE team == '${currTeam}' AND 
                            instr(team_history, '${opposingTeam}') > 0;`;
            const results = db.exec(query);
            console.log(`Players on ${currTeam} that used to play for ${opposingTeam}:`);
            let playerList = [];
            if (results) {
                const result = results[0];
                try {
                    playerList = results[0]["values"];
                } 
                catch {
                    console.log("No players found.");
                }
            }      
            console.log(playerList);
            return [playerList, opposingTeam, gameDate, gameTime, gameHasPassed];
        }

        let playersWithRevenge = [];
        for (let mu of matchups) {
            playersWithRevenge.push(findPlayersWithRevenge(mu.away_team, mu.home_team, mu.game_date, mu.game_time, mu.game_has_passed));
            playersWithRevenge.push(findPlayersWithRevenge(mu.home_team, mu.away_team, mu.game_date, mu.game_time, mu.game_has_passed));
        }
        console.log("All vengeant players:");
        console.log(playersWithRevenge);

        // initialize and populate player dict
        let players = [];
        for (let revengeObj of playersWithRevenge) {
            const playerList = revengeObj[0];
            const opposingTeam = revengeObj[1];
            const gameDate = revengeObj[2];
            const gameTime = revengeObj[3];
            const gameHasPassed = revengeObj[4];

            if (playerList.length > 0) {
                console.log(`Players with revenge games against ${opposingTeam}:`);
                console.log(playerList);

                for (const playerObj of playerList) {
                    const playerId = playerObj[0];
                    console.log(`Id: ${playerId}`);
                    const name = playerObj[1];
                    console.log(`Name: ${name}`);
                    const position = playerObj[2];
                    console.log(`Position: ${position}`);
                    const team = playerObj[3];
                    console.log(`Team: ${team}`);
                    const teamHistory = playerObj[4];
                    console.log(`Team history: ${teamHistory}`);
                    const initialTeam = playerObj[5];
                    console.log(`Initial team: ${initialTeam}`);
                    const headshots = JSON.parse(playerObj[6].replace(/'/g, '"'))
                    const curr_headshot = headshots[team]
                    console.log(`Current Headshot: ${curr_headshot}`)
                    const grudge_headshot = headshots[opposingTeam]
                    console.log(`Grudge Headshot: ${grudge_headshot}`)

                    // specify 'original' revenge type if player is facing his initial team
                    let revengeType = "former";
                    if (initialTeam == team) {
                        revengeType = "original";
                    }
                    const player = new Player(playerId, name, position, team, revengeType, opposingTeam, teamHistory, curr_headshot, grudge_headshot, gameDate, gameTime, gameHasPassed)
                    players.push(player);
                }
            } else {
                console.log(`No players have revenge games against ${opposingTeam} this week.`)
            }
        }

        // test
        // const player1 = new Player("DaltAn00", "Andy Dalton", "QB", "CAR", "former", "NOR", "{'CAR': ['2023', '2024'], 'CIN': ['2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019'], 'DAL': ['2020'], 'NOR': ['2022'], 'CHI': ['2021']}");
        // players.push(player1)
        // const player2 = new Player("ReynCr00", "Craig Reynolds", "RB", "DET", "original", "WAS", "{'DET': ['2021', '2022', '2023', '2024', '2025'], 'WAS': ['2019'], 'JAX': ['2020']}");
        // players.push(player2)
        // const player3 = new Player("KirkCh01", "Christian Kirk", "WR", "HTX", "former", "JAX", "{'CRD': ['2018', '2019', '2020', '2021'], 'JAX': ['2022', '2023', '2024']}");
        // players.push(player3)
        // const player4 = new Player("OlivJo00", "Josh Oliver", "TE", "MIN", "former", "RAV", "{'JAX': ['2019'], 'RAV': ['2021', '2022'], 'MIN': ['2023', '2024', '2025']}");
        // players.push(player4)
        // const player5 = new Player("JordMi01", "Michael Jordan", "OL", "TAM", "former", "NWE", "{'CIN': ['2019', '2020'], 'NWE': ['2024'], 'CAR': ['2021', '2022'], 'TAM': ['2025']}");
        // players.push(player5)
        // const player6 = new Player("CollLJ00", "L.J. Collier", "DL", "CRD", "original", "SEA", "{'CRD': ['2023', '2024', '2025'], 'SEA': ['2019', '2020', '2021', '2022']}");
        // players.push(player6)
        // const player7 = new Player("DaviCa02", "Carlton Davis", "CB", "NWE", "original", "TAM", "{'DET': ['2024'], 'TAM': ['2018', '2019', '2020', '2021', '2022', '2023'], 'NWE': ['2025']}");
        // players.push(player7)
        // const player8 = new Player("BobeJa00", "Jacob Bobenmoyer", "LS", "RAI", "original", "DEN", "{'RAI': ['2023', '2024', '2025'], 'DEN': ['2020', '2021', '2022']}");
        // players.push(player8)

        players = players.filter(player => !player.game_has_passed);

        // inject html for the table of contents and bio
        const positionSet = new Set(players.map(player => player.position));
        const positionToEnglish = {
            "QB": "QUARTERBACKS",
            "RB": "RUNNING BACKS",
            "WR": "WIDE RECEIVERS",
            "TE": "TIGHT ENDS",
            "OL": "OFFENSIVE LINE",
            "DL-LB": "DEFENSIVE LINE/LINEBACKERS",
            "DB": "DEFENSIVE BACKS",
            "UTIL": "UTILITY"
        };
        console.log(positionSet);
        const positionIndicator = document.createElement('div');
        positionIndicator.className = 'position-indicator';
        positionIndicator.setAttribute('aria-live', 'polite');
        document.body.appendChild(positionIndicator);

        for (const pos of positionSet) {
            console.log(`Position: ${pos}`);
            //console.log(positionGroup[pos]);
            const tableOfContents = document.querySelector(`#${positionGroup[pos].toLowerCase()}-names`)
            const bios = document.querySelector(`#${positionGroup[pos].toLowerCase()}-bios`);
            const playerList = players.filter(p => p.position === pos);
            const positionGroupPlayers = [...positionSet]
                .filter(groupPosition => positionGroup[groupPosition] === positionGroup[pos])
                .flatMap(groupPosition => players.filter(p => p.position === groupPosition));
            playerList.forEach(p => {
                console.log(p)
                const groupPlayerIndex = positionGroupPlayers.indexOf(p);
                const previousPlayer = positionGroupPlayers[groupPlayerIndex - 1];
                const nextPlayer = positionGroupPlayers[groupPlayerIndex + 1];
                const playerNavigation = `
                                    <nav class="player-navigation" aria-label="Player navigation">
                                        ${previousPlayer ? `<a class="previous-player" href="#${previousPlayer.player_id}" aria-label="Previous player">&uarr;</a>` : ''}
                                        ${nextPlayer ? `<a class="next-player" href="#${nextPlayer.player_id}" aria-label="Next player">&darr;</a>` : ''}
                                    </nav>`;
                // store seasons when player played for former team
                let seasons = JSON.parse(p.team_history.replace(/'/g, '"'))[p.former_team];
                if (seasons.length > 1) {
                    seasons = seasons.join(", ");
                }
                // if former team is SDG or OTI, translate to modern abbreviation LAC or TEN
                if (['SDG', 'OTI'].includes(p.former_team)) {
                    p.former_team = team_db_name_to_irl_name[p.former_team];
                }
                // store player's first season with former team
                const first_grudge_season = seasons.slice(0, 4);
                // add html to table of contents  
                tableOfContents.insertAdjacentHTML('beforeend', `<li><a href="#${p.player_id}" class="player-link">${p.name}</a></li><br>`);
                // add html to bio
                bios.insertAdjacentHTML('beforeend', `<section class="whats-trending" id="${p.player_id}" data-position-group="${positionGroup[p.position]}">
            <br><br>&nbsp;
            <div class="container expanded">
                <div class="row">
                    <div class="col-lg-6 align-self-center">
                        <div class="section-heading">
                            <h2>${p.name}</h2>
                        </div>
                        <div class="left-content">
                            <p>${p.name} (${p.position}, ${p.current_team}) ${p.game_has_passed ? 'went' : 'goes'} up against his ${p.revenge_type} team the <b>${teams[p.former_team]["name"]}</b> on ${p.game_date} at ${p.game_time} ET.</p>
                                    <div class="primary-button">
                                        <a href="#revenge-games" class="back-to-table">Back to Table</a>
                                    </div>
                                    ${playerNavigation}
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="right-image">
                            <div class="thumb">
                                <div class="hover-effect">
                                    <div class="inner-content">
                                        <h4><a href="#">Seasons with ${p.former_team}</a></h4>
                                        <span>${seasons}</span>
                                    </div>
                                </div>
                                <div class="fade-wrapper">
                                    <img src="${p.curr_headshot}"
                                        alt onerror="this.onerror=null;this.src='assets/images/football3.png'"
                                        class="normal">
                                    <img src="${p.grudge_headshot}"
                                        data-hover="https://www.pro-football-reference.com/req/20230307/images/headshots/${p.player_id}_${first_grudge_season}.jpg"
                                        data-normal="https://www.pro-football-reference.com/req/20230307/images/headshots/${p.player_id}_2025.jpg"
                                        alt onerror="this.onerror=null;this.src='none'" class="hover">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`);
            });
        }

        const positionGroups = ["QB", "RB", "WR", "TE", "OL", "DL-LB", "DB", "UTIL"];
        for (const group of positionGroups) {
            const tableOfContents = document.querySelector(`#${group.toLowerCase()}-names`);
            const bios = document.querySelector(`#${group.toLowerCase()}-bios`);
            const hasPlayers = bios.querySelector(`[data-position-group="${group}"]`);

            if (!hasPlayers) {
                const groupId = group.toLowerCase();
                const positionLink = document.querySelector(`.pos-label-link[href="#${groupId}-bios"]`);
                positionLink?.setAttribute('href', `#${groupId}-header`);
                tableOfContents.insertAdjacentHTML('beforeend', `<li class="no-players"><a href="#${groupId}-header"></a></li>`);
                bios.insertAdjacentHTML('beforeend', `<p class="no-players">No Players This Week</p>
                    <div class="primary-button">
                        <center><a href="#revenge-games" class="back-to-table">Back to Table</a></center>
                        <br><br>
                    </div>`);
            }

            const groupIndex = positionGroups.indexOf(group);
            if (groupIndex < positionGroups.length - 1) {
                const nextGroup = positionGroups[groupIndex + 1];
                const nextGroupId = nextGroup.toLowerCase();
                const nextBios = document.querySelector(`#${nextGroupId}-bios`);
                const nextTarget = nextBios.querySelector(`[data-position-group="${nextGroup}"]`)
                    ? `${nextGroupId}-bios`
                    : `${nextGroupId}-header`;
                bios.insertAdjacentHTML('beforeend', `<div class="position-transition"><a href="#${nextTarget}" aria-label="Next position group"><span class="visually-hidden">Next position group</span>&darr;</a></div>`);
            }
        }

        const playerSections = [...document.querySelectorAll('[data-position-group]')];
        const updatePositionIndicator = () => {
            const activeSection = playerSections.reduce((active, section) => {
                if (section.getBoundingClientRect().top <= 150) return section;
                return active;
            }, null);

            if (!activeSection || activeSection.getBoundingClientRect().bottom <= 150) {
                positionIndicator.classList.remove('is-visible');
                return;
            }

            const positionGroupName = activeSection.dataset.positionGroup;
            positionIndicator.textContent = positionToEnglish[positionGroupName] || positionGroupName;
            positionIndicator.classList.add('is-visible');
        };

        window.addEventListener('scroll', updatePositionIndicator, { passive: true });
        updatePositionIndicator();
    })
})
