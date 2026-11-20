// ==========================================================
// KIZA v11.2 — AUTH, STRICT 128-D BIOMETRICS & TIMEOUT-SAFE CORE
// ==========================================================
const SERVER_URL = "https://kiza-brain.onrender.com";
const WS_URL = "wss://kiza-brain.onrender.com/api/ws";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

let currentUser = "Guest";
let currentDBUser = "guest";
let currentRole = "LOCKED";
let currentRankNum = 5;
let currentTokenVersion = 1;
let currentSessionSig = "";
let lastLoginTimestamp = 0;
let authMode = "login";
let alertIndex = 0;
let isChatActive = false;
let activeChatAbortController = null;
let lastUserPromptSent = "";

let ws = null;
let wsConnected = false;
let wsPingTimer = null;
let wsLastPingSent = 0;

let cameraReady = false;
let isCameraActive = true;
let videoDevices = [];
let audioInputDevices = [];
let currentCamIndex = 0;
let activeStream = null;
let preferredCamId = localStorage.getItem('kiza_pref_cam_id') || "";
let preferredMicId = localStorage.getItem('kiza_pref_mic_id') || "";

let cachedOperatives = [];
let cachedThreatLogs = [];
let currentArchiveExportData = [];
let currentSessionId = generateSessionId();
let currentNotifFilter = "all";
let lastLockdownSignature = "";

let pinGateMode = "setup";
let isPinLocked = false;
let pendingLoginData = null;

// ==========================================================
// SAFE STORAGE & XSS ESCAPE HELPERS
// ==========================================================
function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeGetJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (quotaErr) {
        try {
            let profs = safeGetJSON('kiza_profiles', []);
            profs.forEach(p => { p.face_id = null; });
            localStorage.setItem('kiza_profiles', JSON.stringify(profs));
            localStorage.setItem(key, value);
        } catch (e2) {}
    }
}

let storedProfiles = safeGetJSON('kiza_profiles', []);
let userSettings = safeGetJSON('kiza_settings', { theme: 'light', voiceDefault: 'off', showNotifs: 'on', sfx: 'on' });

function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function isMasterOwnerUser(nameStr) {
    if (!nameStr) return false;
    return String(nameStr).toLowerCase().trim().includes("viyan");
}

function cleanDisplayNameOnly(nameStr) {
    if (!nameStr) return "User";
    return String(nameStr)
        .replace(/\s*\((master owner|owner|admin|mod|moderator|user|operative|you)\)/gi, '')
        .trim();
}

function formatCleanRole(roleStr, usernameHint = "") {
    if (isMasterOwnerUser(usernameHint)) return "MASTER OWNER";
    const r = String(roleStr || "USER").toUpperCase().split("/")[0].trim();
    if (r.includes("MASTER")) return isMasterOwnerUser(usernameHint) ? "MASTER OWNER" : "OWNER";
    if (r.includes("OWNER")) return "OWNER";
    if (r.includes("MOD")) return "MODERATOR";
    if (r.includes("ADMIN")) return "ADMIN";
    if (r.includes("LOCKED")) return "LOCKED";
    return "USER";
}

function computeRankNumber(roleStr, usernameHint = "") {
    if (isMasterOwnerUser(usernameHint)) return 1;
    const cleanR = formatCleanRole(roleStr, usernameHint);
    if (cleanR === "MASTER OWNER") return 1;
    if (cleanR === "OWNER") return 2;
    if (cleanR === "MODERATOR") return 3;
    if (cleanR === "ADMIN") return 4;
    return 5;
}

function resolveDBUser(nameStr) {
    if (!nameStr || nameStr === "undefined") return "guest";
    let d = String(nameStr).toLowerCase().trim();
    if (d.includes("viyan")) return "viyan_arora_owner";
    if (d === "admin1" || d.startsWith("admin1 ")) return "admin1";
    if (d === "mod1" || d.startsWith("mod1 ")) return "mod1";
    return d.replace(/\s*\((master owner|owner|admin|mod|moderator|user|you)\)/gi, "").trim();
}

function getTokenVerStorageKey(dbUser = currentDBUser) {
    const safeKey = (dbUser && dbUser !== "undefined") ? dbUser : resolveDBUser(currentUser);
    return `kiza_tok_ver_${safeKey}`;
}

function getSessionSigStorageKey(dbUser = currentDBUser) {
    const safeKey = (dbUser && dbUser !== "undefined") ? dbUser : resolveDBUser(currentUser);
    return `kiza_sig_${safeKey}`;
}

function getLocalHasPinKey(dbUser = currentDBUser) {
    const safeKey = (dbUser && dbUser !== "undefined") ? dbUser : resolveDBUser(currentUser);
    return `kiza_has_pin_${safeKey}`;
}

function getOrCreateBrowserDeviceId() {
    let devId = localStorage.getItem('kiza_device_id');
    if (!devId) {
        devId = 'dev_' + Math.random().toString(36).substr(2, 10) + '_' + Date.now().toString(36);
        safeSetItem('kiza_device_id', devId);
    }
    return devId;
}

