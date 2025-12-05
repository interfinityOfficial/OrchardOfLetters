const prisma = require('../lib/prisma');
const { GRID_WIDTH, GRID_HEIGHT } = require('../lib/config');

/**
 * Initialize Socket.IO handlers
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
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
            console.log('Client joined home gallery');

            socket.emit('connected', { mode: 'home' });

            socket.on('disconnect', () => {
                console.log('Home gallery viewer disconnected');
            });
            return;  // Don't process further - home mode only receives updates
        }

        let plant;
        let isOwner = false;
        let canEdit = false;  // True if owner OR admin
        let plantUsername = null;  // Track the username for this plant

        if (targetUsername) {
            // Viewing a specific user's plant by username
            const targetUser = await prisma.user.findUnique({
                where: { username: targetUsername },
                include: {
                    plant: {
                        include: {
                            tiles: true,
                            words: true
                        }
                    }
                }
            });

            if (!targetUser || !targetUser.plant) {
                console.log(`Plant not found for user: ${targetUsername}`);
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
                    select: { isAdmin: true }
                });
                canEdit = viewer?.isAdmin ?? false;
            } else {
                canEdit = isOwner;
            }

            console.log(`User ${viewerId || 'anonymous'} viewing ${targetUsername}'s plant (owner: ${isOwner}, canEdit: ${canEdit})`);
        } else {
            // No username provided - must be authenticated to view own plant
            if (!viewerId) {
                console.log('Unauthorized socket connection attempt');
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
                    user: { select: { username: true } }
                }
            });

            if (!plant) {
                // Create new plant WITHOUT seed tiles - user will choose their seed
                plant = await prisma.plant.create({
                    data: {
                        userId: viewerId,
                    },
                    include: {
                        tiles: true,
                        words: true,
                        user: { select: { username: true } }
                    }
                });
            }

            isOwner = true;
            canEdit = true;  // Owner can always edit
            plantUsername = plant.user.username;
            console.log(`User ${viewerId} (${plantUsername}) connected to their own plant`);
        }

        const plantId = plant.id;

        // Join a room for this plant (for multi-viewer support)
        socket.join(`plant:${plantId}`);

        // Send initial state
        socket.emit('connected', {
            plantId,
            isOwner,
            canEdit,
            seed: plant.seed || null,
            tileCount: plant.tiles.length,
            validWords: plant.words.map(w => w.word)
        });

        // Handle seed word setting (owner only, one-time - admins cannot set seed for others)
        socket.on('seed:set', async (data) => {
            if (!isOwner) {
                socket.emit('error', { message: 'Only the owner can set the seed word' });
                return;
            }

            const { word } = data;

            try {
                // Check if seed is already set
                const currentPlant = await prisma.plant.findUnique({
                    where: { id: plantId },
                    select: { seed: true }
                });

                if (currentPlant.seed) {
                    socket.emit('error', { message: 'Seed already set' });
                    return;
                }

                // Validate seed word
                if (typeof word !== 'string' || word.length < 5 || word.length > 8) {
                    socket.emit('error', { message: 'Seed must be 5-8 letters' });
                    return;
                }

                // Check if seed is already set
                const existingPlant = await prisma.plant.findUnique({
                    where: { id: plantId },
                    select: { seed: true }
                });

                if (existingPlant?.seed) {
                    socket.emit('error', { message: 'Seed is already set' });
                    return;
                }

                const seedWord = word.toUpperCase();

                // Calculate seed position (center bottom)
                const seedX = Math.floor(GRID_WIDTH / 2);
                const seedStartY = GRID_HEIGHT - seedWord.length;

                // Delete any existing tiles first (in case of data corruption)
                await prisma.tile.deleteMany({
                    where: { plantId: plantId }
                });

                // Update plant with seed and create seed tiles
                const updatedPlant = await prisma.plant.update({
                    where: { id: plantId },
                    data: {
                        seed: seedWord,
                        tiles: {
                            create: seedWord.split('').map((letter, i) => ({
                                x: seedX,
                                y: seedStartY + i,
                                letter: letter,
                                isSeed: true,
                                blooming: true
                            }))
                        }
                    },
                    include: {
                        tiles: true
                    }
                });

                // Format tiles for response
                const tiles = updatedPlant.tiles.map(t => ({
                    x: t.x,
                    y: t.y,
                    letter: t.letter,
                    isSeed: t.isSeed,
                    blooming: t.blooming
                }));

                // Acknowledge to sender with tiles data
                socket.emit('seed:set:ack', {
                    success: true,
                    seed: seedWord,
                    tiles
                });

                console.log(`Seed set for plant ${plantId}: ${seedWord}`);

            } catch (err) {
                console.error('Seed set error:', err);
                socket.emit('error', { message: 'Failed to set seed' });
            }
        });

        // Handle tile placement/update (owner or admin)
        socket.on('tile', async (data) => {
            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { x, y, letter, blooming } = data;

            try {
                // Validate input
                if (typeof x !== 'number' || typeof y !== 'number' || typeof letter !== 'string') {
                    socket.emit('error', { message: 'Invalid tile data' });
                    return;
                }

                // Upsert the tile
                await prisma.tile.upsert({
                    where: {
                        plantId_x_y: { plantId, x, y }
                    },
                    update: {
                        letter: letter.toUpperCase(),
                        blooming: blooming ?? false
                    },
                    create: {
                        plantId,
                        x,
                        y,
                        letter: letter.toUpperCase(),
                        isSeed: false,
                        blooming: blooming ?? false
                    }
                });

                const tileData = {
                    x,
                    y,
                    letter: letter.toUpperCase(),
                    isSeed: false,
                    blooming: blooming ?? false
                };

                // Broadcast to other clients viewing this plant
                socket.to(`plant:${plantId}`).emit('tile', tileData);

                // Broadcast to home gallery viewers
                io.to('home:gallery').emit('plant:tile', {
                    username: plantUsername,
                    ...tileData
                });

                // Acknowledge to sender
                socket.emit('tile:ack', { x, y, success: true });

            } catch (err) {
                console.error('Tile update error:', err);
                socket.emit('error', { message: 'Failed to save tile' });
            }
        });

        // Handle batch tile updates (owner or admin)
        socket.on('tiles:update', async (data) => {
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
                // Update each tile's blooming state
                const updates = tiles.map(tile =>
                    prisma.tile.updateMany({
                        where: {
                            plantId,
                            x: tile.x,
                            y: tile.y,
                            isSeed: false
                        },
                        data: {
                            blooming: tile.blooming ?? false
                        }
                    })
                );

                await Promise.all(updates);

                // Broadcast to other clients viewing this plant
                socket.to(`plant:${plantId}`).emit('tiles:updated', { tiles });

                // Broadcast to home gallery viewers
                io.to('home:gallery').emit('plant:tiles:updated', {
                    username: plantUsername,
                    tiles
                });

                socket.emit('tiles:update:ack', { success: true, count: tiles.length });

            } catch (err) {
                console.error('Batch tile update error:', err);
                socket.emit('error', { message: 'Failed to update tiles' });
            }
        });

        // Handle tile deletion (owner or admin)
        socket.on('delete', async (data) => {
            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { x, y, disconnected = [] } = data;

            try {
                // Delete the main tile (only if not a seed)
                await prisma.tile.deleteMany({
                    where: {
                        plantId,
                        x,
                        y,
                        isSeed: false
                    }
                });

                // Delete any disconnected tiles
                if (disconnected.length > 0) {
                    await prisma.tile.deleteMany({
                        where: {
                            plantId,
                            OR: disconnected.map(pos => ({ x: pos.x, y: pos.y })),
                            isSeed: false
                        }
                    });
                }

                const deleteData = { x, y, disconnected };

                // Broadcast to other clients viewing this plant
                socket.to(`plant:${plantId}`).emit('delete', deleteData);

                // Broadcast to home gallery viewers
                io.to('home:gallery').emit('plant:delete', {
                    username: plantUsername,
                    ...deleteData
                });

                // Acknowledge to sender
                socket.emit('delete:ack', { x, y, success: true });

            } catch (err) {
                console.error('Tile delete error:', err);
                socket.emit('error', { message: 'Failed to delete tile' });
            }
        });

        // Handle batch word sync (owner or admin)
        socket.on('words:sync', async (data) => {
            if (!canEdit) {
                socket.emit('error', { message: 'Not authorized to edit this plant' });
                return;
            }

            const { add = [], remove = [] } = data;

            try {
                // Normalize words to add
                const wordsToAdd = (Array.isArray(add) ? add : [])
                    .map(w => w.trim().toUpperCase())
                    .filter(w => w.length >= 2);

                // Normalize words to remove
                const wordsToRemove = (Array.isArray(remove) ? remove : [])
                    .map(w => w.trim().toUpperCase())
                    .filter(w => w.length >= 2);

                // Remove expanded words first
                if (wordsToRemove.length > 0) {
                    await prisma.plantWord.deleteMany({
                        where: {
                            plantId,
                            word: { in: wordsToRemove }
                        }
                    });
                }

                // Add new words
                if (wordsToAdd.length > 0) {
                    await prisma.plantWord.createMany({
                        data: wordsToAdd.map(word => ({
                            plantId,
                            word
                        })),
                        skipDuplicates: true
                    });
                }

                // Acknowledge to sender
                socket.emit('words:sync:ack', {
                    success: true,
                    added: wordsToAdd.length,
                    removed: wordsToRemove.length
                });

                // Broadcast changes to other clients
                if (wordsToAdd.length > 0 || wordsToRemove.length > 0) {
                    socket.to(`plant:${plantId}`).emit('words:changed', {
                        added: wordsToAdd,
                        removed: wordsToRemove
                    });
                }

            } catch (err) {
                console.error('Words sync error:', err);
                socket.emit('error', { message: 'Failed to sync words' });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`Viewer disconnected from plant ${plantId}`);
        });
    });
}

module.exports = { initializeSocket };
