const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { GRID_WIDTH, GRID_HEIGHT } = require('../lib/config');

const rateLimitMap = new Map();

function checkRateLimit(socketId, event, limit = 10, windowMs = 1000) {
    const key = `${socketId}:${event}`;
    const now = Date.now();
    const record = rateLimitMap.get(key) || { count: 0, start: now };

    if (now - record.start > windowMs) {
        record.count = 1;
        record.start = now;
    } else {
        record.count++;
    }

    rateLimitMap.set(key, record);
    return record.count <= limit;
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
        if (now - record.start > 60000) {
            rateLimitMap.delete(key);
        }
    }
}, 60000);

const plantCache = new Map();
const CACHE_TTL = 60000;

function getCachedPlant(plantId) {
    const cached = plantCache.get(plantId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setCachedPlant(plantId, data) {
    plantCache.set(plantId, { data, timestamp: Date.now() });
}

function invalidatePlantCache(plantId) {
    plantCache.delete(plantId);
}

// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of plantCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
            plantCache.delete(key);
        }
    }
}, CACHE_TTL);

const tileUpdateQueues = new Map();

async function flushTileUpdates(plantId, io, plantUsername) {
    const queue = tileUpdateQueues.get(plantId);
    if (!queue || queue.tiles.length === 0) return;

    const tiles = [...queue.tiles];
    queue.tiles = [];

    try {
        // Batch upsert all tiles in a transaction
        await prisma.$transaction(
            tiles.map(({ x, y, letter, blooming }) =>
                prisma.tile.upsert({
                    where: { plantId_x_y: { plantId, x, y } },
                    update: { letter: letter.toUpperCase(), blooming: blooming ?? false },
                    create: {
                        plantId,
                        x,
                        y,
                        letter: letter.toUpperCase(),
                        isSeed: false,
                        blooming: blooming ?? false,
                    },
                })
            )
        );

        // Broadcast all tiles to plant room and home gallery
        for (const tile of tiles) {
            const tileData = {
                x: tile.x,
                y: tile.y,
                letter: tile.letter.toUpperCase(),
                isSeed: false,
                blooming: tile.blooming ?? false,
            };

            io.to(`plant:${plantId}`).emit('tile', tileData);
            io.to('home:gallery').emit('plant:tile', {
                username: plantUsername,
                ...tileData,
            });
        }

        // Invalidate cache after batch update
        invalidatePlantCache(plantId);
    } catch (err) {
        logger.error('Batch tile flush error:', err);
    }
}

