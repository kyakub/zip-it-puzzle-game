// Global variables
const MESSAGE_DISPLAY_TIME = 10000; // Message display time in milliseconds (10 seconds)
const gridSize = 5;
const puzzleGrid = document.getElementById('puzzleGrid');
let currentPuzzle = [];
let lineElements = []; // Array to hold all drawn lines
let isDrawing = false; // To check if the user is dragging
let isPathStarted = false; // Flag to track if the path has started

// Add timer in JavaScript
let timerInterval;

function startTimer() {
    let timeRemaining = 120; // Set 2 minutes (120 seconds)
    const timerElement = document.getElementById('timer');

    timerInterval = setInterval(() => {
        const minutes = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
        const seconds = String(timeRemaining % 60).padStart(2, '0');
        timerElement.textContent = `Time: ${minutes}:${seconds}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            showGameOverMessage(); // Show game over message
        }

        timeRemaining--;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Add score counting
let score = 0;

function updateScore() {
    const scoreElement = document.getElementById('score');
    scoreElement.textContent = `Score: ${score}`;
    localStorage.setItem('currentScore', score); // Save score in local storage
}

function loadScore() {
    const savedScore = localStorage.getItem('currentScore');
    if (savedScore !== null) {
        score = parseInt(savedScore, 10); // Load saved score
        updateScore(); // Update score display on the page
    }
}

// Add sounds
const correctSound = new Audio('correct.mp3');
const errorSound = new Audio('error.mp3');

function playCorrectSound() {
    correctSound.play();
}

function playErrorSound() {
    errorSound.play();
}

// Save progress
function saveProgress() {
    const progress = {
        currentPuzzle,
        currentPath,
        timeElapsed,
        score,
    };
    localStorage.setItem('zipPuzzleProgress', JSON.stringify(progress));
}

// Load progress
function loadProgress() {
    const savedProgress = localStorage.getItem('zipPuzzleProgress');
    if (savedProgress) {
        const { currentPuzzle: savedPuzzle, currentPath: savedPath, timeElapsed: savedTime, score: savedScore } = JSON.parse(savedProgress);
        currentPuzzle = savedPuzzle;
        currentPath = savedPath;
        timeElapsed = savedTime;
        score = savedScore;
        initializePuzzle();
        startTimer();
    }
}

// Initialize the grid with numbers and check their placement
function initializePuzzle() {
    currentPuzzle = [];
    currentPath = [];
    lineElements = [];

    // Clear the grid
    puzzleGrid.innerHTML = '';

    // Create an array of numbers 1-6 and empty blocks
    let numbers = Array.from({ length: gridSize * gridSize }, (_, i) => (i < 6 ? i + 1 : null));
    numbers = shuffle(numbers);

    // Check that numbers don't block the path
    while (!isValidNumberPlacement(numbers)) {
        numbers = shuffle(numbers);
    }

    // Create the grid
    for (let i = 0; i < gridSize; i++) {
        let row = [];
        for (let j = 0; j < gridSize; j++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.dataset.value = numbers[i * gridSize + j];

            if (numbers[i * gridSize + j] !== null) {
                const numberElement = document.createElement('span');
                numberElement.textContent = numbers[i * gridSize + j];
                cell.appendChild(numberElement);
            }

            cell.addEventListener('mousedown', handleMouseDown);
            cell.addEventListener('mousemove', handleMouseMove);
            cell.addEventListener('mouseup', handleMouseUp);
            row.push(cell);
            puzzleGrid.appendChild(cell);
        }
        currentPuzzle.push(row);
    }
}

// Check that numbers do not block the path
function isValidNumberPlacement(numbers) {
    const grid = [];
    for (let i = 0; i < gridSize; i++) {
        grid.push(numbers.slice(i * gridSize, (i + 1) * gridSize));
    }

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            if (grid[i][j] !== null) {
                const neighbors = [
                    [i - 1, j], // up
                    [i + 1, j], // down
                    [i, j - 1], // left
                    [i, j + 1], // right
                ];
                for (const [ni, nj] of neighbors) {
                    if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                        const neighborValue = grid[ni][nj];
                        if (neighborValue !== null && Math.abs(neighborValue - grid[i][j]) === 1) {
                            return false; // Numbers are next to each other
                        }
                    }
                }
            }
        }
    }
    return true;
}

// Shuffle array for random number placement
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Function to draw a line between two cells
function drawLine(fromCell, toCell) {
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const gridRect = puzzleGrid.getBoundingClientRect();

    const x1 = fromRect.left + fromRect.width / 2 - gridRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - gridRect.top;
    const x2 = toRect.left + toRect.width / 2 - gridRect.left;
    const y2 = toRect.top + toRect.height / 2 - gridRect.top;

    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    const line = document.createElement('div');
    line.classList.add('line');
    line.style.width = `${length}px`;
    line.style.transformOrigin = '0 50%';
    line.style.transform = `rotate(${angle}deg)`;
    line.style.left = `${x1}px`;
    line.style.top = `${y1 - 5}px`;

    puzzleGrid.appendChild(line);
    lineElements.push(line);
}

// Updated function to find the path between two cells
function findPath(fromCell, toCell) {
    const start = { row: parseInt(fromCell.dataset.row), col: parseInt(fromCell.dataset.col) };
    const end = { row: parseInt(toCell.dataset.row), col: parseInt(toCell.dataset.col) };

    const queue = [start];
    const visited = new Set();
    const cameFrom = {};

    visited.add(`${start.row},${start.col}`);

    while (queue.length > 0) {
        const current = queue.shift();
        const key = `${current.row},${current.col}`;

        if (current.row === end.row && current.col === end.col) {
            // Build the path
            const path = [];
            let step = key;
            while (step) {
                const [row, col] = step.split(',').map(Number);
                path.unshift({ row, col });
                step = cameFrom[step];
            }
            return path;
        }

        // Check neighbors
        const neighbors = [
            { row: current.row - 1, col: current.col }, // up
            { row: current.row + 1, col: current.col }, // down
            { row: current.row, col: current.col - 1 }, // left
            { row: current.row, col: current.col + 1 }, // right
        ];

        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.row},${neighbor.col}`;
            if (
                neighbor.row >= 0 &&
                neighbor.row < gridSize &&
                neighbor.col >= 0 &&
                neighbor.col < gridSize &&
                !visited.has(neighborKey)
            ) {
                const neighborCell = currentPuzzle[neighbor.row][neighbor.col];
                const neighborValue = parseInt(neighborCell.dataset.value);

                // Ignore blocks with numbers that do not match the sequence
                if (
                    neighborValue === null || // Empty block
                    isNaN(neighborValue) || // Empty block
                    neighborValue === parseInt(toCell.dataset.value) // Block with a number that matches the sequence
                ) {
                    visited.add(neighborKey);
                    cameFrom[neighborKey] = key;
                    queue.push(neighbor);
                }
            }
        }
    }

    return null; // Path not found
}

