import { getState, updateState } from './state.js';
import * as ui from './ui.js';
import * as logic from './logic.js';

let timerInterval = null;

export function startTimer() {
    stopTimer();
    const { isGameOver, isGenerating, timeRemaining, isPaused } = getState();
    if (isGameOver || isGenerating || timeRemaining <= 0 || isPaused) return;

    ui.updateTimerDisplay(timeRemaining);
    timerInterval = setInterval(tick, 1000);
}

export function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function tick() {
    let { timeRemaining } = getState();
    timeRemaining--;
    updateState({ timeRemaining });
    ui.updateTimerDisplay(timeRemaining);

    if (timeRemaining <= 0) {
        logic.handleTimeUp();
    }
}