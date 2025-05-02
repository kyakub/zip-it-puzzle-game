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
    const restartModalOverlay = document.getElementById('restartModalOverlay');
    const modalConfirmRestart = document.getElementById('modalConfirmRestart');
    const modalCancelRestart = document.getElementById('modalCancelRestart');

    // --- Audio Elements ---
    const soundTick = document.getElementById('soundTick');
    const soundError = document.getElementById('soundError');
    const soundWin = document.getElementById('soundWin');
    const soundLose = document.getElementById('soundLose');

    // --- Game Configuration ---
    const MSG_DISPLAY_TIME = 5000;
    const BASE_TIME_LIMIT = 100;
    const CELL_SIZE = 60;
    const MAX_HAMILTONIAN_ATTEMPTS = 25;

    // --- Game State Object ---
    const game = {
        level: 1,
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
        pathFindingWorker: null,
        isGenerating: false,

        // --- Game Methods ---

        init() {
            this.loadScore();
            this.loadLevel();
            this.addEventListeners();
            this.startLevel();
        },

        startLevel() {
            console.log(`--- Starting Level ${this.level} ---`);
            this.isGameOver = false; this.isDrawing = false; this.currentPath = []; this.drawnLines.forEach(line => line.remove()); this.drawnLines = []; this.expectedNextValue = 1;
            if (this.pathFindingWorker) { console.log("Terminating previous worker."); this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false;

            // Difficulty Calculation
            const baseGridSize = 5; const gridSizeIncrease = Math.floor((this.level - 1) / 15); this.gridSize = Math.min(8, baseGridSize + gridSizeIncrease);
            const baseXCells = 5; const xCellsIncrease = Math.floor((this.level - 1) / 10); const targetXCells = baseXCells + xCellsIncrease; this.xCells = Math.min(14, targetXCells);
            const maxPossibleXCells = this.gridSize * this.gridSize; this.xCells = Math.min(this.xCells, maxPossibleXCells);
            if (this.gridSize > 1 && this.xCells < 2) { this.xCells = 2; } else if (this.gridSize === 1) { this.xCells = 1; }
            const timePerLevel = 3; const timeGridFactor = this.gridSize * 6; const timeCellsFactor = this.xCells * 3; this.timeLimit = Math.max(30, BASE_TIME_LIMIT + timeGridFactor + timeCellsFactor + (this.level - 1) * timePerLevel);
            console.log(`Level ${this.level} Params: Grid ${this.gridSize}x${this.gridSize}, Numbers ${this.xCells}, Time ${this.timeLimit}s`);

            this.updateUI();

            // Initiate Async Puzzle Generation
            this.isGenerating = true; this.showMessage("Generating level...", "gen_level"); puzzleGridElement.innerHTML = '<div class="generating-text">Generating Level... Please Wait</div>'; puzzleGridElement.style.gridTemplateColumns = `repeat(${this.gridSize}, ${CELL_SIZE}px)`; puzzleGridElement.style.gridTemplateRows = `repeat(${this.gridSize}, ${CELL_SIZE}px)`; this.disableInput(); if (nextLevelButton) nextLevelButton.style.display = 'none'; this.stopTimer();
            this.generatePuzzleAsync();
        },

        updateUI() {
            levelDisplayElement.textContent = `Level: ${this.level}`;
            scoreElement.textContent = `Score: ${this.score}`;
            this.updateTimerDisplay();
        },

        generatePuzzleAsync() {
            if (!window.Worker) { console.error("Web Workers not supported!"); this.showMessage("Error: Browser doesn't support background generation.", "gen_error"); puzzleGridElement.innerHTML = 'Error: Workers not supported!'; this.isGenerating = false; this.enableInput(); return; }

            this.pathFindingWorker = new Worker('pathfinder.js'); console.log("Main: Worker created.");

            // Handle messages from worker
            this.pathFindingWorker.onmessage = (event) => {
                console.log("Main: Message received from worker:", event.data);
                this.isGenerating = false; this.hideMessage("gen_level");

                if (event.data.success) {
                    this._finishPuzzleGeneration(event.data.path);
                    this.startTimer();
                    this.enableInput();
                } else {
                    console.error("Main: Path generation failed in worker.", event.data.reason || event.data.error);
                    this.showMessage(`Error: Could not generate level (${event.data.reason || event.data.error || 'Unknown worker error'}). Try resetting.`, "gen_fail");
                    puzzleGridElement.innerHTML = '<div class="generating-text">Generation Failed!</div>';
                    this.disableInput(); restartGameButton.disabled = false;
                }
                if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; console.log("Main: Worker terminated after completion."); }
            };

            // Handle errors from worker
            this.pathFindingWorker.onerror = (error) => {
                console.error("Main: Error received from worker:", error.message, error);
                this.isGenerating = false; this.hideMessage("gen_level");
                this.showMessage(`Error: Generation failed (${error.message || 'Worker script error'}). Please reset.`, "gen_error");
                puzzleGridElement.innerHTML = '<div class="generating-text">Generation Error!</div>';
                this.disableInput(); restartGameButton.disabled = false;
                if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; }
            };

            // Send task to worker
            console.log("Main: Posting task to worker...");
            this.pathFindingWorker.postMessage({ gridSize: this.gridSize, maxAttempts: MAX_HAMILTONIAN_ATTEMPTS });
        },

        // Builds the grid UI after path is received from worker
        _finishPuzzleGeneration(hamiltonianPath) {
            console.log("Main: Finishing puzzle generation with received path.");
            puzzleGridElement.innerHTML = '';

            // Place Numbers based on path and xCells
            const numberPositions = {}; const totalCells = this.gridSize * this.gridSize;
            numberPositions[hamiltonianPath[0]] = 1; if (this.xCells > 1) { numberPositions[hamiltonianPath[totalCells - 1]] = this.xCells; }
            if (this.xCells > 2) { const intermediateIndices = Array.from({ length: totalCells - 2 }, (_, i) => i + 1); const shuffledIntermediate = this.shuffle(intermediateIndices); const chosenIntermediateIndices = shuffledIntermediate.slice(0, this.xCells - 2).sort((a, b) => a - b); for (let i = 0; i < chosenIntermediateIndices.length; i++) { numberPositions[hamiltonianPath[chosenIntermediateIndices[i]]] = i + 2; } }
            console.log("Number positions:", numberPositions);

            // Create Grid Cell Elements
            const tempGrid = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(null));
            for (let r = 0; r < this.gridSize; r++) {
                for (let c = 0; c < this.gridSize; c++) {
                    const cell = document.createElement('div'); const cellKey = `${r}-${c}`; const value = numberPositions[cellKey] || null;
                    cell.classList.add('cell'); cell.dataset.row = r; cell.dataset.col = c; cell.dataset.value = value !== null ? value : ''; cell.style.width = `${CELL_SIZE}px`; cell.style.height = `${CELL_SIZE}px`;
                    if (value !== null) { const numberElement = document.createElement('span'); numberElement.textContent = value; cell.appendChild(numberElement); }
                    cell.addEventListener('mousemove', this.handleMouseMove.bind(this)); tempGrid[r][c] = cell; puzzleGridElement.appendChild(cell);
                }
            }
            this.currentPuzzle = tempGrid;
            // Add interaction listeners after grid is fully built
            this.currentPuzzle.flat().forEach(cell => {
                cell.addEventListener('mousedown', this.handleMouseDown.bind(this));
                cell.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating) return; const touch = e.touches[0]; const simulatedEvent = { target: touch.target, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseDown(simulatedEvent); }, { passive: true });
            });
            console.log("Main: Puzzle grid created successfully.");
        },

        // --- Core Utility Functions ---
        isValid(r, c) { return r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize; },
        isNeighbor(cell1, cell2) { if (!cell1 || !cell2) return false; const r1 = parseInt(cell1.dataset.row); const c1 = parseInt(cell1.dataset.col); const r2 = parseInt(cell2.dataset.row); const c2 = parseInt(cell2.dataset.col); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; },
        shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },

        // --- Input Event Handlers ---
        handleMouseDown(e) {
            if (this.isGameOver || this.isDrawing || this.isGenerating) return;
            const cell = e.target.closest('.cell'); if (!cell) return;
            const value = parseInt(cell.dataset.value) || null; const isPathEmpty = this.currentPath.length === 0; const lastPathStep = isPathEmpty ? null : this.currentPath[this.currentPath.length - 1];
            if (isPathEmpty && value === 1) { this.isDrawing = true; cell.classList.add('selected'); this.currentPath.push({ cell: cell, expectedValueBeforeEntering: 1 }); this.expectedNextValue = 2; this.playSound(soundTick); console.log("Path started:", this.getPathValues()); }
            else if (!isPathEmpty && cell === lastPathStep.cell) { this.isDrawing = true; console.log("Resuming draw from cell:", value ?? 'Empty'); }
            else if (isPathEmpty && value !== 1) { this.showMessage("Path must start on number 1!"); this.playSound(soundError); }
            else { console.log("Click ignored."); }
        },
        handleMouseMove(e) {
            if (!this.isDrawing || this.isGameOver || this.isGenerating) return;
            const gridRect = puzzleGridElement.getBoundingClientRect(); const mouseX = e.clientX - gridRect.left; const mouseY = e.clientY - gridRect.top; const col = Math.floor(mouseX / CELL_SIZE); const row = Math.floor(mouseY / CELL_SIZE);
            if (!this.isValid(row, col)) return; if (!this.currentPuzzle?.[row]?.[col]) return; const currentCell = this.currentPuzzle[row][col];
            const lastPathStep = this.currentPath.length > 0 ? this.currentPath[this.currentPath.length - 1] : null; const lastCell = lastPathStep?.cell; if (!lastCell || currentCell === lastCell) return;

            if (this.currentPath.length > 1 && currentCell === this.currentPath[this.currentPath.length - 2].cell) { this.undoLastStep(true); } // Handle drag backtrack
            else if (!currentCell.classList.contains('selected') && this.isNeighbor(lastCell, currentCell)) { // Handle forward move
                const currentValue = parseInt(currentCell.dataset.value) || null; let isValidMove = false; let isMovingToExpectedNumber = false;
                if (currentValue === this.expectedNextValue) { isValidMove = true; isMovingToExpectedNumber = true; } else if (currentValue === null) { isValidMove = true; }
                if (isValidMove) {
                    const previousExpectedValue = this.expectedNextValue; currentCell.classList.add('selected'); this.drawLine(lastCell, currentCell); this.currentPath.push({ cell: currentCell, expectedValueBeforeEntering: previousExpectedValue });
                    if (isMovingToExpectedNumber) { this.playSound(soundTick); this.expectedNextValue++; if (currentValue === this.xCells) { console.log("Last required number reached."); } }
                    if (this.currentPath.length === this.gridSize * this.gridSize) { this.checkWinCondition(); } // Check win only when grid full
                }
            }
        },
        handleMouseUp() {
            if (this.isDrawing) { this.isDrawing = false; console.log("Mouse up, drawing stopped. Final path:", this.getPathValues()); if (this.currentPath.length === this.gridSize * this.gridSize) { this.checkWinCondition(); } }
        },

        // --- Button Control Handlers ---
        handleUndo() { if (this.isGameOver || this.isGenerating) return; if (this.isDrawing) { this.showMessage("Cannot undo while drawing."); return; } if (this.currentPath.length > 1) { this.undoLastStep(false); console.log("Undo button pressed:", this.getPathValues()); } else { this.showMessage("Cannot undo further."); this.playSound(soundError); } },
        handleResetLevel() { if (this.isGenerating) { this.showMessage("Please wait for level generation."); return; } if (this.isGameOver && this.currentPath.length === this.gridSize * this.gridSize) { this.showMessage("Level complete."); return; } console.log(`Resetting Level ${this.level}`); this.stopTimer(); if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.startLevel(); this.showMessage(`Level ${this.level} Reset!`); },
        handleNextLevel() { if (this.isGenerating) return; if (this.isGameOver && this.currentPath.length === this.gridSize * this.gridSize) { const lastCell = this.currentPath[this.currentPath.length - 1].cell; const lastCellValue = parseInt(lastCell.dataset.value); if (lastCellValue === this.xCells) { this.level++; this.saveLevel(); this.startLevel(); } else { this.showMessage("Error: Win condition mismatch."); } } else if (this.isGameOver) { this.showMessage("Level not completed successfully."); } else { this.showMessage("Complete the current level first!"); } },
        handleRestartGame() { console.log("Restart Game button clicked - showing modal."); this.showRestartModal(); }, // Shows modal

        // --- Restart Logic ---
        performRestart() {
            console.log("Performing game restart...");
            if (this.isGenerating) { if (this.pathFindingWorker) { console.log("Terminating worker due to confirmed game restart."); this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false; }
            this.stopTimer(); this.level = 1; this.score = 0; this.saveScore(); this.saveLevel(); this.startLevel(); this.showMessage("Game Restarted!");
        },

        // --- Modal Controls ---
        showRestartModal() { if (restartModalOverlay) { restartModalOverlay.classList.add('show'); } else { console.error("Restart modal overlay not found!"); } },
        hideRestartModal() { if (restartModalOverlay) { restartModalOverlay.classList.remove('show'); } },

        // --- Game Logic Helpers ---
        drawLine(fromCell, toCell) { const NEW_LINE_HEIGHT = 12; const gridRect = puzzleGridElement.getBoundingClientRect(); const fromRect = fromCell.getBoundingClientRect(); const toRect = toCell.getBoundingClientRect(); const x1 = fromRect.left + fromRect.width / 2 - gridRect.left; const y1 = fromRect.top + fromRect.height / 2 - gridRect.top; const x2 = toRect.left + toRect.width / 2 - gridRect.left; const y2 = toRect.top + toRect.height / 2 - gridRect.top; const length = Math.hypot(x2 - x1, y2 - y1); const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI); const line = document.createElement('div'); line.classList.add('line'); line.style.width = `${length}px`; line.style.transformOrigin = '0 50%'; line.style.transform = `rotate(${angle}deg)`; line.style.left = `${x1}px`; line.style.top = `${y1 - NEW_LINE_HEIGHT / 2}px`; if (puzzleGridElement) { puzzleGridElement.appendChild(line); this.drawnLines.push(line); } else { console.error("drawLine: puzzleGridElement not found!"); } },
        undoLastStep(isDuringDrag) { if (this.currentPath.length <= 1) return; const removedStep = this.currentPath.pop(); removedStep.cell.classList.remove('selected'); const lastLine = this.drawnLines.pop(); if (lastLine) { lastLine.remove(); } else { console.warn("undoLastStep: No matching line found."); } this.expectedNextValue = removedStep.expectedValueBeforeEntering; if (!isDuringDrag) this.playSound(soundTick); },

        // --- Win Condition Check ---
        checkWinCondition() {
            if (this.isGameOver) return;
            const totalCellsInGrid = this.gridSize * this.gridSize; const pathLength = this.currentPath.length; const pathCoversAllCells = pathLength === totalCellsInGrid; if (!pathCoversAllCells) { return; }
            const correctNumberSequenceFollowed = this.expectedNextValue > this.xCells; const lastCell = this.currentPath[pathLength - 1].cell; const lastCellValue = parseInt(lastCell.dataset.value); const isLastCellCorrectNumber = lastCellValue === this.xCells;
            console.log(`checkWinCondition Results: CoveredAll=${pathCoversAllCells}, CorrectSeq=${correctNumberSequenceFollowed}, LastCellOk (${this.xCells})=${isLastCellCorrectNumber} (Val: ${lastCellValue})`);
            if (pathCoversAllCells && correctNumberSequenceFollowed && isLastCellCorrectNumber) {
                console.log("Win condition MET!"); this.isGameOver = true; this.stopTimer(); this.score += this.level * 10 + Math.max(0, this.timeRemaining); this.saveScore(); this.updateUI(); this.showMessage(`Level ${this.level} Complete! Score: ${this.score}`); this.playSound(soundWin); this.disableInput(); if (nextLevelButton) { nextLevelButton.style.display = 'inline-block'; console.log("Next Level button displayed."); } else { console.error("checkWinCondition: nextLevelButton element not found!"); } restartGameButton.disabled = false;
            } else {
                console.log("Win condition NOT MET."); if (pathCoversAllCells && !isLastCellCorrectNumber && correctNumberSequenceFollowed) { this.showMessage(`Almost! The path must end on number ${this.xCells}.`); } else if (pathCoversAllCells && !correctNumberSequenceFollowed) { this.showMessage(`Keep going! Make sure you connect all numbers from 1 to ${this.xCells}.`); } if (nextLevelButton) { nextLevelButton.style.display = 'none'; }
            }
        },

        // --- Timer ---
        startTimer() { this.stopTimer(); this.timeRemaining = this.timeLimit; this.updateTimerDisplay(); this.timerInterval = setInterval(() => { this.timeRemaining--; this.updateTimerDisplay(); if (this.timeRemaining <= 0) { this.handleGameOver("Time's up!"); } }, 1000); },
        stopTimer() { clearInterval(this.timerInterval); this.timerInterval = null; },
        updateTimerDisplay() { const minutes = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0'); const seconds = String(this.timeRemaining % 60).padStart(2, '0'); timerElement.textContent = `Time: ${minutes}:${seconds}`; },

        // --- Game Over Handling ---
        handleGameOver(reason) { if (this.isGameOver) return; console.log("Game Over:", reason); this.isGameOver = true; this.stopTimer(); this.isDrawing = false; this.disableInput(); if (nextLevelButton) nextLevelButton.style.display = 'none'; this.showMessage(reason + " Game Over!"); this.playSound(soundLose); restartGameButton.disabled = false; },

        // --- Persistence ---
        updateScoreDisplay() { scoreElement.textContent = `Score: ${this.score}`; },
        saveScore() { try { localStorage.setItem('zipItHighScore', this.score.toString()); this.updateScoreDisplay(); } catch (e) { console.error("Failed to save score:", e); } },
        loadScore() { try { const savedScore = localStorage.getItem('zipItHighScore'); this.score = savedScore ? parseInt(savedScore, 10) : 0; if (isNaN(this.score)) this.score = 0; } catch (e) { console.error("Failed to load score:", e); this.score = 0; } this.updateScoreDisplay(); },
        saveLevel() { try { localStorage.setItem('zipItCurrentLevel', this.level.toString()); console.log(`Saved level: ${this.level}`); } catch (e) { console.error("Failed to save level:", e); } },
        loadLevel() { let loadedLevel = 1; try { const savedLevel = localStorage.getItem('zipItCurrentLevel'); const parsedLevel = savedLevel ? parseInt(savedLevel, 10) : 1; loadedLevel = (parsedLevel && parsedLevel > 0) ? parsedLevel : 1; } catch (e) { console.error("Failed to load level:", e); } this.level = loadedLevel; console.log(`Loaded level: ${this.level}`); },

        // --- Input Control ---
        disableInput() { console.log("Disabling input"); undoButton.disabled = true; resetLevelButton.disabled = true; restartGameButton.disabled = false; },
        enableInput() { console.log(`Enabling input (isGameOver: ${this.isGameOver}, isGenerating: ${this.isGenerating})`); if (!this.isGameOver && !this.isGenerating) { undoButton.disabled = false; resetLevelButton.disabled = false; } else { undoButton.disabled = true; resetLevelButton.disabled = true; } restartGameButton.disabled = false; },

        // --- General Utilities ---
        getPathValues() { if (!this.currentPath || !Array.isArray(this.currentPath) || this.currentPath.length === 0) { return ""; } try { return this.currentPath.map(step => (step?.cell?.dataset ? step.cell.dataset.value || 'E' : '?')).join(' -> '); } catch (error) { console.error("Error in getPathValues:", error, this.currentPath); return "Error retrieving path"; } },
        showMessage(message, id = null) { if (id) this.hideMessage(id); const messageBox = document.createElement('div'); messageBox.classList.add('message-box'); if (id) messageBox.dataset.messageId = id; const messageText = document.createElement('span'); messageText.textContent = message; const closeButton = document.createElement('button'); closeButton.classList.add('close-button'); closeButton.innerHTML = '×'; closeButton.setAttribute('aria-label', 'Close message'); const closeMessage = () => { if (messageBox.parentElement) { messageBox.style.opacity = '0'; messageBox.style.transform = 'translateX(10px)'; messageBox.addEventListener('transitionend', () => { if (messageBox.parentElement) messageBox.remove(); }, { once: true }); } }; closeButton.onclick = closeMessage; messageBox.appendChild(messageText); messageBox.appendChild(closeButton); messageContainer.appendChild(messageBox); requestAnimationFrame(() => { requestAnimationFrame(() => { messageBox.classList.add('show'); }); }); const autoCloseTimeout = setTimeout(closeMessage, MSG_DISPLAY_TIME); closeButton.addEventListener('click', () => clearTimeout(autoCloseTimeout)); },
        hideMessage(id) { const existingMessage = messageContainer.querySelector(`.message-box[data-message-id="${id}"]`); if (existingMessage) { const closeButton = existingMessage.querySelector('.close-button'); if (closeButton) closeButton.click(); else existingMessage.remove(); } },
        playSound(audioElement) { if (audioElement) { audioElement.currentTime = 0; audioElement.play().catch(e => console.error("Error playing sound:", e.message)); } },

        // --- Event Listener Setup ---
        addEventListeners() {
            undoButton.addEventListener('click', this.handleUndo.bind(this));
            resetLevelButton.addEventListener('click', this.handleResetLevel.bind(this));
            restartGameButton.addEventListener('click', this.handleRestartGame.bind(this)); // Shows modal
            nextLevelButton.addEventListener('click', this.handleNextLevel.bind(this));

            // Modal Listeners
            if (modalConfirmRestart) { modalConfirmRestart.addEventListener('click', () => { this.hideRestartModal(); this.performRestart(); }); }
            if (modalCancelRestart) { modalCancelRestart.addEventListener('click', this.hideRestartModal.bind(this)); }
            if (restartModalOverlay) { restartModalOverlay.addEventListener('click', (event) => { if (event.target === restartModalOverlay) { this.hideRestartModal(); } }); }

            // Drawing Listeners
            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
            document.addEventListener('dragstart', (e) => e.preventDefault());
            let isTouching = false;
            puzzleGridElement.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating) return; const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const cell = targetElement?.closest('.cell'); if (cell) { isTouching = true; const simulatedEvent = { target: cell, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseDown(simulatedEvent); } else { isTouching = false; } }, { passive: true });
            document.addEventListener('touchmove', (e) => { if (!isTouching || !this.isDrawing || this.isGenerating) return; e.preventDefault(); const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const simulatedEvent = { target: targetElement, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseMove(simulatedEvent); }, { passive: false });
            document.addEventListener('touchend', (e) => { if (!isTouching) return; isTouching = false; this.handleMouseUp(); });
            document.addEventListener('touchcancel', (e) => { if (!isTouching) return; isTouching = false; this.handleMouseUp(); console.log("Touch cancelled"); });
        }

    }; // End of game object

    // --- Initialize Game ---
    game.init();

}); // End DOMContentLoaded