import { getState, updateState, resetLevelState, resetFullGameState, addPathStep, removeLastPathStep, addPathPoint, removeLastPathPoint, setGrid, setLoadedPath, terminateWorker } from './state.js';
import { config, getLevelParams } from './config.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as timer from './timer.js';
import * as persistence from './persistence.js';
import * as levelGenerator from './levelGenerator.js';
// Corrected: Changed back to isValid
import { isValid, isNeighbor, shuffle, getCellCenter, calculateCellSize, isWallBetween } from './utils.js';

// Moved function definition earlier
function updateUiForNewLevel() {
    const { level, points, timeRemaining, isPaused, isMuted } = getState();
    ui.updateLevelDisplay(level);
    ui.updatePointsDisplay(points);
    ui.updateTimerDisplay(timeRemaining);
    ui.updatePauseButton(isPaused);
    ui.updateSoundButton(isMuted);
}

// Moved function definition earlier
function generateWallPositions(pathCoords, numWalls, rows, cols) {
    const walls = new Set();
    const pathSegments = new Set();

    for (let i = 0; i < pathCoords.length - 1; i++) {
        const [r1, c1] = pathCoords[i].split('-').map(Number);
        const [r2, c2] = pathCoords[i + 1].split('-').map(Number);
        let segmentKey;
        if (r1 === r2) {
            segmentKey = `V_${r1}_${Math.min(c1, c2)}`;
        } else {
            segmentKey = `H_${Math.min(r1, r2)}_${c1}`;
        }
        pathSegments.add(segmentKey);
    }

    const possibleWalls = [];
    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
            possibleWalls.push(`H_${r}_${c}`);
        }
    }
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
            possibleWalls.push(`V_${r}_${c}`);
        }
    }

    const allowedWallLocations = possibleWalls.filter(wallKey => !pathSegments.has(wallKey));
    shuffle(allowedWallLocations);
    for (let i = 0; i < Math.min(numWalls, allowedWallLocations.length); i++) {
        walls.add(allowedWallLocations[i]);
    }
    return walls;
}

// Moved function definition earlier
function finishPuzzleGeneration(hamiltonianPath) {
    const { gridRows, gridCols, xCells, calculatedCellSize, wallPositions } = getState();
    const numberPositions = {};
    const pathLength = hamiltonianPath.length;

    if (pathLength !== gridRows * gridCols) {
        console.error("Generated path does not cover all cells.");
        ui.showGenerationErrorText('Generation Error (Path Mismatch)!');
        ui.disableAllInput();
        return;
    }

    numberPositions[hamiltonianPath[0]] = 1;
    if (xCells > 1) {
        numberPositions[hamiltonianPath[pathLength - 1]] = xCells;
    }
    if (xCells > 2) {
        const intermediatePathIndices = Array.from({ length: pathLength - 2 }, (_, i) => i + 1);
        const shuffledIntermediate = shuffle(intermediatePathIndices);
        const chosenIntermediateIndices = shuffledIntermediate.slice(0, xCells - 2).sort((a, b) => a - b);

        for (let i = 0; i < chosenIntermediateIndices.length; i++) {
            const pathIndex = chosenIntermediateIndices[i];
            numberPositions[hamiltonianPath[pathIndex]] = i + 2;
        }
    }

    updateState({ numberPositions });

    const grid = ui.buildGridUI(gridRows, gridCols, calculatedCellSize, numberPositions, wallPositions, getState().inputHandlers);
    setGrid(grid);
    ui.drawNumbersOnSvg(numberPositions, grid, calculatedCellSize);
}


