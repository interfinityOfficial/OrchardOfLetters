
const LETTER_INTERVAL = 1000;

const MIN_SEARCH_INTERVAL = 10 * 1000;
const MAX_SEARCH_INTERVAL = 5 * 60 * 1000;
const MIN_TILES_FOR_SCALING = 10;
const MAX_TILES_FOR_SCALING = 1000;

// Compute search interval based on current tile count
function getSearchInterval() {
    const tileCount = grid.size;

    if (tileCount <= MIN_TILES_FOR_SCALING) {
        return MIN_SEARCH_INTERVAL;
    }

    if (tileCount >= MAX_TILES_FOR_SCALING) {
        return MAX_SEARCH_INTERVAL;
    }

    const progress = (tileCount - MIN_TILES_FOR_SCALING) / (MAX_TILES_FOR_SCALING - MIN_TILES_FOR_SCALING);
    const interval = MIN_SEARCH_INTERVAL + progress * (MAX_SEARCH_INTERVAL - MIN_SEARCH_INTERVAL);

    return interval;
}

const MAX_WORD_LENGTH = 12;
const MIN_TIME_REMAINING = 1;
const WORDS_PER_CHECK = 25;

let isGrowing = false;
let growthTimeoutId = null;

let growthWords = new Set();
let growthWordsLoaded = false;

let wordClusters = null;
let clustersLoaded = false;

// Load the growth dictionary word list
async function loadGrowthDictionary() {
    if (growthWordsLoaded) return;
    try {
        const response = await fetch('/words/shortlist.txt');
        const text = await response.text();
        const words = text.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 3);
        growthWords = new Set(words);
        growthWordsLoaded = true;
    } catch (error) {
        console.error('Failed to load growth dictionary:', error);
        growthWords = validWords;
        growthWordsLoaded = true;
    }
}

// Load semantic clusters for relatedness scoring
async function loadSemanticClusters() {
    if (clustersLoaded) return;
    try {
        const response = await fetch('/words/shortlist_clusters.json');
        const categoryData = await response.json();

        wordClusters = {};
        let totalWords = 0;
        for (const [category, words] of Object.entries(categoryData)) {
            for (const word of words) {
                const upperWord = word.toUpperCase();
                if (!wordClusters[upperWord]) {
                    wordClusters[upperWord] = [];
                }
                wordClusters[upperWord].push(category);
                totalWords++;
            }
        }

        clustersLoaded = true;
    } catch (error) {
        console.error('Failed to load semantic clusters:', error);
        wordClusters = null;
        clustersLoaded = true;
    }
}

// Check if two words share any semantic category
function areWordsRelated(word1, word2) {
    if (!wordClusters) return false;

    const categories1 = wordClusters[word1];
    const categories2 = wordClusters[word2];

    if (!categories1 || !categories2) return false;

    for (const cat of categories1) {
        if (EXCLUDED_CATEGORIES.has(cat)) continue;
        if (categories2.includes(cat)) {
            return true;
        }
    }
    return false;
}

const EXCLUDED_CATEGORIES = new Set(['Othtags', 'Defined']);

// Score how semantically related a candidate is to its connections
function getSemanticScore(candidateWord, connectionWords) {
    if (!wordClusters || !connectionWords || connectionWords.length === 0) {
        return 0;
    }

    const candidateCats = wordClusters[candidateWord];
    if (!candidateCats || candidateCats.length === 0) return 0;

    const filteredCandidateCats = candidateCats.filter(c => !EXCLUDED_CATEGORIES.has(c));
    if (filteredCandidateCats.length === 0) return 0;

    let maxScore = 0;

    for (const connWord of connectionWords) {
        const connCats = wordClusters[connWord];
        if (!connCats || connCats.length === 0) continue;

        const filteredConnCats = connCats.filter(c => !EXCLUDED_CATEGORIES.has(c));
        if (filteredConnCats.length === 0) continue;

        let sharedCount = 0;
        for (const cat of filteredCandidateCats) {
            if (filteredConnCats.includes(cat)) {
                sharedCount++;
            }
        }

        if (sharedCount > 0) {
            const score = sharedCount / Math.min(filteredCandidateCats.length, filteredConnCats.length);
            maxScore = Math.max(maxScore, score);
        }
    }

    return maxScore;
}

