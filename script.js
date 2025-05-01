document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const puzzleGridElement = document.getElementById('puzzleGrid');
    const timerElement = document.getElementById('timer');
    const scoreElement = document.getElementById('score');
    const levelDisplayElement = document.getElementById('levelDisplay');
    const undoButton = document.getElementById('undoButton');
    const resetLevelButton = document.getElementById('resetLevelButton');
    const restartGameButton = document.getElementById('restartGameButton');
    const nextLevelButton = document.getElementById('nextLevelButton');
    const messageContainer = document.getElementById('messageContainer');

    // --- Audio Elements ---
    const soundTick = document.getElementById('soundTick');
    const soundError = document.getElementById('soundError');
    const soundWin = document.getElementById('soundWin');
    const soundLose = document.getElementById('soundLose');

    // --- Game Configuration ---
    const MSG_DISPLAY_TIME = 5000; // milliseconds
    const BASE_TIME_LIMIT = 120; // seconds for level 1
    const CELL_SIZE = 60; // pixels

    // --- Game State Object ---
    const game = {
        level: 1, // Default level
        gridSize: 5,
        xCells: 5,
        timeLimit: BASE_TIME_LIMIT,
        score: 0,
        currentPuzzle: [],
        currentPath: [],
        drawnLines: [],
        timerInterval: null,
        timeRemaining: 0,
        isDrawing: false,
        isGameOver: false,
        expectedNextValue: 1,

        // --- Methods ---

        init() {
            this.loadScore(); // Load saved score
            this.loadLevel(); // Load saved level
            this.startLevel(); // Start at the loaded (or default) level
            this.addEventListeners();
        },

        startLevel() {
            this.isGameOver = false;
            this.isDrawing = false;
            this.currentPath = [];
            this.drawnLines.forEach(line => line.remove());
            this.drawnLines = [];
            this.expectedNextValue = 1;

            // --- UPDATED Level Progression Calculation ---

            // Grid Size: Starts at 5, increases by 1 every 15 levels, max 7
            const gridSizeIncrease = Math.floor((this.level - 1) / 15);
            this.gridSize = Math.min(7, 5 + gridSizeIncrease); // Cap at 7x7

            // Numbered Cells (xCells): Starts at 5, increases by 1 every 10 levels, max 13
            const xCellsIncrease = Math.floor((this.level - 1) / 10);
            this.xCells = Math.min(13, 5 + xCellsIncrease); // Cap at 13

            // Time limit progression (can keep this or adjust if needed)
            this.timeLimit = BASE_TIME_LIMIT + (this.level - 1) * 10;

            // Log the calculated difficulty for debugging/verification
            console.log(`Starting Level ${this.level}: Grid ${this.gridSize}x${this.gridSize}, Numbers ${this.xCells}, Time ${this.timeLimit}s`);

            this.updateUI();
            this.generatePuzzle();
            this.startTimer();
            nextLevelButton.style.display = 'none';
            this.enableInput();
        },

        updateUI() {
            levelDisplayElement.textContent = `Level: ${this.level}`;
            scoreElement.textContent = `Score: ${this.score}`;
            this.updateTimerDisplay();
        },

        generatePuzzle() {
            this.currentPuzzle = [];
            puzzleGridElement.innerHTML = '';

            puzzleGridElement.style.gridTemplateColumns = `repeat(${this.gridSize}, ${CELL_SIZE}px)`;
            puzzleGridElement.style.gridTemplateRows = `repeat(${this.gridSize}, ${CELL_SIZE}px)`;

            let numbersToPlace = Array.from({ length: this.xCells }, (_, i) => i + 1);
            let totalCells = this.gridSize * this.gridSize;
            let gridValues = new Array(totalCells).fill(null);

            let numberIndices = this.shuffle(Array.from({ length: totalCells }, (_, i) => i));
            for (let i = 0; i < this.xCells; i++) {
                gridValues[numberIndices[i]] = numbersToPlace[i];
            }

            for (let r = 0; r < this.gridSize; r++) {
                let row = [];
                for (let c = 0; c < this.gridSize; c++) {
                    const cell = document.createElement('div');
                    const value = gridValues[r * this.gridSize + c];
                    cell.classList.add('cell');
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    cell.dataset.value = value !== null ? value : '';
                    cell.style.width = `${CELL_SIZE}px`;
                    cell.style.height = `${CELL_SIZE}px`;

                    if (value !== null) {
                        const numberElement = document.createElement('span');
                        numberElement.textContent = value;
                        cell.appendChild(numberElement);
                    }

                    cell.addEventListener('mousemove', this.handleMouseMove.bind(this));
                    row.push(cell);
                    puzzleGridElement.appendChild(cell);
                }
                this.currentPuzzle.push(row);
            }
             this.currentPuzzle.flat().forEach(cell => {
                 cell.addEventListener('mousedown', this.handleMouseDown.bind(this));
            });
        },

        shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },

        // --- Event Handlers ---
        handleMouseDown(e) {
            if (this.isGameOver || this.isDrawing) return;

            const cell = e.target.closest('.cell');
            if (!cell) return;

            const value = parseInt(cell.dataset.value) || null;
            const isPathEmpty = this.currentPath.length === 0;
            const lastPathStep = isPathEmpty ? null : this.currentPath[this.currentPath.length - 1];

            if (isPathEmpty) {
                if (value === 1) {
                    this.isDrawing = true;
                    cell.classList.add('selected');
                    this.currentPath.push({ cell: cell, expectedValueBeforeEntering: 1 });
                    this.expectedNextValue = 2;
                    this.playSound(soundTick);
                    console.log("Path started:", this.getPathValues());
                } else {
                    this.showMessage("Path must start on number 1!");
                    this.playSound(soundError);
                }
            }
            else if (!isPathEmpty && cell === lastPathStep.cell) {
                 this.isDrawing = true;
                 console.log("Resuming draw from cell:", value ?? 'Empty');
            }
             else {
                 console.log("Click ignored: Not the start (1) or the last cell of the existing path.");
             }
        },

        handleMouseMove(e) {
            if (!this.isDrawing || this.isGameOver) return;

            const gridRect = puzzleGridElement.getBoundingClientRect();
            const mouseX = e.clientX - gridRect.left;
            const mouseY = e.clientY - gridRect.top;
            const col = Math.floor(mouseX / CELL_SIZE);
            const row = Math.floor(mouseY / CELL_SIZE);

            if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return;

            const currentCell = this.currentPuzzle[row]?.[col];
            if (!currentCell) return;

            const lastPathStep = this.currentPath.length > 0 ? this.currentPath[this.currentPath.length - 1] : null;
            const lastCell = lastPathStep?.cell;

            if (!lastCell || currentCell === lastCell) return;

            if (this.currentPath.length > 1 && currentCell === this.currentPath[this.currentPath.length - 2].cell) {
                this.undoLastStep(true);
                console.log("Undo during drag:", this.getPathValues());
            }
            else if (!currentCell.classList.contains('selected') && this.isNeighbor(lastCell, currentCell)) {
                const currentValue = parseInt(currentCell.dataset.value) || null;

                let isValidMove = false;
                let isMovingToExpectedNumber = false;

                if (currentValue === this.expectedNextValue) {
                    isValidMove = true;
                    isMovingToExpectedNumber = true;
                } else if (currentValue === null) {
                    isValidMove = true;
                }

                if (isValidMove) {
                    const previousExpectedValue = this.expectedNextValue;
                    currentCell.classList.add('selected');
                    this.drawLine(lastCell, currentCell);
                    this.currentPath.push({ cell: currentCell, expectedValueBeforeEntering: previousExpectedValue });
                    this.playSound(soundTick);

                    if (isMovingToExpectedNumber) {
                        this.expectedNextValue++;
                        console.log("Path extended to number:", currentValue, " New expected:", this.expectedNextValue, " Path:", this.getPathValues());
                        if (currentValue === this.xCells) {
                             this.checkWinCondition();
                        }
                    } else {
                        console.log("Path extended to empty cell. Expected:", this.expectedNextValue, " Path:", this.getPathValues());
                    }
                } else {
                     console.log("Invalid move attempt to:", currentValue, "Expected:", this.expectedNextValue);
                }
            }
        },

        handleMouseUp() {
            if (this.isDrawing) {
                 this.isDrawing = false;
                 console.log("Mouse up, drawing stopped. Final path:", this.getPathValues());
                 this.checkWinCondition();
            }
        },

        handleUndo() {
            if (this.currentPath.length > 1 && !this.isGameOver && !this.isDrawing) {
                this.undoLastStep(false);
                console.log("Undo button pressed:", this.getPathValues());
            } else if (this.isDrawing) {
                 this.showMessage("Cannot undo while drawing.");
            } else if (!this.isGameOver && this.currentPath.length <= 1) {
                 this.showMessage("Cannot undo further.");
            }
        },

        handleResetLevel() {
             if (this.isGameOver && this.currentPath.length < this.gridSize * this.gridSize) {
             } else if (this.isGameOver) {
                  this.showMessage("Level complete. Use 'Next Level' or 'Restart Game'.");
                  return;
             }
             console.log(`Resetting Level ${this.level}`);
             this.stopTimer();
             this.startLevel(); // Re-run setup for the current level (keeps score/level)
             this.showMessage(`Level ${this.level} Reset!`);
        },

        handleRestartGame() {
             console.log("Restarting Game");
             this.stopTimer();
             this.level = 1; // Back to level 1
             this.score = 0; // Reset score
             this.saveScore(); // Save the reset score
             this.saveLevel(); // Save the reset level (level 1)
             this.startLevel(); // Start level 1 setup
             this.showMessage("Game Restarted!");
        },

        handleNextLevel() {
            if (!this.isGameOver || this.currentPath.length < this.gridSize * this.gridSize) return;
            this.level++;
            this.saveLevel(); // Save the new level number
            this.startLevel(); // Start the next level setup
        },

        // --- Game Logic Helpers ---
        isNeighbor(cell1, cell2) {
            if (!cell1 || !cell2) return false;
            const r1 = parseInt(cell1.dataset.row);
            const c1 = parseInt(cell1.dataset.col);
            const r2 = parseInt(cell2.dataset.row);
            const c2 = parseInt(cell2.dataset.col);
            return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
        },

        drawLine(fromCell, toCell) {
            const gridRect = puzzleGridElement.getBoundingClientRect();
            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();

            const x1 = fromRect.left + fromRect.width / 2 - gridRect.left;
            const y1 = fromRect.top + fromRect.height / 2 - gridRect.top;
            const x2 = toRect.left + toRect.width / 2 - gridRect.left;
            const y2 = toRect.top + toRect.height / 2 - gridRect.top;

            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

            const line = document.createElement('div');
            line.classList.add('line');
            line.style.width = `${length}px`;
            line.style.transform = `rotate(${angle}deg)`;
            line.style.left = `${x1}px`;
            line.style.top = `${y1 - 5}px`;

            puzzleGridElement.appendChild(line);
            this.drawnLines.push(line);
        },

        undoLastStep(isDuringDrag) {
            if (this.currentPath.length <= 1) return;

            const removedStep = this.currentPath.pop();
            removedStep.cell.classList.remove('selected');

            const lastLine = this.drawnLines.pop();
            if (lastLine) lastLine.remove();

            this.expectedNextValue = removedStep.expectedValueBeforeEntering;

            if (!isDuringDrag) this.playSound(soundTick);
        },


        checkWinCondition() {
            if (this.isGameOver) return;

            const totalCellsInGrid = this.gridSize * this.gridSize;
            const pathLength = this.currentPath.length;
            const pathCoversAllCells = pathLength === totalCellsInGrid;

            const pathEndsOnCorrectNumberOrLater = this.expectedNextValue > this.xCells;

            let allNumbersPresent = false;
            if (pathEndsOnCorrectNumberOrLater) {
                 const pathValues = new Set(
                     this.currentPath.map(step => parseInt(step.cell.dataset.value)).filter(v => !isNaN(v))
                 );
                 allNumbersPresent = true;
                 for (let i = 1; i <= this.xCells; i++) {
                    if (!pathValues.has(i)) {
                        allNumbersPresent = false;
                        break;
                    }
                }
            }

            if (pathCoversAllCells && pathEndsOnCorrectNumberOrLater && allNumbersPresent) {
                this.isGameOver = true;
                this.stopTimer();
                this.score += this.level * 10 + Math.max(0, this.timeRemaining);
                this.saveScore(); // Save score after winning
                // Level is saved when 'Next Level' is clicked (or game restarted)
                this.updateUI();
                this.showMessage(`Level ${this.level} Complete! Score: ${this.score}`);
                this.playSound(soundWin);
                this.disableInput();
                nextLevelButton.style.display = 'inline-block';
                console.log("Game Won!");
            }
            else if (this.expectedNextValue === this.xCells + 1 && !pathCoversAllCells) {
                 console.log("Last number reached, continue filling empty cells.");
            }
        },

        // --- Timer ---
        startTimer() {
            this.stopTimer();
            this.timeRemaining = this.timeLimit;
            this.updateTimerDisplay();

            this.timerInterval = setInterval(() => {
                this.timeRemaining--;
                this.updateTimerDisplay();

                if (this.timeRemaining <= 0) {
                    this.handleGameOver("Time's up!");
                }
            }, 1000);
        },

        stopTimer() {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        },

        updateTimerDisplay() {
            const minutes = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0');
            const seconds = String(this.timeRemaining % 60).padStart(2, '0');
            timerElement.textContent = `Time: ${minutes}:${seconds}`;
        },

        handleGameOver(reason) {
             if (this.isGameOver) return;
             this.isGameOver = true;
             this.stopTimer();
             this.isDrawing = false;
             this.disableInput();
             this.showMessage(reason + " Game Over!");
             this.playSound(soundLose);
             console.log("Game Lost:", reason);
        },

        // --- Score & Level Persistence ---
        updateScoreDisplay() {
             scoreElement.textContent = `Score: ${this.score}`;
        },
        saveScore() {
            localStorage.setItem('zipItHighScore', this.score.toString());
            this.updateScoreDisplay();
        },
        loadScore() {
            const savedScore = localStorage.getItem('zipItHighScore');
            this.score = savedScore ? parseInt(savedScore, 10) : 0;
            this.updateScoreDisplay();
        },
        saveLevel() {
            localStorage.setItem('zipItCurrentLevel', this.level.toString());
            console.log(`Saved level: ${this.level}`);
        },
        loadLevel() {
            const savedLevel = localStorage.getItem('zipItCurrentLevel');
            const parsedLevel = savedLevel ? parseInt(savedLevel, 10) : 1;
            this.level = (parsedLevel && parsedLevel > 0) ? parsedLevel : 1;
            console.log(`Loaded level: ${this.level}`);
        },

        // --- Input Control ---
        disableInput() {
            undoButton.disabled = true;
            resetLevelButton.disabled = true;
        },
        enableInput() {
             undoButton.disabled = false;
             resetLevelButton.disabled = false;
        },


        // --- Utility ---
        getPathValues() {
            return this.currentPath.map(step => step.cell.dataset.value || 'E').join(' -> ');
        },

        showMessage(message) {
            console.log("Message:", message);

            const messageBox = document.createElement('div');
            messageBox.classList.add('message-box');

            const messageText = document.createElement('span');
            messageText.textContent = message;

            const closeButton = document.createElement('button');
            closeButton.classList.add('close-button');
            closeButton.innerHTML = '×';
            closeButton.onclick = () => {
                 messageBox.style.opacity = '0';
                 messageBox.style.transform = 'translateX(10px)';
                 setTimeout(() => messageBox.remove(), 300);
            };

            messageBox.appendChild(messageText);
            messageBox.appendChild(closeButton);
            messageContainer.appendChild(messageBox);

            requestAnimationFrame(() => {
                 requestAnimationFrame(() => {
                     messageBox.classList.add('show');
                 });
            });


            setTimeout(() => {
                if (messageBox.parentElement) {
                     closeButton.onclick();
                }
            }, MSG_DISPLAY_TIME);
        },

        playSound(audioElement) {
            if (audioElement) {
                audioElement.currentTime = 0;
                audioElement.play().catch(e => console.error("Error playing sound:", e));
            }
        },

        addEventListeners() {
            undoButton.addEventListener('click', this.handleUndo.bind(this));
            resetLevelButton.addEventListener('click', this.handleResetLevel.bind(this));
            restartGameButton.addEventListener('click', this.handleRestartGame.bind(this));
            nextLevelButton.addEventListener('click', this.handleNextLevel.bind(this));

            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
            document.addEventListener('dragstart', (e) => e.preventDefault());
        }

    }; // End of game object

    // --- Initialize Game ---
    game.init();

}); // End DOMContentLoaded