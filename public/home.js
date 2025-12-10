const COLORS = {
    background: '#FFFFFF',
    secondary: '#EBEBEB',
    seed: '#124434',
    blooming: '#36856B',
    withering: '#7C5F4C',
    sign: '#B0866A',
    apple: '#FE5457',
};

// Load apple image for letter O
const appleImage = new Image();
appleImage.src = '/assets/apple.png';
let appleImageLoaded = false;
appleImage.onload = () => {
    appleImageLoaded = true;
};

const MINIMAP_PIXEL_SIZE = 3;
const MINIMAP_PADDING = 14.5;
const MINIMAP_BORDER_WIDTH = 3;

const MAX_CELL_SIZE = 52;
const GRID_HEIGHT = 49;
const SIGN_PADDING_CELLS = 1;

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const canvas = document.getElementById('home-canvas');
const ctx = canvas.getContext('2d');

const camera = { x: 0, y: 0 };

let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let mouseDownPos = { x: 0, y: 0 };

let maxBoundsWidth = 0;
let maxBoundsHeight = 0;
let totalWorldWidth = 0;
let totalMinimapContentWidth = 0;

const plants = [];
const plantsByUsername = new Map();

const plantLayouts = [];

let minimapCanvas = null;
let minimapCtx = null;
let minimapPlantOffsets = [];

// Compute current grid cell size based on viewport height
function getCellSize() {
    const maxHeight = window.innerHeight;
    return Math.min(maxHeight / maxBoundsHeight, MAX_CELL_SIZE);
}

// Measure sign board width for a username
function getSignBoardWidth(username, cellSize) {
    const signFontSize = Math.floor(cellSize * 0.55);
    const signPadding = cellSize * 0.25;
    ctx.font = `normal ${signFontSize}px "Retro", monospace`;
    ctx.letterSpacing = '2px';
    const textWidth = ctx.measureText(username.toUpperCase()).width + 2;
    ctx.letterSpacing = '0px';
    return textWidth + signPadding * 2;
}

// Calculate extra sign width needed to keep spacing
function getExtraSignWidth(plant, cellSize) {
    const { tiles, bounds, username } = plant;
    const seedTile = tiles.find(t => t.isSeed);
    if (!seedTile) return 0;

    const seedRelX = seedTile.x - bounds.minX;
    const boardWidth = getSignBoardWidth(username, cellSize);
    const signLeftEdge = seedRelX * cellSize - SIGN_PADDING_CELLS * cellSize - boardWidth;
    const minLeftPadding = cellSize;

    if (signLeftEdge < minLeftPadding) {
        const extraNeeded = minLeftPadding - signLeftEdge;
        return Math.ceil(extraNeeded / cellSize) * cellSize;
    }
    return 0;
}

// Draw the username sign at a world position
function drawUsernameSign(username, signCenterX, groundY, cellSize) {
    const signFontSize = Math.floor(cellSize * 0.55);
    const postWidth = cellSize / 5;
    const pinSize = Math.floor(cellSize / 8);
    const signPadding = cellSize * 0.25;

    ctx.font = `normal ${signFontSize}px "Retro", monospace`;
    ctx.letterSpacing = '2px';
    const textWidth = ctx.measureText(username.toUpperCase()).width + 2;
    const boardWidth = textWidth + signPadding * 2;
    const boardHeight = cellSize;
    const stemHeight = cellSize;

    const boardY = groundY - stemHeight - boardHeight;
    const boardX = signCenterX - boardWidth / 2;

    ctx.fillStyle = COLORS.sign;
    ctx.fillRect(
        signCenterX - postWidth / 2,
        boardY + boardHeight - 2,
        postWidth,
        stemHeight + 2
    );

    ctx.fillStyle = COLORS.sign;
    ctx.fillRect(boardX, boardY, boardWidth, boardHeight);

    ctx.fillStyle = COLORS.withering;
    ctx.fillRect(boardX + pinSize, boardY + pinSize, pinSize, pinSize);
    ctx.fillRect(boardX + boardWidth - pinSize * 2, boardY + pinSize, pinSize, pinSize);
    ctx.fillRect(boardX + pinSize, boardY + boardHeight - pinSize * 2, pinSize, pinSize);
    ctx.fillRect(boardX + boardWidth - pinSize * 2, boardY + boardHeight - pinSize * 2, pinSize, pinSize);

    ctx.fillStyle = COLORS.background;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textY = boardY + boardHeight / 2 + (isSafari ? signFontSize * 0.14 : signFontSize * 0.12);
    ctx.fillText(username.toUpperCase(), signCenterX + 1, textY);
    ctx.letterSpacing = '0px';
}

