import { state } from '../state';
import { renderApp } from '../ui';

const $ = (selector: string) => document.querySelector(selector);

export function attachModalListeners() {
    $('#custom-modal-confirm-btn')?.addEventListener('click', () => state.customModal.onConfirm?.());
    $('#custom-modal-cancel-btn')?.addEventListener('click', () => { state.showCustomModal = false; renderApp(); });
    $('#custom-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget && state.customModal.isDismissible !== false) {
            state.showCustomModal = false; renderApp();
        }
    });
}