function getFriendlyDeviceName() {
    const ua = navigator.userAgent || "";
    let os = "Desktop OS";
    if (/Windows/i.test(ua)) os = "Windows PC";
    else if (/Android/i.test(ua)) os = "Android Device";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS Device";
    else if (/Mac/i.test(ua)) os = "Mac";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "Browser";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome\//i.test(ua)) browser = "Chrome";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";
    else if (/Safari\//i.test(ua)) browser = "Safari";

    return `${os} • ${browser}`;
}

const CURRENT_DEVICE_ID = getOrCreateBrowserDeviceId();

// ==========================================================
// AUTO-ATTACH SIGNED X-KIZA-TOKEN TO ALL SERVER REQUESTS
// ==========================================================
(function installSecureFetchInterceptor() {
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.startsWith(SERVER_URL)) {
            const tok = currentSessionSig || localStorage.getItem("kiza_sig") || "";
            const headers = new Headers(init.headers || {});
            if (tok && !headers.has("X-KIZA-Token")) {
                headers.set("X-KIZA-Token", tok);
            }
            init = { ...init, headers };
        }
        const res = await origFetch(input, init);
        const isPublicRoute = /\/api\/(auth|google_auth|verify_session|biometrics\/login|verify_pin|updates)|\/health/.test(url);
        if (url.startsWith(SERVER_URL) && res.status === 401 && !isPublicRoute && typeof forceLogout === "function") {
            forceLogout();
        }
        return res;
    };
})();

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
            const raw = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status}${raw ? ": " + raw.slice(0, 90) : ""}`);
        }
        return await res.json();
    } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
            throw new Error("Request timed out (25s) — Render is waking up or restarting. Wait 10s and try again.");
        }
        throw err;
    }
}

// ==========================================================
// LIVE GPS, COUNTRY CODE & REAL-TIME WEATHER TELEMETRY
// ==========================================================
let cachedClientGPS = null;
let cachedLat = null;
let cachedLon = null;
let cachedClientCityName = "";
let cachedClientCountryCode = "";
let cachedClientCountryName = "";
let cachedClientWeatherSummary = "";

async function updateLiveLocationAndWeatherFromCoords(lat, lon) {
    cachedLat = lat;
    cachedLon = lon;
    cachedClientGPS = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        if (geoRes.ok) {
            const geoData = await geoRes.json();
            const town = geoData.locality || geoData.city || "";
            const dist = geoData.principalSubdivision || "";
            const country = geoData.countryName || "";
            if (geoData.countryCode) cachedClientCountryCode = String(geoData.countryCode).toUpperCase().slice(0, 2);
            if (country) cachedClientCountryName = country;
            cachedClientCityName = [town, dist, country].filter(Boolean).join(", ");
        }
    } catch (e) {}

    try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,surface_pressure&timezone=auto`);
        if (wRes.ok) {
            const wData = await wRes.json();
            if (wData && wData.current) {
                const c = wData.current;
                cachedClientWeatherSummary = `Temperature: ${c.temperature_2m}°C (Feels like ${c.apparent_temperature}°C), Humidity: ${c.relative_humidity_2m}%, Wind: ${c.wind_speed_10m} km/h, Pressure: ${c.surface_pressure} hPa`;
            }
        }
    } catch (e) {}

    if (cachedClientCityName) {
        cachedClientGPS = `${lat.toFixed(4)}, ${lon.toFixed(4)} (${cachedClientCityName})`;
    }
}

function refreshClientGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => updateLiveLocationAndWeatherFromCoords(pos.coords.latitude, pos.coords.longitude),
            () => {},
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
        );
        navigator.geolocation.watchPosition(
            (pos) => updateLiveLocationAndWeatherFromCoords(pos.coords.latitude, pos.coords.longitude),
            () => {},
            { enableHighAccuracy: true, maximumAge: 90000 }
        );
    }
}
refreshClientGPS();

// ==========================================================
// STRICT 128-D NEURAL FACE BIOMETRICS + 2-FRAME LIVENESS
// ==========================================================
let faceModelsLoaded = false;
const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

async function ensureFaceApiModelsLoaded() {
    if (faceModelsLoaded) return true;
    if (typeof faceapi === "undefined") {
        showNotification("Biometrics Loading", "Neural Face Engine is still loading. Wait 3 seconds and try again.", true, { skipStore: true });
        return false;
    }
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL)
    ]);
    faceModelsLoaded = true;
    return true;
}

function computeEyeAspectDelta(landmarksA, landmarksB) {
    try {
        const leftA = landmarksA.getLeftEye();
        const leftB = landmarksB.getLeftEye();
        const rightA = landmarksA.getRightEye();
        const rightB = landmarksB.getRightEye();
        const openA = (Math.abs(leftA[1].y - leftA[5].y) + Math.abs(rightA[1].y - rightA[5].y)) / 2;
        const openB = (Math.abs(leftB[1].y - leftB[5].y) + Math.abs(rightB[1].y - rightB[5].y)) / 2;
        return Math.abs(openB - openA) * 1.4;
    } catch (e) {
        return 0;
    }
}

