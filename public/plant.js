const canvas = document.getElementById('plant-canvas');
const ctx = canvas.getContext('2d');

// Check if browser is Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let seedInputMode = false;  // True when user needs to set their seed word
const SEED_INPUT_LENGTH = 8;  // Max tiles for seed input
const SEED_MIN_LENGTH = 5;    // Min length for valid seed
const SEED_MAX_LENGTH = 8;    // Max length for valid seed

// Seed input state
let seedInputLetters = Array(SEED_INPUT_LENGTH).fill('');  // Array of letters
let seedInputSelected = 0;   // Currently selected tile index (0-7)
let seedInputHovered = -1;   // Currently hovered tile index (-1 = none)

// Seed input animation state (Map like the tree uses, keyed by index)
const seedInputAnims = new Map();

// Create animation state for a seed input cell (same structure as tree's createCellAnim)
function createSeedInputAnim(index, isBlooming = false, letter = null) {
    return {
        index,
        opacity: 0,         // 0→1 for appear, 1→0 for disappear
        colorProgress: isBlooming ? 1 : 0,  // 0 = withering, 1 = blooming
        letter: letter,     // Store letter for disappearing animations
    };
}

// Initialize seed input animations
function initSeedInputAnims() {
    seedInputAnims.clear();
}

// Convert a string to vertical letter elements HTML
function stringToVerticalLetters(str) {
    return str.split('').map(char =>
        `<div class="seed-text-letter">${char === ' ' ? '' : char}</div>`
    ).join('');
}

// Update the hint text in the HTML element
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

    // Update hint content as vertical text
    hintEl.innerHTML = stringToVerticalLetters(hintText);

    // Update blooming class
    if (isBlooming) {
        hintEl.classList.add('blooming');
    } else {
        hintEl.classList.remove('blooming');
    }
}

// Show the seed input UI
function showSeedInputUI() {
    const uiEl = document.getElementById('seed-input-ui');
    if (uiEl) {
        uiEl.classList.remove('hidden');
    }
}

// Hide the seed input UI (with CSS transition)
function hideSeedInputUI() {
    const uiEl = document.getElementById('seed-input-ui');
    if (uiEl) {
        uiEl.classList.add('hidden');
    }
}

// Get the current seed word from input (only consecutive letters, no gaps)
function getSeedInputWord() {
    // Find the contiguous block of letters (no gaps allowed)
    let word = '';
    let foundFirst = false;
    let hasGap = false;

    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const letter = seedInputLetters[i];
        if (letter) {
            if (hasGap) {
                // Found a letter after a gap - word is invalid
                return '';  // Return empty to indicate invalid
            }
            foundFirst = true;
            word += letter;
        } else if (foundFirst) {
            // Empty slot after we found letters = potential gap
            hasGap = true;
        }
    }

    return word.toUpperCase();
}

// Check if there are any gaps in the middle of the input
function hasGapsInMiddle() {
    let foundFirst = false;
    let foundGap = false;

    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const letter = seedInputLetters[i];
        if (letter) {
            if (foundGap) {
                return true;  // Letter after gap = has gaps in middle
            }
            foundFirst = true;
        } else if (foundFirst) {
            foundGap = true;
        }
    }
    return false;
}

// Check if seed input is valid (5-8 letters, valid word, no gaps)
function isSeedInputValid() {
    if (hasGapsInMiddle()) return false;

    const word = getSeedInputWord();
    return word.length >= SEED_MIN_LENGTH &&
        word.length <= SEED_MAX_LENGTH &&
        validWords.has(word);
}

// Check if seed has enough letters (for determining blooming state)
function isSeedLengthValid() {
    if (hasGapsInMiddle()) return false;

    const word = getSeedInputWord();
    return word.length >= SEED_MIN_LENGTH && word.length <= SEED_MAX_LENGTH;
}

