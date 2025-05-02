// --- pathfinder.js ---

// Grid check helper
function isValid(r, c, gridSize) {
    return r >= 0 && r < gridSize && c >= 0 && c < gridSize;
}

// Get valid N, S, E, W neighbors
function getNeighbors(r, c, gridSize) {
    const neighbors = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (isValid(nr, nc, gridSize)) {
            neighbors.push([nr, nc]);
        }
    }
    return neighbors;
}

// Standard array shuffle
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// --- Hamiltonian Path Finder (Backtracking + Warnsdorff Heuristic) ---
function findHamiltonianPath(r, c, path, visited, gridSize) {
    const cellKey = `${r}-${c}`;
    path.push(cellKey);
    visited.add(cellKey);

    const totalCells = gridSize * gridSize;
    if (path.length === totalCells) {
        return path; // Found a complete path
    }

    // Get unvisited neighbors
    const neighbors = getNeighbors(r, c, gridSize);
    const validNeighbors = neighbors.filter(([nr, nc]) => !visited.has(`${nr}-${nc}`));

    // Calculate score (fewest onward moves) for each valid neighbor
    const neighborsWithScores = validNeighbors.map(([nr, nc]) => {
        const onwardMoves = getNeighbors(nr, nc, gridSize)
            .filter(([nnr, nnc]) => !visited.has(`${nnr}-${nnc}`)).length;
        return { coords: [nr, nc], score: onwardMoves };
    });

    // Sort neighbors by score (ascending) to prioritize tighter spots
    neighborsWithScores.sort((a, b) => a.score - b.score);

    // Try sorted neighbors recursively
    for (const { coords: [nr, nc] } of neighborsWithScores) {
        if (!visited.has(`${nr}-${nc}`)) { // Re-check just in case
            const result = findHamiltonianPath(nr, nc, path, visited, gridSize);
            if (result) {
                return result; // Pass success up the call stack
            }
        }
    }

    // Backtrack if no path found from this node
    path.pop();
    visited.delete(cellKey);
    return null;
}


// --- Worker Message Handler ---
self.onmessage = function (event) {
    console.log('Worker: Message received:', event.data);
    const { gridSize, maxAttempts } = event.data;

    if (!gridSize || !maxAttempts) {
        console.error("Worker: Missing parameters.");
        self.postMessage({ success: false, error: 'Invalid parameters received.' });
        return;
    }

    let hamiltonianPath = null;
    let attempts = 0;
    let messagePosted = false;

    try {
        console.log(`Worker: Starting path search for ${gridSize}x${gridSize} (max ${maxAttempts} attempts).`);
        const startTime = performance.now();

        // Attempt to find a path starting from random cells
        while (!hamiltonianPath && attempts < maxAttempts) {
            attempts++;
            const startRow = Math.floor(Math.random() * gridSize);
            const startCol = Math.floor(Math.random() * gridSize);
            const visited = new Set();
            hamiltonianPath = findHamiltonianPath(startRow, startCol, [], visited, gridSize);
        }

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`Worker: Search finished in ${duration}s after ${attempts} attempts.`);

        // Post result back to the main thread
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

// Optional: Catch potential top-level errors in the worker
self.onerror = function (event) {
    console.error('Worker: Uncaught error:', event.message, event);
};

console.log("Worker: pathfinder.js loaded.");