async function captureStrictFaceDescriptorWithLiveness(statusCallback = () => {}) {
    if (!cameraReady) {
        isCameraActive = true;
        await initCamera();
        await new Promise(r => setTimeout(r, 700));
    }
    if (!cameraReady) {
        throw new Error("Camera is offline. Allow camera permissions and try again.");
    }
    statusCallback("🧬 Loading 128-D neural face model...");
    const ok = await ensureFaceApiModelsLoaded();
    if (!ok) throw new Error("Face recognition model unavailable.");

    const video = document.getElementById("webcamVideo");
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.65 });

    statusCallback("🧬 Frame 1/2: Look directly at the camera...");
    const det1 = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
    if (!det1) throw new Error("No clear face detected. Move into better lighting.");

    statusCallback("🧬 Frame 2/2: Blink or tilt your head slightly (Anti-Photo Check)...");
    await new Promise(r => setTimeout(r, 950));
    const det2 = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
    if (!det2) throw new Error("Face lost during liveness check. Keep your face centered.");

    const samePersonDist = faceapi.euclideanDistance(det1.descriptor, det2.descriptor);
    if (samePersonDist > 0.38) {
        throw new Error("Face changed during scan. Only one person should be in frame.");
    }

    const nose1 = det1.landmarks.getNose()[3];
    const nose2 = det2.landmarks.getNose()[3];
    const headDelta = Math.hypot(nose2.x - nose1.x, nose2.y - nose1.y);
    const blinkDelta = computeEyeAspectDelta(det1.landmarks, det2.landmarks);
    const livenessDelta = Number((headDelta + blinkDelta).toFixed(2));

    return {
        embedding: Array.from(det2.descriptor),
        livenessDelta,
        snapshot: captureSilentSecurityFrame()
    };
}

function updateRotatedSessionToken(newTokVer, newSig) {
    if (newTokVer) {
        currentTokenVersion = Number(newTokVer);
        safeSetItem(getTokenVerStorageKey(currentDBUser), String(currentTokenVersion));
    }
    if (newSig) {
        currentSessionSig = newSig;
        safeSetItem('kiza_sig', currentSessionSig);
        safeSetItem(getSessionSigStorageKey(currentDBUser), currentSessionSig);
        saveCurrentProfileToStorage(currentUser, currentDBUser, currentRole, localStorage.getItem('kiza_face'), currentSessionSig);
    }
    lastLoginTimestamp = Date.now();
    if (typeof initWebSocket === "function") initWebSocket();
}

async function loginWithStrictFaceID() {
    const errBox = document.getElementById("authError");
    const faceBtn = document.getElementById("strictFaceLoginBtn");
    const username = document.getElementById("authUser").value.trim();
    if (!username) {
        errBox.style.color = "var(--danger)";
        errBox.innerText = "Type your Username first, then tap Unlock with Strict 128-D Face ID.";
        return;
    }
    if (faceBtn) { faceBtn.disabled = true; faceBtn.innerText = "🧬 Scanning Biometrics..."; }
    try {
        errBox.style.color = "var(--accent-primary)";
        const scan = await captureStrictFaceDescriptorWithLiveness((msg) => { errBox.innerText = msg; });
        errBox.innerText = "Verifying 128-D vector with KIZA Server...";
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/biometrics/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                embedding: scan.embedding,
                liveness_delta: scan.livenessDelta,
                device_id: CURRENT_DEVICE_ID,
                device_name: getFriendlyDeviceName(),
                client_gps: cachedClientGPS
            })
        }, 25000);
        if (!data.success) {
            errBox.style.color = "var(--danger)";
            errBox.innerText = data.message || "Strict Face ID rejected.";
            showNotification("Biometrics Rejected", data.message || "Identity mismatch.", true);
            return;
        }
        errBox.innerText = "";
        completeLoginAfterVerification(
            cleanDisplayNameOnly(data.username),
            data.db_username,
            data.role,
            data.face_id || scan.snapshot,
            true,
            data.reply,
            null,
            data.token_version || 1,
            data.session_sig
        );
    } catch (e) {
        errBox.style.color = "var(--danger)";
        errBox.innerText = e.message || "Biometric scan failed.";
    } finally {
        if (faceBtn) { faceBtn.disabled = false; faceBtn.innerText = "🧬 Unlock with Strict 128-D Face ID"; }
    }
}

