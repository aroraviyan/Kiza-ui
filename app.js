// ==========================================================
// KIZA v11.8 — MAIN WORKSPACE, FREE PIC/VIDEO GEN, VOICE & CHAT ENGINE
// ==========================================================
if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// Silently wake Render container on page load
fetch(`${SERVER_URL}/health`).catch(() => {});

// ==========================================================
// 1. VIEWPORT LOCK, OFFLINE BANNER, TOOLS MENU & PWA
// ==========================================================
(function initAutoViewportAdapter() {
    function syncViewportHeight() {
        const vv = window.visualViewport;
        const vh = vv ? Math.round(vv.height) : window.innerHeight;
        if (vh && vh > 100) document.documentElement.style.setProperty('--app-height', `${vh}px`);
        if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    }
    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(syncViewportHeight, 120), { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewportHeight, { passive: true });
        window.visualViewport.addEventListener('scroll', syncViewportHeight, { passive: true });
    }
    window.addEventListener('DOMContentLoaded', syncViewportHeight);
})();

(function initOfflineCacheMonitor() {
    function updateOnlineStatus() {
        const banner = document.getElementById('offlineBanner');
        if (banner) banner.style.display = navigator.onLine ? "none" : "block";
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('DOMContentLoaded', updateOnlineStatus);
})();

function toggleHeaderToolsMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('headerToolsMenu');
    if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('headerToolsMenu');
    if (menu && menu.classList.contains('open') && !e.target.closest('#headerToolsMenu') && !e.target.closest('[onclick*="toggleHeaderToolsMenu"]')) {
        menu.classList.remove('open');
    }
    const autoBox = document.getElementById('slashAutocomplete');
    if (autoBox && !e.target.closest('.input-container')) autoBox.style.display = 'none';
});

let deferredPWAPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAPrompt = e;
    const hdrBtn = document.getElementById('pwaInstallHeaderBtn');
    if (hdrBtn) hdrBtn.style.display = "inline-flex";
});

async function triggerPWAInstall() {
    if (deferredPWAPrompt) {
        deferredPWAPrompt.prompt();
        const { outcome } = await deferredPWAPrompt.userChoice;
        if (outcome === 'accepted') showNotification("App Installed", "KIZA has been installed!", false, { skipStore: true });
        deferredPWAPrompt = null;
        const hdrBtn = document.getElementById('pwaInstallHeaderBtn');
        if (hdrBtn) hdrBtn.style.display = "none";
    } else {
        showNotification("Install KIZA App", "Use your browser menu -> 'Install App' or 'Add to Home Screen'!", false, { skipStore: true });
    }
}

// ==========================================================
// 2. BATTERY HUD, POWER SAVER & SOUND EFFECTS
// ==========================================================
let powerSaverActive = false;
let batteryLevelPct = 100;
let batteryCharging = true;
let sfxEnabled = (userSettings.sfx !== 'off');
let voiceEnabled = false;
let currentAudio = null;
let audioCtx = null;
let isKizaSpeaking = false;

const PERSONA_VOICE_CONFIG = {
    helpful: { label: "IN • NEURAL", rate: 1.03 },
    energetic: { label: "IN • NEERJA", rate: 1.08 },
    normal: { label: "UK • DRY WIT", rate: 1.04 },
    security: { label: "UK • TACTICAL", rate: 0.94 }
};

const DEFAULT_UPDATES_FALLBACK = [
    {
        version: "v11.8",
        title: "Free AI Picture & Video Studio, Hybrid Whiteboard & Forensic Security PDF",
        description: "Added free browser AI picture & video generation (Puter.js + FLUX), Hybrid AI Whiteboard for real anime/character art and crisp SVG diagrams, and official KIZA SECURITY MANAGEMENT forensic PDF records with camera evidence.",
        author: "Viyan Arora",
        date: "LIVE"
    }
];

function togglePowerSaverMode(forceState = null) {
    powerSaverActive = forceState !== null ? forceState : !powerSaverActive;
    document.body.classList.toggle('power-saver', powerSaverActive);
    const pill = document.getElementById('batteryHudPill');
    if (pill) pill.classList.toggle('low-power', powerSaverActive);
    updateBatteryHudDisplay();
}

function updateBatteryHudDisplay() {
    const pill = document.getElementById('batteryHudPill');
    if (!pill) return;
    let memStr = "";
    if (window.performance && performance.memory) {
        memStr = ` • ${Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))}MB`;
    }
    const icon = batteryCharging ? "⚡" : (batteryLevelPct <= 20 ? "🪫" : "🔋");
    pill.innerText = `${icon} ${batteryLevelPct}%${memStr}${powerSaverActive ? ' (Eco)' : ''}`;
}

if ('getBattery' in navigator) {
    navigator.getBattery().then(bat => {
        const sync = () => {
            batteryLevelPct = Math.round((bat.level || 1) * 100);
            batteryCharging = Boolean(bat.charging);
            if (batteryLevelPct <= 20 && !batteryCharging && !powerSaverActive) togglePowerSaverMode(true);
            updateBatteryHudDisplay();
        };
        sync();
        bat.addEventListener('levelchange', sync);
        bat.addEventListener('chargingchange', sync);
    }).catch(() => updateBatteryHudDisplay());
} else {
    updateBatteryHudDisplay();
}
setInterval(updateBatteryHudDisplay, 15000);

function playTacticalSFX(type = "click") {
    if (!sfxEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === "click") {
            osc.type = "sine"; osc.frequency.setValueAtTime(1100, now); osc.frequency.exponentialRampToValueAtTime(520, now + 0.035);
            gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.start(now); osc.stop(now + 0.04);
        } else if (type === "sonar") {
            osc.type = "sine"; osc.frequency.setValueAtTime(740, now); osc.frequency.exponentialRampToValueAtTime(1480, now + 0.14);
            gain.gain.setValueAtTime(0.045, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.start(now); osc.stop(now + 0.16);
        } else if (type === "complete") {
            osc.type = "triangle"; osc.frequency.setValueAtTime(587.33, now); osc.frequency.setValueAtTime(880, now + 0.07);
            gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now); osc.stop(now + 0.18);
        } else {
            osc.type = "sawtooth"; osc.frequency.setValueAtTime(240, now); osc.frequency.setValueAtTime(180, now + 0.09);
            gain.gain.setValueAtTime(0.045, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now); osc.stop(now + 0.22);
        }
    } catch (e) {}
}

function toggleTacticalSFX() {
    sfxEnabled = !sfxEnabled;
    userSettings.sfx = sfxEnabled ? 'on' : 'off';
    safeSetItem('kiza_settings', JSON.stringify(userSettings));
    const btn = document.getElementById('sfxToggleBtn');
    if (btn) btn.innerText = sfxEnabled ? "🎛️ SFX" : "🔇 Mute";
    if (sfxEnabled) playTacticalSFX("complete");
}

document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.attach-action-pill')) playTacticalSFX("click");
});

// ==========================================================
// 3. TEXT SANITIZERS, INDIAN VOICE + EMOJI REACTIONS & SPEECH INPUT
// ==========================================================
function stripSlashesFromText(textStr) {
    if (!textStr) return "";
    return String(textStr)
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<\/?think>/gi, '')
        .replace(/\[IMG\s*:[^\]]*\]/gi, '')
        .replace(/\[IMAGE\s*:[^\]]*\]/gi, '')
        .replace(/\s*(?<!:)\/\/\s*(MASTER|COMMANDER|OVERSEER)/gi, '')
        .replace(/\s+(?<!:)\/\/\s+/g, ' • ');
}

function extractFriendlyAssistantMessage(fullText) {
    const cleaned = stripSlashesFromText(fullText)
        .replace(/\[QUIZ_DATA\][\s\S]*?(?:\[\/QUIZ_DATA\]|$)/gi, '')
        .replace(/\[CHART_DATA\][\s\S]*?(?:\[\/CHART_DATA\]|$)/gi, '')
        .replace(/```[\s\S]*?(?:```|$)/g, '')
        .replace(/\[ACTION:[A-Z_]+\]/g, '')
        .replace(/\[GENERATE_FILE:[^\]]+\]/g, '')
        .replace(/\[GENERATE_IMAGE:[^\]]+\]/gi, '')
        .replace(/\[GENERATE_VIDEO:[^\]]+\]/gi, '')
        .replace(/\[GENERATING_PDF:[^\]]+\]/g, '')
        .replace(/\[ZERO_TRUST_CONFIRM:[^\]]+\]/g, '')
        .replace(/\[SYSTEM[^\]]*\]/gi, '')
        .replace(/\*\*/g, '')
        .trim();

    const introMatch = cleaned.match(/AI_INTRO:\s*([^\n]+)/i);
    if (introMatch) return introMatch[1].trim();
    if (/SLIDE\s*1\s*:|PAGE\s*1\s*:|SUBTITLE:|KPI:|SECTION:|SHEET:|TABLE_HEADER:/i.test(cleaned)) {
        const beforeTags = cleaned.split(/SLIDE\s*1\s*:|PAGE\s*1\s*:|SUBTITLE:|KPI:|SECTION:|SHEET:|TABLE_HEADER:/i)[0].trim();
        return beforeTags || "I've compiled your file and opened it in KIZA Pro Studio!";
    }
    return cleaned || (fullText.includes("```") ? "Your interactive module is ready below!" : "");
}

function detectSpokenLangCode(text) {
    const s = String(text || "");
    const low = s.toLowerCase();
    if (/[\u0A00-\u0A7F]/.test(s)) return "pa-IN";
    if (/[\u0900-\u097F]/.test(s)) return "hi-IN";
    if (/\b(kive|kiven|pra|paaji|paji|veere|bhaji|tusi|tussi|vadiya|wadhiya|kidda|kiddan|sat\s+sri\s+akal|changa|haanji|mainu|menu|tuada|tuhada|sadda|theek\s+aa|ki\s+haal)\b/i.test(low)) return "pa-IN";
    if (/\b(kaise|kaisa|kaisi|hoon|hun|aap|theek|thik|kya|bhai|yaar|mera|meri|hai|nahi|haan|shukriya|namaste|dhanyawad|bilkul|accha|achha|batao)\b/i.test(low)) return "hi-IN";
    return null;
}

function humanizeEmojisForSpeech(text) {
    let s = String(text || "").replace(/\bK\.?\s*I\.?\s*Z\.?\s*A\.?\b/gi, "Keeza");
    s = s.replace(/[💖💕💗💓💞💘❤️🩷🥰😍🥺🎀🥹🤗🫶]+/gu, " awww, ");
    s = s.replace(/[😂🤣😆😹]+/gu, " haha, ");
    s = s.replace(/[😮‍💨😌😩😫🫠✨]+/gu, " ahhh, ");
    s = s.replace(/[😮🤯😱🔥⚡]+/gu, " oooh, ");
    s = s.replace(/[😢😭😔💔]+/gu, " oh no, ");
    s = s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ");
    s = s.replace(/(\b(?:awww|ahhh|haha|oooh|oh no)\b,?\s*){2,}/gi, "$1");
    return s.replace(/\s+/g, " ").trim();
}

function pickAuthenticIndianVoice(targetLang, voices) {
    if (!voices || !voices.length) return null;
    const indianNames = /neerja|prabhat|heera|ravi|madhur|swara|india|indian/i;
    if (targetLang === "en-IN" || targetLang === "hi-IN" || targetLang === "pa-IN") {
        return (
            voices.find(v => v.lang.toLowerCase() === targetLang.toLowerCase() && indianNames.test(v.name)) ||
            voices.find(v => indianNames.test(v.name)) ||
            voices.find(v => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
            voices.find(v => v.lang.toLowerCase() === "en-in") ||
            voices.find(v => v.lang.toLowerCase() === "hi-in")
        );
    }
    return voices.find(v => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
           voices.find(v => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2)));
}

function speakMessageDirectly(textToRead) {
    if (!window.speechSynthesis || !textToRead) return;
    try {
        window.speechSynthesis.cancel();
        const spoken = humanizeEmojisForSpeech(textToRead.slice(0, 320));
        if (!spoken) return;
        const utter = new SpeechSynthesisUtterance(spoken);
        const detectedLang = detectSpokenLangCode(textToRead);
        const p = document.getElementById('personaSelect')?.value || "helpful";
        const targetLang = detectedLang || (p === "helpful" || p === "energetic" ? "en-IN" : "en-GB");
        utter.lang = targetLang;
        const chosen = pickAuthenticIndianVoice(targetLang, window.speechSynthesis.getVoices() || []);
        if (chosen) utter.voice = chosen;
        utter.rate = detectedLang ? 1.02 : (PERSONA_VOICE_CONFIG[p] || PERSONA_VOICE_CONFIG.helpful).rate;
        isKizaSpeaking = true;
        utter.onend = () => { isKizaSpeaking = false; };
        utter.onerror = () => { isKizaSpeaking = false; };
        window.speechSynthesis.speak(utter);
    } catch (e) {}
}

