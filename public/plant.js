const canvas = document.getElementById('plant-canvas');
const ctx = canvas.getContext('2d');

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let seedInputMode = false;
const SEED_INPUT_LENGTH = 8;
const SEED_MIN_LENGTH = 5;
const SEED_MAX_LENGTH = 8;

let seedInputLetters = Array(SEED_INPUT_LENGTH).fill('');
let seedInputSelected = 0;
let seedInputHovered = -1;

const seedInputAnims = new Map();

// Create animation state for a seed input cell
function createSeedInputAnim(index, isBlooming = false, letter = null) {
    return {
        index,
        opacity: 0,
        colorProgress: isBlooming ? 1 : 0,
        letter: letter,
    };
}

// Reset all seed input animations
function initSeedInputAnims() {
    seedInputAnims.clear();
}

// Render vertical letter markup for seed hint text
function stringToVerticalLetters(str) {
    return str.split('').map(char =>
        `<div class="seed-text-letter">${char === ' ' ? '' : char}</div>`
    ).join('');
}

// Update the seed input hint text and blooming style
function updateSeedInputHint(word, isValidWord, isBlooming) {
    const hintEl = document.getElementById('seed-hint');
    if (!hintEl) return;

    let hintText = '';

    if (word.length === 0) {
        hintText = '5 TO 8 LETTERS';
    } else if (hasGapsInMiddle()) {
        hintText = 'NO GAPS ALLOWED';
    } else if (word.length < SEED_MIN_LENGTH) {
        const remaining = SEED_MIN_LENGTH - word.length;
        hintText = `${remaining} MORE LETTER${remaining > 1 ? 'S' : ''}`;
    } else if (!isValidWord) {
        hintText = 'NOT A VALID WORD';
    } else {
        hintText = 'PRESS ENTER TO PLANT';
    }

    hintEl.innerHTML = stringToVerticalLetters(hintText);

    if (isBlooming) {
        hintEl.classList.add('blooming');
    } else {
        hintEl.classList.remove('blooming');
    }
}

// Show the seed input UI container
function showSeedInputUI() {
    const uiEl = document.getElementById('seed-input-ui');
    if (uiEl) {
        uiEl.classList.remove('hidden');
    }
}

// Hide the seed input UI container
function hideSeedInputUI() {
    const uiEl = document.getElementById('seed-input-ui');
    if (uiEl) {
        uiEl.classList.add('hidden');
    }
}

// Build the current seed word from input letters
function getSeedInputWord() {
    let word = '';
    let foundFirst = false;
    let hasGap = false;

    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const letter = seedInputLetters[i];
        if (letter) {
            if (hasGap) {
                return '';
            }
            foundFirst = true;
            word += letter;
        } else if (foundFirst) {
            hasGap = true;
        }
    }

    return word.toUpperCase();
}

// Detect whether the seed input contains internal gaps
function hasGapsInMiddle() {
    let foundFirst = false;
    let foundGap = false;

    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const letter = seedInputLetters[i];
        if (letter) {
            if (foundGap) {
                return true;
            }
            foundFirst = true;
        } else if (foundFirst) {
            foundGap = true;
        }
    }
    return false;
}

// Validate the seed input against length and dictionary rules
function isSeedInputValid() {
    if (hasGapsInMiddle()) return false;

    const word = getSeedInputWord();
    return word.length >= SEED_MIN_LENGTH &&
        word.length <= SEED_MAX_LENGTH &&
        validWords.has(word);
}

// Check whether the seed input length is within bounds
function isSeedLengthValid() {
    if (hasGapsInMiddle()) return false;

    const word = getSeedInputWord();
    return word.length >= SEED_MIN_LENGTH && word.length <= SEED_MAX_LENGTH;
}

// Animate a seed input letter appearing
function animateSeedInputAppear(index, isBlooming = false) {
    const letter = seedInputLetters[index];

    let anim = seedInputAnims.get(index);

    if (!anim) {
        anim = createSeedInputAnim(index, isBlooming, letter);
        seedInputAnims.set(index, anim);
    } else {
        anim.opacity = 0;
        anim.colorProgress = isBlooming ? 1 : 0;
        anim.letter = letter;
    }

    gsap.to(anim, {
        opacity: 1,
        duration: 0.3,
        ease: "power1.inOut"
    });
}

// Update animation state for a seed input letter
function updateSeedInputLetter(index, isBlooming = false) {
    const letter = seedInputLetters[index];

    let anim = seedInputAnims.get(index);

    if (!anim) {
        anim = createSeedInputAnim(index, isBlooming, letter);
        anim.opacity = 1;
        seedInputAnims.set(index, anim);
    } else {
        anim.letter = letter;
    }

    const targetColor = isBlooming ? 1 : 0;
    if (anim.colorProgress !== targetColor) {
        gsap.to(anim, {
            colorProgress: targetColor,
            duration: 0.3,
            ease: "power1.inOut"
        });
    }
}

// Animate a seed input letter disappearing
function animateSeedInputDisappear(index, letter, isBlooming) {
    let anim = seedInputAnims.get(index);

    if (!anim) {
        anim = createSeedInputAnim(index, isBlooming, letter);
        anim.opacity = 1;
        seedInputAnims.set(index, anim);
    } else {
        anim.letter = letter;
    }

    gsap.to(anim, {
        opacity: 0,
        duration: 0.3,
        ease: "power1.inOut",
        onComplete: () => {
            seedInputAnims.delete(index);
        }
    });
}

// Animate the color change for a seed input letter
function animateSeedInputColorChange(index, isBlooming) {
    const anim = seedInputAnims.get(index);
    if (!anim) return;

    gsap.to(anim, {
        colorProgress: isBlooming ? 1 : 0,
        duration: 0.3,
        ease: "power1.inOut"
    });
}

// Refresh blooming states across all seed input letters
function updateSeedInputBloomingStates() {
    const isBlooming = isSeedInputValid();

    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const anim = seedInputAnims.get(i);
        if (anim && anim.letter) {
            const wasBlooming = anim.colorProgress > 0.5;
            if (wasBlooming !== isBlooming) {
                animateSeedInputColorChange(i, isBlooming);
            }
        }
    }
}

let validWords = new Set();
let plantWords = new Set();
let pendingWordsToAdd = new Set();
let pendingWordsToRemove = new Set();
let syncTimeout = null;

// Load the full dictionary for seed validation
async function loadDictionary() {
    try {
        const response = await fetch('/words/all.txt');
        const text = await response.text();
        const words = text.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 2);
        validWords = new Set(words);
    } catch (error) {
        console.error('Failed to load dictionary:', error);
    }
}

const CELL_SIZE = 52;
const GRID_WIDTH = 49;
const GRID_HEIGHT = 49;

const COLORS = {
    background: '#FFFFFF',
    secondary: '#EBEBEB',
    seed: "#124434",

    blooming: {
        primary: '#36856B',
        background: '#D3E8E1',
    },

    withering: {
        primary: '#7C5F4C',
        background: '#E9DED7',
    },
};

// Compute layout metrics for the seed input column
function getSeedInputLayout() {
    const { innerWidth, innerHeight } = window;
    const tileSize = CELL_SIZE;
    const totalHeight = SEED_INPUT_LENGTH * tileSize;

    const startX = innerWidth / 2 - tileSize / 2;
    const startY = innerHeight / 2 - totalHeight / 2;

    return { startX, startY, tileSize };
}