async function updateFaceID() {
    if (currentUser === "Guest" || isPinLocked) return;
    try {
        showNotification("Biometrics", "Look at the camera and blink slightly to enroll Strict 128-D Face ID...", false, { skipStore: true });
        const scan = await captureStrictFaceDescriptorWithLiveness((msg) => {
            document.getElementById("uiStatus").innerText = msg;
        });
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/biometrics/enroll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embedding: scan.embedding,
                face_id: scan.snapshot,
                keep_device_id: CURRENT_DEVICE_ID
            })
        }, 25000);
        document.getElementById("uiStatus").innerText = `${cleanDisplayNameOnly(currentUser)} • Rank ${currentRankNum}`;
        if (data.success) {
            updateRotatedSessionToken(data.new_token_version, data.session_sig);
            if (scan.snapshot) {
                document.getElementById("savedFaceImg").src = scan.snapshot;
                document.getElementById("savedFaceImg").style.display = "block";
                safeSetItem("kiza_face", scan.snapshot);
                saveCurrentProfileToStorage(currentUser, currentDBUser, currentRole, scan.snapshot, currentSessionSig);
            }
            showNotification("Strict Face ID Enrolled", data.message, false, { skipStore: true });
        } else {
            showNotification("Enrollment Failed", data.message || "Could not save biometrics.", true);
        }
    } catch (e) {
        document.getElementById("uiStatus").innerText = `${cleanDisplayNameOnly(currentUser)} • Rank ${currentRankNum}`;
        showNotification("Biometric Error", e.message, true, { skipStore: true });
    }
}

// ==========================================================
// DEVICES, LOGIN AUDIT & EMERGENCY REMOTE LOGOUT
// ==========================================================
async function registerCurrentDeviceOnServer() {
    if (currentUser === "Guest") return;
    try {
        await fetch(`${SERVER_URL}/api/devices/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_id: CURRENT_DEVICE_ID,
                device_name: getFriendlyDeviceName(),
                client_gps: cachedClientGPS
            })
        });
    } catch (e) {}
}

async function fetchAndRenderActiveDevices() {
    const container = document.getElementById('activeDevicesListContainer');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center; padding:6px;">Loading active devices...</div>`;
    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/devices`, {}, 15000);
        container.innerHTML = "";
        const devs = data.devices || [];
        if (devs.length === 0) {
            container.innerHTML = `<div class="profile-list-item"><span>💻 ${escapeHtml(getFriendlyDeviceName())} (This Device)</span><span style="color:var(--success); font-weight:700;">Active</span></div>`;
            return;
        }
        devs.forEach(d => {
            const isThisDev = d.device_id === CURRENT_DEVICE_ID;
            const div = document.createElement('div');
            div.className = "profile-list-item";
            div.innerHTML = `
                <div>
                    <div style="font-weight:700;">💻 ${escapeHtml(d.device_name)} ${isThisDev ? '<span style="color:var(--success);">(This Device)</span>' : ''}</div>
                    <div style="font-size:10.5px; color:var(--text-muted);">IP: ${escapeHtml(d.ip)} • Active: ${escapeHtml(d.last_active)}</div>
                </div>
                ${!isThisDev ? `<button type="button" class="chip-btn" style="width:auto; padding:4px 10px; font-size:10.5px; color:var(--danger);" onclick="revokeSingleDeviceSession('${escapeHtml(d.device_id)}')">Sign Out</button>` : ''}
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = `<div class="profile-list-item"><span>💻 ${escapeHtml(getFriendlyDeviceName())}</span></div>`;
    }
}

async function fetchAndRenderLoginAudit() {
    const container = document.getElementById('loginAuditListContainer');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center; padding:6px;">Loading login audit...</div>`;
    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/login_audit`, {}, 15000);
        container.innerHTML = "";
        const logs = data.logs || [];
        if (logs.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:6px;">No recent sign-in records.</div>`;
            return;
        }
        logs.forEach(l => {
            const isFailed = String(l.status || "").includes("FAIL");
            const div = document.createElement('div');
            div.className = "notif-item";
            div.style.padding = "7px 10px";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; gap:6px;">
                    <span style="font-weight:700; color:${isFailed ? 'var(--danger)' : 'var(--success)'};">${isFailed ? '⚠️' : '✓'} ${escapeHtml(l.status)} • ${escapeHtml(l.device)}</span>
                    <span style="font-size:10px; color:var(--text-muted); white-space:nowrap;">${escapeHtml(l.time)}</span>
                </div>
                <div style="font-size:10.5px; color:var(--text-muted);">🌐 IP: ${escapeHtml(l.ip)} • 📍 ${escapeHtml(l.location)}</div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = `<div style="color:var(--text-muted); text-align:center;">Audit offline.</div>`;
    }
}

async function revokeSingleDeviceSession(targetDevId) {
    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/devices/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_id: targetDevId })
        }, 15000);
        if (data.success) {
            showNotification("Device Signed Out", "Session revoked!", false, { skipStore: true });
            await fetchAndRenderActiveDevices();
        }
    } catch (e) {}
}

async function logoutOtherDevicesViaFaceID() {
    try {
        showNotification("Biometrics", "Look at camera and blink slightly to verify identity...", false, { skipStore: true });
        const scan = await captureStrictFaceDescriptorWithLiveness((msg) => {
            document.getElementById('uiStatus').innerText = msg;
        });
        document.getElementById('uiStatus').innerText = `${cleanDisplayNameOnly(currentUser)} • Rank ${currentRankNum}`;
        await executeRemoteLogoutRequest({
            embedding: scan.embedding,
            liveness_delta: scan.livenessDelta,
            security_snap: scan.snapshot,
            keep_device_id: CURRENT_DEVICE_ID,
            client_gps: cachedClientGPS
        });
    } catch (e) {
        showNotification("Face ID Failed", e.message || "Use your Backup PIN below.", true, { skipStore: true });
    }
}

