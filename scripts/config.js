export const config = {
    MSG_DISPLAY_TIME: 5000,
    BASE_TIME_LIMIT: 60,
    MAX_HAMILTONIAN_ATTEMPTS: 25,
    MIN_MSG_INTERVAL: 1500,
    MIN_CELL_SIZE: 35,
    MAX_CELL_SIZE: 70,
    STORAGE_KEY_GAME_STATE: 'zipItGameState',
    STORAGE_KEY_LEVEL: 'zipItCurrentLevel',
    STORAGE_KEY_POINTS: 'zipItHighPoints',
    STORAGE_KEY_SOUND: 'zipItSoundMuted',
    RESET_PENALTY: 10,
    SVG_NS: "http://www.w3.org/2000/svg",
    ANIMATION_DURATION_CLICK: 100,
    LEVEL_PARAMS: [
        // Added numWaypoints
        { level: 1, rows: 4, cols: 4, xCells: 5, baseCellSize: 70, timeAdd: 0, numWalls: 0, numWaypoints: 0 },
        { level: 11, rows: 4, cols: 4, xCells: 6, baseCellSize: 70, timeAdd: 0, numWalls: 1, numWaypoints: 0 },
        { level: 21, rows: 5, cols: 5, xCells: 7, baseCellSize: 65, timeAdd: 5, numWalls: 2, numWaypoints: 0 },
        { level: 41, rows: 5, cols: 5, xCells: 8, baseCellSize: 65, timeAdd: 5, numWalls: 3, numWaypoints: 0 },
        { level: 61, rows: 6, cols: 6, xCells: 9, baseCellSize: 60, timeAdd: 10, numWalls: 4, numWaypoints: 1 }, // Start waypoints
        { level: 81, rows: 6, cols: 6, xCells: 10, baseCellSize: 60, timeAdd: 10, numWalls: 5, numWaypoints: 1 },
        { level: 101, rows: 7, cols: 7, xCells: 11, baseCellSize: 56, timeAdd: 15, numWalls: 6, numWaypoints: 2 },
        { level: 121, rows: 7, cols: 7, xCells: 12, baseCellSize: 56, timeAdd: 15, numWalls: 8, numWaypoints: 2 },
        { level: 141, rows: 7, cols: 8, xCells: 13, baseCellSize: 55, timeAdd: 20, numWalls: 10, numWaypoints: 3 },
        { level: 161, rows: 7, cols: 8, xCells: 14, baseCellSize: 55, timeAdd: 20, numWalls: 12, numWaypoints: 3 },
        { level: 181, rows: 8, cols: 8, xCells: 15, baseCellSize: 54, timeAdd: 25, numWalls: 15, numWaypoints: 4 },
        { level: 201, rows: 8, cols: 8, xCells: 16, baseCellSize: 54, timeAdd: 25, numWalls: 18, numWaypoints: 4 },
        { level: 221, rows: 8, cols: 9, xCells: 17, baseCellSize: 53, timeAdd: 30, numWalls: 21, numWaypoints: 5 },
        { level: 241, rows: 8, cols: 9, xCells: 18, baseCellSize: 53, timeAdd: 30, numWalls: 24, numWaypoints: 5 },
        { level: 261, rows: 9, cols: 9, xCells: 19, baseCellSize: 52, timeAdd: 35, numWalls: 28, numWaypoints: 6 },
        { level: 281, rows: 9, cols: 9, xCells: 20, baseCellSize: 52, timeAdd: 35, numWalls: 32, numWaypoints: 6 },
        { level: 301, rows: 10, cols: 10, xCells: 20, baseCellSize: 52, timeAdd: 50, numWalls: 40, numWaypoints: 8 },
    ],
    MAX_XCELLS: 20,
    MAX_WALL_PERCENT: 0.4,
    GRADIENT_COLORS: [
        "#ff8a00", "#e52e71", "#873cff", "#00c6ff", "#00ff9d",
        "#ffe000", "#ff4e50", "#fc67fa", "#30cfd0", "#a3ff00"
    ]
};

export function getLevelParams(level) {
    let params = { ...config.LEVEL_PARAMS[0] };
    for (let i = config.LEVEL_PARAMS.length - 1; i >= 0; i--) {
        if (level >= config.LEVEL_PARAMS[i].level) {
            params = { ...config.LEVEL_PARAMS[i] };
            break;
        }
    }

    const levelWithinTier = level - params.level;
    const tiers = [
        { start: 21, xIncLevel: 20 }, { start: 41, xIncLevel: 20 },
        { start: 61, xIncLevel: 20 }, { start: 81, xIncLevel: 20 },
        { start: 101, xIncLevel: 20 }, { start: 121, xIncLevel: 20 },
        { start: 141, xIncLevel: 20 }, { start: 161, xIncLevel: 20 },
        { start: 181, xIncLevel: 20 }, { start: 201, xIncLevel: 20 },
        { start: 221, xIncLevel: 20 }, { start: 241, xIncLevel: 20 },
        { start: 261, xIncLevel: 20 }, { start: 281, xIncLevel: 20 },
    ];

    for (const tier of tiers) {
        if (params.level === tier.start && levelWithinTier >= tier.xIncLevel) {
            params.xCells++;
            // Optional: Increase waypoints within tiers
            // if (params.numWaypoints > 0 && tier.start >= 101) params.numWaypoints++;
            break;
        }
    }

    const maxPossibleXCells = params.rows * params.cols;
    params.xCells = Math.min(params.xCells, maxPossibleXCells, config.MAX_XCELLS);
    if (maxPossibleXCells > 1 && params.xCells < 2) params.xCells = 2;
    else if (maxPossibleXCells === 1) params.xCells = 1;

    const totalInternalHorizontalBorders = params.cols * (params.rows - 1);
    const totalInternalVerticalBorders = params.rows * (params.cols - 1);
    const totalInternalBorders = totalInternalHorizontalBorders + totalInternalVerticalBorders;
    const maxAllowedWalls = Math.floor(totalInternalBorders * config.MAX_WALL_PERCENT);
    params.numWalls = Math.min(params.numWalls, maxAllowedWalls, totalInternalBorders - (maxPossibleXCells - 1));
    params.numWalls = Math.max(0, params.numWalls);

    // Cap waypoints - ensure enough empty cells remain
    const totalCells = params.rows * params.cols;
    const maxWaypoints = totalCells - params.xCells; // Can only place on non-numbered cells
    params.numWaypoints = Math.min(params.numWaypoints, maxWaypoints);
    params.numWaypoints = Math.max(0, params.numWaypoints);

    params.timeLimit = config.BASE_TIME_LIMIT + params.timeAdd;
    return params;
}