// Determine which seed input tile is at given screen coordinates
function getSeedInputTileAt(screenX, screenY) {
    const { startX, startY, tileSize } = getSeedInputLayout();

    if (screenX < startX || screenX >= startX + tileSize) return -1;

    const relY = screenY - startY;
    if (relY < 0 || relY >= SEED_INPUT_LENGTH * tileSize) return -1;

    return Math.floor(relY / tileSize);
}

// Render the seed input screen UI and letters
function drawSeedInputScreen() {
    const { innerWidth, innerHeight } = window;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const { startX, startY, tileSize } = getSeedInputLayout();
    const fontSize = 46;

    const word = getSeedInputWord();
    const isValidWord = validWords.has(word);
    const isBlooming = isSeedInputValid();

    ctx.fillStyle = COLORS.secondary;
    for (let col = -1; col <= 1; col++) {
        for (let row = -1; row <= SEED_INPUT_LENGTH; row++) {
            const dotX = startX + col * tileSize;
            const dotY = startY + row * tileSize;
            if (col !== -1) {
                if (row !== -1) {
                    ctx.fillRect(dotX, dotY, 2, 2);
                }
                if (row !== SEED_INPUT_LENGTH) {
                    ctx.fillRect(dotX, dotY + tileSize - 2, 2, 2);
                }
            }
            if (col !== 1) {
                if (row !== -1) {
                    ctx.fillRect(dotX + tileSize - 2, dotY, 2, 2);
                }
                if (row !== SEED_INPUT_LENGTH) {
                    ctx.fillRect(dotX + tileSize - 2, dotY + tileSize - 2, 2, 2);
                }
            }
        }
    }

    updateSeedInputHint(word, isValidWord, isBlooming);

    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const x = startX;
        const y = startY + i * tileSize;
        const letter = seedInputLetters[i];
        const anim = seedInputAnims.get(i);
        const isSelected = i === seedInputSelected;
        const isHovered = i === seedInputHovered;

        const opacity = anim?.opacity ?? 1;
        const colorProgress = anim?.colorProgress ?? 0;
        const animLetter = anim?.letter || letter;

        const isDisappearing = !letter && anim && anim.letter;

        const primaryColor = lerpColor(COLORS.withering.primary, COLORS.blooming.primary, colorProgress);
        const bgColor = lerpColor(COLORS.withering.background, COLORS.blooming.background, colorProgress);

        const needsBackground = isSelected || isHovered;
        if ((letter || isDisappearing) && opacity <= 0.01 && !needsBackground) continue;

        if (letter || isDisappearing) {
            if (isDisappearing) {
                if (isSelected) {
                    ctx.fillStyle = COLORS.blooming.primary;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                } else if (isHovered) {
                    ctx.fillStyle = COLORS.blooming.background;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                }
            } else {
                if (isSelected) {
                    ctx.fillStyle = primaryColor;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                } else if (isHovered) {
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                }
            }
        } else {
            if (isSelected) {
                ctx.fillStyle = COLORS.blooming.primary;
                ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
            } else if (isHovered) {
                ctx.fillStyle = COLORS.blooming.background;
                ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
            }
        }

        if (animLetter && opacity > 0.01) {
            ctx.font = `normal ${fontSize}px "Retro", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = opacity * (isSelected && !isDisappearing ? 1 : 1);
            ctx.fillStyle = (isSelected && !isDisappearing) ? COLORS.background : primaryColor;
            ctx.fillText(
                animLetter,
                x + tileSize / 2,
                y + tileSize / 2 + (isSafari ? 5.2 : 4.9)
            );
            ctx.globalAlpha = 1;
        }
    }

}

// Handle keyboard input for the seed entry flow
function handleSeedInputKeyboard(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
        const letter = e.key.toUpperCase();

        let targetIndex = seedInputSelected;
        if (seedInputLetters[targetIndex] !== '') {
            for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
                if (seedInputLetters[i] === '') {
                    targetIndex = i;
                    break;
                }
            }
        }

        const currentLength = getSeedInputWord().length;
        if (targetIndex < SEED_INPUT_LENGTH && currentLength < SEED_MAX_LENGTH) {
            seedInputLetters[targetIndex] = letter;

            const isBlooming = isSeedInputValid();

            animateSeedInputAppear(targetIndex, isBlooming);

            updateSeedInputBloomingStates();

            for (let i = targetIndex + 1; i < SEED_INPUT_LENGTH; i++) {
                if (seedInputLetters[i] === '') {
                    seedInputSelected = i;
                    break;
                }
            }
        }
        e.preventDefault();
        return;
    }

    if (e.key === 'Backspace') {
        let deletedIndex = -1;
        let deletedLetter = '';
        let wasBlooming = false;

        if (seedInputLetters[seedInputSelected] !== '') {
            deletedIndex = seedInputSelected;
            deletedLetter = seedInputLetters[deletedIndex];
            const anim = seedInputAnims.get(deletedIndex);
            wasBlooming = anim ? anim.colorProgress > 0.5 : false;
            seedInputLetters[seedInputSelected] = '';
            animateSeedInputDisappear(deletedIndex, deletedLetter, wasBlooming);
        } else {
            for (let i = SEED_INPUT_LENGTH - 1; i >= 0; i--) {
                if (seedInputLetters[i] !== '') {
                    deletedIndex = i;
                    deletedLetter = seedInputLetters[i];
                    const anim = seedInputAnims.get(i);
                    wasBlooming = anim ? anim.colorProgress > 0.5 : false;
                    seedInputLetters[i] = '';
                    seedInputSelected = i;
                    animateSeedInputDisappear(i, deletedLetter, wasBlooming);
                    break;
                }
            }
        }

        if (deletedIndex >= 0) {
            updateSeedInputBloomingStates();
        }

        e.preventDefault();
        return;
    }

    if (e.key === 'ArrowUp') {
        seedInputSelected = Math.max(0, seedInputSelected - 1);
        e.preventDefault();
        return;
    }
    if (e.key === 'ArrowDown') {
        seedInputSelected = Math.min(SEED_INPUT_LENGTH - 1, seedInputSelected + 1);
        e.preventDefault();
        return;
    }

    if (e.key === 'Enter' && isSeedInputValid()) {
        submitSeed();
        e.preventDefault();
        return;
    }
}

// Submit a valid seed word to the server
function submitSeed() {
    const word = getSeedInputWord();
    if (!isSeedInputValid()) {
        console.warn('Cannot submit invalid seed');
        return;
    }

    emitSeedSet(word);
}

let seedTransitionAnims = [];
let seedTransitionActive = false;
const seedTransitionState = { dotsOpacity: 0 };

window.isSeedTransitionActive = () => seedTransitionActive;
window.isSeedInputMode = () => seedInputMode;

// Start growth once the growth module is ready
function triggerGrowthStart() {
    if (window.startGrowth) {
        window.startGrowth();
    } else {
        window.pendingGrowthStart = true;
    }
}

// Animate seed letters transitioning into the tree grid
function animateSeedToTree(seedData, onComplete) {
    const seedWord = seedData.seed;
    const seedLength = seedWord.length;

    const { startX: inputStartX, startY: inputStartY, tileSize } = getSeedInputLayout();

    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    const seedCenterX = (seedX + 0.5) * CELL_SIZE;
    const seedBottomY = (seedStartY + seedLength) * CELL_SIZE;
    const targetCameraX = window.innerWidth / 2 - seedCenterX;
    const targetCameraY = window.innerHeight - seedBottomY;

    let firstLetterIndex = 0;
    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        if (seedInputLetters[i] !== '') {
            firstLetterIndex = i;
            break;
        }
    }

    seedTransitionAnims = [];
    for (let i = 0; i < seedLength; i++) {
        const letter = seedWord[i];
        const inputIndex = firstLetterIndex + i;

        const fromX = inputStartX;
        const fromY = inputStartY + inputIndex * tileSize;

        const toGridY = seedStartY + i;
        const toX = seedX * CELL_SIZE + targetCameraX;
        const toY = toGridY * CELL_SIZE + targetCameraY;

        seedTransitionAnims.push({
            letter,
            x: fromX,
            y: fromY,
            fromX,
            fromY,
            toX,
            toY,
            colorProgress: 0,
            opacity: 1
        });
    }

    seedInputMode = false;
    seedTransitionActive = true;
    seedTransitionState.dotsOpacity = 0;

    window.seedTransitionCamera = { x: targetCameraX, y: targetCameraY };

    const tl = gsap.timeline({
        onUpdate: drawSeedTransition,
        onComplete: () => {
            if (onComplete) onComplete();
            seedTransitionActive = false;
            seedTransitionAnims = [];
            seedTransitionState.dotsOpacity = 0;
            delete window.seedTransitionCamera;
        }
    });

    const totalDuration = 0.7 + (seedLength - 1) * 0.04;
    tl.to(seedTransitionState, {
        dotsOpacity: 1,
        duration: totalDuration,
        ease: "power3.inOut"
    }, 0);

    seedTransitionAnims.forEach((anim, i) => {
        const delay = i * 0.04;
        tl.to(anim, {
            x: anim.toX,
            y: anim.toY,
            colorProgress: 1,
            duration: 0.7,
            ease: "power3.inOut"
        }, delay);
    });
}

// Render the seed-to-tree transition animation frame
function drawSeedTransition() {
    if (!seedTransitionActive || seedTransitionAnims.length === 0) return;

    const canvas = document.getElementById('plant-canvas');
    const ctx = canvas.getContext('2d');
    const { innerWidth, innerHeight } = window;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const tileSize = CELL_SIZE;

    if (window.seedTransitionCamera && seedTransitionState.dotsOpacity > 0) {
        const cam = window.seedTransitionCamera;
        const startX = Math.max(0, Math.floor(-cam.x / CELL_SIZE) - 1);
        const startY = Math.max(0, Math.floor(-cam.y / CELL_SIZE) - 1);
        const endX = Math.min(GRID_WIDTH, Math.ceil((innerWidth - cam.x) / CELL_SIZE) + 1);
        const endY = Math.min(GRID_HEIGHT, Math.ceil((innerHeight - cam.y) / CELL_SIZE) + 1);

        ctx.globalAlpha = seedTransitionState.dotsOpacity;
        ctx.fillStyle = COLORS.secondary;
        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const screenX = x * CELL_SIZE + cam.x;
                const screenY = y * CELL_SIZE + cam.y;
                ctx.fillRect(screenX, screenY, 2, 2);
                ctx.fillRect(screenX + CELL_SIZE - 2, screenY, 2, 2);
                ctx.fillRect(screenX, screenY + CELL_SIZE - 2, 2, 2);
                ctx.fillRect(screenX + CELL_SIZE - 2, screenY + CELL_SIZE - 2, 2, 2);
            }
        }
        ctx.globalAlpha = 1;
    }

    for (const anim of seedTransitionAnims) {
        const { letter, x, y, colorProgress } = anim;

        const textColor = lerpColor(COLORS.blooming.primary, COLORS.seed, colorProgress);

        ctx.font = 'normal 46px "Retro", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(
            letter,
            x + tileSize / 2,
            y + tileSize / 2 + (isSafari ? 5.2 : 4.9)
        );
    }
}

// Switch from seed input mode into interactive tree mode
function transitionToTreeMode(seedData) {
    hideSeedInputUI();

    animateSeedToTree(seedData, () => {
        window.PLANT_DATA.seed = seedData.seed;

        grid.clear();
        for (const tile of seedData.tiles) {
            const key = `${tile.x},${tile.y}`;
            grid.set(key, {
                x: tile.x,
                y: tile.y,
                letter: tile.letter,
                isSeed: tile.isSeed,
                blooming: tile.blooming
            });
        }

        initCellAnims({ skipSeedAnimation: true });

        centerOnSeed();


        draw();

        triggerGrowthStart();
    });
}

// Draw the seed input frame when in seed mode
function drawSeedInput() {
    if (!seedInputMode) return;

    drawSeedInputScreen();
    requestAnimationFrame(drawSeedInput);
}

let camera = {
    x: 0,
    y: 0
};

const MINIMAP_PIXEL_SIZE = 3;
const MINIMAP_PADDING = CELL_SIZE / 4 + 3;
const MINIMAP_WIDTH = GRID_WIDTH * MINIMAP_PIXEL_SIZE;
const MINIMAP_HEIGHT = GRID_HEIGHT * MINIMAP_PIXEL_SIZE;

const minimapAnim = { opacity: 0 };
let minimapHideTween = null;
const MINIMAP_FADE_DURATION = 0.3;
const MINIMAP_HIDE_DELAY = 2;

// Fade in the minimap overlay
function showMinimap() {
    if (minimapHideTween) {
        minimapHideTween.kill();
        minimapHideTween = null;
    }
    gsap.to(minimapAnim, {
        opacity: 1,
        duration: MINIMAP_FADE_DURATION,
        ease: "power1.inOut"
    });
}

// Fade out the minimap overlay after a delay
function hideMinimap() {
    if (minimapHideTween) {
        minimapHideTween.kill();
    }
    minimapHideTween = gsap.to(minimapAnim, {
        opacity: 0,
        duration: MINIMAP_FADE_DURATION,
        delay: MINIMAP_HIDE_DELAY,
        ease: "power1.inOut"
    });
}

const grid = new Map();

const cellAnims = new Map();

// Create animation state for a single grid cell
function createCellAnim(x, y, isBlooming = false, letter = null) {
    return {
        x, y,
        opacity: 0,
        colorProgress: isBlooming ? 1 : 0,
        letter: letter,
    };
}

// Initialize animation states for all tiles
function initCellAnims(options = {}) {
    const { skipSeedAnimation = false } = options;

    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    const seedCells = [];
    const otherCells = [];

    for (const [key, cell] of grid.entries()) {
        const anim = createCellAnim(cell.x, cell.y, cell.blooming, cell.letter);

        if (cell.isSeed && skipSeedAnimation) {
            anim.opacity = 1;
        } else {
            anim.opacity = 0;
        }
        cellAnims.set(key, anim);

        if (cell.isSeed) {
            seedCells.push({
                key,
                x: cell.x,
                y: cell.y
            });
        } else {
            let minDistToSeed = Infinity;
            for (let i = 0; i < seedLength; i++) {
                const seedY = seedStartY + i;
                const dist = Math.abs(cell.x - seedX) + Math.abs(cell.y - seedY);
                minDistToSeed = Math.min(minDistToSeed, dist);
            }

            otherCells.push({
                key,
                x: cell.x,
                y: cell.y,
                distance: minDistToSeed
            });
        }
    }

    seedCells.sort((a, b) => b.y - a.y);

    otherCells.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return b.y - a.y;
    });

    const seedDelay = 50;
    const baseDelay = 30;

    const seedAnimDuration = skipSeedAnimation ? 0 : seedCells.length * seedDelay;

    if (!skipSeedAnimation) {
        seedCells.forEach((cell, i) => {
            const anim = cellAnims.get(cell.key);
            if (!anim) return;

            const delay = i * seedDelay;
            setTimeout(() => {
                gsap.to(anim, {
                    opacity: 1,
                    duration: 0.3,
                    ease: "power1.inOut"
                });
            }, delay);
        });
    }

    otherCells.forEach((cell, i) => {
        const anim = cellAnims.get(cell.key);
        if (!anim) return;

        const randomVariation = (Math.random() - 0.5) * 30;
        const delay = Math.max(0, seedAnimDuration + i * baseDelay + randomVariation);

        setTimeout(() => {
            gsap.to(anim, {
                opacity: 1,
                duration: 0.3,
                ease: "power1.inOut"
            });
        }, delay);
    });
}

// Animate a cell appearing on the grid
function animateCellAppear(x, y, isBlooming = false) {
    const key = `${x},${y}`;
    const cell = grid.get(key);
    const letter = cell?.letter ?? null;

    let anim = cellAnims.get(key);

    if (!anim) {
        anim = createCellAnim(x, y, isBlooming, letter);
        cellAnims.set(key, anim);
    } else {
        anim.opacity = 0;
        anim.colorProgress = isBlooming ? 1 : 0;
        anim.letter = letter;
    }

    gsap.to(anim, {
        opacity: 1,
        duration: 0.3,
        ease: "power1.inOut"
    });
}

// Update the animation for a cell's letter and bloom state
function updateCellLetter(x, y, isBlooming = false) {
    const key = `${x},${y}`;
    const cell = grid.get(key);
    const letter = cell?.letter ?? null;

    let anim = cellAnims.get(key);

    if (!anim) {
        anim = createCellAnim(x, y, isBlooming, letter);
        anim.opacity = 1;
        cellAnims.set(key, anim);
    } else {
        anim.letter = letter;
    }

    const targetColor = isBlooming ? 1 : 0;
    if (anim.colorProgress !== targetColor) {
        gsap.to(anim, {
            colorProgress: targetColor,
            duration: 0.3,
            ease: "power1.inOut"
        });
    }
}

// Animate a cell fading out and remove its animation
function animateCellDisappear(x, y, letter, isBlooming, onComplete) {
    const key = `${x},${y}`;
    let anim = cellAnims.get(key);

    if (!anim) {
        anim = createCellAnim(x, y, isBlooming, letter);
        anim.opacity = 1;
        cellAnims.set(key, anim);
    } else {
        anim.letter = letter;
    }

    gsap.to(anim, {
        opacity: 0,
        duration: 0.3,
        ease: "power1.inOut",
        onComplete: () => {
            cellAnims.delete(key);
            onComplete?.();
        }
    });
}

// Animate bloom color change for a cell
function animateColorChange(x, y, isBlooming) {
    const key = `${x},${y}`;
    const anim = cellAnims.get(key);
    if (!anim) return;

    gsap.to(anim, {
        colorProgress: isBlooming ? 1 : 0,
        duration: 0.3,
        ease: "power1.inOut"
    });
}


// Convert a hex color string to RGB components
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// Interpolate between two hex colors
function lerpColor(colorA, colorB, t) {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const blue = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${blue})`;
}

let selectedCell = null;
let hoveredCell = null;

let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let mouseDownPos = { x: 0, y: 0 };

const SEED_WORD = "seed";
const SEED_X = Math.floor(GRID_WIDTH / 2);
const SEED_START_Y = GRID_HEIGHT - SEED_WORD.length;

// Load tiles into the grid (server data or default seed)
function initTiles() {
    if (window.PLANT_DATA && window.PLANT_DATA.tiles) {
        for (const tile of window.PLANT_DATA.tiles) {
            const key = `${tile.x},${tile.y}`;
            grid.set(key, {
                x: tile.x,
                y: tile.y,
                letter: tile.letter,
                isSeed: tile.isSeed,
                blooming: tile.blooming
            });
        }
    } else {
        for (let i = 0; i < SEED_WORD.length; i++) {
            const x = SEED_X;
            const y = SEED_START_Y + i;
            const key = `${x},${y}`;
            grid.set(key, { x, y, letter: SEED_WORD[i].toUpperCase(), isSeed: true, blooming: true });
        }
    }
}

// Load existing plant words into a set
function initWords() {
    if (window.PLANT_DATA && window.PLANT_DATA.words) {
        plantWords = new Set(window.PLANT_DATA.words.map(w => w.toUpperCase()));
    }
}


// Resize canvas to device pixel ratio
function resize() {
    const { innerWidth, innerHeight } = window;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;

    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
}

// Convert screen coordinates to grid coordinates
function screenToGrid(screenX, screenY) {
    const worldX = screenX - camera.x;
    const worldY = screenY - camera.y;

    return {
        x: Math.floor(worldX / CELL_SIZE),
        y: Math.floor(worldY / CELL_SIZE)
    };
}

// Convert grid coordinates to screen coordinates
function gridToScreen(gridX, gridY) {
    return {
        x: gridX * CELL_SIZE + camera.x,
        y: gridY * CELL_SIZE + camera.y
    };
}

// Clamp camera position within grid bounds
function clampCamera() {
    const maxX = 0;
    const minX = window.innerWidth - GRID_WIDTH * CELL_SIZE;
    const maxY = 0;
    const minY = window.innerHeight - GRID_HEIGHT * CELL_SIZE;

    camera.x = Math.min(maxX, Math.max(minX, camera.x));
    camera.y = Math.min(maxY, Math.max(minY, camera.y));
}

// Check if coordinates are inside the playable grid
function isInBounds(x, y) {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT - 3;
}

// Check whether a letter exists at a grid cell
function hasLetter(x, y) {
    return grid.has(`${x},${y}`);
}

// Get the letter at a grid cell
function getLetter(x, y) {
    const cell = grid.get(`${x},${y}`);
    return cell ? cell.letter : null;
}

// Determine if a grid cell belongs to the seed
function isSeedCell(x, y) {
    const cell = grid.get(`${x},${y}`);
    return cell ? cell.isSeed : false;
}

// Count orthogonally adjacent letters around a cell
function countAdjacentLetters(x, y) {
    let count = 0;
    if (hasLetter(x, y - 1)) count++;
    if (hasLetter(x, y + 1)) count++;
    if (hasLetter(x - 1, y)) count++;
    if (hasLetter(x + 1, y)) count++;
    return count;
}

// Check if a cell touches any existing letter
function isAdjacentToLetter(x, y) {
    return countAdjacentLetters(x, y) > 0;
}

// Prevent placements too close to the bottom seed edges
function isBlockedBySeed(x, y) {
    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    if (y >= seedStartY && y < seedStartY + seedLength && y === GRID_HEIGHT - 3) {
        if (x === seedX - 1 || x === seedX + 1) {
            return true;
        }
    }
    return false;
}

// Validate whether a new letter can be placed at a cell
function isValidPlacement(x, y) {
    if (!isInBounds(x, y)) return false;
    if (hasLetter(x, y)) return false;
    if (countAdjacentLetters(x, y) !== 1) return false;
    if (isBlockedBySeed(x, y)) return false;
    return true;
}

// Check if a non-seed letter cell can be edited
function isEditableCell(x, y) {
    return isInBounds(x, y) && hasLetter(x, y) && !isSeedCell(x, y);
}

// Determine if a cell is placeable or editable
function isInteractable(x, y) {
    return isValidPlacement(x, y) || isEditableCell(x, y);
}

// Remove letters not connected to the seed
function pruneDisconnectedLetters() {
    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    const seedCells = [];
    for (let i = 0; i < seedLength; i++) {
        seedCells.push({ x: seedX, y: seedStartY + i });
    }

    const connected = new Set();
    const queue = [...seedCells];
    let queueIndex = 0;

    for (const cell of seedCells) {
        connected.add(`${cell.x},${cell.y}`);
    }

    while (queueIndex < queue.length) {
        const { x, y } = queue[queueIndex++];

        const neighbors = [
            { x: x, y: y - 1 },
            { x: x, y: y + 1 },
            { x: x - 1, y: y },
            { x: x + 1, y: y }
        ];

        for (const neighbor of neighbors) {
            const key = `${neighbor.x},${neighbor.y}`;

            if (hasLetter(neighbor.x, neighbor.y) && !connected.has(key)) {
                connected.add(key);
                queue.push(neighbor);
            }
        }
    }

    const toRemove = [];
    for (const key of grid.keys()) {
        if (!connected.has(key)) {
            toRemove.push(key);
        }
    }

    for (const key of toRemove) {
        grid.delete(key);
    }

    return toRemove.length;
}

// Get the word and its cells starting from a position and direction
function getWordAt(x, y, direction) {
    if (!hasLetter(x, y)) return null;

    let startX = x, startY = y;

    if (direction === 'horizontal') {
        while (hasLetter(startX - 1, startY)) startX--;
    } else {
        while (hasLetter(startX, startY - 1)) startY--;
    }

    let word = '';
    let cells = [];
    let cx = startX, cy = startY;

    while (hasLetter(cx, cy)) {
        word += getLetter(cx, cy);
        cells.push({ x: cx, y: cy });
        if (direction === 'horizontal') cx++;
        else cy++;
    }

    return { word, cells };
}

// Check if a word is valid in any dictionary
function isValidWord(word) {
    if (!word || word.length < 2) return false;
    const upperWord = word.toUpperCase();
    return validWords.has(upperWord) || plantWords.has(upperWord);
}

// Track a valid word locally and queue sync
function trackValidWord(word) {
    const upperWord = word.toUpperCase();

    if (plantWords.has(upperWord)) return;

    if (!isValidWord(upperWord)) return;

    for (const existingWord of plantWords) {
        if (upperWord.length > existingWord.length) {
            if (upperWord.startsWith(existingWord) || upperWord.endsWith(existingWord)) {
                if (!wordExistsOnGrid(existingWord)) {
                    if (pendingWordsToAdd.has(existingWord)) {
                        pendingWordsToAdd.delete(existingWord);
                    } else {
                        pendingWordsToRemove.add(existingWord);
                    }
                    plantWords.delete(existingWord);
                }
            }
        }
    }

    if (pendingWordsToRemove.has(upperWord)) {
        pendingWordsToRemove.delete(upperWord);
    }
    pendingWordsToAdd.add(upperWord);
    plantWords.add(upperWord);
    scheduleSyncWords();
}

// Debounce syncing word additions/removals to the server
function scheduleSyncWords() {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(() => {
        syncWordsToServer();
    }, 2000);
}

// Send pending word changes to the server
function syncWordsToServer() {
    if (pendingWordsToAdd.size === 0 && pendingWordsToRemove.size === 0) return;

    const wordsToAdd = Array.from(pendingWordsToAdd);
    const wordsToRemove = Array.from(pendingWordsToRemove);

    pendingWordsToAdd.clear();
    pendingWordsToRemove.clear();

    emitWordsSync(wordsToAdd, wordsToRemove);
}

// Collect valid words that include a given cell
function getWordsAtCell(x, y) {
    const words = new Set();

    const hWord = getWordAt(x, y, 'horizontal');
    if (hWord && isValidWord(hWord.word)) {
        words.add(hWord.word.toUpperCase());
    }

    const vWord = getWordAt(x, y, 'vertical');
    if (vWord && isValidWord(vWord.word)) {
        words.add(vWord.word.toUpperCase());
    }

    return words;
}

// Check whether a word currently exists on the grid
function wordExistsOnGrid(word) {
    const upperWord = word.toUpperCase();

    for (const key of grid.keys()) {
        const [x, y] = key.split(',').map(Number);

        if (!hasLetter(x - 1, y)) {
            const hWord = getWordAt(x, y, 'horizontal');
            if (hWord && hWord.word.toUpperCase() === upperWord) {
                return true;
            }
        }

        if (!hasLetter(x, y - 1)) {
            const vWord = getWordAt(x, y, 'vertical');
            if (vWord && vWord.word.toUpperCase() === upperWord) {
                return true;
            }
        }
    }

    return false;
}

// Remove words that no longer exist on the grid and queue sync
function removeDeletedWords(wordsToCheck) {
    let hasChanges = false;

    for (const word of wordsToCheck) {
        if (plantWords.has(word) && !wordExistsOnGrid(word)) {
            plantWords.delete(word);

            if (pendingWordsToAdd.has(word)) {
                pendingWordsToAdd.delete(word);
            } else {
                pendingWordsToRemove.add(word);
            }
            hasChanges = true;
        }
    }

    if (hasChanges) {
        scheduleSyncWords();
    }
}

// Determine whether a cell should be blooming
function calculateBlooming(x, y) {
    if (!hasLetter(x, y)) return false;
    if (isSeedCell(x, y)) return true;

    const hWord = getWordAt(x, y, 'horizontal');
    if (hWord && isValidWord(hWord.word)) return true;

    const vWord = getWordAt(x, y, 'vertical');
    if (vWord && isValidWord(vWord.word)) return true;

    return false;
}

// Return bloom status for a cell (seed/blooming/none)
function isBlooming(x, y) {
    const cell = grid.get(`${x},${y}`);
    if (!cell) return "n";
    if (cell.isSeed) return "s";
    return cell.blooming ? "y" : false;
}

// Gather cells and words affected by a placement change
function getAffectedCells(x, y) {
    const affectedCells = new Set();
    const allWords = [];
    const seenWords = new Set();

    if (hasLetter(x, y)) {
        affectedCells.add(`${x},${y}`);
    }

    const hWord = getWordAt(x, y, 'horizontal');
    if (hWord) {
        for (const cell of hWord.cells) {
            affectedCells.add(`${cell.x},${cell.y}`);
        }
        if (!seenWords.has(hWord.word)) {
            seenWords.add(hWord.word);
            allWords.push(hWord);
        }
    }

    const vWord = getWordAt(x, y, 'vertical');
    if (vWord) {
        for (const cell of vWord.cells) {
            affectedCells.add(`${cell.x},${cell.y}`);
        }
        if (!seenWords.has(vWord.word)) {
            seenWords.add(vWord.word);
            allWords.push(vWord);
        }
    }

    const neighbors = [
        { x: x - 1, y }, { x: x + 1, y },
        { x, y: y - 1 }, { x, y: y + 1 }
    ];
    for (const n of neighbors) {
        if (hasLetter(n.x, n.y)) {
            const nh = getWordAt(n.x, n.y, 'horizontal');
            if (nh) {
                for (const cell of nh.cells) affectedCells.add(`${cell.x},${cell.y}`);
                if (!seenWords.has(nh.word)) {
                    seenWords.add(nh.word);
                    allWords.push(nh);
                }
            }
            const nv = getWordAt(n.x, n.y, 'vertical');
            if (nv) {
                for (const cell of nv.cells) affectedCells.add(`${cell.x},${cell.y}`);
                if (!seenWords.has(nv.word)) {
                    seenWords.add(nv.word);
                    allWords.push(nv);
                }
            }
        }
    }

    return { affectedCells, allWords };
}

// Recompute blooming states and animate changes
function updateBloomingStates(x, y) {
    const { affectedCells, allWords } = getAffectedCells(x, y);

    for (const wordObj of allWords) {
        if (isValidWord(wordObj.word)) {
            trackValidWord(wordObj.word);
        }
    }

    for (const key of affectedCells) {
        const cell = grid.get(key);
        if (cell && !cell.isSeed) {
            const wasBlooming = cell.blooming;
            const newBlooming = calculateBlooming(cell.x, cell.y);
            cell.blooming = newBlooming;
            if (wasBlooming !== newBlooming) {
                animateColorChange(cell.x, cell.y, newBlooming);
            }
        }
    }
}

// Emit blooming state updates for affected cells
function syncBloomingStates(x, y) {
    const { affectedCells } = getAffectedCells(x, y);
    const tilesToSync = [];

    for (const key of affectedCells) {
        const cell = grid.get(key);
        if (cell && !cell.isSeed) {
            tilesToSync.push({ x: cell.x, y: cell.y, blooming: cell.blooming });
        }
    }

    if (tilesToSync.length > 0) {
        emitTilesUpdate(tilesToSync);
    }
}

// Render minimap tiles and viewport outline
function drawMinimap() {
    if (minimapAnim.opacity <= 0) return;

    const { innerWidth, innerHeight } = window;

    ctx.globalAlpha = minimapAnim.opacity;

    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillRect(MINIMAP_PADDING, MINIMAP_PADDING, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    ctx.strokeStyle = COLORS.secondary;
    ctx.lineWidth = 3;
    ctx.strokeRect(MINIMAP_PADDING - 1.5, MINIMAP_PADDING - 1.5, MINIMAP_WIDTH + 3, MINIMAP_HEIGHT + 3);

    for (const cell of grid.values()) {
        const { x, y, isSeed, blooming } = cell;

        if (isSeed) {
            ctx.fillStyle = COLORS.seed;
        } else if (blooming) {
            ctx.fillStyle = COLORS.blooming.primary;
        } else {
            ctx.fillStyle = COLORS.withering.primary;
        }

        const pixelX = MINIMAP_PADDING + x * MINIMAP_PIXEL_SIZE;
        const pixelY = MINIMAP_PADDING + y * MINIMAP_PIXEL_SIZE;
        ctx.fillRect(pixelX, pixelY, MINIMAP_PIXEL_SIZE, MINIMAP_PIXEL_SIZE);
    }

    const viewportX = MINIMAP_PADDING + (-camera.x / CELL_SIZE) * MINIMAP_PIXEL_SIZE;
    const viewportY = MINIMAP_PADDING + (-camera.y / CELL_SIZE) * MINIMAP_PIXEL_SIZE;
    const viewportW = (innerWidth / CELL_SIZE) * MINIMAP_PIXEL_SIZE;
    const viewportH = (innerHeight / CELL_SIZE) * MINIMAP_PIXEL_SIZE;

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(viewportX - 1.5, viewportY - 1.5, viewportW + 3, viewportH + 3);

    ctx.globalAlpha = 1;
}

// Main render loop for grid tiles and minimap
function draw() {
    const { innerWidth, innerHeight } = window;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const startX = Math.max(0, Math.floor(-camera.x / CELL_SIZE) - 1);
    const startY = Math.max(0, Math.floor(-camera.y / CELL_SIZE) - 1);
    const endX = Math.min(GRID_WIDTH, Math.ceil((innerWidth - camera.x) / CELL_SIZE) + 1);
    const endY = Math.min(GRID_HEIGHT, Math.ceil((innerHeight - camera.y) / CELL_SIZE) + 1);

    ctx.fillStyle = COLORS.secondary;
    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const screenPos = gridToScreen(x, y);
            ctx.fillRect(screenPos.x, screenPos.y, 2, 2);
            ctx.fillRect(screenPos.x + CELL_SIZE - 2, screenPos.y, 2, 2);
            ctx.fillRect(screenPos.x, screenPos.y + CELL_SIZE - 2, 2, 2);
            ctx.fillRect(screenPos.x + CELL_SIZE - 2, screenPos.y + CELL_SIZE - 2, 2, 2);
        }
    }

    const cellsToRender = new Set();

    for (const cell of grid.values()) {
        const { x, y } = cell;
        if (x >= startX && x < endX && y >= startY && y < endY) {
            cellsToRender.add(`${x},${y}`);
            if (x - 1 >= startX) cellsToRender.add(`${x - 1},${y}`);
            if (x + 1 < endX) cellsToRender.add(`${x + 1},${y}`);
            if (y - 1 >= startY) cellsToRender.add(`${x},${y - 1}`);
            if (y + 1 < endY) cellsToRender.add(`${x},${y + 1}`);
        }
    }

    for (const [key, anim] of cellAnims.entries()) {
        if (anim.opacity > 0.01) {
            const { x, y } = anim;
            if (x >= startX && x < endX && y >= startY && y < endY) {
                cellsToRender.add(key);
            }
        }
    }

    if (selectedCell && selectedCell.x >= startX && selectedCell.x < endX &&
        selectedCell.y >= startY && selectedCell.y < endY) {
        cellsToRender.add(`${selectedCell.x},${selectedCell.y}`);
    }
    if (hoveredCell && hoveredCell.x >= startX && hoveredCell.x < endX &&
        hoveredCell.y >= startY && hoveredCell.y < endY) {
        cellsToRender.add(`${hoveredCell.x},${hoveredCell.y}`);
    }

    for (const key of cellsToRender) {
        const cell = grid.get(key);
        if (cell) {
            drawCellContent(cell.x, cell.y);
        } else {
            const [x, y] = key.split(',').map(Number);
            drawCellContent(x, y);
        }
    }

    drawMinimap();

    requestAnimationFrame(draw);
}