function playKizaAudio(base64Data, fallbackText = "") {
    if (!voiceEnabled) return;
    if (!base64Data) { if (fallbackText) speakMessageDirectly(fallbackText); return; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    isKizaSpeaking = true;
    currentAudio = new Audio("data:audio/mp3;base64," + base64Data);
    currentAudio.playsInline = true;
    currentAudio.playbackRate = (PERSONA_VOICE_CONFIG[document.getElementById('personaSelect')?.value || "helpful"] || PERSONA_VOICE_CONFIG.helpful).rate;
    currentAudio.onended = () => { isKizaSpeaking = false; };
    currentAudio.onerror = () => { isKizaSpeaking = false; if (fallbackText) speakMessageDirectly(fallbackText); };
    currentAudio.play().catch(() => { isKizaSpeaking = false; });
}

function updateVoiceUI() {
    const btn = document.getElementById('voiceToggleBtn'), mb = document.getElementById('mobileVoiceBtn');
    if (voiceEnabled) { if (btn) btn.innerText = "🔊 Voice: On"; if (mb) mb.innerText = "🔊"; }
    else {
        if (btn) btn.innerText = "🔇 Voice: Off"; if (mb) mb.innerText = "🔇";
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        isKizaSpeaking = false;
    }
}
function toggleVoiceMute() { voiceEnabled = !voiceEnabled; updateVoiceUI(); }
function handlePersonaChange() {
    const pVal = document.getElementById('personaSelect').value || "helpful";
    logAction(`[KIZA]: Switched voice preset to ${pVal.toUpperCase()} (Indian Neural + Emoji Reactions active).`);
}

function showVoiceHologram(textStr) {
    const box = document.getElementById('voiceHologramBox'), span = document.getElementById('voiceHologramText');
    if (box && span) { span.innerText = textStr || "Listening..."; box.style.display = "inline-flex"; }
}
function hideVoiceHologram() { const box = document.getElementById('voiceHologramBox'); if (box) box.style.display = "none"; }

let recognition = null, isRecording = false;
let wakeWordEnabled = false, wakeRecognition = null, awaitingWakeCommand = false, wakeCommandTimeout = null;
const WAKE_WORD_VARIATIONS = ["hello", "helo", "listen", "lissen", "kiza"];

function getSelectedSpeechLocale() { return document.getElementById('micLangSelect')?.value || "en-IN"; }

function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true; rec.lang = getSelectedSpeechLocale();
    rec.onstart = () => { isRecording = true; showVoiceHologram(`Listening (${rec.lang})...`); };
    rec.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        if (finalText.trim()) { hideVoiceHologram(); document.getElementById('textInput').value = finalText.trim(); submitCommand(); }
    };
    rec.onerror = () => { isRecording = false; hideVoiceHologram(); };
    rec.onend = () => { isRecording = false; hideVoiceHologram(); };
    return rec;
}

function toggleSpeechRecognition() {
    recognition = initSpeechRecognition();
    if (!recognition) { showNotification("Mic Unavailable", "Voice input is not supported in this browser.", true, { skipStore: true }); return; }
    if (isRecording) recognition.stop();
    else { try { recognition.start(); } catch (e) {} }
}

function initWakeWordEngine() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = getSelectedSpeechLocale();
    rec.onresult = (event) => {
        if (isChatActive || isKizaSpeaking || isPinLocked) return;
        let finalStr = "";
        for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) finalStr += event.results[i][0].transcript;
        const transcript = finalStr.trim();
        if (!transcript) return;
        if (awaitingWakeCommand) { clearTimeout(wakeCommandTimeout); awaitingWakeCommand = false; hideVoiceHologram(); document.getElementById('textInput').value = transcript; submitCommand(); return; }
        const matched = WAKE_WORD_VARIATIONS.find(v => transcript.toLowerCase().includes(v));
        if (matched) {
            playTacticalSFX("sonar");
            const cmdPart = transcript.slice(transcript.toLowerCase().indexOf(matched) + matched.length).replace(/^[,.\s!?-]+/, '').trim();
            if (cmdPart.length > 2) { document.getElementById('textInput').value = cmdPart; submitCommand(); }
            else { awaitingWakeCommand = true; showVoiceHologram("Listening • Speak now..."); wakeCommandTimeout = setTimeout(() => { awaitingWakeCommand = false; hideVoiceHologram(); }, 7000); }
        }
    };
    rec.onend = () => { if (wakeWordEnabled && !isRecording) setTimeout(() => { try { rec.start(); } catch (e) {} }, 300); };
    return rec;
}

function toggleWakeWord() {
    if (!wakeRecognition) wakeRecognition = initWakeWordEngine();
    if (!wakeRecognition) return;
    wakeWordEnabled = !wakeWordEnabled;
    const btn = document.getElementById('wakeToggleBtn');
    if (btn) btn.innerText = wakeWordEnabled ? "🗣️ Wake: On" : "🗣️ Wake: Off";
    if (wakeWordEnabled) { try { wakeRecognition.lang = getSelectedSpeechLocale(); wakeRecognition.start(); } catch (e) {} }
    else { try { wakeRecognition.stop(); } catch (e) {} }
}

// ==========================================================
// 4. CAMERA & HARDWARE SELECTORS
// ==========================================================
async function refreshHardwareDeviceDropdowns() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devs.filter(d => d.kind === 'videoinput');
        audioInputDevices = devs.filter(d => d.kind === 'audioinput');
        [document.getElementById('settingsCamSelect'), document.getElementById('visionDrawerCamSelect')].forEach(sel => {
            if (!sel) return; sel.innerHTML = '';
            videoDevices.forEach((dev, i) => { const o = document.createElement('option'); o.value = dev.deviceId; o.textContent = dev.label || `Camera ${i+1}`; if (dev.deviceId === preferredCamId) o.selected = true; sel.appendChild(o); });
        });
        const micSel = document.getElementById('settingsMicSelect');
        if (micSel) {
            micSel.innerHTML = '';
            audioInputDevices.forEach((dev, i) => { const o = document.createElement('option'); o.value = dev.deviceId; o.textContent = dev.label || `Microphone ${i+1}`; if (dev.deviceId === preferredMicId) o.selected = true; micSel.appendChild(o); });
        }
    } catch (e) {}
}

async function selectPreferredCamera(deviceId) { preferredCamId = deviceId || ""; safeSetItem('kiza_pref_cam_id', preferredCamId); if (isCameraActive) await initCamera(); }
async function selectPreferredMic(deviceId) { preferredMicId = deviceId || ""; safeSetItem('kiza_pref_mic_id', preferredMicId); }

async function initCamera() {
    if (!isCameraActive) return;
    try {
        if (activeStream) activeStream.getTracks().forEach(t => t.stop());
        activeStream = await navigator.mediaDevices.getUserMedia({ video: preferredCamId ? { deviceId: { exact: preferredCamId } } : { facingMode: "user" } });
        const v = document.getElementById('webcamVideo'); v.srcObject = activeStream; v.style.display = "block";
        document.getElementById('camStatus').style.display = "none"; cameraReady = true;
        await refreshHardwareDeviceDropdowns();
    } catch (e) { document.getElementById('camStatus').innerText = "Camera Offline"; document.getElementById('camStatus').style.display = "block"; cameraReady = false; }
}

function toggleCamera() {
    isCameraActive = !isCameraActive;
    document.getElementById('camToggleBtn').innerText = isCameraActive ? "📷 On" : "📷 Off";
    if (isCameraActive) initCamera();
    else { if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; } document.getElementById('webcamVideo').style.display = "none"; document.getElementById('camStatus').style.display = "block"; cameraReady = false; }
}

async function switchCamera() {
    await refreshHardwareDeviceDropdowns();
    if (videoDevices.length <= 1) return;
    currentCamIndex = (videoDevices.findIndex(d => d.deviceId === preferredCamId) + 1) % videoDevices.length;
    await selectPreferredCamera(videoDevices[currentCamIndex].deviceId);
}

function captureFaceSnapshot() {
    if (!cameraReady || !document.getElementById('captureFaceCheck')?.checked) return null;
    return captureSilentSecurityFrame();
}

function captureSilentSecurityFrame() {
    if (!cameraReady) return null;
    try {
        const video = document.getElementById('webcamVideo'), canvas = document.getElementById('faceCanvas');
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.55);
    } catch (e) { return null; }
}

function toggleVisionDrawer() {
    const drawer = document.getElementById('floatingVisionDrawer');
    if (drawer) { drawer.classList.toggle('open'); if (drawer.classList.contains('open')) refreshHardwareDeviceDropdowns(); }
}

// ==========================================================
// 5. SIDEBAR, PINNED, MEMORY VAULT, PERSONAS & TELEMETRY
// ==========================================================
function toggleSidebarCollapse() {
    const sb = document.getElementById('appSidebar'), bd = document.getElementById('sidebarBackdrop');
    if (!sb) return;
    if (window.innerWidth <= 860) { const isOpen = sb.classList.toggle('mobile-open'); if (bd) bd.classList.toggle('mobile-open', isOpen); }
    else sb.classList.toggle('collapsed');
}
function toggleMobileSidebar(forceOpen) {
    if (forceOpen === false) {
        document.getElementById('appSidebar')?.classList.remove('mobile-open');
        document.getElementById('sidebarBackdrop')?.classList.remove('mobile-open');
    }
}

function getPinnedStorageKey() { return `kiza_pinned_msgs_${currentDBUser || 'guest'}`; }
function switchSidebarTab(tabName) {
    const isChats = (tabName === 'chats');
    document.getElementById('sidebarTabChats').classList.toggle('active', isChats);
    document.getElementById('sidebarTabPinned').classList.toggle('active', !isChats);
    document.getElementById('sidebarSessionsList').style.display = isChats ? "flex" : "none";
    document.getElementById('sidebarPinnedList').style.display = isChats ? "none" : "flex";
    if (!isChats) renderPinnedMessagesSidebar();
}

function togglePinMessage(msgText, btnEl = null) {
    if (!msgText) return;
    let pinned = safeGetJSON(getPinnedStorageKey(), []);
    const idx = pinned.findIndex(p => p.text === msgText);
    if (idx >= 0) {
        pinned.splice(idx, 1);
        if (btnEl) { btnEl.classList.remove('pinned'); btnEl.innerText = "📌 Pin"; }
    } else {
        pinned.unshift({ id: "pin_" + Date.now(), text: msgText, date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        if (btnEl) { btnEl.classList.add('pinned'); btnEl.innerText = "📌 Pinned"; }
    }
    safeSetItem(getPinnedStorageKey(), JSON.stringify(pinned.slice(0, 50)));
    renderPinnedMessagesSidebar();
}

function renderPinnedMessagesSidebar() {
    const container = document.getElementById('sidebarPinnedList');
    if (!container) return;
    const pinned = safeGetJSON(getPinnedStorageKey(), []);
    if (!pinned.length) { container.innerHTML = `<div style="font-size:11.5px; color:var(--text-muted); padding:8px;">Tap 📌 Pin under any KIZA reply to save it here!</div>`; return; }
    container.innerHTML = "";
    pinned.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = "notif-item"; div.style.cssText = "padding:8px 10px; cursor:pointer;";
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--accent-primary); font-weight:700;"><span>📌 ${escapeHtml(p.date || '')}</span><button type="button" class="sidebar-chat-del" style="opacity:1;" onclick="event.stopPropagation(); removePinnedItemByIndex(${idx});">✕</button></div><div style="font-size:11.5px; line-height:1.4; color:var(--text-main);">${escapeHtml(p.text.slice(0, 120))}</div>`;
        div.onclick = () => { toggleMobileSidebar(false); logAction(`[KIZA PINNED NOTE]: ${p.text}`); };
        container.appendChild(div);
    });
}
function removePinnedItemByIndex(idx) {
    let pinned = safeGetJSON(getPinnedStorageKey(), []);
    pinned.splice(idx, 1);
    safeSetItem(getPinnedStorageKey(), JSON.stringify(pinned));
    renderPinnedMessagesSidebar();
}

async function refreshSidebarChatSessions() {
    const container = document.getElementById('sidebarSessionsList');
    if (!container || !currentUser || currentUser === "Guest") return;
    const cacheKey = `kiza_offline_sess_${currentDBUser}`;
    let sessionsList = [];
    try {
        const targetU = (currentDBUser && currentDBUser !== "guest") ? currentDBUser : resolveDBUser(currentUser);
        const data = await (await fetch(`${SERVER_URL}/api/history/sessions?target_user=${encodeURIComponent(targetU)}`)).json();
        if (data.success && Array.isArray(data.sessions)) { sessionsList = data.sessions; safeSetItem(cacheKey, JSON.stringify(sessionsList.slice(0, 25))); }
    } catch (e) { sessionsList = safeGetJSON(cacheKey, []); }
    if (!sessionsList.length) { container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:8px;">No recent chats yet</div>`; return; }
    container.innerHTML = "";
    sessionsList.slice(0, 22).forEach(s => {
        const row = document.createElement('div');
        row.className = `sidebar-chat-item ${s.id === currentSessionId ? 'active' : ''}`;
        row.innerHTML = `<span class="sidebar-chat-title">💬 ${escapeHtml(s.title || 'Chat')}</span><button type="button" class="sidebar-chat-del" title="Delete">✕</button>`;
        row.querySelector('.sidebar-chat-title').onclick = () => loadSessionDirectlyFromSidebar(s.id);
        row.querySelector('.sidebar-chat-del').onclick = (e) => { e.stopPropagation(); deleteSidebarSessionItem(s.id); };
        container.appendChild(row);
    });
}

async function loadSessionDirectlyFromSidebar(sessionId) {
    if (!sessionId) return;
    currentSessionId = sessionId;
    toggleMobileSidebar(false);
    const logBox = document.getElementById('actionLog');
    logBox.innerHTML = `<div>> <b>[KIZA]:</b> Loading conversation...</div>`;
    let historyArr = [];
    try {
        const targetU = (currentDBUser && currentDBUser !== "guest") ? currentDBUser : resolveDBUser(currentUser);
        const data = await (await fetch(`${SERVER_URL}/api/history/messages?session_id=${encodeURIComponent(sessionId)}&target_user=${encodeURIComponent(targetU)}`)).json();
        if (data.success && Array.isArray(data.history)) { historyArr = data.history; safeSetItem(`kiza_offline_msgs_${sessionId}`, JSON.stringify(historyArr.slice(-40))); }
    } catch (e) { historyArr = safeGetJSON(`kiza_offline_msgs_${sessionId}`, []); }

    logBox.innerHTML = "";
    if (historyArr.length) {
        const lbl = cleanDisplayNameOnly(currentUser).toUpperCase();
        for (const log of historyArr) {
            const div = document.createElement('div');
            const rawMsg = String(log.message || "");
            const cleanMsg = extractFriendlyAssistantMessage(rawMsg);
            const bTag = document.createElement('b');
            if (log.role !== "USER") bTag.style.color = "var(--accent-primary)";
            bTag.textContent = log.role === "USER" ? `[${lbl}]: ` : `[KIZA]: `;
            const spanTag = document.createElement('span'); spanTag.textContent = cleanMsg;
            div.textContent = "> "; div.appendChild(bTag); div.appendChild(spanTag);
            logBox.appendChild(div); renderMathInElementSafe(spanTag);
            if (log.role !== "USER") {
                appendMessageActionBar(div, cleanMsg, "");
                if (/```mermaid/i.test(rawMsg)) await extractAndRenderMermaidBlocks(rawMsg);
                if (rawMsg.includes("[CHART_DATA]")) extractAndRenderChartBlocks(rawMsg);
                if (rawMsg.includes("```")) extractAndRenderCodeBlocks(rawMsg);
                if (rawMsg.includes("[QUIZ_DATA]")) extractAndRenderInteractiveQuiz(rawMsg);
            }
        }
        logBox.scrollTop = logBox.scrollHeight;
    } else {
        logBox.innerHTML = `<div>> <b>[KIZA]:</b> Conversation loaded.</div>`;
    }
    refreshSidebarChatSessions();
}

async function deleteSidebarSessionItem(sessionId) {
    localStorage.removeItem(`kiza_offline_msgs_${sessionId}`);
    try {
        await fetch(`${SERVER_URL}/api/history/clear`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) });
        if (sessionId === currentSessionId) startNewSession();
        refreshSidebarChatSessions();
    } catch (e) {}
}

