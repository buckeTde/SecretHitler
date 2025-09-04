// public/app.js
let socket;

let roleCheckResult = false;
let gameStarted = false;

// Alternative Namen für Rollen
const codeWords = {
    liberal: ['liberal', 'demokrat', 'freiheit', 'friedlich', 'pazifist', 'blau'],
    fascist: ['fascho', 'nazi', 'ss sa', 'nsdap', 'rot'],
    hitler: ['hitler', 'adolf', 'führer', 'kanzler', 'diktator']
};

// Verfügbare Rollen
const roleOptions = [
    { value: 'liberal', label: getRandomCodeWord('liberal') },
    { value: 'fascist', label: getRandomCodeWord('fascist') },
    { value: 'hitler', label: getRandomCodeWord('hitler') }
];


// Erwartete Rollenverteilung für Secret Hitler
const possibleRoles = {
    3: { liberal: 1, fascist: 1, hitler: 1, hitlerknows: true },
    5: { liberal: 3, fascist: 1, hitler: 1, hitlerknows: true },
    6: { liberal: 4, fascist: 1, hitler: 1, hitlerknows: true },
    7: { liberal: 4, fascist: 2, hitler: 1, hitlerknows: false },
    8: { liberal: 5, fascist: 2, hitler: 1, hitlerknows: false },
    9: { liberal: 5, fascist: 3, hitler: 1, hitlerknows: false },
    10: { liberal: 6, fascist: 3, hitler: 1, hitlerknows: false }
};

function getRandomCodeWord(role) {
    return codeWords[role][Math.floor(Math.random() * codeWords[role].length)];
}

