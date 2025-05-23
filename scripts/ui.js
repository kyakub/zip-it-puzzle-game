import { config } from './config.js';
import { getState, updateState, setSvgElements } from './state.js';
import { getCellCenter } from './utils.js';

let elements = {};
let messageTimeouts = {};

export function initializeUI(domElements) {
    elements = domElements;
    elements.gradStop1 = document.getElementById('gradStop1');
    elements.gradStop2 = document.getElementById('gradStop2');
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

export function buildGridUI(gridRows, gridCols, cellSize, numberPositions, wallPositions, waypointPositions, inputHandlers) {
    elements.puzzleGridElement.innerHTML = '';
    elements.numbersSvgElement.innerHTML = '';
    setSvgElements({});

    elements.puzzleGridElement.style.minHeight = '';
    elements.puzzleGridElement.style.minWidth = '';
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

            if (wallPositions.has(`H_${r}_${c}`)) {
                cell.classList.add('wall-below');
            }
            if (wallPositions.has(`V_${r}_${c}`)) {
                cell.classList.add('wall-right');
            }

            if (waypointPositions.has(cellKey)) {
                cell.classList.add('waypoint');
                const marker = document.createElement('span');
                marker.classList.add('waypoint-marker');
                cell.appendChild(marker);
            }

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
            if (step.cell.classList.contains('waypoint')) {
                step.cell.classList.add('waypoint-visited');
            }
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

export function updatePathGradient(colors) {
    if (elements.gradStop1 && elements.gradStop2 && colors && colors.length >= 2) {
        elements.gradStop1.setAttribute('stop-color', colors[0]);
        elements.gradStop2.setAttribute('stop-color', colors[1]);
    } else {
        console.warn("Could not update gradient colors. Elements or colors missing.");
    }
}

export function showGeneratingText() {
    const { gridRows, gridCols, calculatedCellSize } = getState();
    const currentHeight = gridRows * calculatedCellSize;
    const currentWidth = gridCols * calculatedCellSize;

    clearSvgPath();
    if (elements.numbersSvgElement) {
        elements.numbersSvgElement.innerHTML = '';
    }
    setSvgElements({});

    elements.puzzleGridElement.innerHTML = '';
    elements.puzzleGridElement.style.minHeight = `${currentHeight || 100}px`;
    elements.puzzleGridElement.style.minWidth = `${currentWidth || 100}px`;
    elements.puzzleGridElement.style.gridTemplateRows = ``;
    elements.puzzleGridElement.style.gridTemplateColumns = ``;

    const generatingDiv = document.createElement('div');
    generatingDiv.className = 'generating-text';
    generatingDiv.innerHTML = 'Generating Level...<br/>Please Wait';
    elements.puzzleGridElement.appendChild(generatingDiv);
}

export function showGenerationErrorText(message) {
    const { gridRows, gridCols, calculatedCellSize } = getState();
    const currentHeight = gridRows * calculatedCellSize;
    const currentWidth = gridCols * calculatedCellSize;
    clearSvgPath();
    if (elements.numbersSvgElement) {
        elements.numbersSvgElement.innerHTML = '';
    }
    setSvgElements({});
    elements.puzzleGridElement.innerHTML = '';
    elements.puzzleGridElement.style.minHeight = `${currentHeight || 100}px`;
    elements.puzzleGridElement.style.minWidth = `${currentWidth || 100}px`;
    elements.puzzleGridElement.style.gridTemplateRows = ``;
    elements.puzzleGridElement.style.gridTemplateColumns = ``;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'generating-text';
    errorDiv.textContent = message;
    elements.puzzleGridElement.appendChild(errorDiv);
}

export function updateButtonStates(state) {
    const { level, points, currentPath, isGameOver, isGenerating, isPaused, isAnimatingClick, gridRows, gridCols, xCells, expectedNextValue, waypointPositions, isLevelCompletePendingNext } = state;

    const canInteractGeneral = !isGameOver && !isGenerating && !isPaused && !isAnimatingClick;
    const canPause = !isGenerating && !(isGameOver && !isLevelCompletePendingNext) && !isLevelCompletePendingNext;

    let isGameEffectivelyWon = false;
    if (isLevelCompletePendingNext && isGameOver) {
        isGameEffectivelyWon = true;
    } else if (!isGameOver && !isGenerating && !isPaused) {
        const targetPathLength = gridRows * gridCols;
        let allWaypointsVisitedOnCheck = true;
        if (waypointPositions.size > 0 && currentPath.length === targetPathLength) {
            const visitedCoords = new Set(currentPath.map(step => `${step.cell.dataset.row}-${step.cell.dataset.col}`));
            for (const waypointCoord of waypointPositions) {
                if (!visitedCoords.has(waypointCoord)) {
                    allWaypointsVisitedOnCheck = false;
                    break;
                }
            }
        } else if (waypointPositions.size > 0 && currentPath.length < targetPathLength) {
            allWaypointsVisitedOnCheck = false;
        } else if (waypointPositions.size === 0 && currentPath.length < targetPathLength) {
            allWaypointsVisitedOnCheck = true;
        }


        isGameEffectivelyWon = currentPath.length === targetPathLength && expectedNextValue > xCells && allWaypointsVisitedOnCheck;
    }


    const canInteractActivePlay = canInteractGeneral && !isLevelCompletePendingNext;

    elements.undoButton.disabled = !canInteractActivePlay || currentPath.length <= 0;
    elements.clearPathButton.disabled = !canInteractActivePlay || currentPath.length === 0;

    let resetDisabled = isGenerating || isPaused || (isGameOver && !isLevelCompletePendingNext);
    if (!resetDisabled && !isLevelCompletePendingNext && level > 1 && points < config.RESET_PENALTY) {
        resetDisabled = true;
    }
    if (isLevelCompletePendingNext) resetDisabled = true;
    elements.resetLevelButton.disabled = resetDisabled;

    elements.pauseButton.disabled = !canPause;
    elements.restartGameButton.disabled = isGenerating;

    elements.nextLevelButton.disabled = !isGameEffectivelyWon || !isGameOver;
    if (elements.nextLevelButton) {
        elements.nextLevelButton.style.display = (isGameEffectivelyWon && isGameOver) ? 'inline-block' : 'none';
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
    const { tempLineElement, currentGradientColors } = getState();
    if (tempLineElement) {
        const center = getCellCenter(cell, elements.puzzleGridElement);
        const endColor = currentGradientColors[1] || '#555';
        tempLineElement.setAttribute('x1', center.x);
        tempLineElement.setAttribute('y1', center.y);
        tempLineElement.setAttribute('x2', center.x);
        tempLineElement.setAttribute('y2', center.y);
        tempLineElement.setAttribute('stroke', endColor);
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
    const { currentGradientColors } = getState();
    const endColor = currentGradientColors[1] || '#555';

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
    animLine.setAttribute('stroke', endColor);
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