// Gather words connected to a candidate placement
function getConnectionWords(startX, startY, direction, existingLetters) {
    const words = new Set();
    const isHorizontal = direction === 'horizontal';

    for (const [pos, letter] of existingLetters) {
        const x = isHorizontal ? startX + pos : startX;
        const y = isHorizontal ? startY : startY + pos;

        const hWord = getWordAt(x, y, 'horizontal');
        if (hWord && hWord.word.length >= 3 && isValidWord(hWord.word)) {
            words.add(hWord.word.toUpperCase());
        }

        const vWord = getWordAt(x, y, 'vertical');
        if (vWord && vWord.word.length >= 3 && isValidWord(vWord.word)) {
            words.add(vWord.word.toUpperCase());
        }
    }

    return Array.from(words);
}

let currentTarget = null;

let wordsByLength = new Map();
let indexBuilt = false;
let indexBuildInProgress = false;

const MAX_WORD_USES = 1;
let wordUsageCount = new Map();

let searchState = null;

const requestIdle = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 50, didTimeout: false }), 1);

const cancelIdle = typeof cancelIdleCallback !== 'undefined'
    ? cancelIdleCallback
    : clearTimeout;

// Build the growth word index grouped by length
async function buildWordIndex() {
    if (indexBuilt || indexBuildInProgress) return;

    await Promise.all([
        growthWordsLoaded ? Promise.resolve() : loadGrowthDictionary(),
        clustersLoaded ? Promise.resolve() : loadSemanticClusters()
    ]);

    if (growthWords.size === 0) return;

    indexBuildInProgress = true;
    const startTime = performance.now();

    const wordsIterator = growthWords.values();
    wordsByLength.clear();


    function processChunk(deadline) {
        let count = 0;
        while (true) {
            if (count++ % 1000 === 0 && deadline.timeRemaining() < MIN_TIME_REMAINING && !deadline.didTimeout) {
                requestIdle(processChunk, { timeout: 500 });
                return;
            }

            const result = wordsIterator.next();
            if (result.done) {
                for (const [len, words] of wordsByLength) {
                    shuffleArray(words);
                }
                indexBuilt = true;
                indexBuildInProgress = false;
                if (growthRequested) {
                    startGrowth();
                }
                return;
            }

            const word = result.value;
            if (word.length <= MAX_WORD_LENGTH && word.length >= 3) {
                const len = word.length;
                if (!wordsByLength.has(len)) {
                    wordsByLength.set(len, []);
                }
                wordsByLength.get(len).push(word);
            }
        }
    }

    requestIdle(processChunk, { timeout: 500 });
}

let growthRequested = false;

// Start the auto-growth system
function startGrowth() {
    if (isGrowing) return;

    growthRequested = true;

    if (!indexBuilt && !indexBuildInProgress) {
        buildWordIndex();
        return;
    }

    if (!indexBuilt) return;

    isGrowing = true;
    scheduleNextStep(getSearchInterval());
}

window.startGrowth = startGrowth;

if (window.pendingGrowthStart) {
    delete window.pendingGrowthStart;
    startGrowth();
}

// Schedule the next growth action
function scheduleNextStep(interval) {
    if (!isGrowing) return;

    if (growthTimeoutId) {
        clearTimeout(growthTimeoutId);
    }

    growthTimeoutId = setTimeout(() => {
        growthTimeoutId = null;
        if (isGrowing) {
            requestIdle((deadline) => growStep(deadline), { timeout: 200 });
        }
    }, interval);
}

// Stop auto-growth and clear state
function stopGrowth() {
    if (!isGrowing) return;
    isGrowing = false;
    currentTarget = null;
    searchState = null;
    if (growthTimeoutId) {
        clearTimeout(growthTimeoutId);
        growthTimeoutId = null;
    }
    wordUsageCount.clear();
}

