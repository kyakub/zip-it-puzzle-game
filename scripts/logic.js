import { getState, updateState, resetLevelState, resetFullGameState, addPathStep, removeLastPathStep, addPathPoint, removeLastPathPoint, setGrid, setLoadedPath, terminateWorker } from './state.js';
import { config, getLevelParams } from './config.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as timer from './timer.js';
import * as persistence from './persistence.js';
import * as levelGenerator from './levelGenerator.js';
import { isValid, isNeighbor, shuffle, getCellCenter, calculateCellSize, isWallBetween } from './utils.js';

function updateUiForNewLevel() {
    const { level, points, timeRemaining, isPaused, isMuted } = getState();
    ui.updateLevelDisplay(level);
    ui.updatePointsDisplay(points);
    ui.updateTimerDisplay(timeRemaining);
    ui.updatePauseButton(isPaused);
    ui.updateSoundButton(isMuted);
}

function parseCoord(coordStr) {
    return coordStr.split('-').map(Number);
}

function getDirection(r1, c1, r2, c2) {
    if (r2 < r1) return 'N';
    if (r2 > r1) return 'S';
    if (c2 < c1) return 'W';
    if (c2 > c1) return 'E';
    return null;
}

function countOpenNeighbors(r, c, wallPositions, pathSegments) {
    let openCount = 0;
    const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    const { gridRows, gridCols } = getState();

    for (const [nr, nc] of neighbors) {
        if (isValid(nr, nc)) {
            let wallKey;
            if (nr !== r) {
                wallKey = `H_${Math.min(r, nr)}_${c}`;
            } else {
                wallKey = `V_${r}_${Math.min(c, nc)}`;
            }
            if (!wallPositions.has(wallKey) && !pathSegments.has(wallKey)) {
                openCount++;
            }
        }
    }
    return openCount;
}

function calculateWallScore(wallKey, pathCoords, pathSegments, turnCells, numberCoords, allowedWallLocationsSet) {
    let score = Math.random() * 0.5;
    const wallType = wallKey[0];
    const [r_wall, c_wall] = wallKey.substring(2).split('_').map(Number);

    let r1_wall, c1_wall, r2_wall, c2_wall;
    if (wallType === 'H') { r1_wall = r_wall; c1_wall = c_wall; r2_wall = r_wall + 1; c2_wall = c_wall; }
    else { r1_wall = r_wall; c1_wall = c_wall; r2_wall = r_wall; c2_wall = c_wall + 1; }

    const cell1Str = `${r1_wall}-${c1_wall}`;
    const cell2Str = `${r2_wall}-${c2_wall}`;

    if (turnCells.has(cell1Str) || turnCells.has(cell2Str)) {
        score += 5;
    }

    let numberProximityScore = 0;
    if (numberCoords.has(cell1Str)) {
        const numValue = numberCoords.get(cell1Str);
        numberProximityScore += (numValue === 1 || numValue === numberCoords.size) ? 1 : 2;
    }
    if (numberCoords.has(cell2Str)) {
        const numValue = numberCoords.get(cell2Str);
        numberProximityScore += (numValue === 1 || numValue === numberCoords.size) ? 1 : 2;
    }
    score += numberProximityScore;

    let parallelSegmentKey = null;
    if (wallType === 'H') {
        parallelSegmentKey = `H_${r1_wall - 1}_${c1_wall}`;
        if (pathSegments.has(parallelSegmentKey)) score += 3;
        parallelSegmentKey = `H_${r2_wall}_${c2_wall}`;
        if (pathSegments.has(parallelSegmentKey)) score += 3;
    } else {
        parallelSegmentKey = `V_${r1_wall}_${c1_wall - 1}`;
        if (pathSegments.has(parallelSegmentKey)) score += 3;
        parallelSegmentKey = `V_${r2_wall}_${c2_wall}`;
        if (pathSegments.has(parallelSegmentKey)) score += 3;
    }

    const openNeighbors1 = countOpenNeighbors(r1_wall, c1_wall, new Set([wallKey]), pathSegments);
    const openNeighbors2 = countOpenNeighbors(r2_wall, c2_wall, new Set([wallKey]), pathSegments);
    if (openNeighbors1 <= 1 || openNeighbors2 <= 1) {
        score += 1;
    }

    return score;
}

