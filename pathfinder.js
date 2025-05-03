// --- pathfinder.js ---

function isValid(r, c, gridRows, gridCols) {
    return r >= 0 && r < gridRows && c >= 0 && c < gridCols;
}

function getNeighbors(r, c, gridRows, gridCols) {
    const neighbors = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (isValid(nr, nc, gridRows, gridCols)) { // Pass dimensions
            neighbors.push([nr, nc]);
        }
    }
    return neighbors;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// --- Hamiltonian Path Finder (Backtracking + Warnsdorff Heuristic) ---
function findHamiltonianPath(r, c, path, visited, gridRows, gridCols) {
    const cellKey = `${r}-${c}`;
    path.push(cellKey);
    visited.add(cellKey);

    const totalCells = gridRows * gridCols; // Use dimensions
    if (path.length === totalCells) {
        return path;
    }

    const neighbors = getNeighbors(r, c, gridRows, gridCols); // Pass dimensions
    const validNeighbors = neighbors.filter(([nr, nc]) => !visited.has(`${nr}-${nc}`));

    const neighborsWithScores = validNeighbors.map(([nr, nc]) => {
        // Pass dimensions to inner getNeighbors
        const onwardMoves = getNeighbors(nr, nc, gridRows, gridCols)
            .filter(([nnr, nnc]) => !visited.has(`${nnr}-${nnc}`)).length;
        return { coords: [nr, nc], score: onwardMoves };
    });

    neighborsWithScores.sort((a, b) => a.score - b.score);

    for (const { coords: [nr, nc] } of neighborsWithScores) {
        if (!visited.has(`${nr}-${nc}`)) {
            // Pass dimensions recursively
            const result = findHamiltonianPath(nr, nc, path, visited, gridRows, gridCols);
            if (result) {
                return result;
            }
        }
    }

    path.pop();
    visited.delete(cellKey);
    return null;
}


// --- Worker Message Handler ---
self.onmessage = function (event) {
    console.log('Worker: Message received:', event.data);
    // Expect gridRows and gridCols now
    const { gridRows, gridCols, maxAttempts } = event.data;

    if (gridRows === undefined || gridCols === undefined || !maxAttempts) {
        console.error("Worker: Missing gridRows, gridCols, or maxAttempts.");
        self.postMessage({ success: false, error: 'Invalid parameters received.' });
        return;
    }

    let hamiltonianPath = null;
    let attempts = 0;
    let messagePosted = false;

    try {
        console.log(`Worker: Starting path search for ${gridRows}x${gridCols} (max ${maxAttempts} attempts).`);
        const startTime = performance.now();

        while (!hamiltonianPath && attempts < maxAttempts) {
            attempts++;
            const startRow = Math.floor(Math.random() * gridRows); // Use gridRows
            const startCol = Math.floor(Math.random() * gridCols); // Use gridCols
            const visited = new Set();
            // Pass dimensions to finder
            hamiltonianPath = findHamiltonianPath(startRow, startCol, [], visited, gridRows, gridCols);
        }

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`Worker: Search finished in ${duration}s after ${attempts} attempts.`);

        if (hamiltonianPath) {
            console.log("Worker: Path Found.");
            self.postMessage({ success: true, path: hamiltonianPath, attempts: attempts, duration: duration });
            messagePosted = true;
        } else {
            console.warn(`Worker: Failed to find Path after ${attempts} attempts.`);
            self.postMessage({ success: false, reason: 'Max attempts reached', attempts: attempts, duration: duration });
            messagePosted = true;
        }
    } catch (err) {
        console.error("Worker: Error during path finding:", err);
        if (!messagePosted) {
            self.postMessage({ success: false, error: err.message || 'Unknown pathfinding error.' });
        }
    }
};

self.onerror = function (event) {
    console.error('Worker: Uncaught error:', event.message, event);
};

console.log("Worker: pathfinder.js loaded.");