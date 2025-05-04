import { config } from './config.js';
import { getState, updateState, setSvgElements } from './state.js';
import { getCellCenter } from './utils.js';

let elements = {};
let messageTimeouts = {};

export function initializeUI(domElements) {
    elements = domElements;
    ensureSvgElements();
}

function ensureSvgElements() {
    if (!getState().gamePathPolyline && elements.pathSvgElement) {
        const polyline = document.createElementNS(config.SVG_NS, 'polyline');
        polyline.setAttribute('id', 'gamePath');
        elements.pathSvgElement.appendChild(polyline);
        updateState({ gamePathPolyline: polyline });
    }
    if (!getState().tempLineElement && elements.pathSvgElement) {
        const line = document.createElementNS(config.SVG_NS, 'line');
        line.setAttribute('id', 'tempPathSegment');
        elements.pathSvgElement.appendChild(line);
        updateState({ tempLineElement: line });
    }
    clearSvgPath();
}

export function updateLevelDisplay(level) {
    if (elements.levelDisplayElement) elements.levelDisplayElement.textContent = `Level: ${level}`;
}

export function updatePointsDisplay(points) {
    if (elements.pointsDisplayElement) elements.pointsDisplayElement.textContent = `Points: ${points}`;
}

export function updateTimerDisplay(timeRemaining) {
    const minutes = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
    const seconds = String(timeRemaining % 60).padStart(2, '0');
    if (elements.timerElement) elements.timerElement.textContent = `Time: ${minutes}:${seconds}`;
}

export function updateSoundButton(isMuted) {
    if (elements.soundToggleButton) {
        elements.soundToggleButton.textContent = isMuted ? "Sound: Off" : "Sound: On";
        elements.soundToggleButton.title = isMuted ? "Unmute Sounds" : "Mute Sounds";
    }
}

export function updatePauseButton(isPaused) {
    if (elements.pauseButton) {
        elements.pauseButton.textContent = isPaused ? "Continue" : "Pause";
    }
}

export function buildGridUI(gridRows, gridCols, cellSize, numberPositions, inputHandlers) {
    elements.puzzleGridElement.innerHTML = '';
    elements.numbersSvgElement.innerHTML = '';
    setSvgElements({});

    elements.puzzleGridElement.style.gridTemplateRows = `repeat(${gridRows}, ${cellSize}px)`;
    elements.puzzleGridElement.style.gridTemplateColumns = `repeat(${gridCols}, ${cellSize}px)`;
    elements.puzzleGridElement.style.setProperty('--cell-size', `${cellSize}px`);

    const tempGrid = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            const cell = document.createElement('div');
            const cellKey = `${r}-${c}`;
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.dataset.value = numberPositions[cellKey] || '';
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.addEventListener('mousemove', inputHandlers.handleMouseMove);
            cell.addEventListener('mousedown', inputHandlers.handleMouseDown);
            cell.addEventListener('touchstart', inputHandlers.handleTouchStart, { passive: true });
            tempGrid[r][c] = cell;
            elements.puzzleGridElement.appendChild(cell);
        }
    }
    return tempGrid;
}

export function restorePathUI(currentPath) {
    if (!currentPath) return;
    currentPath.forEach(step => {
        if (step && step.cell) {
            step.cell.classList.add('selected');
            const cellKey = `${step.cell.dataset.row}-${step.cell.dataset.col}`;
            updateSvgNumberSelection(cellKey, true);
        }
    });
}

export function updateSvgPath(pathPoints, cellSize) {
    const { gamePathPolyline, tempLineElement, currentClickAnimation } = getState();
    if (!gamePathPolyline) return;
    const pointsString = pathPoints.join(' ');
    gamePathPolyline.setAttribute('points', pointsString);
    const lineThickness = Math.min(35, cellSize * 0.8);
    gamePathPolyline.setAttribute('stroke-width', lineThickness);

    if (tempLineElement) {
        tempLineElement.setAttribute('stroke-width', lineThickness);
    }
    if (currentClickAnimation) {
        currentClickAnimation.line.setAttribute('stroke-width', lineThickness);
    }
}

export function clearSvgPath() {
    const { gamePathPolyline, tempLineElement } = getState();
    if (gamePathPolyline) {
        gamePathPolyline.setAttribute('points', '');
    }
    clearClickAnimation();
    if (tempLineElement) {
        tempLineElement.style.visibility = 'hidden';
    }
}