// Zufällige Reihenfolge für Rollen
function shuffleRoles() {
    const roleSelect = document.getElementById('roleSelect');
    roleSelect.innerHTML = '<option value="" disabled selected>-- Bitte wählen --</option>';

    // Fisher-Yates Shuffle
    const shuffled = [...roleOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Optionen einfügen
    shuffled.forEach(role => {
        const option = new Option(role.label, role.value);
        roleSelect.add(option);
    });
}

// Element anzeigen oder verstecken
function showHideElement(element, newStatus) {
    if (newStatus == 'show') {
        document.getElementById(element).classList.remove('hide');
        document.getElementById(element).classList.add('show');
    } else {
        document.getElementById(element).classList.remove('show');
        document.getElementById(element).classList.add('hide');
    }
}

// Spielerliste updaten
function updatePlayerList(connectedPlayers) {
    const connectedPlayerList = document.getElementById('connectedPlayerList');

    // Liste leeren
    connectedPlayerList.innerHTML = '';

    if (connectedPlayers.length > 0) {
        showHideElement('connectedPlayersContainer', 'show');

        connectedPlayers.forEach(player => {
            const connectedPlayerListLi = document.createElement('li');

            connectedPlayerListLi.innerHTML = `${player.name}${player.socketId === socket.id ? ' 👤' : ''}${player.isHost ? ' 👑' : ''}`;
            // connectedPlayerListLi.textContent = `${player.name}${isCurrentPlayer ? ' 👤' : ''}${player.isHost ? ' 👑' : ''}`;

            const currentPlayer = connectedPlayers.find(p => p.socketId === socket.id);
            const isCurrentHost = currentPlayer?.isHost;
            // Host-Button für andere Spieler (nur wenn man selbst Host ist)
            if (isCurrentHost && !player.isHost && player.socketId !== socket.id) {
                const makeHostbtn = document.createElement('button');
                makeHostbtn.className = 'makeHostBtn';
                makeHostbtn.textContent = 'Host Transfer';
                makeHostbtn.onclick = () => {
                    socket.emit('transferHost', player.socketId);
                };
                connectedPlayerListLi.appendChild(makeHostbtn);
            }

            connectedPlayerList.appendChild(connectedPlayerListLi);
        });

        // Host-UI aktualisieren
        const currentPlayer = connectedPlayers.find(p => p.socketId === socket.id);
        updateHostUI(currentPlayer?.isHost, connectedPlayers.length);
    } else {
        showHideElement('connectedPlayersContainer', 'hide');
        updateHostUI(false, 0);
    }
}

// Role Button Event Listener für Rollenanzeige
function setupRoleReveal(role) {
    const playerRole = document.getElementById('playerRole');
    const playerRoleBtn = document.getElementById('playerRoleBtn');

    function showRole(e) {
        // Sicherer Zugriff auf Position (Maus/Touch)
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;

        playerRole.textContent = role;
        playerRole.style.left = `${clientX}px`;
        playerRole.style.top = `${clientY}px`;

        showHideElement('playerRole', 'show');
    }

    function hideRole() {
        playerRole.textContent = '';
        showHideElement('playerRole', 'hide');
    }

    // Mouse events
    playerRoleBtn.addEventListener('mousedown', showRole);
    playerRoleBtn.addEventListener('mouseup', hideRole);
    playerRoleBtn.addEventListener('mouseleave', hideRole);

    // Touch events
    playerRoleBtn.addEventListener('touchstart', showRole);
    playerRoleBtn.addEventListener('touchend', hideRole);
    playerRoleBtn.addEventListener('touchcancel', hideRole);
}

// Info Button Event Listener für Spielanzeige
function setupInfoReveal(infoMessage) {
    const gameInfo = document.getElementById('gameInfo');
    const gameInfoBtn = document.getElementById('gameInfoBtn');

    function showInfo(e) {
        // Sicherer Zugriff auf Position (Maus/Touch)
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;

        gameInfo.textContent = infoMessage;
        gameInfo.style.left = `${clientX}px`;
        gameInfo.style.top = `${clientY}px`;

        showHideElement('gameInfo', 'show');
    }

    function hideInfo() {
        gameInfo.textContent = '';
        showHideElement('gameInfo', 'hide');
    }

    // Mouse events
    gameInfoBtn.addEventListener('mousedown', showInfo);
    gameInfoBtn.addEventListener('mouseup', hideInfo);
    gameInfoBtn.addEventListener('mouseleave', hideInfo);

    // Touch events
    gameInfoBtn.addEventListener('touchstart', showInfo);
    gameInfoBtn.addEventListener('touchend', hideInfo);
    gameInfoBtn.addEventListener('touchcancel', hideInfo);
}

// Host Buttons ein-/ausblenden
function updateHostUI(isHost, playerCount) {
    showHideElement('hostNote', isHost ? 'show' : 'hide');
    showHideElement('resetLobbyBtn', isHost ? 'show' : 'hide');
    showHideElement('checkRolesBtn', isHost && possibleRoles[playerCount] && !gameStarted ? 'show' : 'hide');
    showHideElement('startGameBtn', isHost && roleCheckResult && !gameStarted ? 'show' : 'hide');
}

function updatePlayerUI() {
    showHideElement('roleLabel', gameStarted ? 'hide' : 'show');
    showHideElement('roleSelect', gameStarted ? 'hide' : 'show');
    showHideElement('gameState', gameStarted ? 'show' : 'hide');
}

// Check Rollen
function checkRoles(connectedPlayers) {
    if (!possibleRoles[connectedPlayers.length]) {
        showHideElement('startGameBtn', 'hide');
        return;
    }

    // Zähle aktuelle Rollen
    const roleCounts = { liberal: 0, fascist: 0, hitler: 0 };
    connectedPlayers.forEach(p => {
        if (roleCounts[p.role] !== undefined) roleCounts[p.role]++;
    });

    const expectedRoles = possibleRoles[connectedPlayers.length];
    for (const role in expectedRoles) {
        if (role !== 'hitlerknows' && roleCounts[role] !== expectedRoles[role]) {
            alert(
                `❌ Rollenverteilung passt nicht!\n\n` +
                `Erwartet:\n` +
                `🕊️ ${expectedRoles.liberal} Liberale\n` +
                `🧥 ${expectedRoles.fascist} Faschisten\n` +
                `💀 ${expectedRoles.hitler} Hitler\n\n` +
                `Aktuell:\n` +
                `🕊️ ${roleCounts.liberal} Liberale\n` +
                `🧥 ${roleCounts.fascist} Faschisten\n` +
                `💀 ${roleCounts.hitler} Hitler`
            );

            checkRolesResult = false;
            return;
        };
    }

    //alert(`Rollenverteilung passt!`);

    roleCheckResult = true;
    showHideElement('startGameBtn', 'show');
}


///////////////////////////////////////
////////////// HAUPT APP //////////////
///////////////////////////////////////

// Initialisierung
window.addEventListener('DOMContentLoaded', () => {
    socket = io();

    shuffleRoles();

    // Spielerliste und Status aktualisieren
    socket.emit('requestConnectedPlayers');
    socket.emit('requestGameStatus');

    // Socket-Events
    socket.on('connect', () => {
        mySocketId = socket.id;
    });

    // Fehlermeldungen
    socket.on('joinError', (errorMsg) => {
        showHideElement('errorNote', 'show');
        document.getElementById('errorNote').textContent = errorMsg;
    });

    // Join-Handler
    document.getElementById('joinBtn').addEventListener('click', () => {
        const name = document.getElementById('nameInput').value;
        const role = document.getElementById('roleSelect').value;

        socket.emit('join', { name, role });
    });

    // Anmeldung Erfolgreich
    socket.on('joinSuccess', (connectedPlayer, playerCount) => {
        showHideElement('errorNote', 'hide');
        showHideElement('joinForm', 'hide');

        updateHostUI(connectedPlayer.isHost, playerCount);
        updatePlayerUI();

        setupRoleReveal(connectedPlayer.role);
        showHideElement('playerRoleBtn', 'show');

        socket.emit('requestGameInfo', socket.id);
    });

    // Disconnect-Handler
    socket.on('playerDisconnected', () => {
        roleCheckResult = false;

        // Spielerliste aktualisieren
        socket.emit('requestConnectedPlayers');
    });

    // Connect-Handler
    socket.on('playerConnected', () => {
        roleCheckResult = false;

        // Spielerliste aktualisieren
        socket.emit('requestConnectedPlayers');
    });

    // Hostwechsel
    socket.on('newHost', (hostSocketId, playerCount) => {
        roleCheckResult = false;

        updateHostUI(socket.id == hostSocketId, playerCount);
    });

    // Spielerliste empfangen
    socket.on('updatePlayerList', (conntectedPlayers) => {
        updatePlayerList(conntectedPlayers);
    });

    document.getElementById('resetLobbyBtn').addEventListener('click', () => {
        if (confirm('Lobby reset?!')) {
            socket.emit('resetLobby');
        }
    });

    // Lobby Reset
    socket.on('lobbyReset', () => {
        location.reload();
    });

    // Request Rollencheck
    document.getElementById('checkRolesBtn').addEventListener('click', () => {
        socket.emit('requestRoleCheck');
    });

    // Rollen Check
    socket.on('checkRoles', (conntectedPlayers) => {
        checkRoles(conntectedPlayers);
    });

    // Request Start Game
    document.getElementById('startGameBtn').addEventListener('click', () => {
        if (confirm('Spiel starten?!')) {
            socket.emit('requestGameStart');
        }

    });

    // Bei Spielstart-Update vom Server
    socket.on('startGameStatus', (status, hostSocketId, playerCount) => {
        gameStarted = status;
        updateHostUI(socket.id == hostSocketId, playerCount);
        updatePlayerUI();
    });

    socket.on('updateGameStatus', (gameStartedStatus) => {
        gameStarted = gameStartedStatus;

        updatePlayerUI();
    });

    // Spiel Start
    socket.on('gameStart', (infoMessage) => {
        // Info-Button nur anzeigen wenn Info vorhanden ist
        if (infoMessage && infoMessage.trim() !== '') {
            setupInfoReveal(infoMessage);
            showHideElement('gameInfoBtn', 'show');
        }
    });

    document.getElementById('roleSelect').addEventListener('change', function () {
        if (this.value) {
            document.getElementById('roleLabel').textContent = '✔️ Rolle ausgewählt';
            showHideElement('roleSelect', 'hide');
        }
    });

    socket.on('updateGameInfo', (infoMessage) => {
        setupInfoReveal(infoMessage);
        showHideElement('gameInfoBtn', 'show');
    });
});







