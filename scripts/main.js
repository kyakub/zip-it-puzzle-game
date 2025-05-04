import { config } from './config.js';
import { getState, updateState } from './state.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as persistence from './persistence.js';
import * as timer from './timer.js';
import * as logic from './logic.js';
import * as input from './input.js';

document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        puzzleGridElement: document.getElementById('puzzleGrid'),
        timerElement: document.getElementById('timer'),
        pointsDisplayElement: document.getElementById('pointsDisplay'),
        levelDisplayElement: document.getElementById('levelDisplay'),
        undoButton: document.getElementById('undoButton'),
        clearPathButton: document.getElementById('clearPathButton'),
        resetLevelButton: document.getElementById('resetLevelButton'),
        restartGameButton: document.getElementById('restartGameButton'),
        pauseButton: document.getElementById('pauseButton'),
        nextLevelButton: document.getElementById('nextLevelButton'),
        messageContainer: document.getElementById('messageContainer'),
        restartModalOverlay: document.getElementById('restartModalOverlay'),
        modalConfirmRestart: document.getElementById('modalConfirmRestart'),
        modalCancelRestart: document.getElementById('modalCancelRestart'),
        soundToggleButton: document.getElementById('soundToggle'),
        pathSvgElement: document.getElementById('pathSvg'),
        numbersSvgElement: document.getElementById('numbersSvg'),
        soundTick: document.getElementById('soundTick'),
        soundError: document.getElementById('soundError'),
        soundWin: document.getElementById('soundWin'),
        soundLose: document.getElementById('soundLose'),
    };

    function init() {
        ui.initializeUI(elements);
        audio.initializeAudio({
            soundTick: elements.soundTick,
            soundError: elements.soundError,
            soundWin: elements.soundWin,
            soundLose: elements.soundLose,
        });
        input.initializeInput({ elements });

        const restoredState = persistence.loadFullGameState();

        if (restoredState) {
            logic.startLevel(restoredState.level, restoredState);
        } else {
            const level = persistence.loadLevel();
            const points = persistence.loadPoints();
            updateState({ level, points });
            logic.startLevel(level);
        }

        window.addEventListener('beforeunload', persistence.saveFullGameState);
        document.addEventListener('visibilitychange', logic.autoPause);
    }

    init();
});