export function drawNumbersOnSvg(numberPositions, puzzleGrid, cellSize) {
    elements.numbersSvgElement.innerHTML = '';
    const newSvgElements = {};
    const circleRadius = Math.min(14, Math.max(9, cellSize * 0.275));
    const fontSize = Math.min(13, Math.max(9.8, cellSize * 0.28));

    for (const cellKey in numberPositions) {
        const value = numberPositions[cellKey];
        const [r, c] = cellKey.split('-').map(Number);
        const cellElement = puzzleGrid?.[r]?.[c];
        if (!cellElement) continue;

        const center = getCellCenter(cellElement, elements.puzzleGridElement);
        const circle = document.createElementNS(config.SVG_NS, 'circle');
        circle.setAttribute('cx', center.x);
        circle.setAttribute('cy', center.y);
        circle.setAttribute('r', circleRadius);
        circle.classList.add('number-circle-bg');
        if (cellElement.classList.contains('selected')) {
            circle.classList.add('selected');
        }

        const text = document.createElementNS(config.SVG_NS, 'text');
        text.setAttribute('x', center.x);
        text.setAttribute('y', center.y);
        text.setAttribute('font-size', `${fontSize}px`);
        text.classList.add('number-text');
        text.textContent = value;

        elements.numbersSvgElement.appendChild(circle);
        elements.numbersSvgElement.appendChild(text);
        newSvgElements[cellKey] = { circle, text };
    }
    setSvgElements(newSvgElements);
}

export function updateSvgNumberSelection(cellKey, isSelected) {
    const { svgNumberElements } = getState();
    const numElements = svgNumberElements[cellKey];
    if (numElements && numElements.circle) {
        if (isSelected) {
            numElements.circle.classList.add('selected');
        } else {
            numElements.circle.classList.remove('selected');
        }
    }
}

export function showGeneratingText() {
    elements.puzzleGridElement.innerHTML = '<div class="generating-text">Generating Level...<br/>Please Wait</div>';
    elements.puzzleGridElement.style.gridTemplateRows = ``;
    elements.puzzleGridElement.style.gridTemplateColumns = ``;
}

export function showGenerationErrorText(message) {
    elements.puzzleGridElement.innerHTML = `<div class="generating-text">${message}</div>`;
}


export function updateButtonStates(state) {
    const { level, points, currentPath, isGameOver, isGenerating, isPaused, isAnimatingClick, gridRows, gridCols, xCells, expectedNextValue } = state;
    const canInteract = !isGameOver && !isGenerating && !isPaused && !isAnimatingClick;
    const canPause = !isGameOver && !isGenerating;
    const isGameWon = isGameOver && currentPath.length === (gridRows * gridCols) && expectedNextValue > xCells;

    elements.undoButton.disabled = !canInteract || currentPath.length <= 0;
    elements.clearPathButton.disabled = !canInteract || currentPath.length === 0;
    elements.resetLevelButton.disabled = !canInteract || (level > 1 && points < config.RESET_PENALTY);
    elements.pauseButton.disabled = !canPause;
    elements.restartGameButton.disabled = false;
    elements.nextLevelButton.disabled = !isGameWon;

    if (elements.nextLevelButton) {
        elements.nextLevelButton.style.display = isGameWon ? 'inline-block' : 'none';
    }
}

export function disableAllInput() {
    elements.undoButton.disabled = true;
    elements.clearPathButton.disabled = true;
    elements.resetLevelButton.disabled = true;
    elements.pauseButton.disabled = true;
    elements.restartGameButton.disabled = false;
    elements.nextLevelButton.disabled = true;
    if (elements.nextLevelButton) elements.nextLevelButton.style.display = 'none';
}

export function showMessage(message, id = null, debounce = false) {
    const now = Date.now();
    let { lastMessage } = getState();

    if (debounce && message === lastMessage.text && (now - lastMessage.timestamp < config.MIN_MSG_INTERVAL)) return;
    updateState({ lastMessage: { text: message, timestamp: now } });

    if (id) hideMessage(id);

    const mb = document.createElement('div');
    mb.className = 'message-box';
    if (id) mb.dataset.messageId = id;

    const mt = document.createElement('span');
    mt.textContent = message;

    const cb = document.createElement('button');
    cb.className = 'close-button';
    cb.innerHTML = '×';
    cb.setAttribute('aria-label', 'Close message');

    const closeMsg = () => {
        if (messageTimeouts[id]) clearTimeout(messageTimeouts[id]);
        delete messageTimeouts[id];
        if (mb.parentElement) {
            mb.classList.add('hide');
            mb.addEventListener('transitionend', () => mb.remove(), { once: true });
        }
    };

    cb.onclick = closeMsg;
    mb.append(mt, cb);
    elements.messageContainer.appendChild(mb);

    requestAnimationFrame(() => requestAnimationFrame(() => mb.classList.add('show')));

    const timeoutId = setTimeout(closeMsg, config.MSG_DISPLAY_TIME);
    if (id) messageTimeouts[id] = timeoutId;
    cb.addEventListener('click', () => clearTimeout(timeoutId));
}

