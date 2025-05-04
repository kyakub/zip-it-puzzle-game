import { getState, updateState, resetLevelState, resetFullGameState, addPathStep, removeLastPathStep, addPathPoint, removeLastPathPoint, setGrid, setLoadedPath, terminateWorker } from './state.js';
import { config, getLevelParams } from './config.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as timer from './timer.js';
import * as persistence from './persistence.js';
import * as levelGenerator from './levelGenerator.js';
import { isValid, isNeighbor, shuffle, getCellCenter, calculateCellSize } from './utils.js';


export function startLevel(levelNumber, restoredState = null) {
    resetLevelState();
    terminateWorker();
    ui.clearSvgPath();
    ui.hideTempLine();
    ui.togglePauseOverlay(false); // Ensure pause overlay is hidden when starting any level initially

    let level, points, gridRows, gridCols, xCells, timeLimit, initialTime = null, numberPositions, pathPointsData, calculatedCellSize, isPaused, expectedNextValue;

    if (restoredState) {
        level = restoredState.level;
        points = restoredState.points;
        gridRows = restoredState.gridRows;
        gridCols = restoredState.gridCols;
        xCells = restoredState.xCells;
        timeLimit = restoredState.timeLimit;
        expectedNextValue = restoredState.expectedNextValue;
        numberPositions = restoredState.numberPositions;
        calculatedCellSize = restoredState.calculatedCellSize;
        const elapsedSeconds = Math.floor((Date.now() - restoredState.saveTimestamp) / 1000);
        initialTime = restoredState.timeRemaining - elapsedSeconds;
        isPaused = restoredState.isPaused ?? false; // Keep track if loaded state was paused
        pathPointsData = restoredState.pathPointsData || [];

        updateState({ // Update state first
            level, points, gridRows, gridCols, xCells, timeLimit, calculatedCellSize, numberPositions, pathPoints: pathPointsData, isPaused, expectedNextValue
        });

    } else {
        const params = getLevelParams(levelNumber);
        level = levelNumber;
        points = getState().points; // Get potentially reset points
        gridRows = params.rows;
        gridCols = params.cols;
        xCells = params.xCells;
        timeLimit = params.timeLimit;
        calculatedCellSize = calculateCellSize(gridRows, gridCols, params.baseCellSize);
        numberPositions = {};
        pathPointsData = [];
        isPaused = false; // New level always starts unpaused
        expectedNextValue = 1;

        updateState({ // Update state for new level
            level, points, gridRows, gridCols, xCells, timeLimit, calculatedCellSize, numberPositions, pathPoints: pathPointsData, isPaused, expectedNextValue
        });
    }


    if (restoredState && initialTime !== null && initialTime <= 0) {
        updateState({ timeRemaining: 0 });
        updateUiForNewLevel();
        handleGameOver("Time ran out while away!", true);
        ui.showGenerationErrorText('Game Over!');
        ui.disableAllInput();
        return;
    }

    const timeRemaining = (restoredState && initialTime !== null && initialTime > 0) ? Math.floor(initialTime) : timeLimit;
    updateState({ timeRemaining });

    updateUiForNewLevel(); // Update displays (level, points, timer etc.)
    ui.updateSvgPath(pathPointsData, calculatedCellSize);
    timer.stopTimer(); // Ensure timer is stopped before potentially starting


    if (restoredState) {
        const grid = ui.buildGridUI(gridRows, gridCols, calculatedCellSize, numberPositions, getState().inputHandlers);
        setGrid(grid);
        setLoadedPath(restoredState.currentPathData, grid);
        ui.restorePathUI(getState().currentPath);
        ui.drawNumbersOnSvg(numberPositions, grid, calculatedCellSize);

        if (isPaused) {
            // State is already set to paused, just update UI
            ui.togglePauseOverlay(true);
            ui.updatePauseButton(true);
        } else {
            timer.startTimer(); // Start timer only if not paused on load
        }
        ui.updateButtonStates(getState()); // Update buttons based on loaded state

    } else {
        // This path is taken by performRestart
        levelGenerator.generateLevelAsync(gridRows, gridCols, (hamiltonianPath) => {
            finishPuzzleGeneration(hamiltonianPath);
            timer.startTimer(); // Start timer for the new level 1
            ui.updateButtonStates(getState()); // Update buttons for playing state
        });
    }
}

function updateUiForNewLevel() {
    const { level, points, timeRemaining, isPaused, isMuted } = getState();
    ui.updateLevelDisplay(level);
    ui.updatePointsDisplay(points);
    ui.updateTimerDisplay(timeRemaining);
    ui.updatePauseButton(isPaused); // Reflects the actual state (false for new levels)
    ui.updateSoundButton(isMuted);
}

