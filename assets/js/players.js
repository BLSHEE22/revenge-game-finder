import { teams, weekLengthInfo } from './data.js';

let db = null;

// Initialize SQL.js
initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}` // Point to wasm file
}).then(async SQL => {
    // Fetch the pre-hosted .db file
    const response = await fetch('assets/data/nfl_players.db');
    const buffer = await response.arrayBuffer();

    // Load the database from the buffer
    db = new SQL.Database(new Uint8Array(buffer));
    console.log("Database loaded successfully.");

    // broadcast db ready
    document.dispatchEvent(new Event("db-ready"));
});

// player data object
class Player {
    constructor(player_id, name, position, current_team, revenge_type, former_team, team_history) {
        this.player_id = player_id;
        this.name = name;
        this.position = position;
        this.current_team = current_team;
        this.revenge_type = revenge_type;
        this.former_team = former_team;
        this.team_history = team_history;
    }
}

// matchup data object
class Matchup {
    constructor(away_team, home_team) {
        this.away_team = away_team;
        this.home_team = home_team;
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

        // Get current week's matchups from database
        let matchups = [];
        const weekSlate = db.exec(`SELECT matchups FROM schedule WHERE week == '${weekNum}';`);
        const jsonWeekSlate = JSON.parse(weekSlate[0].values[0]);
        const matchupDatesInWeek = Object.values(jsonWeekSlate)
        for (const date of matchupDatesInWeek) {
            for (const matchupObj of date) {
                let awayTeam = matchupObj["awayTeam"];
                let homeTeam = matchupObj["homeTeam"];
                if (["LAC", "NE", "TEN"].includes(awayTeam)) {
                    awayTeam = team_name_map[awayTeam];
                }
                if (["LAC", "NE", "TEN"].includes(homeTeam)) {
                    homeTeam = team_name_map[homeTeam];
                }
                const matchup = new Matchup(awayTeam, homeTeam);
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
        function findPlayersWithRevenge(currTeam, opposingTeam) {
            const query = `SELECT player_id, name, position, team, team_history, initial_team, 
                            fantasy_pos_rk, headshot_url FROM players WHERE team == '${currTeam}' AND 
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
            return [playerList, opposingTeam];
        }

        let playersWithRevenge = [];
        for (let mu of matchups) {
            playersWithRevenge.push(findPlayersWithRevenge(mu.away_team, mu.home_team));
            playersWithRevenge.push(findPlayersWithRevenge(mu.home_team, mu.away_team));
        }
        console.log("All vengeant players:");
        console.log(playersWithRevenge);

        // initialize and populate player dict
        let players = [];
        for (let revengeObj of playersWithRevenge) {
            const playerList = revengeObj[0];
            const opposingTeam = revengeObj[1];

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

                    // specify 'original' revenge type if player is facing his initial team
                    let revengeType = "former";
                    if (initialTeam == team) {
                        revengeType = "original";
                    }
                    const player = new Player(playerId, name, position, team, revengeType, opposingTeam, teamHistory)
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

        // inject html for the table of contents and bio
        const positionSet = new Set(players.map(player => player.position));
        console.log(positionSet);
        for (const pos of positionSet) {
            console.log(`Position: ${pos}`);
            //console.log(positionGroup[pos]);
            const tableOfContents = document.querySelector(`#${positionGroup[pos].toLowerCase()}-names`)
            const bios = document.querySelector(`#${positionGroup[pos].toLowerCase()}-bios`);
            const playersForPosition = players.filter(p => p.position === pos);
            for (const p of playersForPosition) {
                console.log(p)
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
                bios.insertAdjacentHTML('beforeend', `<section class="whats-trending" id="${p.player_id}">
            <br><br>&nbsp;
            <div class="container expanded">
                <div class="row">
                    <div class="col-lg-6 align-self-center">
                        <div class="section-heading">
                            <h2>${p.name}</h2>
                        </div>
                        <div class="left-content">
                            <p>${p.name} (${p.position}, ${p.current_team}) goes up against his ${p.revenge_type} team the <b>${teams[p.former_team]["name"]}</b> this week.</p>
                                    <div class="primary-button">
                                        <a href="#revenge-games">Back to Table</a>
                                    </div>
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
                                    <img src="https://www.pro-football-reference.com/req/20230307/images/headshots/${p.player_id}_2025.jpg"
                                        alt onerror="this.onerror=null;this.src='assets/images/football3.png'"
                                        class="normal">
                                    <img src="https://www.pro-football-reference.com/req/20230307/images/headshots/${p.player_id}_${first_grudge_season}.jpg"
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
            }
        }
    })
})