async function logoutOtherDevicesViaPin() {
    const pinVal = document.getElementById('remoteLogoutPinInput').value.trim();
    if (!/^\d{4,6}$/.test(pinVal)) {
        showNotification("Backup PIN Required", "Enter your 4 to 6 digit Backup PIN.", true, { skipStore: true });
        return;
    }
    await executeRemoteLogoutRequest({
        pin: pinVal,
        security_snap: captureSilentSecurityFrame(),
        keep_device_id: CURRENT_DEVICE_ID,
        client_gps: cachedClientGPS
    });
}

async function executeRemoteLogoutRequest(payloadObj) {
    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/logout_all_devices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadObj)
        }, 20000);
        if (data.success) {
            document.getElementById('remoteLogoutPinInput').value = "";
            updateRotatedSessionToken(data.new_token_version, data.session_sig);
            showNotification("Signed Out Other Devices", data.message, false, { skipStore: true });
            await fetchAndRenderActiveDevices();
        } else {
            showNotification("Verification Failed", data.message || "Failed.", true);
        }
    } catch (e) {
        showNotification("Error", e.message, true, { skipStore: true });
    }
}

// ==========================================================
// PIN GATE (AUTO-ROTATES SESSION TOKEN ON PIN CHANGE)
// ==========================================================
function openPinGate(mode, customReason = "") {
    pinGateMode = mode;
    isPinLocked = true;
    document.getElementById('pinGateInput').value = "";
    document.getElementById('pinGateError').innerText = "";
    document.getElementById('pinGateTitle').innerText = mode === "setup" ? "🔢 Set Backup Security PIN" : "🔑 Security Backup PIN Challenge";
    document.getElementById('pinGateSubtitle').innerText = customReason || (mode === "setup" ? "Set a 4 to 6 digit Backup PIN (older sessions on other devices will automatically sign out)." : "Enter your 4 to 6 digit Backup PIN to verify your identity.");
    document.getElementById('pinGateSubmitBtn').innerText = mode === "setup" ? "Save Backup PIN" : "Verify PIN & Unlock";
    document.getElementById('pinGateModal').style.display = "flex";
    setTimeout(() => document.getElementById('pinGateInput').focus(), 100);
}

function closePinGate() {
    isPinLocked = false;
    document.getElementById('pinGateModal').style.display = "none";
}

async function submitPinGate() {
    const pinVal = document.getElementById('pinGateInput').value.trim();
    const errEl = document.getElementById('pinGateError');
    if (!/^\d{4,6}$/.test(pinVal)) {
        errEl.innerText = "PIN must be 4 to 6 digits.";
        return;
    }
    errEl.style.color = "var(--accent-primary)";
    errEl.innerText = pinGateMode === "setup" ? "Saving PIN..." : "Verifying PIN...";

    if (pinGateMode === "setup") {
        try {
            let data = await fetchJsonWithTimeout(`${SERVER_URL}/api/set_pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: pinVal, keep_device_id: CURRENT_DEVICE_ID })
            }, 20000);
            if (!data.success) {
                errEl.style.color = "var(--danger)";
                errEl.innerText = data.message || "Failed.";
                return;
            }
            safeSetItem(getLocalHasPinKey(currentDBUser), "true");
            updateRotatedSessionToken(data.new_token_version, data.session_sig);
            closePinGate();
            showNotification("Backup PIN Updated", data.message || "Backup PIN saved & older sessions revoked.", false, { skipStore: true });
        } catch (e) {
            errEl.style.color = "var(--danger)";
            errEl.innerText = e.message || "Network error.";
        }
    } else {
        try {
            const targetU = pendingLoginData ? pendingLoginData.username : currentUser;
            let data = await fetchJsonWithTimeout(`${SERVER_URL}/api/verify_pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: targetU,
                    pin: pinVal,
                    security_snap: captureSilentSecurityFrame(),
                    client_gps: cachedClientGPS
                })
            }, 20000);
            if (!data.success) {
                if (data.needs_setup) {
                    openPinGate("setup", "No PIN found on server. Create your 4 to 6 digit backup PIN now:");
                    return;
                }
                errEl.style.color = "var(--danger)";
                errEl.innerText = data.message || "Invalid Backup PIN.";
                return;
            }
            closePinGate();
            if (pendingLoginData) {
                const p = pendingLoginData;
                pendingLoginData = null;
                completeLoginAfterVerification(p.username, p.db_username, p.role, p.face_id, p.playGreeting, p.replyMsg, p.audioBase64, data.token_version || p.tokenVersion, data.session_sig || p.sessionSig);
            }
        } catch (e) {
            errEl.style.color = "var(--danger)";
            errEl.innerText = e.message || "Network error verifying PIN.";
        }
    }
}

