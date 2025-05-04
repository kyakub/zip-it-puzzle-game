import { getState, updateState } from './state.js';
import * as ui from './ui.js';
import * as logic from './logic.js';
import * as audio from './audio.js';
import * as utils from './utils.js';

let dependencies = {};
let isTouching = false;

export function initializeInput(deps) {
    dependencies = deps;
    addEventListeners();
    updateState({
        inputHandlers: {
            handleMouseMove: handleMouseMove.bind(null),
            handleMouseDown: handleMouseDown.bind(null),
            handleTouchStart: handleTouchStart.bind(null),
        }
    });
}

function addEventListeners() {
    const {
        undoButton, clearPathButton, resetLevelButton, restartGameButton,
        pauseButton, nextLevelButton, soundToggleButton,
        modalConfirmRestart, modalCancelRestart, restartModalOverlay,
        puzzleGridElement
    } = dependencies.elements;

    undoButton?.addEventListener('click', handleUndo);
    clearPathButton?.addEventListener('click', handleClearPath);
    resetLevelButton?.addEventListener('click', handleResetLevel);
    restartGameButton?.addEventListener('click', handleRestartGame);
    pauseButton?.addEventListener('click', handlePauseToggle);
    nextLevelButton?.addEventListener('click', handleNextLevel);
    soundToggleButton?.addEventListener('click', handleSoundToggle);
    modalConfirmRestart?.addEventListener('click', handleModalConfirm);
    modalCancelRestart?.addEventListener('click', handleModalCancel);
    restartModalOverlay?.addEventListener('click', handleOverlayClick);

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('dragstart', (e) => e.preventDefault());


    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);
}

function handleUndo() {
    const { isGameOver, isGenerating, isDrawing, isPaused } = getState();
    if (isGameOver || isGenerating || isDrawing || isPaused) return;
    ui.clearClickAnimation();
    ui.hideTempLine();

    if (getState().currentPath.length > 0) {
        logic.undoLastStep(false);
    } else {
        ui.showMessage("Cannot undo further.", null, true);
        audio.playSound('soundError');
    }
}

function handleClearPath() {
    logic.clearPath();
}

function handleResetLevel() {
    logic.requestResetLevel();
}

function handleRestartGame() {
    logic.requestRestartGame();
}

function handlePauseToggle() {
    logic.togglePause();
}

function handleNextLevel() {
    logic.requestNextLevel();
}

function handleSoundToggle() {
    audio.toggleMute(ui.updateSoundButton);
}

function handleModalConfirm() {
    ui.hideRestartModal();
    logic.performRestart();
}

function handleModalCancel() {
    ui.hideRestartModal();
}

function handleOverlayClick(event) {
    if (event.target === dependencies.elements.restartModalOverlay) {
        ui.hideRestartModal();
    }
}

export function handleMouseDown(e) {
    const { isGameOver, isGenerating, isPaused, isAnimatingClick, currentPath } = getState();
    if (isGameOver || isGenerating || isPaused || isAnimatingClick) return;

    const cell = e.target.closest('.cell');
    if (!cell) return;

    const value = parseInt(cell.dataset.value) || null;
    const isPathEmpty = currentPath.length === 0;
    const lastPathStep = isPathEmpty ? null : currentPath[currentPath.length - 1];
    const lastCell = lastPathStep?.cell;

    if (isPathEmpty && value === 1) {
        startDrawing(cell, e);
        return;
    }

    if (!isPathEmpty && cell === lastCell) {
        startDrawing(cell, e);
        return;
    }

    stopDrawing(); // Stop drawing if clicking elsewhere

    if (currentPath.length > 1 && cell === currentPath[currentPath.length - 2].cell) {
        logic.undoLastStep(false); // This handles button update
        return;
    }

    if (!isPathEmpty && utils.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
        handleAdjacentClick(cell, value); // This handles button update via addStep(true)
        return;
    }

    if (!isPathEmpty && !utils.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
        ui.showMessage("Must select an adjacent cell.", null, true);
        audio.playSound('soundError');
        return;
    }

    if (!isPathEmpty && cell.classList.contains('selected') && cell !== lastCell) {
        // Clicking an already selected cell (not last or second-last) - do nothing
        return;
    }

    if (isPathEmpty && value !== 1) {
        ui.showMessage("Path must start on number 1!", null, true);
        audio.playSound('soundError');
        return;
    }
}