// Updated function to draw the path
function drawPath(fromCell, toCell) {
    const path = findPath(fromCell, toCell);
    if (!path) {
        showMessage("Valid path not found!");
        return;
    }

    for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i + 1];

        const currentCell = currentPuzzle[current.row][current.col];
        const nextCell = currentPuzzle[next.row][next.col];

        // Highlight the current cell
        if (!currentCell.classList.contains('selected')) {
            currentCell.classList.add('selected');
        }

        drawLine(currentCell, nextCell);
    }

    // Highlight the final cell
    if (!toCell.classList.contains('selected')) {
        toCell.classList.add('selected');
    }

    // Check for game completion
    checkGameCompletion();
}

// Game completion check
function checkGameCompletion() {
    console.log("checkGameCompletion called"); // Debug output
    const allCells = document.querySelectorAll('.cell');
    const allSelected = Array.from(allCells).every(cell => cell.classList.contains('selected'));

    if (allSelected) {
        console.log("All cells selected"); // Debug output
        const lastValue = parseInt(currentPath[currentPath.length - 1]?.dataset.value);
        if (lastValue === 6) {
            console.log("Game completed successfully"); // Debug output
            showMessage("Congratulations! You successfully completed the game!");
            stopTimer();
            score += 1;
            updateScore();
            disableGameInteraction();
        } else {
            console.log("Game completed incorrectly"); // Debug output
            showMessage("Error: You must finish the path at number 6!");
        }
    } else {
        const lastValue = parseInt(currentPath[currentPath.length - 1]?.dataset.value);
        let allNumbersConnected = true;
        let allEmptyCellsConnected = true;

        if (lastValue) {
            // Check if all numbers from 1 to the last number are selected
            for (let i = 1; i <= lastValue; i++) {
                const cell = findCellByValue(i);
                if (!cell || !cell.classList.contains('selected')) {
                    console.log(`Number ${i} is not selected`); // Debug output
                    allNumbersConnected = false;
                }
            }

            // Check if all empty cells have been captured
            allCells.forEach(cell => {
                if (!cell.dataset.value && !cell.classList.contains('selected')) {
                    console.log("Empty cell not captured"); // Debug output
                    allEmptyCellsConnected = false;
                }
            });

            // If numbers or empty cells are not captured, show a message
            if (!allNumbersConnected || !allEmptyCellsConnected) {
                showMessage("Link all numbers sequentially and fill all cells!");
                return;
            }

            // Check if the path continues after the last number
            if (lastValue === 6 && currentPath.length > 6) {
                const nextCell = currentPath[currentPath.length - 1];
                if (nextCell) {
                    console.log("Path continues after the last number"); // Debug output
                    showMessage("Link all numbers sequentially and fill all cells!");
                    return;
                }
            }
        }
    }
}

