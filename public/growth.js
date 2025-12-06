// Auto-growth system for the word tree
// Commits to completing one word at a time
// Considers both prefix and suffix when finding words
// Only extends valid words if a longer valid word can be formed
// Uses requestIdleCallback with granular yielding to avoid blocking
// Places letters outward from connection points, respecting growth interval

// Timing intervals (in milliseconds)
const LETTER_INTERVAL = 1000;   // Time between placing each letter while building a word

// Dynamic search interval based on tree size
const MIN_SEARCH_INTERVAL = 10 * 1000;    // when tree is small
const MAX_SEARCH_INTERVAL = 5 * 60 * 1000;   // when tree is large
const MIN_TILES_FOR_SCALING = 10;
const MAX_TILES_FOR_SCALING = 1000;

// Calculate search interval based on current tree size
function getSearchInterval() {
    const tileCount = grid.size;

    // If tree is small, grow faster
    if (tileCount <= MIN_TILES_FOR_SCALING) {
        return MIN_SEARCH_INTERVAL;
    }

    // If tree is large, grow slower
    if (tileCount >= MAX_TILES_FOR_SCALING) {
        return MAX_SEARCH_INTERVAL;
    }

    // Linear interpolation between min and max
    const progress = (tileCount - MIN_TILES_FOR_SCALING) / (MAX_TILES_FOR_SCALING - MIN_TILES_FOR_SCALING);
    const interval = MIN_SEARCH_INTERVAL + progress * (MAX_SEARCH_INTERVAL - MIN_SEARCH_INTERVAL);

    // console.log(`Tree has ${tileCount} tiles, next word in ${(interval / 1000).toFixed(1)}s`);
    return interval;
}

const MAX_WORD_LENGTH = 12;
const MIN_TIME_REMAINING = 1; // ms - yield if less time remaining
const WORDS_PER_CHECK = 25; // Check deadline every N words

let isGrowing = false;
let growthTimeoutId = null;  // Track scheduled timeout for rescheduling

// Growth-specific word list (loaded from short.txt)
let growthWords = new Set();
let growthWordsLoaded = false;

// Semantic clusters for word relatedness
let wordClusters = null;
let clustersLoaded = false;

// Load growth dictionary from inquirer_wordlist.txt (General Inquirer word list)
async function loadGrowthDictionary() {
    if (growthWordsLoaded) return;
    try {
        const response = await fetch('/words/inquirer_wordlist.txt');
        const text = await response.text();
        const words = text.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 3);
        growthWords = new Set(words);
        growthWordsLoaded = true;
        // console.log(`Growth dictionary loaded: ${growthWords.size} words from inquirer_wordlist.txt`);
    } catch (error) {
        console.error('Failed to load growth dictionary:', error);
        // Fallback to validWords if inquirer_wordlist.txt fails
        growthWords = validWords;
        growthWordsLoaded = true;
    }
}

// Load semantic clusters for word relatedness (General Inquirer categories)
async function loadSemanticClusters() {
    if (clustersLoaded) return;
    try {
        const response = await fetch('/words/inquirer_clusters.json');
        const categoryData = await response.json();

        // Convert category-based format to word->category lookup
        // Format: {"CATEGORY_NAME": ["WORD1", "WORD2", ...]}
        wordClusters = {};
        let totalWords = 0;
        for (const [category, words] of Object.entries(categoryData)) {
            for (const word of words) {
                const upperWord = word.toUpperCase();
                // A word can belong to multiple categories - store as array
                if (!wordClusters[upperWord]) {
                    wordClusters[upperWord] = [];
                }
                wordClusters[upperWord].push(category);
                totalWords++;
            }
        }

        clustersLoaded = true;
        // console.log(`Semantic clusters loaded: ${Object.keys(wordClusters).length} unique words across ${Object.keys(categoryData).length} categories (${totalWords} total assignments)`);
    } catch (error) {
        console.error('Failed to load semantic clusters:', error);
        wordClusters = null;
        clustersLoaded = true; // Mark as loaded to avoid retrying
    }
}