// Reschedule growth timing after tiles change
function rescheduleGrowth() {
    if (!isGrowing) return;

    if (currentTarget) {
        return;
    }

    if (growthTimeoutId) {
        clearTimeout(growthTimeoutId);
        growthTimeoutId = null;
    }

    const newInterval = getSearchInterval();
    scheduleNextStep(newInterval);
}

// Toggle auto-growth on or off
function toggleGrowth() {
    if (isGrowing) {
        stopGrowth();
    } else {
        startGrowth();
    }
    return isGrowing;
}

// Track how many times a word has been used
function recordWordUsage(word) {
    const count = (wordUsageCount.get(word) || 0) + 1;
    wordUsageCount.set(word, count);

    if (count >= MAX_WORD_USES) {
    }
}

// Check if a word is still eligible for use
function canUseWord(word) {
    const count = wordUsageCount.get(word) || 0;
    return count < MAX_WORD_USES;
}

// Execute one growth step or continue searching
function growStep(deadline) {
    if (!isGrowing || !indexBuilt) return;

    const startTime = performance.now();

    if (currentTarget) {
        const placed = placeNextLetter();
        if (placed) {
            if (placed.blocked) {
                currentTarget = null;
                scheduleNextStep(getSearchInterval());
            } else {

                if (currentTarget.queueIndex >= currentTarget.placementQueue.length) {
                    recordWordUsage(currentTarget.word);
                    currentTarget = null;
                    scheduleNextStep(getSearchInterval());
                } else {
                    scheduleNextStep(LETTER_INTERVAL);
                }
            }
            return;
        }
        recordWordUsage(currentTarget.word);
        currentTarget = null;
        scheduleNextStep(getSearchInterval());
        return;
    }

    continueSearch(deadline, startTime);
}

// Build placement order expanding outward from existing letters
function buildPlacementQueue(word, direction, startX, startY) {
    const isHorizontal = direction === 'horizontal';
    const len = word.length;

    const existingIndices = new Set();
    for (let i = 0; i < len; i++) {
        const cx = isHorizontal ? startX + i : startX;
        const cy = isHorizontal ? startY : startY + i;
        if (hasLetter(cx, cy)) {
            existingIndices.add(i);
        }
    }

    const queue = [];
    const visited = new Set(existingIndices);
    const toPlace = [];

    for (const idx of existingIndices) {
        if (idx > 0 && !visited.has(idx - 1)) {
            visited.add(idx - 1);
            queue.push(idx - 1);
        }
        if (idx < len - 1 && !visited.has(idx + 1)) {
            visited.add(idx + 1);
            queue.push(idx + 1);
        }
    }

    while (queue.length > 0) {
        const idx = queue.shift();
        toPlace.push(idx);

        if (idx > 0 && !visited.has(idx - 1)) {
            visited.add(idx - 1);
            queue.push(idx - 1);
        }
        if (idx < len - 1 && !visited.has(idx + 1)) {
            visited.add(idx + 1);
            queue.push(idx + 1);
        }
    }

    return toPlace;
}

// Initialize incremental search state
function initSearchState() {
    const positions = getGrowthStartPositions();
    if (positions.length === 0) return null;

    return {
        positions: positions,
        posIndex: 0,
        candidates: [],
        currentPos: null,
        directions: null,
        dirIndex: 0,
        lineInfo: null,
        wordLen: 3,
        offset: 0,
        wordIndex: 0,
        wordsChecked: 0
    };
}

