// WebSocket client state
let socket = null;
let isConnected = false;

// Registered event callbacks
const socketCallbacks = {
    onTile: null,
    onDelete: null,
    onTilesUpdated: null,
    onConnect: null,
    onDisconnect: null,
    onConnected: null,
    onWordsChanged: null,
    onSeedSet: null,
    // Home gallery callbacks
    onPlantTile: null,
    onPlantDelete: null,
    onPlantTilesUpdated: null,
};

// Open a socket connection with optional username and mode
function connectSocket(username = null, mode = null) {
    if (socket) {
        console.warn('Socket already initialized');
        return;
    }

    // Build query options
    const query = {};
    if (username) query.username = username;
    if (mode) query.mode = mode;

    socket = io({ query });

    socket.on('connect', () => {
        console.log('WebSocket connected');
        isConnected = true;
        if (socketCallbacks.onConnect) {
            socketCallbacks.onConnect();
        }
    });

    socket.on('connected', (data) => {
        if (data.mode === 'home') {
            // console.log('Connected to home gallery');
        } else {
            // console.log(`Plant confirmed: ${data.plantId} with ${data.tileCount} tiles`);
        }
        if (socketCallbacks.onConnected) {
            socketCallbacks.onConnected(data);
        }
    });

    // Handle words changed (added/removed) by other clients
    socket.on('words:changed', (data) => {
        // console.log('Words changed by another client:', data);
        if (socketCallbacks.onWordsChanged) {
            socketCallbacks.onWordsChanged(data);
        }
    });

    socket.on('disconnect', () => {
        // console.log('WebSocket disconnected');
        isConnected = false;
        if (socketCallbacks.onDisconnect) {
            socketCallbacks.onDisconnect();
        }
    });

    socket.on('error', (data) => {
        console.error('WebSocket error:', data.message);
    });

    // Handle incoming tile updates from other clients (plant view)
    socket.on('tile', (data) => {
        // console.log('Received tile update:', data);
        if (socketCallbacks.onTile) {
            socketCallbacks.onTile(data);
        }
    });

    // Handle incoming deletions from other clients (plant view)
    socket.on('delete', (data) => {
        // console.log('Received tile delete:', data);
        if (socketCallbacks.onDelete) {
            socketCallbacks.onDelete(data);
        }
    });

    // Handle batch tile updates from other clients (plant view)
    socket.on('tiles:updated', (data) => {
        // console.log('Received tiles batch update:', data);
        if (socketCallbacks.onTilesUpdated) {
            socketCallbacks.onTilesUpdated(data);
        }
    });

    // Handle plant tile updates (home gallery)
    socket.on('plant:tile', (data) => {
        // console.log('Received plant tile update:', data);
        if (socketCallbacks.onPlantTile) {
            socketCallbacks.onPlantTile(data);
        }
    });

    // Handle plant tile deletions (home gallery)
    socket.on('plant:delete', (data) => {
        // console.log('Received plant delete:', data);
        if (socketCallbacks.onPlantDelete) {
            socketCallbacks.onPlantDelete(data);
        }
    });

    // Handle plant batch tile updates (home gallery)
    socket.on('plant:tiles:updated', (data) => {
        // console.log('Received plant tiles batch update:', data);
        if (socketCallbacks.onPlantTilesUpdated) {
            socketCallbacks.onPlantTilesUpdated(data);
        }
    });

    // Acknowledgments
    socket.on('tile:ack', (data) => {
        if (!data.success) {
            console.error('Tile save failed:', data);
        }
    });

    socket.on('delete:ack', (data) => {
        if (!data.success) {
            console.error('Tile delete failed:', data);
        }
    });

    socket.on('tiles:update:ack', (data) => {
        if (data.success) {
            // console.log(`Batch update saved: ${data.count} tiles`);
        } else {
            console.error('Batch update failed');
        }
    });

    socket.on('words:sync:ack', (data) => {
        if (data.success) {
            // console.log(`Words synced: +${data.added} added, -${data.removed} removed`);
        } else {
            console.error('Words sync failed');
        }
    });

    // Handle seed set acknowledgment
    socket.on('seed:set:ack', (data) => {
        if (data.success) {
            // console.log(`Seed set: ${data.seed}`);
            if (socketCallbacks.onSeedSet) {
                socketCallbacks.onSeedSet(data);
            }
        } else {
            console.error('Seed set failed');
        }
    });
}

// Emit a single tile placement/update
function emitTile(x, y, letter, blooming = false) {
    if (!socket || !isConnected) {
        console.warn('Socket not connected, cannot emit tile');
        return;
    }
    socket.emit('tile', { x, y, letter, blooming });
}

// Emit a tile deletion with optional disconnected tiles
function emitDelete(x, y, disconnected = []) {
    if (!socket || !isConnected) {
        console.warn('Socket not connected, cannot emit delete');
        return;
    }
    socket.emit('delete', { x, y, disconnected });
}

// Emit a batch tiles update
function emitTilesUpdate(tiles) {
    if (!socket || !isConnected) {
        console.warn('Socket not connected, cannot emit tiles update');
        return;
    }
    socket.emit('tiles:update', { tiles });
}

// Emit a word sync payload
function emitWordsSync(add = [], remove = []) {
    if (!socket || !isConnected) {
        console.warn('Socket not connected, cannot emit words sync');
        return;
    }
    socket.emit('words:sync', { add, remove });
}

// Emit a seed selection event
function emitSeedSet(word) {
    if (!socket || !isConnected) {
        console.warn('Socket not connected, cannot emit seed set');
        return;
    }
    socket.emit('seed:set', { word });
}

// Report whether the socket is connected
function isSocketConnected() {
    return isConnected;
}

// Register a callback for a socket event name
function onSocketEvent(event, callback) {
    switch (event) {
        case 'tile':
            socketCallbacks.onTile = callback;
            break;
        case 'delete':
            socketCallbacks.onDelete = callback;
            break;
        case 'tilesUpdated':
            socketCallbacks.onTilesUpdated = callback;
            break;
        case 'connect':
            socketCallbacks.onConnect = callback;
            break;
        case 'disconnect':
            socketCallbacks.onDisconnect = callback;
            break;
        case 'connected':
            socketCallbacks.onConnected = callback;
            break;
        case 'wordsChanged':
            socketCallbacks.onWordsChanged = callback;
            break;
        case 'seedSet':
            socketCallbacks.onSeedSet = callback;
            break;
        // Home gallery events
        case 'plantTile':
            socketCallbacks.onPlantTile = callback;
            break;
        case 'plantDelete':
            socketCallbacks.onPlantDelete = callback;
            break;
        case 'plantTilesUpdated':
            socketCallbacks.onPlantTilesUpdated = callback;
            break;
        default:
            console.warn('Unknown socket event:', event);
    }
}
