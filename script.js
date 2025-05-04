document.addEventListener('DOMContentLoaded', () => {
    const puzzleGridElement = document.getElementById('puzzleGrid');
    const timerElement = document.getElementById('timer');
    const pointsDisplayElement = document.getElementById('pointsDisplay');
    const levelDisplayElement = document.getElementById('levelDisplay');
    const undoButton = document.getElementById('undoButton');
    const clearPathButton = document.getElementById('clearPathButton');
    const resetLevelButton = document.getElementById('resetLevelButton');
    const restartGameButton = document.getElementById('restartGameButton');
    const pauseButton = document.getElementById('pauseButton');
    const nextLevelButton = document.getElementById('nextLevelButton');
    const messageContainer = document.getElementById('messageContainer');
    const restartModalOverlay = document.getElementById('restartModalOverlay');
    const modalConfirmRestart = document.getElementById('modalConfirmRestart');
    const modalCancelRestart = document.getElementById('modalCancelRestart');
    const soundToggleButton = document.getElementById('soundToggle');

    const soundTick = document.getElementById('soundTick');
    const soundError = document.getElementById('soundError');
    const soundWin = document.getElementById('soundWin');
    const soundLose = document.getElementById('soundLose');

    const MSG_DISPLAY_TIME = 5000;
    const BASE_TIME_LIMIT = 60;
    const MAX_HAMILTONIAN_ATTEMPTS = 25;
    const MIN_MSG_INTERVAL = 1500;
    const MIN_CELL_SIZE = 35;
    const MAX_CELL_SIZE = 70;
    const STORAGE_KEY_GAME_STATE = 'zipItGameState';
    const RESET_PENALTY = 10;

    const game = {
        level: 1,
        gridRows: 4,
        gridCols: 4,
        calculatedCellSize: MAX_CELL_SIZE,
        xCells: 5,
        timeLimit: BASE_TIME_LIMIT,
        points: 0,
        currentPuzzle: [],
        currentPath: [],
        drawnLines: [],
        timerInterval: null,
        timeRemaining: 0,
        isDrawing: false,
        isGameOver: false,
        expectedNextValue: 1,
        pathFindingWorker: null,
        isGenerating: false,
        isMuted: false,
        lastMessage: { text: '', timestamp: 0 },
        numberPositions: {},
        isPaused: false,
        MAX_HAMILTONIAN_ATTEMPTS: 25,

        init() {
            this.loadSoundPreference();
            this.addEventListeners();
            this.loadFullGameState();
        },

        _calculateLevelParams() {
            const level = this.level;
            let params = { rows: 4, cols: 4, baseCellSize: 70, timeAddition: 0, xCells: 5 };
            if (level > 300) { params = { rows: 10, cols: 10, baseCellSize: 52, timeAddition: 50 }; } else if (level > 280) { params = { rows: 9, cols: 9, baseCellSize: 52, timeAddition: 35 }; } else if (level > 260) { params = { rows: 9, cols: 9, baseCellSize: 52, timeAddition: 35 }; } else if (level > 240) { params = { rows: 8, cols: 9, baseCellSize: 53, timeAddition: 30 }; } else if (level > 220) { params = { rows: 8, cols: 9, baseCellSize: 53, timeAddition: 30 }; } else if (level > 200) { params = { rows: 8, cols: 8, baseCellSize: 54, timeAddition: 25 }; } else if (level > 180) { params = { rows: 8, cols: 8, baseCellSize: 54, timeAddition: 25 }; } else if (level > 160) { params = { rows: 7, cols: 8, baseCellSize: 55, timeAddition: 20 }; } else if (level > 140) { params = { rows: 7, cols: 8, baseCellSize: 55, timeAddition: 20 }; } else if (level > 120) { params = { rows: 7, cols: 7, baseCellSize: 56, timeAddition: 15 }; } else if (level > 100) { params = { rows: 7, cols: 7, baseCellSize: 56, timeAddition: 15 }; } else if (level > 80) { params = { rows: 6, cols: 6, baseCellSize: 60, timeAddition: 10 }; } else if (level > 60) { params = { rows: 6, cols: 6, baseCellSize: 60, timeAddition: 10 }; } else if (level > 40) { params = { rows: 5, cols: 5, baseCellSize: 65, timeAddition: 5 }; } else if (level > 20) { params = { rows: 5, cols: 5, baseCellSize: 65, timeAddition: 5 }; } else if (level > 10) { params = { rows: 4, cols: 4, baseCellSize: 70, timeAddition: 0 }; }
            if (level > 280) params.xCells = 20; else if (level > 260) params.xCells = 19 + Math.min(1, level - 261); else if (level > 240) params.xCells = 18 + Math.min(1, level - 241); else if (level > 220) params.xCells = 17 + Math.min(1, level - 221); else if (level > 200) params.xCells = 16 + Math.min(1, level - 201); else if (level > 180) params.xCells = 15 + Math.min(1, level - 181); else if (level > 160) params.xCells = 14 + Math.min(1, level - 161); else if (level > 140) params.xCells = 13 + Math.min(1, level - 141); else if (level > 120) params.xCells = 12 + Math.min(1, level - 121); else if (level > 100) params.xCells = 11 + Math.min(1, level - 101); else if (level > 80) params.xCells = 10 + Math.min(1, level - 81); else if (level > 60) params.xCells = 9 + Math.min(1, level - 61); else if (level > 40) params.xCells = 8 + Math.min(1, level - 41); else if (level > 20) params.xCells = 7 + Math.min(1, level - 21); else if (level > 10) params.xCells = 6;
            const maxPossibleXCells = params.rows * params.cols; params.xCells = Math.min(params.xCells, maxPossibleXCells, 20); if (params.rows * params.cols > 1 && params.xCells < 2) { params.xCells = 2; } else if (params.rows * params.cols === 1) { params.xCells = 1; }
            params.timeLimit = BASE_TIME_LIMIT + params.timeAddition;
            return params;
        },

        startLevel(restoredState = null) {
            this.isGameOver = false; this.isDrawing = false; this.currentPath = []; this.drawnLines.forEach(line => line.remove()); this.drawnLines = []; this.expectedNextValue = 1;
            if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false; this.isPaused = false;
            puzzleGridElement?.classList.remove('paused');
            document.getElementById('pauseOverlay')?.classList.remove('show');

            let initialTime = null;

            if (restoredState) {
                this.level = restoredState.level; this.points = restoredState.points; this.gridRows = restoredState.gridRows; this.gridCols = restoredState.gridCols; this.xCells = restoredState.xCells; this.timeLimit = restoredState.timeLimit; this.expectedNextValue = restoredState.expectedNextValue; this.numberPositions = restoredState.numberPositions;
                const elapsedSeconds = Math.floor((Date.now() - restoredState.saveTimestamp) / 1000); initialTime = restoredState.timeRemaining - elapsedSeconds;
                this.isPaused = restoredState.isPaused ?? false;
            } else {
                const params = this._calculateLevelParams(); this.gridRows = params.rows; this.gridCols = params.cols; this.xCells = params.xCells; this.timeLimit = params.timeLimit; this.numberPositions = {};
            }

            if (initialTime !== null && initialTime <= 0) {
                this.timeRemaining = 0; this.updateUI(); this.handleGameOver("Time ran out while away!", true); puzzleGridElement.innerHTML = '<div class="generating-text">Game Over!</div>'; this.disableInput(); restartGameButton.disabled = false; return;
            }

            const baseCellSizeForLevel = restoredState ? restoredState.calculatedCellSize : this._calculateLevelParams().baseCellSize;
            const containerPadding = 60; const gridBorder = 4; const availableWidth = window.innerWidth - containerPadding - gridBorder; const availableHeight = window.innerHeight * 0.6 - gridBorder; const maxCellWidth = Math.floor(availableWidth / this.gridCols); const maxCellHeight = Math.floor(availableHeight / this.gridRows); this.calculatedCellSize = Math.min(maxCellWidth, maxCellHeight); this.calculatedCellSize = Math.min(this.calculatedCellSize, baseCellSizeForLevel); this.calculatedCellSize = Math.max(MIN_CELL_SIZE, this.calculatedCellSize);

            this.timeRemaining = (initialTime !== null && initialTime > 0) ? Math.floor(initialTime) : this.timeLimit;

            this.updateUI();

            this.stopTimer(); if (nextLevelButton) nextLevelButton.style.display = 'none'; this.disableInput();

            if (restoredState) {
                this._buildGridUIFromState(restoredState);
                if (this.isPaused) { this.updatePauseButton(); puzzleGridElement?.classList.add('paused'); document.getElementById('pauseOverlay')?.classList.add('show'); }
                else { this.startTimer(); }
                this.enableInput();
            } else {
                this.isGenerating = true;
                puzzleGridElement.innerHTML = '<div class="generating-text">Generating Level...<br/>Please Wait</div>';
                puzzleGridElement.style.gridTemplateRows = `repeat(${this.gridRows}, ${this.calculatedCellSize}px)`;
                puzzleGridElement.style.gridTemplateColumns = `repeat(${this.gridCols}, ${this.calculatedCellSize}px)`;
                puzzleGridElement.style.setProperty('--cell-size', `${this.calculatedCellSize}px`);
                this.generatePuzzleAsync();
            }
        },

        updateUI() { if (levelDisplayElement) levelDisplayElement.textContent = `Level: ${this.level}`; this.updatePointsDisplay(); this.updateTimerDisplay(); this.updateSoundButtonIcon(); this.updatePauseButton(); },

        generatePuzzleAsync() {
            if (!window.Worker) { this.showMessage("Error: Browser doesn't support background generation.", "gen_error"); puzzleGridElement.innerHTML = 'Error: Workers not supported!'; this.isGenerating = false; this.enableInput(); return; }
            try { this.pathFindingWorker = new Worker('pathfinder.js'); }
            catch (e) { console.error("Main: Failed to create worker!", e); this.isGenerating = false; this.showMessage("Error creating generation process.", "gen_error"); this.enableInput(); return; }

            this.pathFindingWorker.onmessage = (event) => {
                this.isGenerating = false;
                if (event.data.success) { this._finishPuzzleGeneration(event.data.path); this.startTimer(); this.enableInput(); }
                else { console.error("Main: Path generation failed.", event.data.reason || event.data.error); this.showMessage(`Error generating level (${event.data.reason || 'Error'}). Try resetting.`, "gen_fail", true); puzzleGridElement.innerHTML = '<div class="generating-text">Generation Failed!</div>'; this.disableInput(); restartGameButton.disabled = false; }
                if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; }
            };
            this.pathFindingWorker.onerror = (error) => {
                console.error("Main: Worker error:", error.message, error); this.isGenerating = false;
                this.showMessage(`Generation error (${error.message || 'Worker Error'}). Reset.`, "gen_error", true); puzzleGridElement.innerHTML = '<div class="generating-text">Generation Error!</div>';
                this.disableInput(); restartGameButton.disabled = false; if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; }
            };
            this.pathFindingWorker.postMessage({ gridRows: this.gridRows, gridCols: this.gridCols, maxAttempts: this.MAX_HAMILTONIAN_ATTEMPTS });
        },

        _finishPuzzleGeneration(hamiltonianPath) {
            this.numberPositions = {}; const totalCells = this.gridRows * this.gridCols;
            this.numberPositions[hamiltonianPath[0]] = 1; if (this.xCells > 1) { this.numberPositions[hamiltonianPath[totalCells - 1]] = this.xCells; }
            if (this.xCells > 2) { const intermediateIndices = Array.from({ length: totalCells - 2 }, (_, i) => i + 1); const shuffledIntermediate = this.shuffle(intermediateIndices); const chosenIntermediateIndices = shuffledIntermediate.slice(0, this.xCells - 2).sort((a, b) => a - b); for (let i = 0; i < chosenIntermediateIndices.length; i++) { this.numberPositions[hamiltonianPath[chosenIntermediateIndices[i]]] = i + 2; } }
            this._buildGridUIFromState({ numberPositions: this.numberPositions });
        },

        _buildGridUIFromState(state) {
            puzzleGridElement.innerHTML = '';
            puzzleGridElement.style.gridTemplateRows = `repeat(${this.gridRows}, ${this.calculatedCellSize}px)`;
            puzzleGridElement.style.gridTemplateColumns = `repeat(${this.gridCols}, ${this.calculatedCellSize}px)`;
            puzzleGridElement.style.setProperty('--cell-size', `${this.calculatedCellSize}px`);

            const tempGrid = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(null));
            for (let r = 0; r < this.gridRows; r++) {
                for (let c = 0; c < this.gridCols; c++) {
                    const cell = document.createElement('div'); const cellKey = `${r}-${c}`; const value = state.numberPositions[cellKey] || null;
                    cell.classList.add('cell'); cell.dataset.row = r; cell.dataset.col = c; cell.dataset.value = value !== null ? value : '';
                    cell.style.width = `${this.calculatedCellSize}px`; cell.style.height = `${this.calculatedCellSize}px`; cell.style.fontSize = `${Math.max(0.8, this.calculatedCellSize / 45)}em`;
                    if (value !== null) { const numberElement = document.createElement('span'); numberElement.textContent = value; cell.appendChild(numberElement); }
                    cell.addEventListener('mousemove', this.handleMouseMove.bind(this)); tempGrid[r][c] = cell; puzzleGridElement.appendChild(cell);
                }
            }
            this.currentPuzzle = tempGrid;

            if (state.currentPathData) {
                this.currentPath = state.currentPathData.map(stepData => {
                    const [r, c] = stepData.coords.split('-').map(Number); const cell = this.currentPuzzle?.[r]?.[c]; if (!cell) return null;
                    cell.classList.add('selected'); return { cell: cell, expectedValueBeforeEntering: stepData.expectedValue };
                }).filter(step => step !== null);
                this.redrawLines();
            } else { this.currentPath = []; this.drawnLines = []; }

            this.currentPuzzle.flat().forEach(cell => {
                cell.addEventListener('mousedown', this.handleMouseDown.bind(this));
                cell.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating || this.isPaused) return; const touch = e.touches[0]; const simulatedEvent = { target: touch.target, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseDown(simulatedEvent); }, { passive: true });
            });
        },

        isValid(r, c) { return r >= 0 && r < this.gridRows && c >= 0 && c < this.gridCols; },
        isNeighbor(cell1, cell2) { if (!cell1 || !cell2) return false; const r1 = parseInt(cell1.dataset.row); const c1 = parseInt(cell1.dataset.col); const r2 = parseInt(cell2.dataset.row); const c2 = parseInt(cell2.dataset.col); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; },
        shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },

        handleMouseDown(e) {
            if (this.isGameOver || this.isGenerating || this.isPaused) return;
            const cell = e.target.closest('.cell');
            if (!cell) return;

            const value = parseInt(cell.dataset.value) || null;
            const isPathEmpty = this.currentPath.length === 0;
            const lastPathStep = isPathEmpty ? null : this.currentPath[this.currentPath.length - 1];
            const lastCell = lastPathStep?.cell;

            // Case 1: Starting a new path (Drag)
            if (isPathEmpty && value === 1) {
                this.isDrawing = true; // Start drawing mode
                cell.classList.add('selected');
                this.currentPath.push({ cell: cell, expectedValueBeforeEntering: 1 });
                this.expectedNextValue = 2;
                this.playSound(soundTick);
                this.enableInput();
                return;
            }

            // Case 2: Re-initiating drag from the end
            if (!isPathEmpty && cell === lastCell) {
                this.isDrawing = true; // Re-start drawing mode
                return;
            }

            // Stop drawing mode if clicking elsewhere
            this.isDrawing = false;

            // Case 3: Clicking the second-to-last cell (Undo click)
            if (this.currentPath.length > 1 && cell === this.currentPath[this.currentPath.length - 2].cell) {
                this.undoLastStep(false); // false = not during drag
                return;
            }

            // Case 4: Clicking a potential next cell (Step click)
            if (!isPathEmpty && this.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
                const isValidMove = (value === this.expectedNextValue) || (value === null);
                if (isValidMove) {
                    this.addStep(cell); // Add the step
                } else {
                    this.showMessage(`Path must follow sequence: ${this.expectedNextValue} expected.`, null, true);
                    this.playSound(soundError);
                }
                return;
            }

            // Case 5: Clicking non-adjacent cell
            if (!isPathEmpty && !this.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
                this.showMessage("Must select an adjacent cell.", null, true);
                this.playSound(soundError);
                return;
            }

            // Case 6: Clicking already selected cell (not last or second-to-last)
            if (!isPathEmpty && cell.classList.contains('selected') && cell !== lastCell) {
                // Do nothing, maybe show a subtle message if desired, but generally ignore
                // this.showMessage("Cell already in path.", null, true);
                // this.playSound(soundError);
                return;
            }


            // Case 7: Invalid start click (not on '1')
            if (isPathEmpty && value !== 1) {
                this.showMessage("Path must start on number 1!", null, true);
                this.playSound(soundError);
                return;
            }
        },

        handleMouseMove(e) {
            if (!this.isDrawing || this.isGameOver || this.isGenerating || this.isPaused) return;

            const gridRect = puzzleGridElement.getBoundingClientRect();
            // Use clientX/clientY for consistent coordinates relative to viewport
            const mouseX = e.clientX - gridRect.left;
            const mouseY = e.clientY - gridRect.top;

            // Calculate row and column based on mouse position within the grid
            const col = Math.floor(mouseX / this.calculatedCellSize);
            const row = Math.floor(mouseY / this.calculatedCellSize);

            // Ensure row and col are within valid grid bounds
            if (!this.isValid(row, col)) return;
            const currentCell = this.currentPuzzle?.[row]?.[col];
            if (!currentCell) return; // Exit if the calculated cell doesn't exist

            const lastPathStep = this.currentPath.length > 0 ? this.currentPath[this.currentPath.length - 1] : null;
            const lastCell = lastPathStep?.cell;

            if (!lastCell || currentCell === lastCell) return; // No last cell or hovering over the same cell

            // Undo Drag Logic: If moving back to the second-to-last cell
            if (this.currentPath.length > 1 && currentCell === this.currentPath[this.currentPath.length - 2].cell) {
                this.undoLastStep(true); // true = during drag
            }
            // Forward Drag Logic: If moving to a new, adjacent, unselected cell
            else if (!currentCell.classList.contains('selected') && this.isNeighbor(lastCell, currentCell)) {
                const currentValue = parseInt(currentCell.dataset.value) || null;
                const isValidMove = (currentValue === this.expectedNextValue) || (currentValue === null);
                if (isValidMove) {
                    this.addStep(currentCell); // Add the step using the new function
                }
                // Do not show error messages during drag for invalid sequence moves, just don't add the step.
            }
        },

        handleMouseUp() {
            // Stop drawing mode only if it was active
            if (this.isDrawing) {
                this.isDrawing = false;
                // Check win condition potentially completed by the drag ending
                if (!this.isGameOver && this.currentPath.length === (this.gridRows * this.gridCols)) {
                    this.checkWinCondition();
                }
            }
        },

        // New function to handle adding a step (used by both click and drag)
        addStep(cell) {
            const lastCell = this.currentPath[this.currentPath.length - 1].cell;
            const currentValue = parseInt(cell.dataset.value) || null;
            const previousExpectedValue = this.expectedNextValue; // Store before potential change

            cell.classList.add('selected');
            this.drawLine(lastCell, cell);
            this.currentPath.push({ cell: cell, expectedValueBeforeEntering: previousExpectedValue });
            this.enableInput();

            if (currentValue === previousExpectedValue) { // Moved onto the expected number
                this.playSound(soundTick);
                this.expectedNextValue++;
            } else {
                // Play sound only if clicking, not during drag for empty cells
                if (!this.isDrawing) {
                    this.playSound(soundTick);
                }
            }

            // Check win condition immediately after adding a step
            if (this.currentPath.length === (this.gridRows * this.gridCols)) {
                this.checkWinCondition();
            }
        },


        handleUndo() { if (this.isGameOver || this.isGenerating || this.isDrawing || this.isPaused) return; if (this.currentPath.length > 1) { this.undoLastStep(false); this.enableInput(); } else { this.showMessage("Cannot undo further.", null, true); this.playSound(soundError); } },
        handleResetLevel() { if (this.isGenerating || this.isGameOver || this.isPaused) return; if (this.level > 1 && this.points < RESET_PENALTY) { this.showMessage(`Need ${RESET_PENALTY} points to reset!`, null, true); this.playSound(soundError); return; } let penaltyMsg = ""; if (this.level > 1) { this.points = Math.max(0, this.points - RESET_PENALTY); this.savePoints(); this.updatePointsDisplay(); penaltyMsg = `(-${RESET_PENALTY} Points)`; } this.clearFullGameState(); this.stopTimer(); if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.startLevel(); this.showMessage(`Level Reset! ${penaltyMsg}`); },
        handleNextLevel() { if (this.isGenerating || !this.isGameOver || this.isPaused) return; const lastCell = this.currentPath?.[this.currentPath.length - 1]?.cell; const lastCellValue = lastCell ? parseInt(lastCell.dataset.value) : NaN; if (lastCellValue === this.xCells) { this.clearFullGameState(); this.level++; this.saveLevel(); this.startLevel(); } else { this.showMessage("Win condition error."); } },
        handleRestartGame() { if (!this.isPaused) this.pauseGame(false); this.showRestartModal(); },
        handleSoundToggle() { this.isMuted = !this.isMuted; this.saveSoundPreference(); this.updateSoundButtonIcon(); if (!this.isMuted) { this.playSound(soundTick, true); } },
        handleClearPath() { if (this.isGameOver || this.isGenerating || this.isDrawing || this.isPaused) return; if (this.currentPath.length === 0) { this.showMessage("Nothing to clear.", null, true); return; } this.currentPath.forEach(step => step.cell.classList.remove('selected')); this.drawnLines.forEach(line => line.remove()); this.currentPath = []; this.drawnLines = []; this.expectedNextValue = 1; this.playSound(soundError); this.enableInput(); },
        handlePauseToggle() { if (this.isGameOver || this.isGenerating) return; if (this.isPaused) { this.continueGame(); } else { this.pauseGame(); } },

        pauseGame() {
            if (this.isPaused || this.isGameOver || this.isGenerating) return;
            this.isDrawing = false; // Stop drawing if paused mid-drag
            this.isPaused = true; this.stopTimer();
            puzzleGridElement?.classList.add('paused');
            document.getElementById('pauseOverlay')?.classList.add('show');
            this.showMessage('Game Paused');
            this.saveFullGameState(); this.updatePauseButton(); this.enableInput();
        },
        continueGame() {
            if (!this.isPaused || this.isGameOver || this.isGenerating) return;
            this.isPaused = false;
            puzzleGridElement?.classList.remove('paused');
            document.getElementById('pauseOverlay')?.classList.remove('show');
            this.showMessage('Game Continued'); this.startTimer(); this.updatePauseButton(); this.enableInput();
        },

        performRestart() { this.clearFullGameState(); if (this.isGenerating) { if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false; } this.stopTimer(); this.level = 1; this.points = 0; this.savePoints(); this.saveLevel(); this.startLevel(); this.showMessage("Game Restarted!"); },
        showRestartModal() { if (restartModalOverlay) restartModalOverlay.classList.add('show'); },
        hideRestartModal() { if (restartModalOverlay) restartModalOverlay.classList.remove('show'); },

        drawLine(fromCell, toCell) { if (!puzzleGridElement) return; const lineThickness = Math.max(8, this.calculatedCellSize * 0.18); const gridRect = puzzleGridElement.getBoundingClientRect(); const fromRect = fromCell.getBoundingClientRect(); const toRect = toCell.getBoundingClientRect(); const x1 = (fromRect.left + fromRect.width / 2) - gridRect.left; const y1 = (fromRect.top + fromRect.height / 2) - gridRect.top; const x2 = (toRect.left + toRect.width / 2) - gridRect.left; const y2 = (toRect.top + toRect.height / 2) - gridRect.top; const length = Math.hypot(x2 - x1, y2 - y1); const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI); const line = document.createElement('div'); line.classList.add('line'); line.style.width = `${length}px`; line.style.height = `${lineThickness}px`; line.style.borderRadius = `${lineThickness / 2}px`; line.style.transformOrigin = '0 50%'; line.style.transform = `rotate(${angle}deg)`; line.style.left = `${x1}px`; line.style.top = `${y1 - lineThickness / 2}px`; puzzleGridElement.appendChild(line); this.drawnLines.push(line); },
        redrawLines() { this.drawnLines.forEach(line => line.remove()); this.drawnLines = []; if (this.currentPath.length > 1) { for (let i = 1; i < this.currentPath.length; i++) { this.drawLine(this.currentPath[i - 1].cell, this.currentPath[i].cell); } } },
        undoLastStep(isDuringDrag) { if (this.currentPath.length <= 1) return; const removedStep = this.currentPath.pop(); removedStep.cell.classList.remove('selected'); const lastLine = this.drawnLines.pop(); if (lastLine) lastLine.remove(); this.expectedNextValue = removedStep.expectedValueBeforeEntering; if (!isDuringDrag) this.playSound(soundTick); }, // Play sound only on explicit undo click/button

        checkWinCondition() { if (this.isGameOver) return; const totalCells = this.gridRows * this.gridCols; const pathLength = this.currentPath.length; if (pathLength !== totalCells) return; const correctSequence = this.expectedNextValue > this.xCells; const lastCell = this.currentPath[pathLength - 1].cell; const lastVal = parseInt(lastCell.dataset.value); const endCorrect = lastVal === this.xCells; if (correctSequence && endCorrect) { this.clearFullGameState(); this.isGameOver = true; this.stopTimer(); this.points += this.level * 10 + Math.max(0, this.timeRemaining); this.savePoints(); this.updatePointsDisplay(); this.showMessage(`Level ${this.level} Complete! Points: ${this.points}`); this.playSound(soundWin); this.disableInput(); if (nextLevelButton) { nextLevelButton.style.display = 'inline-block'; nextLevelButton.disabled = false; } restartGameButton.disabled = false; } else { if (!endCorrect) { this.showMessage(`Path must end on ${this.xCells}.`, null, true); this.playSound(soundError); } else if (!correctSequence) { this.showMessage(`Connect numbers 1 to ${this.xCells}.`, null, true); this.playSound(soundError); } if (nextLevelButton) nextLevelButton.style.display = 'none'; } },

        startTimer() { this.stopTimer(); if (this.isGameOver || this.isGenerating || this.timeRemaining <= 0 || this.isPaused) return; this.updateTimerDisplay(); this.timerInterval = setInterval(() => { this.timeRemaining--; this.updateTimerDisplay(); if (this.timeRemaining <= 0) { this.handleGameOver("Time's up!"); } }, 1000); },
        stopTimer() { clearInterval(this.timerInterval); this.timerInterval = null; },
        updateTimerDisplay() { const minutes = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0'); const seconds = String(this.timeRemaining % 60).padStart(2, '0'); if (timerElement) timerElement.textContent = `Time: ${minutes}:${seconds}`; },

        handleGameOver(reason, fromLoad = false) { if (this.isGameOver) return; this.isGameOver = true; this.stopTimer(); this.isDrawing = false; this.clearFullGameState(); this.disableInput(); if (nextLevelButton) nextLevelButton.style.display = 'none'; this.showMessage(reason + " Game Over!"); this.playSound(soundLose); restartGameButton.disabled = false; if (reason === "Time's up!") { this.saveLevel(1); this.savePoints(0); } },

        updatePointsDisplay() { if (pointsDisplayElement) pointsDisplayElement.textContent = `Points: ${this.points}`; },
        savePoints(newPoints = this.points) { try { this.points = Math.max(0, newPoints); localStorage.setItem('zipItHighPoints', this.points.toString()); this.updatePointsDisplay(); } catch (e) { console.warn("Could not save points:", e); } },
        loadPoints() { try { const savedPoints = localStorage.getItem('zipItHighPoints'); this.points = savedPoints ? parseInt(savedPoints, 10) : 0; if (isNaN(this.points)) this.points = 0; } catch (e) { this.points = 0; console.warn("Could not load points:", e); } this.updatePointsDisplay(); },
        saveLevel(newLevel = this.level) { try { this.level = newLevel; localStorage.setItem('zipItCurrentLevel', this.level.toString()); } catch (e) { console.warn("Could not save level:", e); } },
        loadLevel() { try { const savedLevel = localStorage.getItem('zipItCurrentLevel'); const parsedLevel = savedLevel ? parseInt(savedLevel, 10) : 1; this.level = (parsedLevel && parsedLevel > 0) ? parsedLevel : 1; } catch (e) { this.level = 1; console.warn("Could not load level:", e); } },
        saveSoundPreference() { try { localStorage.setItem('zipItSoundMuted', this.isMuted ? 'true' : 'false'); } catch (e) { console.warn("Could not save sound pref:", e); } },
        loadSoundPreference() { try { const savedMuted = localStorage.getItem('zipItSoundMuted'); this.isMuted = savedMuted === 'true'; } catch (e) { this.isMuted = false; console.warn("Could not load sound pref:", e); } this.updateSoundButtonIcon(); },

        saveFullGameState() { if (this.isGameOver || this.isGenerating) { this.clearFullGameState(); return; } try { const pathData = this.currentPath.map(step => ({ coords: `${step.cell.dataset.row}-${step.cell.dataset.col}`, expectedValue: step.expectedValueBeforeEntering })); const stateToSave = { level: this.level, points: this.points, gridRows: this.gridRows, gridCols: this.gridCols, xCells: this.xCells, calculatedCellSize: this.calculatedCellSize, timeLimit: this.timeLimit, timeRemaining: this.timeRemaining, saveTimestamp: Date.now(), expectedNextValue: this.expectedNextValue, numberPositions: this.numberPositions, currentPathData: pathData, isMuted: this.isMuted, isPaused: this.isPaused }; localStorage.setItem(STORAGE_KEY_GAME_STATE, JSON.stringify(stateToSave)); } catch (e) { console.warn("Could not save full game state:", e); } },
        loadFullGameState() { let restoredState = null; try { const savedStateJSON = localStorage.getItem(STORAGE_KEY_GAME_STATE); if (savedStateJSON) { const parsedState = JSON.parse(savedStateJSON); if (parsedState && typeof parsedState.level === 'number' && typeof parsedState.points === 'number' && typeof parsedState.timeRemaining === 'number') { restoredState = parsedState; this.clearFullGameState(); } else { this.clearFullGameState(); } } } catch (e) { this.clearFullGameState(); console.warn("Could not load full game state:", e); } if (restoredState) { this.startLevel(restoredState); } else { this.loadPoints(); this.loadLevel(); this.startLevel(); } },
        clearFullGameState() { try { localStorage.removeItem(STORAGE_KEY_GAME_STATE); } catch (e) { console.warn("Could not clear game state:", e); } },

        disableInput() { undoButton.disabled = true; clearPathButton.disabled = true; resetLevelButton.disabled = true; pauseButton.disabled = true; restartGameButton.disabled = false; nextLevelButton.disabled = true; },
        enableInput() { const canInteract = !this.isGameOver && !this.isGenerating && !this.isPaused; const canPause = !this.isGameOver && !this.isGenerating; const isGameWon = this.isGameOver && this.currentPath.length === (this.gridRows * this.gridCols); undoButton.disabled = !canInteract || this.currentPath.length <= 1; clearPathButton.disabled = !canInteract || this.currentPath.length === 0; resetLevelButton.disabled = !canInteract || (this.level > 1 && this.points < RESET_PENALTY); pauseButton.disabled = !canPause; restartGameButton.disabled = false; nextLevelButton.disabled = !isGameWon; if (nextLevelButton) { nextLevelButton.style.display = isGameWon ? 'inline-block' : 'none'; } },

        getPathValues() { if (!this.currentPath?.length) return ""; try { return this.currentPath.map(step => step?.cell?.dataset?.value || 'E').join(' -> '); } catch (e) { return "Error"; } },
        showMessage(message, id = null, debounce = false) { const now = Date.now(); if (debounce && message === this.lastMessage.text && (now - this.lastMessage.timestamp < MIN_MSG_INTERVAL)) return; this.lastMessage.text = message; this.lastMessage.timestamp = now; if (id) this.hideMessage(id); const mb = document.createElement('div'); mb.className = 'message-box'; if (id) mb.dataset.messageId = id; const mt = document.createElement('span'); mt.textContent = message; const cb = document.createElement('button'); cb.className = 'close-button'; cb.innerHTML = '×'; cb.setAttribute('aria-label', 'Close message'); const closeMsg = () => { if (mb.parentElement) { mb.classList.add('hide'); mb.addEventListener('transitionend', () => mb.remove(), { once: true }); } }; cb.onclick = closeMsg; mb.append(mt, cb); messageContainer.appendChild(mb); requestAnimationFrame(() => requestAnimationFrame(() => mb.classList.add('show'))); const autoClose = setTimeout(closeMsg, MSG_DISPLAY_TIME); cb.addEventListener('click', () => clearTimeout(autoClose)); },
        hideMessage(id) { const msg = messageContainer.querySelector(`.message-box[data-message-id="${id}"]`); if (msg) msg.querySelector('.close-button')?.click(); },
        playSound(audioElement, forcePlay = false) { if (this.isMuted && !forcePlay) return; if (audioElement) { audioElement.currentTime = 0; audioElement.play().catch(e => { console.warn("Audio play failed:", e.name); }); } },
        updateSoundButtonIcon() { if (soundToggleButton) { soundToggleButton.textContent = this.isMuted ? "Sound: Off" : "Sound: On"; soundToggleButton.title = this.isMuted ? "Unmute Sounds" : "Mute Sounds"; } },
        updatePauseButton() { if (pauseButton) { pauseButton.textContent = this.isPaused ? "Continue" : "Pause"; } },

        addEventListeners() {
            undoButton?.addEventListener('click', this.handleUndo.bind(this));
            clearPathButton?.addEventListener('click', this.handleClearPath.bind(this));
            resetLevelButton?.addEventListener('click', this.handleResetLevel.bind(this));
            restartGameButton?.addEventListener('click', this.handleRestartGame.bind(this));
            pauseButton?.addEventListener('click', this.handlePauseToggle.bind(this));
            nextLevelButton?.addEventListener('click', this.handleNextLevel.bind(this));
            soundToggleButton?.addEventListener('click', this.handleSoundToggle.bind(this));
            modalConfirmRestart?.addEventListener('click', () => { this.hideRestartModal(); this.performRestart(); });
            modalCancelRestart?.addEventListener('click', this.hideRestartModal.bind(this));
            restartModalOverlay?.addEventListener('click', (event) => { if (event.target === restartModalOverlay) this.hideRestartModal(); });

            // Mouse events
            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
            document.addEventListener('mouseleave', this.handleMouseUp.bind(this)); // Handle mouse leaving window
            document.addEventListener('dragstart', (e) => e.preventDefault()); // Prevent default drag behavior

            // Touch events
            let isTouching = false; // Track touch state specifically for touch events
            puzzleGridElement?.addEventListener('touchstart', (e) => {
                if (this.isGameOver || this.isGenerating || this.isPaused) return;
                const touch = e.touches[0];
                // Find the element directly under the touch point
                const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                const cell = targetElement?.closest('.cell');
                if (cell) {
                    isTouching = true;
                    // Simulate a mousedown event for consistent handling
                    this.handleMouseDown({ target: cell, clientX: touch.clientX, clientY: touch.clientY });
                    // e.preventDefault(); // Prevent potential scrolling/zooming ONLY if a cell interaction started
                } else {
                    isTouching = false;
                }
            }, { passive: false }); // Need passive: false to potentially preventDefault

            document.addEventListener('touchmove', (e) => {
                if (!isTouching || this.isGenerating || this.isPaused) return; // Only proceed if a touch started on the grid and game is active
                if (this.isDrawing) { // Only prevent scroll if actively drawing a path
                    e.preventDefault();
                }
                const touch = e.touches[0];
                // Find the element currently under the touch point
                const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                // Simulate a mousemove event
                this.handleMouseMove({ target: targetElement, clientX: touch.clientX, clientY: touch.clientY });

            }, { passive: false }); // Needs passive: false to preventDefault during drawing

            document.addEventListener('touchend', (e) => {
                if (!isTouching) return; // Only process if the touch started on the grid
                isTouching = false;
                this.handleMouseUp(); // Use the same logic as mouseup
            });

            document.addEventListener('touchcancel', (e) => {
                if (!isTouching) return; // Only process if the touch started on the grid
                isTouching = false;
                this.handleMouseUp(); // Treat cancel like touchend/mouseup
            });

            window.addEventListener('beforeunload', () => this.saveFullGameState());
            document.addEventListener('visibilitychange', () => { if (document.hidden && !this.isGameOver && !this.isGenerating && !this.isPaused) { this.pauseGame(false); } });
        }

    };

    game.init();

});