// Render a single plant layout onto the main canvas
function drawPlant(layout) {
    const { plant, worldX, extraSignWidth } = layout;
    const { tiles, bounds, username } = plant;
    const cellSize = getCellSize();
    const fontSize = Math.floor(cellSize * 0.8846);
    const canvasHeight = window.innerHeight;

    const plantHeight = bounds.height * cellSize;
    const offsetX = worldX + extraSignWidth;
    const offsetY = canvasHeight - plantHeight;

    const seedTile = tiles.find(t => t.isSeed);
    let signCenterX = 0;
    let groundY = canvasHeight;
    if (seedTile) {
        const seedRelX = seedTile.x - bounds.minX;
        const boardWidth = getSignBoardWidth(username, cellSize);
        const seedLeftEdge = offsetX + seedRelX * cellSize;
        signCenterX = seedLeftEdge - SIGN_PADDING_CELLS * cellSize - boardWidth / 2;
        groundY = canvasHeight;
    }

    ctx.font = `normal ${fontSize}px "Retro", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const seedTiles = [];
    const bloomingTilesByAlpha = new Map();
    const witheringTilesByAlpha = new Map();

    for (const tile of tiles) {
        const { isSeed, blooming, y } = tile;

        if (isSeed) {
            seedTiles.push(tile);
        } else {
            const baseAlpha = Math.round((0.5 + (y / (GRID_HEIGHT - 1)) * 0.5) * 100) / 100;

            if (blooming) {
                if (!bloomingTilesByAlpha.has(baseAlpha)) {
                    bloomingTilesByAlpha.set(baseAlpha, []);
                }
                bloomingTilesByAlpha.get(baseAlpha).push(tile);
            } else {
                if (!witheringTilesByAlpha.has(baseAlpha)) {
                    witheringTilesByAlpha.set(baseAlpha, []);
                }
                witheringTilesByAlpha.get(baseAlpha).push(tile);
            }
        }
    }

    const yOffset = isSafari ? cellSize * 0.1 : cellSize * 0.094;

    if (seedTiles.length > 0) {
        ctx.fillStyle = COLORS.seed;
        ctx.globalAlpha = 1;
        for (const tile of seedTiles) {
            const relX = tile.x - bounds.minX;
            const relY = tile.y - bounds.minY;
            const centerX = offsetX + relX * cellSize + cellSize / 2;
            const centerY = offsetY + relY * cellSize + cellSize / 2;
            ctx.fillText(tile.letter, centerX, centerY + yOffset);
        }
    }

    ctx.fillStyle = COLORS.blooming;
    for (const [alpha, alphaTiles] of bloomingTilesByAlpha) {
        ctx.globalAlpha = alpha;
        for (const tile of alphaTiles) {
            const relX = tile.x - bounds.minX;
            const relY = tile.y - bounds.minY;
            const centerX = offsetX + relX * cellSize + cellSize / 2;
            const centerY = offsetY + relY * cellSize + cellSize / 2;
            if (tile.letter.toUpperCase() === 'O' && appleImageLoaded) {
                const appleX = offsetX + relX * cellSize + cellSize / 7 * 1.2;
                const appleY = offsetY + relY * cellSize + cellSize / 7 * 1.2;
                const appleSize = cellSize / 7 * 4.6;
                ctx.drawImage(appleImage, appleX, appleY, appleSize, appleSize);
            } else {
                ctx.fillText(tile.letter, centerX, centerY + yOffset);
            }
        }
    }

    ctx.fillStyle = COLORS.withering;
    for (const [alpha, alphaTiles] of witheringTilesByAlpha) {
        ctx.globalAlpha = alpha;
        for (const tile of alphaTiles) {
            const relX = tile.x - bounds.minX;
            const relY = tile.y - bounds.minY;
            const centerX = offsetX + relX * cellSize + cellSize / 2;
            const centerY = offsetY + relY * cellSize + cellSize / 2;
            if (tile.letter.toUpperCase() === 'O' && appleImageLoaded) {
                const appleX = offsetX + relX * cellSize + cellSize / 7 * 1.2;
                const appleY = offsetY + relY * cellSize + cellSize / 7 * 1.2;
                const appleSize = cellSize / 7 * 4.6;
                ctx.drawImage(appleImage, appleX, appleY, appleSize, appleSize);
            } else {
                ctx.fillText(tile.letter, centerX, centerY + yOffset);
            }
        }
    }

    ctx.globalAlpha = 1;

    if (seedTile) {
        drawUsernameSign(username, signCenterX, groundY, cellSize);
    }
}

// Compute plant world positions and minimap offsets
function calculatePlantLayouts() {
    const cellSize = getCellSize();
    let currentX = cellSize * 2;

    plantLayouts.length = 0;
    minimapPlantOffsets = [];

    let minimapCurrentX = 2;

    for (const plant of plants) {
        const extraSignWidth = getExtraSignWidth(plant, cellSize);
        const plantWidth = plant.bounds.width * cellSize + extraSignWidth;

        plantLayouts.push({
            plant,
            worldX: currentX,
            width: plantWidth,
            extraSignWidth
        });

        const extraSignWidthCells = Math.ceil(extraSignWidth / cellSize);

        minimapPlantOffsets.push({
            username: plant.username,
            offsetX: (minimapCurrentX + extraSignWidthCells) * MINIMAP_PIXEL_SIZE,
            width: plant.bounds.width * MINIMAP_PIXEL_SIZE
        });

        currentX += plantWidth;
        minimapCurrentX += plant.bounds.width + extraSignWidthCells;
    }

    totalWorldWidth = currentX + cellSize * 2;
    totalMinimapContentWidth = (minimapCurrentX + 2) * MINIMAP_PIXEL_SIZE;
}

// Keep the camera inside world bounds
function clampCamera() {
    const { innerWidth, innerHeight } = window;

    const maxX = 0;
    const minX = innerWidth - totalWorldWidth;

    camera.x = Math.min(maxX, Math.max(minX, camera.x));
    camera.y = 0;
}

// Check whether a plant layout is visible in the viewport
function isPlantVisible(layout) {
    const { worldX, width } = layout;
    const { innerWidth } = window;

    const screenLeft = worldX + camera.x;
    const screenRight = screenLeft + width;

    return screenRight > 0 && screenLeft < innerWidth;
}

// Find the plant whose sign sits under the given screen point
function getPlantSignAtScreen(screenX, screenY) {
    const worldX = screenX - camera.x;
    const worldY = screenY - camera.y;
    const cellSize = getCellSize();
    const canvasHeight = window.innerHeight;

    const boardHeight = cellSize;
    const stemHeight = cellSize;
    const boardY = canvasHeight - stemHeight - boardHeight;

    if (worldY < boardY || worldY > boardY + boardHeight) {
        return null;
    }

    for (const layout of plantLayouts) {
        const { plant, worldX: plantWorldX, extraSignWidth } = layout;
        const { tiles, bounds, username } = plant;

        const seedTile = tiles.find(t => t.isSeed);
        if (!seedTile) continue;

        const offsetX = plantWorldX + extraSignWidth;
        const seedRelX = seedTile.x - bounds.minX;
        const boardWidth = getSignBoardWidth(username, cellSize);
        const seedLeftEdge = offsetX + seedRelX * cellSize;
        const signCenterX = seedLeftEdge - SIGN_PADDING_CELLS * cellSize - boardWidth / 2;
        const boardX = signCenterX - boardWidth / 2;

        if (worldX >= boardX && worldX <= boardX + boardWidth) {
            return plant;
        }
    }
    return null;
}

// Handle window resize: resize canvas and recompute layouts
function resize() {
    const { innerWidth, innerHeight } = window;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;

    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    calculatePlantLayouts();
    clampCamera();
    updateMinimapSize();
}

// Main draw loop for canvas and minimap
function draw() {
    const { innerWidth, innerHeight } = window;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    ctx.save();
    ctx.translate(camera.x, camera.y);

    for (const layout of plantLayouts) {
        if (isPlantVisible(layout)) {
            drawPlant(layout);
        }
    }

    ctx.restore();

    drawMinimap();

    requestAnimationFrame(draw);
}


// Create and initialize the minimap canvas
function initMinimap() {
    minimapCanvas = document.createElement('canvas');

    document.getElementById('minimap').appendChild(minimapCanvas);
    minimapCtx = minimapCanvas.getContext('2d');

    minimapCanvas.addEventListener('click', handleMinimapClick);
    // minimapCanvas.addEventListener('mousedown', handleMinimapDrag);

    updateMinimapSize();
}

// Resize the minimap to fit current plant layouts
function updateMinimapSize() {
    if (!minimapCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const minimapHeight = maxBoundsHeight * MINIMAP_PIXEL_SIZE + MINIMAP_BORDER_WIDTH * 2;

    let totalMinimapWidth = 0;
    for (const offset of minimapPlantOffsets) {
        totalMinimapWidth = Math.max(totalMinimapWidth, offset.offsetX + offset.width);
    }
    totalMinimapWidth += 2 * MINIMAP_PIXEL_SIZE;

    const minimapWidth = totalMinimapWidth + MINIMAP_BORDER_WIDTH * 2;

    minimapCanvas.width = minimapWidth * dpr;
    minimapCanvas.height = minimapHeight * dpr;
    document.documentElement.style.setProperty('--minimap-width', `${minimapWidth}px`);

    minimapCtx.setTransform(1, 0, 0, 1, 0, 0);
    minimapCtx.scale(dpr, dpr);
}

// Render minimap tiles and viewport indicator
function drawMinimap() {
    if (!minimapCanvas || !minimapCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const minimapWidth = minimapCanvas.width / dpr;
    const minimapHeight = minimapCanvas.height / dpr;
    const { innerWidth } = window;

    if (totalWorldWidth <= innerWidth) {
        minimapCanvas.style.display = 'none';
        return;
    } else {
        minimapCanvas.style.display = 'block';
    }

    minimapCtx.setTransform(1, 0, 0, 1, 0, 0);
    minimapCtx.scale(dpr, dpr);

    minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight);

    minimapCtx.strokeStyle = COLORS.secondary;
    minimapCtx.lineWidth = MINIMAP_BORDER_WIDTH;
    minimapCtx.strokeRect(
        MINIMAP_BORDER_WIDTH / 2,
        MINIMAP_BORDER_WIDTH / 2,
        minimapWidth - MINIMAP_BORDER_WIDTH,
        minimapHeight - MINIMAP_BORDER_WIDTH
    );

    const innerPadding = MINIMAP_BORDER_WIDTH;

    for (let i = 0; i < minimapPlantOffsets.length; i++) {
        const { username, offsetX } = minimapPlantOffsets[i];
        const plant = plantsByUsername.get(username);
        if (!plant) continue;

        const { bounds, tiles } = plant;

        for (const tile of tiles) {
            const { x, y, letter, isSeed, blooming } = tile;

            if (isSeed) {
                minimapCtx.fillStyle = COLORS.seed;
            } else if (letter && letter.toUpperCase() === 'O') {
                minimapCtx.fillStyle = COLORS.apple;
            } else if (blooming) {
                minimapCtx.fillStyle = COLORS.blooming;
            } else {
                minimapCtx.fillStyle = COLORS.withering;
            }

            const relX = x - bounds.minX;
            const relY = y - bounds.minY;
            const verticalOffset = (maxBoundsHeight - bounds.height) * MINIMAP_PIXEL_SIZE;

            const pixelX = innerPadding + offsetX + relX * MINIMAP_PIXEL_SIZE;
            const pixelY = innerPadding + verticalOffset + relY * MINIMAP_PIXEL_SIZE;

            minimapCtx.fillRect(pixelX, pixelY, MINIMAP_PIXEL_SIZE, MINIMAP_PIXEL_SIZE);
        }
    }

    const scale = totalMinimapContentWidth / totalWorldWidth;

    const viewportX = innerPadding + (-camera.x) * scale;
    const viewportW = innerWidth * scale;

    const viewportLineWidth = 3;
    const halfLine = viewportLineWidth / 2;

    minimapCtx.strokeStyle = '#000000';
    minimapCtx.lineWidth = viewportLineWidth;
    minimapCtx.strokeRect(
        viewportX - halfLine,
        innerPadding - halfLine,
        viewportW + viewportLineWidth,
        minimapHeight - innerPadding * 2 + viewportLineWidth
    );
}

// Pan camera to the clicked minimap position
function handleMinimapClick(e) {
    const dpr = window.devicePixelRatio || 1;
    const rect = minimapCanvas.getBoundingClientRect();

    const renderedWidth = rect.width;
    const logicalWidth = minimapCanvas.width / dpr;
    const cssScale = renderedWidth / logicalWidth;

    const clickX = (e.clientX - rect.left) / cssScale;
    const { innerWidth } = window;

    const innerPadding = MINIMAP_BORDER_WIDTH;
    const scale = totalMinimapContentWidth / totalWorldWidth;

    const targetWorldX = (clickX - innerPadding) / scale;
    const targetCameraX = -(targetWorldX - innerWidth / 2);

    const maxX = 0;
    const minX = innerWidth - totalWorldWidth;
    const clampedTarget = Math.min(maxX, Math.max(minX, targetCameraX));

    gsap.to(camera, {
        x: clampedTarget,
        duration: 0.5,
        ease: "power1.inOut"
    });
}

// Drag the minimap viewport to pan the camera
function handleMinimapDrag(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startCameraX = camera.x;

    const dpr = window.devicePixelRatio || 1;
    const rect = minimapCanvas.getBoundingClientRect();

    const renderedWidth = rect.width;
    const logicalWidth = minimapCanvas.width / dpr;
    const cssScale = renderedWidth / logicalWidth;

    const scale = totalMinimapContentWidth / totalWorldWidth;

    const onMouseMove = (moveEvent) => {
        const deltaX = (moveEvent.clientX - startX) / cssScale;
        const cameraDelta = -deltaX / scale;
        const { innerWidth } = window;
        const maxX = 0;
        const minX = innerWidth - totalWorldWidth;
        camera.x = Math.min(maxX, Math.max(minX, startCameraX + cameraDelta));
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}


canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        mouseDownPos = { x: e.clientX, y: e.clientY };
        lastMousePos = { x: e.clientX, y: e.clientY };
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) {
        const dx = e.clientX - lastMousePos.x;

        if (!isPanning && Math.abs(e.clientX - mouseDownPos.x) > 5) {
            isPanning = true;
            canvas.style.cursor = 'grabbing';
        }

        if (isPanning) {
            camera.x += dx;
            clampCamera();
        }

        lastMousePos = { x: e.clientX, y: e.clientY };
    } else {
        const plant = getPlantSignAtScreen(e.clientX, e.clientY);
        canvas.style.cursor = plant ? 'pointer' : 'default';
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        if (!isPanning) {
            const plant = getPlantSignAtScreen(e.clientX, e.clientY);
            if (plant) {
                window.location.href = `/plant/${plant.username}/`;
            }
        }
        isPanning = false;
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.x -= e.deltaY + e.deltaX;
    clampCamera();
}, { passive: false });

let touchStartX = 0;
let touchStartY = 0;
let touchStartCameraX = 0;
let touchStartCameraY = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartCameraX = camera.x;
    touchStartCameraY = camera.y;
    isPanning = false;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const dx = deltaX + deltaY;

    if (Math.abs(dx) > 10) {
        isPanning = true;
    }

    camera.x = touchStartCameraX + dx;
    clampCamera();
});

canvas.addEventListener('touchend', (e) => {
    if (!isPanning && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const plant = getPlantSignAtScreen(touch.clientX, touch.clientY);
        if (plant) {
            window.location.href = `/plant/${plant.username}/`;
        }
    }
    isPanning = false;
});


// Initialize plants data and start render loop
function init() {
    const plantsData = window.PLANTS_DATA;

    if (!plantsData || plantsData.length === 0) {
        const container = document.getElementById('trees-container');
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>No plants yet. Be the first to grow!</p></div>';
        }
        return;
    }

    for (const plant of plantsData) {
        plants.push(plant);
        plantsByUsername.set(plant.username, plant);
    }

    maxBoundsWidth = 0;
    maxBoundsHeight = 0;
    for (const plant of plants) {
        maxBoundsWidth = Math.max(maxBoundsWidth, plant.bounds.width);
        maxBoundsHeight = Math.max(maxBoundsHeight, plant.bounds.height);
    }

    resize();
    initMinimap();

    draw();
}

window.addEventListener('resize', resize);

(async () => {
    await document.fonts.load('normal 16px "Retro"');
    init();
})();