export function startLevel(levelNumber, restoredState = null) {
    resetLevelState();
    terminateWorker();
    ui.clearSvgPath();
    ui.hideTempLine();
    ui.togglePauseOverlay(false);

    let level, points, gridRows, gridCols, xCells, timeLimit, initialTime = null;
    let numberPositions, pathPointsData, calculatedCellSize, isPaused, expectedNextValue;
    let wallPositions = new Set();
    let currentGradientColors = [...getState().currentGradientColors];

    if (restoredState) {
        level = restoredState.level;
        points = restoredState.points;
        gridRows = restoredState.gridRows;
        gridCols = restoredState.gridCols;
        xCells = restoredState.xCells;
        timeLimit = restoredState.timeLimit;
        expectedNextValue = restoredState.expectedNextValue;
        numberPositions = restoredState.numberPositions;
        wallPositions = restoredState.wallPositions;
        currentGradientColors = restoredState.currentGradientColors;
        calculatedCellSize = restoredState.calculatedCellSize;
        const elapsedSeconds = Math.floor((Date.now() - restoredState.saveTimestamp) / 1000);
        initialTime = restoredState.timeRemaining - elapsedSeconds;
        isPaused = restoredState.isPaused ?? false;
        pathPointsData = restoredState.pathPointsData || [];

        updateState({
            level, points, gridRows, gridCols, xCells, timeLimit, calculatedCellSize,
            numberPositions, wallPositions, currentGradientColors,
            pathPoints: pathPointsData, isPaused, expectedNextValue
        });

    } else {
        const params = getLevelParams(levelNumber);
        level = levelNumber;
        points = getState().points;
        gridRows = params.rows;
        gridCols = params.cols;
        xCells = params.xCells;
        timeLimit = params.timeLimit;
        calculatedCellSize = calculateCellSize(gridRows, gridCols, params.baseCellSize);
        numberPositions = {};
        pathPointsData = [];
        isPaused = false;
        expectedNextValue = 1;
        updateState({ gridRows, gridCols });

        const shuffledColors = shuffle([...config.GRADIENT_COLORS]);
        currentGradientColors = shuffledColors.slice(0, 2);
        ui.updatePathGradient(currentGradientColors);

        updateState({
            level, points, gridRows, gridCols, xCells, timeLimit, calculatedCellSize,
            numberPositions, wallPositions: new Set(), currentGradientColors,
            pathPoints: pathPointsData, isPaused, expectedNextValue
        });
    }


    if (restoredState && initialTime !== null && initialTime <= 0) {
        updateState({ timeRemaining: 0 });
        updateUiForNewLevel(); // Moved function definition up
        handleGameOver("Time ran out while away!", true);
        ui.showGenerationErrorText('Game Over!');
        ui.disableAllInput();
        return;
    }

    const timeRemaining = (restoredState && initialTime !== null && initialTime > 0) ? Math.floor(initialTime) : timeLimit;
    updateState({ timeRemaining });

    updateUiForNewLevel();
    ui.updateSvgPath(pathPointsData, calculatedCellSize);
    timer.stopTimer();

    if (restoredState) {
        ui.updatePathGradient(currentGradientColors);

        const grid = ui.buildGridUI(gridRows, gridCols, calculatedCellSize, numberPositions, wallPositions, getState().inputHandlers);
        setGrid(grid);
        setLoadedPath(restoredState.currentPathData, grid);
        ui.restorePathUI(getState().currentPath);
        ui.drawNumbersOnSvg(numberPositions, grid, calculatedCellSize);

        if (isPaused) {
            ui.togglePauseOverlay(true);
            ui.updatePauseButton(true);
        } else {
            timer.startTimer();
        }
        ui.updateButtonStates(getState());

    } else {
        const currentLevelParams = getLevelParams(level);
        levelGenerator.generateLevelAsync(gridRows, gridCols, (hamiltonianPath) => {
            const newWallPositions = generateWallPositions(hamiltonianPath, currentLevelParams.numWalls, gridRows, gridCols);
            updateState({ wallPositions: newWallPositions });
            finishPuzzleGeneration(hamiltonianPath);
            timer.startTimer();
            ui.updateButtonStates(getState());
        });
    }
}

