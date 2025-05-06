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
    const { isGameOver, isGenerating, isPaused, isAnimatingClick, currentPath, wallPositions } = getState();
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

    stopDrawing();

    if (currentPath.length > 1 && cell === currentPath[currentPath.length - 2].cell) {
        logic.undoLastStep(false);
        return;
    }

    if (!isPathEmpty && utils.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
        const r1 = parseInt(lastCell.dataset.row);
        const c1 = parseInt(lastCell.dataset.col);
        const r2 = parseInt(cell.dataset.row);
        const c2 = parseInt(cell.dataset.col);
        if (utils.isWallBetween(r1, c1, r2, c2, wallPositions)) {
            audio.playSound('soundError');
            ui.showMessage("Cannot cross a wall.", null, true);
            return;
        }
        handleAdjacentClick(cell, value);
        return;
    }

    if (!isPathEmpty && !utils.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
        ui.showMessage("Must select an adjacent cell.", null, true);
        audio.playSound('soundError');
        return;
    }

    if (!isPathEmpty && cell.classList.contains('selected') && cell !== lastCell) {
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
    if (getState().currentPath.length === 0) {
        logic.addStep(cell, false, dependencies.elements.puzzleGridElement);
    }
    ui.updateTempLineStart(cell);
    const coords = utils.getRelativeCoords(e, dependencies.elements.puzzleGridElement);
    ui.updateTempLineEnd(coords);
}

function stopDrawing() {
    updateState({ isDrawing: false });
    ui.hideTempLine();
}

function handleAdjacentClick(cell, value) {
    const { expectedNextValue } = getState();
    const isValidMove = (value === expectedNextValue) || (value === null);
    if (isValidMove) {
        logic.addStep(cell, true, dependencies.elements.puzzleGridElement);
    } else {
        ui.showMessage(`Path must follow sequence: ${expectedNextValue} expected.`, null, true);
        audio.playSound('soundError');
    }
}

export function handleMouseMove(e) {
    const { isDrawing, isGameOver, isGenerating, isPaused, isAnimatingClick, currentPath, currentPuzzle, calculatedCellSize, wallPositions } = getState();
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
        const r1 = parseInt(lastCell.dataset.row);
        const c1 = parseInt(lastCell.dataset.col);
        const r2 = parseInt(currentCell.dataset.row);
        const c2 = parseInt(currentCell.dataset.col);
        if (utils.isWallBetween(r1, c1, r2, c2, wallPositions)) {
            return;
        }
        logic.undoLastStep(true);
        if (getState().currentPath.length > 0) {
            const newLastCell = getState().currentPath[getState().currentPath.length - 1].cell;
            ui.updateTempLineStart(newLastCell);
            ui.updateTempLineEnd(coords);
        }
    } else if (!currentCell.classList.contains('selected') && utils.isNeighbor(lastCell, currentCell)) {
        const r1 = parseInt(lastCell.dataset.row);
        const c1 = parseInt(lastCell.dataset.col);
        const r2 = parseInt(currentCell.dataset.row);
        const c2 = parseInt(currentCell.dataset.col);
        if (utils.isWallBetween(r1, c1, r2, c2, wallPositions)) {
            return;
        }

        const currentValue = parseInt(currentCell.dataset.value) || null;
        const { expectedNextValue } = getState();
        const isValidMove = (currentValue === expectedNextValue) || (currentValue === null);

        if (isValidMove) {
            logic.addStep(currentCell, false, dependencies.elements.puzzleGridElement);
            ui.updateTempLineStart(currentCell);
            ui.updateTempLineEnd(coords);
        }
    }
}

function handleMouseUp() {
    const { isDrawing, isGameOver, isPaused, isAnimatingClick, currentPath, gridRows, gridCols } = getState();
    if (isDrawing) {
        stopDrawing();
        const targetPathLength = (gridRows * gridCols);
        if (!isGameOver && !isPaused && !isAnimatingClick && currentPath.length === targetPathLength) {
            logic.checkWinCondition();
        }
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
    if (isDrawing) {
        e.preventDefault();
    }
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const simulatedEvent = { target: targetElement, clientX: touch.clientX, clientY: touch.clientY };
    handleMouseMove(simulatedEvent);
}

function handleTouchEnd() {
    if (!isTouching) return;
    isTouching = false;
    handleMouseUp();
}