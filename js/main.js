



let state = {
    activeTab: 'passphrase',
    wordLengthMin: 0,
    wordLengthMax: 0,
    words: 4,
    separator: ' ',
    customSep: '',
    cap: 'lower',
    numPos: 'each',
    digits: 2,
    symbolPos: 'start',
    count: 5,
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    hideResults: false,
    results: [],
    history: [],
    digitalaiserRatio: 10,
    pwLength: 16,
    pwUpper: true,
    pwLower: true,
    pwDigits: true,
    pwSymbols: true,
    pwCount: 5,
    saveHistory: true,
    enableCap: false,
    enableNum: false,
    enabledigitalaiser: false,
    enableSymbols: false
};

function saveState() {
    localStorage.setItem('passgen_state_v2', JSON.stringify({ ...state, results: [] }));
    // Only persist history if the user opted in
    if (state.saveHistory) {
        localStorage.setItem('passgen_history', JSON.stringify(state.history));
    } else {
        localStorage.removeItem('passgen_history');
    }
}

const WORD_LENGTH_MIN = Math.min(...MASTER_WORDS.map(w => w.length));
const WORD_LENGTH_MAX = Math.max(...MASTER_WORDS.map(w => w.length));

function loadState() {
    const saved = localStorage.getItem('passgen_state_v2');
    if (saved) {
        Object.assign(state, JSON.parse(saved));
        if (state.theme === 'system') state.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // Only restore history if saving is enabled
    if (state.saveHistory) {
        const savedHistory = localStorage.getItem('passgen_history');
        if (savedHistory) state.history = JSON.parse(savedHistory);
    } else {
        state.history = [];
    }
}

function escapeCsvValue(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function getSecureInt(min, max) {
    const range = max - min + 1;
    if (range <= 0) throw new RangeError('Invalid range');
    const limit = Math.floor(0x100000000 / range) * range;
    const array = new Uint32Array(1);
    let value;
    do {
        window.crypto.getRandomValues(array);
        value = array[0];
    } while (value >= limit);
    return min + (value % range);
}

function getRandomDigitString(len) {
    let s = "";
    for (let i = 0; i < len; i++) s += getSecureInt(0, 9).toString();
    return s;
}

function getRandomSymbol() {
    return SYMBOLS[getSecureInt(0, SYMBOLS.length - 1)];
}

function getSelectedWordCount(min = state.wordLengthMin, max = state.wordLengthMax) {
    return MASTER_WORDS.filter(w => w.length >= min && w.length <= max).length;
}

function applyCap(word, mode) {
    if (mode === 'nocap') return word;
    if (mode === 'lower') return word.toLowerCase();
    if (mode === 'title') return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    if (mode === 'upper') return word.toUpperCase();
    if (mode === 'random') {
        let transformed = "";
        let hasUpper = false, hasLower = false;
        for (let i = 0; i < word.length; i++) {
            const isUpper = getSecureInt(0, 1) === 1;
            let char = word[i];
            if (i === word.length - 1) {
                if (!hasUpper) char = char.toUpperCase();
                else if (!hasLower) char = char.toLowerCase();
            } else {
                if (isUpper) { char = char.toUpperCase(); hasUpper = true; }
                else { char = char.toLowerCase(); hasLower = true; }
            }
            transformed += char;
        }
        return transformed;
    }
    return word.toLowerCase();
}

function generatePassphrases() {
    let pool = MASTER_WORDS.filter(w => w.length >= state.wordLengthMin && w.length <= state.wordLengthMax);

    document.getElementById('warning-box').classList.toggle('hidden', pool.length >= state.words * 2);

    const separator = state.customSep || state.separator;
    const results = [];

    for (let i = 0; i < state.count; i++) {
        let parts = [];
        for (let j = 0; j < state.words; j++) {
            let word = pool[getSecureInt(0, pool.length - 1)];

            const capMode = state.enableCap ? state.cap : 'lower';
            word = applyCap(word, capMode);

            if (state.enableNum && state.numPos === 'each') word += getRandomDigitString(state.digits);
            if (state.enableSymbols && state.symbolPos === 'each') word += getRandomSymbol();

            parts.push(word);
        }

        let phrase = parts.join(separator);

        if (state.enableNum && state.numPos === 'end') phrase += getRandomDigitString(state.digits);
        if (state.enableSymbols) {
            if (state.symbolPos === 'start') phrase = getRandomSymbol() + phrase;
            if (state.symbolPos === 'end') phrase = phrase + getRandomSymbol();
        }
        if (state.enabledigitalaiser) {
            phrase = leetTransform(phrase, state.digitalaiserRatio / 100);
        }
        results.push(phrase);
    }

    state.results = results;
    renderResults();
    saveState();
}

function leetTransform(text, probability = 0.5, rng = () => getSecureInt(0, 9999) / 10000) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    if (typeof probability !== 'number' || probability < 0 || probability > 1) {
        throw new RangeError('probability must be a number between 0 and 1');
    }
    if (typeof rng !== 'function') throw new TypeError('rng must be a function');
    const map = {
        a: '4', A: '4', e: '3', E: '3', i: '1', I: '1', o: '0',
        O: '0', s: '5', S: '5', b: '8', B: '8', g: '6', G: '6',
    };
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (map[ch] && rng() < probability) {
            out += map[ch];
        } else {
            out += ch;
        }
    }
    return out;
}