function generateWallPositions(pathCoords, numWalls, rows, cols, numberCoords) {
    const walls = new Set();
    const pathSegments = new Set();
    const turnCells = new Set();

    for (let i = 0; i < pathCoords.length - 1; i++) {
        const [r1_coord, c1_coord] = parseCoord(pathCoords[i]);
        const [r2_coord, c2_coord] = parseCoord(pathCoords[i + 1]);
        let segmentKey;
        if (r1_coord === r2_coord) { segmentKey = `V_${r1_coord}_${Math.min(c1_coord, c2_coord)}`; }
        else { segmentKey = `H_${Math.min(r1_coord, r2_coord)}_${c1_coord}`; }
        pathSegments.add(segmentKey);

        if (i > 0 && i < pathCoords.length - 1) {
            const [r0, c0] = parseCoord(pathCoords[i - 1]);
            const dir1 = getDirection(r0, c0, r1_coord, c1_coord);
            const dir2 = getDirection(r1_coord, c1_coord, r2_coord, c2_coord);
            if (dir1 !== dir2) {
                turnCells.add(pathCoords[i]);
            }
        }
    }

    const possibleWalls = [];
    for (let r_loop = 0; r_loop < rows - 1; r_loop++) { for (let c_loop = 0; c_loop < cols; c_loop++) possibleWalls.push(`H_${r_loop}_${c_loop}`); }
    for (let r_loop = 0; r_loop < rows; r_loop++) { for (let c_loop = 0; c_loop < cols - 1; c_loop++) possibleWalls.push(`V_${r_loop}_${c_loop}`); }

    const allowedWallLocations = possibleWalls.filter(wallKey => !pathSegments.has(wallKey));
    const allowedWallLocationsSet = new Set(allowedWallLocations);

    if (allowedWallLocations.length === 0) return walls;

    const scoredWalls = allowedWallLocations.map(wallKey => ({
        key: wallKey,
        score: calculateWallScore(wallKey, pathCoords, pathSegments, turnCells, numberCoords, allowedWallLocationsSet)
    }));

    scoredWalls.sort((a, b) => b.score - a.score);

    for (let i = 0; i < Math.min(numWalls, scoredWalls.length); i++) {
        walls.add(scoredWalls[i].key);
    }

    return walls;
}

