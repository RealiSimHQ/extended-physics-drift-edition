// Extended Drift Physics Generator — RealiSimHQ 2026

const PATREON_CLIENT_ID = 'vq1EOHIoQ_2p_R0SVEcW3FRYvbMkcwMX1utj5hcvipJ3_1sSPethC5KM2FoiHZgS';
const PATREON_REDIRECT = 'https://realisimhq.github.io/extended-physics-drift-edition/callback.html';
const PATREON_OAUTH_URL = 'https://www.patreon.com/oauth2/authorize';

function patreonLogin() {
    const url = `${PATREON_OAUTH_URL}?response_type=code&client_id=${PATREON_CLIENT_ID}&redirect_uri=${encodeURIComponent(PATREON_REDIRECT)}&scope=identity%20identity%5Bemail%5D%20identity.memberships`;
    window.location.href = url;
}

function checkPatreonSession() {
    const auth = sessionStorage.getItem('patreon_authorized');
    const until = parseInt(sessionStorage.getItem('patreon_until') || '0');
    if (auth === 'true' && Date.now() < until) {
        return sessionStorage.getItem('patreon_name') || 'Patron';
    }
    return null;
}

function hasUsedTrial() {
    return localStorage.getItem('epg_trial_used') === 'true';
}

function markTrialUsed() {
    localStorage.setItem('epg_trial_used', 'true');
}

function isTrialMode() {
    return !checkPatreonSession() && !hasUsedTrial();
}

function initPatreonGate() {
    const patron = checkPatreonSession();
    const gate = document.getElementById('patreon-gate');
    const uploadSection = document.getElementById('upload-section');

    if (patron) {
        gate.classList.add('hidden');
        const welcome = document.createElement('div');
        welcome.className = 'patron-welcome';
        welcome.textContent = `Welcome, ${patron}! 🎉`;
        gate.parentNode.insertBefore(welcome, uploadSection);
    } else if (!hasUsedTrial()) {
        // Free trial — show tool with trial banner
        gate.innerHTML = `<div class="gate-card" style="border-color:var(--accent-cyan);padding:20px;">
            <p style="margin:0;color:var(--accent-cyan);">🎁 <strong>Free Trial</strong> — Generate one physics pack free. <a href="https://www.patreon.com/checkout/RealiSimHQ?rid=26118508" target="_blank" style="color:var(--accent-gold);">Subscribe for unlimited access</a></p>
        </div>`;
    } else {
        // Trial used, must subscribe
        uploadSection.classList.remove('active');
        uploadSection.style.display = 'none';
        gate.querySelector('h3').textContent = '🔒 Trial Used';
        gate.querySelector('p').textContent = 'You\'ve used your free generation. Subscribe to continue using the tool.';
    }
}

const AMERICAN_MAKES = [
    'ford', 'mustang', 'chevy', 'chevrolet', 'dodge', 'chrysler', 'pontiac',
    'cadillac', 'buick', 'gmc', 'lincoln', 'corvette', 'camaro', 'charger',
    'challenger', 'viper', 'shelby', 'gt350', 'gt500', 'coyote', 's550',
    's197', 'foxbody', 'fox body', 'c5', 'c6', 'c7', 'c8', 'sn95',
    'new edge', 'mach', 'cobra', 'boss', 'hellcat', 'demon', 'srt',
    'firebird', 'trans am', 'gto', 'plymouth', 'barracuda', 'cuda'
];

const TRACK_BASELINE = 1.75; // meters

const State = {
    ogFiles: {},
    ogParsed: {},
    ogMeta: {}
};

// ─── INI Parser ───
function parseINI(content) {
    const result = {};
    let section = null;
    for (let line of content.split('\n')) {
        line = line.trim();
        if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('//')) continue;
        if (line.startsWith('[') && line.includes(']')) {
            section = line.slice(1, line.indexOf(']'));
            if (!result[section]) result[section] = {};
            continue;
        }
        if (line.includes('=') && section) {
            const eq = line.indexOf('=');
            const key = line.slice(0, eq).trim();
            let val = line.slice(eq + 1).trim();
            // Strip inline comments but preserve values with semicolons in help text
            if (!key.startsWith('HELP')) {
                const sc = val.indexOf(';');
                if (sc > 0) val = val.slice(0, sc).trim();
            }
            result[section][key] = val;
        }
    }
    return result;
}