function switchTab(tab) {
    state.activeTab = tab;
    document.getElementById('tab-passphrase').classList.toggle('active', tab === 'passphrase');
    document.getElementById('tab-password').classList.toggle('active', tab === 'password');
    document.getElementById('tab-btn-passphrase').classList.toggle('active', tab === 'passphrase');
    document.getElementById('tab-btn-password').classList.toggle('active', tab === 'password');
    saveState();
    generate();
}

function generatePasswords() {
    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const DIGS = '0123456789';
    const SPEC = '!@#$%^&*()_+-=[]{}|;:,.?/~';

    const noneSelected = !state.pwUpper && !state.pwLower && !state.pwDigits && !state.pwSymbols;

    // If no boxes ticked, fall back to all character types
    const useUpper = state.pwUpper || noneSelected;
    const useLower = state.pwLower || noneSelected;
    const useDigits = state.pwDigits || noneSelected;
    const useSymbols = state.pwSymbols || noneSelected;

    // Build charset from selected sets ONLY (excluded types never appear)
    let charset = '';
    if (useUpper) charset += UPPER;
    if (useLower) charset += LOWER;
    if (useDigits) charset += DIGS;
    if (useSymbols) charset += SPEC;

    const results = [];
    for (let i = 0; i < state.pwCount; i++) {
        // Guarantee at least one character from each selected (or fallback) set
        const required = [];
        if (useUpper) required.push(UPPER[getSecureInt(0, UPPER.length - 1)]);
        if (useLower) required.push(LOWER[getSecureInt(0, LOWER.length - 1)]);
        if (useDigits) required.push(DIGS[getSecureInt(0, DIGS.length - 1)]);
        if (useSymbols) required.push(SPEC[getSecureInt(0, SPEC.length - 1)]);

        const actualLength = Math.max(state.pwLength, required.length);

        // Fill remaining length from the combined charset
        let pw = '';
        const remaining = actualLength - required.length;
        for (let j = 0; j < remaining; j++) {
            pw += charset[getSecureInt(0, charset.length - 1)];
        }

        // Splice guaranteed chars into random positions
        let arr = pw.split('');
        for (const ch of required) {
            arr.splice(getSecureInt(0, arr.length), 0, ch);
        }
        results.push(arr.join(''));
    }

    state.results = results;
    renderResults();
    saveState();
}

// ── Strength estimation ─────────────────────────────────────────────────────
function estimateStrength(password) {
    if (!password) return { level: 0, label: '' };

    // Detect which pools are present in the actual string
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);

    let pool = 0;
    if (hasLower) pool += 26;
    if (hasUpper) pool += 26;
    if (hasDigit) pool += 10;
    if (hasSymbol) pool += 32;
    if (pool === 0) pool = 26; // fallback

    const entropy = password.length * Math.log2(pool);
    const bits = Math.round(entropy);

    if (entropy < 50) return { level: 1, label: 'Weak', color: '#ef4444', bits };
    if (entropy < 127) return { level: 2, label: 'Fair', color: '#f97316', bits };
    if (entropy < 256) return { level: 3, label: 'Good', color: '#eab308', bits };
    if (entropy < 512) return { level: 4, label: 'Strong', color: '#22c55e', bits };
    return { level: 5, label: '😱 WOW!', color: '#ff00ea', bits };
}