// Mouse down handler to start drawing line
function handleMouseDown(e) {
    const cell = e.target.closest('.cell');
    if (!cell) return;

    const value = parseInt(cell.dataset.value);

    // Check: Path can only start with number 1
    if (currentPath.length === 0 && value !== 1) {
        showMessage("You must start the path from number 1!"); // Error message
        playErrorSound();
        return;
    }

    // Check: If the path has already started, it can only continue from the last cell
    if (currentPath.length > 0 && cell !== currentPath[currentPath.length - 1]) {
        showMessage("You can only continue from the last cell in the path!"); // Error message
        playErrorSound();
        return;
    }

    console.log("handleMouseDown called for cell:", cell.dataset.value); // Debug output

    isDrawing = true;

    // If the cell is not selected yet, add it to the path
    if (!currentPath.includes(cell)) {
        currentPath.push(cell);
        console.log("currentPath updated:", currentPath.map(c => c.dataset.value)); // Debug output
        cell.classList.add('selected');
    }
}

// Connection matrix for valid connections
const connectionMatrix = {
    1: [2],
    2: [3],
    3: [4],
    4: [5],
    5: [6],
    6: [7],
    7: [8],
    8: [9],
    9: [10],
    10: []
};

function isValidConnection(fromValue, toValue) {
    return connectionMatrix[fromValue].includes(toValue);
}

// Updated handler for drawing line while moving the mouse
function handleMouseMove(e) {
    if (!isDrawing) return;

    const cell = e.target.closest('.cell');
    if (!cell) return;

    const lastCell = currentPath[currentPath.length - 1];

    // If the user is moving forward
    if (!cell.classList.contains('selected')) {
        // Check if the cell is a neighbor (only up, down, left, or right)
        if (!isNeighbor(lastCell, cell)) return;

        // Add the current cell to the path
        currentPath.push(cell);
        cell.classList.add('selected');

        // Draw line between the last and current cell
        drawLine(lastCell, cell);
    }
    // If the user is moving back
    else if (currentPath.length > 1 && currentPath[currentPath.length - 2] === cell) {
        // Remove the last line
        const lastLine = lineElements.pop();
        if (lastLine) {
            lastLine.remove();
        }

        // Unselect the last cell
        const lastCell = currentPath.pop();
        lastCell.classList.remove('selected');
    }
}

// Check if the cells are neighbors
function isNeighbor(cell1, cell2) {
    const row1 = parseInt(cell1.dataset.row);
    const col1 = parseInt(cell1.dataset.col);
    const row2 = parseInt(cell2.dataset.row);
    const col2 = parseInt(cell2.dataset.col);

    // Check if cells are either in the same row or column
    return (
        (row1 === row2 && Math.abs(col1 - col2) === 1) || // Horizontal neighbor
        (col1 === col2 && Math.abs(row1 - row2) === 1)    // Vertical neighbor
    );
}

// Handler for finishing the line drawing
function handleMouseUp() {
    isDrawing = false;
    checkGameCompletion(); // Check for game completion
}

// Find a cell by its value
function findCellByValue(value) {
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            if (currentPuzzle[i][j].dataset.value == value) {
                return currentPuzzle[i][j];
            }
        }
    }
    return null;
}

// Undo the last action
document.getElementById('undoButton').addEventListener('click', () => {
    if (currentPath.length > 1) { // Make sure there's at least one line to undo
        const lastCell = currentPath.pop(); // Remove the last cell from the path
        lastCell.classList.remove('selected'); // Unselect the cell

        const lastLine = lineElements.pop(); // Remove the last line
        if (lastLine) {
            lastLine.remove();
        }
    } else {
        showMessage("Can't undo further!"); // Use a universal function
    }
});