// Continue incremental search within idle time
function continueSearch(deadline, startTime) {
    if (!searchState) {
        searchState = initSearchState();
        if (!searchState) {
            scheduleNextStep(getSearchInterval());
            return;
        }
    }

    const state = searchState;

    while (true) {
        if (state.wordsChecked % WORDS_PER_CHECK === 0) {
            if (deadline.timeRemaining() < MIN_TIME_REMAINING && !deadline.didTimeout) {
                requestIdle((nextDeadline) => continueSearch(nextDeadline, startTime), { timeout: 100 });
                return;
            }
        }

        if (state.candidates.length >= 100) {
            finishSearch(startTime);
            return;
        }

        if (!state.currentPos) {
            if (state.posIndex >= state.positions.length) {
                finishSearch(startTime);
                return;
            }

            state.currentPos = state.positions[state.posIndex];
            state.posIndex++;

            state.directions = [];
            if (hasLetter(state.currentPos.x - 1, state.currentPos.y) ||
                hasLetter(state.currentPos.x + 1, state.currentPos.y)) {
                state.directions.push('horizontal');
            }
            if (hasLetter(state.currentPos.x, state.currentPos.y - 1) ||
                hasLetter(state.currentPos.x, state.currentPos.y + 1)) {
                state.directions.push('vertical');
            }
            state.dirIndex = 0;
            state.lineInfo = null;
        }

        if (!state.lineInfo) {
            if (state.dirIndex >= state.directions.length) {
                state.currentPos = null;
                continue;
            }

            const direction = state.directions[state.dirIndex];
            state.dirIndex++;

            state.lineInfo = computeLineInfo(state.currentPos.x, state.currentPos.y, direction);
            state.wordLen = Math.max(3, state.lineInfo.lineLength);
            state.offset = 0;
            state.wordIndex = 0;
        }

        const info = state.lineInfo;

        if (info.hasExistingValidWord && state.wordLen <= info.existingWordStr.length) {
            state.wordLen++;
            state.offset = 0;
            state.wordIndex = 0;
            if (state.wordLen > MAX_WORD_LENGTH) {
                state.lineInfo = null;
            }
            continue;
        }

        const words = wordsByLength.get(state.wordLen) || [];
        const maxOffset = state.wordLen - info.lineLength;

        if (state.offset > maxOffset) {
            state.wordLen++;
            state.offset = 0;
            state.wordIndex = 0;
            if (state.wordLen > MAX_WORD_LENGTH) {
                state.lineInfo = null;
            }
            continue;
        }

        if (state.wordIndex >= words.length) {
            state.offset++;
            state.wordIndex = 0;
            continue;
        }

        const word = words[state.wordIndex];
        state.wordIndex++;
        state.wordsChecked++;

        if (!canUseWord(word)) continue;

        let matches = true;
        for (const [pos, letter] of info.existingLetters) {
            const wordPos = pos + state.offset;
            if (wordPos >= state.wordLen || word[wordPos] !== letter) {
                matches = false;
                break;
            }
        }

        if (!matches) continue;

        let wordStartX, wordStartY;
        if (info.isHorizontal) {
            wordStartX = info.lineStart - state.offset;
            wordStartY = state.currentPos.y;
        } else {
            wordStartX = state.currentPos.x;
            wordStartY = info.lineStart - state.offset;
        }

        if (!canWordFit(wordStartX, wordStartY, word, info.direction)) continue;
        if (!validateWordPlacement(wordStartX, wordStartY, word, info.direction)) continue;

        let remainingLetters = 0;
        for (let i = 0; i < word.length; i++) {
            const cx = info.isHorizontal ? wordStartX + i : wordStartX;
            const cy = info.isHorizontal ? wordStartY : wordStartY + i;
            if (!hasLetter(cx, cy)) remainingLetters++;
        }

        if (remainingLetters === 0) continue;

        const connectionWords = getConnectionWords(wordStartX, wordStartY, info.direction, info.existingLetters);
        const semanticScore = getSemanticScore(word, connectionWords);

        state.candidates.push({
            word: word,
            direction: info.direction,
            startX: wordStartX,
            startY: wordStartY,
            remainingLetters: remainingLetters,
            extendsValidWord: info.hasExistingValidWord,
            balanceScore: getBalanceScore(wordStartX, wordStartY, info.direction, word.length),
            semanticScore: semanticScore,
            connectionWords: connectionWords
        });

        if (state.candidates.length >= 10 * state.posIndex) {
            state.lineInfo = null;
            state.currentPos = null;
        }
    }
}

