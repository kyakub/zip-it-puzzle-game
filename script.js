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
    const pathSvgElement = document.getElementById('pathSvg');
    const numbersSvgElement = document.getElementById('numbersSvg');

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
    const SVG_NS = "http://www.w3.org/2000/svg";
    const ANIMATION_DURATION_CLICK = 100; // ms for click animation

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
        gamePathPolyline: null,
        pathPoints: [],
        tempLineElement: null,
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
        svgNumberElements: {},
        isPaused: false,
        MAX_HAMILTONIAN_ATTEMPTS: 25,
        isAnimatingClick: false,
        currentClickAnimation: null,


        init() {
            this.ensureSvgElements();
            this.loadSoundPreference();
            this.addEventListeners();
            this.loadFullGameState();
        },

        ensureSvgElements() {
            if (!this.gamePathPolyline && pathSvgElement) {
                this.gamePathPolyline = document.createElementNS(SVG_NS, 'polyline');
                this.gamePathPolyline.setAttribute('id', 'gamePath');
                pathSvgElement.appendChild(this.gamePathPolyline);
            }
            if (!this.tempLineElement && pathSvgElement) {
                this.tempLineElement = document.createElementNS(SVG_NS, 'line');
                this.tempLineElement.setAttribute('id', 'tempPathSegment');
                pathSvgElement.appendChild(this.tempLineElement);
            }
            this.clearSvgPath();
        },

        getCellCenter(cell) {
            const gridRect = puzzleGridElement.getBoundingClientRect();
            const cellRect = cell.getBoundingClientRect();
            const x = (cellRect.left + cellRect.width / 2) - gridRect.left;
            const y = (cellRect.top + cellRect.height / 2) - gridRect.top;
            return { x, y };
        },

        getRelativeCoords(e) {
            const gridRect = puzzleGridElement.getBoundingClientRect();
            return {
                x: e.clientX - gridRect.left,
                y: e.clientY - gridRect.top
            };
        },

        updateSvgPath() {
            if (!this.gamePathPolyline) return;
            const pointsString = this.pathPoints.join(' ');
            this.gamePathPolyline.setAttribute('points', pointsString);
            const lineThickness = Math.min(35, this.calculatedCellSize * 0.8);
            this.gamePathPolyline.setAttribute('stroke-width', lineThickness);

            if (this.tempLineElement) {
                this.tempLineElement.setAttribute('stroke-width', lineThickness);
            }
            if (this.currentClickAnimation) {
                this.currentClickAnimation.line.setAttribute('stroke-width', lineThickness);
            }
        },

        clearSvgPath() {
            this.pathPoints = [];
            if (this.gamePathPolyline) {
                this.gamePathPolyline.setAttribute('points', '');
            }
            this.clearClickAnimation();
            if (this.tempLineElement) {
                this.tempLineElement.style.visibility = 'hidden';
            }
        },

        clearClickAnimation() {
            if (this.currentClickAnimation) {
                clearTimeout(this.currentClickAnimation.timerId);
                if (this.currentClickAnimation.line.parentNode) {
                    pathSvgElement.removeChild(this.currentClickAnimation.line);
                }
                this.currentClickAnimation = null;
                this.isAnimatingClick = false;
            }
        },

        drawNumbersOnSvg() {
            numbersSvgElement.innerHTML = '';
            this.svgNumberElements = {};
            const circleRadius = Math.min(17.5, Math.max(9, this.calculatedCellSize * 0.275));
            const fontSize = Math.min(19.6, Math.max(9.8, this.calculatedCellSize * 0.28));
            for (const cellKey in this.numberPositions) {
                const value = this.numberPositions[cellKey];
                const [r, c] = cellKey.split('-').map(Number);
                const cellElement = this.currentPuzzle?.[r]?.[c];
                if (!cellElement) continue;
                const center = this.getCellCenter(cellElement);
                const circle = document.createElementNS(SVG_NS, 'circle');
                circle.setAttribute('cx', center.x); circle.setAttribute('cy', center.y);
                circle.setAttribute('r', circleRadius); circle.classList.add('number-circle-bg');
                if (cellElement.classList.contains('selected')) { circle.classList.add('selected'); }
                const text = document.createElementNS(SVG_NS, 'text');
                text.setAttribute('x', center.x); text.setAttribute('y', center.y);
                text.setAttribute('font-size', `${fontSize}px`); text.classList.add('number-text');
                text.textContent = value;
                numbersSvgElement.appendChild(circle); numbersSvgElement.appendChild(text);
                this.svgNumberElements[cellKey] = { circle, text };
            }
        },

        updateSvgNumberSelection(cellKey, isSelected) {
            const elements = this.svgNumberElements[cellKey];
            if (elements && elements.circle) {
                if (isSelected) { elements.circle.classList.add('selected'); }
                else { elements.circle.classList.remove('selected'); }
            }
        },

        _calculateLevelParams() {
            const level = this.level;
            let params = { rows: 4, cols: 4, baseCellSize: 70, timeAddition: 0, xCells: 5 };
            if (level > 300) { params = { rows: 10, cols: 10, baseCellSize: 52, timeAddition: 50 }; }
            else if (level > 260) { params = { rows: 9, cols: 9, baseCellSize: 52, timeAddition: 35 }; }
            else if (level > 220) { params = { rows: 8, cols: 9, baseCellSize: 53, timeAddition: 30 }; }
            else if (level > 180) { params = { rows: 8, cols: 8, baseCellSize: 54, timeAddition: 25 }; }
            else if (level > 140) { params = { rows: 7, cols: 8, baseCellSize: 55, timeAddition: 20 }; }
            else if (level > 100) { params = { rows: 7, cols: 7, baseCellSize: 56, timeAddition: 15 }; }
            else if (level > 60) { params = { rows: 6, cols: 6, baseCellSize: 60, timeAddition: 10 }; }
            else if (level > 20) { params = { rows: 5, cols: 5, baseCellSize: 65, timeAddition: 5 }; }
            else if (level > 10) { params = { rows: 4, cols: 4, baseCellSize: 70, timeAddition: 0, xCells: 6 }; }

            if (level > 280) params.xCells = 20;
            else if (level > 260) params.xCells = 19 + Math.min(1, Math.floor((level - 261) / 20));
            else if (level > 240) params.xCells = 18 + Math.min(1, Math.floor((level - 241) / 20));
            else if (level > 220) params.xCells = 17 + Math.min(1, Math.floor((level - 221) / 20));
            else if (level > 200) params.xCells = 16 + Math.min(1, Math.floor((level - 201) / 20));
            else if (level > 180) params.xCells = 15 + Math.min(1, Math.floor((level - 181) / 20));
            else if (level > 160) params.xCells = 14 + Math.min(1, Math.floor((level - 161) / 20));
            else if (level > 140) params.xCells = 13 + Math.min(1, Math.floor((level - 141) / 20));
            else if (level > 120) params.xCells = 12 + Math.min(1, Math.floor((level - 121) / 20));
            else if (level > 100) params.xCells = 11 + Math.min(1, Math.floor((level - 101) / 20));
            else if (level > 80) params.xCells = 10 + Math.min(1, Math.floor((level - 81) / 20));
            else if (level > 60) params.xCells = 9 + Math.min(1, Math.floor((level - 61) / 20));
            else if (level > 40) params.xCells = 8 + Math.min(1, Math.floor((level - 41) / 20));
            else if (level > 20) params.xCells = 7 + Math.min(1, Math.floor((level - 21) / 20));

            const maxPossibleXCells = params.rows * params.cols;
            params.xCells = Math.min(params.xCells, maxPossibleXCells, 20);
            if (maxPossibleXCells > 1 && params.xCells < 2) { params.xCells = 2; }
            else if (maxPossibleXCells === 1) { params.xCells = 1; }

            params.timeLimit = BASE_TIME_LIMIT + params.timeAddition;
            return params;
        },

        startLevel(restoredState = null) {
            this.isGameOver = false; this.isDrawing = false; this.currentPath = [];
            this.clearSvgPath();
            numbersSvgElement.innerHTML = '';
            this.svgNumberElements = {};
            this.expectedNextValue = 1;
            if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; }
            this.isGenerating = false; this.isPaused = false;

            puzzleGridElement?.classList.remove('paused');
            pathSvgElement?.classList.remove('paused');
            numbersSvgElement?.classList.remove('paused');
            document.getElementById('pauseOverlay')?.classList.remove('show');

            let initialTime = null;

            if (restoredState) {
                this.level = restoredState.level; this.points = restoredState.points; this.gridRows = restoredState.gridRows; this.gridCols = restoredState.gridCols; this.xCells = restoredState.xCells; this.timeLimit = restoredState.timeLimit; this.expectedNextValue = restoredState.expectedNextValue; this.numberPositions = restoredState.numberPositions;
                const elapsedSeconds = Math.floor((Date.now() - restoredState.saveTimestamp) / 1000);
                initialTime = restoredState.timeRemaining - elapsedSeconds;
                this.isPaused = restoredState.isPaused ?? false;
                this.pathPoints = restoredState.pathPointsData || [];
            } else {
                const params = this._calculateLevelParams();
                this.gridRows = params.rows; this.gridCols = params.cols; this.xCells = params.xCells; this.timeLimit = params.timeLimit;
                this.numberPositions = {}; this.pathPoints = []; this.isPaused = false;
            }

            if (initialTime !== null && initialTime <= 0) {
                this.timeRemaining = 0; this.updateUI();
                this.handleGameOver("Time ran out while away!", true);
                puzzleGridElement.innerHTML = '<div class="generating-text">Game Over!</div>';
                this.disableInput(); restartGameButton.disabled = false; return;
            }

            const baseCellSizeForLevel = restoredState ? restoredState.calculatedCellSize : this._calculateLevelParams().baseCellSize;
            const containerPadding = 60; const gridBorder = 4;
            const availableWidth = window.innerWidth - containerPadding - gridBorder;
            const availableHeight = window.innerHeight * 0.6 - gridBorder;
            const maxCellWidth = Math.floor(availableWidth / this.gridCols);
            const maxCellHeight = Math.floor(availableHeight / this.gridRows);
            this.calculatedCellSize = Math.min(maxCellWidth, maxCellHeight);
            this.calculatedCellSize = Math.min(this.calculatedCellSize, baseCellSizeForLevel);
            this.calculatedCellSize = Math.max(MIN_CELL_SIZE, this.calculatedCellSize);

            this.timeRemaining = (initialTime !== null && initialTime > 0) ? Math.floor(initialTime) : this.timeLimit;

            this.updateUI();
            this.updateSvgPath();

            this.stopTimer(); if (nextLevelButton) nextLevelButton.style.display = 'none';
            this.disableInput();

            if (restoredState) {
                this._buildGridUIFromState(restoredState);
                if (this.isPaused) {
                    puzzleGridElement?.classList.add('paused');
                    pathSvgElement?.classList.add('paused');
                    numbersSvgElement?.classList.add('paused');
                    document.getElementById('pauseOverlay')?.classList.add('show');
                    this.updatePauseButton();
                } else {
                    this.startTimer();
                }
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

        updateUI() {
            if (levelDisplayElement) levelDisplayElement.textContent = `Level: ${this.level}`;
            this.updatePointsDisplay();
            this.updateTimerDisplay();
            this.updateSoundButtonIcon();
            this.updatePauseButton();
        },

        generatePuzzleAsync() {
            if (!window.Worker) { this.showMessage("Error: Browser doesn't support background generation.", "gen_error"); puzzleGridElement.innerHTML = 'Error: Workers not supported!'; this.isGenerating = false; this.enableInput(); return; }
            try { this.pathFindingWorker = new Worker('pathfinder.js'); }
            catch (e) { console.error("Main: Failed to create worker!", e); this.isGenerating = false; this.showMessage("Error creating generation process.", "gen_error"); puzzleGridElement.innerHTML = 'Error: Generation failed!'; this.enableInput(); return; }

            this.pathFindingWorker.onmessage = (event) => {
                this.isGenerating = false;
                if (event.data.success) {
                    this._finishPuzzleGeneration(event.data.path);
                    this.startTimer(); this.enableInput();
                } else {
                    console.error("Main: Path generation failed.", event.data.reason || event.data.error);
                    this.showMessage(`Error generating level (${event.data.reason || 'Error'}). Try resetting.`, "gen_fail", true);
                    puzzleGridElement.innerHTML = '<div class="generating-text">Generation Failed!</div>';
                    this.disableInput(); restartGameButton.disabled = false;
                }
                if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; }
            };

            this.pathFindingWorker.onerror = (error) => {
                console.error("Main: Worker error:", error.message, error);
                this.isGenerating = false;
                this.showMessage(`Generation error (${error.message || 'Worker Error'}). Reset.`, "gen_error", true);
                puzzleGridElement.innerHTML = '<div class="generating-text">Generation Error!</div>';
                this.disableInput(); restartGameButton.disabled = false;
                if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; }
            };

            this.pathFindingWorker.postMessage({ gridRows: this.gridRows, gridCols: this.gridCols, maxAttempts: this.MAX_HAMILTONIAN_ATTEMPTS });
        },

        _finishPuzzleGeneration(hamiltonianPath) {
            this.numberPositions = {};
            const totalCells = this.gridRows * this.gridCols;
            this.numberPositions[hamiltonianPath[0]] = 1;
            if (this.xCells > 1) { this.numberPositions[hamiltonianPath[totalCells - 1]] = this.xCells; }
            if (this.xCells > 2) {
                const intermediateIndices = Array.from({ length: totalCells - 2 }, (_, i) => i + 1);
                const shuffledIntermediate = this.shuffle(intermediateIndices);
                const chosenIntermediateIndices = shuffledIntermediate.slice(0, this.xCells - 2).sort((a, b) => a - b);
                for (let i = 0; i < chosenIntermediateIndices.length; i++) {
                    this.numberPositions[hamiltonianPath[chosenIntermediateIndices[i]]] = i + 2;
                }
            }
            this._buildGridUIFromState({ numberPositions: this.numberPositions });
        },

        _buildGridUIFromState(state) {
            puzzleGridElement.innerHTML = '';
            numbersSvgElement.innerHTML = '';
            this.svgNumberElements = {};

            puzzleGridElement.style.gridTemplateRows = `repeat(${this.gridRows}, ${this.calculatedCellSize}px)`;
            puzzleGridElement.style.gridTemplateColumns = `repeat(${this.gridCols}, ${this.calculatedCellSize}px)`;
            puzzleGridElement.style.setProperty('--cell-size', `${this.calculatedCellSize}px`);

            const tempGrid = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(null));
            for (let r = 0; r < this.gridRows; r++) {
                for (let c = 0; c < this.gridCols; c++) {
                    const cell = document.createElement('div');
                    const cellKey = `${r}-${c}`;
                    cell.classList.add('cell');
                    cell.dataset.row = r; cell.dataset.col = c;
                    cell.dataset.value = this.numberPositions[cellKey] || '';
                    cell.style.width = `${this.calculatedCellSize}px`;
                    cell.style.height = `${this.calculatedCellSize}px`;
                    cell.addEventListener('mousemove', this.handleMouseMove.bind(this));
                    tempGrid[r][c] = cell;
                    puzzleGridElement.appendChild(cell);
                }
            }
            this.currentPuzzle = tempGrid;

            if (state.currentPathData) {
                this.currentPath = state.currentPathData.map(stepData => {
                    const [r, c] = stepData.coords.split('-').map(Number);
                    const cell = this.currentPuzzle?.[r]?.[c];
                    if (!cell) return null;
                    cell.classList.add('selected');
                    return { cell: cell, expectedValueBeforeEntering: stepData.expectedValue };
                }).filter(step => step !== null);
                this.updateSvgPath();
            } else {
                this.currentPath = [];
                this.clearSvgPath();
            }

            this.drawNumbersOnSvg();

            this.currentPuzzle.flat().forEach(cell => {
                cell.addEventListener('mousedown', this.handleMouseDown.bind(this));
                cell.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating || this.isPaused) return; const touch = e.touches[0]; const simulatedEvent = { target: touch.target, clientX: touch.clientX, clientY: touch.clientY }; this.handleMouseDown(simulatedEvent); }, { passive: true });
            });
        },

        isValid(r, c) { return r >= 0 && r < this.gridRows && c >= 0 && c < this.gridCols; },
        isNeighbor(cell1, cell2) { if (!cell1 || !cell2) return false; const r1 = parseInt(cell1.dataset.row); const c1 = parseInt(cell1.dataset.col); const r2 = parseInt(cell2.dataset.row); const c2 = parseInt(cell2.dataset.col); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; },
        shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },

        handleMouseDown(e) {
            if (this.isGameOver || this.isGenerating || this.isPaused || this.isAnimatingClick) return;
            const cell = e.target.closest('.cell');
            if (!cell) return;

            const value = parseInt(cell.dataset.value) || null;
            const isPathEmpty = this.currentPath.length === 0;
            const lastPathStep = isPathEmpty ? null : this.currentPath[this.currentPath.length - 1];
            const lastCell = lastPathStep?.cell;

            if (isPathEmpty && value === 1) {
                this.isDrawing = true;
                this.addStep(cell, false); // Add first step instantly
                const center = this.getCellCenter(cell);
                this.tempLineElement.setAttribute('x1', center.x); this.tempLineElement.setAttribute('y1', center.y);
                this.tempLineElement.setAttribute('x2', center.x); this.tempLineElement.setAttribute('y2', center.y);
                const lineThickness = Math.min(35, this.calculatedCellSize * 0.8);
                this.tempLineElement.setAttribute('stroke-width', lineThickness);
                this.tempLineElement.style.visibility = 'visible';
                return;
            }

            if (!isPathEmpty && cell === lastCell) {
                this.isDrawing = true;
                const center = this.getCellCenter(cell);
                this.tempLineElement.setAttribute('x1', center.x); this.tempLineElement.setAttribute('y1', center.y);
                this.tempLineElement.setAttribute('x2', center.x); this.tempLineElement.setAttribute('y2', center.y);
                const lineThickness = Math.min(35, this.calculatedCellSize * 0.8);
                this.tempLineElement.setAttribute('stroke-width', lineThickness);
                this.tempLineElement.style.visibility = 'visible';
                return;
            }

            this.isDrawing = false;
            if (this.tempLineElement) this.tempLineElement.style.visibility = 'hidden';

            if (this.currentPath.length > 1 && cell === this.currentPath[this.currentPath.length - 2].cell) {
                this.undoLastStep(false); return;
            }

            if (!isPathEmpty && this.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
                const isValidMove = (value === this.expectedNextValue) || (value === null);
                if (isValidMove) { this.addStep(cell, true); } // Animate click
                else { this.showMessage(`Path must follow sequence: ${this.expectedNextValue} expected.`, null, true); this.playSound(soundError); }
                return;
            }

            if (!isPathEmpty && !this.isNeighbor(lastCell, cell) && !cell.classList.contains('selected')) {
                this.showMessage("Must select an adjacent cell.", null, true); this.playSound(soundError); return;
            }

            if (!isPathEmpty && cell.classList.contains('selected') && cell !== lastCell) { return; }

            if (isPathEmpty && value !== 1) {
                this.showMessage("Path must start on number 1!", null, true); this.playSound(soundError); return;
            }
        },

        handleMouseMove(e) {
            if (!this.isDrawing || this.isGameOver || this.isGenerating || this.isPaused || this.isAnimatingClick) return;

            const coords = this.getRelativeCoords(e); // Raw cursor coords relative to grid

            // --- Update Follower Line Endpoint ---
            if (this.tempLineElement && this.pathPoints.length > 0) {
                const lastPointStr = this.pathPoints[this.pathPoints.length - 1];
                const [lastX, lastY] = lastPointStr.split(',').map(Number);

                const dx = coords.x - lastX;
                const dy = coords.y - lastY;
                let targetX = coords.x;
                let targetY = coords.y;

                // Axis-constraint logic
                if (Math.abs(dx) > Math.abs(dy)) { targetY = lastY; } // Horizontal dominant
                else { targetX = lastX; } // Vertical dominant or equal

                this.tempLineElement.setAttribute('x2', targetX);
                this.tempLineElement.setAttribute('y2', targetY);
            }

            // --- Check for Cell Entry / Path Update ---
            const col = Math.floor(coords.x / this.calculatedCellSize);
            const row = Math.floor(coords.y / this.calculatedCellSize);

            if (!this.isValid(row, col)) return; // Outside grid
            const currentCell = this.currentPuzzle?.[row]?.[col];
            if (!currentCell) return; // Should not happen if isValid passed

            const lastPathStep = this.currentPath.length > 0 ? this.currentPath[this.currentPath.length - 1] : null;
            const lastCell = lastPathStep?.cell;

            if (!lastCell || currentCell === lastCell) return; // No change needed

            // --- Handle Cell Change Logic ---
            if (this.currentPath.length > 1 && currentCell === this.currentPath[this.currentPath.length - 2].cell) {
                // Drag Undo
                this.undoLastStep(true); // true = during drag

                // Crucial: Update follower line's START point after undo
                if (this.tempLineElement && this.currentPath.length > 0) {
                    const newLastCell = this.currentPath[this.currentPath.length - 1].cell;
                    const center = this.getCellCenter(newLastCell);
                    this.tempLineElement.setAttribute('x1', center.x);
                    this.tempLineElement.setAttribute('y1', center.y);
                    // ALSO update endpoint immediately to prevent visual jump
                    this.tempLineElement.setAttribute('x2', center.x);
                    this.tempLineElement.setAttribute('y2', center.y);
                }
            }
            else if (!currentCell.classList.contains('selected') && this.isNeighbor(lastCell, currentCell)) {
                // Drag Forward to a valid neighbor
                const currentValue = parseInt(currentCell.dataset.value) || null;
                const isValidMove = (currentValue === this.expectedNextValue) || (currentValue === null);
                if (isValidMove) {
                    this.addStep(currentCell, false); // Add step instantly (no animation)

                    // Crucial: Update follower line's START point after adding step
                    if (this.tempLineElement) {
                        const center = this.getCellCenter(currentCell);
                        this.tempLineElement.setAttribute('x1', center.x);
                        this.tempLineElement.setAttribute('y1', center.y);
                        // ALSO update endpoint immediately to prevent visual jump
                        this.tempLineElement.setAttribute('x2', center.x);
                        this.tempLineElement.setAttribute('y2', center.y);
                    }
                }
                // If move is not valid sequence-wise, DO NOTHING during drag
            }
        },

        handleMouseUp() {
            if (this.isDrawing) {
                this.isDrawing = false;
                if (this.tempLineElement) {
                    this.tempLineElement.style.visibility = 'hidden'; // Hide follower line
                }
                // Only check win if not paused or animating a click that just finished
                if (!this.isGameOver && !this.isPaused && !this.isAnimatingClick && this.currentPath.length === (this.gridRows * this.gridCols)) {
                    this.checkWinCondition();
                }
            }
        },

        addStep(cell, animate = false) {
            if (animate && this.isAnimatingClick) return; // Prevent double-clicks causing issues

            const currentValue = parseInt(cell.dataset.value) || null;
            const previousExpectedValue = this.expectedNextValue;
            const cellKey = `${cell.dataset.row}-${cell.dataset.col}`;
            const targetCoords = this.getCellCenter(cell);
            const targetPointString = `${targetCoords.x},${targetCoords.y}`;

            cell.classList.add('selected');
            this.updateSvgNumberSelection(cellKey, true);
            this.currentPath.push({ cell: cell, expectedValueBeforeEntering: previousExpectedValue });
            this.enableInput();

            if (currentValue === previousExpectedValue) { this.playSound(soundTick); this.expectedNextValue++; }
            else { if (animate || !this.isDrawing) { this.playSound(soundTick); } }

            if (animate && this.currentPath.length > 1) {
                this.isAnimatingClick = true;
                const startPointString = this.pathPoints[this.pathPoints.length - 1];
                const [startX, startY] = startPointString.split(',').map(Number);
                const animLine = document.createElementNS(SVG_NS, 'line');
                animLine.setAttribute('x1', startX); animLine.setAttribute('y1', startY);
                animLine.setAttribute('x2', targetCoords.x); animLine.setAttribute('y2', targetCoords.y);
                animLine.classList.add('click-animation-segment');
                const lineThickness = Math.min(35, this.calculatedCellSize * 0.8);
                animLine.setAttribute('stroke-width', lineThickness);
                pathSvgElement.appendChild(animLine);
                const deltaX = targetCoords.x - startX; const deltaY = targetCoords.y - startY;
                const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                animLine.style.strokeDasharray = length; animLine.style.strokeDashoffset = length;
                requestAnimationFrame(() => { requestAnimationFrame(() => { animLine.style.strokeDashoffset = 0; }); });
                const timerId = setTimeout(() => {
                    this.pathPoints.push(targetPointString);
                    this.updateSvgPath();
                    if (animLine.parentNode) { pathSvgElement.removeChild(animLine); }
                    this.isAnimatingClick = false;
                    this.currentClickAnimation = null;
                    this.enableInput();
                    if (this.currentPath.length === (this.gridRows * this.gridCols)) { this.checkWinCondition(); }
                }, ANIMATION_DURATION_CLICK);
                this.currentClickAnimation = { line: animLine, timerId: timerId };
            } else {
                this.pathPoints.push(targetPointString);
                this.updateSvgPath();
                if (!animate && this.currentPath.length === (this.gridRows * this.gridCols)) { this.checkWinCondition(); }
            }
        },

        handleUndo() {
            if (this.isGameOver || this.isGenerating || this.isDrawing || this.isPaused) return;
            this.clearClickAnimation();
            if (this.tempLineElement) this.tempLineElement.style.visibility = 'hidden';

            if (this.currentPath.length > 0) {
                this.undoLastStep(false);
                this.enableInput();
            } else {
                this.showMessage("Cannot undo further.", null, true);
                this.playSound(soundError);
            }
        },
        handleResetLevel() { if (this.isGenerating || this.isGameOver || this.isPaused) return; if (this.level > 1 && this.points < RESET_PENALTY) { this.showMessage(`Need ${RESET_PENALTY} points to reset!`, null, true); this.playSound(soundError); return; } let penaltyMsg = ""; if (this.level > 1) { this.points = Math.max(0, this.points - RESET_PENALTY); this.savePoints(); this.updatePointsDisplay(); penaltyMsg = `(-${RESET_PENALTY} Points)`; } this.clearFullGameState(); this.stopTimer(); if (this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.startLevel(); this.showMessage(`Level Reset! ${penaltyMsg}`); },
        handleNextLevel() { if (this.isGenerating || !this.isGameOver || this.isPaused) return; const lastCell = this.currentPath?.[this.currentPath.length - 1]?.cell; const lastCellValue = lastCell ? parseInt(lastCell.dataset.value) : NaN; if (lastCellValue === this.xCells && this.currentPath.length === this.gridRows * this.gridCols) { this.clearFullGameState(); this.level++; this.saveLevel(); this.startLevel(); } else { this.showMessage("Win condition error. Cannot proceed.", null, true); } },
        handleRestartGame() { if (!this.isPaused && !this.isGameOver && !this.isGenerating) { this.pauseGame(false); } this.showRestartModal(); },
        handleSoundToggle() { this.isMuted = !this.isMuted; this.saveSoundPreference(); this.updateSoundButtonIcon(); if (!this.isMuted) { this.playSound(soundTick, true); } },
        handleClearPath() {
            if (this.isGameOver || this.isGenerating || this.isDrawing || this.isPaused) return;
            if (this.currentPath.length === 0) { this.showMessage("Nothing to clear.", null, true); return; }
            this.clearClickAnimation();
            if (this.tempLineElement) this.tempLineElement.style.visibility = 'hidden';
            this.currentPath.forEach(step => {
                const cellKey = `${step.cell.dataset.row}-${step.cell.dataset.col}`;
                step.cell.classList.remove('selected');
                this.updateSvgNumberSelection(cellKey, false);
            });
            this.currentPath = [];
            this.clearSvgPath();
            this.expectedNextValue = 1;
            this.playSound(soundError);
            this.enableInput();
        },
        handlePauseToggle() { if (this.isGameOver || this.isGenerating) return; if (this.isPaused) { this.continueGame(); } else { this.pauseGame(); } },

        pauseGame(saveState = true) {
            if (this.isPaused || this.isGameOver || this.isGenerating) return;
            this.isDrawing = false;
            this.clearClickAnimation();
            if (this.tempLineElement) this.tempLineElement.style.visibility = 'hidden';
            this.isPaused = true;
            this.stopTimer();

            puzzleGridElement?.classList.add('paused');
            pathSvgElement?.classList.add('paused');
            numbersSvgElement?.classList.add('paused');
            document.getElementById('pauseOverlay')?.classList.add('show');

            this.showMessage('Game Paused');
            if (saveState) { this.saveFullGameState(); }
            this.updatePauseButton();
            this.enableInput();
        },
        continueGame() {
            if (!this.isPaused || this.isGameOver || this.isGenerating) return;
            this.isPaused = false;

            puzzleGridElement?.classList.remove('paused');
            pathSvgElement?.classList.remove('paused');
            numbersSvgElement?.classList.remove('paused');
            document.getElementById('pauseOverlay')?.classList.remove('show');

            this.showMessage('Game Continued');
            this.startTimer();
            this.updatePauseButton();
            this.enableInput();
        },

        performRestart() { this.clearFullGameState(); if (this.isGenerating && this.pathFindingWorker) { this.pathFindingWorker.terminate(); this.pathFindingWorker = null; } this.isGenerating = false; this.stopTimer(); this.level = 1; this.points = 0; this.savePoints(); this.saveLevel(); this.startLevel(); this.showMessage("Game Restarted!"); },
        showRestartModal() { if (restartModalOverlay) restartModalOverlay.classList.add('show'); },
        hideRestartModal() { if (restartModalOverlay) restartModalOverlay.classList.remove('show'); },

        undoLastStep(isDuringDrag) {
            this.clearClickAnimation(); // Always clear click animation on undo
            // Don't hide tempLine during drag undo, it will be repositioned in mousemove
            // if (this.tempLineElement && !isDuringDrag) this.tempLineElement.style.visibility = 'hidden';

            if (this.currentPath.length <= 0) return; // Can't undo if path is empty

            const removedStep = this.currentPath.pop();
            const cellKey = `${removedStep.cell.dataset.row}-${removedStep.cell.dataset.col}`;
            removedStep.cell.classList.remove('selected');
            this.updateSvgNumberSelection(cellKey, false);

            if (this.pathPoints.length > 0) { this.pathPoints.pop(); } // Remove point data
            this.updateSvgPath(); // Redraw main polyline instantly

            this.expectedNextValue = removedStep.expectedValueBeforeEntering;

            // Play sound only on non-drag undo if path still exists
            if (!isDuringDrag && this.currentPath.length > 0) { this.playSound(soundTick); }
            // Play error sound if non-drag undo clears the path
            else if (!isDuringDrag && this.currentPath.length === 0) { this.playSound(soundError); }
        },

        checkWinCondition() {
            if (this.isGameOver || this.isAnimatingClick) return;
            const totalCells = this.gridRows * this.gridCols;
            const pathLength = this.currentPath.length;
            if (pathLength !== totalCells) return;
            const correctSequence = this.expectedNextValue > this.xCells;
            const lastCell = this.currentPath[pathLength - 1].cell;
            const lastVal = parseInt(lastCell.dataset.value);
            const endCorrect = lastVal === this.xCells;
            if (correctSequence && endCorrect) {
                this.clearFullGameState(); this.isGameOver = true; this.stopTimer();
                this.points += (this.level * 10) + Math.max(0, this.timeRemaining);
                this.savePoints(); this.updatePointsDisplay();
                this.showMessage(`Level ${this.level} Complete! Points: ${this.points}`);
                this.playSound(soundWin);
                this.disableInput();
                if (nextLevelButton) { nextLevelButton.style.display = 'inline-block'; nextLevelButton.disabled = false; }
                restartGameButton.disabled = false;
            } else {
                if (!endCorrect) { this.showMessage(`Path must end on ${this.xCells}.`, null, true); this.playSound(soundError); }
                else if (!correctSequence) { this.showMessage(`Connect numbers 1 to ${this.xCells} in order.`, null, true); this.playSound(soundError); }
                if (nextLevelButton) nextLevelButton.style.display = 'none';
            }
        },

        startTimer() { this.stopTimer(); if (this.isGameOver || this.isGenerating || this.timeRemaining <= 0 || this.isPaused) return; this.updateTimerDisplay(); this.timerInterval = setInterval(() => { this.timeRemaining--; this.updateTimerDisplay(); if (this.timeRemaining <= 0) { this.handleGameOver("Time's up!"); } }, 1000); },
        stopTimer() { clearInterval(this.timerInterval); this.timerInterval = null; },
        updateTimerDisplay() { const minutes = String(Math.floor(this.timeRemaining / 60)).padStart(2, '0'); const seconds = String(this.timeRemaining % 60).padStart(2, '0'); if (timerElement) timerElement.textContent = `Time: ${minutes}:${seconds}`; },

        handleGameOver(reason, fromLoad = false) { if (this.isGameOver) return; this.isGameOver = true; this.stopTimer(); this.isDrawing = false; this.clearClickAnimation(); if (this.tempLineElement) this.tempLineElement.style.visibility = 'hidden'; this.clearFullGameState(); this.disableInput(); if (nextLevelButton) nextLevelButton.style.display = 'none'; this.showMessage(reason + " Game Over!"); this.playSound(soundLose); restartGameButton.disabled = false; if (reason === "Time's up!" && !fromLoad) { this.saveLevel(1); this.savePoints(0); } },

        updatePointsDisplay() { if (pointsDisplayElement) pointsDisplayElement.textContent = `Points: ${this.points}`; },
        savePoints(newPoints = this.points) { try { this.points = Math.max(0, newPoints); localStorage.setItem('zipItHighPoints', this.points.toString()); this.updatePointsDisplay(); } catch (e) { console.warn("Could not save points:", e); } },
        loadPoints() { try { const savedPoints = localStorage.getItem('zipItHighPoints'); this.points = savedPoints ? parseInt(savedPoints, 10) : 0; if (isNaN(this.points)) this.points = 0; } catch (e) { this.points = 0; console.warn("Could not load points:", e); } this.updatePointsDisplay(); },
        saveLevel(newLevel = this.level) { try { this.level = newLevel; localStorage.setItem('zipItCurrentLevel', this.level.toString()); } catch (e) { console.warn("Could not save level:", e); } },
        loadLevel() { try { const savedLevel = localStorage.getItem('zipItCurrentLevel'); const parsedLevel = savedLevel ? parseInt(savedLevel, 10) : 1; this.level = (parsedLevel && parsedLevel > 0) ? parsedLevel : 1; } catch (e) { this.level = 1; console.warn("Could not load level:", e); } },
        saveSoundPreference() { try { localStorage.setItem('zipItSoundMuted', this.isMuted ? 'true' : 'false'); } catch (e) { console.warn("Could not save sound pref:", e); } },
        loadSoundPreference() { try { const savedMuted = localStorage.getItem('zipItSoundMuted'); this.isMuted = savedMuted === 'true'; } catch (e) { this.isMuted = false; console.warn("Could not load sound pref:", e); } this.updateSoundButtonIcon(); },

        saveFullGameState() {
            if (this.isGameOver || this.isGenerating) { this.clearFullGameState(); return; }
            try {
                const pathData = this.currentPath.map(step => ({ coords: `${step.cell.dataset.row}-${step.cell.dataset.col}`, expectedValue: step.expectedValueBeforeEntering }));
                const stateToSave = { level: this.level, points: this.points, gridRows: this.gridRows, gridCols: this.gridCols, xCells: this.xCells, calculatedCellSize: this.calculatedCellSize, timeLimit: this.timeLimit, timeRemaining: this.timeRemaining, saveTimestamp: Date.now(), expectedNextValue: this.expectedNextValue, numberPositions: this.numberPositions, currentPathData: pathData, pathPointsData: this.pathPoints, isMuted: this.isMuted, isPaused: this.isPaused };
                localStorage.setItem(STORAGE_KEY_GAME_STATE, JSON.stringify(stateToSave));
            } catch (e) { console.warn("Could not save full game state:", e); }
        },
        loadFullGameState() {
            let restoredState = null;
            try {
                const savedStateJSON = localStorage.getItem(STORAGE_KEY_GAME_STATE);
                if (savedStateJSON) {
                    const parsedState = JSON.parse(savedStateJSON);
                    if (parsedState && typeof parsedState.level === 'number' && typeof parsedState.points === 'number' && typeof parsedState.timeRemaining === 'number' && parsedState.numberPositions) { restoredState = parsedState; }
                    else { console.warn("Invalid saved state found, clearing."); this.clearFullGameState(); }
                }
            } catch (e) { this.clearFullGameState(); console.warn("Could not load full game state:", e); }

            if (restoredState) { this.startLevel(restoredState); localStorage.removeItem(STORAGE_KEY_GAME_STATE); }
            else { this.loadPoints(); this.loadLevel(); this.startLevel(); }
        },
        clearFullGameState() { try { localStorage.removeItem(STORAGE_KEY_GAME_STATE); } catch (e) { console.warn("Could not clear game state:", e); } },

        disableInput() { undoButton.disabled = true; clearPathButton.disabled = true; resetLevelButton.disabled = true; pauseButton.disabled = true; restartGameButton.disabled = false; nextLevelButton.disabled = true; if (nextLevelButton) nextLevelButton.style.display = 'none'; },
        enableInput() { const canInteract = !this.isGameOver && !this.isGenerating && !this.isPaused && !this.isAnimatingClick; const canPause = !this.isGameOver && !this.isGenerating; const isGameWon = this.isGameOver && this.currentPath.length === (this.gridRows * this.gridCols) && this.expectedNextValue > this.xCells; undoButton.disabled = !canInteract || this.currentPath.length <= 0; clearPathButton.disabled = !canInteract || this.currentPath.length === 0; resetLevelButton.disabled = !canInteract || (this.level > 1 && this.points < RESET_PENALTY); pauseButton.disabled = !canPause; restartGameButton.disabled = false; nextLevelButton.disabled = !isGameWon; if (nextLevelButton) { nextLevelButton.style.display = isGameWon ? 'inline-block' : 'none'; } },

        getPathValues() { if (!this.currentPath?.length) return ""; try { return this.currentPath.map(step => step?.cell?.dataset?.value || 'E').join(' -> '); } catch (e) { return "Error"; } },
        showMessage(message, id = null, debounce = false) { const now = Date.now(); if (debounce && message === this.lastMessage.text && (now - this.lastMessage.timestamp < MIN_MSG_INTERVAL)) return; this.lastMessage.text = message; this.lastMessage.timestamp = now; if (id) this.hideMessage(id); const mb = document.createElement('div'); mb.className = 'message-box'; if (id) mb.dataset.messageId = id; const mt = document.createElement('span'); mt.textContent = message; const cb = document.createElement('button'); cb.className = 'close-button'; cb.innerHTML = '×'; cb.setAttribute('aria-label', 'Close message'); const closeMsg = () => { if (mb.parentElement) { mb.classList.add('hide'); mb.addEventListener('transitionend', () => mb.remove(), { once: true }); } }; cb.onclick = closeMsg; mb.append(mt, cb); messageContainer.appendChild(mb); requestAnimationFrame(() => requestAnimationFrame(() => mb.classList.add('show'))); const autoClose = setTimeout(closeMsg, MSG_DISPLAY_TIME); cb.addEventListener('click', () => clearTimeout(autoClose)); },
        hideMessage(id) { const msg = messageContainer.querySelector(`.message-box[data-message-id="${id}"]`); if (msg) msg.querySelector('.close-button')?.click(); },
        playSound(audioElement, forcePlay = false) { if (this.isMuted && !forcePlay) return; if (audioElement) { audioElement.currentTime = 0; audioElement.play().catch(e => { if (e.name !== 'NotAllowedError') { console.warn("Audio play failed:", e.name); } }); } },
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

            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
            document.addEventListener('mouseleave', this.handleMouseUp.bind(this));
            document.addEventListener('dragstart', (e) => e.preventDefault());

            let isTouching = false;
            puzzleGridElement?.addEventListener('touchstart', (e) => { if (this.isGameOver || this.isGenerating || this.isPaused || this.isAnimatingClick) return; const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); const cell = targetElement?.closest('.cell'); if (cell) { isTouching = true; this.handleMouseDown({ target: cell, clientX: touch.clientX, clientY: touch.clientY }); } else { isTouching = false; } }, { passive: true }); // Keep passive true if possible for start
            document.addEventListener('touchmove', (e) => { if (!isTouching || this.isGenerating || this.isPaused || this.isAnimatingClick) return; if (this.isDrawing) { e.preventDefault(); } const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); this.handleMouseMove({ target: targetElement, clientX: touch.clientX, clientY: touch.clientY }); }, { passive: false }); // Need false to prevent default during draw
            document.addEventListener('touchend', (e) => { if (!isTouching) return; isTouching = false; this.handleMouseUp(); });
            document.addEventListener('touchcancel', (e) => { if (!isTouching) return; isTouching = false; this.handleMouseUp(); });

            window.addEventListener('beforeunload', () => this.saveFullGameState());
            document.addEventListener('visibilitychange', () => { if (document.hidden && !this.isGameOver && !this.isGenerating && !this.isPaused) { this.pauseGame(); } });
        }
    };

    game.init();
});