async function clearCurrentActiveChatPermanently() {
    localStorage.removeItem(`kiza_offline_msgs_${currentSessionId}`);
    try { await fetch(`${SERVER_URL}/api/history/clear`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: currentSessionId }) }); } catch (e) {}
    currentSessionId = generateSessionId();
    document.getElementById('actionLog').innerHTML = `<div>> <b>[KIZA]:</b> Current chat permanently deleted!</div>`;
    refreshSidebarChatSessions();
}

function startNewSession() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    currentSessionId = generateSessionId();
    clearImageAttachment();
    document.getElementById('actionLog').innerHTML = `<div>> <b>[KIZA]:</b> Fresh conversation started! Ask me anything—in English, Hindi, or Punjabi.</div>`;
    refreshSidebarChatSessions();
}

// Memory Vault
function openProfileMemoryModal() { if (isPinLocked) { openPinGate(pinGateMode); return; } toggleMobileSidebar(false); document.getElementById('profileMemoryModal').style.display = "flex"; loadUserProfileAndMemory(); }
function closeProfileMemoryModal() { document.getElementById('profileMemoryModal').style.display = "none"; }
async function loadUserProfileAndMemory() {
    const localKey = `kiza_mem_vault_${currentDBUser}`;
    const cached = safeGetJSON(localKey, { email: "", age: "", bio: "", memory_notes: "" });
    document.getElementById('profEmailInput').value = cached.email || "";
    document.getElementById('profAgeInput').value = cached.age || "";
    document.getElementById('profBioInput').value = cached.bio || "";
    document.getElementById('profMemoryInput').value = cached.memory_notes || "";
    if (!currentUser || currentUser === "Guest") return;
    try {
        const data = await (await fetch(`${SERVER_URL}/api/profile`)).json();
        if (data.success && data.profile) {
            document.getElementById('profEmailInput').value = data.profile.email || "";
            document.getElementById('profAgeInput').value = data.profile.age || "";
            document.getElementById('profBioInput').value = data.profile.bio || "";
            document.getElementById('profMemoryInput').value = data.profile.memory_notes || "";
            safeSetItem(localKey, JSON.stringify(data.profile));
        }
    } catch (e) {}
}
async function saveUserProfileAndMemory() {
    const payload = {
        email: document.getElementById('profEmailInput').value.trim(),
        age: document.getElementById('profAgeInput').value.trim(),
        bio: document.getElementById('profBioInput').value.trim(),
        memory_notes: document.getElementById('profMemoryInput').value.trim()
    };
    safeSetItem(`kiza_mem_vault_${currentDBUser}`, JSON.stringify(payload));
    try {
        const data = await (await fetch(`${SERVER_URL}/api/profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
        closeProfileMemoryModal();
        showNotification("Memory Vault Saved", data.message || "Encrypted & saved!", false, { skipStore: true });
    } catch (e) { closeProfileMemoryModal(); }
}

// Custom Personas
let customGemsList = safeGetJSON('kiza_user_gems_clean', []);
let activeCustomGem = safeGetJSON('kiza_active_gem_clean', null);
function saveGemsToStorage() { safeSetItem('kiza_user_gems_clean', JSON.stringify(customGemsList)); safeSetItem('kiza_active_gem_clean', JSON.stringify(activeCustomGem)); }
async function syncUserGemsWithServer() {
    if (!currentUser || currentUser === "Guest") return;
    try {
        const data = await (await fetch(`${SERVER_URL}/api/gems`)).json();
        if (data.success && Array.isArray(data.gems)) {
            customGemsList = data.gems;
            if (activeCustomGem && !customGemsList.find(g => g.id === activeCustomGem.id)) activeCustomGem = null;
            saveGemsToStorage(); renderCustomGemsBar(); renderSavedGemsModalList();
        }
    } catch (e) {}
}
function renderCustomGemsBar() {
    const bar = document.getElementById('customGemsBar'), subEl = document.getElementById('activeGemSubtitle');
    if (!bar) return; bar.innerHTML = "";
    const defBtn = document.createElement('button'); defBtn.type = "button"; defBtn.className = `gem-pill ${!activeCustomGem ? 'active' : ''}`; defBtn.textContent = "✦ Default KIZA"; defBtn.onclick = () => selectCustomGem(null); bar.appendChild(defBtn);
    customGemsList.forEach(gem => {
        const btn = document.createElement('button'); btn.type = "button";
        btn.className = `gem-pill ${activeCustomGem && activeCustomGem.id === gem.id ? 'active' : ''}`;
        btn.textContent = `${gem.emoji || '💎'} ${gem.name}`; btn.onclick = () => selectCustomGem(gem.id); bar.appendChild(btn);
    });
    const addBtn = document.createElement('button'); addBtn.type = "button"; addBtn.className = "gem-pill gem-pill-create"; addBtn.textContent = "＋ Create Persona"; addBtn.onclick = () => openGemsModal(); bar.appendChild(addBtn);
    if (subEl) subEl.textContent = activeCustomGem ? `${activeCustomGem.emoji || '💎'} Active Persona: ${activeCustomGem.name}` : "KIZA • Multi-Format AI Command Hub";
}
function openGemsModal() { if (isPinLocked) { openPinGate(pinGateMode); return; } toggleMobileSidebar(false); document.getElementById('gemsModal').style.display = "flex"; renderSavedGemsModalList(); syncUserGemsWithServer(); }
function closeGemsModal() { document.getElementById('gemsModal').style.display = "none"; }
function renderSavedGemsModalList() {
    const c = document.getElementById('savedGemsListContainer');
    if (!c) return; c.innerHTML = customGemsList.length ? "" : `<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">No custom Personas yet.</div>`;
    customGemsList.forEach(gem => {
        const isAct = activeCustomGem && activeCustomGem.id === gem.id;
        const div = document.createElement('div'); div.className = "notif-item";
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><b>${escapeHtml(gem.emoji || '💎')} ${escapeHtml(gem.name)}</b><div style="display:flex; gap:6px;"><button type="button" class="chip-btn" style="width:auto; padding:3px 10px; font-size:11px;" onclick="selectCustomGem('${escapeHtml(gem.id)}'); closeGemsModal();">${isAct ? '✓ Active' : 'Activate'}</button><button type="button" class="chip-btn" style="width:auto; padding:3px 8px; font-size:11px; color:var(--danger);" onclick="deleteCustomGem('${escapeHtml(gem.id)}')">✕</button></div></div><div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(gem.prompt)}</div>`;
        c.appendChild(div);
    });
}
async function saveNewCustomGem() {
    const emoji = (document.getElementById('gemEmojiInput').value || "💎").trim();
    const name = (document.getElementById('gemNameInput').value || "").trim();
    const prompt = (document.getElementById('gemPromptInput').value || "").trim();
    if (!name || !prompt) return;
    const newGem = { id: "gem_" + Date.now(), emoji, name: name.slice(0, 32), prompt: prompt.slice(0, 700) };
    customGemsList.unshift(newGem); activeCustomGem = newGem; saveGemsToStorage();
    document.getElementById('gemNameInput').value = ""; document.getElementById('gemPromptInput').value = "";
    renderCustomGemsBar(); renderSavedGemsModalList(); closeGemsModal();
    try { await fetch(`${SERVER_URL}/api/gems`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gem_id: newGem.id, emoji: newGem.emoji, name: newGem.name, prompt: newGem.prompt }) }); } catch (e) {}
}
function selectCustomGem(gemId) { activeCustomGem = gemId ? (customGemsList.find(g => g.id === gemId) || null) : null; saveGemsToStorage(); renderCustomGemsBar(); renderSavedGemsModalList(); }
async function deleteCustomGem(gemId) {
    customGemsList = customGemsList.filter(g => g.id !== gemId);
    if (activeCustomGem && activeCustomGem.id === gemId) activeCustomGem = null;
    saveGemsToStorage(); renderCustomGemsBar(); renderSavedGemsModalList();
    try { await fetch(`${SERVER_URL}/api/gems?gem_id=${encodeURIComponent(gemId)}`, { method: "DELETE" }); } catch (e) {}
}

// Tutorial & Telemetry
function openTutorialPromptModal() { toggleMobileSidebar(false); document.getElementById('tutorialPromptModal').style.display = "flex"; }
function closeTutorialPromptModal() { document.getElementById('tutorialPromptModal').style.display = "none"; }
function openInteractiveTutorialGuidePDF() {
    closeTutorialPromptModal();
    const logBox = document.getElementById('actionLog');
    const card = document.createElement('div');
    card.style.cssText = "background:var(--card-bg); border:1.5px solid var(--accent-primary); border-radius:14px; padding:14px; margin-top:6px; white-space:normal;";
    card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;"><div><b>📘 KIZA Official User Guide (tutorial.pdf)</b></div><div style="display:flex; gap:6px;"><a href="tutorial.pdf" target="_blank" rel="noopener" class="chip-btn" style="width:auto; padding:6px 12px; font-size:11px; text-decoration:none;">📖 Open</a><a href="tutorial.pdf" download="KIZA_Guide.pdf" class="send-btn" style="padding:6px 13px; font-size:11px; text-decoration:none;">⬇️ Download</a></div></div><iframe src="tutorial.pdf#toolbar=0" style="width:100%; height:420px; border:1px solid var(--card-border); border-radius:10px; background:#0f172a;"></iframe>`;
    logBox.appendChild(card); logBox.scrollTop = logBox.scrollHeight;
}

async function openTelemetryModal() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    toggleMobileSidebar(false);
    if (currentRankNum > 4 && !isMasterOwnerUser(currentUser)) { showNotification("Access Denied", "Ranks 1–4 required.", true); return; }
    document.getElementById('telemetryModal').style.display = "flex";
    await fetchAndRenderTelemetry();
}
function closeTelemetryModal() { document.getElementById('telemetryModal').style.display = "none"; }
async function fetchAndRenderTelemetry() {
    try {
        const data = await (await fetch(`${SERVER_URL}/api/telemetry`)).json();
        if (!data.success) return;
        document.getElementById('teleGroqLatency').innerText = `${data.groq_latency_ms || 160} ms`;
        document.getElementById('teleWsCount').innerText = `${data.active_ws || 1} (${data.online_users || 1} Online)`;
        document.getElementById('teleDbStatus').innerText = data.db_pool_status || "HEALTHY";
        document.getElementById('teleThreatsCount').innerText = String(data.blocked_threats || 0);
        document.getElementById('teleBansCount').innerText = `${data.active_ip_bans || 0} (🛡️ ${data.whitelisted_ips_count || 0})`;
        document.getElementById('teleUsersCount').innerText = String(data.registered_users || 0);
        const mins = Math.floor((data.uptime_seconds || 0) / 60);
        document.getElementById('teleUptime').innerText = `${mins}m ${(data.uptime_seconds || 0) % 60}s`;
        document.getElementById('teleReqCount').innerText = String(data.total_requests || 0);
    } catch (e) {}
}

// ==========================================================
// 6. NOTIFICATIONS, TASKS, REMINDERS, THREATS, RANKS & ARCHIVES
// ==========================================================
function getNotifStorageKey(dbUser = currentDBUser) { return `kiza_notifs_v2_${(dbUser && dbUser !== "undefined") ? dbUser : resolveDBUser(currentUser)}`; }
function getSeenServerIdsKey(dbUser = currentDBUser) { return `kiza_seen_srv_notifs_${(dbUser && dbUser !== "undefined") ? dbUser : resolveDBUser(currentUser)}`; }
function getAlertIdxStorageKey(dbUser = currentDBUser) { return `kiza_last_alert_idx_${(dbUser && dbUser !== "undefined") ? dbUser : resolveDBUser(currentUser)}`; }
function getAlertUniqueId(a) { return a ? (a.server_id ? String(a.server_id) : `sig_${(`${a.target}|${a.title}|${a.message}`).toLowerCase().replace(/[^a-z0-9|]/g, '').slice(0, 80)}`) : null; }
function hasUserSeenOrDeletedAlert(uid, dbUser = currentDBUser) { return uid ? safeGetJSON(getSeenServerIdsKey(dbUser), []).includes(uid) : false; }
function markAlertIdAsSeen(uid, dbUser = currentDBUser) {
    if (!uid || !dbUser || dbUser === "guest") return;
    let list = safeGetJSON(getSeenServerIdsKey(dbUser), []);
    if (!list.includes(uid)) { list.push(uid); safeSetItem(getSeenServerIdsKey(dbUser), JSON.stringify(list.slice(-400))); }
}
async function syncDismissedNotificationsToServer(ids, clearAll = false) {
    if (currentUser === "Guest") return;
    try { await fetch(`${SERVER_URL}/api/notifications/dismiss`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notif_ids: ids || [], clear_all_for_user: clearAll }) }); } catch (e) {}
}
function getUserNotifications(dbUser = currentDBUser) {
    return safeGetJSON(getNotifStorageKey(dbUser), []).filter(n => !n.read || !n.readAt || (Date.now() - n.readAt) < TWO_DAYS_MS);
}
function saveUserNotifications(list, dbUser = currentDBUser) { safeSetItem(getNotifStorageKey(dbUser), JSON.stringify(list)); if (dbUser === currentDBUser) updateUnreadBadges(); }
function addNotificationToUserStore(title, message, category = "broadcast", targetDBUser = currentDBUser, serverId = null, customTimestamp = null) {
    if (!targetDBUser || targetDBUser === "guest") return false;
    if (serverId) { if (hasUserSeenOrDeletedAlert(serverId, targetDBUser)) return false; markAlertIdAsSeen(serverId, targetDBUser); }
    let list = getUserNotifications(targetDBUser);
    if (serverId && list.some(n => n.id === serverId)) return false;
    list.unshift({ id: serverId || ('loc_' + Date.now()), category, title: stripSlashesFromText(title), message: stripSlashesFromText(message), createdAt: customTimestamp || Date.now(), read: false, readAt: null });
    saveUserNotifications(list.slice(0, 120), targetDBUser);
    if (document.getElementById('notifCenterModal').style.display === 'flex' && targetDBUser === currentDBUser) renderNotificationCentre();
    return true;
}
function recordGlobalLockdownToEveryone(title, message, serverId = null) {
    if (currentDBUser && currentDBUser !== "guest") addNotificationToUserStore(title, message, "lockdown", currentDBUser, serverId || getAlertUniqueId({ target: "all", title, message }));
}
function updateUnreadBadges() {
    const cnt = getUserNotifications(currentDBUser).filter(n => !n.read).length;
    [document.getElementById('unreadBadgeCenter'), document.getElementById('unreadBadgeCorner')].forEach(b => {
        if (!b) return;
        if (cnt > 0 && currentUser !== "Guest") { b.innerText = cnt > 99 ? "99+" : cnt; b.classList.add('active'); }
        else { b.innerText = "0"; b.classList.remove('active'); }
    });
}
function showNotification(title, message, isError = false, options = {}) {
    if (!options.skipStore && currentUser !== "Guest" && currentDBUser !== "guest") {
        if (!addNotificationToUserStore(title, message, options.category || (isError ? "error" : "broadcast"), currentDBUser, options.serverId || null, options.timestamp || null) && options.serverId) return;
    }
    playTacticalSFX(isError ? "alert" : "sonar");
    if (userSettings.showNotifs === 'off' && !isError) return;
    const notifBox = document.getElementById('notificationBox');
    document.getElementById('notifTitle').innerText = stripSlashesFromText(title);
    document.getElementById('notifMsg').innerText = stripSlashesFromText(message);
    notifBox.classList.add('show');
    setTimeout(() => notifBox.classList.remove('show'), 4500);
}
function openNotifCenter() { if (isPinLocked) { openPinGate(pinGateMode); return; } toggleMobileSidebar(false); document.getElementById('notifCenterModal').style.display = "flex"; document.getElementById('notifModalUserLabel').innerText = `${cleanDisplayNameOnly(currentUser)} (Rank ${currentRankNum})`; renderNotificationCentre(); syncNotificationsFromServer(false); }
function closeNotifCenter() { document.getElementById('notifCenterModal').style.display = "none"; }
function setNotifFilter(f) { currentNotifFilter = f; ['All', 'Unread', 'Lockdown', 'Error'].forEach(t => document.getElementById(`notifTab${t}`).classList.toggle('active', f === t.toLowerCase())); renderNotificationCentre(); }
function markNotificationRead(id) { let l = getUserNotifications(currentDBUser), it = l.find(n => n.id === id); if (it && !it.read) { it.read = true; it.readAt = Date.now(); markAlertIdAsSeen(id, currentDBUser); saveUserNotifications(l, currentDBUser); renderNotificationCentre(); } }
function markAllNotificationsRead() { let l = getUserNotifications(currentDBUser); l.forEach(n => { markAlertIdAsSeen(n.id, currentDBUser); if (!n.read) { n.read = true; n.readAt = Date.now(); } }); saveUserNotifications(l, currentDBUser); renderNotificationCentre(); }
function deleteNotificationEarly(id) { markAlertIdAsSeen(id, currentDBUser); syncDismissedNotificationsToServer([id], false); saveUserNotifications(getUserNotifications(currentDBUser).filter(n => n.id !== id), currentDBUser); renderNotificationCentre(); }
function clearReadNotifications() { let l = getUserNotifications(currentDBUser), rids = l.filter(n => n.read).map(n => n.id); rids.forEach(id => markAlertIdAsSeen(id, currentDBUser)); syncDismissedNotificationsToServer(rids, false); saveUserNotifications(l.filter(n => !n.read), currentDBUser); renderNotificationCentre(); }
function wipeAllUserNotificationsPermanently() { const all = getUserNotifications(currentDBUser).map(n => n.id); all.forEach(id => markAlertIdAsSeen(id, currentDBUser)); syncDismissedNotificationsToServer(all, true); saveUserNotifications([], currentDBUser); renderNotificationCentre(); }
function renderNotificationCentre() {
    const c = document.getElementById('notifListContainer'); if (!c) return;
    let list = getUserNotifications(currentDBUser);
    if (currentNotifFilter === "unread") list = list.filter(n => !n.read);
    else if (currentNotifFilter === "lockdown") list = list.filter(n => ["lockdown", "security_owner", "broadcast", "update"].includes(n.category));
    else if (currentNotifFilter === "error") list = list.filter(n => n.category === "error");
    c.innerHTML = list.length ? "" : `<div style="text-align:center; margin-top:35px; color:var(--text-muted);">No notifications.</div>`;
    list.forEach(n => {
        const div = document.createElement('div'); div.className = "notif-item";
        div.innerHTML = `<div class="notif-header"><span style="font-weight:700; font-size:12px;">${escapeHtml(n.title)}</span><div style="display:flex; gap:6px;">${!n.read ? `<button class="chip-btn" style="width:auto; padding:2px 8px; font-size:10px;" onclick="markNotificationRead('${escapeHtml(n.id)}')">Mark Read</button>` : ''}<button class="chip-btn" style="width:auto; padding:2px 7px; font-size:10px; color:var(--danger);" onclick="deleteNotificationEarly('${escapeHtml(n.id)}')">✕</button></div></div><div style="font-size:12.5px;">${escapeHtml(n.message)}</div>`;
        c.appendChild(div);
    });
}