export function addStep(cell, animate = false, puzzleGridElement) {
    const state = getState();
    if (animate && state.isAnimatingClick) return;

    const currentValue = parseInt(cell.dataset.value) || null;
    const previousExpectedValue = state.expectedNextValue;
    const cellKey = `${cell.dataset.row}-${cell.dataset.col}`;
    const targetCoords = getCellCenter(cell, puzzleGridElement);
    const targetPointString = `${targetCoords.x},${targetCoords.y}`;

    cell.classList.add('selected');
    ui.updateSvgNumberSelection(cellKey, true);
    addPathStep(cell, previousExpectedValue);

    if (currentValue === previousExpectedValue) {
        audio.playSound('soundTick');
        updateState({ expectedNextValue: previousExpectedValue + 1 });
    } else {
        if (animate || !state.isDrawing) {
            audio.playSound('soundTick');
        }
    }

    const onAnimationComplete = () => {
        addPathPoint(targetPointString);
        ui.updateSvgPath(getState().pathPoints, state.calculatedCellSize);
        checkWinCondition();
        ui.updateButtonStates(getState());
    };

    if (animate && state.currentPath.length > 1) {
        ui.animateClickPath(
            state.pathPoints[state.pathPoints.length - 1],
            targetCoords,
            state.calculatedCellSize,
            onAnimationComplete
        );
    } else {
        addPathPoint(targetPointString);
        ui.updateSvgPath(state.pathPoints, state.calculatedCellSize);
        checkWinCondition();
    }
    if (!animate) {
        if (state.currentPath.length === 1) {
            ui.updateButtonStates(getState());
        }
    } else if (state.currentPath.length === 1 && animate) {
        ui.updateButtonStates(getState());
    }
}

export function undoLastStep(isDuringDrag) {
    ui.clearClickAnimation();
    if (getState().currentPath.length <= 0) return;

    const removedStep = removeLastPathStep();
    if (!removedStep || !removedStep.cell) return;

    const cellKey = `${removedStep.cell.dataset.row}-${removedStep.cell.dataset.col}`;
    removedStep.cell.classList.remove('selected');
    ui.updateSvgNumberSelection(cellKey, false);

    if (getState().pathPoints.length > 0) {
        removeLastPathPoint();
    }
    ui.updateSvgPath(getState().pathPoints, getState().calculatedCellSize);
    updateState({ expectedNextValue: removedStep.expectedValueBeforeEntering });

    if (!isDuringDrag) {
        if (getState().currentPath.length > 0) {
            audio.playSound('soundTick');
        } else {
            audio.playSound('soundError');
        }
        ui.updateButtonStates(getState());
    }
}

export function clearPath() {
    const state = getState();
    if (state.isGameOver || state.isGenerating || state.isDrawing || state.isPaused || state.currentPath.length === 0) {
        if (state.currentPath.length === 0 && !state.isGameOver && !state.isGenerating && !state.isDrawing && !state.isPaused) {
            ui.showMessage("Nothing to clear.", null, true);
        }
        return;
    }
    ui.clearClickAnimation();
    ui.hideTempLine();

    state.currentPath.forEach(step => {
        if (step.cell) {
            const cellKey = `${step.cell.dataset.row}-${step.cell.dataset.col}`;
            step.cell.classList.remove('selected');
            ui.updateSvgNumberSelection(cellKey, false);
        }
    });

    updateState({ currentPath: [], pathPoints: [], expectedNextValue: 1 });
    ui.clearSvgPath();
    audio.playSound('soundError');
    ui.updateButtonStates(getState());
}


function checkWinCondition() {
    const state = getState();
    if (state.isGameOver || state.isAnimatingClick) return;

    const targetPathLength = (state.gridRows * state.gridCols);
    const pathLength = state.currentPath.length;

    if (pathLength !== targetPathLength) return;

    const correctSequence = state.expectedNextValue > state.xCells;
    const lastCell = state.currentPath[pathLength - 1]?.cell;

    if (!lastCell) {
        handleIncorrectFinish(false, false);
        return;
    }

    const lastVal = parseInt(lastCell.dataset.value);
    const endCorrect = lastVal === state.xCells;

    if (correctSequence && endCorrect) {
        handleWin();
    } else {
        handleIncorrectFinish(correctSequence, endCorrect);
    }
}

function handleWin() {
    updateState({ isGameOver: true });
    timer.stopTimer();
    persistence.clearFullGameState();

    const newPoints = getState().points + (getState().level * 10) + Math.max(0, getState().timeRemaining);
    updateState({ points: newPoints });
    persistence.savePoints(newPoints);
    ui.updatePointsDisplay(newPoints);

    ui.showMessage(`Level ${getState().level} Complete! Points: ${newPoints}`);
    audio.playSound('soundWin');
    ui.disableAllInput();
    ui.updateButtonStates(getState());
}

function handleIncorrectFinish(correctSequence, endCorrect) {
    if (!endCorrect) {
        ui.showMessage(`Path must end on ${getState().xCells}.`, null, true);
        audio.playSound('soundError');
    } else if (!correctSequence) {
        ui.showMessage(`Connect numbers 1 to ${getState().xCells} in order.`, null, true);
        audio.playSound('soundError');
    }
    ui.updateButtonStates(getState());
}