function generateWaypointPositions(hamiltonianPath, numberCoords, wallPositions, numWaypoints) {
    const waypoints = new Set();
    const emptyPathCells = hamiltonianPath.filter(coord => !numberCoords.has(coord));

    if (numWaypoints <= 0 || emptyPathCells.length < numWaypoints) {
        return waypoints;
    }

    const scoredCandidates = emptyPathCells.map(coord => {
        const [r_coord, c_coord] = parseCoord(coord);
        let score = Math.random() * 0.5;

        const pathSegments = new Set();
        for (let i = 0; i < hamiltonianPath.length - 1; i++) {
            const [r1_path, c1_path] = parseCoord(hamiltonianPath[i]);
            const [r2_path, c2_path] = parseCoord(hamiltonianPath[i + 1]);
            let segmentKey;
            if (r1_path === r2_path) { segmentKey = `V_${r1_path}_${Math.min(c1_path, c2_path)}`; }
            else { segmentKey = `H_${Math.min(r1_path, r2_path)}_${c1_path}`; }
            pathSegments.add(segmentKey);
        }
        const openNeighborsVal = countOpenNeighbors(r_coord, c_coord, wallPositions, pathSegments);
        if (openNeighborsVal === 1) score += 5;
        else if (openNeighborsVal === 2) score += 3;

        const currentIndex = hamiltonianPath.indexOf(coord);
        let distToPrevNum = Infinity;
        let distToNextNum = Infinity;
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (numberCoords.has(hamiltonianPath[i])) {
                distToPrevNum = currentIndex - i;
                break;
            }
        }
        for (let i = currentIndex + 1; i < hamiltonianPath.length; i++) {
            if (numberCoords.has(hamiltonianPath[i])) {
                distToNextNum = i - currentIndex;
                break;
            }
        }
        if (distToPrevNum > 3 && distToNextNum > 3) {
            score += 1;
        }
        if (distToPrevNum > 1 && distToNextNum > 1 && Math.abs(distToPrevNum - distToNextNum) <= 2) {
            score += 0.5;
        }

        return { coord: coord, score: score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    for (let i = 0; i < Math.min(numWaypoints, scoredCandidates.length); i++) {
        waypoints.add(scoredCandidates[i].coord);
    }

    return waypoints;
}

function finishPuzzleGeneration(hamiltonianPath) {
    const { gridRows, gridCols, calculatedCellSize, wallPositions, numberPositions, waypointPositions, inputHandlers } = getState();

    const pathLength = hamiltonianPath.length;
    if (pathLength !== gridRows * gridCols) {
        console.error("Generated path does not cover all cells.");
        ui.showGenerationErrorText('Generation Error (Path Mismatch)!');
        ui.disableAllInput();
        return;
    }

    const grid = ui.buildGridUI(gridRows, gridCols, calculatedCellSize, numberPositions, wallPositions, waypointPositions, inputHandlers);
    setGrid(grid);
    ui.drawNumbersOnSvg(numberPositions, grid, calculatedCellSize);
}

function getTentativeNumberPositions(hamiltonianPath, xCells, rows, cols) {
    const numberPositionsMap = new Map();
    const pathLength = hamiltonianPath.length;

    if (pathLength !== rows * cols || pathLength < xCells) {
        console.error("Cannot place numbers: Invalid path length.");
        return numberPositionsMap;
    }

    numberPositionsMap.set(hamiltonianPath[0], 1);
    if (xCells > 1) {
        numberPositionsMap.set(hamiltonianPath[pathLength - 1], xCells);
    }
    if (xCells > 2) {
        const intermediatePathIndices = Array.from({ length: pathLength - 2 }, (_, i) => i + 1);

        let availableIndices = [...intermediatePathIndices];
        shuffle(availableIndices);
        const chosenIndices = [];
        const numIntermediate = xCells - 2;
        const idealSpacing = Math.floor(pathLength / (xCells - 1));

        let lastPlacedIndex = 0;
        while (chosenIndices.length < numIntermediate && availableIndices.length > 0) {
            let bestCandidateIndex = -1;
            let bestDistDiff = Infinity;

            for (let i = 0; i < availableIndices.length; ++i) {
                const currentIdx = availableIndices[i];
                const dist = currentIdx - lastPlacedIndex;
                const distDiff = Math.abs(dist - idealSpacing);

                if (dist > 2) {
                    if (bestCandidateIndex === -1 || distDiff < bestDistDiff) {
                        bestDistDiff = distDiff;
                        bestCandidateIndex = i;
                    } else if (distDiff === bestDistDiff && Math.random() > 0.5) {
                        bestCandidateIndex = i;
                    }
                }
            }

            if (bestCandidateIndex !== -1) {
                const chosenIdx = availableIndices.splice(bestCandidateIndex, 1)[0];
                chosenIndices.push(chosenIdx);
                lastPlacedIndex = chosenIdx;
            } else {
                if (availableIndices.length > 0) {
                    const chosenIdx = availableIndices.pop();
                    chosenIndices.push(chosenIdx);
                    lastPlacedIndex = chosenIdx;
                }
            }
        }

        chosenIndices.sort((a, b) => a - b);

        for (let i = 0; i < chosenIndices.length; i++) {
            const pathIndex = chosenIndices[i];
            numberPositionsMap.set(hamiltonianPath[pathIndex], i + 2);
        }
    }
    return numberPositionsMap;
}

export function startLevel(levelNumber, restoredState = null) {
    resetLevelState();
    terminateWorker();
    ui.clearSvgPath();
    ui.hideTempLine();
    ui.togglePauseOverlay(false);

    let level, points, gridRows, gridCols, xCells, timeLimit, initialTime = null;
    let numberPositions = {};
    let pathPointsData, calculatedCellSizeVal, isPaused, expectedNextValue;
    let wallPositionsSet = new Set();
    let waypointPositionsSet = new Set();
    let currentGradientColorsArr = [...getState().currentGradientColors];

    if (restoredState) {
        level = restoredState.level;
        points = restoredState.points;
        gridRows = restoredState.gridRows;
        gridCols = restoredState.gridCols;
        xCells = restoredState.xCells;
        timeLimit = restoredState.timeLimit;
        expectedNextValue = restoredState.expectedNextValue;
        numberPositions = restoredState.numberPositions;
        wallPositionsSet = restoredState.wallPositions;
        waypointPositionsSet = restoredState.waypointPositions;
        currentGradientColorsArr = restoredState.currentGradientColors;
        calculatedCellSizeVal = restoredState.calculatedCellSize;
        const elapsedSeconds = Math.floor((Date.now() - restoredState.saveTimestamp) / 1000);
        initialTime = restoredState.timeRemaining - elapsedSeconds;
        isPaused = restoredState.isPaused ?? false;
        pathPointsData = restoredState.pathPointsData || [];

        updateState({
            level, points, gridRows, gridCols, xCells, timeLimit, calculatedCellSize: calculatedCellSizeVal,
            numberPositions, wallPositions: wallPositionsSet, waypointPositions: waypointPositionsSet,
            currentGradientColors: currentGradientColorsArr, pathPoints: pathPointsData, isPaused, expectedNextValue
        });
        ui.updatePathGradient(currentGradientColorsArr);

    } else {
        const params = getLevelParams(levelNumber);
        level = levelNumber;
        points = getState().points;
        gridRows = params.rows;
        gridCols = params.cols;
        xCells = params.xCells;
        timeLimit = params.timeLimit;
        calculatedCellSizeVal = calculateCellSize(gridRows, gridCols, params.baseCellSize);
        pathPointsData = [];
        isPaused = false;
        expectedNextValue = 1;
        updateState({ gridRows, gridCols, calculatedCellSize: calculatedCellSizeVal });

        const shuffledColors = shuffle([...config.GRADIENT_COLORS]);
        currentGradientColorsArr = shuffledColors.slice(0, 2);
        ui.updatePathGradient(currentGradientColorsArr);

        updateState({
            level, points, gridRows, gridCols, xCells, timeLimit, calculatedCellSize: calculatedCellSizeVal,
            numberPositions: {}, wallPositions: new Set(), waypointPositions: new Set(),
            currentGradientColors: currentGradientColorsArr, pathPoints: pathPointsData, isPaused, expectedNextValue
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

    const timeRemainingVal = (restoredState && initialTime !== null && initialTime > 0) ? Math.floor(initialTime) : timeLimit;
    updateState({ timeRemaining: timeRemainingVal });

    updateUiForNewLevel();
    ui.updateSvgPath(pathPointsData, calculatedCellSizeVal);
    timer.stopTimer();

    if (restoredState) {
        const grid = ui.buildGridUI(gridRows, gridCols, calculatedCellSizeVal, numberPositions, wallPositionsSet, waypointPositionsSet, getState().inputHandlers);
        setGrid(grid);
        setLoadedPath(restoredState.currentPathData, grid);
        ui.restorePathUI(getState().currentPath);
        ui.drawNumbersOnSvg(numberPositions, grid, calculatedCellSizeVal);

        if (isPaused) {
            ui.togglePauseOverlay(true);
            ui.updatePauseButton(true);
        } else {
            timer.startTimer();
        }
        ui.updateButtonStates(getState());

    } else {
        ui.showGeneratingText();
        ui.disableAllInput();

        const currentLevelParams = getLevelParams(level);
        levelGenerator.generateLevelAsync(gridRows, gridCols, (hamiltonianPath) => {
            const tentativeNumberCoords = getTentativeNumberPositions(hamiltonianPath, xCells, gridRows, gridCols);
            const newWallPositions = generateWallPositions(hamiltonianPath, currentLevelParams.numWalls, gridRows, gridCols, tentativeNumberCoords);
            const newWaypointPositions = generateWaypointPositions(hamiltonianPath, tentativeNumberCoords, newWallPositions, currentLevelParams.numWaypoints);
            const finalNumberPositions = {};
            tentativeNumberCoords.forEach((value, key) => { finalNumberPositions[key] = value; });

            updateState({
                wallPositions: newWallPositions,
                numberPositions: finalNumberPositions,
                waypointPositions: newWaypointPositions
            });

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
    if (cell.classList.contains('waypoint')) {
        cell.classList.add('waypoint-visited');
    }
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

export function addStepsInLine(cellsInLine, puzzleGridElement) {
    const state = getState();
    if (state.isAnimatingClick || cellsInLine.length === 0) return;

    const originalLastPathPointString = state.pathPoints.length > 0 ? state.pathPoints[state.pathPoints.length - 1] : null;

    if (!originalLastPathPointString && state.currentPath.length > 0) {
        console.warn("addStepsInLine: pathPoints is empty but currentPath is not. This indicates a state mismatch.");
        return;
    }
    if (state.currentPath.length === 0 && cellsInLine.length > 0) {
        console.warn("addStepsInLine called on an empty path. First step should be handled by addStep.");
        if (cellsInLine.length === 1 && (parseInt(cellsInLine[0].dataset.value) || null) === 1) {
            addStep(cellsInLine[0], true, puzzleGridElement);
        }
        return;
    }


    for (const cell of cellsInLine) {
        const cellKey = `${cell.dataset.row}-${cell.dataset.col}`;
        const previousExpectedValue = getState().expectedNextValue;
        const currentValue = parseInt(cell.dataset.value) || null;

        cell.classList.add('selected');
        if (cell.classList.contains('waypoint')) {
            cell.classList.add('waypoint-visited');
        }
        ui.updateSvgNumberSelection(cellKey, true);
        addPathStep(cell, previousExpectedValue);

        if (currentValue === previousExpectedValue) {
            updateState({ expectedNextValue: previousExpectedValue + 1 });
        }

        const targetCoords = getCellCenter(cell, puzzleGridElement);
        addPathPoint(`${targetCoords.x},${targetCoords.y}`);
    }

    audio.playSound('soundTick');
    ui.updateSvgPath(getState().pathPoints, state.calculatedCellSize);

    const finalTargetCell = cellsInLine[cellsInLine.length - 1];
    const finalTargetCoords = getCellCenter(finalTargetCell, puzzleGridElement);

    const onAnimationComplete = () => {
        checkWinCondition();
        ui.updateButtonStates(getState());
    };

    if (originalLastPathPointString) {
        ui.animateClickPath(
            originalLastPathPointString,
            finalTargetCoords,
            state.calculatedCellSize,
            onAnimationComplete
        );
    } else {
        onAnimationComplete();
    }
}

export function undoLastStep(isDuringDrag) {
    ui.clearClickAnimation();
    if (getState().currentPath.length <= 0) return;

    const removedStep = removeLastPathStep();
    if (!removedStep || !removedStep.cell) return;

    const cellKey = `${removedStep.cell.dataset.row}-${removedStep.cell.dataset.col}`;
    removedStep.cell.classList.remove('selected');
    if (removedStep.cell.classList.contains('waypoint')) {
        removedStep.cell.classList.remove('waypoint-visited');
    }
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

export function undoStepsInLine(targetCellAsNewLast) {
    if (getState().isAnimatingClick) return;
    ui.clearClickAnimation();

    let currentPath = getState().currentPath;
    while (currentPath.length > 0 && currentPath[currentPath.length - 1].cell !== targetCellAsNewLast) {
        if (currentPath.length === 1 && currentPath[0].cell === targetCellAsNewLast) break;
        undoLastStep(false);
        currentPath = getState().currentPath;
        if (currentPath.length === 0) break;
    }
    ui.updateButtonStates(getState());
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
            if (step.cell.classList.contains('waypoint')) {
                step.cell.classList.remove('waypoint-visited');
            }
            ui.updateSvgNumberSelection(cellKey, false);
        }
    });

    updateState({ currentPath: [], pathPoints: [], expectedNextValue: 1 });
    ui.clearSvgPath();

    ui.drawNumbersOnSvg(state.numberPositions, state.currentPuzzle, state.calculatedCellSize);

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
        handleIncorrectFinish(false, false, false);
        return;
    }

    const lastVal = parseInt(lastCell.dataset.value);
    const endCorrect = lastVal === state.xCells;

    let allWaypointsVisited = true;
    const visitedCoords = new Set(state.currentPath.map(step => `${step.cell.dataset.row}-${step.cell.dataset.col}`));
    for (const waypointCoord of state.waypointPositions) {
        if (!visitedCoords.has(waypointCoord)) {
            allWaypointsVisited = false;
            break;
        }
    }

    if (correctSequence && endCorrect && allWaypointsVisited) {
        handleWin();
    } else {
        handleIncorrectFinish(correctSequence, endCorrect, allWaypointsVisited);
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

function handleIncorrectFinish(correctSequence, endCorrect, allWaypointsVisited = true) {
    if (!allWaypointsVisited) {
        ui.showMessage(`You missed a required waypoint!`, null, true);
        audio.playSound('soundError');
    } else if (!endCorrect) {
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

    let allWaypointsVisited = true;
    const visitedCoords = new Set(state.currentPath.map(step => `${step.cell.dataset.row}-${step.cell.dataset.col}`));
    for (const waypointCoord of state.waypointPositions) {
        if (!visitedCoords.has(waypointCoord)) {
            allWaypointsVisited = false;
            break;
        }
    }

    if (lastCellValue === state.xCells && state.currentPath.length === targetPathLength && state.expectedNextValue > state.xCells && allWaypointsVisited) {
        persistence.clearFullGameState();
        const nextLevelNum = state.level + 1;
        updateState({ level: nextLevelNum });
        persistence.saveLevel(nextLevelNum);
        startLevel(nextLevelNum);
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