export function hideMessage(id) {
    const msg = elements.messageContainer.querySelector(`.message-box[data-message-id="${id}"]`);
    if (msg) msg.querySelector('.close-button')?.click();
}

export function showRestartModal() {
    if (elements.restartModalOverlay) elements.restartModalOverlay.classList.add('show');
}

export function hideRestartModal() {
    if (elements.restartModalOverlay) elements.restartModalOverlay.classList.remove('show');
}

export function togglePauseOverlay(show) {
    const overlay = document.getElementById('pauseOverlay');
    if (show) {
        elements.puzzleGridElement?.classList.add('paused');
        elements.pathSvgElement?.classList.add('paused');
        elements.numbersSvgElement?.classList.add('paused');
        overlay?.classList.add('show');
    } else {
        elements.puzzleGridElement?.classList.remove('paused');
        elements.pathSvgElement?.classList.remove('paused');
        elements.numbersSvgElement?.classList.remove('paused');
        overlay?.classList.remove('show');
    }
}

export function updateTempLineStart(cell) {
    const { tempLineElement } = getState();
    if (tempLineElement) {
        const center = getCellCenter(cell, elements.puzzleGridElement);
        tempLineElement.setAttribute('x1', center.x);
        tempLineElement.setAttribute('y1', center.y);
        tempLineElement.setAttribute('x2', center.x);
        tempLineElement.setAttribute('y2', center.y);
        tempLineElement.style.visibility = 'visible';
    }
}

export function updateTempLineEnd(coords) {
    const { tempLineElement, pathPoints } = getState();
    if (tempLineElement && pathPoints.length > 0) {
        const lastPointStr = pathPoints[pathPoints.length - 1];
        const [lastX, lastY] = lastPointStr.split(',').map(Number);

        const dx = coords.x - lastX;
        const dy = coords.y - lastY;
        let targetX = coords.x;
        let targetY = coords.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            targetY = lastY;
        } else {
            targetX = lastX;
        }

        tempLineElement.setAttribute('x2', targetX);
        tempLineElement.setAttribute('y2', targetY);
    }
}


export function hideTempLine() {
    const { tempLineElement } = getState();
    if (tempLineElement) {
        tempLineElement.style.visibility = 'hidden';
    }
}

export function animateClickPath(startPointString, targetCoords, cellSize, onComplete) {
    updateState({ isAnimatingClick: true });
    const [startX, startY] = startPointString.split(',').map(Number);
    const animLine = document.createElementNS(config.SVG_NS, 'line');
    animLine.setAttribute('x1', startX);
    animLine.setAttribute('y1', startY);
    animLine.setAttribute('x2', targetCoords.x);
    animLine.setAttribute('y2', targetCoords.y);
    animLine.classList.add('click-animation-segment');
    const lineThickness = Math.min(35, cellSize * 0.8);
    animLine.setAttribute('stroke-width', lineThickness);
    elements.pathSvgElement.appendChild(animLine);

    const deltaX = targetCoords.x - startX;
    const deltaY = targetCoords.y - startY;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    animLine.style.strokeDasharray = length;
    animLine.style.strokeDashoffset = length;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            animLine.style.strokeDashoffset = 0;
        });
    });

    const timerId = setTimeout(() => {
        if (animLine.parentNode) {
            elements.pathSvgElement.removeChild(animLine);
        }
        updateState({ isAnimatingClick: false, currentClickAnimation: null });
        onComplete();
    }, config.ANIMATION_DURATION_CLICK);

    updateState({ currentClickAnimation: { line: animLine, timerId: timerId } });
}

export function clearClickAnimation() {
    const { currentClickAnimation } = getState();
    if (currentClickAnimation) {
        clearTimeout(currentClickAnimation.timerId);
        if (currentClickAnimation.line.parentNode) {
            elements.pathSvgElement.removeChild(currentClickAnimation.line);
        }
        updateState({ currentClickAnimation: null, isAnimatingClick: false });
    }
}