// ─── Detect Standard vs Metric from car name ───
function detectSystem(name) {
    const lower = (name || '').toLowerCase();
    for (const make of AMERICAN_MAKES) {
        if (lower.includes(make)) return 'standard';
    }
    return 'metric';
}

// ─── GRAPHICS_OFFSETS — standardized for all cars ───
function getStandardOffsets() {
    return {
        WHEEL_LF: '-0.00', SUSP_LF: '-0.00',
        WHEEL_RF: '0.00', SUSP_RF: '0.00',
        WHEEL_LR: '-0.005', SUSP_LR: '-0.005',
        WHEEL_RR: '0.005', SUSP_RR: '0.005'
    };
}

// ─── Build car.ini ───
function buildCarIni(og) {
    const tpl = CAL.car_template;
    const parsed = parseINI(tpl);
    const ogCar = og.car;

    // Get OG values
    const ogOffset = ogCar.BASIC?.GRAPHICS_OFFSET || '0, 0, 0';
    const parts = ogOffset.split(',').map(s => s.trim());
    const ogX = parts[0] || '0';
    const ogZ = parts[2] || '0';

    let out = '';
    out += '[HEADER]\nVERSION=extended-2\n\n';

    // _EXTENSION_DRIVER from template
    out += '[_EXTENSION_DRIVER]\n';
    if (parsed._EXTENSION_DRIVER) {
        for (const [k, v] of Object.entries(parsed._EXTENSION_DRIVER)) out += `${k}=${v}\n`;
    }
    out += '\n';

    // INFO from OG
    out += '[INFO]\n';
    out += `SCREEN_NAME=${ogCar.INFO?.SCREEN_NAME || ''}\n`;
    out += `SHORT_NAME=${ogCar.INFO?.SHORT_NAME || ''}\n\n`;

    // BASIC — OG geometry, template physics
    out += '[BASIC]\n';
    const ogY = parts[1] || '0';
    out += `GRAPHICS_OFFSET=${ogX}, ${ogY}, ${ogZ}\n`;
    out += `GRAPHICS_PITCH_ROTATION=-1\n`;
    out += `TOTALMASS=1315.48\n`;
    out += `INERTIA=${ogCar.BASIC?.INERTIA || ''}\n\n`;

    // GRAPHICS from OG
    out += '[GRAPHICS]\n';
    const gfx = ogCar.GRAPHICS || {};
    out += `DRIVEREYES=${gfx.DRIVEREYES || ''}\n`;
    out += `ONBOARD_EXPOSURE=${gfx.ONBOARD_EXPOSURE || ''}\n`;
    out += `OUTBOARD_EXPOSURE=${gfx.OUTBOARD_EXPOSURE || ''}\n`;
    out += `ON_BOARD_PITCH_ANGLE=0\n`;
    out += `BUMPER_CAMERA_POS=${gfx.BUMPER_CAMERA_POS || ''}\n`;
    out += `BONNET_CAMERA_POS=${gfx.BONNET_CAMERA_POS || ''}\n`;
    out += `MIRROR_POSITION=${gfx.MIRROR_POSITION || ''}\n`;
    out += `VIRTUAL_MIRROR_ENABLED=0\n`;
    out += `USE_ANIMATED_SUSPENSIONS=0\n`;
    out += `SHAKE_MUL=1\n`;
    out += `FUEL_LIGHT_MIN_LITERS=${gfx.FUEL_LIGHT_MIN_LITERS || ''}\n`;
    out += `BONNET_CAMERA_PITCH=${gfx.BONNET_CAMERA_PITCH || ''}\n`;
    out += `BUMPER_CAMERA_PITCH=${gfx.BUMPER_CAMERA_PITCH || ''}\n\n`;

    // CONTROLS from template
    out += '[CONTROLS]\n';
    if (parsed.CONTROLS) {
        for (const [k, v] of Object.entries(parsed.CONTROLS)) out += `${k}=${v}\n`;
    }
    out += '\n';

    // FUEL from template
    out += '[FUEL]\n';
    if (parsed.FUEL) {
        for (const [k, v] of Object.entries(parsed.FUEL)) out += `${k}=${v}\n`;
    }
    out += '\n';

    // RIDE from template
    out += '[RIDE]\n';
    if (parsed.RIDE) {
        for (const [k, v] of Object.entries(parsed.RIDE)) out += `${k}=${v}\n`;
    }
    out += '\n';

    // FUELTANK from OG
    out += '[FUELTANK]\n';
    out += `POSITION=${ogCar.FUELTANK?.POSITION || ''}\n\n`;

    // PIT_STOP from template
    out += '[PIT_STOP]\n';
    if (parsed.PIT_STOP) {
        for (const [k, v] of Object.entries(parsed.PIT_STOP)) out += `${k}=${v}\n`;
    }
    out += '\n';

    return out;
}