// Compute line bounds and existing letters for a position
function computeLineInfo(x, y, direction) {
    const isHorizontal = direction === 'horizontal';
    let lineStart, lineEnd;
    const existingLetters = new Map();

    if (isHorizontal) {
        lineStart = x;
        while (hasLetter(lineStart - 1, y)) lineStart--;
        lineEnd = x;
        while (hasLetter(lineEnd + 1, y)) lineEnd++;
        for (let cx = lineStart; cx <= lineEnd; cx++) {
            if (hasLetter(cx, y)) {
                existingLetters.set(cx - lineStart, getLetter(cx, y));
            }
        }
    } else {
        lineStart = y;
        while (hasLetter(x, lineStart - 1)) lineStart--;
        lineEnd = y;
        while (hasLetter(x, lineEnd + 1)) lineEnd++;
        for (let cy = lineStart; cy <= lineEnd; cy++) {
            if (hasLetter(x, cy)) {
                existingLetters.set(cy - lineStart, getLetter(x, cy));
            }
        }
    }

    const lineLength = lineEnd - lineStart + 1;
    const existingWordStr = Array.from(existingLetters.values()).join('');
    const hasExistingValidWord = existingWordStr.length >= 3 && isValidWord(existingWordStr);

    return {
        direction,
        isHorizontal,
        lineStart,
        lineEnd,
        lineLength,
        existingLetters,
        existingWordStr,
        hasExistingValidWord
    };
}

// Select the best candidate target and set it active
function finishSearch(startTime) {
    const state = searchState;
    searchState = null;

    if (!state || state.candidates.length === 0) {
        scheduleNextStep(getSearchInterval());
        return;
    }

    const semanticCount = state.candidates.filter(c => c.semanticScore > 0).length;

    state.candidates.sort((a, b) => {
        if (a.semanticScore !== b.semanticScore) {
            return b.semanticScore - a.semanticScore;
        }
        if (a.remainingLetters !== b.remainingLetters) {
            return a.remainingLetters - b.remainingLetters;
        }
        if (a.word.length !== b.word.length) {
            return b.word.length - a.word.length;
        }
        return b.balanceScore - a.balanceScore;
    });

    let selected;
    const semanticCandidates = state.candidates.filter(c => c.semanticScore > 0);

    if (semanticCandidates.length > 0 && Math.random() < 0.85) {
        const topSemantic = semanticCandidates.slice(0, Math.min(5, semanticCandidates.length));
        selected = topSemantic[Math.floor(Math.random() * topSemantic.length)];
    } else if (Math.random() < 0.7) {
        selected = state.candidates[0];
    } else {
        const topN = state.candidates.slice(0, Math.min(5, state.candidates.length));
        selected = topN[Math.floor(Math.random() * topN.length)];
    }

    if (selected.semanticScore > 0) {
    }

    const placementQueue = buildPlacementQueue(
        selected.word,
        selected.direction,
        selected.startX,
        selected.startY
    );

    currentTarget = {
        word: selected.word,
        direction: selected.direction,
        startX: selected.startX,
        startY: selected.startY,
        placementQueue: placementQueue,
        queueIndex: 0
    };


    scheduleNextStep(LETTER_INTERVAL);
}

// Place the next letter of the current target word
function placeNextLetter() {
    if (!currentTarget) return null;
    if (currentTarget.queueIndex >= currentTarget.placementQueue.length) return null;

    const { word, direction, startX, startY, placementQueue, queueIndex } = currentTarget;
    const isHorizontal = direction === 'horizontal';

    const letterIndex = placementQueue[queueIndex];
    const letter = word[letterIndex];

    const x = isHorizontal ? startX + letterIndex : startX;
    const y = isHorizontal ? startY : startY + letterIndex;

    if (!isInBounds(x, y) || isBlockedBySeed(x, y)) {
        return { blocked: true, index: letterIndex };
    }

    if (hasLetter(x, y)) {
        if (getLetter(x, y) === letter) {
            currentTarget.queueIndex++;
            return placeNextLetter();
        }
        return { blocked: true, index: letterIndex };
    }

    if (!isAdjacentToLetter(x, y)) {
        return { blocked: true, index: letterIndex };
    }

    const key = `${x},${y}`;
    grid.set(key, { x, y, letter: letter, isSeed: false, blooming: false });

    updateBloomingStates(x, y);

    const cell = grid.get(key);
    animateCellAppear(x, y, cell.blooming);

    emitTile(x, y, letter, cell.blooming);

    syncBloomingStates(x, y);

    currentTarget.queueIndex++;
    return { x, y, letter, index: letterIndex };
}

