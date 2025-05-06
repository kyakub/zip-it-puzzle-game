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
    const { isGameOver, isGenerating, isPaused, isAnimatingClick, currentPath, wallPositions, currentPuzzle, expectedNextValue: initialExpectedNextValue } = getState();
    if (isGameOver || isGenerating || isPaused || isAnimatingClick) return;

    const clickedCell = e.target.closest('.cell');
    if (!clickedCell) return;

    const clickedCellValue = parseInt(clickedCell.dataset.value) || null;
    const isPathEmpty = currentPath.length === 0;

    const lastPathStep = isPathEmpty ? null : currentPath[currentPath.length - 1];
    const lastCell = lastPathStep?.cell;

    if (isPathEmpty && clickedCellValue === 1) {
        startDrawing(clickedCell, e);
        return;
    }

    if (!isPathEmpty && clickedCell === lastCell) {
        startDrawing(clickedCell, e);
        return;
    }

    stopDrawing();

    if (!isPathEmpty) {
        const r_last = parseInt(lastCell.dataset.row);
        const c_last = parseInt(lastCell.dataset.col);
        const r_click = parseInt(clickedCell.dataset.row);
        const c_click = parseInt(clickedCell.dataset.col);

        const isHorizontal = r_click === r_last && c_click !== c_last;
        const isVertical = c_click === c_last && r_click !== r_last;

        if (isHorizontal || isVertical) {
            if (!clickedCell.classList.contains('selected')) {
                const cellsInLine = [];
                let pathIsClear = true;
                let currentIterCell = lastCell;
                let tempExpectedNextValForLine = initialExpectedNextValue;

                if (isHorizontal) {
                    const step = c_click > c_last ? 1 : -1;
                    for (let c = c_last + step; ; c += step) {
                        const nextR = r_click;
                        const nextC = c;

                        if (utils.isWallBetween(parseInt(currentIterCell.dataset.row), parseInt(currentIterCell.dataset.col), nextR, nextC, wallPositions)) {
                            pathIsClear = false; break;
                        }
                        const interCell = currentPuzzle[nextR]?.[nextC];
                        if (!interCell || interCell.classList.contains('selected')) {
                            pathIsClear = false; break;
                        }

                        const interCellValue = parseInt(interCell.dataset.value) || null;
                        if (interCellValue !== null) {
                            if (interCellValue !== tempExpectedNextValForLine) {
                                pathIsClear = false; break;
                            }
                            tempExpectedNextValForLine++;
                        }
                        cellsInLine.push(interCell);
                        currentIterCell = interCell;
                        if (c === c_click) break;
                        if ((step > 0 && c > c_click) || (step < 0 && c < c_click)) { pathIsClear = false; break; }
                    }
                } else {
                    const step = r_click > r_last ? 1 : -1;
                    for (let r = r_last + step; ; r += step) {
                        const nextR = r;
                        const nextC = c_click;

                        if (utils.isWallBetween(parseInt(currentIterCell.dataset.row), parseInt(currentIterCell.dataset.col), nextR, nextC, wallPositions)) {
                            pathIsClear = false; break;
                        }
                        const interCell = currentPuzzle[nextR]?.[nextC];
                        if (!interCell || interCell.classList.contains('selected')) {
                            pathIsClear = false; break;
                        }
                        const interCellValue = parseInt(interCell.dataset.value) || null;
                        if (interCellValue !== null) {
                            if (interCellValue !== tempExpectedNextValForLine) {
                                pathIsClear = false; break;
                            }
                            tempExpectedNextValForLine++;
                        }
                        cellsInLine.push(interCell);
                        currentIterCell = interCell;
                        if (r === r_click) break;
                        if ((step > 0 && r > r_click) || (step < 0 && r < r_click)) { pathIsClear = false; break; }
                    }
                }

                if (pathIsClear && cellsInLine.length > 0 && cellsInLine[cellsInLine.length - 1] === clickedCell) {
                    logic.addStepsInLine(cellsInLine, dependencies.elements.puzzleGridElement);
                    return;
                } else if (!pathIsClear && cellsInLine.length > 0) {
                    const lastAttemptedCell = cellsInLine[cellsInLine.length - 1];
                    const lastAttemptedCellValue = parseInt(lastAttemptedCell.dataset.value) || null;
                    if (lastAttemptedCellValue !== null && lastAttemptedCellValue !== tempExpectedNextValForLine) {
                        audio.playSound('soundError');
                        ui.showMessage(`Line blocked: Next number must be ${tempExpectedNextValForLine}.`, null, true);
                        return;
                    }
                }
            } else if (clickedCell.classList.contains('selected')) {
                const clickedCellIndexInPath = currentPath.findIndex(step => step.cell === clickedCell);
                if (clickedCellIndexInPath !== -1 && clickedCellIndexInPath < currentPath.length - 1) {
                    let isStraightRetractPath = true;
                    for (let i = clickedCellIndexInPath; i < currentPath.length - 2; i++) {
                        const p1 = currentPath[i].cell;
                        const p2 = currentPath[i + 1].cell;
                        const p3 = currentPath[i + 2].cell;
                        const r1_path = parseInt(p1.dataset.row); const c1_path = parseInt(p1.dataset.col);
                        const r2_path = parseInt(p2.dataset.row); const c2_path = parseInt(p2.dataset.col);
                        const r3_path = parseInt(p3.dataset.row); const c3_path = parseInt(p3.dataset.col);
                        if ((r1_path - r2_path) * (c2_path - c3_path) !== (c1_path - c2_path) * (r2_path - r3_path)) {
                            isStraightRetractPath = false;
                            break;
                        }
                    }
                    if (isStraightRetractPath) {
                        logic.undoStepsInLine(clickedCell);
                        return;
                    }
                }
            }
        }
    }

    if (currentPath.length > 1 && clickedCell === currentPath[currentPath.length - 2].cell) {
        logic.undoLastStep(false);
        return;
    }

    if (!isPathEmpty && utils.isNeighbor(lastCell, clickedCell) && !clickedCell.classList.contains('selected')) {
        const r1_adj = parseInt(lastCell.dataset.row);
        const c1_adj = parseInt(lastCell.dataset.col);
        const r2_adj = parseInt(clickedCell.dataset.row);
        const c2_adj = parseInt(clickedCell.dataset.col);
        if (utils.isWallBetween(r1_adj, c1_adj, r2_adj, c2_adj, wallPositions)) {
            audio.playSound('soundError');
            ui.showMessage("Cannot cross a wall.", null, true);
            return;
        }
        handleAdjacentClick(clickedCell, clickedCellValue);
        return;
    }

    if (!isPathEmpty && !utils.isNeighbor(lastCell, clickedCell) && !clickedCell.classList.contains('selected')) {
        ui.showMessage("Must select an adjacent cell.", null, true);
        audio.playSound('soundError');
        return;
    }

    if (isPathEmpty && clickedCellValue !== 1) {
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
        const r1_drag = parseInt(lastCell.dataset.row);
        const c1_drag = parseInt(lastCell.dataset.col);
        const r2_drag = parseInt(currentCell.dataset.row);
        const c2_drag = parseInt(currentCell.dataset.col);
        if (utils.isWallBetween(r1_drag, c1_drag, r2_drag, c2_drag, wallPositions)) {
            return;
        }
        logic.undoLastStep(true);
        if (getState().currentPath.length > 0) {
            const newLastCell = getState().currentPath[getState().currentPath.length - 1].cell;
            ui.updateTempLineStart(newLastCell);
            ui.updateTempLineEnd(coords);
        }
    } else if (!currentCell.classList.contains('selected') && utils.isNeighbor(lastCell, currentCell)) {
        const r1_drag = parseInt(lastCell.dataset.row);
        const c1_drag = parseInt(lastCell.dataset.col);
        const r2_drag = parseInt(currentCell.dataset.row);
        const c2_drag = parseInt(currentCell.dataset.col);
        if (utils.isWallBetween(r1_drag, c1_drag, r2_drag, c2_drag, wallPositions)) {
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