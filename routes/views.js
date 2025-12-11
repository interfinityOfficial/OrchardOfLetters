const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// Home page - show all plants from all users
router.get('/', async (req, res) => {
    const userId = req.session.userId;

    // Fetch all plants with their tiles and usernames (only plants with seed set)
    const plants = await prisma.plant.findMany({
        where: {
            seed: { not: null }  // Only show plants that have a seed set
        },
        include: {
            user: { select: { id: true, username: true } },
            tiles: {
                select: { x: true, y: true, letter: true, isSeed: true, blooming: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Calculate bounding box for each plant
    const padding = 1;
    const plantsData = plants.map(p => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const t of p.tiles) {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        }

        // Add padding
        minX = Math.max(-1, minX - padding);
        maxX = Math.min(49, maxX + padding);
        minY = Math.max(0, minY);
        maxY = Math.min(48, maxY);

        return {
            userId: p.user.id,
            username: p.user.username,
            tiles: p.tiles,
            bounds: {
                minX,
                maxX,
                minY,
                maxY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            }
        };
    });

    // If user is logged in, move their plant to the front
    if (userId) {
        const userPlantIndex = plantsData.findIndex(p => p.userId === userId);
        if (userPlantIndex > 0) {
            const [userPlant] = plantsData.splice(userPlantIndex, 1);
            plantsData.unshift(userPlant);
        }
    }

    res.render('home.ejs', {
        userId: userId,
        plants: JSON.stringify(plantsData)
    });
});

// Login page
router.get('/login/', async (req, res) => {
    if (req.session.userId) {
        return res.redirect('/plant/');
    }
    res.render('login.ejs');
});

// Signup page
router.get('/signup/', async (req, res) => {
    if (req.session.userId) {
        return res.redirect('/plant/');
    }
    res.render('signup.ejs');
});

// Info page
router.get('/about/', async (req, res) => {
    const userId = req.session.userId;
    res.render('about.ejs', {
        userId: userId
    });
});

// Privacy page
router.get('/privacy/', async (req, res) => {
    const userId = req.session.userId;
    res.render('privacy.ejs', {
        userId: userId
    });
});

router.post('/reset/', async (req, res) => {
    const userId = req.session.userId;

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { plantId } = req.body;
    await prisma.plant.update({
        where: { id: plantId },
        data: {
            seed: null,
            tiles: {
                deleteMany: {}
            },
            words: {
                deleteMany: {}
            }
        }
    });
    res.json({ success: true });
});

// Plant page - user's own plant (edit mode)
router.get('/plant/', async (req, res) => {
    // Require authentication
    if (!req.session.userId) {
        return res.redirect('/login/');
    }

    const userId = req.session.userId;

    // Get or create the user's plant
    let plant = await prisma.plant.findUnique({
        where: { userId },
        include: {
            tiles: true,
            words: true,
            user: { select: { username: true, isAdmin: true } }
        }
    });

    if (!plant) {
        // Create new plant WITHOUT seed tiles - user will choose their seed
        plant = await prisma.plant.create({
            data: {
                userId,
            },
            include: {
                tiles: true,
                words: true,
                user: { select: { username: true, isAdmin: true } }
            }
        });
    }

    // Format tiles for the frontend
    const tiles = plant.tiles.map(t => ({
        x: t.x,
        y: t.y,
        letter: t.letter,
        isSeed: t.isSeed,
        blooming: t.blooming
    }));

    // Extract words list
    const words = plant.words.map(w => w.word);

    res.render('plant.ejs', {
        userId: userId,
        plantId: plant.id,
        username: plant.user.username,
        isOwner: true,
        isAdmin: plant.user.isAdmin,
        canEdit: true,  // Owner can always edit
        seed: plant.seed || '',
        tiles: JSON.stringify(tiles),
        words: JSON.stringify(words)
    });
});

// View any user's plant by username (read-only for regular users, editable for admins)
router.get('/plant/:username/', async (req, res) => {
    const { username } = req.params;

    // Find the user and their plant
    const user = await prisma.user.findUnique({
        where: { username },
        include: {
            plant: {
                include: {
                    tiles: true,
                    words: true
                }
            }
        }
    });

    if (!user || !user.plant) {
        return res.status(404).send('Plant not found');
    }

    const plant = user.plant;

    // Check if the viewer is the owner
    const isOwner = req.session.userId === user.id;

    // If owner, redirect to edit view
    if (isOwner) {
        return res.redirect('/plant/');
    }

    // Don't allow viewing plants that don't have a seed yet
    if (!plant.seed) {
        return res.status(404).send('Plant not found');
    }

    // Check if logged-in user is an admin (admins can edit any plant)
    let isAdmin = false;
    if (req.session.userId) {
        const viewer = await prisma.user.findUnique({
            where: { id: req.session.userId },
            select: { isAdmin: true }
        });
        isAdmin = viewer?.isAdmin ?? false;
    }

    // Format tiles for the frontend
    const tiles = plant.tiles.map(t => ({
        x: t.x,
        y: t.y,
        letter: t.letter,
        isSeed: t.isSeed,
        blooming: t.blooming
    }));

    // Extract words list
    const words = plant.words.map(w => w.word);

    res.render('plant.ejs', {
        userId: req.session.userId || null,
        plantId: plant.id,
        username: username,
        isOwner: false,
        isAdmin: isAdmin,  // Show reset button for admins
        canEdit: isAdmin,  // Admins can edit any plant
        seed: plant.seed,
        tiles: JSON.stringify(tiles),
        words: JSON.stringify(words)
    });
});

module.exports = router;
