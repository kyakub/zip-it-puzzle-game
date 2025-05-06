let gameState = {
    level: 1,
    points: 0,
    gridRows: 0,
    gridCols: 0,
    calculatedCellSize: 0,
    xCells: 0,
    timeLimit: 0,
    timeRemaining: 0,
    currentPuzzle: [],
    currentPath: [],
    pathPoints: [],
    numberPositions: {},
    wallPositions: new Set(),
    waypointPositions: new Set(), // Added waypoints
    currentGradientColors: ["#ff8a00", "#873cff"],
    svgNumberElements: {},
    gamePathPolyline: null,
    tempLineElement: null,
    currentClickAnimation: null,
    expectedNextValue: 1,
    isDrawing: false,
    isGameOver: false,
    isPaused: false,
    isGenerating: false,
    isMuted: false,
    isAnimatingClick: false,
    saveTimestamp: 0,
    lastMessage: { text: '', timestamp: 0 },
    pathFindingWorker: null,
};

export function getState() {
    return { ...gameState };
}

export function updateState(newState) {
    if (newState.wallPositions && !(newState.wallPositions instanceof Set)) {
        newState.wallPositions = new Set(newState.wallPositions);
    }
    if (newState.waypointPositions && !(newState.waypointPositions instanceof Set)) {
        newState.waypointPositions = new Set(newState.waypointPositions); // Handle loading waypoints
    }
    if (newState.currentGradientColors && !Array.isArray(newState.currentGradientColors)) {
        newState.currentGradientColors = ["#ff8a00", "#873cff"];
    }
    gameState = { ...gameState, ...newState };
}

export function resetLevelState() {
    updateState({
        isGameOver: false,
        isDrawing: false,
        isPaused: false,
        isGenerating: false,
        isAnimatingClick: false,
        currentPath: [],
        pathPoints: [],
        numberPositions: {},
        wallPositions: new Set(),
        waypointPositions: new Set(), // Reset waypoints
        svgNumberElements: {},
        expectedNextValue: 1,
        currentPuzzle: [],
        currentClickAnimation: null,
    });
}

export function resetFullGameState() {
    updateState({
        level: 1,
        points: 0,
        isGameOver: false,
        isDrawing: false,
        isPaused: false,
        isGenerating: false,
        isAnimatingClick: false,
        currentPath: [],
        pathPoints: [],
        numberPositions: {},
        wallPositions: new Set(),
        waypointPositions: new Set(), // Reset waypoints
        currentGradientColors: ["#ff8a00", "#873cff"],
        svgNumberElements: {},
        expectedNextValue: 1,
        currentPuzzle: [],
        currentClickAnimation: null,
        timeRemaining: 0,
    });
}

export function getPathForSave() {
    return gameState.currentPath.map(step => ({
        coords: `${step.cell.dataset.row}-${step.cell.dataset.col}`,
        expectedValue: step.expectedValueBeforeEntering
    }));
}

export function setLoadedPath(pathData, puzzleGrid) {
    const loadedPath = pathData.map(stepData => {
        const [r, c] = stepData.coords.split('-').map(Number);
        const cell = puzzleGrid?.[r]?.[c];
        if (!cell) return null;
        return {
            cell: cell,
            expectedValueBeforeEntering: stepData.expectedValue
        };
    }).filter(step => step !== null);
    updateState({ currentPath: loadedPath });
}

export function addPathStep(cell, expectedValue) {
    gameState.currentPath.push({
        cell: cell,
        expectedValueBeforeEntering: expectedValue
    });
}

export function removeLastPathStep() {
    return gameState.currentPath.pop();
}

export function addPathPoint(pointString) {
    gameState.pathPoints.push(pointString);
}

export function removeLastPathPoint() {
    gameState.pathPoints.pop();
}

export function setSvgElements(elements) {
    updateState({ svgNumberElements: elements });
}

export function setGrid(grid) {
    updateState({ currentPuzzle: grid });
}

export function setWorker(worker) {
    updateState({ pathFindingWorker: worker });
}

export function terminateWorker() {
    if (gameState.pathFindingWorker) {
        gameState.pathFindingWorker.terminate();
        updateState({ pathFindingWorker: null });
    }
}