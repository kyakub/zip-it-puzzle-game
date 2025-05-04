import { getState, updateState } from './state.js';
import { config } from './config.js';
import * as persistence from './persistence.js';

let audioElements = {};

export function initializeAudio(elements) {
    audioElements = elements;
    loadPreference();
}

export function playSound(soundType, forcePlay = false) {
    const { isMuted } = getState();
    const audioElement = audioElements[soundType];
    if ((isMuted && !forcePlay) || !audioElement) return;

    audioElement.currentTime = 0;
    audioElement.play().catch(e => {
        if (e.name !== 'NotAllowedError') {
            console.warn("Audio play failed:", e.name);
        }
    });
}

export function toggleMute(uiUpdateCallback) {
    const currentState = getState();
    updateState({ isMuted: !currentState.isMuted });
    savePreference();
    uiUpdateCallback(getState().isMuted);
    if (!getState().isMuted) {
        playSound('soundTick', true);
    }
}

function loadPreference() {
    const muted = persistence.loadData(config.STORAGE_KEY_SOUND);
    updateState({ isMuted: muted === 'true' });
}

function savePreference() {
    const { isMuted } = getState();
    persistence.saveData(config.STORAGE_KEY_SOUND, isMuted ? 'true' : 'false');
}