// Smart Reminders & Missions
let localSmartReminders = safeGetJSON('kiza_smart_reminders', []);
function saveSmartReminders() { safeSetItem('kiza_smart_reminders', JSON.stringify(localSmartReminders)); }
function parseNaturalLanguageReminder(rawText) {
    const s = (rawText || "").trim();
    const inM = s.match(/(?:remind\s+me\s+in|timer\s+for|in)\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\s*(?:to|for|about|:)?\s*(.*)$/i);
    if (inM && /(remind|timer|alarm)/i.test(s)) {
        const amt = parseInt(inM[1], 10), u = inM[2].toLowerCase();
        return { title: (inM[3] || "Reminder").trim(), targetTimeMs: Date.now() + (u.startsWith('s') ? amt * 1000 : (u.startsWith('h') ? amt * 3600000 : amt * 60000)) };
    }
    return null;
}
function addSmartReminder(title, targetTimeMs) {
    localSmartReminders.unshift({ id: "rem_" + Date.now(), title: title || "KIZA Reminder", targetTimeMs, triggered: false });
    saveSmartReminders(); renderActiveRemindersList();
}
function createSmartReminderFromModal() {
    const inp = document.getElementById('quickReminderTextInput'), raw = (inp.value || "").trim();
    if (!raw) return;
    const p = parseNaturalLanguageReminder("remind me " + raw) || parseNaturalLanguageReminder(raw);
    inp.value = "";
    addSmartReminder(p ? p.title : raw, p ? p.targetTimeMs : (Date.now() + 15 * 60000));
    showNotification("⏰ Timer Set", `Reminder set for "${p ? p.title : raw}"`, false, { skipStore: true });
}
function renderActiveRemindersList() {
    const c = document.getElementById('activeRemindersContainer'); if (!c) return;
    const now = Date.now();
    localSmartReminders = localSmartReminders.filter(r => !r.triggered && (r.targetTimeMs - now) > -60000);
    c.innerHTML = localSmartReminders.map(r => {
        const rem = Math.max(0, Math.floor((r.targetTimeMs - now) / 1000));
        return `<div class="notif-item" style="flex-direction:row; justify-content:space-between; align-items:center;"><b>⏰ ${escapeHtml(r.title)}</b><span style="font-family:monospace; color:var(--accent-primary);">⏳ ${Math.floor(rem / 60)}m ${rem % 60}s</span></div>`;
    }).join("");
}
setInterval(() => {
    const now = Date.now(); let changed = false;
    localSmartReminders.forEach(r => { if (!r.triggered && now >= r.targetTimeMs) { r.triggered = true; changed = true; showNotification("⏰ REMINDER DUE!", r.title); speakMessageDirectly(`Reminder: ${r.title}`); } });
    if (changed) saveSmartReminders();
    if (document.getElementById('missionsModal')?.style.display === "flex") renderActiveRemindersList();
}, 1000);

async function fetchOperativesList() {
    let list = [];
    try {
        const data = await (await fetch(`${SERVER_URL}/api/admin/users`)).json();
        if (data.success && Array.isArray(data.users)) {
            data.users.forEach(u => {
                if (!u) return;
                const norm = { display: String(u.display || u.username), username: String(u.username), role: String(u.role || "USER"), rank_num: u.rank_num || computeRankNumber(u.role, u.username) };
                if (!list.some(x => x.username.toLowerCase() === norm.username.toLowerCase())) list.push(norm);
            });
        }
    } catch (e) {}
    cachedOperatives = list;
    return list;
}