// Check if two words share any semantic category (excluding generic meta-categories)
function areWordsRelated(word1, word2) {
    if (!wordClusters) return false;

    const categories1 = wordClusters[word1];
    const categories2 = wordClusters[word2];

    // Both words must have category assignments
    if (!categories1 || !categories2) return false;

    // Check if they share ANY semantic category (excluding generic ones)
    for (const cat of categories1) {
        if (EXCLUDED_CATEGORIES.has(cat)) continue;
        if (categories2.includes(cat)) {
            return true;
        }
    }
    return false;
}

// Generic meta-categories to exclude from semantic scoring
const EXCLUDED_CATEGORIES = new Set(['Othtags', 'Defined']);

// Get semantic relatedness score between a candidate word and connection words
// Returns a score from 0-1 based on proportion of shared categories
function getSemanticScore(candidateWord, connectionWords) {
    if (!wordClusters || !connectionWords || connectionWords.length === 0) {
        return 0;
    }

    const candidateCats = wordClusters[candidateWord];
    if (!candidateCats || candidateCats.length === 0) return 0;

    // Filter out generic meta-categories
    const filteredCandidateCats = candidateCats.filter(c => !EXCLUDED_CATEGORIES.has(c));
    if (filteredCandidateCats.length === 0) return 0;

    let maxScore = 0;

    for (const connWord of connectionWords) {
        const connCats = wordClusters[connWord];
        if (!connCats || connCats.length === 0) continue;

        // Filter out generic meta-categories
        const filteredConnCats = connCats.filter(c => !EXCLUDED_CATEGORIES.has(c));
        if (filteredConnCats.length === 0) continue;

        // Count shared semantic categories (efficient for small arrays ~6.6 avg)
        let sharedCount = 0;
        for (const cat of filteredCandidateCats) {
            if (filteredConnCats.includes(cat)) {
                sharedCount++;
            }
        }

        if (sharedCount > 0) {
            // Score = shared / min(cats) - rewards words with high category overlap
            const score = sharedCount / Math.min(filteredCandidateCats.length, filteredConnCats.length);
            maxScore = Math.max(maxScore, score);
        }
    }

    return maxScore;
}

// Get words that a candidate placement would connect to
function getConnectionWords(startX, startY, direction, existingLetters) {
    const words = new Set();
    const isHorizontal = direction === 'horizontal';

    // For each existing letter position, find the words it belongs to
    for (const [pos, letter] of existingLetters) {
        const x = isHorizontal ? startX + pos : startX;
        const y = isHorizontal ? startY : startY + pos;

        // Get horizontal word at this position
        const hWord = getWordAt(x, y, 'horizontal');
        if (hWord && hWord.word.length >= 3 && isValidWord(hWord.word)) {
            words.add(hWord.word.toUpperCase());
        }

        // Get vertical word at this position
        const vWord = getWordAt(x, y, 'vertical');
        if (vWord && vWord.word.length >= 3 && isValidWord(vWord.word)) {
            words.add(vWord.word.toUpperCase());
        }
    }

    return Array.from(words);
}

// Current target word being grown
// {
//   word: string,
//   direction: 'horizontal' | 'vertical',
//   startX: number,
//   startY: number,
//   placementQueue: number[],  // indices to place, ordered outward from connection
//   queueIndex: number         // current position in queue
// }
let currentTarget = null;

// Word index by length for pattern matching
let wordsByLength = new Map();
let indexBuilt = false;
let indexBuildInProgress = false;

// Track word usage - remove words after being used twice
const MAX_WORD_USES = 1;
let wordUsageCount = new Map(); // word -> count

// Search state for incremental target finding
let searchState = null;

// Polyfill for requestIdleCallback
const requestIdle = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 50, didTimeout: false }), 1);

const cancelIdle = typeof cancelIdleCallback !== 'undefined'
    ? cancelIdleCallback
    : clearTimeout;