export function handleGameOver(reason, fromLoad = false) {
    if (getState().isGameOver) return;
    updateState({ isGameOver: true, isDrawing: false });
    timer.stopTimer();
    ui.clearClickAnimation();
    ui.hideTempLine();
    persistence.clearFullGameState();
    ui.disableAllInput();
    ui.showMessage(reason + " Game Over!");
    audio.playSound('soundLose');

    if (reason === "Time's up!" && !fromLoad) {
        persistence.saveLevel(1);
        persistence.savePoints(0);
    }
    ui.updateButtonStates(getState());
}

export function handleTimeUp() {
    handleGameOver("Time's up!");
}

export function requestResetLevel() {
    const { isGenerating, isGameOver, isPaused, level, points } = getState();
    if (isGenerating || isGameOver || isPaused) return;

    if (level > 1 && points < config.RESET_PENALTY) {
        ui.showMessage(`Need ${config.RESET_PENALTY} points to reset!`, null, true);
        audio.playSound('soundError');
        return;
    }

    let penaltyMsg = "";
    if (level > 1) {
        const newPoints = Math.max(0, points - config.RESET_PENALTY);
        updateState({ points: newPoints });
        persistence.savePoints(newPoints);
        ui.updatePointsDisplay(newPoints);
        penaltyMsg = `(-${config.RESET_PENALTY} Points)`;
    }

    persistence.clearFullGameState();
    timer.stopTimer();
    terminateWorker();
    startLevel(level);
    ui.showMessage(`Level Reset! ${penaltyMsg}`);
}

export function requestNextLevel() {
    const state = getState();
    if (state.isGenerating || !state.isGameOver || state.isPaused) return;

    const lastCell = state.currentPath?.[state.currentPath.length - 1]?.cell;
    const lastCellValue = lastCell ? parseInt(lastCell.dataset.value) : NaN;
    const targetPathLength = (state.gridRows * state.gridCols);

    if (lastCellValue === state.xCells && state.currentPath.length === targetPathLength && state.expectedNextValue > state.xCells) {
        persistence.clearFullGameState();
        const nextLevel = state.level + 1;
        updateState({ level: nextLevel });
        persistence.saveLevel(nextLevel);
        startLevel(nextLevel);
    } else {
        ui.showMessage("Win condition error. Cannot proceed.", null, true);
        updateState({ isGameOver: false });
        ui.updateButtonStates(getState());
    }
}

export function requestRestartGame() {
    ui.showRestartModal();
}

export function performRestart() {
    persistence.clearFullGameState();
    terminateWorker();
    timer.stopTimer();
    resetFullGameState();
    persistence.savePoints(0);
    persistence.saveLevel(1);
    startLevel(1);
    ui.showMessage("Game Restarted!");
}


export function togglePause() {
    const { isGameOver, isGenerating, isPaused } = getState();
    if (isGameOver || isGenerating) return;

    if (isPaused) {
        continueGame();
    } else {
        pauseGame();
    }
}

function pauseGame(saveState = true) {
    const { isPaused, isGameOver, isGenerating } = getState();
    if (isPaused || isGameOver || isGenerating) return;

    updateState({ isDrawing: false, isPaused: true });
    ui.clearClickAnimation();
    ui.hideTempLine();
    timer.stopTimer();
    ui.togglePauseOverlay(true);
    ui.showMessage('Game Paused');

    if (saveState) {
        persistence.saveFullGameState();
    }
    ui.updatePauseButton(true);
    ui.updateButtonStates(getState());
}

function continueGame() {
    const { isPaused, isGameOver, isGenerating } = getState();
    if (!isPaused || isGameOver || isGenerating) return;

    updateState({ isPaused: false });
    ui.togglePauseOverlay(false);
    ui.showMessage('Game Continued');
    timer.startTimer();
    ui.updatePauseButton(false);
    ui.updateButtonStates(getState());
}

export function autoPause() {
    const { isGameOver, isGenerating, isPaused } = getState();
    if (document.hidden && !isGameOver && !isGenerating && !isPaused) {
        pauseGame();
    }
}