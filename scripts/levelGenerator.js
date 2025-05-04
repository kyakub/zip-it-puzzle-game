import { getState, updateState, setWorker, terminateWorker } from './state.js';
import { config } from './config.js';
import * as ui from './ui.js';
import * as logic from './logic.js';
import * as timer from './timer.js';

// Removed obstaclePositions from signature
export function generateLevelAsync(gridRows, gridCols, onComplete) {
    updateState({ isGenerating: true });
    ui.showGeneratingText();
    ui.disableAllInput();

    if (!window.Worker) {
        ui.showMessage("Error: Browser doesn't support background generation.", "gen_error");
        ui.showGenerationErrorText('Error: Workers not supported!');
        updateState({ isGenerating: false });
        ui.updateButtonStates(getState());
        return;
    }

    try {
        const worker = new Worker('scripts/pathfinder.js');
        setWorker(worker);

        worker.onmessage = (event) => {
            updateState({ isGenerating: false });
            terminateWorker();
            if (event.data.success) {
                onComplete(event.data.path); // Path is now standard Hamiltonian path
            } else {
                console.error("Main: Path generation failed.", event.data.reason || event.data.error);
                const reason = event.data.reason || event.data.error || 'Unknown Error';
                ui.showMessage(`Error generating level (${reason}). Try restarting.`, "gen_fail", true);
                ui.showGenerationErrorText('Generation Failed!');
                ui.disableAllInput();
            }
        };

        worker.onerror = (error) => {
            console.error("Main: Worker error:", error.message, error);
            updateState({ isGenerating: false });
            terminateWorker();
            const message = error.message || 'Worker Error';
            ui.showMessage(`Generation error (${message}). Restart game.`, "gen_error", true);
            ui.showGenerationErrorText('Generation Error!');
            ui.disableAllInput();
        };

        // Send only grid dimensions and attempts
        worker.postMessage({
            gridRows: gridRows,
            gridCols: gridCols,
            maxAttempts: config.MAX_HAMILTONIAN_ATTEMPTS
            // Removed obstaclePositions
        });

    } catch (e) {
        console.error("Main: Failed to create worker!", e);
        updateState({ isGenerating: false });
        ui.showMessage("Error creating generation process.", "gen_error");
        ui.showGenerationErrorText('Error: Generation failed!');
        ui.updateButtonStates(getState());
    }
}