async function openMissionsModal() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    toggleMobileSidebar(false);
    document.getElementById('missionsModal').style.display = "flex";
    const canAssign = currentRankNum <= 3;
    document.getElementById('missionAssignBox').style.display = canAssign ? "flex" : "none";
    renderActiveRemindersList();
    if (canAssign) {
        const sel = document.getElementById('missionAssigneeSelect');
        sel.innerHTML = `<option value="all">🌐 All Users</option>`;
        await fetchOperativesList();
        cachedOperatives.forEach(u => { let o = document.createElement('option'); o.value = u.username; o.innerText = `👤 ${cleanDisplayNameOnly(u.display)}`; sel.appendChild(o); });
    }
    await fetchAndRenderMissions();
}
function closeMissionsModal() { document.getElementById('missionsModal').style.display = "none"; }
async function fetchAndRenderMissions() {
    const c = document.getElementById('missionsListContainer');
    c.innerHTML = `<div style="text-align:center; margin-top:20px;">Loading tasks...</div>`;
    try {
        const data = await (await fetch(`${SERVER_URL}/api/missions`)).json();
        c.innerHTML = "";
        if (!data.success || !data.missions?.length) { c.innerHTML = `<div style="text-align:center; margin-top:30px; color:var(--text-muted);">No tasks assigned yet.</div>`; return; }
        data.missions.forEach(m => {
            const isDone = m.status === "COMPLETED";
            const div = document.createElement('div'); div.className = "notif-item";
            div.innerHTML = `<div class="notif-header"><span class="notif-tag">${isDone ? '✓ Done' : '⏳ Pending'} • ${escapeHtml(m.assignee.toUpperCase())}</span>${!isDone ? `<button class="chip-btn" style="width:auto; padding:3px 9px; font-size:10.5px; color:var(--success);" onclick="markMissionComplete(${m.id})">✓ Mark Done</button>` : ''}</div><div style="font-size:13px; font-weight:600;">${escapeHtml(m.title)}</div><div class="notif-meta"><span>From ${escapeHtml(cleanDisplayNameOnly(m.assigned_by))}</span><span>🕒 ${escapeHtml(m.date)}</span></div>`;
            c.appendChild(div);
        });
    } catch (e) { c.innerHTML = `<div style="color:var(--danger); text-align:center;">Failed to load tasks.</div>`; }
}
async function submitNewMission() {
    const assignee = document.getElementById('missionAssigneeSelect').value || "all";
    const title = document.getElementById('missionTitleInput').value.trim();
    if (!title) return;
    try {
        if ((await (await fetch(`${SERVER_URL}/api/missions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignee, title }) })).json()).success) {
            document.getElementById('missionTitleInput').value = "";
            await fetchAndRenderMissions();
        }
    } catch (e) {}
}
async function markMissionComplete(id) { try { await fetch(`${SERVER_URL}/api/missions/complete?mission_id=${id}`, { method: "POST" }); await fetchAndRenderMissions(); } catch (e) {} }

async function openThreatsModal() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    toggleMobileSidebar(false);
    if (currentRankNum > 4) { showNotification("Access Denied", "Ranks 1–4 required.", true); return; }
    document.getElementById('threatsModal').style.display = "flex";
    document.getElementById('wipeAllThreatsBtn').style.display = currentRankNum <= 2 ? "inline-flex" : "none";
    const wl = document.getElementById('ownerWhitelistBox'); if (wl) wl.style.display = currentRankNum <= 2 ? "flex" : "none";
    await fetchAndRenderThreats();
}
function closeThreatsModal() { document.getElementById('threatsModal').style.display = "none"; }
function submitOwnerWhitelistIp() { const ip = document.getElementById('whitelistIpInput').value.trim(); if (!ip) return; document.getElementById('whitelistIpInput').value = ""; closeThreatsModal(); sendQuickCmd(`/whitelistip ${ip}`); }
async function fetchAndRenderThreats() {
    const c = document.getElementById('threatsListContainer'), banner = document.getElementById('threatsBannedBanner');
    c.innerHTML = `<div style="text-align:center; margin-top:25px;">Loading security logs...</div>`;
    try {
        const data = await (await fetch(`${SERVER_URL}/api/security/logs`)).json();
        if (!data.success) { c.innerHTML = `<div style="color:var(--danger); text-align:center;">${escapeHtml(data.message)}</div>`; return; }
        cachedThreatLogs = data.logs || [];
        const canDel = Boolean(data.can_delete);
        document.getElementById('wipeAllThreatsBtn').style.display = canDel ? "inline-flex" : "none";
        let bp = [];
        if (data.banned_ips?.length) bp.push(`🚫 Banned: ` + data.banned_ips.map(b => `${b.ip} (${b.remaining_seconds}s)`).join(" | "));
        if (data.whitelisted_ips?.length) bp.push(`🛡️ Whitelisted: ` + data.whitelisted_ips.join(", "));
        banner.style.display = bp.length ? "block" : "none"; banner.innerText = bp.join(" • ");
        c.innerHTML = cachedThreatLogs.length ? "" : `<div style="text-align:center; margin-top:35px; color:var(--success);">✓ No security alerts recorded.</div>`;
        cachedThreatLogs.forEach(item => {
            const div = document.createElement('div'); div.className = "notif-item";
            const mugHTML = item.mugshot ? `<img src="${item.mugshot}" class="mugshot-img" alt="Snap">` : `<div style="width:60px; height:48px; border-radius:8px; border:1px dashed var(--card-border); display:flex; align-items:center; justify-content:center; font-size:9px; color:var(--text-muted);">Log</div>`;
            const hasIp = item.ip_address && item.ip_address !== 'unknown';
            div.innerHTML = `<div style="display:flex; gap:12px; align-items:center;">${mugHTML}<div style="flex:1; display:flex; flex-direction:column; gap:4px;"><div class="notif-header"><div><span class="notif-tag">${escapeHtml(item.event_type)}</span> <b style="font-size:12px;">${escapeHtml((item.username || 'Unknown').toUpperCase())}</b></div><div style="display:flex; gap:4px;">${hasIp ? `<button class="chip-btn" style="width:auto; padding:2px 7px; font-size:9.5px; color:var(--warning);" onclick="closeThreatsModal(); sendQuickCmd('/banip ${escapeHtml(item.ip_address)} 1h Security');">🚫 1h</button><button class="chip-btn" style="width:auto; padding:2px 7px; font-size:9.5px; color:var(--danger);" onclick="closeThreatsModal(); sendQuickCmd('/banip ${escapeHtml(item.ip_address)} perm Ban');">🚫 Perm</button>` : ''}${canDel ? `<button class="chip-btn" style="width:auto; padding:2px 7px; font-size:9.5px; color:var(--danger);" onclick="deleteSecurityThreatLog(${item.id})">🗑️</button>` : ''}</div></div><div style="font-size:12px;">${escapeHtml(item.details)}</div><div class="notif-meta"><span>🌐 IP: <b>${escapeHtml(item.ip_address)}</b></span><span>🕒 ${escapeHtml(item.timestamp)}</span></div></div></div>`;
            c.appendChild(div);
        });
    } catch (e) { c.innerHTML = `<div style="color:var(--danger); text-align:center;">Failed to load security logs.</div>`; }
}
async function deleteSecurityThreatLog(logId = null) {
    try {
        const url = logId !== null ? `${SERVER_URL}/api/security/logs?log_id=${logId}` : `${SERVER_URL}/api/security/logs`;
        if ((await (await fetch(url, { method: "DELETE" })).json()).success) await fetchAndRenderThreats();
    } catch (e) {}
}

// Broadcast, Updates, Rank, Purge & Archives
const BASE_BROADCAST_GROUPS = [
    { value: "all", label: "🌐 Everyone (Global)", searchKey: "all users global everyone" },
    { value: "admin", label: "⚡ Admins Only (Rank 4)", searchKey: "admins admin" },
    { value: "mod", label: "🛡️ Moderators Only (Rank 3)", searchKey: "moderators mod" },
    { value: "owner", label: "👑 Owners Only (Ranks 1 & 2)", searchKey: "owners owner master" }
];
async function openBroadcastModal() { if (isPinLocked) { openPinGate(pinGateMode); return; } toggleMobileSidebar(false); document.getElementById('broadcastModal').style.display = "flex"; document.getElementById('broadcastSearchInput').value = ""; document.getElementById('broadcastMsgInput').value = ""; await fetchOperativesList(); renderBroadcastTargetsDropdown(""); }
function renderBroadcastTargetsDropdown(f) {
    const sel = document.getElementById('broadcastTargetSelect'), q = (f || "").toLowerCase().trim(); sel.innerHTML = "";
    BASE_BROADCAST_GROUPS.forEach(g => { if (!q || g.searchKey.includes(q)) { let o = document.createElement('option'); o.value = g.value; o.innerText = g.label; sel.appendChild(o); } });
    cachedOperatives.forEach(u => { const d = cleanDisplayNameOnly(u.display); if (!q || d.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) { let o = document.createElement('option'); o.value = u.username; o.innerText = `👤 ${d}`; sel.appendChild(o); } });
}
function filterBroadcastTargets() { renderBroadcastTargetsDropdown(document.getElementById('broadcastSearchInput').value); }
function closeBroadcastModal() { document.getElementById('broadcastModal').style.display = "none"; }
function submitBroadcastModal() { const t = document.getElementById('broadcastTargetSelect').value || "all", m = document.getElementById('broadcastMsgInput').value.trim(); if (!m) return; closeBroadcastModal(); document.getElementById('textInput').value = `/notify ${t} ${m}`; submitCommand(); }

async function openUpdatesModal() { if (isPinLocked) { openPinGate(pinGateMode); return; } toggleMobileSidebar(false); document.getElementById('updatesModal').style.display = "flex"; document.getElementById('ownerUpdatePublisher').style.display = currentRankNum <= 2 ? "flex" : "none"; await fetchAndRenderUpdates(); }
function closeUpdatesModal() { document.getElementById('updatesModal').style.display = "none"; }
async function fetchAndRenderUpdates() {
    const c = document.getElementById('updatesListContainer');
    let list = DEFAULT_UPDATES_FALLBACK;
    try { const d = await (await fetch(`${SERVER_URL}/api/updates`)).json(); if (d.success && d.updates?.length) list = d.updates; } catch (e) {}
    c.innerHTML = "";
    const canDel = (currentRankNum <= 2 || isMasterOwnerUser(currentUser));
    list.forEach(u => {
        const div = document.createElement('div'); div.className = "update-card";
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:700; font-size:12.5px; color:var(--accent-primary);">[${escapeHtml(u.version || 'LIVE')}] ${escapeHtml(u.title)}</span><div style="display:flex; gap:6px; align-items:center;"><span style="font-size:10.5px; color:var(--text-muted);">${escapeHtml(u.date || 'LIVE')}</span>${(canDel && u.id) ? `<button type="button" class="chip-btn" style="width:auto; padding:2px 7px; font-size:10px; color:var(--danger);" onclick="deleteSystemUpdate(${u.id})">🗑️</button>` : ''}</div></div><div style="font-size:12.5px;">${escapeHtml(u.description)}</div><div style="font-size:10.5px; color:var(--text-muted);">By ${escapeHtml(u.author || 'Viyan Arora')}</div>`;
        c.appendChild(div);
    });
}
async function publishSystemUpdate() {
    const ver = document.getElementById('newUpdateVersion').value.trim() || "LIVE";
    const title = document.getElementById('newUpdateTitle').value.trim();
    const desc = document.getElementById('newUpdateDesc').value.trim();
    if (!title || !desc) return;
    try { if ((await (await fetch(`${SERVER_URL}/api/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: ver, title, description: desc }) })).json()).success) { document.getElementById('newUpdateTitle').value = ""; document.getElementById('newUpdateDesc').value = ""; await fetchAndRenderUpdates(); } } catch (e) {}
}
async function deleteSystemUpdate(id) { try { if ((await (await fetch(`${SERVER_URL}/api/updates?update_id=${id}`, { method: "DELETE" })).json()).success) await fetchAndRenderUpdates(); } catch (e) {} }

async function openRankModal() { if (isPinLocked) { openPinGate(pinGateMode); return; } toggleMobileSidebar(false); document.getElementById('rankModal').style.display = "flex"; document.getElementById('rankSearchInput').value = ""; await fetchOperativesList(); renderRankOperativesDropdown(""); }
function renderRankOperativesDropdown(f) {
    const sel = document.getElementById('rankSearchSelect'), q = (f || "").toLowerCase().trim();
    sel.innerHTML = '<option value="">-- Select User --</option>';
    cachedOperatives.filter(u => !isMasterOwnerUser(u.username) && (u.display.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))).forEach(u => { let o = document.createElement('option'); o.value = u.username; o.innerText = `${cleanDisplayNameOnly(u.display)} (${u.username})`; sel.appendChild(o); });
}
function filterRankOperatives() { renderRankOperativesDropdown(document.getElementById('rankSearchInput').value); }
function closeRankModal() { document.getElementById('rankModal').style.display = "none"; }
function submitRankAssignment() { let t = document.getElementById('rankSearchSelect').value || resolveDBUser(document.getElementById('rankSearchInput').value.trim()); if (!t) return; closeRankModal(); document.getElementById('textInput').value = `/giverank ${t} ${document.getElementById('rankSelectDropdown').value}`; submitCommand(); }

async function openPurgeModal() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    if (currentRankNum > 3 && !isMasterOwnerUser(currentUser)) { showNotification("Access Denied", "Top 3 Ranks required.", true); return; }
    document.getElementById('purgeModal').style.display = "flex";
    document.getElementById('purgeSearchInput').value = ""; document.getElementById('purgeMasterPinInput').value = "";
    document.getElementById('masterOwnerSetPurgePinBox').style.display = isMasterOwnerUser(currentUser) ? "flex" : "none";
    await fetchOperativesList(); renderPurgeUsersDropdown("");
}
function renderPurgeUsersDropdown(f) {
    const sel = document.getElementById('purgeTargetSelect'), q = (f || "").toLowerCase().trim();
    sel.innerHTML = '<option value="">-- Select User to Remove --</option>';
    const isM = isMasterOwnerUser(currentUser);
    cachedOperatives.filter(u => !isMasterOwnerUser(u.username) && u.username.toLowerCase() !== currentDBUser.toLowerCase() && (isM || (u.rank_num || 5) > 4) && (!q || u.display.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))).forEach(u => {
        let o = document.createElement('option'); o.value = u.username; o.innerText = `👤 ${cleanDisplayNameOnly(u.display)} [Rank ${u.rank_num || 5}]`; sel.appendChild(o);
    });
}
function filterPurgeUsersDropdown() { renderPurgeUsersDropdown(document.getElementById('purgeSearchInput').value); }
function closePurgeModal() { document.getElementById('purgeModal').style.display = "none"; }
function submitPurgeWithMasterPin() {
    const t = document.getElementById('purgeTargetSelect').value || document.getElementById('purgeSearchInput').value.trim();
    const pin = document.getElementById('purgeMasterPinInput').value.trim();
    if (!t || !pin) return;
    closePurgeModal(); document.getElementById('textInput').value = `/purge ${t} | ${pin}`; submitCommand();
}
async function updateMasterOwnerPurgePin() {
    const p = document.getElementById('newMasterPurgePinInput').value.trim();
    if (!/^\d{4,8}$/.test(p)) return;
    try { const d = await (await fetch(`${SERVER_URL}/api/set_purge_pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_pin: p }) })).json(); if (d.success) { document.getElementById('newMasterPurgePinInput').value = ""; showNotification("Updated", d.message, false, { skipStore: true }); } } catch (e) {}
}

let selectedLogTarget = "";
async function openLogsModal() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    toggleMobileSidebar(false);
    document.getElementById('logsModal').style.display = "flex";
    const adminControls = document.getElementById('archiveAdminControls'), opSelect = document.getElementById('logOperativeSelect');
    document.getElementById('logSearchInput').value = "";
    selectedLogTarget = currentDBUser;
    if (currentRankNum <= 4) { adminControls.style.display = "flex"; await fetchOperativesList(); renderArchiveOperativesDropdown(""); opSelect.value = currentDBUser; }
    else adminControls.style.display = "none";
    fetchLogSessions();
}
function renderArchiveOperativesDropdown(f) {
    const sel = document.getElementById('logOperativeSelect'), q = (f || "").toLowerCase().trim(); sel.innerHTML = '';
    [{ display: `${cleanDisplayNameOnly(currentUser)} (You)`, username: currentDBUser }, ...cachedOperatives.filter(u => u.username.toLowerCase() !== currentDBUser.toLowerCase())]
        .filter(u => u.display.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
        .forEach(u => { let o = document.createElement('option'); o.value = u.username; o.innerText = u.display; sel.appendChild(o); });
}
function filterArchiveOperatives() { renderArchiveOperativesDropdown(document.getElementById('logSearchInput').value); handleUserSelect(); }
function closeLogsModal() { document.getElementById('logsModal').style.display = "none"; }
function handleUserSelect() { selectedLogTarget = document.getElementById('logOperativeSelect').value; if (selectedLogTarget) fetchLogSessions(); }
async function fetchLogSessions() {
    const sel = document.getElementById('logSessionSelect'), viewer = document.getElementById('logsViewer');
    sel.innerHTML = '<option value="">-- Loading... --</option>';
    try {
        const d = await (await fetch(`${SERVER_URL}/api/history/sessions?target_user=${encodeURIComponent(selectedLogTarget)}`)).json();
        sel.innerHTML = '<option value="">-- Select Conversation --</option>';
        if (d.success && d.sessions?.length) { d.sessions.forEach((s, i) => { let o = document.createElement('option'); o.value = s.id; o.innerText = `${i + 1}. ${s.title}`; sel.appendChild(o); }); sel.selectedIndex = 1; handleSessionSelect(); }
        else viewer.innerHTML = '<div style="text-align:center; margin-top:20px;">No saved conversations found.</div>';
    } catch (e) {}
}
async function handleSessionSelect() {
    const sid = document.getElementById('logSessionSelect').value, viewer = document.getElementById('logsViewer'), resumeBtn = document.getElementById('resumeArchiveBtn');
    currentArchiveExportData = [];
    if (!sid) { resumeBtn.style.display = "none"; return; }
    try {
        const d = await (await fetch(`${SERVER_URL}/api/history/messages?session_id=${encodeURIComponent(sid)}&target_user=${encodeURIComponent(selectedLogTarget)}`)).json();
        viewer.innerHTML = '';
        if (d.success && d.history?.length) {
            const lbl = cleanDisplayNameOnly(selectedLogTarget || currentUser).toUpperCase();
            d.history.forEach(log => {
                const div = document.createElement('div');
                const tStr = (String(log.timestamp || "").match(/(\d{2}:\d{2}:\d{2})/) || ["", ""])[1];
                const cleanMsg = extractFriendlyAssistantMessage(log.message);
                currentArchiveExportData.push({ time: tStr, sender: log.role === "USER" ? lbl : "KIZA", message: cleanMsg });
                div.innerHTML = log.role === "USER" ? `<span style="opacity:0.6;">[${tStr}]</span> <b>[${escapeHtml(lbl)}]:</b> ${escapeHtml(cleanMsg)}` : `<span style="opacity:0.6;">[${tStr}]</span> <b style="color:var(--accent-primary);">[KIZA]:</b> ${escapeHtml(cleanMsg)}`;
                viewer.appendChild(div); renderMathInElementSafe(div);
            });
            viewer.scrollTop = viewer.scrollHeight; resumeBtn.style.display = "block";
        }
    } catch (e) {}
}
async function deleteSelectedArchiveSessionPermanently() {
    const sid = document.getElementById('logSessionSelect').value; if (!sid) return;
    try { if ((await (await fetch(`${SERVER_URL}/api/history/clear`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: selectedLogTarget || currentUser, session_id: sid }) })).json()).success) { await fetchLogSessions(); refreshSidebarChatSessions(); } } catch (e) {}
}
function resumeArchive() { const sid = document.getElementById('logSessionSelect').value; if (!sid) return; closeLogsModal(); loadSessionDirectlyFromSidebar(sid); }

