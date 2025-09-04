// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
// const { arch } = require('os');


const PORT = process.env.PORT || 3000;

// Statische Dateien aus "public" bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Start Server
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});





let gameStarted = false;

let connectedPlayers = [];
/*
{
  socketId: string,   // Z.B. "x5yP9m"
  name: string,       // Originalname wie eingegeben (z.B. "Max Mustermann")
  role: string,       // "liberal", "fascist" oder "hitler"
  isHost: boolean     // true/false
}
*/

let playingPlayers = [];
/*
{
  socketId: string,   // Z.B. "x5yP9m"
  name: string,       // Originalname wie eingegeben (z.B. "Max Mustermann")
  role: string,       // "liberal", "fascist" oder "hitler"
  isHost: boolean     // true/false
}
*/

let archivedPlayers = [];
/*
{
  name: string,       // Originalname (z.B. "Max Mustermann")
  role: string        // Letzte bekannte Rolle
}
*/

function getTimestamp() {
    const now = new Date();
    return [
        String(now.getDate()).padStart(2, '0'),
        String(now.getMonth() + 1).padStart(2, '0'),
        now.getFullYear(),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].reduce((acc, part, index) =>
        acc + (index === 3 ? ' ' : (index > 0 ? '.' : '')) + part, '');
}

// Lobby Reset
function resetLobby() {
    connectedPlayers = [];
    playingPlayers = [];
    archivedPlayers = [];
    gameStarted = false;

    io.emit('lobbyReset');
}

function setupInfoMessage(playerSocketId) {
    if (gameStarted) {
        const requestingPlayer = playingPlayers.find(player => player.socketId === playerSocketId);

        const fascists = playingPlayers
            .filter(player => player.role === 'fascist')
            .map(player => player.name);

        const hitler = playingPlayers.find(p => p.role === 'hitler')?.name || '';

        let infoMsg;
        if (requestingPlayer.role === 'fascist') {
            infoMsg = `Faschisten: ${fascists.join(', ')}\nHitler: ${hitler}`;
        } else {
            infoMsg = 'Hier steht nix';
        }

        io.to(playerSocketId).emit('updateGameInfo', infoMsg);
    }
}

