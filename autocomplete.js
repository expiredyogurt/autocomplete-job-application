// ==UserScript==
// @name         Jobstreet Auto Apply – LOOP + CTRL+TAB
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  Auto-apply + loop to next tab until no more jobs
// @match        *://*.jobstreet.com/*
// @match        *://*.jobstreet.*/*
// @match        *://apply.jobstreet.*/*
// @match        *://myjobstreet-apply.*/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const STORAGE_KEY = 'jobstreet_auto_state';
    const LOG = (...a) => console.log('%c[Jobstreet Auto]', 'color:#e91e63;font-weight:bold', ...a);

    let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { running: false, stage: 'quick', looping: false };
    let scanner = null;

    const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Panel
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:#fff;border:1px solid #ccc;padding:8px 12px;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,0.3);font-family:Arial;font-size:14px;';
    panel.innerHTML = `
        <button id="playBtn" style="margin-right:5px;">Play</button>
        <button id="loopBtn" style="margin-right:5px;background:#4CAF50;color:white;">Loop</button>
        <button id="stopBtn">Stop</button>
        <button id="resetBtn" style="margin-left:5px;font-size:10px;">Reset</button>
    `;
    document.body.appendChild(panel);

    document.getElementById('playBtn').onclick = () => {
        state.running = true; state.looping = false; state.stage = 'quick'; saveState(); LOG('PLAY ONCE'); startScanner();
    };

    document.getElementById('loopBtn').onclick = () => {
        state.running = true; state.looping = true; state.stage = 'quick'; saveState(); LOG('LOOP STARTED'); startScanner();
    };

    document.getElementById('stopBtn').onclick = () => {
        state.running = false; state.looping = false; saveState(); LOG('STOPPED'); clearInterval(scanner);
    };

    document.getElementById('resetBtn').onclick = () => {
        localStorage.removeItem(STORAGE_KEY); state = { running: false, stage: 'quick', looping: false }; LOG('RESET');
    };

    const clickButton = (candidates, avoid = [], oneClick = false) => {
        const els = document.querySelectorAll('button, a, span, label, div[role="button"], [onclick]');
        for (const el of els) {
            const txt = el.innerText.trim();
            const lower = txt.toLowerCase();
            if (avoid.some(a => lower.includes(a))) continue;
            if (candidates.some(c => lower.includes(c.toLowerCase()) || txt === c)) {
                if (oneClick && el.closest('input[type="radio"]')?.checked) {
                    LOG('ALREADY SELECTED →', txt);
                    return false;
                }
                LOG('CLICK →', txt);
                el.scrollIntoView({behavior:'instant', block:'center'});
                el.style.outline = '3px solid yellow';
                setTimeout(() => el.click(), 300);
                return true;
            }
        }
        LOG('MISS →', candidates.join(' | '));
        return false;
    };

    const clickOnce = (candidates, nextStage) => {
        const clicked = clickButton(candidates, [], true);
        if (clicked) { state.stage = nextStage; saveState(); }
        return clicked;
    };

    const continueLoop = () => {
        if (!state.running) return;
        if (clickButton(['continue', 'next', 'proceed', 'save and continue'], ['review', 'submit'])) {
            setTimeout(continueLoop, 1800);  // SLOW & RELIABLE
            return;
        }
        LOG('No more Continue → moving to submit');
        state.stage = 'submit'; saveState();
        setTimeout(run, 800);
    };

    const run = () => {
        if (!state.running) return;
        LOG('STAGE →', state.stage.toUpperCase());

        if (state.stage === 'quick') {
            if (clickOnce(['Quick apply', 'Apply now', 'Easy apply'], 'cover')) return;
            if (state.looping) {
                LOG('NO QUICK APPLY → END OF LOOP');
                state.running = false; saveState();
                return;
            }
            state.stage = 'cover'; saveState();
        }
        else if (state.stage === 'cover') {
            if (clickOnce(["Don't include a cover letter", 'No cover letter'], 'continue')) return;
            state.stage = 'continue'; saveState();
        }
        else if (state.stage === 'continue') {
            continueLoop();
        }
        else if (state.stage === 'submit') {
            if (clickButton(['Submit application', 'Send application'], ['review'])) {
                LOG('SUBMITTED');
                if (state.looping) {
                    setTimeout(() => {
                        LOG('SWITCHING TO NEXT TAB (Ctrl+Tab)');
                        // Simulate Ctrl + Tab
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true }));
                        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', ctrlKey: true, bubbles: true }));
                        // Reset stage for next job
                        state.stage = 'quick';
                        saveState();
                        setTimeout(run, 2000);  // Wait for tab switch
                    }, 1500);
                } else {
                    state.running = false; saveState();
                }
                return;
            }
        }
    };

    const startScanner = () => {
        clearInterval(scanner);
        scanner = setInterval(run, 800);
    };

    new MutationObserver(() => {
        if (state.running) {
            LOG('SPA CHANGE – resuming');
            clearInterval(scanner);
            setTimeout(startScanner, 600);
        }
    }).observe(document.body, { childList: true, subtree: true });

    if (state.running) startScanner();
    setTimeout(() => state.running && startScanner(), 300);
})();