// ==========================================================
// 7. WEBSOCKET, GUARANTEED BROADCASTS & SAVED WHITEBOARD CARD
// ==========================================================
async function syncNotificationsFromServer(showToastForLatest = false) {
    if (!currentUser || currentUser === "Guest" || !currentSessionSig) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/notifications`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
            let latestAdded = null;
            data.notifications.slice().reverse().forEach(alert => {
                const uid = getAlertUniqueId(alert);
                if (hasUserSeenOrDeletedAlert(uid, currentDBUser)) return;
                const added = addNotificationToUserStore(alert.title, alert.message, alert.category || "broadcast", currentDBUser, uid, alert.timestamp);
                if (added) latestAdded = alert;
            });
            updateUnreadBadges();
            if (document.getElementById('notifCenterModal')?.style.display === "flex") renderNotificationCentre();
            if (showToastForLatest && latestAdded) {
                showNotification(latestAdded.title, latestAdded.message, latestAdded.category === "lockdown" || latestAdded.category === "security_owner", { skipStore: true });
            }
        }
    } catch (e) {}
}

function handleServerStatusPayload(data) {
    if (!data) return;
    if (data.type === "pong" && wsLastPingSent > 0) {
        const p = document.getElementById('pingHudPill');
        if (p) p.innerText = `⚡ ${Math.max(12, Math.round(performance.now() - wsLastPingSent))}ms`;
    }
    if (data.ip_banned) { forceLogout(); showNotification("Temporarily Banned", data.reason || "Access restricted.", true, { skipStore: true }); return; }
    if (data.revoked_device_id && data.revoked_device_id === CURRENT_DEVICE_ID) { forceLogout(); showNotification("Device Signed Out", "Session revoked.", true, { skipStore: true }); return; }

    const withinGrace = (Date.now() - lastLoginTimestamp) < 12000;
    if (data.force_logout_token_version && !withinGrace && data.force_logout_token_version > currentTokenVersion) { forceLogout(); showNotification("Signed Out", data.reason || "Signed out remotely.", true, { skipStore: true }); return; }
    if (data.token_version) {
        if (withinGrace || data.token_version < currentTokenVersion) { currentTokenVersion = data.token_version; safeSetItem(getTokenVerStorageKey(currentDBUser), String(currentTokenVersion)); }
        else if (data.token_version > currentTokenVersion) { forceLogout(); return; }
    }
    if (data.next_alert_idx !== undefined) { alertIndex = data.next_alert_idx; safeSetItem(getAlertIdxStorageKey(currentDBUser), String(alertIndex)); }
    if (data.role && data.role !== "LOCKED" && formatCleanRole(data.role, currentUser) !== currentRole) applyRoleUI(data.role);
    if (data.new_alerts?.length) {
        data.new_alerts.forEach(alert => {
            const uid = getAlertUniqueId(alert);
            if (hasUserSeenOrDeletedAlert(uid, currentDBUser)) return;
            const cat = alert.category || "broadcast";
            showNotification(alert.title, alert.message, cat === "lockdown" || cat === "security_owner", { category: cat, serverId: uid, timestamp: alert.timestamp });
        });
    }
    if (data.lockdown && currentRankNum > 4 && !isMasterOwnerUser(currentUser)) { forceLogout(); showNotification("System Lockdown", data.reason || "Lockdown active.", true, { skipStore: true }); }
}

function initWebSocket() {
    if (currentUser === "Guest" || !currentSessionSig) return;
    syncNotificationsFromServer(true);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} }
    try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
            wsConnected = true;
            ws.send(JSON.stringify({ type: "auth", token: currentSessionSig }));
            wsLastPingSent = performance.now();
            setTimeout(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 400);
            if (wsPingTimer) clearInterval(wsPingTimer);
            wsPingTimer = setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) { wsLastPingSent = performance.now(); ws.send("ping"); } }, 22000);
        };
        ws.onmessage = (event) => { try { handleServerStatusPayload(JSON.parse(event.data)); } catch (e) {} };
        ws.onclose = (ev) => {
            wsConnected = false;
            if (wsPingTimer) clearInterval(wsPingTimer);
            if (ev.code !== 1008 && currentUser !== "Guest" && currentSessionSig) setTimeout(initWebSocket, 5000);
        };
        ws.onerror = () => { wsConnected = false; };
    } catch (e) { wsConnected = false; }
}

function checkAndRenderLiveCallMinutes() {
    const logBox = document.getElementById('actionLog');
    if (!logBox) return;

    try {
        const wbRaw = localStorage.getItem('kiza_saved_whiteboard');
        if (wbRaw) {
            localStorage.removeItem('kiza_saved_whiteboard');
            const wbObj = JSON.parse(wbRaw);
            if (wbObj && wbObj.image) {
                const wbCard = document.createElement('div');
                wbCard.style.cssText = "background:var(--card-bg); border:1.5px solid var(--accent-primary); border-radius:16px; padding:12px; margin-top:6px; white-space:normal;";
                wbCard.innerHTML = `<div style="font-weight:800; font-size:12.5px; color:var(--accent-primary); margin-bottom:8px;">🎨 Saved Whiteboard (${escapeHtml(wbObj.timestamp || '')})</div><img src="${wbObj.image}" style="width:100%; max-height:280px; object-fit:contain; border-radius:10px; background:#090f1d; margin-bottom:8px;"><div style="font-size:12px; color:var(--text-muted);">${escapeHtml(wbObj.note || '')}</div>`;
                logBox.appendChild(wbCard);
            }
        }
    } catch (e) {}

    try {
        const raw = localStorage.getItem('kiza_last_call_minutes');
        if (!raw) return;
        localStorage.removeItem('kiza_last_call_minutes');
        const minObj = JSON.parse(raw);
        if (!minObj) return;
        const topicsHtml = minObj.topics?.length ? minObj.topics.map(t => `<div style="font-size:12px;">• ${escapeHtml(t)}</div>`).join('') : `<div style="font-size:12px; color:var(--text-muted);">• Voice & vision session</div>`;
        const decHtml = minObj.decisions?.length ? minObj.decisions.map(d => `<div style="font-size:12px;">✓ ${escapeHtml(d)}</div>`).join('') : `<div style="font-size:12px; color:var(--text-muted);">✓ Completed</div>`;
        const card = document.createElement('div'); card.className = "call-minutes-card";
        card.innerHTML = `<div style="font-weight:800; font-size:13px; color:var(--success); margin-bottom:8px;">📞 LIVE CALL MINUTES • Duration: ${escapeHtml(minObj.duration || '00:00')} (${escapeHtml(minObj.timestamp || '')})</div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:10px;"><div><b style="font-size:10.5px; color:var(--accent-primary);">TOPICS</b>${topicsHtml}</div><div><b style="font-size:10.5px; color:var(--success);">SUMMARY</b>${decHtml}</div></div>`;
        logBox.appendChild(card); logBox.scrollTop = logBox.scrollHeight;
    } catch (e) {}
}

// ==========================================================
// 8. CHAT FEED, ZERO-TRUST CONFIRMATIONS & STREAMING SUBMITTER
// ==========================================================
const SLASH_COMMANDS_CATALOG = [
    { cmd: "/help", desc: "Open Official Guide PDF & manifest", maxRank: 5 },
    { cmd: "/logs", desc: "Open Chat History & Archives", maxRank: 5 },
    { cmd: "/logoutall ", desc: "Sign out other devices: /logoutall [pin]", maxRank: 5 },
    { cmd: "/telemetry", desc: "Real-Time Telemetry (Ranks 1–4)", maxRank: 4 },
    { cmd: "/health", desc: "Server diagnostics", maxRank: 4 },
    { cmd: "/operative", desc: "Online users", maxRank: 4 },
    { cmd: "/userdata", desc: "Registered users", maxRank: 4 },
    { cmd: "/threats", desc: "Security incidents & IP/user bans", maxRank: 4 },
    { cmd: "/wrongpass", desc: "Failed login & moderation logs", maxRank: 4 },
    { cmd: "/notify ", desc: "Broadcast: /notify [target] [msg]", maxRank: 4 },
    { cmd: "/lockdown ", desc: "Lockdown: /lockdown [reason]", maxRank: 4 },
    { cmd: "/banip ", desc: "Timed IP ban: /banip [ip] [1h|24h|perm]", maxRank: 3 },
    { cmd: "/unban ", desc: "Unban user/IP: /unban [user|ip|all]", maxRank: 3 },
    { cmd: "/giverank ", desc: "Set role: /giverank [user] [role]", maxRank: 3 },
    { cmd: "/purgelog", desc: "View user removal logs", maxRank: 3 },
    { cmd: "/purge ", desc: "Remove user: /purge [user] | [pin]", maxRank: 3 },
    { cmd: "/whitelistip ", desc: "Whitelist Owner IP", maxRank: 2 },
    { cmd: "/removelock", desc: "Lift system lockdown", maxRank: 2 },
    { cmd: "/clearthreats", desc: "Clear all security logs", maxRank: 2 },
    { cmd: "/update ", desc: "Publish update: /update Title | Desc", maxRank: 2 },
    { cmd: "/setpurgepin ", desc: "Change Master Purge PIN (Rank 1)", maxRank: 1 }
];

function handleSlashAutocomplete(inputEl) {
    const val = inputEl.value, box = document.getElementById('slashAutocomplete');
    if (!box) return;
    if (!val.startsWith('/')) { box.style.display = 'none'; return; }
    const q = val.toLowerCase().trim();
    const matches = SLASH_COMMANDS_CATALOG.filter(c => currentRankNum <= c.maxRank && c.cmd.toLowerCase().startsWith(q));
    if (!matches.length) { box.style.display = 'none'; return; }
    box.innerHTML = '';
    matches.forEach(m => {
        const div = document.createElement('div'); div.className = 'slash-item';
        div.innerHTML = `<span class="slash-cmd-name">${escapeHtml(m.cmd)}</span><span class="slash-cmd-desc">${escapeHtml(m.desc)}</span>`;
        div.onclick = () => { inputEl.value = m.cmd; box.style.display = 'none'; inputEl.focus(); if (!m.cmd.endsWith(' ')) submitCommand(); };
        box.appendChild(div);
    });
    box.style.display = 'flex';
}