// Render a single cell (or placeholder) with animation state
function drawCellContent(x, y) {
    const key = `${x},${y}`;
    const cellData = grid.get(key);
    const anim = cellAnims.get(key);

    const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;
    const isHovered = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;

    const isDisappearing = !cellData && anim && anim.letter;

    if (!cellData && !isSelected && !isHovered && !isDisappearing) return;

    const opacity = anim?.opacity ?? 1;
    const colorProgress = anim?.colorProgress ?? (cellData?.blooming ? 1 : 0);

    const needsBackground = isSelected || isHovered;
    if ((cellData || isDisappearing) && opacity <= 0.01 && !needsBackground) return;

    const screenPos = gridToScreen(x, y);
    const centerX = screenPos.x + CELL_SIZE / 2;
    const centerY = screenPos.y + CELL_SIZE / 2;
    const baseAlpha = 0.5 + (y / (GRID_HEIGHT - 3)) * 0.5;

    if (cellData || isDisappearing) {
        const letter = cellData?.letter ?? anim.letter;
        const seed = cellData?.isSeed ?? false;
        const editable = !seed && isInBounds(x, y);

        const primaryColor = seed ? COLORS.seed : lerpColor(COLORS.withering.primary, COLORS.blooming.primary, colorProgress);
        const bgColor = lerpColor(COLORS.withering.background, COLORS.blooming.background, colorProgress);

        ctx.save();

        if (editable) {
            if (isDisappearing) {
                const validPlacement = isValidPlacement(x, y);
                if (validPlacement) {
                    if (isSelected) {
                        ctx.globalAlpha = baseAlpha;
                        ctx.fillStyle = COLORS.blooming.primary;
                        ctx.fillRect(screenPos.x + 2, screenPos.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                    } else if (isHovered) {
                        ctx.globalAlpha = baseAlpha;
                        ctx.fillStyle = COLORS.blooming.background;
                        ctx.fillRect(screenPos.x + 2, screenPos.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                    }
                }
            } else {
                if (isSelected) {
                    ctx.globalAlpha = baseAlpha;
                    ctx.fillStyle = primaryColor;
                    ctx.fillRect(screenPos.x + 2, screenPos.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                } else if (isHovered) {
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(screenPos.x + 2, screenPos.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                }
            }
        }

        ctx.globalAlpha = opacity * (isSelected && !isDisappearing ? 1 : (seed ? 1 : baseAlpha));
        ctx.fillStyle = (isSelected && !isDisappearing) ? COLORS.background : primaryColor;
        ctx.font = 'normal 46px "Retro", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            letter,
            centerX,
            centerY + (isSafari ? 5.2 : 4.9)
        );

        ctx.restore();
    } else if (!isDisappearing) {
        const validPlacement = isValidPlacement(x, y);

        if (validPlacement) {
            ctx.globalAlpha = baseAlpha;
            if (isSelected) {
                ctx.fillStyle = COLORS.blooming.primary;
                ctx.fillRect(screenPos.x + 2, screenPos.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            } else if (isHovered) {
                ctx.fillStyle = COLORS.blooming.background;
                ctx.fillRect(screenPos.x + 2, screenPos.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
            ctx.globalAlpha = 1;
        }
    }
}

canvas.addEventListener('mousedown', (e) => {
    if (seedTransitionActive) return;

    if (e.button === 0) {
        mouseDownPos = { x: e.clientX, y: e.clientY };
        lastMousePos = { x: e.clientX, y: e.clientY };
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (seedTransitionActive) return;

    if (seedInputMode) {
        const tileIndex = getSeedInputTileAt(e.clientX, e.clientY);
        if (tileIndex >= 0) {
            seedInputHovered = tileIndex;
            canvas.style.cursor = 'pointer';
        } else {
            seedInputHovered = -1;
            canvas.style.cursor = 'default';
        }
        return;
    }

    const gridPos = screenToGrid(e.clientX, e.clientY);

    if (e.buttons === 1) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;

        if (!isPanning && (Math.abs(e.clientX - mouseDownPos.x) > 5 || Math.abs(e.clientY - mouseDownPos.y) > 5)) {
            isPanning = true;
            canvas.style.cursor = 'grabbing';
            showMinimap();
        }

        if (isPanning) {
            camera.x += dx;
            camera.y += dy;
            clampCamera();
        }

        lastMousePos = { x: e.clientX, y: e.clientY };
    } else {
        if (window.PLANT_DATA.canEdit && isInteractable(gridPos.x, gridPos.y)) {
            hoveredCell = gridPos;
            canvas.style.cursor = 'pointer';
        } else {
            hoveredCell = null;
            canvas.style.cursor = 'default';
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (seedTransitionActive) return;

    if (e.button === 0) {
        if (seedInputMode) {
            const tileIndex = getSeedInputTileAt(e.clientX, e.clientY);
            if (tileIndex >= 0) {
                seedInputSelected = tileIndex;
            }
            return;
        }

        if (!isPanning) {
            if (window.PLANT_DATA.canEdit) {
                const gridPos = screenToGrid(e.clientX, e.clientY);

                if (isInteractable(gridPos.x, gridPos.y)) {
                    selectedCell = gridPos;
                } else {
                    selectedCell = null;
                }
            }
        } else {
            hideMinimap();
        }

        isPanning = false;
        canvas.style.cursor = (hoveredCell && window.PLANT_DATA.canEdit) ? 'pointer' : 'default';
    }
});

canvas.addEventListener('mouseleave', () => {
    if (seedTransitionActive) return;

    if (seedInputMode) {
        seedInputHovered = -1;
        return;
    }

    if (isPanning) {
        hideMinimap();
    }
    isPanning = false;
    hoveredCell = null;
});

document.addEventListener('keydown', (e) => {
    if (seedTransitionActive) return;

    if (!window.PLANT_DATA.canEdit) return;

    if (seedInputMode) {
        handleSeedInputKeyboard(e);
        return;
    }

    if (!selectedCell) return;

    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
        const { x, y } = selectedCell;
        const key = `${x},${y}`;
        const letter = e.key.toUpperCase();

        if (isValidPlacement(x, y) || isEditableCell(x, y)) {
            const isEdit = hasLetter(x, y);
            const wordsBeforeEdit = new Set();
            if (isEdit) {
                for (const word of getWordsAtCell(x, y)) {
                    wordsBeforeEdit.add(word);
                }
                const neighbors = [
                    { x: x - 1, y }, { x: x + 1, y },
                    { x, y: y - 1 }, { x, y: y + 1 }
                ];
                for (const n of neighbors) {
                    for (const word of getWordsAtCell(n.x, n.y)) {
                        wordsBeforeEdit.add(word);
                    }
                }
            }

            grid.set(key, { x, y, letter, isSeed: false, blooming: false });
            updateBloomingStates(x, y);

            const cell = grid.get(key);

            if (isEdit) {
                updateCellLetter(x, y, cell.blooming);
            } else {
                animateCellAppear(x, y, cell.blooming);
            }

            if (isEdit && wordsBeforeEdit.size > 0) {
                removeDeletedWords(wordsBeforeEdit);
            }

            emitTile(x, y, letter, cell.blooming);

            syncBloomingStates(x, y);
        }
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (isEditableCell(selectedCell.x, selectedCell.y)) {
            const { x, y } = selectedCell;
            const key = `${x},${y}`;

            const cellToDelete = grid.get(key);
            const letterToDelete = cellToDelete?.letter;
            const bloomingToDelete = cellToDelete?.blooming ?? false;

            const wordsBeforeDeletion = new Set();

            for (const word of getWordsAtCell(x, y)) {
                wordsBeforeDeletion.add(word);
            }

            const neighbors = [
                { x: x - 1, y }, { x: x + 1, y },
                { x, y: y - 1 }, { x, y: y + 1 }
            ];
            for (const n of neighbors) {
                for (const word of getWordsAtCell(n.x, n.y)) {
                    wordsBeforeDeletion.add(word);
                }
            }

            const beforeCells = new Map();
            for (const [k, cell] of grid.entries()) {
                beforeCells.set(k, { letter: cell.letter, blooming: cell.blooming });
            }

            grid.delete(key);
            pruneDisconnectedLetters();

            const disconnected = [...beforeCells.keys()]
                .filter(k => !grid.has(k) && k !== key)
                .map(k => {
                    const [dx, dy] = k.split(',').map(Number);
                    const cellData = beforeCells.get(k);
                    return { x: dx, y: dy, letter: cellData.letter, blooming: cellData.blooming };
                });

            if (disconnected.length > 0) {
                for (const word of plantWords) {
                    wordsBeforeDeletion.add(word);
                }
            }

            animateCellDisappear(x, y, letterToDelete, bloomingToDelete);

            if (disconnected.length > 0) {
                disconnected.forEach(tile => {
                    const tileKey = `${tile.x},${tile.y}`;
                    const anim = cellAnims.get(tileKey);
                    if (anim) {
                        anim.letter = tile.letter;
                    }
                });

                disconnected.forEach(tile => {
                    tile.distance = Math.abs(tile.x - x) + Math.abs(tile.y - y);
                });

                disconnected.sort((a, b) => b.distance - a.distance);

                const baseDelay = 30;
                disconnected.forEach((tile, i) => {
                    const randomVariation = (Math.random() - 0.5) * 40;
                    const delay = Math.max(0, i * baseDelay + randomVariation);
                    setTimeout(() => {
                        animateCellDisappear(tile.x, tile.y, tile.letter, tile.blooming);
                    }, delay);
                });
            }

            updateBloomingStates(x, y);

            removeDeletedWords(wordsBeforeDeletion);

            emitDelete(x, y, disconnected.map(t => ({ x: t.x, y: t.y })));

            syncBloomingStates(x, y);

            if (typeof rescheduleGrowth === 'function') {
                rescheduleGrowth();
            }
        }
    }

    if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        let newX = selectedCell.x;
        let newY = selectedCell.y;

        switch (e.key) {
            case 'ArrowUp': newY--; break;
            case 'ArrowDown': newY++; break;
            case 'ArrowLeft': newX--; break;
            case 'ArrowRight': newX++; break;
        }

        if (isInteractable(newX, newY)) {
            selectedCell = { x: newX, y: newY };
        }
    }

    if (e.key === 'Escape') {
        selectedCell = null;
    }
});

let touchStartPos = null;
let touchStartCamera = null;

canvas.addEventListener('touchstart', (e) => {
    if (seedTransitionActive) return;

    e.preventDefault();
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchStartCamera = { ...camera };
});

canvas.addEventListener('touchmove', (e) => {
    if (seedTransitionActive) return;

    e.preventDefault();
    if (!touchStartPos) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.x;
    const dy = touch.clientY - touchStartPos.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        showMinimap();
    }

    camera.x = touchStartCamera.x + dx;
    camera.y = touchStartCamera.y + dy;
    clampCamera();
});

canvas.addEventListener('touchend', (e) => {
    if (seedTransitionActive) return;

    if (touchStartPos) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.x);
        const dy = Math.abs(touch.clientY - touchStartPos.y);

        if (dx < 10 && dy < 10) {
            const gridPos = screenToGrid(touch.clientX, touch.clientY);

            if (isInteractable(gridPos.x, gridPos.y)) {
                selectedCell = gridPos;
            } else {
                selectedCell = null;
            }
        } else {
            hideMinimap();
        }
    }

    touchStartPos = null;
    touchStartCamera = null;
});

// Center the camera on the seed tiles
function centerOnSeed() {
    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    const seedCenterX = (seedX + 0.5) * CELL_SIZE;
    const seedBottomY = (seedStartY + seedLength) * CELL_SIZE;

    camera.x = window.innerWidth / 2 - seedCenterX;
    camera.y = window.innerHeight - seedBottomY;

    clampCamera();
}

// Initialize plant view, sockets, and animations
async function init() {
    await loadDictionary();
    resize();

    const { username, isOwner, seed } = window.PLANT_DATA;
    connectSocket(isOwner ? null : username);

    onSocketEvent('connected', (data) => {
    });

    onSocketEvent('seedSet', (data) => {
        transitionToTreeMode(data);
    });

    onSocketEvent('wordsChanged', (data) => {
        if (data.removed) {
            for (const word of data.removed) {
                plantWords.delete(word.toUpperCase());
            }
        }
        if (data.added) {
            for (const word of data.added) {
                plantWords.add(word.toUpperCase());
            }
        }
    });

    onSocketEvent('tile', (data) => {
        const key = `${data.x},${data.y}`;
        const isNew = !grid.has(key);
        grid.set(key, {
            x: data.x,
            y: data.y,
            letter: data.letter,
            isSeed: data.isSeed,
            blooming: data.blooming
        });
        if (isNew) {
            animateCellAppear(data.x, data.y, data.blooming);
        } else {
            updateCellLetter(data.x, data.y, data.blooming);
        }
    });

    onSocketEvent('delete', (data) => {
        const key = `${data.x},${data.y}`;
        const cell = grid.get(key);
        if (cell) {
            animateCellDisappear(data.x, data.y, cell.letter, cell.blooming);
        }
        grid.delete(key);

        if (data.disconnected) {
            for (const { x, y } of data.disconnected) {
                const dcKey = `${x},${y}`;
                const dcCell = grid.get(dcKey);
                if (dcCell) {
                    animateCellDisappear(x, y, dcCell.letter, dcCell.blooming);
                }
                grid.delete(dcKey);
            }
        }

        if (typeof rescheduleGrowth === 'function') {
            rescheduleGrowth();
        }
    });

    onSocketEvent('tilesUpdated', (data) => {
        if (data.tiles) {
            for (const tile of data.tiles) {
                const cell = grid.get(`${tile.x},${tile.y}`);
                if (cell) {
                    const wasBlooming = cell.blooming;
                    cell.blooming = tile.blooming;
                    if (wasBlooming !== tile.blooming) {
                        animateColorChange(tile.x, tile.y, tile.blooming);
                    }
                }
            }
        }
    });

    if (!seed && isOwner) {
        seedInputMode = true;
        initSeedInputAnims();
        showSeedInputUI();
        drawSeedInput();
    } else {
        initTiles();
        initCellAnims();
        initWords();
        centerOnSeed();
        draw();

        if (isOwner) {
            triggerGrowthStart();
        }
    }
}

window.addEventListener('beforeunload', () => {
    if (pendingWordsToAdd.size > 0 || pendingWordsToRemove.size > 0) {
        syncWordsToServer();
    }
});

window.addEventListener('resize', () => {
    resize();
    if (!seedInputMode) {
        centerOnSeed();
    }
});

(async () => {
    await document.fonts.load('normal 46px "Retro"');
    init();
})();