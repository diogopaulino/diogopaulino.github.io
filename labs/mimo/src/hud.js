/**
 * Ligação HUD ↔ estado: barras, humor, dock de ações e overlays.
 */

import { NEED_KEYS, breedsOf, COATS } from './config.js';
import { moodLabel, formatAge } from './utils.js';

const $ = (sel) => document.querySelector(sel);

export class Hud {
    constructor() {
        this.els = {
            loading: $('#loadingOverlay'),
            loadingText: $('#loadingText'),
            loadingFill: $('#loadingFill'),
            welcome: $('#welcomeOverlay'),
            create: $('#createOverlay'),
            hud: $('#hud'),
            pause: $('#pauseOverlay'),
            error: $('#errorOverlay'),
            errorText: $('#errorText'),
            petName: $('#petName'),
            petMeta: $('#petMeta'),
            moodLine: $('#moodLine'),
            message: $('#message'),
            bars: NEED_KEYS.map((k) => ({
                key: k,
                fill: document.querySelector(`[data-need="${k}"]`),
                val: document.querySelector(`[data-need-val="${k}"]`)
            })),
            dock: $('#actionDock'),
            sound: $('#soundButton'),
            pauseBtn: $('#pauseButton'),
            welcomeName: $('#welcomeName'),
            stepSpecies: $('#stepSpecies'),
            stepBreed: $('#stepBreed'),
            stepStyle: $('#stepStyle'),
            breedGrid: $('#breedGrid'),
            coatGrid: $('#coatGrid'),
            nameInput: $('#petNameInput')
        };
    }

    setLoading(p, text) {
        if (this.els.loadingFill) this.els.loadingFill.style.width = `${Math.round(p * 100)}%`;
        if (text && this.els.loadingText) this.els.loadingText.textContent = text;
    }

    hideLoading() {
        if (this.els.loading) this.els.loading.hidden = true;
    }

    showError(msg) {
        if (this.els.error) this.els.error.hidden = false;
        if (this.els.errorText) this.els.errorText.textContent = msg;
        this.hideLoading();
    }

    showWelcome(profile) {
        this.els.welcome.hidden = false;
        this.els.create.hidden = true;
        this.els.hud.hidden = true;
        if (this.els.welcomeName) this.els.welcomeName.textContent = profile.name;
    }

    showCreate() {
        this.els.welcome.hidden = true;
        this.els.create.hidden = false;
        this.els.hud.hidden = true;
        this.setCreateStep('species');
    }

    showCare() {
        this.els.welcome.hidden = true;
        this.els.create.hidden = true;
        this.els.pause.hidden = true;
        this.els.hud.hidden = false;
    }

    setPaused(on) {
        this.els.pause.hidden = !on;
    }

    setCreateStep(step) {
        this.els.stepSpecies.hidden = step !== 'species';
        this.els.stepBreed.hidden = step !== 'breed';
        this.els.stepStyle.hidden = step !== 'style';
        document.querySelectorAll('[data-create-step]').forEach((btn) => {
            btn.setAttribute('aria-current', btn.dataset.createStep === step ? 'step' : 'false');
        });
    }

    fillBreeds(species, selected) {
        const list = breedsOf(species);
        this.els.breedGrid.innerHTML = list.map((b) => `
            <button type="button" class="breed-card${b.id === selected ? ' is-on' : ''}" data-breed="${b.id}">
                <span class="breed-emoji">${species === 'cat' ? '🐱' : '🐶'}</span>
                <strong>${b.name}</strong>
            </button>
        `).join('');
    }

    fillCoats(selected) {
        this.els.coatGrid.innerHTML = COATS.map((c) => `
            <button type="button" class="coat-swatch${c.id === selected ? ' is-on' : ''}"
                data-coat="${c.id}" title="${c.name}" aria-label="${c.name}"
                style="--sw: ${c.primary}; --sw2: ${c.secondary}"></button>
        `).join('');
    }

    syncProfile(profile) {
        const mood = moodLabel(profile.needs);
        this.els.petName.textContent = profile.name;
        const kind = profile.species === 'cat' ? 'gato' : 'cão';
        const breed = breedsOf(profile.species).find((b) => b.id === profile.breed);
        this.els.petMeta.textContent = `${breed?.name || ''} · ${kind} · ${formatAge(Date.now() - profile.bornAt)}`;
        this.els.moodLine.textContent = `${mood.emoji} ${profile.name} está ${mood.text}`;
        for (const bar of this.els.bars) {
            const v = profile.needs[bar.key];
            if (bar.fill) bar.fill.style.width = `${v}%`;
            if (bar.val) bar.val.textContent = `${Math.round(v)}`;
            bar.fill?.parentElement?.classList.toggle('is-low', v < 28);
        }
    }

    say(text) {
        const el = this.els.message;
        if (!el) return;
        el.textContent = text;
        el.dataset.show = 'true';
        clearTimeout(this._msg);
        this._msg = setTimeout(() => { el.dataset.show = 'false'; }, 2800);
    }

    setMuted(on) {
        this.els.sound?.setAttribute('aria-pressed', on ? 'false' : 'true');
    }

    setBusy(on) {
        this.els.dock?.classList.toggle('is-busy', on);
        document.querySelectorAll('#actionDock button').forEach((b) => {
            b.disabled = on && b.dataset.action !== 'pet';
        });
    }
}