function finishPuzzleGeneration(hamiltonianPath) {
    const { gridRows, gridCols, xCells, calculatedCellSize } = getState();
    const numberPositions = {};
    const totalCells = gridRows * gridCols;

    numberPositions[hamiltonianPath[0]] = 1;
    if (xCells > 1) {
        numberPositions[hamiltonianPath[totalCells - 1]] = xCells;
    }
    if (xCells > 2) {
        const intermediateIndices = Array.from({ length: totalCells - 2 }, (_, i) => i + 1);
        const shuffledIntermediate = shuffle(intermediateIndices);
        const chosenIntermediateIndices = shuffledIntermediate.slice(0, xCells - 2).sort((a, b) => a - b);
        for (let i = 0; i < chosenIntermediateIndices.length; i++) {
            numberPositions[hamiltonianPath[chosenIntermediateIndices[i]]] = i + 2;
        }
    }
    updateState({ numberPositions });
    const grid = ui.buildGridUI(gridRows, gridCols, calculatedCellSize, numberPositions, getState().inputHandlers);
    setGrid(grid);
    ui.drawNumbersOnSvg(numberPositions, grid, calculatedCellSize);
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
        ui.updateButtonStates(getState()); // Update buttons AFTER animation
    };

    if (animate && state.currentPath.length > 1) {
        ui.animateClickPath(
            state.pathPoints[state.pathPoints.length - 1],
            targetCoords,
            state.calculatedCellSize,
            onAnimationComplete
        );
        // Don't update buttons immediately during animation
    } else {
        addPathPoint(targetPointString);
        ui.updateSvgPath(state.pathPoints, state.calculatedCellSize);
        if (state.currentPath.length === (state.gridRows * state.gridCols)) {
            checkWinCondition(); // This might update buttons via win/loss handlers
        }
        // Don't update buttons here during drag (animate is false)
    }
    // Only update buttons if it wasn't an animation (which updates on complete)
    // or a drag step (which waits for mouseup)
    if (!animate) {
        // This case now only covers the very first step (value 1)
        if (state.currentPath.length === 1) {
            ui.updateButtonStates(getState());
        }
        // Drag steps (animate=false, length > 1) don't update here
    } else if (state.currentPath.length === 1 && animate) {
        // Handle click on first cell (length 1, animate true)
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
        ui.updateButtonStates(getState()); // Update buttons only on non-drag undo
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
        const cellKey = `${step.cell.dataset.row}-${step.cell.dataset.col}`;
        step.cell.classList.remove('selected');
        ui.updateSvgNumberSelection(cellKey, false);
    });

    updateState({ currentPath: [], pathPoints: [], expectedNextValue: 1 });
    ui.clearSvgPath();
    audio.playSound('soundError');
    ui.updateButtonStates(getState());
}


function checkWinCondition() {
    const state = getState();
    if (state.isGameOver || state.isAnimatingClick) return;

    const totalCells = state.gridRows * state.gridCols;
    const pathLength = state.currentPath.length;

    if (pathLength !== totalCells) return;

    const correctSequence = state.expectedNextValue > state.xCells;
    const lastCell = state.currentPath[pathLength - 1]?.cell;
    const lastVal = lastCell ? parseInt(lastCell.dataset.value) : NaN;
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
    ui.disableAllInput(); // Disables buttons appropriately
    ui.updateButtonStates(getState()); // Updates Next Level visibility
}

function handleIncorrectFinish(correctSequence, endCorrect) {
    if (!endCorrect) {
        ui.showMessage(`Path must end on ${getState().xCells}.`, null, true);
        audio.playSound('soundError');
    } else if (!correctSequence) {
        ui.showMessage(`Connect numbers 1 to ${getState().xCells} in order.`, null, true);
        audio.playSound('soundError');
    }
    ui.updateButtonStates(getState()); // Ensure buttons are re-enabled if needed
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
    ui.updateButtonStates(getState()); // Ensure buttons reflect game over
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
    startLevel(level); // Restart current level
    ui.showMessage(`Level Reset! ${penaltyMsg}`);
}

export function requestNextLevel() {
    const state = getState();
    if (state.isGenerating || !state.isGameOver || state.isPaused) return;

    const lastCell = state.currentPath?.[state.currentPath.length - 1]?.cell;
    const lastCellValue = lastCell ? parseInt(lastCell.dataset.value) : NaN;

    // Check win condition again just to be safe before proceeding
    if (lastCellValue === state.xCells && state.currentPath.length === state.gridRows * state.gridCols && state.expectedNextValue > state.xCells) {
        persistence.clearFullGameState();
        const nextLevel = state.level + 1;
        updateState({ level: nextLevel });
        persistence.saveLevel(nextLevel);
        startLevel(nextLevel); // Start next level
    } else {
        ui.showMessage("Win condition error. Cannot proceed.", null, true);
        // Ensure buttons reflect non-win state if somehow called incorrectly
        updateState({ isGameOver: false }); // Revert potential premature game over?
        ui.updateButtonStates(getState());
    }
}

export function requestRestartGame() {
    // Don't pause here, just show the modal
    ui.showRestartModal();
}

export function performRestart() {
    persistence.clearFullGameState();
    terminateWorker();
    timer.stopTimer();
    const currentPoints = getState().points; // Preserve points temporarily if needed, but rules say reset
    resetFullGameState(); // Resets level to 1, points to 0, isPaused to false, etc.
    persistence.savePoints(0); // Explicitly save 0 points
    persistence.saveLevel(1); // Explicitly save level 1
    startLevel(1); // Start level 1 (will set state.isPaused to false and start timer)
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
    ui.togglePauseOverlay(true); // Show overlay
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
    ui.togglePauseOverlay(false); // Hide overlay
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