// ─── Build suspensions.ini ───
function buildSuspensionsIni(og, system) {
    const template = system === 'standard' ? CAL.suspensions_standard : CAL.suspensions_metric;
    const ogSusp = og.suspensions;

    const frontTrack = parseFloat(ogSusp.FRONT?.TRACK || '1.5');
    const rearTrack = parseFloat(ogSusp.REAR?.TRACK || '1.5');

    // Standardized GRAPHICS_OFFSETS
    const offsets = getStandardOffsets();

    // Replace placeholders in the template
    let out = template;

    // Fill in WHEELBASE and CG_LOCATION from OG
    out = out.replace(
        /^WHEELBASE=.*$/m,
        `WHEELBASE=${ogSusp.BASIC?.WHEELBASE || '2.4'}`
    );
    out = out.replace(
        /^CG_LOCATION=.*$/m,
        `CG_LOCATION=${ogSusp.BASIC?.CG_LOCATION || '0.5'}`
    );

    // Fill in FRONT TRACK (first occurrence after [FRONT])
    const frontTrackStr = frontTrack.toFixed(3);
    const rearTrackStr = rearTrack.toFixed(3);

    // Replace TRACK in FRONT section
    out = out.replace(
        /(\[FRONT\][\s\S]*?^TRACK=).*$/m,
        `$1${frontTrackStr}`
    );

    // Replace TRACK in REAR section
    out = out.replace(
        /(\[REAR\][\s\S]*?^TRACK=).*$/m,
        `$1${rearTrackStr}`
    );

    // Replace GRAPHICS_OFFSETS section
    const offsetBlock = `[GRAPHICS_OFFSETS]
WHEEL_LF=${offsets.WHEEL_LF}
SUSP_LF=${offsets.SUSP_LF}
WHEEL_RF=${offsets.WHEEL_RF}
SUSP_RF=${offsets.SUSP_RF}
WHEEL_LR=${offsets.WHEEL_LR}
SUSP_LR=${offsets.SUSP_LR}
WHEEL_RR=${offsets.WHEEL_RR}
SUSP_RR=${offsets.SUSP_RR}`;

    out = out.replace(
        /\[GRAPHICS_OFFSETS\][\s\S]*?(?=\n\[|$)/,
        offsetBlock + '\n'
    );

    // Ensure both bumpstop fronts use the LUT for maximum dynamics
    out = out.replace(
        /^(BUMPSTOP_GAP=)0\.074$/m,
        '$1bumpstops_bumprubber_front.lut'
    );

    return out;
}

// ─── File handling ───
async function handleFileUpload(items) {
    showLoading('Reading files...');
    try {
        const files = [];
        const entries = [];
        const rawFiles = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) entries.push(entry);
                const f = item.getAsFile();
                if (f) rawFiles.push(f);
            }
        }
        if (entries.length > 0) {
            for (const entry of entries) await traverseEntry(entry, files, '');
        }
        if (files.length === 0 && rawFiles.length > 0) files.push(...rawFiles);

        if (files.length === 0) { alert('No files found.'); return; }

        const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
        if (zipFile) await processZip(zipFile);
        else await processFiles(files);
    } catch (e) {
        console.error(e);
        alert('Error reading files: ' + e.message);
    } finally {
        hideLoading();
    }
}

async function handleFilesArray(fileList) {
    showLoading('Reading files...');
    try {
        const files = Array.from(fileList);
        const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
        if (zipFile) await processZip(zipFile);
        else await processFiles(files);
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    } finally {
        hideLoading();
    }
}