function initializeSocket(io) {
    io.on('connection', async (socket) => {
        const session = socket.request.session;
        const viewerId = session?.userId;

        // Get connection mode and username from query
        const mode = socket.handshake.query.mode;
        const targetUsername = socket.handshake.query.username;

        // Home gallery mode - subscribe to all plant updates
        if (mode === 'home') {
            socket.join('home:gallery');
            logger.log('Client joined home gallery');

            socket.emit('connected', { mode: 'home' });

            socket.on('disconnect', () => {
                logger.log('Home gallery viewer disconnected');
            });
            return;
        }

        let plant;
        let isOwner = false;
        let canEdit = false; // True if owner OR admin
        let plantUsername = null;

        if (targetUsername) {
            // Viewing a specific user's plant by username
            const targetUser = await prisma.user.findUnique({
                where: { username: targetUsername },
                include: {
                    plant: {
                        include: {
                            tiles: true,
                            words: true,
                        },
                    },
                },
            });

            if (!targetUser || !targetUser.plant) {
                logger.log(`Plant not found for user: ${targetUsername}`);
                socket.emit('error', { message: 'Plant not found' });
                socket.disconnect();
                return;
            }

            plant = targetUser.plant;
            isOwner = viewerId === targetUser.id;
            plantUsername = targetUsername;

            // Check if viewer is an admin (admins can edit any plant)
            if (viewerId && !isOwner) {
                const viewer = await prisma.user.findUnique({
                    where: { id: viewerId },
                    select: { isAdmin: true },
                });
                canEdit = viewer?.isAdmin ?? false;
            } else {
                canEdit = isOwner;
            }

            logger.log(
                `User ${viewerId || 'anonymous'} viewing ${targetUsername}'s plant (owner: ${isOwner}, canEdit: ${canEdit})`
            );
        } else {
            // No username provided - must be authenticated to view own plant
            if (!viewerId) {
                logger.log('Unauthorized socket connection attempt');
                socket.emit('error', { message: 'Not authenticated' });
                socket.disconnect();
                return;
            }

            // Get or create the user's own plant
            plant = await prisma.plant.findUnique({
                where: { userId: viewerId },
                include: {
                    tiles: true,
                    words: true,
                    user: { select: { username: true } },
                },
            });

            if (!plant) {
                plant = await prisma.plant.create({
                    data: {
                        userId: viewerId,
                    },
                    include: {
                        tiles: true,
                        words: true,
                        user: { select: { username: true } },
                    },
                });
            }

            isOwner = true;
            canEdit = true; // Owner can always edit
            plantUsername = plant.user.username;
            logger.log(`User ${viewerId} (${plantUsername}) connected to their own plant`);
        }

        const plantId = plant.id;

        // Cache the plant data
        setCachedPlant(plantId, plant);

        // Join a room for this plant
        socket.join(`plant:${plantId}`);

        // Send initial state
        socket.emit('connected', {
            plantId,
            isOwner,
            canEdit,
            seed: plant.seed || null,
            tileCount: plant.tiles.length,
            validWords: plant.words.map((w) => w.word),
        });

        socket.on('seed:set', async (data) => {
            if (!checkRateLimit(socket.id, 'seed:set', 3, 10000)) {
                socket.emit('error', { message: 'Rate limited' });
                return;
            }

            if (!isOwner) {
                socket.emit('error', { message: 'Only the owner can set the seed word' });
                return;
            }

            const { word } = data;

            // Validate seed word
            if (typeof word !== 'string' || word.length < 5 || word.length > 8) {
                socket.emit('error', { message: 'Seed must be 5-8 letters' });
                return;
            }

            try {
                // Check if seed is already set
                const currentPlant = await prisma.plant.findUnique({
                    where: { id: plantId },
                    select: { seed: true },
                });

                if (currentPlant?.seed) {
                    socket.emit('error', { message: 'Seed already set' });
                    return;
                }

                const seedWord = word.toUpperCase();

                // Calculate seed position (center bottom)
                const seedX = Math.floor(GRID_WIDTH / 2);
                const seedStartY = GRID_HEIGHT - seedWord.length;

                // Use transaction for atomic seed creation
                const updatedPlant = await prisma.$transaction(async (tx) => {
                    // Delete any existing tiles first (in case of data corruption)
                    await tx.tile.deleteMany({
                        where: { plantId: plantId },
                    });

                    // Update plant with seed and create seed tiles
                    return tx.plant.update({
                        where: { id: plantId },
                        data: {
                            seed: seedWord,
                            tiles: {
                                create: seedWord.split('').map((letter, i) => ({
                                    x: seedX,
                                    y: seedStartY + i,
                                    letter: letter,
                                    isSeed: true,
                                    blooming: true,
                                })),
                            },
                        },
                        include: { tiles: true },
                    });
                });

                // Invalidate cache
                invalidatePlantCache(plantId);

                // Format tiles for response
                const tiles = updatedPlant.tiles.map((t) => ({
                    x: t.x,
                    y: t.y,
                    letter: t.letter,
                    isSeed: t.isSeed,
                    blooming: t.blooming,
                }));

                // Acknowledge to sender with tiles data
                socket.emit('seed:set:ack', {
                    success: true,
                    seed: seedWord,
                    tiles,
                });

                logger.log(`Seed set for plant ${plantId}: ${seedWord}`);
            } catch (err) {
                logger.error('Seed set error:', err);
                socket.emit('error', { message: 'Failed to set seed' });
            }
        });

        socket.on('tile', async (data) => {
            if (!checkRateLimit(socket.id, 'tile', 30, 1000)) {
                return;
            }

            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { x, y, letter, blooming } = data;

            // Validate input
            if (typeof x !== 'number' || typeof y !== 'number' || typeof letter !== 'string') {
                socket.emit('error', { message: 'Invalid tile data' });
                return;
            }

            // Initialize queue for this plant if needed
            if (!tileUpdateQueues.has(plantId)) {
                tileUpdateQueues.set(plantId, { tiles: [], timeout: null });
            }

            const queue = tileUpdateQueues.get(plantId);

            // Add tile to queue
            const existingIdx = queue.tiles.findIndex((t) => t.x === x && t.y === y);
            if (existingIdx >= 0) {
                queue.tiles[existingIdx] = { x, y, letter, blooming };
            } else {
                queue.tiles.push({ x, y, letter, blooming });
            }

            // Acknowledge immediately
            socket.emit('tile:ack', { x, y, success: true });

            // Debounce the flush
            if (queue.timeout) {
                clearTimeout(queue.timeout);
            }
            queue.timeout = setTimeout(() => {
                flushTileUpdates(plantId, io, plantUsername);
            }, 100);
        });

        socket.on('tiles:update', async (data) => {
            if (!checkRateLimit(socket.id, 'tiles:update', 10, 1000)) {
                socket.emit('error', { message: 'Rate limited' });
                return;
            }

            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { tiles } = data;

            if (!Array.isArray(tiles)) {
                socket.emit('error', { message: 'Invalid tiles data' });
                return;
            }

            try {
                // Use transaction for batch update
                await prisma.$transaction(
                    tiles.map((tile) =>
                        prisma.tile.updateMany({
                            where: {
                                plantId,
                                x: tile.x,
                                y: tile.y,
                                isSeed: false,
                            },
                            data: {
                                blooming: tile.blooming ?? false,
                            },
                        })
                    )
                );

                // Invalidate cache
                invalidatePlantCache(plantId);

                // Broadcast to other clients viewing this plant
                socket.to(`plant:${plantId}`).emit('tiles:updated', { tiles });

                // Broadcast to home gallery viewers
                io.to('home:gallery').emit('plant:tiles:updated', {
                    username: plantUsername,
                    tiles,
                });

                socket.emit('tiles:update:ack', { success: true, count: tiles.length });
            } catch (err) {
                logger.error('Batch tile update error:', err);
                socket.emit('error', { message: 'Failed to update tiles' });
            }
        });

        socket.on('delete', async (data) => {
            if (!checkRateLimit(socket.id, 'delete', 20, 1000)) {
                return;
            }

            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { x, y, disconnected = [] } = data;

            try {
                // Use transaction for atomic deletion
                await prisma.$transaction(async (tx) => {
                    // Delete the main tile (only if not a seed)
                    await tx.tile.deleteMany({
                        where: {
                            plantId,
                            x,
                            y,
                            isSeed: false,
                        },
                    });

                    // Delete any disconnected tiles
                    if (disconnected.length > 0) {
                        await tx.tile.deleteMany({
                            where: {
                                plantId,
                                OR: disconnected.map((pos) => ({ x: pos.x, y: pos.y })),
                                isSeed: false,
                            },
                        });
                    }
                });

                // Invalidate cache
                invalidatePlantCache(plantId);

                const deleteData = { x, y, disconnected };

                // Broadcast to other clients viewing this plant
                socket.to(`plant:${plantId}`).emit('delete', deleteData);

                // Broadcast to home gallery viewers
                io.to('home:gallery').emit('plant:delete', {
                    username: plantUsername,
                    ...deleteData,
                });

                // Acknowledge to sender
                socket.emit('delete:ack', { x, y, success: true });
            } catch (err) {
                logger.error('Tile delete error:', err);
                socket.emit('error', { message: 'Failed to delete tile' });
            }
        });

        socket.on('words:sync', async (data) => {
            if (!checkRateLimit(socket.id, 'words:sync', 5, 1000)) {
                socket.emit('error', { message: 'Rate limited' });
                return;
            }

            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { add = [], remove = [] } = data;

            try {
                // Normalize words to add
                const wordsToAdd = (Array.isArray(add) ? add : [])
                    .map((w) => w.trim().toUpperCase())
                    .filter((w) => w.length >= 2);

                // Normalize words to remove
                const wordsToRemove = (Array.isArray(remove) ? remove : [])
                    .map((w) => w.trim().toUpperCase())
                    .filter((w) => w.length >= 2);

                // Use transaction for atomic word operations
                await prisma.$transaction(async (tx) => {
                    // Remove expanded words first
                    if (wordsToRemove.length > 0) {
                        await tx.plantWord.deleteMany({
                            where: {
                                plantId,
                                word: { in: wordsToRemove },
                            },
                        });
                    }

                    // Add new words
                    if (wordsToAdd.length > 0) {
                        await tx.plantWord.createMany({
                            data: wordsToAdd.map((word) => ({
                                plantId,
                                word,
                            })),
                            skipDuplicates: true,
                        });
                    }
                });

                // Acknowledge to sender
                socket.emit('words:sync:ack', {
                    success: true,
                    added: wordsToAdd.length,
                    removed: wordsToRemove.length,
                });

                // Broadcast changes to other clients
                if (wordsToAdd.length > 0 || wordsToRemove.length > 0) {
                    socket.to(`plant:${plantId}`).emit('words:changed', {
                        added: wordsToAdd,
                        removed: wordsToRemove,
                    });
                }
            } catch (err) {
                logger.error('Words sync error:', err);
                socket.emit('error', { message: 'Failed to sync words' });
            }
        });

        socket.on('disconnect', () => {
            logger.log(`Viewer disconnected from plant ${plantId}`);

            // Clean up any pending tile updates for this socket
            const queue = tileUpdateQueues.get(plantId);
            if (queue && queue.timeout) {
                clearTimeout(queue.timeout);
                // Flush remaining tiles before disconnect
                flushTileUpdates(plantId, io, plantUsername);
            }
        });
    });
}

module.exports = { initializeSocket };