// Restart button handler
document.getElementById('restartButton').addEventListener('click', () => {
    clearInterval(timerInterval); // Stop the current timer
    initializePuzzle(); // Restart the puzzle grid
    startTimer(); // Start a new timer
    currentPath = [];
    lineElements.forEach(line => line.remove());
    lineElements = [];
    isPathStarted = false; // Reset the path start flag
});

// Save progress after every action
document.addEventListener('mouseup', saveProgress);

// Initialize the puzzle when the page loads
window.onload = () => {
    loadScore(); // Load score from local storage
    loadProgress(); // Load game progress
};

let tempLine = null; // Temporary line for real-time display

function createTempLine() {
    if (!tempLine) {
        tempLine = document.createElement('div');
        tempLine.classList.add('line', 'temp'); // Add a temporary line class
        puzzleGrid.appendChild(tempLine);
    }
}

function updateTempLine(fromCell, toCell) {
    createTempLine(); // Ensure the temporary line is created
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const gridRect = puzzleGrid.getBoundingClientRect();

    const x1 = fromRect.left + fromRect.width / 2 - gridRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - gridRect.top;
    const x2 = toRect.left + toRect.width / 2 - gridRect.left;
    const y2 = toRect.top + toRect.height / 2 - gridRect.top;

    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    tempLine.style.width = `${length}px`;
    tempLine.style.height = `10px`; // Line thickness
    tempLine.style.position = 'absolute';
    tempLine.style.backgroundColor = 'rgba(0, 0, 255, 0.5)'; // Blue color for temporary line
    tempLine.style.transformOrigin = '0 50%';
    tempLine.style.transform = `rotate(${angle}deg)`;
    tempLine.style.left = `${x1}px`;
    tempLine.style.top = `${y1 - 5}px`;
}

function removeTempLine() {
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
}

function showGameOverMessage() {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    if (!messageBox || !messageText) {
        console.error("MessageBox or MessageText elements not found");
        return;
    }

    // Set message text
    messageText.textContent = "Time is up! You lost.";

    // Change background to red
    messageBox.style.backgroundColor = "#ffcccc"; // Red background
    messageBox.style.color = "red"; // Red text

    // Show the message box
    messageBox.style.display = "block";
    messageBox.style.opacity = "1";

    // Disable game interaction
    disableGameInteraction();

    // Auto-hide after 10 seconds
    setTimeout(() => {
        hideMessage();
    }, 10000); // 10 seconds
}

function showSuccessMessage() {
    showMessage("Congratulations! You successfully completed the game!");
    stopTimer();
    score += 1;
    updateScore();
    disableGameInteraction();
}

function disableGameInteraction() {
    const allCells = document.querySelectorAll('.cell');
    if (allCells.length === 0) return; // Check if there are any cells in the grid

    allCells.forEach(cell => {
        cell.removeEventListener('mousedown', handleMouseDown);
        cell.removeEventListener('mousemove', handleMouseMove);
        cell.removeEventListener('mouseup', handleMouseUp);
    });
}

function showMessage(message) {
    console.log("showMessage called with message:", message); // Debug output
    const messageContainer = document.getElementById('messageContainer');

    if (!messageContainer) {
        console.error("Message container not found");
        return;
    }

    // Create a new message
    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box');

    // Create message text
    const messageText = document.createElement('span');
    messageText.textContent = message;

    // Create a close button
    const closeButton = document.createElement('button');
    closeButton.classList.add('close-button');
    closeButton.textContent = '×';
    closeButton.onclick = () => {
        messageBox.style.transform = 'translateX(5px)'; // Move right
        messageBox.style.opacity = '0'; // Reduce opacity
        setTimeout(() => {
            messageBox.remove(); // Remove message from DOM
        }, 300); // Account for animation time
    };

    // Add text and button to the message
    messageBox.appendChild(messageText);
    messageBox.appendChild(closeButton);

    // Add the message to the container
    messageContainer.appendChild(messageBox);

    // Show the message with animation
    setTimeout(() => {
        messageBox.style.opacity = '1';
    }, 100);

    // Remove the message after a set time with fade-out animation
    setTimeout(() => {
        if (messageBox.parentElement) { // Check if the message still exists
            messageBox.style.transform = 'translateX(5px)'; // Move right
            messageBox.style.opacity = '0'; // Reduce opacity
            setTimeout(() => {
                messageBox.remove(); // Remove message from DOM
            }, 300); // Account for animation time
        }
    }, MESSAGE_DISPLAY_TIME); // Use global variable
}