// ==========================================================
// CLEAN 4-TAB SETTINGS PANEL & SAVED ACCOUNTS
// ==========================================================
function switchSettingsTab(tabName) {
    const map = { general: 'General', security: 'Security', activity: 'Activity', accounts: 'Accounts' };
    Object.entries(map).forEach(([k, suffix]) => {
        const btn = document.getElementById(`setTab${suffix}`);
        const pane = document.getElementById(`setPane${suffix}`);
        if (btn) btn.classList.toggle('active', k === tabName);
        if (pane) pane.style.display = (k === tabName) ? 'flex' : 'none';
    });
    if (tabName === 'activity') {
        fetchAndRenderActiveDevices();
        fetchAndRenderLoginAudit();
    } else if (tabName === 'accounts') {
        renderProfileList();
    }
}

function applySettings() {
    const quickBtn = document.getElementById('quickThemeBtn');
    const sfxBtn = document.getElementById('sfxToggleBtn');
    const isDark = userSettings.theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    const themeSel = document.getElementById('themeSelect');
    if (themeSel) themeSel.value = isDark ? 'dark' : 'light';
    if (quickBtn) quickBtn.innerText = isDark ? "☀️ Light" : "🌙 Dark";
    if (typeof sfxEnabled !== "undefined") sfxEnabled = (userSettings.sfx !== 'off');
    if (sfxBtn) sfxBtn.innerText = (userSettings.sfx !== 'off') ? "🎛️ SFX" : "🔇 Mute";
    const vd = document.getElementById('voiceDefaultSelect');
    if (vd) vd.value = userSettings.voiceDefault || 'off';
    const nt = document.getElementById('notifToggleSelect');
    if (nt) nt.value = userSettings.showNotifs || 'on';
}

function saveSettings() {
    userSettings.theme = document.getElementById('themeSelect').value;
    userSettings.voiceDefault = document.getElementById('voiceDefaultSelect').value;
    userSettings.showNotifs = document.getElementById('notifToggleSelect').value;
    safeSetItem('kiza_settings', JSON.stringify(userSettings));
    applySettings();
}

function toggleQuickTheme() {
    document.getElementById('themeSelect').value = userSettings.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
}

function openSettings() {
    if (isPinLocked) { openPinGate(pinGateMode); return; }
    if (typeof toggleMobileSidebar === "function") toggleMobileSidebar(false);
    document.getElementById('settingsModal').style.display = "flex";
    switchSettingsTab('general');
    if (typeof refreshHardwareDeviceDropdowns === "function") refreshHardwareDeviceDropdowns();
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = "none";
}