function startDrawing(cell, e) {
    updateState({ isDrawing: true });
    // logic.addStep handles button update for the first step if needed
    if (getState().currentPath.length === 0) {
        logic.addStep(cell, false, dependencies.elements.puzzleGridElement);
    }
    ui.updateTempLineStart(cell);
    const coords = utils.getRelativeCoords(e, dependencies.elements.puzzleGridElement);
    ui.updateTempLineEnd(coords);
    // Don't update buttons during start draw itself, wait for mouseup
}

function stopDrawing() {
    updateState({ isDrawing: false });
    ui.hideTempLine();
}

function handleAdjacentClick(cell, value) {
    const { expectedNextValue } = getState();
    const isValidMove = (value === expectedNextValue) || (value === null);
    if (isValidMove) {
        // addStep(true,...) handles button state update after animation
        logic.addStep(cell, true, dependencies.elements.puzzleGridElement);
    } else {
        ui.showMessage(`Path must follow sequence: ${expectedNextValue} expected.`, null, true);
        audio.playSound('soundError');
    }
}

export function handleMouseMove(e) {
    const { isDrawing, isGameOver, isGenerating, isPaused, isAnimatingClick, currentPath, currentPuzzle, calculatedCellSize } = getState();
    if (!isDrawing || isGameOver || isGenerating || isPaused || isAnimatingClick) return;

    const coords = utils.getRelativeCoords(e, dependencies.elements.puzzleGridElement);
    ui.updateTempLineEnd(coords);

    const col = Math.floor(coords.x / calculatedCellSize);
    const row = Math.floor(coords.y / calculatedCellSize);

    if (!utils.isValid(row, col)) return;
    const currentCell = currentPuzzle?.[row]?.[col];
    if (!currentCell) return;

    const lastPathStep = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
    const lastCell = lastPathStep?.cell;

    if (!lastCell || currentCell === lastCell) return;

    if (currentPath.length > 1 && currentCell === currentPath[currentPath.length - 2].cell) {
        // undoLastStep(true) does NOT update buttons
        logic.undoLastStep(true);
        if (getState().currentPath.length > 0) {
            const newLastCell = getState().currentPath[getState().currentPath.length - 1].cell;
            ui.updateTempLineStart(newLastCell);
            ui.updateTempLineEnd(coords); // Re-align end point after undo
        }
    } else if (!currentCell.classList.contains('selected') && utils.isNeighbor(lastCell, currentCell)) {
        const currentValue = parseInt(currentCell.dataset.value) || null;
        const { expectedNextValue } = getState();
        const isValidMove = (currentValue === expectedNextValue) || (currentValue === null);

        if (isValidMove) {
            // addStep(false,...) does NOT update buttons
            logic.addStep(currentCell, false, dependencies.elements.puzzleGridElement);
            ui.updateTempLineStart(currentCell);
            ui.updateTempLineEnd(coords); // Re-align end point after adding
        }
    }
}

function handleMouseUp() {
    const { isDrawing, isGameOver, isPaused, isAnimatingClick, currentPath, gridRows, gridCols } = getState();
    if (isDrawing) {
        stopDrawing();
        // Check win AFTER stopping draw, only if not paused/animating
        if (!isGameOver && !isPaused && !isAnimatingClick && currentPath.length === (gridRows * gridCols)) {
            logic.checkWinCondition(); // This updates buttons on win/loss
        }
        // Always update buttons after drawing stops if not game over
        if (!isGameOver) {
            ui.updateButtonStates(getState());
        }
    }
}


export function handleTouchStart(e) {
    const { isGameOver, isGenerating, isPaused, isAnimatingClick } = getState();
    if (isGameOver || isGenerating || isPaused || isAnimatingClick) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = targetElement?.closest('.cell');
    if (cell) {
        isTouching = true;
        const simulatedEvent = { target: cell, clientX: touch.clientX, clientY: touch.clientY };
        handleMouseDown(simulatedEvent);
    } else {
        isTouching = false;
    }
}

function handleTouchMove(e) {
    const { isGenerating, isPaused, isAnimatingClick, isDrawing } = getState();
    if (!isTouching || isGenerating || isPaused || isAnimatingClick) return;
    // Prevent page scroll only when actively drawing a path
    if (isDrawing) {
        e.preventDefault();
    }
    const touch = e.touches[0];
    // Use document.elementFromPoint to find the element under the touch
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    // Create a simulated mouse event to pass to handleMouseMove
    // Ensure target is correctly passed if needed by handleMouseMove logic (currently uses coordinates mostly)
    const simulatedEvent = { target: targetElement, clientX: touch.clientX, clientY: touch.clientY };
    handleMouseMove(simulatedEvent);
}

function handleTouchEnd() {
    if (!isTouching) return;
    isTouching = false;
    handleMouseUp();
}