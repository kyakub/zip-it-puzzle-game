document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const puzzleGridElement = document.getElementById('puzzleGrid');
    const timerElement = document.getElementById('timer');
    const scoreElement = document.getElementById('score');
    const levelDisplayElement = document.getElementById('levelDisplay');
    const undoButton = document.getElementById('undoButton');
    const clearPathButton = document.getElementById('clearPathButton'); // New Clear Button
    const resetLevelButton = document.getElementById('resetLevelButton');
    const restartGameButton = document.getElementById('restartGameButton');
    const nextLevelButton = document.getElementById('nextLevelButton');
    const messageContainer = document.getElementById('messageContainer');
    const restartModalOverlay = document.getElementById('restartModalOverlay');
    const modalConfirmRestart = document.getElementById('modalConfirmRestart');
    const modalCancelRestart = document.getElementById('modalCancelRestart');
    const soundToggleButton = document.getElementById('soundToggle');

    // --- Audio Elements ---
    const soundTick = document.getElementById('soundTick');
    const soundError = document.getElementById('soundError');
    const soundWin = document.getElementById('soundWin');
    const soundLose = document.getElementById('soundLose');

    // --- Game Configuration ---
    const MSG_DISPLAY_TIME = 5000;
    const BASE_TIME_LIMIT = 60; // New base time
    const MAX_HAMILTONIAN_ATTEMPTS = 25;
    const MIN_MSG_INTERVAL = 1500; // Min time between identical debounced messages

    // --- Game State Object ---
    const game = {
        level: 1,
        gridRows: 4,    // Now separate rows/cols
        gridCols: 4,
        calculatedCellSize: 70, // Store calculated size
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
        isMuted: false,
        lastMessage: { text: '', timestamp: 0 }, // For debouncing messages

        // --- Game Methods ---

        init() {
            this.loadScore();
            this.loadLevel();
            this.loadSoundPreference();
            this.addEventListeners();
            this.startLevel();
        },

        // NEW Helper to calculate level parameters
        _calculateLevelParams() {
            const level = this.level;
            let params = {
                rows: 4,
                cols: 4,
                cellSize: 70,
                timeAddition: 0,
                xCells: 5 // Starting value
            };

            // Determine grid size, cell size, and base time addition
            if (level > 300) { params = { rows: 10, cols: 10, cellSize: 52, timeAddition: 50 }; }
            else if (level > 200) { params = { rows: 9, cols: 9, cellSize: 54, timeAddition: 35 }; }
            else if (level > 150) { params = { rows: 9, cols: 8, cellSize: 56, timeAddition: 30 }; }
            else if (level > 100) { params = { rows: 8, cols: 8, cellSize: 58, timeAddition: 25 }; }
            else if (level > 70) { params = { rows: 8, cols: 7, cellSize: 58, timeAddition: 20 }; }
            else if (level > 50) { params = { rows: 7, cols: 7, cellSize: 60, timeAddition: 15 }; }
            else if (level > 25) { params = { rows: 6, cols: 6, cellSize: 64, timeAddition: 10 }; }
            else if (level > 10) { params = { rows: 5, cols: 5, cellSize: 68, timeAddition: 5 }; }

            // Determine xCells based on separate thresholds
            if (level > 280) params.xCells = 20;
            else if (level > 260) params.xCells = 19;
            else if (level > 240) params.xCells = 18;
            else if (level > 220) params.xCells = 17;
            else if (level > 200) params.xCells = 16;
            else if (level > 180) params.xCells = 15;
            else if (level > 160) params.xCells = 14;
            else if (level > 140) params.xCells = 13;
            else if (level > 120) params.xCells = 12;
            else if (level > 100) params.xCells = 11;
            else if (level > 80) params.xCells = 10;
            else if (level > 60) params.xCells = 9;
            else if (level > 40) params.xCells = 8;
            else if (level > 20) params.xCells = 7;
            else if (level > 10) params.xCells = 6;
            // else stays at default 5

            // Apply constraints
            const maxPossibleXCells = params.rows * params.cols;
            params.xCells = Math.min(params.xCells, maxPossibleXCells); // Cannot exceed total cells
            params.xCells = Math.min(20, params.xCells); // Absolute max 20
            if (params.rows * params.cols > 1 && params.xCells < 2) {
                params.xCells = 2; // Ensure at least 2 for start/end rule
            } else if (params.rows * params.cols === 1) {
                params.xCells = 1;
            }

            // Calculate final time limit
            // Optional: Add small dynamic factor? For now, just use base + threshold addition
            params.timeLimit = BASE_TIME_LIMIT + params.timeAddition;

            return params;
        },

        startLevel() {
            console.log(`--- Starting Level ${this.level} ---`);
            this.isGameOver = false; this.isDrawing = false; this.currentPath = []; this.drawnLines.forEach(line => line.remove()); this.drawnLines = []; this.expectedNextValue = 1;
            if (this.pathFindingWorker) { console.log("Terminating previous worker."); this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false;

            // --- Calculate Difficulty using Helper ---
            const params = this._calculateLevelParams();
            this.gridRows = params.rows;
            this.gridCols = params.cols;
            this.calculatedCellSize = params.cellSize;
            this.xCells = params.xCells;
            this.timeLimit = params.timeLimit;

            console.log(`Level ${this.level} Params: Grid ${this.gridRows}x${this.gridCols}, Cells ${this.xCells}, CellSize ${this.calculatedCellSize}px, Time ${this.timeLimit}s`);

            this.updateUI(); // Update display with new level etc.

            // Initiate Async Puzzle Generation
            this.isGenerating = true;
            // ** REMOVED showMessage for generating **
            puzzleGridElement.innerHTML = '<div class="generating-text">Generating Level...<br/>Please Wait</div>'; // Updated text
            // Set grid dimensions based on calculated values
            puzzleGridElement.style.gridTemplateRows = `repeat(${this.gridRows}, ${this.calculatedCellSize}px)`;
            puzzleGridElement.style.gridTemplateColumns = `repeat(${this.gridCols}, ${this.calculatedCellSize}px)`;
            puzzleGridElement.style.setProperty('--cell-size', `${this.calculatedCellSize}px`); // Set CSS variable for cell content styling

            this.disableInput(); // Disable controls
            if (nextLevelButton) nextLevelButton.style.display = 'none';
            this.stopTimer();

            this.generatePuzzleAsync();
        },

        updateUI() {
            levelDisplayElement.textContent = `Level: ${this.level}`;
            scoreElement.textContent = `Score: ${this.score}`;
            this.updateTimerDisplay();
            this.updateSoundButtonIcon();
        },

        generatePuzzleAsync() {
            if (!window.Worker) { console.error("Web Workers not supported!"); this.showMessage("Error: Browser doesn't support background generation.", "gen_error"); puzzleGridElement.innerHTML = 'Error: Workers not supported!'; this.isGenerating = false; this.enableInput(); return; }
            this.pathFindingWorker = new Worker('pathfinder.js'); console.log("Main: Worker created.");
            this.pathFindingWorker.onmessage = (event) => { console.log("Main: Message received from worker:", event.data); this.isGenerating = false; /* No hideMessage needed */ if (event.data.success) { this._finishPuzzleGeneration(event.data.path); this.startTimer(); this.enableInput(); } else { console.error("Main: Path generation failed in worker.", event.data.reason || event.data.error); this.showMessage(`Error: Could not generate level (${event.data.reason || event.data.error || 'Unknown worker error'}). Try resetting.`, "gen_fail"); puzzleGridElement.innerHTML = '<div class="generating-text">Generation Failed!</div>'; this.disableInput(); restartGameButton.disabled = false; } if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; console.log("Main: Worker terminated after completion."); } };
            this.pathFindingWorker.onerror = (error) => { console.error("Main: Error received from worker:", error.message, error); this.isGenerating = false; /* No hideMessage needed */ this.showMessage(`Error: Generation failed (${error.message || 'Worker script error'}). Please reset.`, "gen_error"); puzzleGridElement.innerHTML = '<div class="generating-text">Generation Error!</div>'; this.disableInput(); restartGameButton.disabled = false; if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } };
            console.log("Main: Posting task to worker...");
            // Send rows and cols to worker
            this.pathFindingWorker.postMessage({ gridRows: this.gridRows, gridCols: this.gridCols, maxAttempts: MAX_HAMILTONIAN_ATTEMPTS });
        },

        _finishPuzzleGeneration(hamiltonianPath) {
            console.log("Main: Finishing puzzle generation with received path.");
            puzzleGridElement.innerHTML = ''; // Clear placeholder

            // Place Numbers
            const numberPositions = {}; const totalCells = this.gridRows * this.gridCols;
            numberPositions[hamiltonianPath[0]] = 1; if (this.xCells > 1) { numberPositions[hamiltonianPath[totalCells - 1]] = this.xCells; } if (this.xCells > 2) { const intermediateIndices = Array.from({ length: totalCells - 2 }, (_, i) => i + 1); const shuffledIntermediate = this.shuffle(intermediateIndices); const chosenIntermediateIndices = shuffledIntermediate.slice(0, this.xCells - 2).sort((a, b) => a - b); for (let i = 0; i < chosenIntermediateIndices.length; i++) { numberPositions[hamiltonianPath[chosenIntermediateIndices[i]]] = i + 2; } }
            console.log("Number positions:", numberPositions);

            // Create Grid Cells using calculatedCellSize
            const tempGrid = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(null));
            for (let r = 0; r < this.gridRows; r++) {
                for (let c = 0; c < this.gridCols; c++) {
                    const cell = document.createElement('div'); const cellKey = `${r}-${c}`; const value = numberPositions[cellKey] || null;
                    cell.classList.add('cell'); cell.dataset.row = r; cell.dataset.col = c; cell.dataset.value = value !== null ? value : '';
                    // Set cell size dynamically
                    cell.style.width = `${this.calculatedCellSize}px`;
                    cell.style.height = `${this.calculatedCellSize}px`;
                    if (value !== null) { const numberElement = document.createElement('span'); numberElement.textContent = value; cell.appendChild(numberElement); }
                    cell.addEventListener('mousemove', this.handleMouseMove.bind(this)); tempGrid[r][c] = cell; puzzleGridElement.appendChild(cell);
                }
            }
            this.currentPuzzle = tempGrid;
            this.currentPuzzle.flat().forEach(cell => { cell.addEventListener('mousedown', this.handleMouseDown.bind(this)); cell.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating) return; const touch = e.touches[0]; const simulatedEvent = { target: touch.target, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseDown(simulatedEvent); }, { passive: true }); });
            console.log("Main: Puzzle grid created successfully.");
        },

        // Updated isValid to use gridRows/gridCols state
        isValid(r, c) { return r >= 0 && r < this.gridRows && c >= 0 && c < this.gridCols; },
        isNeighbor(cell1, cell2) { if (!cell1 || !cell2) return false; const r1 = parseInt(cell1.dataset.row); const c1 = parseInt(cell1.dataset.col); const r2 = parseInt(cell2.dataset.row); const c2 = parseInt(cell2.dataset.col); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; },
        shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },

        handleMouseDown(e) { if (this.isGameOver || this.isDrawing || this.isGenerating) return; const cell = e.target.closest('.cell'); if (!cell) return; const value = parseInt(cell.dataset.value) || null; const isPathEmpty = this.currentPath.length === 0; const lastPathStep = isPathEmpty ? null : this.currentPath[this.currentPath.length - 1]; if (isPathEmpty && value === 1) { this.isDrawing = true; cell.classList.add('selected'); this.currentPath.push({ cell: cell, expectedValueBeforeEntering: 1 }); this.expectedNextValue = 2; this.playSound(soundTick); console.log("Path started:", this.getPathValues()); this.enableInput(); } else if (!isPathEmpty && cell === lastPathStep.cell) { this.isDrawing = true; console.log("Resuming draw"); } else if (isPathEmpty && value !== 1) { this.showMessage("Path must start on number 1!", null, true); this.playSound(soundError); } }, // Debounce start message
        handleMouseMove(e) {
            if (!this.isDrawing || this.isGameOver || this.isGenerating) return;
            const gridRect = puzzleGridElement.getBoundingClientRect(); const mouseX = e.clientX - gridRect.left; const mouseY = e.clientY - gridRect.top;
            // Use calculated cell size for accuracy
            const col = Math.floor(mouseX / this.calculatedCellSize);
            const row = Math.floor(mouseY / this.calculatedCellSize);
            if (!this.isValid(row, col)) return; if (!this.currentPuzzle?.[row]?.[col]) return; const currentCell = this.currentPuzzle[row][col];
            const lastPathStep = this.currentPath.length > 0 ? this.currentPath[this.currentPath.length - 1] : null; const lastCell = lastPathStep?.cell; if (!lastCell || currentCell === lastCell) return;

            if (this.currentPath.length > 1 && currentCell === this.currentPath[this.currentPath.length - 2].cell) { this.undoLastStep(true); } // Backtrack
            else if (!currentCell.classList.contains('selected') && this.isNeighbor(lastCell, currentCell)) { // Forward move
                const currentValue = parseInt(currentCell.dataset.value) || null; let isValidMove = false; let isMovingToExpectedNumber = false;
                if (currentValue === this.expectedNextValue) { isValidMove = true; isMovingToExpectedNumber = true; } else if (currentValue === null) { isValidMove = true; }
                if (isValidMove) {
                    const previousExpectedValue = this.expectedNextValue; currentCell.classList.add('selected'); this.drawLine(lastCell, currentCell); this.currentPath.push({ cell: currentCell, expectedValueBeforeEntering: previousExpectedValue }); this.enableInput(); // Enable clear/undo once path starts
                    if (isMovingToExpectedNumber) { this.playSound(soundTick); this.expectedNextValue++; if (currentValue === this.xCells) { console.log("Last required number reached."); } }
                    if (this.currentPath.length === (this.gridRows * this.gridCols)) { this.checkWinCondition(); }
                }
            }
        },
        handleMouseUp() { if (this.isDrawing) { this.isDrawing = false; console.log("Mouse up, drawing stopped. Final path:", this.getPathValues()); if (this.currentPath.length === (this.gridRows * this.gridCols)) { this.checkWinCondition(); } } },

        handleUndo() { if (this.isGameOver || this.isGenerating) return; if (this.isDrawing) { this.showMessage("Cannot undo while drawing.", null, true); return; } if (this.currentPath.length > 1) { this.undoLastStep(false); this.enableInput(); } else { this.showMessage("Cannot undo further.", null, true); this.playSound(soundError); this.enableInput(); } }, // Debounce msg
        handleResetLevel() { if (this.isGenerating) { this.showMessage("Please wait for level generation.", null, true); return; } if (this.isGameOver && this.currentPath.length === (this.gridRows * this.gridCols)) { this.showMessage("Level complete."); return; } console.log(`Resetting Level ${this.level}`); this.stopTimer(); if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.startLevel(); this.showMessage(`Level ${this.level} Reset!`); },
        handleNextLevel() { if (this.isGenerating) return; if (this.isGameOver && this.currentPath.length === (this.gridRows * this.gridCols)) { const lastCell = this.currentPath[this.currentPath.length - 1].cell; const lastCellValue = parseInt(lastCell.dataset.value); if (lastCellValue === this.xCells) { this.level++; this.saveLevel(); this.startLevel(); } else { this.showMessage("Error: Win condition mismatch."); } } else if (this.isGameOver) { this.showMessage("Level not completed successfully."); } else { this.showMessage("Complete the current level first!"); } },
        handleRestartGame() { console.log("Restart Game button clicked - showing modal."); this.showRestartModal(); },
        handleSoundToggle() { this.isMuted = !this.isMuted; this.saveSoundPreference(); this.updateSoundButtonIcon(); console.log(`Sound muted: ${this.isMuted}`); if (!this.isMuted) { this.playSound(soundTick, true); } },
        // NEW: Clear Path Handler
        handleClearPath() {
            if (this.isGameOver || this.isGenerating || this.isDrawing || this.currentPath.length === 0) {
                return; // Only clear if path exists and game is active
            }
            console.log("Clearing current path");
            // Remove visual selection from all cells in the path
            this.currentPath.forEach(step => step.cell.classList.remove('selected'));
            // Remove all line elements
            this.drawnLines.forEach(line => line.remove());

            // Reset path state
            this.currentPath = [];
            this.drawnLines = [];
            this.expectedNextValue = 1;
            this.playSound(soundError); // Use error/clear sound?
            this.enableInput(); // Update button states (clear should become disabled)
        },


        performRestart() { console.log("Performing game restart..."); if (this.isGenerating) { if (this.pathFindingWorker) { console.log("Terminating worker due to confirmed game restart."); this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false; } this.stopTimer(); this.level = 1; this.score = 0; this.saveScore(); this.saveLevel(); this.startLevel(); this.showMessage("Game Restarted!"); },
        showRestartModal() { if (restartModalOverlay) { restartModalOverlay.classList.add('show'); } },
        hideRestartModal() { if (restartModalOverlay) { restartModalOverlay.classList.remove('show'); } },

        drawLine(fromCell, toCell) { const NEW_LINE_HEIGHT = 12; const gridRect = puzzleGridElement.getBoundingClientRect(); const fromRect = fromCell.getBoundingClientRect(); const toRect = toCell.getBoundingClientRect(); const x1 = fromRect.left + fromRect.width / 2 - gridRect.left; const y1 = fromRect.top + fromRect.height / 2 - gridRect.top; const x2 = toRect.left + toRect.width / 2 - gridRect.left; const y2 = toRect.top + toRect.height / 2 - gridRect.top; const length = Math.hypot(x2 - x1, y2 - y1); const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI); const line = document.createElement('div'); line.classList.add('line'); line.style.width = `${length}px`; line.style.transformOrigin = '0 50%'; line.style.transform = `rotate(${angle}deg)`; line.style.left = `${x1}px`; line.style.top = `${y1 - NEW_LINE_HEIGHT / 2}px`; if (puzzleGridElement) { puzzleGridElement.appendChild(line); this.drawnLines.push(line); } },
        undoLastStep(isDuringDrag) { if (this.currentPath.length <= 1) return; const removedStep = this.currentPath.pop(); removedStep.cell.classList.remove('selected'); const lastLine = this.drawnLines.pop(); if (lastLine) { lastLine.remove(); } this.expectedNextValue = removedStep.expectedValueBeforeEntering; if (!isDuringDrag) this.playSound(soundTick); },

        checkWinCondition() {
            if (this.isGameOver) return;
            const totalCellsInGrid = this.gridRows * this.gridCols; const pathLength = this.currentPath.length; const pathCoversAllCells = pathLength === totalCellsInGrid; if (!pathCoversAllCells) { return; }
            const correctNumberSequenceFollowed = this.expectedNextValue > this.xCells; const lastCell = this.currentPath[pathLength - 1].cell; const lastCellValue = parseInt(lastCell.dataset.value); const isLastCellCorrectNumber = lastCellValue === this.xCells;
            console.log(`checkWinCondition Results: CoveredAll=${pathCoversAllCells}, CorrectSeq=${correctNumberSequenceFollowed}, LastCellOk (${this.xCells})=${isLastCellCorrectNumber} (Val: ${lastCellValue})`);
            if (pathCoversAllCells && correctNumberSequenceFollowed && isLastCellCorrectNumber) {
                console.log("Win condition MET!"); this.isGameOver = true; this.stopTimer(); this.score += this.level * 10 + Math.max(0, this.timeRemaining); this.saveScore(); this.updateUI(); this.showMessage(`Level ${this.level} Complete! Score: ${this.score}`); this.playSound(soundWin); this.disableInput(); if (nextLevelButton) { nextLevelButton.style.display = 'inline-block'; } restartGameButton.disabled = false;
            } else {
                console.log("Win condition NOT MET."); if (pathCoversAllCells && !isLastCellCorrectNumber && correctNumberSequenceFollowed) { this.showMessage(`Almost! The path must end on number ${this.xCells}.`); } else if (pathCoversAllCells && !correctNumberSequenceFollowed) { this.showMessage(`Keep going! Connect numbers 1 to ${this.xCells}.`); } if (nextLevelButton) { nextLevelButton.style.display = 'none'; }
            }
        },

        startTimer() { this.stopTimer(); this.timeRemaining = this.timeLimit; this.updateTimerDisplay(); this.timerInterval = setInterval(() => { this.timeRemaining--; this.updateTimerDisplay(); if (this.timeRemaining <= 0) { this.handleGameOver("Time's up!"); } }, 1000); },
        stopTimer() { clearInterval(this.timerInterval); this.timerInterval = null; },
        updateTimerDisplay() { const minutes = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0'); const seconds = String(this.timeRemaining % 60).padStart(2, '0'); timerElement.textContent = `Time: ${minutes}:${seconds}`; },
        handleGameOver(reason) { if (this.isGameOver) return; console.log("Game Over:", reason); this.isGameOver = true; this.stopTimer(); this.isDrawing = false; this.disableInput(); if (nextLevelButton) nextLevelButton.style.display = 'none'; this.showMessage(reason + " Game Over!"); this.playSound(soundLose); restartGameButton.disabled = false; },

        updateScoreDisplay() { scoreElement.textContent = `Score: ${this.score}`; },
        saveScore() { try { localStorage.setItem('zipItHighScore', this.score.toString()); this.updateScoreDisplay(); } catch (e) { console.error("Failed to save score:", e); } },
        loadScore() { try { const savedScore = localStorage.getItem('zipItHighScore'); this.score = savedScore ? parseInt(savedScore, 10) : 0; if (isNaN(this.score)) this.score = 0; } catch (e) { console.error("Failed to load score:", e); this.score = 0; } this.updateScoreDisplay(); },
        saveLevel() { try { localStorage.setItem('zipItCurrentLevel', this.level.toString()); } catch (e) { console.error("Failed to save level:", e); } },
        loadLevel() { let loadedLevel = 1; try { const savedLevel = localStorage.getItem('zipItCurrentLevel'); const parsedLevel = savedLevel ? parseInt(savedLevel, 10) : 1; loadedLevel = (parsedLevel && parsedLevel > 0) ? parsedLevel : 1; } catch (e) { console.error("Failed to load level:", e); } this.level = loadedLevel; },
        saveSoundPreference() { try { localStorage.setItem('zipItSoundMuted', this.isMuted ? 'true' : 'false'); } catch (e) { console.error("Failed to save sound preference:", e); } },
        loadSoundPreference() { try { const savedMuted = localStorage.getItem('zipItSoundMuted'); this.isMuted = savedMuted === 'true'; } catch (e) { console.error("Failed to load sound preference:", e); this.isMuted = false; } this.updateSoundButtonIcon(); },

        // UPDATED Input Control for Clear Button
        disableInput() {
            console.log("Disabling input");
            undoButton.disabled = true;
            clearPathButton.disabled = true; // Disable clear
            resetLevelButton.disabled = true;
            restartGameButton.disabled = false; // Keep restart enabled
        },
        enableInput() {
            console.log(`Enabling input (isGameOver: ${this.isGameOver}, isGenerating: ${this.isGenerating}, pathLen: ${this.currentPath.length})`);
            const canInteract = !this.isGameOver && !this.isGenerating;
            undoButton.disabled = !canInteract || this.currentPath.length <= 1;
            clearPathButton.disabled = !canInteract || this.currentPath.length === 0; // Enable if path exists
            resetLevelButton.disabled = !canInteract;
            restartGameButton.disabled = false; // Always enabled
        },

        // UPDATED showMessage with Debounce Logic
        showMessage(message, id = null, debounce = false) {
            const now = Date.now();
            // Check debounce condition
            if (debounce && message === this.lastMessage.text && (now - this.lastMessage.timestamp < MIN_MSG_INTERVAL)) {
                // console.log("Debounced message:", message); // Optional debug log
                return; // Skip showing the message
            }

            // If showing, update last message info
            this.lastMessage.text = message;
            this.lastMessage.timestamp = now;

            console.log("Message:", message); // Log showing messages

            if (id) this.hideMessage(id); // Hide previous with same ID if specified
            const messageBox = document.createElement('div');
            messageBox.classList.add('message-box');
            if (id) messageBox.dataset.messageId = id;
            const messageText = document.createElement('span'); messageText.textContent = message;
            const closeButton = document.createElement('button'); closeButton.classList.add('close-button'); closeButton.innerHTML = '×'; closeButton.setAttribute('aria-label', 'Close message');

            const closeMessage = () => {
                // Check parent again before removal attempt inside transitionend
                if (messageBox.parentElement) {
                    messageBox.style.opacity = '0'; messageBox.style.transform = 'translateX(10px)';
                    messageBox.addEventListener('transitionend', () => {
                        if (messageBox.parentElement) { // Final check
                            messageBox.remove();
                        }
                    }, { once: true });
                }
            };

            closeButton.onclick = closeMessage;
            messageBox.appendChild(messageText); messageBox.appendChild(closeButton); messageContainer.appendChild(messageBox);
            requestAnimationFrame(() => { requestAnimationFrame(() => { messageBox.classList.add('show'); }); });
            const autoCloseTimeout = setTimeout(closeMessage, MSG_DISPLAY_TIME);
            closeButton.addEventListener('click', () => clearTimeout(autoCloseTimeout));
        },
        hideMessage(id) { const existingMessage = messageContainer.querySelector(`.message-box[data-message-id="${id}"]`); if (existingMessage) { const closeButton = existingMessage.querySelector('.close-button'); if (closeButton) closeButton.click(); else existingMessage.remove(); } },
        playSound(audioElement, forcePlay = false) { if (this.isMuted && !forcePlay) { return; } if (audioElement) { audioElement.currentTime = 0; audioElement.play().catch(e => console.error(`Error playing sound (${audioElement.id || 'unknown'}):`, e.message)); } },
        updateSoundButtonIcon() { if (soundToggleButton) { soundToggleButton.textContent = this.isMuted ? "Sound: Off" : "Sound: On"; soundToggleButton.title = this.isMuted ? "Unmute Sounds" : "Mute Sounds"; } },

        addEventListeners() {
            undoButton.addEventListener('click', this.handleUndo.bind(this));
            clearPathButton.addEventListener('click', this.handleClearPath.bind(this)); // Add listener for Clear
            resetLevelButton.addEventListener('click', this.handleResetLevel.bind(this));
            restartGameButton.addEventListener('click', this.handleRestartGame.bind(this));
            nextLevelButton.addEventListener('click', this.handleNextLevel.bind(this));
            if (soundToggleButton) { soundToggleButton.addEventListener('click', this.handleSoundToggle.bind(this)); }
            if (modalConfirmRestart) { modalConfirmRestart.addEventListener('click', () => { this.hideRestartModal(); this.performRestart(); }); }
            if (modalCancelRestart) { modalCancelRestart.addEventListener('click', this.hideRestartModal.bind(this)); }
            if (restartModalOverlay) { restartModalOverlay.addEventListener('click', (event) => { if (event.target === restartModalOverlay) { this.hideRestartModal(); } }); }
            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
            document.addEventListener('dragstart', (e) => e.preventDefault());
            let isTouching = false;
            puzzleGridElement.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating) return; const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const cell = targetElement?.closest('.cell'); if (cell) { isTouching = true; const simulatedEvent = { target: cell, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseDown(simulatedEvent); } else { isTouching = false; } }, { passive: true });
            document.addEventListener('touchmove', (e) => { if (!isTouching || !this.isDrawing || this.isGenerating) return; e.preventDefault(); const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const simulatedEvent = { target: targetElement, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseMove(simulatedEvent); }, { passive: false });
            document.addEventListener('touchend', (e) => { if (!isTouching) return; isTouching = false; this.handleMouseUp(); });
            document.addEventListener('touchcancel', (e) => { if (!isTouching) return; isTouching = false; this.handleMouseUp(); console.log("Touch cancelled"); });
        }

    }; // End of game object

    game.init(); // Initialize Game

}); // End DOMContentLoaded