function appendMessageActionBar(msgEl, cleanText, origPrompt = "") {
    if (!msgEl || !cleanText) return;
    msgEl.querySelector('.msg-action-bar')?.remove();
    const bar = document.createElement('div'); bar.className = "msg-action-bar";

    const copyBtn = document.createElement('button'); copyBtn.type = "button"; copyBtn.className = "msg-action-btn"; copyBtn.innerText = "📋 Copy";
    copyBtn.onclick = () => { navigator.clipboard.writeText(cleanText); copyBtn.innerText = "✓ Copied"; setTimeout(() => { copyBtn.innerText = "📋 Copy"; }, 1800); };
    bar.appendChild(copyBtn);

    if (origPrompt) {
        const rBtn = document.createElement('button'); rBtn.type = "button"; rBtn.className = "msg-action-btn"; rBtn.innerText = "🔄 Regenerate";
        rBtn.onclick = () => { if (!isChatActive) { document.getElementById('textInput').value = origPrompt; submitCommand(); } };
        bar.appendChild(rBtn);
    }

    const sBtn = document.createElement('button'); sBtn.type = "button"; sBtn.className = "msg-action-btn"; sBtn.innerText = "🔊 Read Aloud";
    sBtn.onclick = () => speakMessageDirectly(cleanText);
    bar.appendChild(sBtn);

    const isPinned = safeGetJSON(getPinnedStorageKey(), []).some(p => p.text === cleanText);
    const pBtn = document.createElement('button'); pBtn.type = "button"; pBtn.className = `msg-action-btn ${isPinned ? 'pinned' : ''}`; pBtn.innerText = isPinned ? "📌 Pinned" : "📌 Pin";
    pBtn.onclick = () => togglePinMessage(cleanText, pBtn);
    bar.appendChild(pBtn);

    msgEl.appendChild(bar);
}

function renderZeroTrustConfirmationCard(pendingCmd) {
    const logBox = document.getElementById('actionLog');
    const card = document.createElement('div');
    card.style.cssText = "background:var(--card-bg); border:1.5px solid var(--warning); border-radius:14px; padding:12px; margin-top:6px; white-space:normal;";
    card.innerHTML = `
        <div style="font-size:12px; font-weight:700; color:var(--warning); margin-bottom:8px;">🛡️ Zero-Trust Action Guard: Confirm execution of <code>${escapeHtml(pendingCmd)}</code></div>
        <div style="display:flex; gap:8px;">
            <button type="button" class="send-btn" style="background:var(--danger); color:#fff; padding:6px 14px; font-size:11.5px;">✓ Confirm & Execute</button>
            <button type="button" class="chip-btn" style="width:auto; padding:6px 12px; font-size:11.5px;">✕ Cancel</button>
        </div>
    `;
    const [confirmBtn, cancelBtn] = card.querySelectorAll('button');
    confirmBtn.onclick = () => {
        card.remove();
        document.getElementById('textInput').value = pendingCmd;
        submitCommand({ humanConfirmed: true });
    };
    cancelBtn.onclick = () => {
        card.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted);">Cancelled <code>${escapeHtml(pendingCmd)}</code>.</span>`;
    };
    logBox.appendChild(card);
    logBox.scrollTop = logBox.scrollHeight;
}

function logAction(message) {
    const logBox = document.getElementById('actionLog');
    const div = document.createElement('div');
    const cleanText = stripSlashesFromText(message);
    const m = cleanText.match(/^\[([^\]]+)\]:\s*([\s\S]*)$/);
    if (m) {
        const b = document.createElement('b');
        if (m[1].toUpperCase().startsWith("KIZA")) b.style.color = "var(--accent-primary)";
        b.textContent = `[${m[1]}]: `;
        const sp = document.createElement('span'); sp.textContent = m[2];
        div.textContent = "> "; div.appendChild(b); div.appendChild(sp);
        renderMathInElementSafe(sp);
        if (m[1].toUpperCase().startsWith("KIZA")) appendMessageActionBar(div, m[2], lastUserPromptSent);
    } else { div.innerText = `> ${cleanText}`; }
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
}

function setSendButtonToStopMode(isProcessing) {
    const btn = document.getElementById('mainSendBtn'); if (!btn) return;
    btn.classList.toggle('stop-mode', isProcessing);
    btn.innerHTML = isProcessing ? "⏹ Stop" : "Send";
}
function handleSendOrStop() { if (isChatActive) stopActiveKizaResponse(); else submitCommand(); }
function stopActiveKizaResponse() {
    if (activeChatAbortController) { try { activeChatAbortController.abort(); } catch (e) {} activeChatAbortController = null; }
    if (currentAudio) { try { currentAudio.pause(); currentAudio = null; } catch (e) {} }
    if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) {}
    isKizaSpeaking = false; isChatActive = false; setSendButtonToStopMode(false);
    document.getElementById('orb')?.classList.remove('processing');
    document.getElementById('uiStatus').innerText = `${cleanDisplayNameOnly(currentUser)} • Rank ${currentRankNum}`;
}

function launchLiveCallMode() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    const persona = document.getElementById('personaSelect')?.value || "helpful";
    window.location.href = `live.html?user=${encodeURIComponent(currentUser)}&persona=${encodeURIComponent(persona)}`;
}

function askTodaysNewsForMyCountry() {
    document.getElementById('textInput').value = "What's the news today?";
    submitCommand();
}

function prefillInput(prefixStr) { const i = document.getElementById('textInput'); i.value = prefixStr; i.focus(); handleSlashAutocomplete(i); }
function sendQuickCmd(cmd) { document.getElementById('textInput').value = cmd; submitCommand(); }
function isVisualQuestion(t) { return ["see", "look", "camera", "webcam", "holding", "hand", "show", "photo", "image", "attached", "handwritten"].some(w => t.toLowerCase().includes(w)); }
function isLocationOrLocalWeatherQuery(t) { const l = t.toLowerCase(); return l.includes("near me") || l.includes("my location") || l.includes("where am i") || (l.includes("weather") && !/\bweather\s+in\s+[a-z]{3,}/i.test(l)); }

function processNaturalVoiceIntent(rawText) {
    const low = rawText.toLowerCase().trim(), words = low.split(/[\s,?.!]+/);
    const rem = parseNaturalLanguageReminder(rawText);
    if (rem) { addSmartReminder(rem.title, rem.targetTimeMs); logAction(`[${cleanDisplayNameOnly(currentUser).toUpperCase()}]: ${rawText}`); logAction(`[KIZA]: ⏰ Reminder set for "${rem.title}"!`); return { handledLocally: true }; }
    if ((words.includes("live") && (words.includes("call") || words.includes("mode"))) || low === "call kiza") { launchLiveCallMode(); return { handledLocally: true }; }
    if (low === "/logs" || low === "/archive") { openLogsModal(); return { handledLocally: true }; }
    if (words.includes("dark") && (words.includes("mode") || words.includes("theme"))) { document.getElementById('themeSelect').value = 'dark'; saveSettings(); return { handledLocally: true }; }
    if (words.includes("light") && (words.includes("mode") || words.includes("theme"))) { document.getElementById('themeSelect').value = 'light'; saveSettings(); return { handledLocally: true }; }
    return { handledLocally: false, mappedText: rawText };
}

function executeAIActionTags(r) {
    if (!r) return;
    if (r.includes("[ACTION:DARK_MODE]")) { document.getElementById('themeSelect').value = 'dark'; saveSettings(); }
    if (r.includes("[ACTION:LIGHT_MODE]")) { document.getElementById('themeSelect').value = 'light'; saveSettings(); }
    if (r.includes("[ACTION:OPEN_ARCHIVE]")) openLogsModal();
    if (r.includes("[ACTION:OPEN_SETTINGS]")) openSettings();
    if (r.includes("[ACTION:OPEN_RANK]")) openRankModal();
    if (r.includes("[ACTION:OPEN_NOTIFS]")) openNotifCenter();
    if (r.includes("[ACTION:OPEN_UPDATES]")) openUpdatesModal();
    if (r.includes("[ACTION:OPEN_THREATS]")) openThreatsModal();
    if (r.includes("[ACTION:OPEN_MISSIONS]")) openMissionsModal();
    if (r.includes("[ACTION:OPEN_PURGE]")) openPurgeModal();
    if (r.includes("[ACTION:OPEN_MEMORY]")) openProfileMemoryModal();
    if (r.includes("[ACTION:OPEN_TELEMETRY]")) openTelemetryModal();
    if (r.includes("[ACTION:PROMPT_TUTORIAL]")) openTutorialPromptModal();
    if (r.includes("[ACTION:NEW_CHAT]")) startNewSession();
}

