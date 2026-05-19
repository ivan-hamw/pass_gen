

let state = {
    activeTab: 'passphrase',
    wordlist: 'simple',
    words: 4,
    separator: ' ',
    customSep: '',
    cap: 'nocap',
    numPos: 'off',
    digits: 2,
    symbolPos: 'off',
    count: 5,
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    hideResults: false,
    results: [],
    history: [],
    digitalaizer: 'off',
    digitalaizerRatio: 0,
    pwLength: 16,
    pwUpper: true,
    pwLower: true,
    pwDigits: true,
    pwSymbols: true,
    pwCount: 5,
    saveHistory: true
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

function getSecureInt(min, max) {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return min + (array[0] % range);
}

function getRandomDigitString(len) {
    let s = "";
    for (let i = 0; i < len; i++) s += getSecureInt(0, 9).toString();
    return s;
}

function getRandomSymbol() {
    return SYMBOLS[getSecureInt(0, SYMBOLS.length - 1)];
}

function applyCap(word, mode) {
    if (mode === 'nocap') return word;
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
    let pool = [...MASTER_WORDS];
    if (state.wordlist === 'short') pool = pool.filter(w => w.length <= 4);
    if (state.wordlist === 'long') pool = pool.filter(w => w.length >= 7);

    document.getElementById('warning-box').classList.toggle('hidden', pool.length >= state.words * 2);

    const separator = state.customSep || state.separator;
    const results = [];

    for (let i = 0; i < state.count; i++) {
        let parts = [];
        for (let j = 0; j < state.words; j++) {
            let word = pool[getSecureInt(0, pool.length - 1)];
            word = applyCap(word, state.cap);

            if (state.numPos === 'each') word += getRandomDigitString(state.digits);
            if (state.symbolPos === 'each') word += getRandomSymbol();

            parts.push(word);
        }

        let phrase = parts.join(separator);

        if (state.numPos === 'end') phrase += getRandomDigitString(state.digits);
        if (state.symbolPos === 'start') phrase = getRandomSymbol() + phrase;
        if (state.symbolPos === 'end') phrase = phrase + getRandomSymbol();

        if (state.digitalaizer === "on") phrase = leetTransform(phrase, state.digitalaizerRatio / 100);
        results.push(phrase);
    }

    state.results = results;
    renderResults();
    saveState();
}

function leetTransform(text, probability = 0.5, rng = Math.random) {
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

        // Fill remaining length from the combined charset
        let pw = '';
        const remaining = Math.max(0, state.pwLength - required.length);
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
    let csvContent = headers.join(",") + "\n" + dataRows.map(row => row.join(",")).join("\n");
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

function getEmojiMask(length) {
    const emojis =
        ['😀', '🚀', '🍍', '🌈', '🎸', '🦊', '🍕', '🎡', '💎', '🌊',
            '🍄', '🏀', '🦄', '🌮', '🛸', '🎈', '🌵', '🍣', '🌋', '🛹',
            '🍦', '🦁', '🎭', '🥨', '🧩', '🌻', '🚁', '🍩', '🧤', '🦦',
            '🥥', '🥊', '🐉', '🍔', '🎨', '🧶', '🥨', '🌋', '🦜', '⛺',
            '🧊', '🦩', '🥞', '🛸', '🍀', '🚲', '🍿', '🧸', '🦓', '🥭',
            '🎳', '🧤', '🦀', '🍭', '🚜', '🦉', '🥓', '🧿', '🦢', '🥐',
            '🛶', '🍋', '🦔', '🥨', '🪂', '🍓', '🧱', '🐙', '🥪', '🚖',
            '🥐', '🐋', '🥨', '🦒', '🍒', '🛩️', '🍜', '🦋', '🚜', '🥨',
            '🥦', '🛹', '🦚', '🥟', '🔋', '🐨', '🍯', '🛰️', '🍤', '🛸',
            '🧁', '🐢', '🥯', '🚠', '🎐', '🐘', '🍢', '🪕', '🥝', '🛸'];

    let mask = '';
    const numEmojis = Math.max(3, Math.floor(length / 2));
    for (let i = 0; i < numEmojis; i++) {
        mask += emojis[getSecureInt(0, emojis.length - 1)];
    }
    return mask;
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

        let displayStr = state.hideResults ? getEmojiMask(p.length) : p;
        div.innerHTML = `<span style="font-family: monospace; font-size: 1.1rem; width: 100%;">${displayStr}</span>`;
        container.appendChild(div);
    });
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

        let displayStr = state.hideResults ? getEmojiMask(item.phrase.length) : item.phrase;
        div.innerHTML = `
            <span style="color: var(--secondary);">${item.timestamp}</span>
            <span style="font-weight: 500; font-family: monospace;">${displayStr}</span>
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

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'range' || el.type === 'text' || el.type === 'number' || el.tagName === 'SELECT') el.value = val;
    };

    setVal('opt-wordlist', state.wordlist);
    setVal('opt-words', state.words);
    document.getElementById('val-words').innerText = state.words;
    setVal('opt-sep-custom', state.customSep);

    setVal('opt-num-pos', state.numPos);
    setVal('opt-digits', state.digits);

    setVal('opt-digitalaizer-pos', state.digitalaizer);
    setVal('opt-digitalaizerRatio', state.digitalaizerRatio);

    document.getElementById('val-digits').innerText = state.digits;
    document.getElementById('val-digitalaizer').innerText = state.digitalaizerRatio;

    document.getElementById('num-digits-wrap').classList.toggle('hidden', state.numPos === 'off');
    document.getElementById('num-digitalaizer-wrap').classList.toggle('hidden', state.digitalaizer === 'off');
    setVal('opt-symbol-pos', state.symbolPos);
    setVal('opt-count', state.count);

    document.querySelectorAll(`input[name="cap"][value="${state.cap}"]`).forEach(el => el.checked = true);

    document.getElementById('opt-wordlist').onchange = (e) => state.wordlist = e.target.value;
    document.getElementById('opt-words').oninput = (e) => {
        state.words = parseInt(e.target.value);
        document.getElementById('val-words').innerText = state.words;
    };
    document.querySelectorAll('.btn-sep').forEach(btn => {
        btn.onclick = () => {
            state.separator = btn.dataset.val;
            state.customSep = '';
            document.getElementById('opt-sep-custom').value = '';
            showToast(`Separator set to "${state.separator === ' ' ? 'Space' : state.separator}"`);
        };
    });
    document.getElementById('opt-sep-custom').oninput = (e) => state.customSep = e.target.value;
    document.getElementsByName('cap').forEach(el => { el.onchange = (e) => state.cap = e.target.value; });

    document.getElementById('opt-num-pos').onchange = (e) => {
        state.numPos = e.target.value;
        document.getElementById('num-digits-wrap').classList.toggle('hidden', state.numPos === 'off');
    };
    document.getElementById('opt-digits').oninput = (e) => {
        state.digits = parseInt(e.target.value);
        document.getElementById('val-digits').innerText = state.digits;
    };

    // digitizer
    document.getElementById('opt-digitalaizer-pos').onchange = (e) => {
        state.digitalaizer = e.target.value;
        document.getElementById('num-digitalaizer-wrap').classList.toggle('hidden', state.digitalaizer === 'off');
    };
    document.getElementById('opt-digitalaizerRatio').oninput = (e) => {
        state.digitalaizerRatio = parseInt(e.target.value);
        document.getElementById('val-digitalaizer').innerText = state.digitalaizerRatio;
    };

    document.getElementById('opt-symbol-pos').onchange = (e) => state.symbolPos = e.target.value;
    document.getElementById('opt-count').oninput = (e) => {
        state.count = Math.max(1, parseInt(e.target.value) || 1);
    };

    // Password tab handlers
    document.getElementById('opt-pw-length').oninput = (e) => {
        state.pwLength = parseInt(e.target.value);
        document.getElementById('val-pw-length').innerText = state.pwLength;
    };
    document.getElementById('opt-pw-upper').onchange = (e) => state.pwUpper = e.target.checked;
    document.getElementById('opt-pw-lower').onchange = (e) => state.pwLower = e.target.checked;
    document.getElementById('opt-pw-digits').onchange = (e) => state.pwDigits = e.target.checked;
    document.getElementById('opt-pw-symbols').onchange = (e) => state.pwSymbols = e.target.checked;
    document.getElementById('opt-save-history').onchange = (e) => {
        state.saveHistory = e.target.checked;
        saveState();
    };
    document.getElementById('opt-pw-count').oninput = (e) => {
        state.pwCount = Math.max(1, parseInt(e.target.value) || 1);
    };
    document.getElementById('themeToggle').onclick = cycleTheme;

    document.getElementById('btn-generate').onclick = generate;

    const btnHide = document.getElementById('btn-hide-results');
    if (btnHide) {
        btnHide.onclick = () => {
            state.hideResults = !state.hideResults;
            btnHide.innerHTML = state.hideResults ? '👁️‍🗨️ Show results' : '👁️ Hide results';
            renderResults();
            renderHistory();
            saveState();
        };
        btnHide.innerHTML = state.hideResults ? '👁️‍🗨️ Show results' : '👁️ Hide results';
    }

    document.getElementById('btn-copy-all').onclick = () => {
        if (state.results.length === 0) return;
        copyToClipboard(state.results.join('\n'));
    };
    document.getElementById('btn-clear-history').onclick = () => {
        state.history = [];
        renderHistory();
        saveState();
    };
    document.getElementById('btn-export-results').onclick = () => {
        exportCSV("passphrase_results.csv", ["passphrase"], state.results.map(r => [r]));
    };
    document.getElementById('btn-export-history').onclick = () => {
        exportCSV("passphrase_history.csv", ["timestamp", "passphrase"], state.history.map(h => [h.timestamp, h.phrase]));
    };

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