// Balance growth toward the less-populated side
function getBalanceScore(startX, startY, direction, wordLen) {
    let leftCount = 0;
    let rightCount = 0;

    for (const key of grid.keys()) {
        const [gx] = key.split(',').map(Number);
        if (gx < SEED_X) leftCount++;
        else if (gx > SEED_X) rightCount++;
    }

    const wordCenterX = direction === 'horizontal'
        ? startX + wordLen / 2
        : startX;

    if (wordCenterX < SEED_X) {
        return rightCount - leftCount;
    } else if (wordCenterX > SEED_X) {
        return leftCount - rightCount;
    }
    return 0;
}

// Find candidate positions to start new words
function getGrowthStartPositions() {
    const positions = [];
    const seen = new Set();

    for (const key of grid.keys()) {
        const [x, y] = key.split(',').map(Number);

        const neighbors = [
            { x: x, y: y - 1 },
            { x: x, y: y + 1 },
            { x: x - 1, y: y },
            { x: x + 1, y: y }
        ];

        for (const n of neighbors) {
            const nkey = `${n.x},${n.y}`;
            if (!seen.has(nkey) &&
                !hasLetter(n.x, n.y) &&
                isInBounds(n.x, n.y) &&
                !isBlockedBySeed(n.x, n.y) &&
                isAdjacentToLetter(n.x, n.y)) {
                seen.add(nkey);
                positions.push(n);
            }
        }
    }

    shuffleArray(positions);
    return positions;
}

// Verify a word can fit within bounds without blocking seeds
function canWordFit(startX, startY, word, direction) {
    const isHorizontal = direction === 'horizontal';
    const len = word.length;

    if (isHorizontal) {
        if (startX < 0 || startX + len > GRID_WIDTH) return false;
        if (startY < 0 || startY >= GRID_HEIGHT - 3) return false;
    } else {
        if (startX < 0 || startX >= GRID_WIDTH) return false;
        if (startY < 0 || startY + len > GRID_HEIGHT - 3) return false;
    }

    for (let i = 0; i < len; i++) {
        const cx = isHorizontal ? startX + i : startX;
        const cy = isHorizontal ? startY : startY + i;

        if (isBlockedBySeed(cx, cy)) return false;

        if (hasLetter(cx, cy)) {
            if (getLetter(cx, cy) !== word[i]) return false;
        }
    }

    return true;
}

// Enforce perpendicular adjacency rules for a placement
function validateWordPlacement(startX, startY, word, direction) {
    const isHorizontal = direction === 'horizontal';
    const len = word.length;

    if (isHorizontal) {
        if (startX > 0 && hasLetter(startX - 1, startY)) return false;
        if (startX + len < GRID_WIDTH && hasLetter(startX + len, startY)) return false;
    } else {
        if (startY > 0 && hasLetter(startX, startY - 1)) return false;
        if (startY + len < GRID_HEIGHT - 3 && hasLetter(startX, startY + len)) return false;
    }

    for (let i = 0; i < len; i++) {
        const cx = isHorizontal ? startX + i : startX;
        const cy = isHorizontal ? startY : startY + i;

        if (hasLetter(cx, cy)) continue;

        const perpNeighbors = isHorizontal
            ? [{ x: cx, y: cy - 1 }, { x: cx, y: cy + 1 }]
            : [{ x: cx - 1, y: cy }, { x: cx + 1, y: cy }];

        let perpCount = 0;
        for (const n of perpNeighbors) {
            if (hasLetter(n.x, n.y)) perpCount++;
        }

        if (perpCount > 0) return false;
    }

    return true;
}

// Shuffle an array in place
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


buildWordIndex();