async function submitCommand(opts = {}) {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    const inputField = document.getElementById('textInput');
    let rawText = inputField.value.trim();
    const autoBox = document.getElementById('slashAutocomplete');
    if (autoBox) autoBox.style.display = "none";

    if (!rawText && (attachedImageBase64 || attachedImageExtractedContext)) rawText = "Analyze and summarize this attached file.";
    if (!rawText || isChatActive) return;

    if ((rawText.toLowerCase() === "/purge" || rawText.toLowerCase().startsWith("/purge ")) && !rawText.includes("|") && !/\d{4,8}$/.test(rawText.trim())) {
        const possibleTarget = rawText.slice(6).trim();
        inputField.value = "";
        await openPurgeModal();
        if (possibleTarget && possibleTarget.toLowerCase() !== "all") { document.getElementById('purgeSearchInput').value = possibleTarget; filterPurgeUsersDropdown(); }
        return;
    }

    const studioDraftCtx = (typeof getActiveStudioDraftContext === "function") ? getActiveStudioDraftContext() : null;
    inputField.value = "";
    if (isScanningAttachment && attachmentScanPromise) {
        document.getElementById('uiStatus').innerText = "Scanning file...";
        try { await attachmentScanPromise; } catch (e) {}
    }

    const intent = processNaturalVoiceIntent(rawText);
    if (intent.handledLocally) return;

    let text = intent.mappedText;
    lastUserPromptSent = rawText;
    const cleanSpeaker = cleanDisplayNameOnly(currentUser).toUpperCase();
    const clientFileIntent = detectClientSideFileIntent(rawText);

    const currentAttachedImg = attachedImageBase64;
    const currentAttachedName = attachedImageName;
    const currentAttachedContext = attachedImageExtractedContext;

    const displayUserCmd = rawText.toLowerCase().startsWith("/purge ") ? rawText.split("|")[0].trim() + " [PIN]" : rawText;

    if (currentAttachedImg || currentAttachedContext) {
        lastAttachedFileTopic = (currentAttachedName || "Document").replace(/\.[a-z0-9]+$/i, '');
        if (currentAttachedContext) lastUploadedDocumentContext = currentAttachedContext;
        logAction(`[${cleanSpeaker}]: [📎 ${currentAttachedName}] ${displayUserCmd}`);
        if (currentAttachedContext && !text.startsWith("/")) {
            text = `${text}\n\n${currentAttachedContext}\n[FORMAT INSTRUCTION: Preserve the exact page-by-page / section structure of this attached document!]`;
        }
        clearImageAttachment();
    } else {
        logAction(`[${cleanSpeaker}]: ${displayUserCmd}`);
        if (lastUploadedDocumentContext && /(this pdf|this doc|this word|this excel|attached|same format|edit page)/i.test(rawText)) {
            text = `${text}\n\n${lastUploadedDocumentContext}\n[FORMAT INSTRUCTION: Copy and preserve the exact format of the uploaded document!]`;
        } else if (!studioDraftCtx && lastCompiledFileCache && !text.startsWith("/") && /\b(revise|change\s+format|change\s+background|change\s+theme|edit\s+page|update\s+it|make\s+it\s+\d+\s+pages|movie\s*theat)/i.test(rawText)) {
            text = `Make a ${lastCompiledFileCache.ext.toUpperCase()} on ${lastCompiledFileCache.topic}: ${rawText}\n\n[CURRENT DOCUMENT DRAFT TO REVISE:\n${lastCompiledFileCache.rawContent.slice(0, 3500)}]`;
        }
    }

    const pageMatch = rawText.match(/\b(\d+)\s+(pages|page|slides|slide)\b/i);
    if (pageMatch) text += `\n[FORMAT INSTRUCTION: Generate ALL ${pageMatch[1]} distinct 'PAGE N:' sections without stopping early.]`;

    if (!text.startsWith("/") && isLocationOrLocalWeatherQuery(rawText) && cachedLat !== null && cachedLon !== null) {
        text += `\n\n[LIVE USER GPS & REAL-TIME WEATHER TELEMETRY: (${cachedLat.toFixed(4)}, ${cachedLon.toFixed(4)}) | Location = ${cachedClientCityName || 'Current GPS'} | Weather = ${cachedClientWeatherSummary || 'Clear'}]`;
    }

    isChatActive = true;
    activeChatAbortController = new AbortController();
    setSendButtonToStopMode(true);
    document.getElementById('uiStatus').innerText = "Thinking...";
    const orbEl = document.getElementById('orb');
    orbEl.classList.add('processing');

    let selectedPersona = document.getElementById('personaSelect').value || "helpful";
    let finalVisionFrame = currentAttachedImg;
    if (!finalVisionFrame && isCameraActive && cameraReady && isVisualQuestion(rawText)) {
        try {
            const video = document.getElementById('webcamVideo'), canvas = document.getElementById('faceCanvas');
            canvas.width = 640; canvas.height = 480; canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
            finalVisionFrame = canvas.toDataURL('image/jpeg', 0.75);
        } catch (e) {}
    }

    const logBox = document.getElementById('actionLog');
    const streamEntry = document.createElement('div');
    streamEntry.className = "streaming-cursor";
    const kizaBold = document.createElement('b'); kizaBold.style.color = "var(--accent-primary)"; kizaBold.textContent = "[KIZA]: ";
    const kizaSpan = document.createElement('span');
    streamEntry.textContent = "> "; streamEntry.appendChild(kizaBold); streamEntry.appendChild(kizaSpan);
    logBox.appendChild(streamEntry); logBox.scrollTop = logBox.scrollHeight;

    let accumulatedText = "", isStreamError = false, renderedPlanner = false, playedAudioFromStream = false;
    let serverGeneratedImgB64 = null, serverGeneratedImgPrompt = "";

    const reqPayload = {
        command: text,
        image_base64: finalVisionFrame,
        is_attached_image: Boolean(finalVisionFrame),
        personality: selectedPersona,
        session_id: currentSessionId,
        human_confirmed: Boolean(opts.humanConfirmed),
        studio_context: studioDraftCtx,
        custom_gem_name: activeCustomGem ? activeCustomGem.name : null,
        custom_gem_prompt: activeCustomGem ? activeCustomGem.prompt : null,
        client_gps: cachedClientGPS,
        client_country_code: cachedClientCountryCode || null,
        client_country_name: cachedClientCountryName || null
    };

    try {
        let response = await fetch(`${SERVER_URL}/api/chat/stream`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqPayload), signal: activeChatAbortController.signal
        });

        const ctype = (response.headers.get("content-type") || "").toLowerCase();
        if (response.ok && ctype.includes("application/json")) {
            const jsonData = await response.json();
            accumulatedText = jsonData.reply || jsonData.message || "";
            isStreamError = Boolean(jsonData.is_error);
            if (jsonData.generated_image_base64) {
                serverGeneratedImgB64 = jsonData.generated_image_base64;
                serverGeneratedImgPrompt = jsonData.generated_image_prompt || rawText;
            }
            if (jsonData.ip_banned) {
                kizaSpan.textContent = accumulatedText;
                setTimeout(() => forceLogout(), 2500);
            }
        } else if (response.ok && response.body) {
            const reader = response.body.getReader(), decoder = new TextDecoder("utf-8");
            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split("\n\n");
                buffer = lines.pop() || "";
                for (let block of lines) {
                    const trimmed = block.trim();
                    if (!trimmed.startsWith("data:")) continue;
                    try {
                        const payload = JSON.parse(trimmed.replace(/^data:\s*/, ""));
                        if (payload.type === "web_search" && payload.query) { renderWebSearchBadgeInFeed(payload.query); logBox.appendChild(streamEntry); }
                        else if (payload.type === "plan" && Array.isArray(payload.steps)) { renderedPlanner = true; renderTaskPlannerQueueInFeed(payload.steps); logBox.appendChild(streamEntry); }
                        else if (payload.type === "media_image" && payload.image_base64) {
                            serverGeneratedImgB64 = payload.image_base64;
                            serverGeneratedImgPrompt = payload.prompt || rawText;
                        }
                        else if (payload.type === "token") {
                            if (payload.is_error) isStreamError = true;
                            accumulatedText += payload.text;
                            kizaSpan.textContent = extractFriendlyAssistantMessage(accumulatedText);
                            logBox.scrollTop = logBox.scrollHeight;
                        } else if (payload.type === "audio" && payload.audio_base64) {
                            playedAudioFromStream = true;
                            playKizaAudio(payload.audio_base64, extractFriendlyAssistantMessage(accumulatedText));
                        }
                    } catch (e) {}
                }
            }
        }

        if (!stripSlashesFromText(accumulatedText).trim()) {
            let syncRes = await fetch(`${SERVER_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqPayload), signal: activeChatAbortController.signal });
            if (syncRes.ok) {
                let syncData = await syncRes.json();
                accumulatedText = syncData.reply || ""; isStreamError = Boolean(syncData.is_error);
                if (syncData.web_query) renderWebSearchBadgeInFeed(syncData.web_query);
                if (syncData.plan_steps?.length && !renderedPlanner) renderTaskPlannerQueueInFeed(syncData.plan_steps);
                if (syncData.generated_image_base64) {
                    serverGeneratedImgB64 = syncData.generated_image_base64;
                    serverGeneratedImgPrompt = syncData.generated_image_prompt || rawText;
                }
                if (syncData.audio_base64) { playedAudioFromStream = true; playKizaAudio(syncData.audio_base64, extractFriendlyAssistantMessage(accumulatedText)); }
            }
        }

        streamEntry.classList.remove("streaming-cursor");
        orbEl.classList.remove('processing');
        document.getElementById('uiStatus').innerText = `${cleanDisplayNameOnly(currentUser)} • Rank ${currentRankNum}`;
        isChatActive = false; activeChatAbortController = null; setSendButtonToStopMode(false);
        refreshSidebarChatSessions();

        if (accumulatedText.includes("[PURGE_PIN_REQUIRED]")) openPurgeModal();

        const ztMatch = accumulatedText.match(/\[ZERO_TRUST_CONFIRM:([^\]]+)\]/);
        if (ztMatch) renderZeroTrustConfirmationCard(ztMatch[1].trim());

        const imgGenMatch = accumulatedText.match(/\[GENERATE_IMAGE:([^\]]+)\]/i);
        const vidGenMatch = accumulatedText.match(/\[GENERATE_VIDEO:([^\]]+)\]/i);

        if (serverGeneratedImgB64 && typeof generateAndRenderFreeImageCard === "function") {
            generateAndRenderFreeImageCard(serverGeneratedImgPrompt || (imgGenMatch ? imgGenMatch[1].trim() : rawText), serverGeneratedImgB64);
        } else if (imgGenMatch && typeof generateAndRenderFreeImageCard === "function") {
            generateAndRenderFreeImageCard(imgGenMatch[1].trim(), null);
        }
        if (vidGenMatch && typeof generateAndRenderFreeVideoCard === "function") {
            generateAndRenderFreeVideoCard(vidGenMatch[1].trim());
        }

        if (accumulatedText.includes("[GENERATE_FILE:")) {
            const fm = accumulatedText.match(/\[GENERATE_FILE:([^:]+):([^:\]]+)(?::([^\]]+))?\]/);
            const fileExt = clientFileIntent ? clientFileIntent.ext : (fm ? fm[1] : "pdf");
            const fileTopic = fm ? fm[2] : (clientFileIntent ? clientFileIntent.topic : "Report");
            const fileTheme = (fm && fm[3]) ? fm[3].toLowerCase().replace(/\s+/g, '_') : (clientFileIntent ? clientFileIntent.styleTheme : "cyber_dark");
            const layoutToUse = (fileTheme === "movie_theater" || clientFileIntent?.layoutFormat === "movie_theater") ? "movie_theater" : (clientFileIntent?.layoutFormat || "infographic");
            await prepareAndPreviewUniversalFile(fileExt, fileTopic, accumulatedText, currentAttachedImg, fileTheme, layoutToUse);
        } else if (clientFileIntent && !isStreamError && !imgGenMatch && !vidGenMatch && !serverGeneratedImgB64) {
            await prepareAndPreviewUniversalFile(clientFileIntent.ext, clientFileIntent.topic, accumulatedText, currentAttachedImg, clientFileIntent.styleTheme, clientFileIntent.layoutFormat);
        } else if (studioDraftCtx && lastCompiledFileCache && document.getElementById('filePreviewModal')?.style.display === 'flex' && !isStreamError) {
            lastCompiledFileCache.rawContent = accumulatedText;
            const themeMatch = rawText.match(/\b(movie\s*theat|black|light|blue|purple|green|red|gold)\b/i);
            if (themeMatch) {
                const mapT = { movie: "movie_theater", black: "black", light: "light", blue: "blue", purple: "purple", green: "green", red: "red", gold: "gold" };
                const k = Object.keys(mapT).find(x => themeMatch[0].toLowerCase().includes(x));
                if (k) lastCompiledFileCache.styleTheme = mapT[k];
            }
            openFilePreviewModal();
        }

        if (/```mermaid/i.test(accumulatedText)) await extractAndRenderMermaidBlocks(accumulatedText);
        if (accumulatedText.includes("[CHART_DATA]")) extractAndRenderChartBlocks(accumulatedText);
        if (accumulatedText.includes("```")) {
            extractAndRenderCodeBlocks(accumulatedText);
            if (studioDraftCtx && document.getElementById('codeSandboxModal')?.style.display === 'flex' && generatedCodeSnippetsStore.length > 0) {
                openCodeSandboxByIndex(generatedCodeSnippetsStore.length - 1);
            }
        }
        if (accumulatedText.includes("[QUIZ_DATA]")) extractAndRenderInteractiveQuiz(accumulatedText);

        executeAIActionTags(accumulatedText);
        let finalCleaned = extractFriendlyAssistantMessage(accumulatedText).replace(/\[PURGE_PIN_REQUIRED\]\s*/g, '') || "Done!";
        kizaSpan.textContent = finalCleaned;
        renderMathInElementSafe(kizaSpan);
        appendMessageActionBar(streamEntry, finalCleaned, rawText);
        logBox.scrollTop = logBox.scrollHeight;

        if (accumulatedText.includes("BANNED FOR 15 MINUTES")) {
            showNotification("15-Minute Auto-Ban", finalCleaned, true, { skipStore: true });
            setTimeout(() => forceLogout(), 2800);
            return;
        }

        if (!playedAudioFromStream && !isStreamError && voiceEnabled) speakMessageDirectly(finalCleaned);
        if (!isStreamError) playTacticalSFX("complete");
        else { streamEntry.style.borderLeftColor = "var(--danger)"; showNotification("Alert", finalCleaned, true); }
    } catch (error) {
        streamEntry.classList.remove("streaming-cursor");
        isChatActive = false; activeChatAbortController = null; setSendButtonToStopMode(false);
        orbEl.classList.remove('processing');
        if (error.name === "AbortError") {
            const stopBadge = document.createElement('div'); stopBadge.innerHTML = `<span class="stopped-tag">🛑 Stopped</span>`;
            streamEntry.appendChild(stopBadge);
            document.getElementById('uiStatus').innerText = `${cleanDisplayNameOnly(currentUser)} • Rank ${currentRankNum}`;
            return;
        }
        kizaSpan.textContent = `[Error]: ${error.message}`;
        showNotification("Connection Error", error.message, true, { category: "error" });
        document.getElementById('uiStatus').innerText = "Offline";
    }
}

// ==========================================================
// 9. EVENT LISTENERS, DRAG-DROP & STARTUP SESSION CHECK
// ==========================================================
window.addEventListener('paste', (e) => {
    if (isPinLocked || currentUser === "Guest") return;
    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.indexOf("image") === 0) {
            const blob = item.getAsFile();
            if (blob) { e.preventDefault(); processAttachedImageFileObject(blob, `Clipboard_${Date.now().toString().slice(-4)}.png`); break; }
        }
    }
});
window.addEventListener('dragover', (e) => { e.preventDefault(); if (!isPinLocked && currentUser !== "Guest") document.getElementById('dragDropOverlay').style.display = "flex"; });
window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null || e.clientX <= 0 || e.clientY <= 0) document.getElementById('dragDropOverlay').style.display = "none"; });
window.addEventListener('drop', (e) => { e.preventDefault(); document.getElementById('dragDropOverlay').style.display = "none"; if (!isPinLocked && currentUser !== "Guest" && e.dataTransfer?.files?.length) processAttachedImageFileObject(e.dataTransfer.files[0], e.dataTransfer.files[0].name); });

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof mermaid !== "undefined") mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    checkUrlForSharedMiniApp();
    applySettings();
    renderCustomGemsBar();
    voiceEnabled = (userSettings.voiceDefault === 'on');
    updateVoiceUI();
    initCamera();

    document.getElementById('textInput')?.addEventListener("input", function() { handleSlashAutocomplete(this); });
    document.getElementById('textInput')?.addEventListener("keypress", (e) => { if (e.key === "Enter" && !isChatActive) submitCommand(); });
    document.getElementById('authUser')?.addEventListener("keypress", (e) => { if (e.key === "Enter") performAuth(); });
    document.getElementById('authPass')?.addEventListener("keypress", (e) => { if (e.key === "Enter") performAuth(); });
    document.getElementById('authPin')?.addEventListener("keypress", (e) => { if (e.key === "Enter") performAuth(); });
    document.getElementById('pinGateInput')?.addEventListener("keypress", (e) => { if (e.key === "Enter") submitPinGate(); });
    document.getElementById('broadcastMsgInput')?.addEventListener("keypress", (e) => { if (e.key === "Enter") submitBroadcastModal(); });

    const savedUser = localStorage.getItem('kiza_user');
    const savedDB = localStorage.getItem('kiza_db');
    const savedFace = localStorage.getItem('kiza_face');
    const safeDB = (savedDB && savedDB !== "undefined") ? savedDB : resolveDBUser(savedUser || "");
    const savedSig = localStorage.getItem('kiza_sig') || localStorage.getItem(getSessionSigStorageKey(safeDB));
    const savedTokVer = parseInt(localStorage.getItem(getTokenVerStorageKey(safeDB)) || "1", 10) || 1;

    if (savedUser && savedSig) {
        const errBox = document.getElementById('authError');
        if (errBox) { errBox.style.color = "var(--accent-primary)"; errBox.innerText = "Verifying HMAC session..."; }
        const verified = await verifySessionWithServer(savedUser, savedTokVer, savedSig);
        if (verified) {
            completeLoginAfterVerification(
                verified.username, verified.db_username, verified.role, savedFace,
                false, "", null, verified.token_version, verified.session_sig,
                Boolean(verified.has_face_embedding), Boolean(verified.require_face_on_login)
            );
        } else {
            forceLogout();
            if (errBox) { errBox.style.color = "var(--danger)"; errBox.innerText = "Session expired or invalid. Please sign in."; }
        }
    } else if (savedUser) {
        forceLogout();
    }
});