function renderStrengthMeter() {
    const meter = document.getElementById('strength-meter');
    const text = document.getElementById('str-text');
    if (!meter || !text) return;

    if (state.results.length === 0) {
        meter.style.display = 'none';
        return;
    }

    const { level, label, color, bits } = estimateStrength(state.results[0]);
    meter.setAttribute('data-level', level);
    meter.style.display = 'flex';
    text.textContent = `${label} · ${bits} bits`;
    text.style.color = color;
}
// ────────────────────────────────────────────────────────────────────────────

function generate() {
    if (state.activeTab === 'password') generatePasswords();
    else generatePassphrases();
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!");
        addToHistory(text);
    } catch (err) { showToast("Copy failed", true); }
}

function addToHistory(text) {
    // Skip if user has opted out of saving history
    if (!state.saveHistory) return;
    const entry = {
        timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
        phrase: text
    };
    state.history.unshift(entry);
    if (state.history.length > 100) state.history.pop();
    renderHistory();
    saveState();
}

function exportCSV(filename, headers, dataRows) {
    const csvContent = headers.map(escapeCsvValue).join(",") + "\n" + dataRows.map(row => row.map(escapeCsvValue).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filename}`);
}

function renderResults() {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    state.results.forEach(p => {
        const div = document.createElement('div');
        div.className = 'passphrase-item';
        div.title = 'Click to copy';
        div.style.cursor = 'pointer';
        div.onclick = () => copyToClipboard(p);

        const blurClass = state.hideResults ? 'blurred-text' : 'unblurred-text';
        div.innerHTML = `<span class="${blurClass}" style="font-family: monospace; font-size: 1.1rem; width: 100%;">${p}</span>`;
        container.appendChild(div);
    });
    renderStrengthMeter();
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.title = 'Click to copy';
        div.style.cursor = 'pointer';
        div.onclick = () => copyToClipboard(item.phrase);

        const blurClass = state.hideResults ? 'blurred-text' : 'unblurred-text';
        div.innerHTML = `
            <span style="color: var(--secondary);">${item.timestamp}</span>
            <span class="${blurClass}" style="font-weight: 500; font-family: monospace;">${item.phrase}</span>
        `;
        container.appendChild(div);
    });
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.background = isError ? '#ef4444' : 'var(--toast-bg)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function applyTheme() {
    if (state.theme === 'system') state.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);

    // Update button text
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.innerText = state.theme === 'dark' ? '🌙 Dark' : '☀️ Light';
    }
}

function cycleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveState();
}

function init() {
    loadState();

    // Migrate legacy states from older formats to current defaults
    if (state.numPos === 'off') state.numPos = 'each';
    if (state.symbolPos === 'off') state.symbolPos = 'start';
    if (state.cap === 'nocap') state.cap = 'lower';
    if (state.enableCap === undefined) state.enableCap = false;
    if (state.enableNum === undefined) state.enableNum = false;
    if (state.enabledigitalaiser === undefined) state.enabledigitalaiser = false;
    if (state.enableSymbols === undefined) state.enableSymbols = false;

    const getEl = id => document.getElementById(id);
    const setVal = (id, val) => {
        const el = getEl(id);
        if (!el) return;
        if (el.type === 'range' || el.type === 'text' || el.type === 'number' || el.tagName === 'SELECT') el.value = val;
    };

    // Advanced features visibility toggle
    const updateVisibility = (btnId, contentId, stateProp) => {
        const checkbox = getEl(btnId);
        const content = getEl(contentId);
        if (checkbox) checkbox.checked = state[stateProp];
        if (content) content.classList.toggle('hidden', !state[stateProp]);
    };

    const setupSwitch = (btnId, contentId, stateProp) => {
        const checkbox = getEl(btnId);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                state[stateProp] = e.target.checked;
                updateVisibility(btnId, contentId, stateProp);
                saveState();
                generate();
            });
        }
        updateVisibility(btnId, contentId, stateProp);
    };

    setupSwitch('opt-enable-cap', 'grp-capitalization-content', 'enableCap');
    setupSwitch('opt-enable-num', 'grp-numbers-content', 'enableNum');
    setupSwitch('opt-enable-digitalaiser', 'grp-digitalizer-content', 'enabledigitalaiser');
    setupSwitch('opt-enable-symbols', 'grp-symbols-content', 'enableSymbols');

    // Keep inner sliders in sync when checkers toggle
    const numWrap = getEl('num-digits-wrap');
    const digiWrap = getEl('num-digitalaiser-wrap');
    const enableNumEl = getEl('opt-enable-num');
    const enableDigiEl = getEl('opt-enable-digitalaiser');
    if (enableNumEl) enableNumEl.addEventListener('change', () => {
        if (numWrap) numWrap.classList.toggle('hidden', !(state.enableNum && state.numPos === 'each'));
    });
    if (enableDigiEl) enableDigiEl.addEventListener('change', () => {
        if (digiWrap) digiWrap.classList.toggle('hidden', !state.enabledigitalaiser);
    });

    const wordMinEl = getEl('opt-word-min');
    const wordMaxEl = getEl('opt-word-max');
    if (wordMinEl) {
        wordMinEl.min = WORD_LENGTH_MIN;
        wordMinEl.max = WORD_LENGTH_MAX;
    }
    if (wordMaxEl) {
        wordMaxEl.min = WORD_LENGTH_MIN;
        wordMaxEl.max = WORD_LENGTH_MAX;
    }

    if (!state.wordLengthMin || state.wordLengthMin < WORD_LENGTH_MIN || state.wordLengthMin > WORD_LENGTH_MAX) state.wordLengthMin = WORD_LENGTH_MIN;
    if (!state.wordLengthMax || state.wordLengthMax < WORD_LENGTH_MIN || state.wordLengthMax > WORD_LENGTH_MAX) state.wordLengthMax = WORD_LENGTH_MAX;
    if (state.wordLengthMin > state.wordLengthMax) [state.wordLengthMin, state.wordLengthMax] = [state.wordLengthMax, state.wordLengthMin];

    setVal('opt-word-min', state.wordLengthMin);
    setVal('opt-word-max', state.wordLengthMax);
    getEl('val-wordlength-range').innerText = `${state.wordLengthMin}–${state.wordLengthMax}`;
    getEl('val-word-count').innerText = getSelectedWordCount();

    setVal('opt-words', state.words);
    getEl('val-words').innerText = state.words;
    setVal('opt-sep-custom', state.customSep);

    setVal('opt-num-pos', state.numPos);
    setVal('opt-digits', state.digits);

    setVal('opt-digitalaiserRatio', state.digitalaiserRatio);

    document.getElementById('val-digits').innerText = state.digits;
    document.getElementById('val-digitalaiser').innerText = state.digitalaiserRatio;

    // Inner control visibility: digits slider only when numbers enabled + position is 'each'
    document.getElementById('num-digits-wrap').classList.toggle('hidden', !(state.enableNum && state.numPos === 'each'));
    // Digitaliser ratio visible only when digitaliser checker is enabled
    document.getElementById('num-digitalaiser-wrap').classList.toggle('hidden', !state.enabledigitalaiser);
    setVal('opt-symbol-pos', state.symbolPos);
    setVal('opt-count', state.count);

    setVal('opt-cap-mode', state.cap);

    function updateWordLengthRange(min, max) {
        state.wordLengthMin = min;
        state.wordLengthMax = max;
        getEl('opt-word-min').value = min;
        getEl('opt-word-max').value = max;
        getEl('val-wordlength-range').innerText = `${min}–${max}`;
        getEl('val-word-count').innerText = getSelectedWordCount(min, max);
    }

    getEl('opt-word-min').addEventListener('input', (e) => {
        const newMin = parseInt(e.target.value, 10);
        const max = Math.max(newMin, state.wordLengthMax);
        updateWordLengthRange(newMin, max);
        saveState();
        generate();
    });
    getEl('opt-word-max').addEventListener('input', (e) => {
        const newMax = parseInt(e.target.value, 10);
        const min = Math.min(newMax, state.wordLengthMin);
        updateWordLengthRange(min, newMax);
        saveState();
        generate();
    });
    getEl('opt-words').addEventListener('input', (e) => {
        state.words = parseInt(e.target.value, 10);
        getEl('val-words').innerText = state.words;
        saveState();
        generate();
    });
    document.querySelectorAll('.btn-sep').forEach(btn => {
        btn.addEventListener('click', () => {
            state.separator = btn.dataset.val;
            state.customSep = '';
            getEl('opt-sep-custom').value = '';
            showToast(`Separator set to "${state.separator === ' ' ? 'Space' : state.separator}"`);
            saveState();
            generate();
        });
    });
    getEl('opt-sep-custom').addEventListener('input', (e) => {
        state.customSep = e.target.value;
        saveState();
        generate();
    });
    const capSelect = getEl('opt-cap-mode');
    if (capSelect) capSelect.addEventListener('change', (e) => {
        state.cap = e.target.value;
        saveState();
        generate();
    });

    getEl('opt-num-pos').addEventListener('change', (e) => {
        state.numPos = e.target.value;
        document.getElementById('num-digits-wrap').classList.toggle('hidden', !(state.enableNum && state.numPos === 'each'));
        saveState();
        generate();
    });
    getEl('opt-digits').addEventListener('input', (e) => {
        state.digits = parseInt(e.target.value, 10);
        getEl('val-digits').innerText = state.digits;
        saveState();
        generate();
    });

    // digitizer slider handled via checker and ratio input
    getEl('opt-digitalaiserRatio').addEventListener('input', (e) => {
        state.digitalaiserRatio = parseInt(e.target.value, 10);
        getEl('val-digitalaiser').innerText = state.digitalaiserRatio;
        saveState();
        generate();
    });

    getEl('opt-symbol-pos').addEventListener('change', (e) => {
        state.symbolPos = e.target.value;
        saveState();
        generate();
    });
    getEl('opt-count').addEventListener('input', (e) => {
        state.count = Math.max(1, parseInt(e.target.value, 10) || 1);
        saveState();
        generate();
    });

    // Password tab handlers
    getEl('opt-pw-length').addEventListener('input', (e) => {
        state.pwLength = parseInt(e.target.value, 10);
        getEl('val-pw-length').innerText = state.pwLength;
        saveState();
        generate();
    });
    getEl('opt-pw-upper').addEventListener('change', (e) => {
        state.pwUpper = e.target.checked;
        saveState();
        generate();
    });
    getEl('opt-pw-lower').addEventListener('change', (e) => {
        state.pwLower = e.target.checked;
        saveState();
        generate();
    });
    getEl('opt-pw-digits').addEventListener('change', (e) => {
        state.pwDigits = e.target.checked;
        saveState();
        generate();
    });
    getEl('opt-pw-symbols').addEventListener('change', (e) => {
        state.pwSymbols = e.target.checked;
        saveState();
        generate();
    });
    getEl('opt-save-history').addEventListener('change', (e) => {
        state.saveHistory = e.target.checked;
        saveState();
    });
    getEl('opt-pw-count').addEventListener('input', (e) => {
        state.pwCount = Math.max(1, parseInt(e.target.value, 10) || 1);
        saveState();
        generate();
    });
    getEl('themeToggle').addEventListener('click', cycleTheme);

    getEl('btn-generate').addEventListener('click', generate);
    getEl('tab-btn-passphrase').addEventListener('click', () => switchTab('passphrase'));
    getEl('tab-btn-password').addEventListener('click', () => switchTab('password'));

    const btnHide = document.getElementById('btn-hide-results');
    if (btnHide) {
        btnHide.addEventListener('click', () => {
            state.hideResults = !state.hideResults;
            btnHide.innerText = state.hideResults ? '👁️‍🗨️ Show' : '👁️ Hide';
            renderResults();
            renderHistory();
            saveState();
        });
        btnHide.innerText = state.hideResults ? '👁️‍🗨️ Show' : '👁️ Hide';
    }

    getEl('btn-copy-all').addEventListener('click', () => {
        if (state.results.length === 0) return;
        copyToClipboard(state.results.join('\n'));
    });
    getEl('btn-clear-history').addEventListener('click', () => {
        state.history = [];
        renderHistory();
        saveState();
    });
    getEl('btn-export-results').addEventListener('click', () => {
        exportCSV("passphrase_results.csv", ["passphrase"], state.results.map(r => [r]));
    });
    getEl('btn-export-history').addEventListener('click', () => {
        exportCSV("passphrase_history.csv", ["timestamp", "passphrase"], state.history.map(h => [h.timestamp, h.phrase]));
    });

    // Restore password tab state
    document.getElementById('opt-pw-length').value = state.pwLength;
    document.getElementById('val-pw-length').innerText = state.pwLength;
    document.getElementById('opt-pw-upper').checked = state.pwUpper;
    document.getElementById('opt-pw-lower').checked = state.pwLower;
    document.getElementById('opt-pw-digits').checked = state.pwDigits;
    document.getElementById('opt-pw-symbols').checked = state.pwSymbols;
    document.getElementById('opt-pw-count').value = state.pwCount;

    // Restore save-history checkbox
    document.getElementById('opt-save-history').checked = state.saveHistory;

    // Restore active tab
    switchTab(state.activeTab || 'passphrase');

    applyTheme();
    renderHistory();
    generate();
}

window.onload = init;