async function traverseEntry(entry, files, path) {
    if (entry.isFile) {
        try {
            const file = await new Promise((res, rej) => entry.file(res, rej));
            file._fullPath = path + file.name;
            files.push(file);
        } catch (e) { console.warn('Skip:', entry.fullPath); }
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const children = await new Promise((res, rej) => {
            const all = [];
            const readBatch = () => reader.readEntries(batch => {
                if (batch.length === 0) res(all);
                else { all.push(...batch); readBatch(); }
            }, rej);
            readBatch();
        });
        for (const child of children) await traverseEntry(child, files, path + entry.name + '/');
    }
}

async function processZip(file) {
    showLoading('Extracting ZIP...');
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const fileMap = {};
    for (const [zpath, zentry] of Object.entries(zip.files)) {
        if (zentry.dir) continue;
        const fn = zpath.split('/').pop().toLowerCase();
        if (fn.endsWith('.ini') || fn.endsWith('.lut') || fn.endsWith('.rto')) {
            fileMap[fn] = await zentry.async('string');
        }
    }
    State.ogFiles = fileMap;
    processOG();
}

async function processFiles(files) {
    State.ogFiles = {};
    for (const file of files) {
        const fn = file.name.toLowerCase();
        if (fn.endsWith('.ini') || fn.endsWith('.lut') || fn.endsWith('.rto')) {
            State.ogFiles[fn] = await file.text();
        }
    }
    processOG();
}

function processOG() {
    if (!State.ogFiles['car.ini'] || !State.ogFiles['suspensions.ini']) {
        const found = Object.keys(State.ogFiles).join(', ') || 'none';
        alert(`Missing required files. Found: ${found}\n\nNeed at minimum: car.ini, suspensions.ini`);
        return;
    }

    State.ogParsed.car = parseINI(State.ogFiles['car.ini']);
    State.ogParsed.suspensions = parseINI(State.ogFiles['suspensions.ini']);

    const carName = State.ogParsed.car.INFO?.SCREEN_NAME || State.ogParsed.car.INFO?.SHORT_NAME || 'Unknown';
    const wheelbase = State.ogParsed.suspensions.BASIC?.WHEELBASE || '-';
    const trackF = State.ogParsed.suspensions.FRONT?.TRACK || '-';
    const trackR = State.ogParsed.suspensions.REAR?.TRACK || '-';
    const system = detectSystem(carName);

    State.ogMeta = { carName, wheelbase, trackF, trackR, system };

    // Update UI
    document.getElementById('car-name').textContent = carName;
    document.getElementById('car-wheelbase').textContent = wheelbase;
    document.getElementById('car-track').textContent = `${trackF} / ${trackR}`;
    document.getElementById('car-info').classList.remove('hidden');

    document.getElementById('system-select').value = system;
    document.getElementById('car-system').textContent = system === 'standard' ? 'Standard (American)' : 'Metric (JDM/Euro)';

    // Collapse upload, show generate
    document.getElementById('upload-section').classList.add('hidden');
    document.getElementById('upload-dropdown').classList.remove('hidden');
    document.getElementById('upload-dropdown-label').textContent = carName;
    document.getElementById('generate-section').classList.add('active');
}