// Animate letter appearing at index (same as tree's animateCellAppear)
function animateSeedInputAppear(index, isBlooming = false) {
    const letter = seedInputLetters[index];

    let anim = seedInputAnims.get(index);

    if (!anim) {
        anim = createSeedInputAnim(index, isBlooming, letter);
        seedInputAnims.set(index, anim);
    } else {
        // Reset for re-animation
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

// Update letter without opacity animation (same as tree's updateCellLetter)
function updateSeedInputLetter(index, isBlooming = false) {
    const letter = seedInputLetters[index];

    let anim = seedInputAnims.get(index);

    if (!anim) {
        // Create with full opacity (no fade in needed)
        anim = createSeedInputAnim(index, isBlooming, letter);
        anim.opacity = 1;
        seedInputAnims.set(index, anim);
    } else {
        // Just update letter, don't touch opacity
        anim.letter = letter;
    }

    // Only animate color if it changed
    const targetColor = isBlooming ? 1 : 0;
    if (anim.colorProgress !== targetColor) {
        gsap.to(anim, {
            colorProgress: targetColor,
            duration: 0.3,
            ease: "power1.inOut"
        });
    }
}

// Animate letter disappearing at index (same as tree's animateCellDisappear)
function animateSeedInputDisappear(index, letter, isBlooming) {
    let anim = seedInputAnims.get(index);

    if (!anim) {
        // Create animation state for the disappearing cell
        anim = createSeedInputAnim(index, isBlooming, letter);
        anim.opacity = 1;
        seedInputAnims.set(index, anim);
    } else {
        // Store letter data for drawing during animation
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

// Animate color transition for a specific index (same as tree's animateColorChange)
function animateSeedInputColorChange(index, isBlooming) {
    const anim = seedInputAnims.get(index);
    if (!anim) return;

    gsap.to(anim, {
        colorProgress: isBlooming ? 1 : 0,
        duration: 0.3,
        ease: "power1.inOut"
    });
}

// Update blooming states for all letters (similar to tree's updateBloomingStates)
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

// Dictionary for word validation
let validWords = new Set();          // Global dictionary
let plantWords = new Set();          // Plant-specific words (from server)
let pendingWordsToAdd = new Set();   // Words to add (not yet sent to server)
let pendingWordsToRemove = new Set(); // Words to remove (expanded words)
let syncTimeout = null;              // Debounce timer for word sync

// Load dictionary from words.txt
async function loadDictionary() {
    try {
        const response = await fetch('/words/all.txt');
        const text = await response.text();
        const words = text.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 2);
        validWords = new Set(words);
        // console.log(`Loaded ${validWords.size} words`);
    } catch (error) {
        console.error('Failed to load dictionary:', error);
    }
}

// Grid settings
const CELL_SIZE = 52;
const GRID_WIDTH = 49;
const GRID_HEIGHT = 49;

// Colors - white background with earthy accents
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

// Calculate seed input tile positions (centered on screen)
function getSeedInputLayout() {
    const { innerWidth, innerHeight } = window;
    const tileSize = CELL_SIZE;
    const totalHeight = SEED_INPUT_LENGTH * tileSize;

    // Center both horizontally and vertically
    const startX = innerWidth / 2 - tileSize / 2;
    const startY = innerHeight / 2 - totalHeight / 2;

    return { startX, startY, tileSize };
}

// Get seed input tile index from screen coordinates
function getSeedInputTileAt(screenX, screenY) {
    const { startX, startY, tileSize } = getSeedInputLayout();

    // Check if within horizontal bounds
    if (screenX < startX || screenX >= startX + tileSize) return -1;

    // Check if within vertical bounds and find index
    const relY = screenY - startY;
    if (relY < 0 || relY >= SEED_INPUT_LENGTH * tileSize) return -1;

    return Math.floor(relY / tileSize);
}

// Draw the seed input screen
function drawSeedInputScreen() {
    const { innerWidth, innerHeight } = window;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const { startX, startY, tileSize } = getSeedInputLayout();
    const fontSize = 46; // Same as tree font size

    // Determine if input is valid (for hint text color)
    const word = getSeedInputWord();
    const isValidWord = validWords.has(word);
    const isBlooming = isSeedInputValid();

    // Draw grid intersection dots around the tiles (3 columns x 10 rows)
    // Extends 1 cell in each direction from the tile column
    ctx.fillStyle = COLORS.secondary;
    for (let col = -1; col <= 1; col++) {
        for (let row = -1; row <= SEED_INPUT_LENGTH; row++) {
            const dotX = startX + col * tileSize;
            const dotY = startY + row * tileSize;
            // Draw 4 corner dots for each cell
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

    // Update HTML hint text
    updateSeedInputHint(word, isValidWord, isBlooming);

    // Draw each tile
    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        const x = startX;
        const y = startY + i * tileSize;
        const letter = seedInputLetters[i];
        const anim = seedInputAnims.get(i);  // Use Map.get()
        const isSelected = i === seedInputSelected;
        const isHovered = i === seedInputHovered;

        // Get animation values (same pattern as tree's drawCellContent)
        const opacity = anim?.opacity ?? 1;
        const colorProgress = anim?.colorProgress ?? 0;
        const animLetter = anim?.letter || letter;

        // Check if this is a disappearing cell (has anim but no letter in array)
        const isDisappearing = !letter && anim && anim.letter;

        // Interpolate color based on animation progress
        const primaryColor = lerpColor(COLORS.withering.primary, COLORS.blooming.primary, colorProgress);
        const bgColor = lerpColor(COLORS.withering.background, COLORS.blooming.background, colorProgress);

        // Skip drawing if cell is fully invisible and not selected/hovered
        const needsBackground = isSelected || isHovered;
        if ((letter || isDisappearing) && opacity <= 0.01 && !needsBackground) continue;

        // Draw background for selected/hovered (same logic as tree's drawCellContent)
        if (letter || isDisappearing) {
            // Cell has a letter or is disappearing
            if (isDisappearing) {
                // For disappearing cells, show empty cell selection/hover background
                if (isSelected) {
                    ctx.fillStyle = COLORS.blooming.primary;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                } else if (isHovered) {
                    ctx.fillStyle = COLORS.blooming.background;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                }
            } else {
                // For existing cells, use cell's colored background
                if (isSelected) {
                    ctx.fillStyle = primaryColor;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                } else if (isHovered) {
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                }
            }
        } else {
            // Empty cell - always use blooming colors
            if (isSelected) {
                ctx.fillStyle = COLORS.blooming.primary;
                ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
            } else if (isHovered) {
                ctx.fillStyle = COLORS.blooming.background;
                ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
            }
        }

        // Draw letter if present (with animation - same as tree)
        if (animLetter && opacity > 0.01) {
            ctx.font = `normal ${fontSize}px "Retro", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = opacity * (isSelected && !isDisappearing ? 1 : 1);
            ctx.fillStyle = (isSelected && !isDisappearing) ? COLORS.background : primaryColor;
            ctx.fillText(
                animLetter,
                x + tileSize / 2,
                y + tileSize / 2 + (isSafari ? 5.2 : 4.9) // Same offset as tree
            );
            ctx.globalAlpha = 1;
        }
    }

}

// Handle keyboard input in seed input mode
function handleSeedInputKeyboard(e) {
    // Skip if modifier keys are pressed (allow hotkeys like Cmd+R to pass through)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Letter input
    if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
        const letter = e.key.toUpperCase();

        // Find the first empty slot from the selected position
        // If selected slot is filled, find next empty one
        let targetIndex = seedInputSelected;
        if (seedInputLetters[targetIndex] !== '') {
            // Find next empty slot
            for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
                if (seedInputLetters[i] === '') {
                    targetIndex = i;
                    break;
                }
            }
        }

        // Only place if we found an empty slot and word isn't too long
        const currentLength = getSeedInputWord().length;
        if (targetIndex < SEED_INPUT_LENGTH && currentLength < SEED_MAX_LENGTH) {
            seedInputLetters[targetIndex] = letter;

            // Check blooming state after adding letter
            const isBlooming = isSeedInputValid();

            // Animate the letter appearing (same as tree)
            animateSeedInputAppear(targetIndex, isBlooming);

            // Update blooming states for all existing letters
            updateSeedInputBloomingStates();

            // Move selection to next empty slot
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

    // Backspace - delete letter at selected position or last letter
    if (e.key === 'Backspace') {
        let deletedIndex = -1;
        let deletedLetter = '';
        let wasBlooming = false;

        if (seedInputLetters[seedInputSelected] !== '') {
            // Delete at selected position
            deletedIndex = seedInputSelected;
            deletedLetter = seedInputLetters[deletedIndex];
            const anim = seedInputAnims.get(deletedIndex);
            wasBlooming = anim ? anim.colorProgress > 0.5 : false;
            seedInputLetters[seedInputSelected] = '';
            animateSeedInputDisappear(deletedIndex, deletedLetter, wasBlooming);
        } else {
            // Delete last letter
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

        // Update blooming states for remaining letters
        if (deletedIndex >= 0) {
            updateSeedInputBloomingStates();
        }

        e.preventDefault();
        return;
    }

    // Arrow keys for navigation
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

    // Enter to submit (only if valid)
    if (e.key === 'Enter' && isSeedInputValid()) {
        submitSeed();
        e.preventDefault();
        return;
    }
}

// Submit the seed word to server
function submitSeed() {
    const word = getSeedInputWord();
    if (!isSeedInputValid()) {
        console.warn('Cannot submit invalid seed');
        return;
    }

    // console.log('Submitting seed:', word);
    emitSeedSet(word);
}

// Seed transition animation state
let seedTransitionAnims = [];
let seedTransitionActive = false;
const seedTransitionState = { dotsOpacity: 0 }; // Object for GSAP to animate

// Expose seed states globally so growth.js can check them (kept for backwards compatibility)
window.isSeedTransitionActive = () => seedTransitionActive;
window.isSeedInputMode = () => seedInputMode;

// Helper to start growth when plant is ready
function triggerGrowthStart() {
    if (window.startGrowth) {
        window.startGrowth();
    } else {
        // growth.js hasn't loaded yet - register callback for when it's ready
        window.pendingGrowthStart = true;
    }
}

// Animate seed letters from input screen to tree position (canvas-based)
function animateSeedToTree(seedData, onComplete) {
    const seedWord = seedData.seed;
    const seedLength = seedWord.length;

    // Get current seed input positions
    const { startX: inputStartX, startY: inputStartY, tileSize } = getSeedInputLayout();

    // Calculate target tree positions (where the seed will be placed)
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    // Calculate camera position (same as centerOnSeed)
    const seedCenterX = (seedX + 0.5) * CELL_SIZE;
    const seedBottomY = (seedStartY + seedLength) * CELL_SIZE;
    const targetCameraX = window.innerWidth / 2 - seedCenterX;
    const targetCameraY = window.innerHeight - seedBottomY;

    // Find where the letters actually start in the seed input (skip leading empty slots)
    let firstLetterIndex = 0;
    for (let i = 0; i < SEED_INPUT_LENGTH; i++) {
        if (seedInputLetters[i] !== '') {
            firstLetterIndex = i;
            break;
        }
    }

    // Create animation state for each letter
    seedTransitionAnims = [];
    for (let i = 0; i < seedLength; i++) {
        const letter = seedWord[i];
        const inputIndex = firstLetterIndex + i;

        // Current position (seed input screen)
        const fromX = inputStartX;
        const fromY = inputStartY + inputIndex * tileSize;

        // Target position in tree (grid coordinates to screen coordinates)
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
            colorProgress: 0, // 0 = blooming, 1 = seed
            opacity: 1
        });
    }

    // Hide the seed input canvas content
    seedInputMode = false;
    seedTransitionActive = true;
    seedTransitionState.dotsOpacity = 0;

    // Store target camera position for drawing dots during animation
    window.seedTransitionCamera = { x: targetCameraX, y: targetCameraY };

    // Create GSAP timeline for the animation
    const tl = gsap.timeline({
        onUpdate: drawSeedTransition,
        onComplete: () => {
            // Don't clear animation state yet - let onComplete draw the tree first
            // The tree will draw on top, then we clear the animation state
            if (onComplete) onComplete();
            // Now clear the animation state after tree has drawn
            seedTransitionActive = false;
            seedTransitionAnims = [];
            seedTransitionState.dotsOpacity = 0;
            delete window.seedTransitionCamera;
        }
    });

    // Animate dots opacity (fade in with same duration as letter animation)
    const totalDuration = 0.7 + (seedLength - 1) * 0.04; // Account for stagger
    tl.to(seedTransitionState, {
        dotsOpacity: 1,
        duration: totalDuration,
        ease: "power3.inOut"
    }, 0);

    // Animate each letter's position and color with stagger
    // No fade out - letters stay visible until tree draws on top
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

// Draw the seed transition animation frame
function drawSeedTransition() {
    if (!seedTransitionActive || seedTransitionAnims.length === 0) return;

    const canvas = document.getElementById('plant-canvas');
    const ctx = canvas.getContext('2d');
    const { innerWidth, innerHeight } = window;

    // Clear canvas with background color
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const tileSize = CELL_SIZE;

    // Draw background dots with animated opacity (using target camera position)
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

    // Draw each animating letter (no background, just text)
    for (const anim of seedTransitionAnims) {
        const { letter, x, y, colorProgress } = anim;

        // Interpolate text color from blooming to seed
        const textColor = lerpColor(COLORS.blooming.primary, COLORS.seed, colorProgress);

        // Draw letter only (no tile background)
        ctx.font = 'normal 46px "Retro", monospace'; // Same as tree font size
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(
            letter,
            x + tileSize / 2,
            y + tileSize / 2 + (isSafari ? 5.2 : 4.9) // Same offset as tree
        );
    }
}

// Transition from seed input mode to tree mode
function transitionToTreeMode(seedData) {
    // Hide the seed input UI (will fade out via CSS transition)
    hideSeedInputUI();

    // Animate the seed letters to tree position
    animateSeedToTree(seedData, () => {
        // Update PLANT_DATA with new seed
        window.PLANT_DATA.seed = seedData.seed;

        // Load the new tiles into the grid
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

        // Initialize animations for the new tiles
        // Skip seed animation since we just animated them from the seed input screen
        initCellAnims({ skipSeedAnimation: true });

        // Center camera on the new seed
        centerOnSeed();

        // console.log('Transitioned to tree mode with seed:', seedData.seed);

        // Start the tree draw loop
        draw();

        // Start growth now that the tree is ready
        triggerGrowthStart();
    });
}

// Draw loop for seed input mode
function drawSeedInput() {
    if (!seedInputMode) return;

    drawSeedInputScreen();
    requestAnimationFrame(drawSeedInput);
}

// Camera for panning
let camera = {
    x: 0,
    y: 0
};

// Minimap settings
const MINIMAP_PIXEL_SIZE = 3;  // Each grid cell = 3x3 pixels
const MINIMAP_PADDING = CELL_SIZE / 4 + 3;    // Padding from canvas edge
const MINIMAP_WIDTH = GRID_WIDTH * MINIMAP_PIXEL_SIZE;
const MINIMAP_HEIGHT = GRID_HEIGHT * MINIMAP_PIXEL_SIZE;

// Minimap animation state (animated by GSAP)
const minimapAnim = { opacity: 0 };
let minimapHideTween = null;
const MINIMAP_FADE_DURATION = 0.3; // seconds
const MINIMAP_HIDE_DELAY = 2;      // seconds

// Show minimap with fade-in
function showMinimap() {
    // Kill any pending hide animation
    if (minimapHideTween) {
        minimapHideTween.kill();
        minimapHideTween = null;
    }
    // Fade in
    gsap.to(minimapAnim, {
        opacity: 1,
        duration: MINIMAP_FADE_DURATION,
        ease: "power1.inOut"
    });
}

// Hide minimap with delay and fade-out
function hideMinimap() {
    // Kill any pending hide animation
    if (minimapHideTween) {
        minimapHideTween.kill();
    }
    // Fade out after delay
    minimapHideTween = gsap.to(minimapAnim, {
        opacity: 0,
        duration: MINIMAP_FADE_DURATION,
        delay: MINIMAP_HIDE_DELAY,
        ease: "power1.inOut"
    });
}

const grid = new Map();

// Animation state for cells (keyed by "x,y")
const cellAnims = new Map();

// Create default animation properties for a cell
function createCellAnim(x, y, isBlooming = false, letter = null) {
    return {
        x, y,
        opacity: 0,         // 0→1 for appear, 1→0 for disappear
        colorProgress: isBlooming ? 1 : 0,  // 0 = withering, 1 = blooming
        letter: letter,     // Store letter for disappearing animations
    };
}

// Initialize animation state for existing cells (called on load)
function initCellAnims(options = {}) {
    const { skipSeedAnimation = false } = options;

    // Get actual seed info from PLANT_DATA
    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    // Separate seed cells and non-seed cells
    const seedCells = [];
    const otherCells = [];

    for (const [key, cell] of grid.entries()) {
        // Create animation state
        const anim = createCellAnim(cell.x, cell.y, cell.blooming, cell.letter);

        if (cell.isSeed && skipSeedAnimation) {
            // Seed cells start fully visible when skipping seed animation
            anim.opacity = 1;
        } else {
            // Other cells start invisible
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
            // Calculate distance from seed (Manhattan distance from closest seed letter)
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

    // Sort seed cells by y descending (bottom first, highest y value first)
    seedCells.sort((a, b) => b.y - a.y);

    // Sort other cells by distance (closest first), then by y (bottom first)
    otherCells.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return b.y - a.y;
    });

    // Timing configuration
    const seedDelay = 50; // ms between seed letters
    const baseDelay = 30; // ms between other cells

    // Calculate when the seed animation ends (0 if skipping)
    const seedAnimDuration = skipSeedAnimation ? 0 : seedCells.length * seedDelay;

    // Animate seed letters first (bottom to top) - unless skipping
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

    // Animate other cells after seed finishes
    otherCells.forEach((cell, i) => {
        const anim = cellAnims.get(cell.key);
        if (!anim) return;

        // Add random variation (-15ms to +15ms)
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

// Animate cell appearing (fade in) - for NEW cells only
function animateCellAppear(x, y, isBlooming = false) {
    const key = `${x},${y}`;
    const cell = grid.get(key);
    const letter = cell?.letter ?? null;

    let anim = cellAnims.get(key);

    if (!anim) {
        anim = createCellAnim(x, y, isBlooming, letter);
        cellAnims.set(key, anim);
    } else {
        // Reset for re-animation
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

// Update cell letter without opacity animation - for EDITS only
function updateCellLetter(x, y, isBlooming = false) {
    const key = `${x},${y}`;
    const cell = grid.get(key);
    const letter = cell?.letter ?? null;

    let anim = cellAnims.get(key);

    if (!anim) {
        // Create with full opacity (no fade in needed)
        anim = createCellAnim(x, y, isBlooming, letter);
        anim.opacity = 1;
        cellAnims.set(key, anim);
    } else {
        // Just update letter, don't touch opacity
        anim.letter = letter;
    }

    // Only animate color if it changed
    const targetColor = isBlooming ? 1 : 0;
    if (anim.colorProgress !== targetColor) {
        gsap.to(anim, {
            colorProgress: targetColor,
            duration: 0.3,
            ease: "power1.inOut"
        });
    }
}

// Animate cell disappearing (fade out)
function animateCellDisappear(x, y, letter, isBlooming, onComplete) {
    const key = `${x},${y}`;
    let anim = cellAnims.get(key);

    if (!anim) {
        // Create animation state for the disappearing cell
        anim = createCellAnim(x, y, isBlooming, letter);
        anim.opacity = 1;
        cellAnims.set(key, anim);
    } else {
        // Store letter data for drawing during animation
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

// Animate color transition (blooming change)
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


// Color interpolation helpers
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function lerpColor(colorA, colorB, t) {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const blue = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${blue})`;
}

// Selected cell
let selectedCell = null;
let hoveredCell = null;

// Panning state
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let mouseDownPos = { x: 0, y: 0 };

// Seed word configuration (vertical placement)
const SEED_WORD = "seed";
const SEED_X = Math.floor(GRID_WIDTH / 2); // Center column
const SEED_START_Y = GRID_HEIGHT - SEED_WORD.length; // Start so word ends at bottom

// Initialize tiles from server-rendered data
// Stores x, y coordinates in grid values to avoid string parsing during render
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
        // Fallback: initialize seed word locally (for development/testing)
        for (let i = 0; i < SEED_WORD.length; i++) {
            const x = SEED_X;
            const y = SEED_START_Y + i;
            const key = `${x},${y}`;
            grid.set(key, { x, y, letter: SEED_WORD[i].toUpperCase(), isSeed: true, blooming: true });
        }
    }
}

// Initialize plant-specific words from server-rendered data
function initWords() {
    if (window.PLANT_DATA && window.PLANT_DATA.words) {
        plantWords = new Set(window.PLANT_DATA.words.map(w => w.toUpperCase()));
        // console.log(`Loaded ${plantWords.size} plant-specific words from server`);
        // console.log(plantWords);
    }
}


// Resize handler
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

// Clamp camera to keep grid edges within view
function clampCamera() {
    const maxX = 0;
    const minX = window.innerWidth - GRID_WIDTH * CELL_SIZE;
    const maxY = 0;
    const minY = window.innerHeight - GRID_HEIGHT * CELL_SIZE;

    camera.x = Math.min(maxX, Math.max(minX, camera.x));
    camera.y = Math.min(maxY, Math.max(minY, camera.y));
}

// Check if a cell is within the grid bounds
function isInBounds(x, y) {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT - 3;
}

// Check if a cell has a letter
function hasLetter(x, y) {
    return grid.has(`${x},${y}`);
}

// Get letter at cell
function getLetter(x, y) {
    const cell = grid.get(`${x},${y}`);
    return cell ? cell.letter : null;
}

// Check if cell is part of seed
function isSeedCell(x, y) {
    const cell = grid.get(`${x},${y}`);
    return cell ? cell.isSeed : false;
}

// Count how many adjacent cells (up, down, left, right) have letters
function countAdjacentLetters(x, y) {
    let count = 0;
    if (hasLetter(x, y - 1)) count++;  // above
    if (hasLetter(x, y + 1)) count++;  // below
    if (hasLetter(x - 1, y)) count++;  // left
    if (hasLetter(x + 1, y)) count++;  // right
    return count;
}

// Check if a cell is adjacent (up, down, left, right) to any existing letter
function isAdjacentToLetter(x, y) {
    return countAdjacentLetters(x, y) > 0;
}

function isBlockedBySeed(x, y) {
    // Get actual seed info
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

// Check if a cell is valid for placing a new letter
// Must be empty, have EXACTLY one adjacent letter, and not be blocked by seed
function isValidPlacement(x, y) {
    if (!isInBounds(x, y)) return false;
    if (hasLetter(x, y)) return false;
    if (countAdjacentLetters(x, y) !== 1) return false;
    if (isBlockedBySeed(x, y)) return false;
    return true;
}

// Check if a cell has an editable (non-seed) letter
function isEditableCell(x, y) {
    return isInBounds(x, y) && hasLetter(x, y) && !isSeedCell(x, y);
}

// Check if a cell can be interacted with (new placement or editing)
function isInteractable(x, y) {
    return isValidPlacement(x, y) || isEditableCell(x, y);
}

// Prune letters that are disconnected from the seed
// Uses BFS to find all cells connected to seed, then removes disconnected ones
// Optimized: uses index-based queue iteration instead of shift() for O(1) dequeue
function pruneDisconnectedLetters() {
    // Get actual seed info
    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    // Collect all seed cell positions
    const seedCells = [];
    for (let i = 0; i < seedLength; i++) {
        seedCells.push({ x: seedX, y: seedStartY + i });
    }

    // BFS to find all cells connected to seed
    const connected = new Set();
    const queue = [...seedCells];
    let queueIndex = 0;  // Use index instead of shift() for O(1) dequeue

    // Mark seed cells as connected
    for (const cell of seedCells) {
        connected.add(`${cell.x},${cell.y}`);
    }

    // BFS with index-based iteration
    while (queueIndex < queue.length) {
        const { x, y } = queue[queueIndex++];  // O(1) instead of O(n) shift()

        // Check all 4 cardinal directions
        const neighbors = [
            { x: x, y: y - 1 },  // above
            { x: x, y: y + 1 },  // below
            { x: x - 1, y: y },  // left
            { x: x + 1, y: y }   // right
        ];

        for (const neighbor of neighbors) {
            const key = `${neighbor.x},${neighbor.y}`;

            // If this neighbor has a letter and hasn't been visited
            if (hasLetter(neighbor.x, neighbor.y) && !connected.has(key)) {
                connected.add(key);
                queue.push(neighbor);
            }
        }
    }

    // Remove all letters that are not connected to seed
    const toRemove = [];
    for (const key of grid.keys()) {
        if (!connected.has(key)) {
            toRemove.push(key);
        }
    }

    for (const key of toRemove) {
        grid.delete(key);
    }

    return toRemove.length; // Return count of removed cells
}

// Get a word starting from (x, y) in a direction
// direction: 'horizontal' or 'vertical'
function getWordAt(x, y, direction) {
    if (!hasLetter(x, y)) return null;

    let startX = x, startY = y;

    // Find the start of the word
    if (direction === 'horizontal') {
        while (hasLetter(startX - 1, startY)) startX--;
    } else {
        while (hasLetter(startX, startY - 1)) startY--;
    }

    // Build the word
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

// Check if a word is valid (exists in global dictionary or plant-specific words)
function isValidWord(word) {
    if (!word || word.length < 2) return false;
    const upperWord = word.toUpperCase();
    return validWords.has(upperWord) || plantWords.has(upperWord);
}

// Track a valid word for syncing to server
// Also detects if this word truly expands (replaces) an existing word and marks old one for removal
function trackValidWord(word) {
    const upperWord = word.toUpperCase();

    // Skip if already in plant dictionary
    if (plantWords.has(upperWord)) return;

    // Only track if it's a valid word
    if (!isValidWord(upperWord)) return;

    // Check if this word expands an existing plant word
    // e.g., "SEEK" expands "SEE" (SEE is a prefix of SEEK)
    // But only remove the old word if it no longer exists independently on the grid
    // e.g., "SEEK" + "ER" = "SEEKER" should NOT remove "SEEK" since "SEEK" still exists
    for (const existingWord of plantWords) {
        // Check if new word contains the existing word as prefix or suffix
        if (upperWord.length > existingWord.length) {
            if (upperWord.startsWith(existingWord) || upperWord.endsWith(existingWord)) {
                // Only mark for removal if the old word no longer exists on the grid
                if (!wordExistsOnGrid(existingWord)) {
                    if (pendingWordsToAdd.has(existingWord)) {
                        // Word was added then expanded in same sync window - just remove from add list
                        pendingWordsToAdd.delete(existingWord);
                    } else {
                        pendingWordsToRemove.add(existingWord);
                    }
                    plantWords.delete(existingWord);
                    // console.log(`Word "${existingWord}" expanded to "${upperWord}", marking for removal`);
                }
            }
        }
    }

    // Add new word (cancel any pending removal for this word)
    if (pendingWordsToRemove.has(upperWord)) {
        pendingWordsToRemove.delete(upperWord);
    }
    pendingWordsToAdd.add(upperWord);
    plantWords.add(upperWord);  // Optimistically add to local set
    scheduleSyncWords();
}

// Debounced sync - waits 2 seconds of inactivity before syncing
function scheduleSyncWords() {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(() => {
        syncWordsToServer();
    }, 2000);  // 2 second debounce
}

// Send pending words to server
function syncWordsToServer() {
    if (pendingWordsToAdd.size === 0 && pendingWordsToRemove.size === 0) return;

    const wordsToAdd = Array.from(pendingWordsToAdd);
    const wordsToRemove = Array.from(pendingWordsToRemove);

    pendingWordsToAdd.clear();
    pendingWordsToRemove.clear();

    emitWordsSync(wordsToAdd, wordsToRemove);
    // console.log(`Syncing words: +${wordsToAdd.length} add, -${wordsToRemove.length} remove`);
    // if (wordsToAdd.length > 0) console.log('  Adding:', wordsToAdd);
    // if (wordsToRemove.length > 0) console.log('  Removing:', wordsToRemove);
}

// Get all valid words that pass through a cell
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

// Check if a word exists anywhere on the grid
// Optimized: only checks cells that are word starts (no letter before them)
function wordExistsOnGrid(word) {
    const upperWord = word.toUpperCase();

    for (const key of grid.keys()) {
        const [x, y] = key.split(',').map(Number);

        // Only check horizontal if this is the START of a word (no letter to the left)
        if (!hasLetter(x - 1, y)) {
            const hWord = getWordAt(x, y, 'horizontal');
            if (hWord && hWord.word.toUpperCase() === upperWord) {
                return true;
            }
        }

        // Only check vertical if this is the START of a word (no letter above)
        if (!hasLetter(x, y - 1)) {
            const vWord = getWordAt(x, y, 'vertical');
            if (vWord && vWord.word.toUpperCase() === upperWord) {
                return true;
            }
        }
    }

    return false;
}

// Remove words from plantWords that no longer exist on the grid
function removeDeletedWords(wordsToCheck) {
    let hasChanges = false;

    for (const word of wordsToCheck) {
        if (plantWords.has(word) && !wordExistsOnGrid(word)) {
            plantWords.delete(word);

            // If word was pending add, just cancel the add instead of adding to remove list
            if (pendingWordsToAdd.has(word)) {
                pendingWordsToAdd.delete(word);
                // console.log(`Word "${word}" removed before sync, cancelling pending add`);
            } else {
                pendingWordsToRemove.add(word);
                // console.log(`Word "${word}" no longer exists on grid, marking for removal`);
            }
            hasChanges = true;
        }
    }

    if (hasChanges) {
        scheduleSyncWords();
    }
}

// Calculate if a cell is part of any valid word (blooming)
function calculateBlooming(x, y) {
    if (!hasLetter(x, y)) return false;
    if (isSeedCell(x, y)) return true; // Seed is always blooming

    // Check horizontal word
    const hWord = getWordAt(x, y, 'horizontal');
    if (hWord && isValidWord(hWord.word)) return true;

    // Check vertical word
    const vWord = getWordAt(x, y, 'vertical');
    if (vWord && isValidWord(vWord.word)) return true;

    return false;
}

// Get blooming state from stored data (for rendering)
function isBlooming(x, y) {
    const cell = grid.get(`${x},${y}`);
    if (!cell) return "n";
    if (cell.isSeed) return "s";
    return cell.blooming ? "y" : false;
}

// Get all cells affected by a change at (x, y) - shared helper for blooming updates
// Returns { affectedCells: Set, allWords: array of word objects }
function getAffectedCells(x, y) {
    const affectedCells = new Set();
    const allWords = [];  // Collect all words for tracking
    const seenWords = new Set();  // Avoid duplicate words

    // Add the cell itself if it has a letter
    if (hasLetter(x, y)) {
        affectedCells.add(`${x},${y}`);
    }

    // Get horizontal word at this cell
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

    // Get vertical word at this cell
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

    // Also check adjacent cells' words (important for deletions!)
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

// Update blooming state for a cell and all cells in its words
function updateBloomingStates(x, y) {
    const { affectedCells, allWords } = getAffectedCells(x, y);

    // Track ALL valid words for syncing (including neighbor words after deletion)
    for (const wordObj of allWords) {
        if (isValidWord(wordObj.word)) {
            trackValidWord(wordObj.word);
        }
    }

    // Update blooming state for all affected cells
    for (const key of affectedCells) {
        const cell = grid.get(key);
        if (cell && !cell.isSeed) {
            const wasBlooming = cell.blooming;
            const newBlooming = calculateBlooming(cell.x, cell.y);
            cell.blooming = newBlooming;
            // Animate color change if blooming state changed
            if (wasBlooming !== newBlooming) {
                animateColorChange(cell.x, cell.y, newBlooming);
            }
        }
    }
}

// Sync blooming states to server for cells affected by a change at (x, y)
function syncBloomingStates(x, y) {
    const { affectedCells } = getAffectedCells(x, y);
    const tilesToSync = [];

    // Build list of tiles to sync (non-seed only)
    for (const key of affectedCells) {
        const cell = grid.get(key);
        if (cell && !cell.isSeed) {
            tilesToSync.push({ x: cell.x, y: cell.y, blooming: cell.blooming });
        }
    }

    // Emit to server if there are tiles to sync
    if (tilesToSync.length > 0) {
        emitTilesUpdate(tilesToSync);
    }
}

// Draw minimap showing overview of the canvas
function drawMinimap() {
    // Don't draw if fully transparent
    if (minimapAnim.opacity <= 0) return;

    const { innerWidth, innerHeight } = window;

    ctx.globalAlpha = minimapAnim.opacity;

    // Draw minimap background with slight transparency
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillRect(MINIMAP_PADDING, MINIMAP_PADDING, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw border
    ctx.strokeStyle = COLORS.secondary;
    ctx.lineWidth = 3;
    ctx.strokeRect(MINIMAP_PADDING - 1.5, MINIMAP_PADDING - 1.5, MINIMAP_WIDTH + 3, MINIMAP_HEIGHT + 3);

    // Draw each cell as a pixel
    for (const cell of grid.values()) {
        const { x, y, isSeed, blooming } = cell;

        // Determine color based on cell state
        if (isSeed) {
            ctx.fillStyle = COLORS.seed;
        } else if (blooming) {
            ctx.fillStyle = COLORS.blooming.primary;
        } else {
            ctx.fillStyle = COLORS.withering.primary;
        }

        // Draw pixel at minimap position
        const pixelX = MINIMAP_PADDING + x * MINIMAP_PIXEL_SIZE;
        const pixelY = MINIMAP_PADDING + y * MINIMAP_PIXEL_SIZE;
        ctx.fillRect(pixelX, pixelY, MINIMAP_PIXEL_SIZE, MINIMAP_PIXEL_SIZE);
    }

    // Calculate viewport rectangle on minimap
    // Camera is negative when panned, so we negate it
    const viewportX = MINIMAP_PADDING + (-camera.x / CELL_SIZE) * MINIMAP_PIXEL_SIZE;
    const viewportY = MINIMAP_PADDING + (-camera.y / CELL_SIZE) * MINIMAP_PIXEL_SIZE;
    const viewportW = (innerWidth / CELL_SIZE) * MINIMAP_PIXEL_SIZE;
    const viewportH = (innerHeight / CELL_SIZE) * MINIMAP_PIXEL_SIZE;

    // Draw viewport rectangle
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(viewportX - 1.5, viewportY - 1.5, viewportW + 3, viewportH + 3);

    // Reset global alpha
    ctx.globalAlpha = 1;
}

// Draw the grid
function draw() {
    const { innerWidth, innerHeight } = window;

    // Clear canvas with background color
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    // Calculate visible grid range
    const startX = Math.max(0, Math.floor(-camera.x / CELL_SIZE) - 1);
    const startY = Math.max(0, Math.floor(-camera.y / CELL_SIZE) - 1);
    const endX = Math.min(GRID_WIDTH, Math.ceil((innerWidth - camera.x) / CELL_SIZE) + 1);
    const endY = Math.min(GRID_HEIGHT, Math.ceil((innerHeight - camera.y) / CELL_SIZE) + 1);

    // Draw intersection dots for ALL visible cells
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

    // Build a set of cells that need content rendering:
    // 1. Cells with letters (from the grid Map)
    // 2. Cells adjacent to letters (for interaction highlights)
    // 3. Selected/hovered cells
    // 4. Cells with active animations (for disappearing cells)
    // Optimized: use stored x,y coordinates instead of parsing strings
    const cellsToRender = new Set();

    // Add all cells with letters that are visible (use stored x,y from cell data)
    for (const cell of grid.values()) {
        const { x, y } = cell;
        if (x >= startX && x < endX && y >= startY && y < endY) {
            cellsToRender.add(`${x},${y}`);
            // Also add adjacent cells for potential interactions
            if (x - 1 >= startX) cellsToRender.add(`${x - 1},${y}`);
            if (x + 1 < endX) cellsToRender.add(`${x + 1},${y}`);
            if (y - 1 >= startY) cellsToRender.add(`${x},${y - 1}`);
            if (y + 1 < endY) cellsToRender.add(`${x},${y + 1}`);
        }
    }

    // Add cells with active animations (for disappearing cells)
    for (const [key, anim] of cellAnims.entries()) {
        if (anim.opacity > 0.01) {
            const { x, y } = anim;
            if (x >= startX && x < endX && y >= startY && y < endY) {
                cellsToRender.add(key);
            }
        }
    }

    // Add selected and hovered cells
    if (selectedCell && selectedCell.x >= startX && selectedCell.x < endX &&
        selectedCell.y >= startY && selectedCell.y < endY) {
        cellsToRender.add(`${selectedCell.x},${selectedCell.y}`);
    }
    if (hoveredCell && hoveredCell.x >= startX && hoveredCell.x < endX &&
        hoveredCell.y >= startY && hoveredCell.y < endY) {
        cellsToRender.add(`${hoveredCell.x},${hoveredCell.y}`);
    }

    // Draw cell content (letters, highlights) only for cells that need it
    // Use grid lookup to get stored coordinates when available
    for (const key of cellsToRender) {
        const cell = grid.get(key);
        if (cell) {
            drawCellContent(cell.x, cell.y);
        } else {
            // Adjacent empty cells - parse coordinates (less frequent)
            const [x, y] = key.split(',').map(Number);
            drawCellContent(x, y);
        }
    }

    // Draw minimap overlay (handles its own fade animation)
    drawMinimap();

    requestAnimationFrame(draw);
}

// Draw cell content (letters, backgrounds, highlights) - dots are drawn separately
// Uses GSAP animation state for smooth transitions
function drawCellContent(x, y) {
    const key = `${x},${y}`;
    const cellData = grid.get(key);
    const anim = cellAnims.get(key);

    const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;
    const isHovered = hoveredCell && hoveredCell.x === x && hoveredCell.y === y;

    // Check if this is a disappearing cell (has anim but no grid data)
    const isDisappearing = !cellData && anim && anim.letter;

    // Early exit if cell doesn't need any rendering
    if (!cellData && !isSelected && !isHovered && !isDisappearing) return;

    // Get animation values (defaults for cells without animation state)
    const opacity = anim?.opacity ?? 1;
    const colorProgress = anim?.colorProgress ?? (cellData?.blooming ? 1 : 0);

    // Skip drawing if cell is fully invisible
    // BUT don't skip if selected/hovered (need to draw background during fade in/out)
    const needsBackground = isSelected || isHovered;
    if ((cellData || isDisappearing) && opacity <= 0.01 && !needsBackground) return;

    const screenPos = gridToScreen(x, y);
    const centerX = screenPos.x + CELL_SIZE / 2;
    const centerY = screenPos.y + CELL_SIZE / 2;
    const baseAlpha = 0.5 + (y / (GRID_HEIGHT - 3)) * 0.5;

    // Determine cell background for filled cells or disappearing cells
    if (cellData || isDisappearing) {
        const letter = cellData?.letter ?? anim.letter;
        const seed = cellData?.isSeed ?? false;
        const editable = !seed && isInBounds(x, y);

        // Interpolate color based on animation progress
        const primaryColor = seed ? COLORS.seed : lerpColor(COLORS.withering.primary, COLORS.blooming.primary, colorProgress);
        const bgColor = lerpColor(COLORS.withering.background, COLORS.blooming.background, colorProgress);

        ctx.save();

        // Draw background highlight for selected/hovered
        // Background is not affected by animation opacity
        if (editable) {
            if (isDisappearing) {
                // For disappearing cells, draw empty cell selection/hover background
                // so it doesn't flash to white during fade
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
                // For existing cells, draw cell's colored background
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

        // Draw the letter (animation opacity only applies here)
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
        // Empty cell - only render if selected or hovered AND valid for placement
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

// Mouse event handlers
canvas.addEventListener('mousedown', (e) => {
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    if (e.button === 0) { // Left click
        mouseDownPos = { x: e.clientX, y: e.clientY };
        lastMousePos = { x: e.clientX, y: e.clientY };
    }
});

canvas.addEventListener('mousemove', (e) => {
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    // Handle seed input mode
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

    // Check if dragging (mouse is held down and moved)
    if (e.buttons === 1) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;

        // Only start panning if moved more than threshold
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
        // Update hovered cell when not dragging - only for users with edit access
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
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    if (e.button === 0) {
        // Handle seed input mode
        if (seedInputMode) {
            const tileIndex = getSeedInputTileAt(e.clientX, e.clientY);
            if (tileIndex >= 0) {
                seedInputSelected = tileIndex;
            }
            return;
        }

        // Check if it was a click (not a drag)
        if (!isPanning) {
            // Only allow selection if user has edit access
            if (window.PLANT_DATA.canEdit) {
                const gridPos = screenToGrid(e.clientX, e.clientY);

                // Can select cells that are valid for placement or editable
                if (isInteractable(gridPos.x, gridPos.y)) {
                    selectedCell = gridPos;
                } else {
                    selectedCell = null;
                }
            }
        } else {
            // Was panning, trigger minimap hide with delay
            hideMinimap();
        }

        isPanning = false;
        canvas.style.cursor = (hoveredCell && window.PLANT_DATA.canEdit) ? 'pointer' : 'default';
    }
});

canvas.addEventListener('mouseleave', () => {
    // Disable interactions during seed transition animation
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

// Keyboard handler for letter input
document.addEventListener('keydown', (e) => {
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    // Only allow input if user has edit access
    if (!window.PLANT_DATA.canEdit) return;

    // Handle seed input mode separately
    if (seedInputMode) {
        handleSeedInputKeyboard(e);
        return;
    }

    if (!selectedCell) return;

    // Skip if modifier keys are pressed (allow hotkeys like Cmd+R to pass through)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Check if it's a letter key
    if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
        const { x, y } = selectedCell;
        const key = `${x},${y}`;
        const letter = e.key.toUpperCase();

        // Place new letter or edit existing (non-seed) letter
        if (isValidPlacement(x, y) || isEditableCell(x, y)) {
            // If editing an existing cell, capture words BEFORE the change
            const isEdit = hasLetter(x, y);
            const wordsBeforeEdit = new Set();
            if (isEdit) {
                for (const word of getWordsAtCell(x, y)) {
                    wordsBeforeEdit.add(word);
                }
                // Also check neighbor words that might be affected
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

            // Place the new letter
            grid.set(key, { x, y, letter, isSeed: false, blooming: false });
            updateBloomingStates(x, y);

            const cell = grid.get(key);

            // For new cells, animate appearance (fade in)
            // For edits, just update the letter without opacity animation
            if (isEdit) {
                updateCellLetter(x, y, cell.blooming);
            } else {
                animateCellAppear(x, y, cell.blooming);
            }

            // If this was an edit, check if old words were destroyed
            if (isEdit && wordsBeforeEdit.size > 0) {
                removeDeletedWords(wordsBeforeEdit);
            }

            // Emit to server
            emitTile(x, y, letter, cell.blooming);

            // Also sync blooming states for affected cells
            syncBloomingStates(x, y);
        }
    }

    // Handle backspace/delete for editable cells
    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (isEditableCell(selectedCell.x, selectedCell.y)) {
            const { x, y } = selectedCell;
            const key = `${x},${y}`;

            // Capture cell data BEFORE deletion for animation
            const cellToDelete = grid.get(key);
            const letterToDelete = cellToDelete?.letter;
            const bloomingToDelete = cellToDelete?.blooming ?? false;

            // Collect all words that might be affected BEFORE deletion
            const wordsBeforeDeletion = new Set();

            // Get words at the cell being deleted
            for (const word of getWordsAtCell(x, y)) {
                wordsBeforeDeletion.add(word);
            }

            // Also collect words from adjacent cells (they might form words with this cell)
            const neighbors = [
                { x: x - 1, y }, { x: x + 1, y },
                { x, y: y - 1 }, { x, y: y + 1 }
            ];
            for (const n of neighbors) {
                for (const word of getWordsAtCell(n.x, n.y)) {
                    wordsBeforeDeletion.add(word);
                }
            }

            // Collect cell data for disconnected tiles BEFORE deletion
            const beforeCells = new Map();
            for (const [k, cell] of grid.entries()) {
                beforeCells.set(k, { letter: cell.letter, blooming: cell.blooming });
            }

            grid.delete(key);
            // Prune any branches that got disconnected from the seed
            pruneDisconnectedLetters();

            // Find which tiles were disconnected (pruned)
            const disconnected = [...beforeCells.keys()]
                .filter(k => !grid.has(k) && k !== key)
                .map(k => {
                    const [dx, dy] = k.split(',').map(Number);
                    const cellData = beforeCells.get(k);
                    return { x: dx, y: dy, letter: cellData.letter, blooming: cellData.blooming };
                });

            // If there were disconnected tiles, also check all plantWords
            // since we can't easily get the words that were at those positions
            if (disconnected.length > 0) {
                for (const word of plantWords) {
                    wordsBeforeDeletion.add(word);
                }
            }

            // Animate the deleted cell disappearing
            animateCellDisappear(x, y, letterToDelete, bloomingToDelete);

            // Animate disconnected tiles: furthest first, closest last, with random variation
            if (disconnected.length > 0) {
                // Immediately set letter data in all anim states so cells remain visible
                // (prevents flash where cell disappears before animation starts)
                disconnected.forEach(tile => {
                    const tileKey = `${tile.x},${tile.y}`;
                    const anim = cellAnims.get(tileKey);
                    if (anim) {
                        anim.letter = tile.letter;
                    }
                });

                // Calculate distance from deleted cell for each disconnected tile
                disconnected.forEach(tile => {
                    tile.distance = Math.abs(tile.x - x) + Math.abs(tile.y - y);
                });

                // Sort by distance descending (furthest first)
                disconnected.sort((a, b) => b.distance - a.distance);

                // Animate with stagger, furthest tiles first
                const baseDelay = 30; // ms between tiles
                disconnected.forEach((tile, i) => {
                    // Add random variation (-20ms to +20ms)
                    const randomVariation = (Math.random() - 0.5) * 40;
                    const delay = Math.max(0, i * baseDelay + randomVariation);
                    setTimeout(() => {
                        animateCellDisappear(tile.x, tile.y, tile.letter, tile.blooming);
                    }, delay);
                });
            }

            // Update blooming states for adjacent cells
            updateBloomingStates(x, y);

            // Check if any words were lost and remove them from database
            removeDeletedWords(wordsBeforeDeletion);

            // Emit deletion to server
            emitDelete(x, y, disconnected.map(t => ({ x: t.x, y: t.y })));

            // Sync blooming states for affected cells
            syncBloomingStates(x, y);

            // Reschedule growth based on new tile count
            if (typeof rescheduleGrowth === 'function') {
                rescheduleGrowth();
            }
        }
    }

    // Arrow key navigation - to interactable cells
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

        // Only move if the new cell is interactable (valid for placement or editable)
        if (isInteractable(newX, newY)) {
            selectedCell = { x: newX, y: newY };
        }
    }

    // Escape to deselect
    if (e.key === 'Escape') {
        selectedCell = null;
    }
});

// Touch support for mobile
let touchStartPos = null;
let touchStartCamera = null;

canvas.addEventListener('touchstart', (e) => {
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    e.preventDefault();
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchStartCamera = { ...camera };
});

canvas.addEventListener('touchmove', (e) => {
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    e.preventDefault();
    if (!touchStartPos) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.x;
    const dy = touch.clientY - touchStartPos.y;

    // Show minimap when panning starts
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        showMinimap();
    }

    camera.x = touchStartCamera.x + dx;
    camera.y = touchStartCamera.y + dy;
    clampCamera();
});

canvas.addEventListener('touchend', (e) => {
    // Disable interactions during seed transition animation
    if (seedTransitionActive) return;

    if (touchStartPos) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.x);
        const dy = Math.abs(touch.clientY - touchStartPos.y);

        // If it was a tap (not a drag)
        if (dx < 10 && dy < 10) {
            const gridPos = screenToGrid(touch.clientX, touch.clientY);

            // Select cells that are interactable (valid for placement or editable)
            if (isInteractable(gridPos.x, gridPos.y)) {
                selectedCell = gridPos;
            } else {
                selectedCell = null;
            }
        } else {
            // Was panning, hide minimap with delay
            hideMinimap();
        }
    }

    touchStartPos = null;
    touchStartCamera = null;
});

// Position camera so seed is at bottom center of screen
function centerOnSeed() {
    // Get the actual seed word (from PLANT_DATA or default)
    const actualSeed = window.PLANT_DATA?.seed || SEED_WORD;
    const seedLength = actualSeed.length;
    const seedX = Math.floor(GRID_WIDTH / 2);
    const seedStartY = GRID_HEIGHT - seedLength;

    // For vertical seed: center on seed column, align bottom of seed to bottom of screen
    const seedCenterX = (seedX + 0.5) * CELL_SIZE;
    const seedBottomY = (seedStartY + seedLength) * CELL_SIZE; // Bottom edge of seed

    // Center horizontally, align seed to bottom of screen
    camera.x = window.innerWidth / 2 - seedCenterX;
    camera.y = window.innerHeight - seedBottomY;

    // Clamp to ensure we stay within grid bounds
    clampCamera();
}

// Initialize
async function init() {
    await loadDictionary();
    resize();

    // Connect to WebSocket and register event handlers
    // Pass username if viewing someone else's plant (not owner)
    const { username, isOwner, seed } = window.PLANT_DATA;
    connectSocket(isOwner ? null : username);

    // Handle initial connection confirmation
    onSocketEvent('connected', (data) => {
        // console.log('Connected to plant:', data.plantId, 'Owner:', data.isOwner, 'Seed:', data.seed);
    });

    // Handle seed set confirmation - transition to tree mode
    onSocketEvent('seedSet', (data) => {
        // console.log('Seed set confirmed:', data);
        transitionToTreeMode(data);
        // draw() is now called inside transitionToTreeMode after the animation completes
    });

    // Handle words changed (added/removed) by other clients
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
        // console.log('Words changed by another client:', data);
    });

    // Handle incoming tile updates from other clients/tabs
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
        // Animate if it's a new tile, otherwise just update letter
        if (isNew) {
            animateCellAppear(data.x, data.y, data.blooming);
        } else {
            updateCellLetter(data.x, data.y, data.blooming);
        }
    });

    // Handle incoming deletions from other clients/tabs
    onSocketEvent('delete', (data) => {
        // Capture cell data before deletion for animation
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

        // Reschedule growth based on new tile count
        if (typeof rescheduleGrowth === 'function') {
            rescheduleGrowth();
        }
    });

    // Handle batch blooming updates from other clients/tabs
    onSocketEvent('tilesUpdated', (data) => {
        if (data.tiles) {
            for (const tile of data.tiles) {
                const cell = grid.get(`${tile.x},${tile.y}`);
                if (cell) {
                    const wasBlooming = cell.blooming;
                    cell.blooming = tile.blooming;
                    // Animate color change if blooming state changed
                    if (wasBlooming !== tile.blooming) {
                        animateColorChange(tile.x, tile.y, tile.blooming);
                    }
                }
            }
        }
    });

    // Check if seed is set - if not, enter seed input mode (owner only)
    if (!seed && isOwner) {
        seedInputMode = true;
        initSeedInputAnims();  // Initialize animation state
        showSeedInputUI();     // Show the HTML UI elements
        // console.log('No seed set - entering seed input mode');
        drawSeedInput();
    } else {
        // Normal tree mode
        initTiles();
        initCellAnims();  // Initialize animation state for existing tiles
        initWords();  // Load plant-specific words from server-rendered data
        centerOnSeed();
        draw();

        // Start growth for existing trees (owner only - not for admins viewing other plants)
        if (isOwner) {
            triggerGrowthStart();
        }
    }
}

// Sync pending words on page unload
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

// Wait for font to load before initializing
(async () => {
    await document.fonts.load('normal 46px "Retro"');
    init();
})();