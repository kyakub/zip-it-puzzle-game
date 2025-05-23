import { config } from './config.js';
import { getState, getPathForSave } from './state.js';

export function saveData(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn(`Could not save data for key ${key}:`, e);
    }
}

export function loadData(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn(`Could not load data for key ${key}:`, e);
        return null;
    }
}

export function removeData(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn(`Could not remove data for key ${key}:`, e);
    }
}

export function saveFullGameState() {
    const state = getState();
    if (state.isGenerating || (state.isGameOver && !state.isLevelCompletePendingNext)) {
        clearFullGameState();
        return;
    }

    const pathData = getPathForSave();
    const wallData = Array.from(state.wallPositions);
    const waypointData = Array.from(state.waypointPositions);

    const stateToSave = {
        level: state.level,
        points: state.points,
        gridRows: state.gridRows,
        gridCols: state.gridCols,
        xCells: state.xCells,
        calculatedCellSize: state.calculatedCellSize,
        timeLimit: state.timeLimit,
        timeRemaining: state.timeRemaining,
        saveTimestamp: Date.now(),
        expectedNextValue: state.expectedNextValue,
        numberPositions: state.numberPositions,
        wallPositions: wallData,
        waypointPositions: waypointData,
        currentGradientColors: state.currentGradientColors,
        currentPathData: pathData,
        pathPointsData: state.pathPoints,
        isMuted: state.isMuted,
        isPaused: state.isPaused,
        isLevelCompletePendingNext: state.isLevelCompletePendingNext
    };
    saveData(config.STORAGE_KEY_GAME_STATE, JSON.stringify(stateToSave));
}

export function loadFullGameState() {
    const savedStateJSON = loadData(config.STORAGE_KEY_GAME_STATE);
    if (!savedStateJSON) return null;

    try {
        const parsedState = JSON.parse(savedStateJSON);
        if (parsedState && typeof parsedState.level === 'number'
            && typeof parsedState.points === 'number'
            && typeof parsedState.timeRemaining === 'number'
            && parsedState.numberPositions
            && Array.isArray(parsedState.wallPositions)
            && Array.isArray(parsedState.waypointPositions)
            && typeof parsedState.isLevelCompletePendingNext === 'boolean'
            && Array.isArray(parsedState.currentGradientColors)
            && parsedState.currentGradientColors.length === 2) {
            removeData(config.STORAGE_KEY_GAME_STATE);
            parsedState.wallPositions = new Set(parsedState.wallPositions);
            parsedState.waypointPositions = new Set(parsedState.waypointPositions);
            return parsedState;
        } else {
            console.warn("Invalid saved state found (check persistence flags?), clearing.");
            clearFullGameState();
            return null;
        }
    } catch (e) {
        console.warn("Could not parse saved game state:", e);
        clearFullGameState();
        return null;
    }
}

export function clearFullGameState() {
    removeData(config.STORAGE_KEY_GAME_STATE);
}

export function loadLevel() {
    const savedLevel = loadData(config.STORAGE_KEY_LEVEL);
    const parsedLevel = savedLevel ? parseInt(savedLevel, 10) : 1;
    return (parsedLevel && parsedLevel > 0) ? parsedLevel : 1;
}

export function saveLevel(level) {
    saveData(config.STORAGE_KEY_LEVEL, level.toString());
}

export function loadPoints() {
    const savedPoints = loadData(config.STORAGE_KEY_POINTS);
    const parsedPoints = savedPoints ? parseInt(savedPoints, 10) : 0;
    return isNaN(parsedPoints) ? 0 : parsedPoints;
}

export function savePoints(points) {
    saveData(config.STORAGE_KEY_POINTS, Math.max(0, points).toString());
}