// ─── Generate ZIP ───
async function generatePack() {
    const btn = document.getElementById('download-btn');
    btn.disabled = true;
    btn.classList.add('btn-pulse-active');
    showLoading('Generating physics pack...');

    try {
        const system = document.getElementById('system-select').value;
        const zip = new JSZip();

        // Build car.ini
        const carIni = buildCarIni(State.ogParsed);
        zip.file('data/car.ini', carIni);

        // Build suspensions.ini
        const suspIni = buildSuspensionsIni(State.ogParsed, system);
        zip.file('data/suspensions.ini', suspIni);

        // Copy all files from "Copy Paste" data folder
        for (const [fn, content] of Object.entries(CAL.copy_paste_data)) {
            if (fn === 'data.7z') continue; // skip archive
            if (content.startsWith('BASE64:')) {
                const bytes = atob(content.slice(7));
                const arr = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                zip.file('data/' + fn, arr);
            } else {
                zip.file('data/' + fn, content);
            }
        }

        // Add the correct spring/ARB LUTs (overwrite the ones from copy_paste if any)
        const luts = system === 'standard' ? CAL.standard_luts : CAL.metric_luts;
        for (const [fn, content] of Object.entries(luts)) {
            zip.file('data/' + fn, content);
        }

        // Extension folder
        for (const [relpath, content] of Object.entries(CAL.copy_paste_extension)) {
            if (content.startsWith('BASE64:')) {
                const bytes = atob(content.slice(7));
                const arr = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                zip.file('extension/' + relpath, arr);
            } else {
                zip.file('extension/' + relpath, content);
            }
        }

        // Skins folder
        for (const [relpath, content] of Object.entries(CAL.copy_paste_skins)) {
            if (content.startsWith('BASE64:')) {
                const bytes = atob(content.slice(7));
                const arr = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                zip.file('skins/' + relpath, arr);
            } else {
                zip.file('skins/' + relpath, content);
            }
        }

        // UI folder
        for (const [relpath, content] of Object.entries(CAL.copy_paste_ui)) {
            if (content.startsWith('BASE64:')) {
                const bytes = atob(content.slice(7));
                const arr = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                zip.file('ui/' + relpath, arr);
            } else {
                zip.file('ui/' + relpath, content);
            }
        }

        // Download via modal
        const blob = await zip.generateAsync({ type: 'blob' });
        const carName = (State.ogMeta.carName || 'car').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (!checkPatreonSession()) markTrialUsed();
        showDownloadModal(blob, `${carName}_ExtendedDrift.zip`);

    } catch (e) {
        console.error('Generation error:', e);
        alert('Error generating pack: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.classList.remove('btn-pulse-active');
        hideLoading();
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showDownloadModal(blob, filename) {
    const carName = State.ogMeta.carName || 'your car';
    const modal = document.createElement('div');
    modal.id = 'download-modal';
    modal.innerHTML = `
        <div class="dm-backdrop"></div>
        <div class="dm-card">
            <img src="realisimhq-logo.png" alt="RealiSimHQ" class="dm-site-logo">
            <div class="dm-logo-ring preparing">
                <svg class="dm-bolt" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h2 class="dm-title">Generating your physics pack…</h2>
            <p class="dm-subtitle">Extended Drift Physics → <span style="color:var(--accent-cyan)">${carName}</span></p>
            <div class="dm-divider"></div>
            <p class="dm-cta" style="font-size:1.1rem;">Thank you for your continued support! 🙏</p>
            <p style="color:var(--text-secondary);margin-top:8px;">Have fun out there. 🏎️💨</p>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.dm-backdrop').addEventListener('click', closeDownloadModal);

    setTimeout(() => {
        const ring = modal.querySelector('.dm-logo-ring');
        ring.classList.remove('preparing');
        ring.classList.add('done');
        modal.querySelector('.dm-title').textContent = 'Starting download…';
        setTimeout(() => downloadBlob(blob, filename), 600);
    }, 5000);
}

function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.classList.add('dm-fade-out');
        setTimeout(() => modal.remove(), 300);
    }
}

// ─── UI helpers ───
function showLoading(text) {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// ─── Event setup ───
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFileUpload(e.dataTransfer.items); });
    fileInput.addEventListener('change', e => handleFilesArray(e.target.files));

    // Mini drop zone
    const dzMini = document.getElementById('drop-zone-mini');
    const fiMini = document.getElementById('file-input-mini');
    dzMini.addEventListener('click', () => fiMini.click());
    dzMini.addEventListener('dragover', e => { e.preventDefault(); dzMini.classList.add('drag-over'); });
    dzMini.addEventListener('dragleave', () => dzMini.classList.remove('drag-over'));
    dzMini.addEventListener('drop', e => { e.preventDefault(); dzMini.classList.remove('drag-over'); handleFileUpload(e.dataTransfer.items); });
    fiMini.addEventListener('change', e => handleFilesArray(e.target.files));

    // Dropdown toggle
    document.getElementById('upload-dropdown-header').addEventListener('click', () => {
        document.getElementById('upload-dropdown-body').classList.toggle('hidden');
        document.querySelector('#upload-dropdown .dropdown-arrow').classList.toggle('open');
    });

    // System select (hidden, auto-detected)

    // Generate
    document.getElementById('download-btn').addEventListener('click', generatePack);

    // Patreon gate
    initPatreonGate();
});