io.on('connection', (socket) => {
    console.log(`[${getTimestamp()}] [I] [connection] ID: <${socket.id}>`);

    // BEITRITT
    socket.on('join', ({ name, role }) => {
        const nameTrimmed = name.trim()
        const archivedPlayer = archivedPlayers.find(p => p.name === nameTrimmed);

        console.log(`[${getTimestamp()}] [I] [join] ID: <${socket.id}> Name: <${nameTrimmed}> Rolle: <${role}> Spiel gestartet: <${gameStarted}>`);

        // Lobby-Reset-Trigger
        if (nameTrimmed.toLowerCase() === 'lobbyreset' || nameTrimmed.toLowerCase() === 'resetlobby') {
            console.log(`[${getTimestamp()}] [W] [resetLobby] Ausgelöst durch: ID: <${socket.id}>`);
            resetLobby();
            return;
        }

        if (archivedPlayer && !role) {
            console.log(`[${getTimestamp()}] [E] [join] Rolle aus archive extrahiert ID: ${socket.id} Name: <${archivedPlayer.name}> Rolle: <${archivedPlayer.role}>`);
            role = archivedPlayer.role;
        }

        // Prüfung: Name leer => Fehler
        if (!nameTrimmed) {
            console.log(`[${getTimestamp()}] [E] [join][Prüfung] Name leer: ID: ${socket.id}`);
            return socket.emit('joinError', 'Name darf nicht leer sein.');
        }

        // Prüfung: Name leer => Fehler
        if (nameTrimmed.length > 10) {
            console.log(`[${getTimestamp()}] [E] [join][Prüfung] Name zu lang: ID: <${socket.id}> Name: <${nameTrimmed}> Länge: <${nameTrimmed.length}>`);
            return socket.emit('joinError', 'Name darf max. 10 Zeichen haben.');
        }

        // Prüfung: Keine Rolle angegeben => Fehler
        if (!role) {
            console.log(`[${getTimestamp()}] [E] [join][Prüfung] Spieler ID: <${socket.id}> Name: <${nameTrimmed}> ohne Rolle <${role}> <${socket.id}>`);
            return socket.emit('joinError', 'Bitte eine Rolle auswählen.');
        }

        // Prüfung: Name doppelt => Fehler
        if (connectedPlayers.some(p => p.name === nameTrimmed)) {
            console.log(`[${getTimestamp()}] [E] [join][Prüfung] Name doppelt: ID: <${socket.id}> Name: <${nameTrimmed}>`);
            return socket.emit('joinError', 'Name bereits vergeben.');
        }

        // Spiel gestartet? Nur noch reconnects, mit gleicher Rolle oder ohne Rolle
        if (gameStarted) {
            // Neuer Spieler
            if (!archivedPlayer) {
                console.log(`[${getTimestamp()}] [E] [join][Prüfung] Spiel gestartet, neuer Spieler ID: ${socket.id} Name: <${nameTrimmed}>`);
                return socket.emit('joinError', 'Spiel bereits gestartet, keine Neuanmeldungen, nur Reconnects.');
            }

            // Bekannter Spieler, aber neue Rolle
            if (role !== archivedPlayer.role) {
                console.log(`[${getTimestamp()}] [E] [join][Prüfung] Spiel gestartet, bekannter Spieler ID: ${socket.id} Name: <${archivedPlayer.name}> Rolle: <${archivedPlayer.role}>, aber neue Rolle: <${role}>`);
                return socket.emit('joinError', 'Spiel bereits gestartet, keine Rollenänderungen, nur Reconnects.');
            }

            const playingPlayer = playingPlayers.find(player => player.name === archivedPlayer.name);
            console.log(`[${getTimestamp()}] [E] [join][Reconnect] Spieler ID: <${socket.id}> Name: <${archivedPlayer.name}> bekannt, updating ID <${playingPlayer.socketId}>`);
            playingPlayer.socketId = socket.id;
        } else {
            // Prüfung: Spieler bekannt, aber mit neuer Rolle, nur erlaubt solang Spiel nicht gestartet => Archive Updaten
            if (archivedPlayer && role !== archivedPlayer.role) {
                console.log(`[${getTimestamp()}] [E] [join][Prüfung] Spieler ID: <${socket.id}> Name: <${archivedPlayer.name}> bekannt, aber mit neuer Rolle: <${role}>`);
                archivedPlayer.role = role
            }
        }

        // Prüfung: Spieler bekannt, aber mit neuer Rolle, nur erlaubt solang Spiel nicht gestartet => Archive Updaten
        if (archivedPlayer && role == archivedPlayer.role) {
            console.log(`[${getTimestamp()}] [E] [join][Prüfung][Reconnect] Spieler ID: <${socket.id}> Name: <${archivedPlayer.name}> bekannt, mit gleicher Rolle: <${role}>`);
        }

        // Spieler zu connectedPlayers hinzufügen
        const newConnectedPlayer = {
            socketId: socket.id,
            name: nameTrimmed,
            role: role,
            isHost: connectedPlayers.length === 0
        };
        connectedPlayers.push(newConnectedPlayer);

        // Falls neuer Spieler: ins Archiv aufnehmen
        if (!archivedPlayer) {
            archivedPlayers.push({
                name: nameTrimmed,
                role: role
            });
        }

        console.log(`[${getTimestamp()}] [I] [join][joinSuccess] Name: <${newConnectedPlayer.name}> Rolle: <${newConnectedPlayer.role}> isHost: <${newConnectedPlayer.isHost}>`);
        // Rückmeldungen
        socket.emit('joinSuccess', newConnectedPlayer, connectedPlayers.length);
        socket.emit('gameStatusUpdate', gameStarted);
        io.emit('playerConnected');
    });

    // AUSTRITT
    socket.on('disconnect', () => {
        const disconnectedIndex = connectedPlayers.findIndex(p => p.socketId === socket.id);

        if (disconnectedIndex !== -1) {
            const disconnectedPlayer = connectedPlayers[disconnectedIndex];
            connectedPlayers.splice(disconnectedIndex, 1);

            console.log(`[${getTimestamp()}] [I] [disconnect] ID: <${disconnectedPlayer.socketId} Name: <${disconnectedPlayer.name}> Rolle: <${disconnectedPlayer.role}> isHost: <${disconnectedPlayer.isHost}>`);

            // Host-Übertragung falls nötig
            if (disconnectedPlayer.isHost && connectedPlayers.length > 0) {
                connectedPlayers[0].isHost = true;
                console.log(`[${getTimestamp()}] [I] [disconnect][Neuer Host] ID: <${connectedPlayers[0].socketId} Name: <${connectedPlayers[0].name}> Rolle: <${connectedPlayers[0].role}> isHost: <${connectedPlayers[0].isHost}>`);
                io.emit('newHost', connectedPlayers[0].socketId, connectedPlayers.length);
            }

            io.emit('playerDisconnected');
        }
    });

    // Spielerliste zurückgeben
    socket.on('requestConnectedPlayers', () => {
        socket.emit('updatePlayerList', connectedPlayers);
    });

    // Spielstatus zurückgeben
    socket.on('requestGameStatus', () => {
        socket.emit('updateGameStatus', gameStarted);
    });

    // Reset
    socket.on('resetLobby', () => {
        const player = connectedPlayers.find(p => p.socketId === socket.id);
        if (player?.isHost) {
            console.log(`[${getTimestamp()}] [I] [resetLobby] ID: <${player.socketId} Name: <${player.name}> isHost: <${connectedPlayers[0].isHost}>`);
            resetLobby();
        }
    });

    // Rollen Check aufrufen
    socket.on('requestRoleCheck', () => {
        socket.emit('checkRoles', connectedPlayers);
    });

    // Host transfer
    socket.on('transferHost', (newHostId) => {
        const currentHost = connectedPlayers.find(p => p.isHost);
        const newHost = connectedPlayers.find(p => p.socketId === newHostId);

        console.log(`[${getTimestamp()}] [I] [transferHost] Von ID: <${currentHost.socketId} Name: <${currentHost.name}> Nach ID: <${newHost.socketId} Name: <${newHost.name}>`);

        if (currentHost && newHost) {
            // Alten Host zurücksetzen
            currentHost.isHost = false;

            // Neuen Host setzen
            newHost.isHost = true;

            // Alle Clients updaten
            io.emit('updatePlayerList', connectedPlayers);
            io.emit('newHost', newHost.socketId, connectedPlayers.length);
        }
    });

    // Spiel starten
    socket.on('requestGameStart', () => {

        const currentPlayer = connectedPlayers.find(player => player.socketId === socket.id);
        const currentHost = connectedPlayers.find(p => p.isHost);

        if (currentPlayer !== currentHost) {
            console.log(`[${getTimestamp()}] [E] [gameStart] Nicht Host requestGameStart ID: <${currentPlayer.socketId} Name: <${currentPlayer.name}> isHost: <${currentPlayer.length}>`);
            return;
        }

        if (!gameStarted) {
            playingPlayers = [...connectedPlayers];
            gameStarted = true;

            // Spielinitialisierung hier...
            console.log(`[${getTimestamp()}] [I] [gameStart] ID: <${currentPlayer.socketId} Name: <${currentPlayer.name}> Playercount: <${connectedPlayers.length}>`);

            playingPlayers.forEach(player => {
                setupInfoMessage(player.socketId);
            });

            // Lobby starten
            io.emit('startGameStatus', gameStarted, currentHost.socketId, playingPlayers.length);
        }
    });

    // Spielinformationen zurückgeben
    socket.on('requestGameInfo', (playerSocketId) => {
        setupInfoMessage(playerSocketId);
    });

});











