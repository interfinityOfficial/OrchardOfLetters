// Server configuration
const rpID = process.env.RP_ID || "localhost";
const port = process.env.PORT || 3004;
const origin = process.env.ORIGIN || "http://localhost:3004";

// Plant grid configuration
const SEED_WORD = "SEED";
const GRID_WIDTH = 49;
const GRID_HEIGHT = 49;
const SEED_X = Math.floor(GRID_WIDTH / 2);
const SEED_START_Y = GRID_HEIGHT - SEED_WORD.length;

module.exports = {
    rpID,
    port,
    origin,
    SEED_WORD,
    GRID_WIDTH,
    GRID_HEIGHT,
    SEED_X,
    SEED_START_Y,
};