// Build index incrementally to avoid blocking
async function buildWordIndex() {
    if (indexBuilt || indexBuildInProgress) return;

    // Load growth dictionary and semantic clusters in parallel
    await Promise.all([
        growthWordsLoaded ? Promise.resolve() : loadGrowthDictionary(),
        clustersLoaded ? Promise.resolve() : loadSemanticClusters()
    ]);

    if (growthWords.size === 0) return;

    indexBuildInProgress = true;
    // console.log('Building growth word index...');
    const startTime = performance.now();

    const wordsIterator = growthWords.values();
    wordsByLength.clear();

    function processChunk(deadline) {
        let count = 0;
        while (true) {
            // Check deadline periodically
            if (count++ % 1000 === 0 && deadline.timeRemaining() < MIN_TIME_REMAINING && !deadline.didTimeout) {
                requestIdle(processChunk, { timeout: 500 });
                return;
            }

            const result = wordsIterator.next();
            if (result.done) {
                // Shuffle each word list to avoid alphabetical bias
                for (const [len, words] of wordsByLength) {
                    shuffleArray(words);
                }
                indexBuilt = true;
                indexBuildInProgress = false;
                // console.log(`Word index built in ${(performance.now() - startTime).toFixed(1)}ms`);
                // Now that index is ready, start growth if it was requested
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

// Flag to track if growth was requested (by plant.js)
let growthRequested = false;

// Start auto-growth
function startGrowth() {
    if (isGrowing) return;

    // Mark that growth was requested
    growthRequested = true;

    if (!indexBuilt && !indexBuildInProgress) {
        buildWordIndex();
        return; // Will be called again when index is ready
    }

    if (!indexBuilt) return; // Index still building

    isGrowing = true;
    // Start with search interval (looking for first word)
    scheduleNextStep(getSearchInterval());
    // console.log('Auto-growth started');
}

// Expose startGrowth globally so plant.js can call it when ready
window.startGrowth = startGrowth;

// Check if plant.js already requested growth start before we loaded
if (window.pendingGrowthStart) {
    delete window.pendingGrowthStart;
    startGrowth();
}

// Schedule next growth step with specified interval
function scheduleNextStep(interval) {
    if (!isGrowing) return;

    // Clear any existing timeout before scheduling new one
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

function stopGrowth() {
    if (!isGrowing) return;
    isGrowing = false;
    currentTarget = null;
    searchState = null;
    // Clear scheduled timeout
    if (growthTimeoutId) {
        clearTimeout(growthTimeoutId);
        growthTimeoutId = null;
    }
    // Clear word usage tracking
    wordUsageCount.clear();
    // console.log('Auto-growth stopped');
}

// Reschedule growth based on current tile count (call when tiles are removed)
function rescheduleGrowth() {
    if (!isGrowing) return;

    // If currently building a word, don't interrupt - let it finish
    if (currentTarget) {
        // console.log('Tiles removed but word in progress, will reschedule after completion');
        return;
    }

    // Cancel pending search and reschedule with new interval
    if (growthTimeoutId) {
        clearTimeout(growthTimeoutId);
        growthTimeoutId = null;
    }

    const newInterval = getSearchInterval();
    // console.log(`Tiles removed - rescheduling growth (${grid.size} tiles, next search in ${(newInterval / 1000).toFixed(1)}s)`);
    scheduleNextStep(newInterval);
}

function toggleGrowth() {
    if (isGrowing) {
        stopGrowth();
    } else {
        startGrowth();
    }
    return isGrowing;
}

// Record word usage
function recordWordUsage(word) {
    const count = (wordUsageCount.get(word) || 0) + 1;
    wordUsageCount.set(word, count);

    if (count >= MAX_WORD_USES) {
        // console.log(`"${word}" has been used ${count} times (max reached)`);
    }
}

// Check if a word can still be used
function canUseWord(word) {
    const count = wordUsageCount.get(word) || 0;
    return count < MAX_WORD_USES;
}

// Main growth step - non-blocking
function growStep(deadline) {
    if (!isGrowing || !indexBuilt) return;

    const startTime = performance.now();

    // If we have a current target, place next letter
    if (currentTarget) {
        const placed = placeNextLetter();
        if (placed) {
            if (placed.blocked) {
                // console.log(`✗ Abandoned target "${currentTarget.word}" - blocked at position ${placed.index}`);
                currentTarget = null;
                // Word abandoned, wait before searching for next
                scheduleNextStep(getSearchInterval());
            } else {
                // console.log(`Placed '${placed.letter}' at (${placed.x},${placed.y}) for "${currentTarget.word}" [${currentTarget.queueIndex}/${currentTarget.placementQueue.length}]`);

                // Check if word is complete
                if (currentTarget.queueIndex >= currentTarget.placementQueue.length) {
                    // console.log(`✓ Completed word: "${currentTarget.word}"`);
                    recordWordUsage(currentTarget.word);
                    currentTarget = null;
                    // Word complete, wait before searching for next
                    scheduleNextStep(getSearchInterval());
                } else {
                    // More letters to place, use letter interval
                    scheduleNextStep(LETTER_INTERVAL);
                }
            }
            return;
        }
        // No more letters to place (queue exhausted)
        // console.log(`✓ Completed word: "${currentTarget.word}"`);
        recordWordUsage(currentTarget.word);
        currentTarget = null;
        // Word complete, wait before searching for next
        scheduleNextStep(getSearchInterval());
        return;
    }

    // Find a new target using incremental search (don't place letter yet)
    continueSearch(deadline, startTime);
}

// Build placement queue for a word - BFS outward from existing letters
function buildPlacementQueue(word, direction, startX, startY) {
    const isHorizontal = direction === 'horizontal';
    const len = word.length;

    // Find which indices already have letters (these are our "seeds")
    const existingIndices = new Set();
    for (let i = 0; i < len; i++) {
        const cx = isHorizontal ? startX + i : startX;
        const cy = isHorizontal ? startY : startY + i;
        if (hasLetter(cx, cy)) {
            existingIndices.add(i);
        }
    }

    // BFS from existing indices to build placement order
    const queue = [];
    const visited = new Set(existingIndices);
    const toPlace = [];

    // Start BFS from all existing indices
    for (const idx of existingIndices) {
        // Add neighbors of existing letters to queue
        if (idx > 0 && !visited.has(idx - 1)) {
            visited.add(idx - 1);
            queue.push(idx - 1);
        }
        if (idx < len - 1 && !visited.has(idx + 1)) {
            visited.add(idx + 1);
            queue.push(idx + 1);
        }
    }

    // BFS to find placement order
    while (queue.length > 0) {
        const idx = queue.shift();
        toPlace.push(idx);

        // Add unvisited neighbors
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

// Initialize search state
function initSearchState() {
    const positions = getGrowthStartPositions();
    if (positions.length === 0) return null;

    return {
        positions: positions,
        posIndex: 0,
        candidates: [],
        // Current position search state
        currentPos: null,
        directions: null,
        dirIndex: 0,
        // Current direction search state
        lineInfo: null,
        wordLen: 3,
        offset: 0,
        wordIndex: 0,
        wordsChecked: 0
    };
}

// Continue the incremental search
function continueSearch(deadline, startTime) {
    // Initialize if needed
    if (!searchState) {
        searchState = initSearchState();
        if (!searchState) {
            // console.log(`No growth targets available [${(performance.now() - startTime).toFixed(1)}ms]`);
            // No positions to check, try again later
            scheduleNextStep(getSearchInterval());
            return;
        }
    }

    const state = searchState;

    // Main search loop with granular yielding
    while (true) {
        // Check if we should yield (every few words)
        if (state.wordsChecked % WORDS_PER_CHECK === 0) {
            if (deadline.timeRemaining() < MIN_TIME_REMAINING && !deadline.didTimeout) {
                // Yield and continue later
                requestIdle((nextDeadline) => continueSearch(nextDeadline, startTime), { timeout: 100 });
                return;
            }
        }

        // Have enough candidates?
        if (state.candidates.length >= 100) {
            finishSearch(startTime);
            return;
        }

        // Need to start a new position?
        if (!state.currentPos) {
            if (state.posIndex >= state.positions.length) {
                // Done with all positions
                finishSearch(startTime);
                return;
            }

            state.currentPos = state.positions[state.posIndex];
            state.posIndex++;

            // Determine which directions to check
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

        // Need to start a new direction?
        if (!state.lineInfo) {
            if (state.dirIndex >= state.directions.length) {
                // Done with this position
                state.currentPos = null;
                continue;
            }

            const direction = state.directions[state.dirIndex];
            state.dirIndex++;

            // Compute line info for this direction
            state.lineInfo = computeLineInfo(state.currentPos.x, state.currentPos.y, direction);
            state.wordLen = Math.max(3, state.lineInfo.lineLength);
            state.offset = 0;
            state.wordIndex = 0;
        }

        const info = state.lineInfo;

        // Skip if existing valid word and wordLen not longer
        if (info.hasExistingValidWord && state.wordLen <= info.existingWordStr.length) {
            state.wordLen++;
            state.offset = 0;
            state.wordIndex = 0;
            if (state.wordLen > MAX_WORD_LENGTH) {
                state.lineInfo = null;
            }
            continue;
        }

        // Get words for current length
        const words = wordsByLength.get(state.wordLen) || [];
        const maxOffset = state.wordLen - info.lineLength;

        // Check if we're done with this word length
        if (state.offset > maxOffset) {
            state.wordLen++;
            state.offset = 0;
            state.wordIndex = 0;
            if (state.wordLen > MAX_WORD_LENGTH) {
                state.lineInfo = null;
            }
            continue;
        }

        // Check if we're done with this offset
        if (state.wordIndex >= words.length) {
            state.offset++;
            state.wordIndex = 0;
            continue;
        }

        // Process current word
        const word = words[state.wordIndex];
        state.wordIndex++;
        state.wordsChecked++;

        // Skip words that have been used too many times
        if (!canUseWord(word)) continue;

        // Check if word matches existing letters
        let matches = true;
        for (const [pos, letter] of info.existingLetters) {
            const wordPos = pos + state.offset;
            if (wordPos >= state.wordLen || word[wordPos] !== letter) {
                matches = false;
                break;
            }
        }

        if (!matches) continue;

        // Calculate grid position
        let wordStartX, wordStartY;
        if (info.isHorizontal) {
            wordStartX = info.lineStart - state.offset;
            wordStartY = state.currentPos.y;
        } else {
            wordStartX = state.currentPos.x;
            wordStartY = info.lineStart - state.offset;
        }

        // Validate placement
        if (!canWordFit(wordStartX, wordStartY, word, info.direction)) continue;
        if (!validateWordPlacement(wordStartX, wordStartY, word, info.direction)) continue;

        // Count remaining letters
        let remainingLetters = 0;
        for (let i = 0; i < word.length; i++) {
            const cx = info.isHorizontal ? wordStartX + i : wordStartX;
            const cy = info.isHorizontal ? wordStartY : wordStartY + i;
            if (!hasLetter(cx, cy)) remainingLetters++;
        }

        if (remainingLetters === 0) continue;

        // Get connection words and calculate semantic score
        const connectionWords = getConnectionWords(wordStartX, wordStartY, info.direction, info.existingLetters);
        const semanticScore = getSemanticScore(word, connectionWords);

        // Add candidate
        state.candidates.push({
            word: word,
            direction: info.direction,
            startX: wordStartX,
            startY: wordStartY,
            remainingLetters: remainingLetters,
            extendsValidWord: info.hasExistingValidWord,
            balanceScore: getBalanceScore(wordStartX, wordStartY, info.direction, word.length),
            semanticScore: semanticScore,
            connectionWords: connectionWords  // Store for debugging
        });

        // Found enough for this position? Move to next
        if (state.candidates.length >= 10 * state.posIndex) {
            state.lineInfo = null;
            state.currentPos = null;
        }
    }
}

// Compute line info for a position and direction
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

// Finish search and select target (don't place letter yet)
function finishSearch(startTime) {
    const state = searchState;
    searchState = null;

    if (!state || state.candidates.length === 0) {
        // console.log(`No growth targets available [${(performance.now() - startTime).toFixed(1)}ms]`);
        // No targets found, try again after search interval
        scheduleNextStep(getSearchInterval());
        return;
    }

    // Count how many candidates have semantic relations
    const semanticCount = state.candidates.filter(c => c.semanticScore > 0).length;

    // Sort candidates - prioritize semantic relatedness!
    state.candidates.sort((a, b) => {
        // First priority: semantic score (related words are better)
        if (a.semanticScore !== b.semanticScore) {
            return b.semanticScore - a.semanticScore;
        }
        // Second: fewer remaining letters (faster to complete)
        if (a.remainingLetters !== b.remainingLetters) {
            return a.remainingLetters - b.remainingLetters;
        }
        // Third: longer words are better
        if (a.word.length !== b.word.length) {
            return b.word.length - a.word.length;
        }
        // Fourth: balance score as tiebreaker
        return b.balanceScore - a.balanceScore;
    });

    // Select target - prefer semantically related words
    let selected;
    const semanticCandidates = state.candidates.filter(c => c.semanticScore > 0);

    if (semanticCandidates.length > 0 && Math.random() < 0.85) {
        // 85% chance to pick from semantically related words
        const topSemantic = semanticCandidates.slice(0, Math.min(5, semanticCandidates.length));
        selected = topSemantic[Math.floor(Math.random() * topSemantic.length)];
    } else if (Math.random() < 0.7) {
        // Otherwise, 70% chance for best remaining candidate
        selected = state.candidates[0];
    } else {
        // 30% chance for random from top 5
        const topN = state.candidates.slice(0, Math.min(5, state.candidates.length));
        selected = topN[Math.floor(Math.random() * topN.length)];
    }

    // Log semantic information
    if (selected.semanticScore > 0) {
        // console.log(`🌿 Semantic match: "${selected.word}" relates to [${selected.connectionWords.join(', ')}]`);
    }
    // console.log(`   (${semanticCount}/${state.candidates.length} candidates were semantically related)`)

    // Build placement queue (outward from connection points)
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

    // console.log(`→ New target: "${selected.word}" ${selected.direction} from (${selected.startX},${selected.startY}), ${placementQueue.length} letters to place [${(performance.now() - startTime).toFixed(1)}ms]`);

    // Schedule first letter placement with letter interval
    scheduleNextStep(LETTER_INTERVAL);
}

// Place the next letter of the current target word
function placeNextLetter() {
    if (!currentTarget) return null;
    if (currentTarget.queueIndex >= currentTarget.placementQueue.length) return null;

    const { word, direction, startX, startY, placementQueue, queueIndex } = currentTarget;
    const isHorizontal = direction === 'horizontal';

    // Get next index to place from queue
    const letterIndex = placementQueue[queueIndex];
    const letter = word[letterIndex];

    const x = isHorizontal ? startX + letterIndex : startX;
    const y = isHorizontal ? startY : startY + letterIndex;

    // Verify position is valid
    if (!isInBounds(x, y) || isBlockedBySeed(x, y)) {
        return { blocked: true, index: letterIndex };
    }

    // Check if already has correct letter (shouldn't happen with our queue, but safety check)
    if (hasLetter(x, y)) {
        if (getLetter(x, y) === letter) {
            // Skip this one, move to next
            currentTarget.queueIndex++;
            return placeNextLetter();
        }
        return { blocked: true, index: letterIndex };
    }

    // Verify this position is adjacent to an existing letter
    if (!isAdjacentToLetter(x, y)) {
        return { blocked: true, index: letterIndex };
    }

    // Place the letter (include x, y for optimized grid lookups)
    const key = `${x},${y}`;
    grid.set(key, { x, y, letter: letter, isSeed: false, blooming: false });

    // Update blooming states for affected cells
    updateBloomingStates(x, y);

    // Animate the cell appearing
    const cell = grid.get(key);
    animateCellAppear(x, y, cell.blooming);

    // Emit to server
    emitTile(x, y, letter, cell.blooming);

    // Sync blooming states for all affected cells
    syncBloomingStates(x, y);

    currentTarget.queueIndex++;
    return { x, y, letter, index: letterIndex };
}

// Calculate balance score
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

// Get positions where we could grow new words
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

// Check if a word can physically fit
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

// Validate word placement
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

// Fisher-Yates shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Keyboard shortcut to toggle growth
// document.addEventListener('keydown', (e) => {
//     if (e.key === 'g' || e.key === 'G') {
//         if (!selectedCell) {
//             const growing = toggleGrowth();
//             console.log(`Auto-growth is now ${growing ? 'ON' : 'OFF'}`);
//         }
//     }
// });

// Build growth word index on load (auto-starts growth when ready)
buildWordIndex();

// console.log('Growth system loaded. Press G to toggle auto-growth.');