function renderProfileList() {
    const list = document.getElementById('profileListContainer');
    if (!list) return;
    list.innerHTML = "";
    if (!storedProfiles.length) {
        list.innerHTML = "<div style='font-size:12px; text-align:center; color:var(--text-muted);'>No saved accounts.</div>";
        return;
    }
    storedProfiles.forEach((prof, idx) => {
        let div = document.createElement('div');
        div.className = "profile-list-item";
        let isCurrent = (prof.username === currentUser);
        div.innerHTML = `
            <span style="font-weight:700; font-size:12.5px;">${escapeHtml(cleanDisplayNameOnly(prof.username))} ${isCurrent ? "<span style='color:var(--success); font-size:11px;'>(Active)</span>" : ""}</span>
            <div style="display:flex; gap:6px;">
                ${!isCurrent ? `<button class="chip-btn" style="padding:4px 11px; width:auto;" onclick="switchToProfile(${idx})">Switch</button>` : ''}
                <button class="chip-btn" style="color:var(--danger); padding:4px 10px; width:auto;" onclick="removeProfile(${idx})">✕</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function saveCurrentProfileToStorage(username, db_username, role, face_id, sessionSig = null) {
    let safeDB = db_username || resolveDBUser(username);
    let existing = storedProfiles.find(p => p.username === username);
    if (existing) {
        existing.role = role;
        existing.db_username = safeDB;
        if (face_id) existing.face_id = face_id;
        if (sessionSig) existing.session_sig = sessionSig;
    } else {
        storedProfiles.push({ username, db_username: safeDB, role, face_id, session_sig: sessionSig || currentSessionSig });
    }
    safeSetItem('kiza_profiles', JSON.stringify(storedProfiles));
}

function removeProfile(idx) {
    let prof = storedProfiles[idx];
    storedProfiles.splice(idx, 1);
    safeSetItem('kiza_profiles', JSON.stringify(storedProfiles));
    if (prof && prof.username === currentUser) logoutUser();
    else renderProfileList();
}

async function switchToProfile(idx) {
    let prof = storedProfiles[idx];
    closeSettings();
    if (!prof || !prof.session_sig) {
        addIdentity();
        if (prof) document.getElementById('authUser').value = prof.username;
        showNotification("Sign In Required", "Verify password or Strict Face ID to switch accounts securely.", false, { skipStore: true });
        return;
    }
    const safeDB = prof.db_username || resolveDBUser(prof.username);
    const savedTokVer = parseInt(localStorage.getItem(getTokenVerStorageKey(safeDB)) || "1", 10) || 1;
    const verified = await verifySessionWithServer(prof.username, savedTokVer, prof.session_sig);
    if (!verified) {
        addIdentity();
        document.getElementById('authUser').value = prof.username;
        showNotification("Session Expired", "Enter password or Strict Face ID to re-verify.", true, { skipStore: true });
        return;
    }
    completeLoginAfterVerification(verified.username, verified.db_username, verified.role, prof.face_id, false, "", null, verified.token_version, verified.session_sig);
}

function addIdentity() {
    closeSettings();
    document.getElementById('authModal').style.display = "flex";
    document.getElementById('cancelAuthBtn').style.display = "inline-block";
    document.getElementById('authUser').value = "";
    document.getElementById('authPass').value = "";
}

function cancelAddIdentity() {
    document.getElementById('authModal').style.display = "none";
    document.getElementById('cancelAuthBtn').style.display = "none";
}

function switchAuthMode(mode) {
    authMode = mode;
    document.getElementById('loginTab').classList.toggle('active', mode === 'login');
    document.getElementById('signupTab').classList.toggle('active', mode === 'signup');
    document.getElementById('signupPinContainer').style.display = mode === 'signup' ? 'flex' : 'none';
    document.getElementById('authError').innerText = "";
}

function applyRoleUI(roleStr) {
    currentRole = formatCleanRole(roleStr, currentUser);
    currentRankNum = computeRankNumber(currentRole, currentUser);
    safeSetItem('kiza_role', currentRole);
    saveCurrentProfileToStorage(currentUser, currentDBUser, currentRole, localStorage.getItem('kiza_face'), currentSessionSig);
    document.getElementById('roleVal').innerText = `Rank ${currentRankNum} • ${currentRole}`;
    if (currentRankNum <= 4) {
        document.getElementById('masterCmds').style.display = "flex";
        document.querySelectorAll('.owner-only').forEach(el => el.style.display = currentRankNum <= 2 ? "inline-flex" : "none");
        document.querySelectorAll('.top3-only').forEach(el => el.style.display = currentRankNum <= 3 ? "inline-flex" : "none");
    } else {
        document.getElementById('masterCmds').style.display = "none";
    }
}

function completeLoginAfterVerification(username, db_username, role, face_id, playGreeting = true, replyMsg = "", audioBase64 = null, tokenVersion = 1, sessionSig = "") {
    lastLoginTimestamp = Date.now();
    currentUser = username || "Guest";
    currentDBUser = (db_username && db_username !== "undefined") ? db_username : resolveDBUser(currentUser);
    currentTokenVersion = tokenVersion || 1;
    currentSessionSig = sessionSig || "";
    currentSessionId = generateSessionId();

    const savedIdx = parseInt(localStorage.getItem(getAlertIdxStorageKey(currentDBUser)) || "0", 10);
    alertIndex = isNaN(savedIdx) ? 0 : savedIdx;

    safeSetItem('kiza_user', currentUser);
    safeSetItem('kiza_db', currentDBUser);
    safeSetItem('kiza_sig', currentSessionSig);
    safeSetItem(getSessionSigStorageKey(currentDBUser), currentSessionSig);
    safeSetItem(getTokenVerStorageKey(currentDBUser), String(currentTokenVersion));
    if (face_id) safeSetItem('kiza_face', face_id);

    applyRoleUI(role);
    document.getElementById('authModal').style.display = "none";
    document.getElementById('authError').innerText = "";
    closePinGate();

    const cleanName = cleanDisplayNameOnly(currentUser);
    document.getElementById('idVal').innerText = cleanName;
    const savedFace = face_id || localStorage.getItem('kiza_face');
    const faceImg = document.getElementById('savedFaceImg');
    if (savedFace) { faceImg.src = savedFace; faceImg.style.display = "block"; } else faceImg.style.display = "none";

    document.getElementById('uiStatus').innerText = `${cleanName} • Rank ${currentRankNum}`;
    updateUnreadBadges();
    registerCurrentDeviceOnServer();
    refreshSidebarChatSessions();
    renderPinnedMessagesSidebar();
    renderCustomGemsBar();
    syncUserGemsWithServer();
    loadUserProfileAndMemory();

    if (playGreeting && replyMsg) {
        showNotification("Welcome", replyMsg, false, { skipStore: true });
        if (audioBase64) playKizaAudio(audioBase64, replyMsg);
    }
    document.getElementById('actionLog').innerHTML = '<div>> <b>[KIZA]:</b> Hi! Ask me in English, Hindi, or Punjabi—for live news, bullet points, 3-paragraph answers, native Word (.docx), multi-sheet Excel (.xlsx), or Movie Theater PDFs!</div>';
    checkAndRenderLiveCallMinutes();
    initWebSocket();
}

async function finalizeLogin(username, db_username, role, face_id, playGreeting = true, replyMsg = "", audioBase64 = null, tokenVersion = 1, requirePinChallenge = false, sessionSig = "") {
    if (requirePinChallenge) {
        pendingLoginData = { username, db_username, role, face_id, playGreeting, replyMsg, audioBase64, tokenVersion, sessionSig };
        document.getElementById('authModal').style.display = "none";
        openPinGate("verify", "🔑 New browser or unrecognized IP detected! Enter your 4 to 6 digit Backup PIN:");
        return;
    }
    completeLoginAfterVerification(username, db_username, role, face_id, playGreeting, replyMsg, audioBase64, tokenVersion, sessionSig);
}

async function verifySessionWithServer(username, tokenVersion, sessionSig) {
    if (!sessionSig) return null;
    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/verify_session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                device_id: CURRENT_DEVICE_ID,
                token_version: Number(tokenVersion) || 1,
                session_sig: sessionSig
            })
        }, 18000);
        return (data && data.success) ? data : null;
    } catch (e) {
        return null;
    }
}

function forceLogout() {
    closePinGate();
    localStorage.removeItem('kiza_user');
    localStorage.removeItem('kiza_db');
    localStorage.removeItem('kiza_role');
    localStorage.removeItem('kiza_face');
    localStorage.removeItem('kiza_sig');
    currentUser = "Guest";
    currentDBUser = "guest";
    currentRankNum = 5;
    currentSessionSig = "";
    document.getElementById('idVal').innerText = "Guest";
    document.getElementById('roleVal').innerText = "Signed Out";
    document.getElementById('uiStatus').innerText = "Ready";
    if (typeof updateUnreadBadges === "function") updateUnreadBadges();
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; wsConnected = false; }
    document.getElementById('authModal').style.display = "flex";
    document.getElementById('cancelAuthBtn').style.display = "none";
    document.getElementById('masterCmds').style.display = "none";
    closeSettings();
}

function logoutUser() {
    forceLogout();
    document.getElementById('authUser').value = "";
    document.getElementById('authPass').value = "";
    document.getElementById('authError').innerText = "";
}

async function handleGoogleLogin(response) {
    const errBox = document.getElementById('authError');
    errBox.style.color = "var(--accent-primary)";
    errBox.innerText = "Verifying Google Sign-In with KIZA Brain...";
    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/google_auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token: response.credential,
                client_gps: cachedClientGPS,
                device_id: CURRENT_DEVICE_ID,
                device_name: getFriendlyDeviceName()
            })
        }, 25000);
        if (!data.success) {
            errBox.style.color = "var(--danger)";
            errBox.innerText = data.message || "Google Sign-In failed.";
            showNotification("Access Denied", data.message || "Access Denied", true);
            return;
        }
        await finalizeLogin(
            cleanDisplayNameOnly(data.username),
            data.db_username,
            data.role,
            data.face_id,
            true,
            data.reply,
            data.audio_base64,
            data.token_version || 1,
            Boolean(data.require_pin_challenge),
            data.session_sig || ""
        );
    } catch (err) {
        errBox.style.color = "var(--danger)";
        errBox.innerText = `Google Sign-In Error: ${err.message}`;
    }
}

async function performAuth() {
    const errBox = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');
    const username = document.getElementById('authUser').value.trim();
    const password = document.getElementById('authPass').value.trim();
    const pinInput = document.getElementById('authPin').value.trim();

    if (!username || !password) {
        errBox.style.color = "var(--danger)";
        errBox.innerText = "Please enter both Username and Password.";
        return;
    }
    if (authMode === "signup" && !/^\d{4,6}$/.test(pinInput)) {
        errBox.style.color = "var(--danger)";
        errBox.innerText = "Please enter a 4 to 6 digit numeric Backup PIN.";
        return;
    }

    errBox.style.color = "var(--accent-primary)";
    errBox.innerText = "Verifying credentials...";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Signing in..."; }

    const faceData = captureFaceSnapshot();
    const silentSecuritySnap = captureSilentSecurityFrame();

    try {
        const data = await fetchJsonWithTimeout(`${SERVER_URL}/api/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username, password, action: authMode, face_id: faceData, security_snap: silentSecuritySnap,
                pin: authMode === "signup" ? pinInput : null, client_gps: cachedClientGPS,
                device_id: CURRENT_DEVICE_ID, device_name: getFriendlyDeviceName()
            })
        }, 25000);
        if (!data.success) {
            errBox.style.color = "var(--danger)";
            errBox.innerText = data.message || "Invalid credentials.";
            if (data.is_lockdown && typeof recordGlobalLockdownToEveryone === "function") {
                recordGlobalLockdownToEveryone("🚨 System Lockdown Active", data.message);
            }
            showNotification("Access Denied", data.message || "Invalid credentials.", true);
            return;
        }
        errBox.innerText = "";
        document.getElementById('authPin').value = "";
        await finalizeLogin(
            cleanDisplayNameOnly(data.username),
            data.db_username || resolveDBUser(data.username),
            data.role,
            data.face_id || faceData,
            true,
            data.reply,
            data.audio_base64,
            data.token_version || 1,
            Boolean(data.require_pin_challenge),
            data.session_sig || ""
        );
    } catch (err) {
        errBox.style.color = "var(--danger)";
        errBox.innerText = `Sign-In Error: ${err.message}`;
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Continue"; }
    }
}
