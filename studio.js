// ==========================================================
// KIZA v11.9 — PRO STUDIO, CONTINUITY EDITING, FORMAT CLONING & FORENSIC SECURITY PDF
// ==========================================================
let attachedImageBase64 = null;
let attachedImageName = "";
let lastAttachedFileTopic = "";
let lastUploadedDocumentContext = "";
let attachedImageExtractedContext = "";
let isScanningAttachment = false;
let attachmentScanPromise = null;

let lastCompiledFileCache = null;
let currentSandboxCodeObj = { lang: "html", code: "", filename: "index.html" };
let generatedCodeSnippetsStore = [];
const activeChartInstances = {};
const webImageCache = {};
let isSplitStudioActive = false;

// Unified Continuity & Format-Cloning State (Images, Videos, PDFs, DOCX, XLSX, PPTX, CSV)
let kizaContinuityState = {
    type: null,          // 'image' | 'video' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'txt'
    title: "",
    imageBase64: null,   // Latest uploaded/generated image OR video keyframe
    videoMeta: null,     // { duration, width, height }
    lastPrompt: "",
    docExt: "",
    docTheme: "cyber_dark",
    docLayout: "infographic",
    docBlueprint: "",
    docRawContent: ""
};

function extractDocumentFormatBlueprint(rawText, ext = "pdf", title = "Document") {
    const clean = String(rawText || "");
    const pages = (clean.match(/^(?:PAGE|SLIDE)\s*\d+\s*:[^\n]*/gim) || []).slice(0, 15);
    const sections = (clean.match(/^SECTION\s*:[^\n]*/gim) || []).slice(0, 12);
    const sheets = (clean.match(/^SHEET\s*:[^\n]*/gim) || []).slice(0, 6);
    const headers = (clean.match(/^TABLE_HEADER\s*:[^\n]*/gim) || []).slice(0, 4);
    const hasKpi = /^KPI\s*:/im.test(clean);
    const hasChart = /^CHART\s*:/im.test(clean);
    const hasCallout = /^CALLOUT\s*:/im.test(clean);
    const hasImageQ = /^(?:IMAGE_QUERY|FIGURE)\s*:/im.test(clean);
    return [
        `FORMAT BLUEPRINT (.${String(ext).toUpperCase()} | Title: ${title})`,
        pages.length ? `Pages/Slides (${pages.length}): ${pages.map(p => p.trim()).join(' | ')}` : '',
        sections.length ? `Sections: ${sections.map(s => s.trim()).join(' | ')}` : '',
        sheets.length ? `Excel Sheets: ${sheets.map(s => s.trim()).join(' | ')}` : '',
        headers.length ? `Table Columns: ${headers.map(h => h.trim()).join(' || ')}` : '',
        `Visual Elements: KPI=${hasKpi}, Charts=${hasChart}, Callouts=${hasCallout}, Figures=${hasImageQ}`
    ].filter(Boolean).join('\n');
}

function getActiveContinuityPayload() {
    if (!kizaContinuityState.type) {
        return { continuity_type: null, continuity_image_base64: null, continuity_doc_context: null };
    }
    let docCtx = null;
    if (["pdf", "docx", "xlsx", "pptx", "csv", "txt"].includes(kizaContinuityState.type)) {
        docCtx = `ACTIVE CONTINUITY FILE (.${(kizaContinuityState.docExt || kizaContinuityState.type).toUpperCase()}) | TITLE: ${kizaContinuityState.title} | THEME: ${kizaContinuityState.docTheme} | LAYOUT: ${kizaContinuityState.docLayout}\n${kizaContinuityState.docBlueprint}\nCONTENT:\n${String(kizaContinuityState.docRawContent || '').slice(0, 4200)}`;
    } else if (kizaContinuityState.type === "video" && kizaContinuityState.videoMeta) {
        docCtx = `ACTIVE CONTINUITY VIDEO (${kizaContinuityState.title}) | Duration: ${kizaContinuityState.videoMeta.duration}s | Resolution: ${kizaContinuityState.videoMeta.width}x${kizaContinuityState.videoMeta.height} | Last Prompt: ${kizaContinuityState.lastPrompt}`;
    } else if (kizaContinuityState.type === "image") {
        docCtx = `ACTIVE CONTINUITY IMAGE (${kizaContinuityState.title}) | Last Prompt: ${kizaContinuityState.lastPrompt}`;
    }
    return {
        continuity_type: kizaContinuityState.type,
        continuity_image_base64: kizaContinuityState.imageBase64 || null,
        continuity_doc_context: docCtx
    };
}

function captureImageElementToDataUrl(imgEl) {
    try {
        if (!imgEl) return null;
        if (imgEl.src && imgEl.src.startsWith("data:image/")) return imgEl.src;
        const c = document.createElement('canvas');
        const maxDim = 960;
        let w = imgEl.naturalWidth || 768, h = imgEl.naturalHeight || 768;
        if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
            else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(imgEl, 0, 0, w, h);
        return c.toDataURL('image/jpeg', 0.85);
    } catch (e) {
        return (imgEl?.src && imgEl.src.startsWith("data:image/")) ? imgEl.src : null;
    }
}

const THEME_PALETTES = {
    movie_theater: { bgHex: "0D0205", cardHex: "1A050A", accentHex: "FBBF24", secHex: "DC2626", textHex: "FFFBEB", subHex: "FCA5A5", pdfHero: "linear-gradient(135deg, #450a0a 0%, #1a050a 50%, #78350f 100%)", pdfBar: "linear-gradient(90deg, #7f1d1d 0%, #450a0a 100%)", pdfPageBg: "#0d0205", pdfText: "#fffbeb", pdfCardBg: "#1a050a", pdfAccent: "#fbbf24", pdfSec: "#ef4444", pdfMuted: "#fca5a5" },
    black: { bgHex: "000000", cardHex: "0A0A0A", accentHex: "00F2FE", secHex: "A855F7", textHex: "FFFFFF", subHex: "94A3B8", pdfHero: "linear-gradient(135deg, #000000 0%, #111111 70%, #1e293b 100%)", pdfBar: "linear-gradient(90deg, #000000 0%, #1e293b 100%)", pdfPageBg: "#090d16", pdfText: "#f8fafc", pdfCardBg: "#111827", pdfAccent: "#38bdf8", pdfSec: "#a855f7", pdfMuted: "#94a3b8" },
    cyber_dark: { bgHex: "060A17", cardHex: "111827", accentHex: "38BDF8", secHex: "A855F7", textHex: "F8FAFC", subHex: "94A3B8", pdfHero: "linear-gradient(135deg, #090d16 0%, #0f172a 55%, #0284c7 100%)", pdfBar: "linear-gradient(90deg, #0f172a 0%, #0284c7 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#f0f9ff", pdfAccent: "#0284c7", pdfSec: "#4f46e5", pdfMuted: "#64748b" },
    light: { bgHex: "F8FAFC", cardHex: "FFFFFF", accentHex: "0284C7", secHex: "2563EB", textHex: "0F172A", subHex: "475569", pdfHero: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)", pdfBar: "linear-gradient(90deg, #0284c7 0%, #2563eb 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#f8fafc", pdfAccent: "#0284c7", pdfSec: "#2563eb", pdfMuted: "#64748b" },
    blue: { bgHex: "071936", cardHex: "0C264E", accentHex: "38BDF8", secHex: "60A5FA", textHex: "FFFFFF", subHex: "93C5FD", pdfHero: "linear-gradient(135deg, #071936 0%, #1d4ed8 100%)", pdfBar: "linear-gradient(90deg, #071936 0%, #1d4ed8 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#eff6ff", pdfAccent: "#1d4ed8", pdfSec: "#0284c7", pdfMuted: "#475569" },
    purple: { bgHex: "130726", cardHex: "210E3D", accentHex: "C084FC", secHex: "F472B6", textHex: "FFFFFF", subHex: "D8B4FE", pdfHero: "linear-gradient(135deg, #2e1065 0%, #7e22ce 100%)", pdfBar: "linear-gradient(90deg, #3b0764 0%, #9333ea 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#faf5ff", pdfAccent: "#7e22ce", pdfSec: "#c026d3", pdfMuted: "#6b21a8" },
    green: { bgHex: "041E16", cardHex: "062E22", accentHex: "10B981", secHex: "34D399", textHex: "FFFFFF", subHex: "A7F3D0", pdfHero: "linear-gradient(135deg, #064e3b 0%, #059669 100%)", pdfBar: "linear-gradient(90deg, #064e3b 0%, #059669 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#ecfdf5", pdfAccent: "#059669", pdfSec: "#0d9488", pdfMuted: "#047857" },
    red: { bgHex: "28070C", cardHex: "3F0B13", accentHex: "FB7185", secHex: "F43F5E", textHex: "FFFFFF", subHex: "FDA4AF", pdfHero: "linear-gradient(135deg, #4c0519 0%, #e11d48 100%)", pdfBar: "linear-gradient(90deg, #881337 0%, #e11d48 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#fff1f2", pdfAccent: "#e11d48", pdfSec: "#f43f5e", pdfMuted: "#9f1239" },
    gold: { bgHex: "1C1605", cardHex: "2E2408", accentHex: "FBBF24", secHex: "F59E0B", textHex: "FFFFFF", subHex: "FDE68A", pdfHero: "linear-gradient(135deg, #451a03 0%, #d97706 100%)", pdfBar: "linear-gradient(90deg, #78350f 0%, #d97706 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#fffbeb", pdfAccent: "#b45309", pdfSec: "#d97706", pdfMuted: "#92400e" }
};

const FILE_TYPE_FORMATS = {
    pdf: [
        { value: "infographic", label: "📊 Infographic Dossier" },
        { value: "magazine", label: "📰 Editorial Magazine" },
        { value: "movie_theater", label: "🎬 Movie Theater Stage" },
        { value: "academic", label: "📚 Academic / NCERT" },
        { value: "exam_paper", label: "📝 CBSE Exam Paper" },
        { value: "lab_manual", label: "🔬 Lab Practical File" },
        { value: "minimal", label: "💼 Clean Minimalist" }
    ],
    docx: [
        { value: "docx_report", label: "📘 Executive Word Report" },
        { value: "docx_letter", label: "✉️ Formal Letter / Application" },
        { value: "docx_assignment", label: "🎓 School Assignment / Essay" },
        { value: "docx_resume", label: "📄 Resume / CV Layout" },
        { value: "docx_minutes", label: "🗒️ Meeting Minutes" }
    ],
    xlsx: [
        { value: "xlsx_budget", label: "💰 Financial Workbook (=SUM & =AVG)" },
        { value: "xlsx_marksheet", label: "🎓 Student Marksheet (=SUM & =AVG)" },
        { value: "xlsx_tracker", label: "📋 Project / Study Tracker" },
        { value: "xlsx_comparison", label: "⚖️ Comparison Matrix" }
    ],
    pptx: [
        { value: "pptx_cinematic", label: "🎬 Cinematic Widescreen" },
        { value: "pptx_pitch", label: "🚀 Startup Pitch Deck" },
        { value: "pptx_academic", label: "📚 Academic Lecture Deck" }
    ],
    csv: [
        { value: "csv_raw", label: "📊 Clean Raw CSV Table" }
    ]
};

// ==========================================================
// FREE AI PICTURE & VIDEO GENERATOR (WITH CONTINUITY IMG2IMG EDITING)
// ==========================================================
function downloadMediaUrlHelper(mediaUrl, filename) {
    if (!mediaUrl) return;
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function generateAndRenderFreeImageCard(promptStr, serverImageBase64 = null, editSourceBase64 = null) {
    const cleanPrompt = String(promptStr || "").trim();
    if (!cleanPrompt && !serverImageBase64) return;
    const logBox = document.getElementById('actionLog');
    if (!logBox) return;

    const isImgEdit = Boolean(editSourceBase64);
    const cardId = "kiza_img_" + Date.now() + "_" + Math.floor(Math.random() * 999);
    const card = document.createElement('div');
    card.style.cssText = "background:var(--card-bg); border:1.5px solid var(--accent-primary); border-radius:14px; padding:14px; margin-top:6px; white-space:normal;";
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
                <span style="font-size:10px; font-weight:800; color:var(--accent-primary); background:var(--chip-bg); padding:3px 9px; border-radius:6px;">🖼️ ${isImgEdit ? 'CONTINUITY IMAGE EDIT' : 'FREE AI IMAGE STUDIO'}</span>
                <div style="font-size:12.5px; font-weight:700; margin-top:4px;">${escapeHtml(cleanPrompt.slice(0, 150))}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;" id="${cardId}_actions"></div>
        </div>
        <div id="${cardId}_body" style="min-height:180px; border-radius:10px; background:var(--bg-main); border:1px solid var(--card-border); display:flex; align-items:center; justify-content:center; padding:12px; text-align:center; font-size:12px; color:var(--text-muted);">
            🎨 ${isImgEdit ? 'Applying continuity edit to image...' : 'Generating HD picture (HF FLUX / Puter AI)...'}
        </div>
    `;
    logBox.appendChild(card);
    logBox.scrollTop = logBox.scrollHeight;

    const bodyEl = document.getElementById(`${cardId}_body`);
    const actEl = document.getElementById(`${cardId}_actions`);

    const mountFinalImage = (imgElOrUrl) => {
        const srcUrl = (typeof imgElOrUrl === "string") ? imgElOrUrl : (imgElOrUrl?.src || "");
        if (!srcUrl) return false;
        bodyEl.innerHTML = "";
        const img = (imgElOrUrl instanceof HTMLImageElement) ? imgElOrUrl : document.createElement('img');
        if (typeof imgElOrUrl === "string") img.src = srcUrl;
        img.alt = cleanPrompt;
        img.style.cssText = "max-width:100%; max-height:460px; border-radius:10px; display:block; margin:0 auto; box-shadow:0 10px 26px rgba(0,0,0,0.28);";
        bodyEl.appendChild(img);

        const saveContinuitySnap = () => {
            const snap = captureImageElementToDataUrl(img) || (typeof imgElOrUrl === "string" && imgElOrUrl.startsWith("data:") ? imgElOrUrl : null);
            kizaContinuityState = {
                ...kizaContinuityState,
                type: "image",
                title: cleanPrompt.slice(0, 48),
                imageBase64: snap || kizaContinuityState.imageBase64,
                lastPrompt: cleanPrompt
            };
        };
        if (img.complete) saveContinuitySnap();
        else img.onload = saveContinuitySnap;

        const safeName = `KIZA_Art_${cleanPrompt.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24) || 'Image'}.png`;
        actEl.innerHTML = `
            <button type="button" class="chip-btn" style="width:auto; padding:5px 10px; font-size:11px; border-color:var(--accent-primary); color:var(--accent-primary);" id="${cardId}_edit">✏️ Edit</button>
            <button type="button" class="chip-btn" style="width:auto; padding:5px 10px; font-size:11px;" id="${cardId}_clone">📋 Copy Style</button>
            <button type="button" class="chip-btn" style="width:auto; padding:5px 10px; font-size:11px;" id="${cardId}_regen">🔄 Regen</button>
            <button type="button" class="send-btn" style="padding:5px 12px; font-size:11px;" id="${cardId}_dl">⬇️ Save PNG</button>
        `;
        document.getElementById(`${cardId}_edit`).onclick = () => { saveContinuitySnap(); prefillInput("Edit this image: "); };
        document.getElementById(`${cardId}_clone`).onclick = () => { saveContinuitySnap(); prefillInput("Copy this image's exact style and format for "); };
        document.getElementById(`${cardId}_dl`).onclick = () => downloadMediaUrlHelper(img.src, safeName);
        document.getElementById(`${cardId}_regen`).onclick = () => generateAndRenderFreeImageCard(cleanPrompt, null, editSourceBase64);
        if (typeof playTacticalSFX === "function") playTacticalSFX("complete");
        logBox.scrollTop = logBox.scrollHeight;
        return true;
    };

    if (serverImageBase64) {
        mountFinalImage(serverImageBase64);
        return;
    }

    if (typeof puter === "undefined" || !puter.ai || typeof puter.ai.txt2img !== "function") {
        bodyEl.innerHTML = `<span style="color:var(--danger);">⚠️ Puter.js Image Engine didn't load. Check your internet connection or refresh the page.</span>`;
        return;
    }

    try {
        let imgEl = null;
        if (editSourceBase64 && editSourceBase64.startsWith("data:image/")) {
            const parts = editSourceBase64.split(",");
            const mime = (parts[0].match(/data:([^;]+);/) || ["", "image/jpeg"])[1];
            const rawB64 = parts[1] || "";
            try {
                imgEl = await puter.ai.txt2img(cleanPrompt, { input_image: rawB64, input_image_mime_type: mime });
            } catch (eEdit) {
                imgEl = null;
            }
        }
        if (!imgEl) {
            try {
                imgEl = await puter.ai.txt2img(cleanPrompt, { model: "black-forest-labs/flux-schnell" });
            } catch (e1) {
                imgEl = await puter.ai.txt2img(cleanPrompt);
            }
        }
        if (!mountFinalImage(imgEl)) {
            bodyEl.innerHTML = `<span style="color:var(--warning);">⚠️ Image generation returned empty. Tap Regen to retry.</span>`;
        }
    } catch (err) {
        bodyEl.innerHTML = `<div style="color:var(--warning);">⚠️ Could not generate image: ${escapeHtml(err?.message || "Popup closed or quota reached")}.</div>`;
        actEl.innerHTML = `<button type="button" class="chip-btn" style="width:auto; padding:5px 11px; font-size:11px;" onclick="generateAndRenderFreeImageCard(${JSON.stringify(cleanPrompt)})">🔄 Retry</button>`;
    }
}

async function generateAndRenderFreeVideoCard(promptStr, refImageBase64 = null) {
    const cleanPrompt = String(promptStr || "").trim();
    if (!cleanPrompt) return;
    const logBox = document.getElementById('actionLog');
    if (!logBox) return;

    const cardId = "kiza_vid_" + Date.now() + "_" + Math.floor(Math.random() * 999);
    const card = document.createElement('div');
    card.style.cssText = "background:var(--card-bg); border:1.5px solid var(--accent-secondary); border-radius:14px; padding:14px; margin-top:6px; white-space:normal;";
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
                <span style="font-size:10px; font-weight:800; color:#ffffff; background:linear-gradient(135deg, #4f46e5, #0284c7); padding:3px 9px; border-radius:6px;">🎬 ${refImageBase64 ? 'CONTINUITY VIDEO STUDIO' : 'FREE AI VIDEO STUDIO'}</span>
                <div style="font-size:12.5px; font-weight:700; margin-top:4px;">${escapeHtml(cleanPrompt.slice(0, 150))}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;" id="${cardId}_actions"></div>
        </div>
        <div id="${cardId}_body" style="min-height:200px; border-radius:10px; background:var(--bg-main); border:1px solid var(--card-border); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:14px; text-align:center; font-size:12px; color:var(--text-muted);">
            <div>🎥 Rendering AI video clip via Puter.js...</div>
            <div style="font-size:10.5px; opacity:0.8;">Video clips usually take 20–60 seconds. You can keep chatting while it renders.</div>
        </div>
    `;
    logBox.appendChild(card);
    logBox.scrollTop = logBox.scrollHeight;

    const bodyEl = document.getElementById(`${cardId}_body`);
    const actEl = document.getElementById(`${cardId}_actions`);

    if (typeof puter === "undefined" || !puter.ai || typeof puter.ai.txt2vid !== "function") {
        bodyEl.innerHTML = `<span style="color:var(--danger);">⚠️ Puter.js Video Engine didn't load. Refresh the page and try again.</span>`;
        return;
    }

    try {
        let videoEl = null;
        if (refImageBase64 && refImageBase64.startsWith("data:image/")) {
            try {
                videoEl = await puter.ai.txt2vid(cleanPrompt, { input_reference: refImageBase64 });
            } catch (eRef) {
                videoEl = null;
            }
        }
        if (!videoEl) {
            videoEl = await puter.ai.txt2vid(cleanPrompt);
        }

        if (videoEl && (videoEl.src || videoEl.querySelector?.('source'))) {
            videoEl.controls = true;
            videoEl.playsInline = true;
            videoEl.loop = true;
            videoEl.crossOrigin = "anonymous";
            videoEl.style.cssText = "width:100%; max-height:420px; border-radius:10px; background:#000; display:block; margin:0 auto;";
            bodyEl.innerHTML = "";
            bodyEl.appendChild(videoEl);

            const saveVidContinuity = () => {
                let frameB64 = refImageBase64 || kizaContinuityState.imageBase64;
                try {
                    if (videoEl.videoWidth > 0) {
                        const c = document.createElement('canvas');
                        const maxW = 720, sc = Math.min(1, maxW / videoEl.videoWidth);
                        c.width = Math.round(videoEl.videoWidth * sc);
                        c.height = Math.round(videoEl.videoHeight * sc);
                        c.getContext('2d').drawImage(videoEl, 0, 0, c.width, c.height);
                        frameB64 = c.toDataURL('image/jpeg', 0.80);
                    }
                } catch (e) {}
                kizaContinuityState = {
                    ...kizaContinuityState,
                    type: "video",
                    title: cleanPrompt.slice(0, 48),
                    imageBase64: frameB64,
                    videoMeta: {
                        duration: Math.round(videoEl.duration || 5),
                        width: videoEl.videoWidth || 1280,
                        height: videoEl.videoHeight || 720
                    },
                    lastPrompt: cleanPrompt
                };
            };
            videoEl.addEventListener('loadeddata', saveVidContinuity, { once: true });
            saveVidContinuity();

            const vidSrc = videoEl.src || videoEl.querySelector('source')?.src || "";
            const safeName = `KIZA_Video_${cleanPrompt.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 22) || 'Clip'}.mp4`;
            actEl.innerHTML = `
                <button type="button" class="chip-btn" style="width:auto; padding:5px 10px; font-size:11px; border-color:var(--accent-primary); color:var(--accent-primary);" id="${cardId}_edit">✏️ Edit Video</button>
                <button type="button" class="chip-btn" style="width:auto; padding:5px 10px; font-size:11px;" id="${cardId}_clone">📋 Copy Style</button>
                <button type="button" class="chip-btn" style="width:auto; padding:5px 10px; font-size:11px;" id="${cardId}_regen">🔄 Regen</button>
                ${vidSrc ? `<button type="button" class="send-btn" style="padding:5px 12px; font-size:11px;" id="${cardId}_dl">⬇️ Save MP4</button>` : ''}
            `;
            document.getElementById(`${cardId}_edit`).onclick = () => { saveVidContinuity(); prefillInput("Edit this video: "); };
            document.getElementById(`${cardId}_clone`).onclick = () => { saveVidContinuity(); prefillInput("Copy this video's style and format to generate a video of "); };
            if (vidSrc) document.getElementById(`${cardId}_dl`).onclick = () => downloadMediaUrlHelper(vidSrc, safeName);
            document.getElementById(`${cardId}_regen`).onclick = () => generateAndRenderFreeVideoCard(cleanPrompt, refImageBase64);
            if (typeof playTacticalSFX === "function") playTacticalSFX("complete");
            logBox.scrollTop = logBox.scrollHeight;
        } else {
            bodyEl.innerHTML = `<span style="color:var(--warning);">⚠️ Video generator returned no clip. Try a shorter descriptive prompt.</span>`;
        }
    } catch (err) {
        bodyEl.innerHTML = `<div style="color:var(--warning);">⚠️ Video generation error: ${escapeHtml(err?.message || "Cancelled or Puter limit reached")}.</div>`;
        actEl.innerHTML = `<button type="button" class="chip-btn" style="width:auto; padding:5px 11px; font-size:11px;" onclick="generateAndRenderFreeVideoCard(${JSON.stringify(cleanPrompt)})">🔄 Retry</button>`;
    }
}

// ==========================================================
// CLEAN PDF / DOCUMENT TEXT, SCIENTIFIC LATEX & CURRENCY SANITIZER
// ==========================================================
function sanitizePdfText(rawStr) {
    let s = String(rawStr == null ? "" : rawStr);
    const supMap = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺', 'n': 'ⁿ' };
    const toSup = (str) => str.split('').map(c => supMap[c] || c).join('');

    s = s.replace(/\$\s*\\\$\s*([^$\n]+?)\s*\$/g, '$$$1');
    s = s.replace(/\\\$/g, '$');

    s = s.replace(/\\sim\s*/g, '~');
    s = s.replace(/\\approx\s*/g, '≈');
    s = s.replace(/\\times\s*/g, '×');
    s = s.replace(/\\pm\s*/g, '±');
    s = s.replace(/\\mu\s*/g, 'µ');
    s = s.replace(/\\le\s*/g, '≤').replace(/\\ge\s*/g, '≥');
    s = s.replace(/\\text\{([^}]*)\}|\\mathrm\{([^}]*)\}|\\mathbf\{([^}]*)\}/g, (_, a, b, c) => a || b || c || '');
    s = s.replace(/~/g, ' ');

    s = s.replace(/\^\{([0-9+\-n]+)\}/g, (_, exp) => toSup(exp));
    s = s.replace(/(\d+|[a-zA-Z])\^([0-9+\-]+)/g, (_, base, exp) => base + toSup(exp));
    s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹])([a-zA-Z])/g, '$1 $2');

    s = s.replace(/\$([^$\n]{1,70})\$/g, (_, inner) => inner.trim());
    return s.replace(/\s{2,}/g, ' ').trim();
}

// ==========================================================
// SPLIT-SCREEN STUDIO CONTROLLER (CHAT LEFT | STUDIO RIGHT)
// ==========================================================
function toggleSplitStudioMode(forceState = null) {
    isSplitStudioActive = (forceState !== null) ? Boolean(forceState) : !isSplitStudioActive;
    document.body.classList.toggle('split-studio-open', isSplitStudioActive);

    const fileModal = document.getElementById('filePreviewModal');
    const sandModal = document.getElementById('codeSandboxModal');
    if (fileModal) fileModal.classList.toggle('split-docked', isSplitStudioActive);
    if (sandModal) sandModal.classList.toggle('split-docked', isSplitStudioActive);

    const label = isSplitStudioActive ? "⛶ Full View" : "◧ Split View";
    const docBtn = document.getElementById('splitDocBtn');
    const sandBtn = document.getElementById('splitSandboxBtn');
    if (docBtn) docBtn.innerText = label;
    if (sandBtn) sandBtn.innerText = label;

    if (isSplitStudioActive) {
        document.getElementById('appSidebar')?.classList.add('collapsed');
        const inputEl = document.getElementById('textInput');
        if (inputEl) inputEl.focus();
    }
}

function getActiveStudioDraftContext() {
    const fileModal = document.getElementById('filePreviewModal');
    if (fileModal && fileModal.style.display === 'flex' && isSplitStudioActive && lastCompiledFileCache && !lastCompiledFileCache.isPreRenderedAuditHtml) {
        return `ACTIVE DOCUMENT TYPE: .${lastCompiledFileCache.ext.toUpperCase()} | TOPIC: ${lastCompiledFileCache.topic} | THEME: ${lastCompiledFileCache.styleTheme}\nDRAFT:\n${lastCompiledFileCache.rawContent}`;
    }
    const sandModal = document.getElementById('codeSandboxModal');
    if (sandModal && sandModal.style.display === 'flex' && isSplitStudioActive && currentSandboxCodeObj && currentSandboxCodeObj.code) {
        return `ACTIVE CODE SANDBOX FILE: ${currentSandboxCodeObj.filename} (${currentSandboxCodeObj.lang})\nReturn the COMPLETE updated single-file HTML5 app inside \`\`\`html ... \`\`\`.\nCODE:\n${currentSandboxCodeObj.code}`;
    }
    return null;
}

function syncFormatDropdownForFileType(ext, currentLayout) {
    const sel = document.getElementById('previewLayoutFormatSelect');
    if (!sel) return currentLayout;
    const list = FILE_TYPE_FORMATS[ext] || FILE_TYPE_FORMATS.pdf;
    sel.innerHTML = list.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    const valid = list.some(o => o.value === currentLayout) ? currentLayout : list[0].value;
    sel.value = valid;
    return valid;
}

// ==========================================================
// INTENT, CLEAN TITLE & THEME PARSERS
// ==========================================================
function extractClientTopicAndStyle(rawStr) {
    let s = (rawStr || "").trim();
    const low = s.toLowerCase();
    let styleTheme = "cyber_dark";
    let layoutFormat = "infographic";

    if (/\b(movie\s*theat(?:er|re)|cinema|imax|stage\s*production|movie\s*theme|film\s*theme|theat(?:er|re)\s*background|movie\s*background|velvet)\b/i.test(low)) {
        styleTheme = "movie_theater";
        layoutFormat = "movie_theater";
    } else {
        const themeRules = [
            { rx: /\b(movie|cinema|theater|theatre|film|hollywood)\b/i, theme: "movie_theater" },
            { rx: /\b(black|obsidian|onyx|pitch\s*black|dark\s*mode|dark)\b/i, theme: "black" },
            { rx: /\b(white|light|minimal|clean\s*white|bright)\b/i, theme: "light" },
            { rx: /\b(blue|navy|ocean|sky|cyan)\b/i, theme: "blue" },
            { rx: /\b(purple|violet|neon|cyberpunk|magenta)\b/i, theme: "purple" },
            { rx: /\b(green|emerald|forest|matrix)\b/i, theme: "green" },
            { rx: /\b(red|crimson|ruby)\b/i, theme: "red" },
            { rx: /\b(gold|amber|yellow|warm)\b/i, theme: "gold" }
        ];
        for (const item of themeRules) {
            if (item.rx.test(low) && /(background|bg|theme|style|color|design|template|mode|format|with a |in a )/i.test(low)) {
                styleTheme = item.theme;
                if (item.theme === "movie_theater") layoutFormat = "movie_theater";
                break;
            }
        }
    }

    if (/\b(letter|application)\b/i.test(low)) layoutFormat = "docx_letter";
    else if (/\b(resume|cv)\b/i.test(low)) layoutFormat = "docx_resume";
    else if (/\b(minutes|meeting)\b/i.test(low)) layoutFormat = "docx_minutes";
    else if (/\b(assignment|essay)\b/i.test(low)) layoutFormat = "docx_assignment";
    else if (/\b(marksheet|grades|marks)\b/i.test(low)) layoutFormat = "xlsx_marksheet";
    else if (/\b(tracker|timetable|schedule)\b/i.test(low)) layoutFormat = "xlsx_tracker";
    else if (/\b(exam\s*paper|question\s*paper|cbse\s*test)\b/i.test(low)) layoutFormat = "exam_paper";
    else if (/\b(lab\s*manual|practical\s*file|experiment)\b/i.test(low)) layoutFormat = "lab_manual";
    else if (/\b(academic|ncert|textbook)\b/i.test(low)) layoutFormat = "academic";
    else if (/\b(magazine|editorial)\b/i.test(low)) layoutFormat = "magazine";
    else if (/\b(minimal|clean\s*memo)\b/i.test(low)) layoutFormat = "minimal";

    s = s.replace(/\s*(?:,|and|with|using|by)?\s*\b(?:take|use|add|generate|pick|create|make\s+up|fill)\s+(?:any\s+|some\s+|random\s+|sample\s+|dummy\s+|fake\s+|your\s+|ur\s+)*data(?:\s+on\s+(?:your|ur)\s+own)?\b.*$/i, '').trim();
    s = s.replace(/\s*\bon\s+(?:your|ur)\s+own\b.*$/i, '').trim();
    s = s.replace(/\s+(?:with|in|using|having|featuring|and)\s+(?:a\s+|an\s+|the\s+)?(?:[a-z]+\s+){0,3}(?:background|bg|theme|style|color|design|template|layout|mode|format)\b.*$/i, '').trim();
    s = s.replace(/\s+(?:with|in|having|for|of)\s+\d+\s+(?:slides|pages|sections|points|bullets)\b.*$/i, '').trim();
    s = s.replace(/^(a|an|the|topic|subject)\s+/i, '').replace(/[.,;:-]+$/, '').trim();
    return { cleanTopic: s || "KIZA Document", styleTheme, layoutFormat };
}

function detectClientSideFileIntent(rawCmd) {
    const clean = rawCmd.trim();
    const low = clean.toLowerCase();
    if (low.startsWith("/")) return null;

    const extPatterns = [
        { regex: /\b(xlsx|xls|excel\s*sheet|excel\s*workbook|excel|spreadsheet)\b/i, ext: 'xlsx' },
        { regex: /\b(docx|doc|word\s*file|word\s*document|word\s*doc)\b/i, ext: 'docx' },
        { regex: /\b(pptx|ppt|powerpoint|slide\s*deck|presentation|slides)\b/i, ext: 'pptx' },
        { regex: /\b(pdf|dossier|\d+\s*pages)\b/i, ext: 'pdf' },
        { regex: /\b(csv)\b/i, ext: 'csv' }
    ];
    for (const item of extPatterns) {
        if (item.regex.test(low)) {
            const m = clean.match(/\b(?:on|about|for|titled|called|regarding|of)\s+(.+)$/i);
            let rawTopic = m ? m[1].trim() : clean.replace(/\b(please|can\s+you|could\s+you|help\s+me|help\s+with|gen\w*|mak\w*|creat\w*|buld\w*|build\w*|export\w*|download\w*|writ\w*|prepar\w*|give\s+me|send\s+me|convert|to|into|clean|native|multi-sheet|a|an|the|file|report|pptx|ppt|powerpoint|slide\s*deck|presentation|slides|pdf|dossier|docx|doc|word|xlsx|xls|excel|workbook|spreadsheet|csv|with\s+formulas)\b/gi, ' ').replace(/\s+/g, ' ').trim();
            const parsed = extractClientTopicAndStyle(rawCmd);
            const topicParsed = extractClientTopicAndStyle(rawTopic);
            return {
                ext: item.ext,
                topic: topicParsed.cleanTopic,
                styleTheme: parsed.styleTheme,
                layoutFormat: parsed.layoutFormat,
                fullRawTopic: rawTopic
            };
        }
    }
    return null;
}

// ==========================================================
// MULTI-FILE ATTACHMENT READERS (VIDEO, .PDF, .DOCX, .XLSX, OCR)
// ==========================================================
function analyzeImageVisualTelemetry(imgEl, filename) {
    try {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        let rSum = 0, gSum = 0, bSum = 0, brightSum = 0;
        const pixels = 64 * 64;
        for (let i = 0; i < data.length; i += 4) {
            rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
            brightSum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const brightness = Math.round((brightSum / pixels / 255) * 100);
        const tone = brightness > 65 ? "Bright/Light-themed" : (brightness < 35 ? "Dark/Futuristic-themed" : "Balanced contrast");
        return `Image File Name: '${filename}' (${imgEl.naturalWidth}x${imgEl.naturalHeight}px, ${tone}, Dominant RGB(${Math.round(rSum / pixels)},${Math.round(gSum / pixels)},${Math.round(bSum / pixels)}))`;
    } catch (e) {
        return `Image File Name: '${filename}'`;
    }
}

async function extractTextFromUploadedPDF(file) {
    if (typeof pdfjsLib === "undefined") return "PDF attached (PDF.js loading).";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, 15);
    let extracted = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
        extracted.push(`PAGE ${pageNum}:\n${pageText}`);
    }
    const fullText = extracted.join("\n\n").slice(0, 5000);
    lastUploadedDocumentContext = fullText;
    lastAttachedFileTopic = (file.name || "Uploaded_PDF").replace(/\.pdf$/i, '');
    kizaContinuityState = {
        ...kizaContinuityState,
        type: "pdf",
        docExt: "pdf",
        title: lastAttachedFileTopic,
        docRawContent: fullText,
        docBlueprint: extractDocumentFormatBlueprint(fullText, "pdf", lastAttachedFileTopic)
    };
    return fullText;
}

async function extractTextFromUploadedDOCX(file) {
    if (typeof mammoth === "undefined") return "Word document attached.";
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = (result.value || "").trim().slice(0, 5000);
    lastUploadedDocumentContext = rawText;
    lastAttachedFileTopic = (file.name || "Word_Document").replace(/\.(docx|doc)$/i, '');
    kizaContinuityState = {
        ...kizaContinuityState,
        type: "docx",
        docExt: "docx",
        title: lastAttachedFileTopic,
        docRawContent: rawText,
        docBlueprint: extractDocumentFormatBlueprint(rawText, "docx", lastAttachedFileTopic)
    };
    return rawText;
}

async function extractTextFromUploadedXLSX(file) {
    if (typeof XLSX === "undefined") return "Excel workbook attached.";
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    let outBlocks = [];
    workbook.SheetNames.slice(0, 4).forEach(sheetName => {
        const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        outBlocks.push(`SHEET: ${sheetName}\n${csvText}`);
    });
    const combined = outBlocks.join("\n\n").slice(0, 5000);
    lastUploadedDocumentContext = combined;
    lastAttachedFileTopic = (file.name || "Excel_Sheet").replace(/\.(xlsx|xls)$/i, '');
    kizaContinuityState = {
        ...kizaContinuityState,
        type: "xlsx",
        docExt: "xlsx",
        title: lastAttachedFileTopic,
        docRawContent: combined,
        docBlueprint: extractDocumentFormatBlueprint(combined, "xlsx", lastAttachedFileTopic)
    };
    return combined;
}

function processAttachedImageFileObject(file, customName = null) {
    if (!file) return;
    if (typeof playTacticalSFX === "function") playTacticalSFX("sonar");
    attachedImageName = customName || file.name || "attached_file";
    lastAttachedFileTopic = attachedImageName.replace(/\.[a-z0-9]+$/i, '');
    const lowName = attachedImageName.toLowerCase();
    const thumbEl = document.getElementById('attachmentThumb');
    const docIconEl = document.getElementById('attachmentDocIcon');

    // Video attachment reader (extracts keyframe + metadata for continuity editing & style cloning)
    if (/\.(mp4|webm|mov|m4v)$/i.test(lowName) || file.type.startsWith("video/")) {
        isScanningAttachment = true; attachedImageBase64 = null;
        if (thumbEl) thumbEl.style.display = "block";
        if (docIconEl) docIconEl.style.display = "none";
        document.getElementById('attachmentName').innerText = `🎬 ${attachedImageName}`;
        document.getElementById('attachmentOcrStatus').innerText = "🎞️ Extracting video keyframe & format metadata...";
        document.getElementById('attachmentPreviewBar').style.display = "flex";
        attachmentScanPromise = new Promise((resolveScan) => {
            const vidUrl = URL.createObjectURL(file);
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.preload = "auto";
            const finish = (frameUrl, metaObj) => {
                URL.revokeObjectURL(vidUrl);
                attachedImageBase64 = frameUrl;
                if (frameUrl && thumbEl) thumbEl.src = frameUrl;
                kizaContinuityState = {
                    ...kizaContinuityState,
                    type: "video",
                    title: lastAttachedFileTopic,
                    imageBase64: frameUrl,
                    videoMeta: metaObj,
                    lastPrompt: `Uploaded video '${attachedImageName}' (${metaObj.duration}s, ${metaObj.width}x${metaObj.height})`
                };
                attachedImageExtractedContext = `[ATTACHED VIDEO METADATA (${attachedImageName}): Duration=${metaObj.duration}s | Resolution=${metaObj.width}x${metaObj.height} | Keyframe extracted for visual style & continuity editing]`;
                document.getElementById('attachmentOcrStatus').innerText = `✓ Video ready (${metaObj.duration}s • ${metaObj.width}x${metaObj.height})!`;
                isScanningAttachment = false;
                resolveScan();
            };
            const safetyTimer = setTimeout(() => finish(null, { duration: 5, width: 1280, height: 720 }), 5000);
            v.onloadeddata = () => {
                v.currentTime = Math.min(0.4, (v.duration || 1) / 3);
            };
            v.onseeked = () => {
                clearTimeout(safetyTimer);
                let frame = null;
                try {
                    const c = document.createElement('canvas');
                    const maxW = 720, sc = Math.min(1, maxW / (v.videoWidth || 720));
                    c.width = Math.round((v.videoWidth || 720) * sc);
                    c.height = Math.round((v.videoHeight || 405) * sc);
                    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
                    frame = c.toDataURL('image/jpeg', 0.82);
                } catch (e) {}
                finish(frame, { duration: Math.round(v.duration || 5), width: v.videoWidth || 1280, height: v.videoHeight || 720 });
            };
            v.onerror = () => { clearTimeout(safetyTimer); finish(null, { duration: 5, width: 1280, height: 720 }); };
            v.src = vidUrl;
        });
        return;
    }

    if (lowName.endsWith(".pdf") || file.type === "application/pdf") {
        isScanningAttachment = true; attachedImageBase64 = null;
        if (thumbEl) thumbEl.style.display = "none";
        if (docIconEl) { docIconEl.style.display = "inline-block"; docIconEl.innerText = "📕"; }
        document.getElementById('attachmentName').innerText = `📎 ${attachedImageName}`;
        document.getElementById('attachmentOcrStatus').innerText = "📖 Extracting pages & structure from PDF...";
        document.getElementById('attachmentPreviewBar').style.display = "flex";
        attachmentScanPromise = (async () => {
            try {
                const pdfText = await extractTextFromUploadedPDF(file);
                attachedImageExtractedContext = `[ATTACHED DOCUMENT CONTENT (${attachedImageName}):\n${pdfText}]`;
                document.getElementById('attachmentOcrStatus').innerText = `✓ PDF ready (${pdfText.length} chars)!`;
            } catch (e) {
                attachedImageExtractedContext = `[ATTACHED DOCUMENT CONTENT (${attachedImageName}): PDF attached]`;
                document.getElementById('attachmentOcrStatus').innerText = "✓ PDF ready!";
            }
            isScanningAttachment = false;
        })();
        return;
    }

    if (lowName.endsWith(".docx") || lowName.endsWith(".doc")) {
        isScanningAttachment = true; attachedImageBase64 = null;
        if (thumbEl) thumbEl.style.display = "none";
        if (docIconEl) { docIconEl.style.display = "inline-block"; docIconEl.innerText = "📘"; }
        document.getElementById('attachmentName').innerText = `📎 ${attachedImageName}`;
        document.getElementById('attachmentOcrStatus').innerText = "📘 Reading Word (.docx) paragraphs...";
        document.getElementById('attachmentPreviewBar').style.display = "flex";
        attachmentScanPromise = (async () => {
            try {
                const docText = await extractTextFromUploadedDOCX(file);
                attachedImageExtractedContext = `[ATTACHED WORD DOCUMENT (${attachedImageName}):\n${docText}]`;
                document.getElementById('attachmentOcrStatus').innerText = `✓ Word Doc loaded (${docText.length} chars)!`;
            } catch (e) {
                attachedImageExtractedContext = `[ATTACHED WORD DOCUMENT (${attachedImageName})]`;
                document.getElementById('attachmentOcrStatus').innerText = "✓ Word Doc ready!";
            }
            isScanningAttachment = false;
        })();
        return;
    }

    if (lowName.endsWith(".xlsx") || lowName.endsWith(".xls")) {
        isScanningAttachment = true; attachedImageBase64 = null;
        if (thumbEl) thumbEl.style.display = "none";
        if (docIconEl) { docIconEl.style.display = "inline-block"; docIconEl.innerText = "📗"; }
        document.getElementById('attachmentName').innerText = `📎 ${attachedImageName}`;
        document.getElementById('attachmentOcrStatus').innerText = "📗 Parsing Excel (.xlsx) sheets & cells...";
        document.getElementById('attachmentPreviewBar').style.display = "flex";
        attachmentScanPromise = (async () => {
            try {
                const xlsText = await extractTextFromUploadedXLSX(file);
                attachedImageExtractedContext = `[ATTACHED EXCEL WORKBOOK (${attachedImageName}):\n${xlsText}]`;
                document.getElementById('attachmentOcrStatus').innerText = "✓ Excel Workbook loaded!";
            } catch (e) {
                attachedImageExtractedContext = `[ATTACHED EXCEL WORKBOOK (${attachedImageName})]`;
                document.getElementById('attachmentOcrStatus').innerText = "✓ Excel Workbook ready!";
            }
            isScanningAttachment = false;
        })();
        return;
    }

    if (/\.(txt|csv|py|js|html|css|json|md|sql|c|cpp)$/i.test(lowName) || file.type.startsWith("text/")) {
        isScanningAttachment = true; attachedImageBase64 = null;
        if (thumbEl) thumbEl.style.display = "none";
        if (docIconEl) { docIconEl.style.display = "inline-block"; docIconEl.innerText = lowName.endsWith(".py") ? "🐍" : (lowName.endsWith(".csv") ? "📊" : "📄"); }
        document.getElementById('attachmentName').innerText = `📎 ${attachedImageName}`;
        document.getElementById('attachmentOcrStatus').innerText = "🔍 Reading file contents...";
        document.getElementById('attachmentPreviewBar').style.display = "flex";
        attachmentScanPromise = new Promise((resolveScan) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const rawTxt = String(e.target.result || "").slice(0, 4800);
                const extType = lowName.endsWith(".csv") ? "csv" : "txt";
                lastUploadedDocumentContext = rawTxt;
                kizaContinuityState = {
                    ...kizaContinuityState,
                    type: extType,
                    docExt: extType,
                    title: lastAttachedFileTopic,
                    docRawContent: rawTxt,
                    docBlueprint: extractDocumentFormatBlueprint(rawTxt, extType, lastAttachedFileTopic)
                };
                attachedImageExtractedContext = `[ATTACHED DOCUMENT CONTENT (${attachedImageName}):\n${rawTxt}]`;
                document.getElementById('attachmentOcrStatus').innerText = `✓ File loaded (${rawTxt.length} chars)!`;
                isScanningAttachment = false;
                resolveScan();
            };
            reader.onerror = () => { isScanningAttachment = false; resolveScan(); };
            reader.readAsText(file);
        });
        return;
    }

    isScanningAttachment = true;
    if (thumbEl) thumbEl.style.display = "block";
    if (docIconEl) docIconEl.style.display = "none";
    attachmentScanPromise = new Promise((resolveScan) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const maxDim = 1024;
                let w = img.naturalWidth || 640, h = img.naturalHeight || 480;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
                    else { w = Math.round(w * (maxDim / h)); h = maxDim; }
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                attachedImageBase64 = canvas.toDataURL('image/jpeg', 0.86);
                kizaContinuityState = {
                    ...kizaContinuityState,
                    type: "image",
                    title: lastAttachedFileTopic,
                    imageBase64: attachedImageBase64,
                    lastPrompt: `Uploaded image '${attachedImageName}'`
                };
                document.getElementById('attachmentThumb').src = attachedImageBase64;
                document.getElementById('attachmentName').innerText = `📎 ${attachedImageName}`;
                document.getElementById('attachmentOcrStatus').innerText = "🔍 Scanning image & handwriting OCR...";
                document.getElementById('attachmentPreviewBar').style.display = "flex";

                const visualMeta = analyzeImageVisualTelemetry(img, attachedImageName);
                attachedImageExtractedContext = `[ATTACHED IMAGE TELEMETRY: ${visualMeta}]`;

                if (typeof Tesseract !== "undefined") {
                    try {
                        const ocrResult = await Promise.race([
                            Tesseract.recognize(attachedImageBase64, 'eng'),
                            new Promise((_, rej) => setTimeout(() => rej(new Error("OCR timeout")), 5000))
                        ]);
                        const extractedText = (ocrResult?.data?.text || "").replace(/\s+/g, ' ').trim();
                        if (extractedText && extractedText.length > 1) {
                            attachedImageExtractedContext = `[ATTACHED IMAGE TELEMETRY: ${visualMeta} | VISIBLE TEXT / HANDWRITING IN IMAGE (OCR): "${extractedText.slice(0, 1200)}"]`;
                            document.getElementById('attachmentOcrStatus').innerText = "✓ Image & handwriting ready!";
                        } else {
                            document.getElementById('attachmentOcrStatus').innerText = "✓ Image ready!";
                        }
                    } catch (ocrErr) {
                        document.getElementById('attachmentOcrStatus').innerText = "✓ Image ready!";
                    }
                } else {
                    document.getElementById('attachmentOcrStatus').innerText = "✓ Image ready!";
                }
                isScanningAttachment = false;
                resolveScan();
            };
            img.onerror = () => { isScanningAttachment = false; resolveScan(); };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function handleImageAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;
    processAttachedImageFileObject(file, file.name);
}

function clearImageAttachment() {
    attachedImageBase64 = null;
    attachedImageName = "";
    attachedImageExtractedContext = "";
    isScanningAttachment = false;
    attachmentScanPromise = null;
    const inp = document.getElementById('imageUploadInput');
    if (inp) inp.value = "";
    const bar = document.getElementById('attachmentPreviewBar');
    if (bar) bar.style.display = "none";
}

function triggerAttachmentQuickAction(promptStr) {
    if (!attachedImageBase64 && !attachedImageExtractedContext) return;
    document.getElementById('textInput').value = promptStr;
    submitCommand();
}

function convertHandwrittenPhotoToCleanPDF() {
    if (!attachedImageBase64 && !attachedImageExtractedContext) {
        showNotification("Attach Photo First", "Attach or paste a photo of your handwritten notebook page first!", true, { skipStore: true });
        return;
    }
    const cleanTitle = (lastAttachedFileTopic || "Handwritten Study Notes").replace(/[_-]+/g, ' ');
    document.getElementById('textInput').value = `Make a clean typed PDF report on ${cleanTitle} by transcribing all handwritten text, cleaning up grammar, and organizing into clear study sections.`;
    submitCommand();
}

// ==========================================================
// SMART WIKIMEDIA + THEME-MATCHED TOPIC VECTOR GRAPHICS ENGINE
// ==========================================================
function generateCustomHighResArtworkDataUrl(queryStr, themeKey = "cyber_dark", idxHint = 0) {
    const cleanLabel = sanitizePdfText(queryStr || "Visual Diagram").replace(/[^a-zA-Z0-9\s,&:.-]/g, '').trim();
    const shortTitle = (cleanLabel.length > 52 ? cleanLabel.slice(0, 49) + "..." : cleanLabel).toUpperCase();
    const qLow = cleanLabel.toLowerCase();
    const pal = THEME_PALETTES[themeKey] || THEME_PALETTES.cyber_dark;
    const isDark = (themeKey === "black" || themeKey === "movie_theater");

    const bg1 = pal.pdfCardBg;
    const bg2 = isDark ? pal.pdfPageBg : "#ffffff";
    const primary = pal.pdfAccent;
    const secondary = pal.pdfSec;
    const gridCol = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)";
    const titleCol = pal.pdfText;
    const subCol = pal.pdfMuted;

    let artSvg = "";
    if (/lock|cyber|security|encrypt|binary|shield/.test(qLow) || idxHint % 5 === 0) {
        artSvg = `
            <g stroke="${primary}" stroke-width="2.5" fill="none">
                <path d="M360 44 L415 68 V116 C415 152 390 176 360 188 C330 176 305 152 305 116 V68 Z" fill="${primary}" fill-opacity="0.12"/>
                <rect x="340" y="106" width="40" height="34" rx="5" fill="${bg2}"/>
                <path d="M348 106 V94 A12 12 0 0 1 372 94 V106"/>
                <circle cx="360" cy="123" r="4" fill="${secondary}" stroke="none"/>
                <line x1="160" y1="115" x2="290" y2="115" stroke-dasharray="6 6" opacity="0.6"/>
                <line x1="430" y1="115" x2="560" y2="115" stroke-dasharray="6 6" opacity="0.6"/>
                <circle cx="160" cy="115" r="7" fill="${secondary}"/><circle cx="560" cy="115" r="7" fill="${secondary}"/>
            </g>`;
    } else if (/algorithm|chip|processor|flow|circuit|compute|satellite|panel/.test(qLow) || idxHint % 5 === 1) {
        artSvg = `
            <g stroke="${primary}" stroke-width="2.5" fill="none">
                <rect x="308" y="64" width="104" height="104" rx="14" fill="${primary}" fill-opacity="0.12"/>
                <rect x="330" y="86" width="60" height="60" rx="8" stroke="${secondary}"/>
                <path d="M265 92 H308 M265 116 H308 M265 140 H308 M412 92 H455 M412 116 H455 M412 140 H455 M340 36 V64 M380 36 V64 M340 168 V196 M380 168 V196"/>
                <circle cx="260" cy="92" r="5" fill="${secondary}"/><circle cx="460" cy="140" r="5" fill="${secondary}"/>
                <path d="M344 116 L356 128 L378 102" stroke="${primary}" stroke-width="3.5"/>
            </g>`;
    } else if (/neural|brain|ai|network|learning|model|aurora|wind/.test(qLow) || idxHint % 5 === 2) {
        artSvg = `
            <g stroke="${primary}" stroke-width="2" fill="none">
                <line x1="230" y1="72" x2="360" y2="62" opacity="0.55"/><line x1="230" y1="72" x2="360" y2="116" opacity="0.55"/><line x1="230" y1="72" x2="360" y2="170" opacity="0.55"/>
                <line x1="230" y1="158" x2="360" y2="62" opacity="0.55"/><line x1="230" y1="158" x2="360" y2="116" opacity="0.55"/><line x1="230" y1="158" x2="360" y2="170" opacity="0.55"/>
                <line x1="360" y1="62" x2="490" y2="88" opacity="0.55"/><line x1="360" y1="116" x2="490" y2="88" opacity="0.55"/><line x1="360" y1="170" x2="490" y2="88" opacity="0.55"/>
                <line x1="360" y1="62" x2="490" y2="146" opacity="0.55"/><line x1="360" y1="116" x2="490" y2="146" opacity="0.55"/><line x1="360" y1="170" x2="490" y2="146" opacity="0.55"/>
                <circle cx="230" cy="72" r="11" fill="${bg2}" stroke="${primary}" stroke-width="3"/><circle cx="230" cy="158" r="11" fill="${bg2}" stroke="${primary}" stroke-width="3"/>
                <circle cx="360" cy="62" r="12" fill="${secondary}"/><circle cx="360" cy="116" r="14" fill="${primary}"/><circle cx="360" cy="170" r="12" fill="${secondary}"/>
                <circle cx="490" cy="88" r="11" fill="${bg2}" stroke="${primary}" stroke-width="3"/><circle cx="490" cy="146" r="11" fill="${bg2}" stroke="${primary}" stroke-width="3"/>
            </g>`;
    } else if (/chart|data|stat|graph|analytics|finance|market|center/.test(qLow) || idxHint % 5 === 3) {
        artSvg = `
            <g>
                <line x1="210" y1="174" x2="510" y2="174" stroke="${subCol}" stroke-width="2"/>
                <rect x="236" y="124" width="38" height="50" rx="5" fill="${primary}" fill-opacity="0.55"/>
                <rect x="296" y="96" width="38" height="78" rx="5" fill="${primary}" fill-opacity="0.75"/>
                <rect x="356" y="108" width="38" height="66" rx="5" fill="${secondary}" fill-opacity="0.75"/>
                <rect x="416" y="64" width="38" height="110" rx="5" fill="${primary}"/>
                <polyline points="255,112 315,84 375,96 435,50 485,68" fill="none" stroke="${secondary}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="435" cy="50" r="6" fill="${secondary}"/>
            </g>`;
    } else {
        artSvg = `
            <g stroke="${primary}" stroke-width="2.4" fill="none">
                <ellipse cx="360" cy="116" rx="135" ry="44" transform="rotate(-18 360 116)" opacity="0.85"/>
                <ellipse cx="360" cy="116" rx="135" ry="44" transform="rotate(18 360 116)" stroke="${secondary}" opacity="0.85"/>
                <ellipse cx="360" cy="116" rx="44" ry="86" opacity="0.55"/>
                <circle cx="360" cy="116" r="18" fill="${primary}" fill-opacity="0.9" stroke="none"/>
                <circle cx="476" cy="82" r="7" fill="${secondary}" stroke="none"/>
                <circle cx="246" cy="148" r="7" fill="${primary}" stroke="none"/>
            </g>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="260" viewBox="0 0 720 260">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/>
            </linearGradient>
            <pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${gridCol}" stroke-width="1"/>
            </pattern>
        </defs>
        <rect width="720" height="260" rx="12" fill="url(#bg)"/>
        <rect width="720" height="260" rx="12" fill="url(#g)"/>
        ${artSvg}
        <text x="360" y="220" font-family="Inter, Arial, sans-serif" font-size="13.5" font-weight="800" fill="${titleCol}" text-anchor="middle" letter-spacing="1.2">${shortTitle}</text>
        <text x="360" y="240" font-family="monospace" font-size="10" fill="${subCol}" text-anchor="middle" letter-spacing="1.5">CONCEPT FIGURE • KIZA STUDIO</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

async function fetchTopicWebImageUrl(queryStr) {
    if (webImageCache[queryStr]) return webImageCache[queryStr];
    const firstPhrase = String(queryStr || "science")
        .split(/[,;|]/)[0]
        .replace(/\b(theatre|theater|stage|lighting|set|costume|production|poster)\b/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const shortQuery = firstPhrase.split(' ').slice(0, 2).join(' ') || "technology";

    try {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(shortQuery + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url&iiurlwidth=680&format=json&origin=*`;
        const res = await fetch(commonsUrl);
        const data = await res.json();
        if (data && data.query && data.query.pages) {
            for (const p of Object.values(data.query.pages)) {
                const thumbUrl = p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url;
                if (thumbUrl && /\.(jpg|jpeg|png|webp)$/i.test(thumbUrl)) {
                    webImageCache[queryStr] = { url: thumbUrl, isPhoto: true };
                    return webImageCache[queryStr];
                }
            }
        }
    } catch (e) {}

    webImageCache[queryStr] = { url: null, isPhoto: false };
    return webImageCache[queryStr];
}

async function preloadAllQueryImagesInContent(rawContent) {
    const regex = /(?:IMAGE_QUERY|FIGURE):\s*([^\n]+)/gi;
    let m;
    const queries = [];
    while ((m = regex.exec(rawContent)) !== null) queries.push(m[1].trim());
    await Promise.all(queries.map(q => fetchTopicWebImageUrl(q)));
}

function getVisualAssetSync(queryStr, themeKey, idxHint) {
    const cached = webImageCache[queryStr];
    if (cached && cached.isPhoto && cached.url) {
        return { url: cached.url, isPhoto: true };
    }
    return { url: generateCustomHighResArtworkDataUrl(queryStr, themeKey, idxHint), isPhoto: false };
}

// ==========================================================
// 1. THEME-REACTIVE PUBLICATION PDF DOSSIER RENDERER
// ==========================================================
function buildDecorativeReportHTML(topicTitle, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark", layoutFormat = "infographic") {
    const titleOverride = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
    const cleanTopic = sanitizePdfText(titleOverride ? titleOverride[1].trim() : parsedTopic.cleanTopic).toUpperCase();

    const isMovieMode = (styleTheme === "movie_theater" || layoutFormat === "movie_theater");
    const activeTheme = isMovieMode ? "movie_theater" : (THEME_PALETTES[styleTheme] ? styleTheme : parsedTopic.styleTheme);
    const activeFormat = isMovieMode ? "movie_theater" : (layoutFormat || "infographic");
    const pal = THEME_PALETTES[activeTheme] || THEME_PALETTES.cyber_dark;
    const isDarkDoc = (activeTheme === "black" || activeTheme === "movie_theater");

    const rawLines = stripSlashesFromText(rawContent)
        .replace(/\[GENERATE_FILE:[^\]]+\]/g, '')
        .replace(/\[GENERATING_PDF:[^\]]+\]/g, '')
        .replace(/AI_INTRO:[^\n]*/gi, '')
        .replace(/\*\*/g, '')
        .split('\n');

    let subtitle = isMovieMode ? "IMAX & Stage Production Dossier" : "Executive Briefing & Technical Analysis";
    const kpis = [], charts = [], tableRows = [], bodyBlocks = [];
    let tableHeaders = [], lastSeenHeading = cleanTopic.toLowerCase(), imgCounter = 0;

    rawLines.forEach(line => {
        const t = line.trim();
        if (!t || /^(LAYOUT|SHEET|NOTES|TITLE)\s*:/i.test(t)) return;

        if (/^(SLIDE|PAGE)\s*(\d+)\s*:\s*(.*)$/i.test(t)) {
            const m = t.match(/^(SLIDE|PAGE)\s*(\d+)\s*:\s*(.*)$/i);
            const pNum = parseInt(m[2], 10);
            const pTitle = sanitizePdfText((m[3] || "").trim());
            bodyBlocks.push({ type: 'page_break', pageNum: pNum, title: pTitle });
            if (pTitle) lastSeenHeading = pTitle.toLowerCase();
            return;
        }

        if (/^SUBTITLE:/i.test(t)) {
            subtitle = sanitizePdfText(t.replace(/^SUBTITLE:\s*/i, '').trim());
        } else if (/^(?:IMAGE_QUERY|FIGURE):/i.test(t)) {
            const q = sanitizePdfText(t.replace(/^(?:IMAGE_QUERY|FIGURE):\s*/i, '').trim());
            const asset = getVisualAssetSync(q, activeTheme, imgCounter++);
            const prevBlock = bodyBlocks[bodyBlocks.length - 1];
            if (!prevBlock || prevBlock.type !== 'web_image' || prevBlock.query !== q) {
                bodyBlocks.push({ type: 'web_image', query: q, url: asset.url, isPhoto: asset.isPhoto, idx: imgCounter });
            }
        } else if (/^KPI:/i.test(t)) {
            const parts = t.replace(/^KPI:\s*/i, '').split('|').map(s => sanitizePdfText(s.trim()));
            if (parts.length >= 2) kpis.push({ label: parts[0], value: parts[1], sub: parts[2] || "Key Metric" });
        } else if (/^CHART:/i.test(t)) {
            const parts = t.replace(/^CHART:\s*/i, '').split('|').map(s => sanitizePdfText(s.trim()));
            if (parts.length >= 2) {
                let pct = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
                charts.push({ label: parts[0], pct: isNaN(pct) ? 80 : Math.min(100, Math.max(5, pct)) });
            }
        } else if (/^TABLE_HEADER:/i.test(t)) {
            tableHeaders = t.replace(/^TABLE_HEADER:\s*/i, '').split('|').map(s => sanitizePdfText(s.trim()));
        } else if (/^TABLE_ROW:/i.test(t)) {
            tableRows.push(t.replace(/^TABLE_ROW:\s*/i, '').split('|').map(s => sanitizePdfText(s.trim())));
        } else if (/^SECTION:/i.test(t)) {
            const secTxt = sanitizePdfText(t.replace(/^SECTION:\s*/i, '').trim());
            if (secTxt && secTxt.toLowerCase() !== lastSeenHeading) {
                bodyBlocks.push({ type: 'section', text: secTxt });
                lastSeenHeading = secTxt.toLowerCase();
            }
        } else if (/^(?:CALLOUT|KEY CONCEPT):/i.test(t)) {
            bodyBlocks.push({ type: 'callout', text: sanitizePdfText(t.replace(/^(?:CALLOUT|KEY CONCEPT):\s*/i, '').trim()) });
        } else if (/^[-•*◆]\s+/.test(t)) {
            bodyBlocks.push({ type: 'bullet', text: sanitizePdfText(t.replace(/^[-•*◆]\s+/, '').trim()) });
        } else if (t.toLowerCase() !== lastSeenHeading) {
            bodyBlocks.push({ type: 'p', text: sanitizePdfText(t) });
        }
    });

    const kpiHtml = kpis.length > 0 ? `
        <div class="kiza-avoid-break" style="display:grid; grid-template-columns:repeat(${Math.min(3, kpis.length)}, minmax(0, 1fr)); gap:12px; margin-bottom:16px; page-break-inside:avoid; break-inside:avoid;">
            ${kpis.slice(0, 3).map((k, idx) => {
                const c = idx % 2 === 0 ? pal.pdfAccent : pal.pdfSec;
                return `<div style="background:${pal.pdfCardBg}; border:1px solid ${c}55; border-top:3.5px solid ${c}; border-radius:9px; padding:10px 12px;">
                    <div style="font-size:9.5px; font-weight:800; color:${pal.pdfMuted}; text-transform:uppercase; letter-spacing:0.8px;">${escapeHtml(k.label)}</div>
                    <div style="font-size:17px; font-weight:800; color:${c}; margin:4px 0 2px 0; line-height:1.2;">${escapeHtml(k.value)}</div>
                    <div style="font-size:10px; color:${pal.pdfMuted}; line-height:1.3;">${escapeHtml(k.sub)}</div>
                </div>`;
            }).join('')}
        </div>` : '';

    const chartHtml = charts.length > 0 ? `
        <div class="kiza-avoid-break" style="background:${pal.pdfCardBg}; border:1.5px solid ${pal.pdfAccent}66; border-radius:10px; padding:13px 15px; margin:12px 0; page-break-inside:avoid; break-inside:avoid;">
            <div style="font-size:10.5px; font-weight:800; color:${pal.pdfAccent}; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:9px;">DATA & BENCHMARK METRICS</div>
            ${charts.map((ch, idx) => {
                const barBg = idx % 2 === 0 ? `linear-gradient(90deg, ${pal.pdfAccent}, ${pal.pdfSec})` : `linear-gradient(90deg, ${pal.pdfSec}, ${pal.pdfAccent})`;
                return `<div style="margin-bottom:7px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:${pal.pdfText}; margin-bottom:3px;"><span>${escapeHtml(ch.label)}</span><span style="color:${pal.pdfAccent};">${ch.pct}%</span></div>
                    <div style="width:100%; height:9px; background:${isDarkDoc ? '#1e293b' : '#e2e8f0'}; border-radius:999px; overflow:hidden;"><div style="width:${ch.pct}%; height:100%; background:${barBg}; border-radius:999px;"></div></div>
                </div>`;
            }).join('')}
        </div>` : '';

    const tableHtml = tableRows.length > 0 ? `
        <table class="kiza-avoid-break" style="width:100%; border-collapse:collapse; margin:12px 0; font-size:11px; border:1px solid ${pal.pdfAccent}55; page-break-inside:avoid; break-inside:avoid;">
            <thead><tr style="background:${pal.pdfBar}; color:#ffffff; text-align:left;">
                ${(tableHeaders.length ? tableHeaders : ['Dimension', 'Current', 'Target']).map(h => `<th style="padding:7px 10px; font-weight:700; color:#ffffff;">${escapeHtml(h)}</th>`).join('')}
            </tr></thead>
            <tbody>${tableRows.map((row, rIdx) => `
                <tr style="background:${isDarkDoc ? (rIdx % 2 === 0 ? '#111827' : '#1e293b') : (rIdx % 2 === 0 ? '#ffffff' : pal.pdfCardBg)}; border-bottom:1px solid ${pal.pdfAccent}22; page-break-inside:avoid;">
                    ${row.map((cell, cIdx) => `<td style="padding:7px 10px; color:${pal.pdfText}; ${cIdx === 0 ? 'font-weight:700; color:' + pal.pdfAccent + ';' : ''}">${escapeHtml(cell)}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
        </table>` : '';

    const imgBlockHtml = embeddedImgBase64 ? `
        <div class="kiza-avoid-break" style="margin:10px 0 14px 0; text-align:center; background:${pal.pdfCardBg}; padding:10px; border-radius:10px; border:1px dashed ${pal.pdfAccent}; page-break-inside:avoid;">
            <img src="${embeddedImgBase64}" crossorigin="anonymous" style="max-width:80%; max-height:185px; border-radius:6px;">
            <div style="font-size:9.5px; color:${pal.pdfMuted}; margin-top:5px; font-weight:600;">ATTACHED REFERENCE FIGURE</div>
        </div>` : '';

    let renderedBody = "";
    bodyBlocks.forEach(b => {
        if (b.type === 'page_break') {
            const breakClass = b.pageNum > 1 ? 'kiza-page-break' : '';
            const breakCss = b.pageNum > 1 ? "page-break-before: always; break-before: page; margin-top: 4px;" : "margin-top: 2px;";
            renderedBody += `
                <div class="${breakClass}" style="${breakCss} margin-bottom:11px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; background:${pal.pdfBar}; color:#ffffff; padding:8px 14px; border-radius:8px; border-left:4px solid ${isMovieMode ? '#fbbf24' : '#ffffff'};">
                        <span style="font-size:12px; font-weight:800; letter-spacing:0.4px; line-height:1.3;">${escapeHtml(b.title ? b.title.toUpperCase() : ('SECTION ' + b.pageNum))}</span>
                        <span style="font-size:10px; font-family:monospace; font-weight:700; color:#ffffff; background:rgba(0,0,0,0.32); padding:3px 9px; border-radius:99px; white-space:nowrap; flex-shrink:0;">PAGE ${b.pageNum}</span>
                    </div>
                </div>`;
        } else if (b.type === 'web_image') {
            const fallbackUrl = generateCustomHighResArtworkDataUrl(b.query, activeTheme, b.idx);
            const captionRow = b.isPhoto ? `<div style="font-size:9.5px; color:${pal.pdfMuted}; margin-top:5px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;">Figure ${b.idx}: ${escapeHtml(b.query)}</div>` : '';
            renderedBody += `
                <div class="kiza-avoid-break" style="margin:8px 0 11px 0; text-align:center; background:${pal.pdfCardBg}; padding:8px; border-radius:10px; border:1px solid ${pal.pdfAccent}44; page-break-inside:avoid; break-inside:avoid;">
                    <img src="${b.url}" crossorigin="anonymous" style="width:100%; max-width:500px; height:164px; object-fit:${b.isPhoto ? 'cover' : 'contain'}; border-radius:6px; display:block; margin:0 auto;" onerror="this.src='${fallbackUrl}'; this.style.objectFit='contain';">
                    ${captionRow}
                </div>`;
        } else if (b.type === 'section') {
            renderedBody += `<h2 style="font-size:13px; font-weight:800; color:${pal.pdfAccent}; text-transform:uppercase; letter-spacing:0.6px; border-left:3.5px solid ${pal.pdfAccent}; padding-left:9px; margin:12px 0 6px 0; page-break-after:avoid;">${escapeHtml(b.text)}</h2>`;
        } else if (b.type === 'callout') {
            renderedBody += `<div class="kiza-avoid-break" style="background:${pal.pdfCardBg}; border-left:3.5px solid ${pal.pdfAccent}; padding:8px 12px; border-radius:0 7px 7px 0; margin:9px 0; font-size:11.3px; font-weight:600; color:${pal.pdfText}; line-height:1.45; page-break-inside:avoid; break-inside:avoid;"><b style="color:${pal.pdfAccent};">KEY INSIGHT:</b> ${escapeHtml(b.text)}</div>`;
        } else if (b.type === 'bullet') {
            renderedBody += `<div style="display:flex; align-items:flex-start; gap:7px; margin:3.5px 0 3.5px 6px; font-size:11.5px; color:${pal.pdfText}; line-height:1.45;"><span style="color:${pal.pdfAccent}; font-weight:800;">◆</span><span>${escapeHtml(b.text)}</span></div>`;
        } else {
            renderedBody += `<p style="font-size:11.5px; color:${pal.pdfText}; margin:5.5px 0; line-height:1.52; text-align:justify;">${escapeHtml(b.text)}</p>`;
        }
    });

    const closingBlock = `
        <div class="kiza-avoid-break" style="page-break-inside:avoid; break-inside:avoid;">
            ${chartHtml}
            ${tableHtml}
            <div style="margin-top:12px; border-top:1.5px solid ${pal.pdfAccent}55; padding-top:7px; font-size:9px; color:${pal.pdfMuted}; display:flex; justify-content:space-between; font-family:monospace; page-break-before:avoid; break-before:avoid;">
                <span>KIZA PRO STUDIO • ${activeFormat.toUpperCase()} (${activeTheme.toUpperCase()})</span>
                <span>PREPARED BY ${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())} • ${new Date().toLocaleDateString('en-IN')}</span>
            </div>
        </div>`;

    let headerBannerHTML = "";
    if (isMovieMode) {
        headerBannerHTML = `<div class="kiza-avoid-break" style="background:${pal.pdfHero}; border:2px solid #fbbf24; color:#fffbeb; padding:18px 22px; border-radius:12px; margin-bottom:14px; text-align:center;"><div style="font-size:9.5px; font-weight:900; color:#fbbf24; letter-spacing:2.5px;">★ KIZA CINEMA STAGE EDITION ★</div><h1 style="margin:6px 0 4px 0; font-size:21px; font-weight:900; color:#ffffff; line-height:1.2;">${escapeHtml(cleanTopic)}</h1><div style="font-size:11px; color:#fde68a; font-style:italic;">${escapeHtml(subtitle)}</div><div style="margin-top:7px; font-size:9.5px; font-family:monospace; color:#fca5a5;">AUTHOR: ${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())} • ${new Date().toLocaleDateString('en-IN')}</div></div>`;
    } else if (activeFormat === "exam_paper") {
        headerBannerHTML = `<div class="kiza-avoid-break" style="border:2px solid ${pal.pdfAccent}; padding:14px 18px; margin-bottom:14px; text-align:center; background:${pal.pdfCardBg}; color:${pal.pdfText}; border-radius:8px;"><div style="font-size:10px; font-weight:800; letter-spacing:1.4px; color:${pal.pdfAccent};">CBSE PATTERN ASSESSMENT • QUESTION PAPER</div><h1 style="margin:5px 0; font-size:19px; font-weight:800;">${escapeHtml(cleanTopic)}</h1><div style="display:flex; justify-content:space-between; font-size:10.5px; font-weight:700; border-top:1px solid ${pal.pdfAccent}44; padding-top:7px; margin-top:7px;"><span>Time: 2 Hours</span><span>Candidate: ${escapeHtml(cleanDisplayNameOnly(currentUser))}</span><span>Max Marks: 40</span></div></div>`;
    } else if (activeFormat === "lab_manual") {
        headerBannerHTML = `<div class="kiza-avoid-break" style="border-left:5px solid ${pal.pdfAccent}; background:${pal.pdfCardBg}; color:${pal.pdfText}; padding:14px 18px; border-radius:0 8px 8px 0; margin-bottom:14px; border:1px solid ${pal.pdfAccent}33; border-left-width:5px;"><div style="font-size:9.5px; font-weight:800; letter-spacing:1.4px; color:${pal.pdfAccent};">PRACTICAL LAB RECORD</div><h1 style="margin:4px 0; font-size:19px; font-weight:800; color:${pal.pdfText};">${escapeHtml(cleanTopic)}</h1><div style="font-size:10.5px; color:${pal.pdfMuted};">Student: <b>${escapeHtml(cleanDisplayNameOnly(currentUser))}</b> • Date: ${new Date().toLocaleDateString('en-IN')}</div></div>`;
    } else if (activeFormat === "academic") {
        headerBannerHTML = `<div class="kiza-avoid-break" style="border-bottom:3px double ${pal.pdfAccent}; padding-bottom:12px; margin-bottom:14px;"><div style="font-size:9.5px; font-weight:800; color:${pal.pdfAccent}; letter-spacing:1.4px;">ACADEMIC STUDY MODULE • NCERT & CBSE</div><h1 style="margin:4px 0; font-size:20px; font-weight:800; color:${pal.pdfText}; font-family:Georgia, serif;">${escapeHtml(cleanTopic)}</h1><div style="font-size:11px; font-style:italic; color:${pal.pdfMuted};">${escapeHtml(subtitle)}</div></div>`;
    } else if (activeFormat === "magazine") {
        headerBannerHTML = `<div class="kiza-avoid-break" style="border-top:5px solid ${pal.pdfAccent}; border-bottom:2px solid ${pal.pdfAccent}; padding:14px 0; margin-bottom:14px; text-align:center;"><div style="font-size:9.5px; font-weight:800; letter-spacing:2.5px; color:${pal.pdfAccent};">KIZA EDITORIAL FEATURE</div><h1 style="margin:5px 0; font-size:21px; font-family:Georgia, serif; color:${pal.pdfText}; line-height:1.2;">${escapeHtml(cleanTopic)}</h1><div style="font-size:11px; color:${pal.pdfMuted};">${escapeHtml(subtitle)} • By ${escapeHtml(cleanDisplayNameOnly(currentUser))}</div></div>`;
    } else {
        headerBannerHTML = `<div class="kiza-avoid-break" style="background:${pal.pdfHero}; color:#ffffff; padding:17px 21px; border-radius:12px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; gap:12px;"><div style="flex:1;"><div style="font-size:9.5px; font-weight:700; color:rgba(255,255,255,0.8); letter-spacing:1.8px; text-transform:uppercase;">KIZA INTELLIGENCE DOSSIER</div><h1 style="margin:5px 0 3px 0; font-size:19.5px; font-weight:800; color:#ffffff; line-height:1.2;">${escapeHtml(cleanTopic)}</h1><div style="font-size:11px; color:rgba(255,255,255,0.85);">${escapeHtml(subtitle)}</div></div><div style="text-align:right; font-family:monospace; font-size:9.5px; color:rgba(255,255,255,0.8); border-left:1px solid rgba(255,255,255,0.25); padding-left:12px; white-space:nowrap;"><div style="color:#ffffff; font-weight:bold;">${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())}</div><div>${new Date().toLocaleDateString('en-IN')}</div></div></div>`;
    }

    const outerShellStyle = isMovieMode
        ? `font-family:'Inter', Arial, sans-serif; color:#fffbeb; background:linear-gradient(90deg, #5c0a14 0%, #881322 3%, #3b040a 6%, #0d0205 9%, #0d0205 91%, #3b040a 94%, #881322 97%, #5c0a14 100%); padding:18px 34px; border-radius:10px; border:2.5px solid #fbbf24; box-sizing:border-box;`
        : `font-family:'Inter', Arial, sans-serif; color:${pal.pdfText}; background:${pal.pdfPageBg}; padding:18px 24px; border-radius:8px; box-sizing:border-box;`;

    return {
        cleanTopic, subtitle, kpis, charts, tableHeaders, tableRows, activeTheme,
        html: `<div style="${outerShellStyle}">${headerBannerHTML}${kpiHtml}${imgBlockHtml}${renderedBody}${closingBlock}</div>`
    };
}

// ==========================================================
// 2. TRUE NATIVE OPENXML WORD (.DOCX) PREVIEW & EXPORTER (docx.js)
// ==========================================================
function parseStructuredWordBlocks(topicTitle, rawContent) {
    const titleOverride = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
    const finalTitle = sanitizePdfText(titleOverride ? titleOverride[1].trim() : parsedTopic.cleanTopic);

    const lines = stripSlashesFromText(rawContent)
        .replace(/\[GENERATE_FILE:[^\]]+\]/g, '')
        .replace(/AI_INTRO:[^\n]*/gi, '')
        .replace(/\*\*/g, '')
        .split('\n');

    let subtitle = "";
    const blocks = [];
    let activeTable = null;

    lines.forEach(raw => {
        const t = raw.trim();
        if (!t || /^(KPI|CHART|IMAGE_QUERY|FIGURE|LAYOUT|SHEET|NOTES|TITLE):/i.test(t)) return;

        if (/^TABLE_HEADER:/i.test(t)) {
            const headers = t.replace(/^TABLE_HEADER:\s*/i, '').split('|').map(x => sanitizePdfText(x.trim()));
            activeTable = { type: 'table', headers, rows: [] };
            blocks.push(activeTable);
            return;
        }
        if (/^TABLE_ROW:/i.test(t)) {
            const cols = t.replace(/^TABLE_ROW:\s*/i, '').split('|').map(x => sanitizePdfText(x.trim()));
            if (!activeTable) {
                activeTable = { type: 'table', headers: cols.map((_, i) => `Column ${i + 1}`), rows: [] };
                blocks.push(activeTable);
            }
            activeTable.rows.push(cols);
            return;
        }
        activeTable = null;

        if (/^SUBTITLE:/i.test(t)) {
            subtitle = sanitizePdfText(t.replace(/^SUBTITLE:\s*/i, '').trim());
        } else if (/^(SECTION|PAGE|SLIDE)\s*\d*\s*:/i.test(t)) {
            blocks.push({ type: 'heading', text: sanitizePdfText(t.replace(/^(SECTION|PAGE|SLIDE)\s*\d*\s*:\s*/i, '').trim()) });
        } else if (/^CALLOUT:/i.test(t)) {
            blocks.push({ type: 'callout', text: sanitizePdfText(t.replace(/^CALLOUT:\s*/i, '').trim()) });
        } else if (/^[-•*◆]\s+/.test(t)) {
            blocks.push({ type: 'bullet', text: sanitizePdfText(t.replace(/^[-•*◆]\s+/, '').trim()) });
        } else {
            blocks.push({ type: 'p', text: sanitizePdfText(t) });
        }
    });

    return { title: finalTitle, subtitle, blocks };
}

function buildWordDocumentHTML(topicTitle, rawContent, layoutFormat = "docx_report") {
    const docData = parseStructuredWordBlocks(topicTitle, rawContent);
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const author = cleanDisplayNameOnly(currentUser);

    const bodyHtml = docData.blocks.map(b => {
        if (b.type === 'heading') return `<h2 style="color:#1e3a8a; border-bottom:1.5px solid #cbd5e1; padding-bottom:4px; margin-top:18px; font-size:15px;">${escapeHtml(b.text)}</h2>`;
        if (b.type === 'bullet') return `<div style="margin:4px 0 4px 16px;">• ${escapeHtml(b.text)}</div>`;
        if (b.type === 'callout') return `<div style="background:#eff6ff; border-left:4px solid #2563eb; padding:9px 13px; margin:10px 0; font-size:12.5px;"><b>Key Note:</b> ${escapeHtml(b.text)}</div>`;
        if (b.type === 'table') {
            return `<table style="width:100%; border-collapse:collapse; margin:14px 0; font-size:12px; border:1px solid #cbd5e1;">
                <thead><tr style="background:#1e3a8a; color:#fff;">${b.headers.map(h => `<th style="padding:7px 10px; text-align:left; border:1px solid #1e3a8a;">${escapeHtml(h)}</th>`).join('')}</tr></thead>
                <tbody>${b.rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">${b.headers.map((_, ci) => `<td style="padding:7px 10px; border:1px solid #cbd5e1;">${escapeHtml(r[ci] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
        }
        return `<p style="margin:8px 0; line-height:1.65;">${escapeHtml(b.text)}</p>`;
    }).join('');

    if (layoutFormat === "docx_letter") {
        return `<div style="background:#ffffff; color:#0f172a; padding:36px 42px; font-family:'Georgia', serif; max-width:740px; margin:0 auto; border:1px solid #cbd5e1;">
            <div style="text-align:right; font-size:12px; color:#475569; margin-bottom:18px;">${today}</div>
            <div style="font-size:13px; margin-bottom:16px;"><b>From:</b> ${escapeHtml(author)}<br><b>Subject:</b> ${escapeHtml(docData.title)}</div>
            <div style="font-size:13px;">${bodyHtml}</div>
            <div style="margin-top:26px; font-size:13px;">Sincerely,<br><b>${escapeHtml(author)}</b></div>
        </div>`;
    }
    if (layoutFormat === "docx_resume") {
        return `<div style="background:#ffffff; color:#0f172a; padding:32px 38px; font-family:'Inter', sans-serif; border-top:6px solid #0284c7;">
            <h1 style="margin:0; font-size:24px; color:#0f172a;">${escapeHtml(author.toUpperCase())}</h1>
            <div style="font-size:12px; color:#0284c7; font-weight:700; margin-bottom:16px;">${escapeHtml(docData.title)}</div>
            <div style="font-size:12.5px;">${bodyHtml}</div>
        </div>`;
    }
    if (layoutFormat === "docx_minutes") {
        return `<div style="background:#ffffff; color:#0f172a; padding:30px 36px; font-family:'Inter', sans-serif;">
            <div style="background:#f1f5f9; padding:12px 16px; border-left:4px solid #4f46e5; margin-bottom:16px;">
                <div style="font-size:11px; font-weight:800; color:#4f46e5;">MEETING MINUTES (.DOCX)</div>
                <h2 style="margin:4px 0 2px 0;">${escapeHtml(docData.title)}</h2>
                <div style="font-size:11.5px; color:#475569;">Date: ${today} • Recorded by: ${escapeHtml(author)}</div>
            </div>
            <div style="font-size:12.5px;">${bodyHtml}</div>
        </div>`;
    }
    return `<div style="background:#ffffff; color:#0f172a; padding:34px 40px; font-family:'Calibri', 'Inter', sans-serif; border:1px solid #cbd5e1;">
        <div style="border-bottom:2px solid #1e3a8a; padding-bottom:10px; margin-bottom:18px;">
            <div style="font-size:10px; font-weight:800; color:#1e3a8a; letter-spacing:1.2px;">${layoutFormat === 'docx_assignment' ? 'ACADEMIC ASSIGNMENT (NATIVE .DOCX)' : 'EXECUTIVE WORD DOCUMENT (NATIVE .DOCX)'}</div>
            <h1 style="margin:5px 0 2px 0; font-size:22px;">${escapeHtml(docData.title)}</h1>
            ${docData.subtitle ? `<div style="font-size:12px; color:#475569; margin-bottom:4px;">${escapeHtml(docData.subtitle)}</div>` : ''}
            <div style="font-size:11.5px; color:#64748b;">Prepared by ${escapeHtml(author)} • ${today}</div>
        </div>
        <div style="font-size:13px;">${bodyHtml}</div>
    </div>`;
}

async function compileAndDownloadNativeDOCX(topicTitle, rawContent, layoutFormat = "docx_report") {
    const docData = parseStructuredWordBlocks(topicTitle, rawContent);
    const safeTopic = (docData.title || "KIZA_Document").replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
    const author = cleanDisplayNameOnly(currentUser);
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    if (typeof window.docx === "undefined") {
        const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body>${document.getElementById('filePreviewViewport').innerHTML}</body></html>`;
        const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `KIZA_${safeTopic}.docx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        return;
    }

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, Footer, PageNumber } = window.docx;
    const children = [];

    if (layoutFormat === "docx_letter") {
        children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: today, color: "475569", size: 22 })], spacing: { after: 200 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: "From: ", bold: true }), new TextRun(author)] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Subject: ", bold: true }), new TextRun(docData.title)], spacing: { after: 240 } }));
    } else {
        children.push(new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: layoutFormat === "docx_resume" ? author.toUpperCase() : docData.title, bold: true, color: "1E3A8A", size: 42 })],
            spacing: { after: 100 }
        }));
        if (docData.subtitle || layoutFormat === "docx_resume") {
            children.push(new Paragraph({
                children: [new TextRun({ text: layoutFormat === "docx_resume" ? docData.title : docData.subtitle, italics: true, color: "0284C7", size: 24 })],
                spacing: { after: 100 }
            }));
        }
        children.push(new Paragraph({
            children: [new TextRun({ text: `Prepared by ${author} • ${today}`, color: "64748B", size: 20 })],
            spacing: { after: 260 }
        }));
    }

    docData.blocks.forEach(b => {
        if (b.type === 'heading') {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: b.text, bold: true, color: "1E3A8A", size: 28 })], spacing: { before: 240, after: 120 } }));
        } else if (b.type === 'bullet') {
            children.push(new Paragraph({ text: b.text, bullet: { level: 0 }, spacing: { after: 80 } }));
        } else if (b.type === 'callout') {
            children.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: "EFF6FF" }, children: [new TextRun({ text: "Key Note: ", bold: true, color: "1D4ED8" }), new TextRun({ text: b.text, color: "0F172A" })], spacing: { before: 120, after: 140 } }));
        } else if (b.type === 'table' && b.headers.length > 0) {
            const headerRow = new TableRow({
                tableHeader: true,
                children: b.headers.map(h => new TableCell({ shading: { type: ShadingType.CLEAR, fill: "1E3A8A" }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })] })] }))
            });
            const dataRows = b.rows.map((r, rIdx) => new TableRow({
                children: b.headers.map((_, ci) => new TableCell({ shading: rIdx % 2 === 1 ? { type: ShadingType.CLEAR, fill: "F8FAFC" } : undefined, children: [new Paragraph({ children: [new TextRun({ text: String(r[ci] || ""), size: 20 })] })] }))
            }));
            children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }));
            children.push(new Paragraph({ text: "", spacing: { after: 140 } }));
        } else {
            children.push(new Paragraph({ children: [new TextRun({ text: b.text, size: 22 })], spacing: { after: 140 } }));
        }
    });

    if (layoutFormat === "docx_letter") {
        children.push(new Paragraph({ children: [new TextRun("Sincerely,")], spacing: { before: 280 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: author, bold: true })] }));
    }

    const doc = new Document({
        creator: author,
        title: docData.title,
        sections: [{
            properties: {},
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({ text: `KIZA Pro Studio • ${author} • Page `, color: "64748B", size: 18 }),
                            new TextRun({ children: [PageNumber.CURRENT], color: "64748B", size: 18 })
                        ]
                    })]
                })
            },
            children
        }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `KIZA_${safeTopic}.docx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showNotification("📘 Native .DOCX Saved", `Downloaded Microsoft Word file KIZA_${safeTopic}.docx!`, false, { skipStore: true });
}

// ==========================================================
// 3. BOARDROOM MULTI-SHEET EXCEL (.XLSX) WITH LIVE FORMULAS
// ==========================================================
function parseMultiSheetExcelData(topicTitle, rawContent) {
    const lines = stripSlashesFromText(rawContent)
        .replace(/\[GENERATE_FILE:[^\]]+\]/g, '')
        .replace(/AI_INTRO:[^\n]*/gi, '')
        .split('\n');

    const sheets = [];
    let currentSheet = null;
    const ensureSheet = (defaultName = "Sheet_1") => {
        if (!currentSheet) {
            currentSheet = { name: defaultName, headers: [], rows: [] };
            sheets.push(currentSheet);
        }
        return currentSheet;
    };

    lines.forEach(raw => {
        const t = raw.trim();
        if (!t || /^TITLE\s*:/i.test(t)) return;
        if (/^SHEET\s*:/i.test(t)) {
            const sName = t.replace(/^SHEET\s*:\s*/i, '').replace(/[\[\]:*?/\\]/g, '').trim().slice(0, 28) || `Sheet_${sheets.length + 1}`;
            currentSheet = { name: sName, headers: [], rows: [] };
            sheets.push(currentSheet);
        } else if (/^TABLE_HEADER\s*:/i.test(t)) {
            const sh = ensureSheet("Primary_Data");
            sh.headers = t.replace(/^TABLE_HEADER\s*:\s*/i, '').split('|').map(x => sanitizePdfText(x.trim()));
        } else if (/^TABLE_ROW\s*:/i.test(t)) {
            const sh = ensureSheet("Primary_Data");
            sh.rows.push(t.replace(/^TABLE_ROW\s*:\s*/i, '').split('|').map(x => sanitizePdfText(x.trim())));
        }
    });

    const validSheets = sheets.filter(s => s.headers.length > 0 || s.rows.length > 0);
    if (validSheets.length === 0) {
        const parsed = buildDecorativeReportHTML(topicTitle, rawContent);
        if (parsed.charts.length > 0) {
            validSheets.push({ name: "Metrics", headers: ["Category", "Score", "Status"], rows: parsed.charts.map(c => [c.label, String(c.pct), c.pct >= 75 ? "Optimal" : "Standard"]) });
        } else {
            const cleanLines = lines.map(l => l.trim()).filter(Boolean).slice(0, 12);
            validSheets.push({ name: "KIZA_Data", headers: ["Row", "Details", "Status"], rows: cleanLines.map((l, i) => [`Row ${i + 1}`, sanitizePdfText(l), "Verified"]) });
        }
    }
    return validSheets;
}

function evaluateExcelFormulaForPreview(formulaStr, sheets) {
    const m = String(formulaStr || "").trim().match(/^=(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(\s*(?:([A-Za-z0-9_]+)!)?([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)\s*\)$/i);
    if (!m) return null;
    const fn = m[1].toUpperCase();
    const targetSheetName = m[2];
    const colStart = m[3].toUpperCase().charCodeAt(0) - 65;
    const rowStart = Math.max(0, parseInt(m[4], 10) - 2);
    const colEnd = m[5].toUpperCase().charCodeAt(0) - 65;
    const rowEnd = Math.max(0, parseInt(m[6], 10) - 2);

    const sh = targetSheetName ? sheets.find(s => s.name.toLowerCase() === targetSheetName.toLowerCase()) || sheets[0] : sheets[0];
    if (!sh || !sh.rows) return null;

    const nums = [];
    for (let r = rowStart; r <= Math.min(rowEnd, sh.rows.length - 1); r++) {
        for (let c = colStart; c <= colEnd; c++) {
            const raw = String(sh.rows[r]?.[c] ?? "").replace(/[%$,₹,\s]/g, '');
            const val = Number(raw);
            if (raw !== "" && !isNaN(val)) nums.push(val);
        }
    }
    if (!nums.length) return null;

    let res = 0;
    if (fn === "SUM") res = nums.reduce((a, b) => a + b, 0);
    else if (fn === "AVERAGE" || fn === "AVG") res = nums.reduce((a, b) => a + b, 0) / nums.length;
    else if (fn === "MIN") res = Math.min(...nums);
    else if (fn === "MAX") res = Math.max(...nums);
    else if (fn === "COUNT") res = nums.length;

    return Number.isInteger(res) ? res.toLocaleString('en-IN') : Number(res.toFixed(2)).toLocaleString('en-IN');
}

function recalculateExcelPreviewFormulasFromDOM() {
    const tables = Array.from(document.querySelectorAll('#filePreviewViewport table.excel-preview-table'));
    if (!tables.length) return;
    const liveSheets = tables.map(tbl => ({
        name: tbl.getAttribute('data-sheet-name') || "Sheet",
        rows: Array.from(tbl.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()))
    }));
    document.querySelectorAll('#filePreviewViewport td[data-formula]').forEach(td => {
        const val = evaluateExcelFormulaForPreview(td.getAttribute('data-formula'), liveSheets);
        if (val !== null) td.innerText = val;
    });
}

function switchExcelPreviewTab(tabIndex) {
    const panels = document.querySelectorAll('#filePreviewViewport .excel-sheet-panel');
    const btns = document.querySelectorAll('#filePreviewViewport .excel-tab-btn');
    panels.forEach((p, i) => { p.style.display = (tabIndex === -1 || i === tabIndex) ? "block" : "none"; });
    btns.forEach((b) => {
        const isAct = Number(b.getAttribute('data-tab-idx')) === tabIndex;
        b.style.background = isAct ? "#059669" : "#f1f5f9";
        b.style.color = isAct ? "#ffffff" : "#0f172a";
    });
}

function buildExcelSheetPreviewHTML(topicTitle, rawContent, layoutFormat = "xlsx_budget") {
    const titleMatch = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const displayTitle = sanitizePdfText(titleMatch ? titleMatch[1].trim() : extractClientTopicAndStyle(topicTitle).cleanTopic);
    const sheets = parseMultiSheetExcelData(topicTitle, rawContent);

    const headerColors = { xlsx_budget: "#059669", xlsx_marksheet: "#2563eb", xlsx_tracker: "#7c3aed", xlsx_comparison: "#0f766e" };
    const hdrBg = headerColors[layoutFormat] || "#059669";
    const badgeText = {
        xlsx_budget: "💰 FINANCIAL WORKBOOK (=SUM & =AVERAGE)",
        xlsx_marksheet: "🎓 MARKSHEET WORKBOOK (=SUM & =AVERAGE)",
        xlsx_tracker: "📋 TRACKER WORKBOOK",
        xlsx_comparison: "⚖️ COMPARISON WORKBOOK"
    }[layoutFormat] || "📗 MULTI-SHEET EXCEL WORKBOOK";

    const tabButtonsHtml = `
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;" contenteditable="false">
            <button type="button" class="excel-tab-btn" data-tab-idx="-1" onclick="switchExcelPreviewTab(-1)" style="border:1px solid #cbd5e1; background:#059669; color:#fff; font-size:11px; font-weight:700; padding:5px 11px; border-radius:999px; cursor:pointer;">📑 All Tabs (${sheets.length})</button>
            ${sheets.map((sh, i) => `<button type="button" class="excel-tab-btn" data-tab-idx="${i}" onclick="switchExcelPreviewTab(${i})" style="border:1px solid #cbd5e1; background:#f1f5f9; color:#0f172a; font-size:11px; font-weight:700; padding:5px 11px; border-radius:999px; cursor:pointer;">${escapeHtml(sh.name.replace(/_/g, ' '))}</button>`).join('')}
        </div>`;

    const tablesHtml = sheets.map((sh, sIdx) => {
        const hdrs = sh.headers.length ? sh.headers : ["Item", "Value", "Notes"];
        return `
            <div class="excel-sheet-panel" style="margin-bottom:16px;">
                <div contenteditable="false" style="display:inline-block; background:${hdrBg}; color:#ffffff; font-size:11px; font-weight:800; padding:4px 12px; border-radius:8px 8px 0 0; user-select:none;">📑 Tab ${sIdx + 1}: ${escapeHtml(sh.name.replace(/_/g, ' '))}</div>
                <table class="excel-preview-table" data-sheet-name="${escapeHtml(sh.name)}">
                    <thead><tr>${hdrs.map(h => `<th contenteditable="true" spellcheck="false" style="background:${hdrBg}; outline:none;">${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${sh.rows.map(r => `<tr>${hdrs.map((_, cIdx) => {
                        const rawVal = r[cIdx] !== undefined ? String(r[cIdx]).trim() : '';
                        if (rawVal.startsWith('=')) {
                            const computed = evaluateExcelFormulaForPreview(rawVal, sheets);
                            return `<td contenteditable="true" spellcheck="false" data-formula="${escapeHtml(rawVal)}" title="Live Excel Formula: ${escapeHtml(rawVal)}" oninput="this.removeAttribute('data-formula')" style="font-weight:700; color:#047857; background:#ecfdf5; outline:none;">${escapeHtml(computed !== null ? computed : rawVal)}</td>`;
                        }
                        return `<td contenteditable="true" spellcheck="false" oninput="recalculateExcelPreviewFormulasFromDOM()" style="outline:none;">${escapeHtml(rawVal)}</td>`;
                    }).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>`;
    }).join('');

    return `<div contenteditable="false" style="background:#ffffff; padding:20px; border-radius:12px; color:#0f172a; user-select:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid ${hdrBg}; padding-bottom:8px; flex-wrap:wrap; gap:8px;">
            <div>
                <span style="font-size:10px; font-weight:800; color:${hdrBg};">${badgeText} • ${sheets.length} TAB(S) • CLICK ANY CELL TO EDIT</span>
                <h2 contenteditable="true" spellcheck="false" style="margin:3px 0 0 0; font-size:18px; outline:none; user-select:text;">${escapeHtml(displayTitle)}</h2>
            </div>
            <span style="font-size:11px; color:#64748b;">Green cells auto-recalculate live</span>
        </div>
        ${tabButtonsHtml}
        <div style="user-select:text;">${tablesHtml}</div>
    </div>`;
}

function compileAndDownloadXLSX(topicTitle, rawContent) {
    const titleMatch = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const cleanName = titleMatch ? titleMatch[1].trim() : extractClientTopicAndStyle(topicTitle).cleanTopic;
    const safeTopic = (cleanName || "KIZA_Workbook").replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    if (typeof XLSX === "undefined") { triggerTextDownload(`${safeTopic}.csv`, rawContent); return; }

    try {
        const wb = XLSX.utils.book_new();
        const domTables = Array.from(document.querySelectorAll('#filePreviewViewport table.excel-preview-table'));
        const usedNames = new Set();

        const makeUniqueSheetName = (rawName, idx) => {
            let base = String(rawName || `Sheet_${idx + 1}`).replace(/[\[\]:*?/\\]/g, '').trim().slice(0, 28) || `Sheet_${idx + 1}`;
            let finalName = base, n = 2;
            while (usedNames.has(finalName)) { finalName = `${base.slice(0, 25)}_${n++}`; }
            usedNames.add(finalName);
            return finalName;
        };

        const addSheetAoaToBook = (sheetName, aoa) => {
            if (!aoa || aoa.length === 0) return;
            const alreadyHasFormulas = aoa.slice(1).some(r => r.some(cell => cell && typeof cell === "object" && cell.f));
            if (aoa.length >= 3 && !alreadyHasFormulas) {
                const lastDataRow = aoa.length;
                const colCount = aoa[0].length;
                const totalRow = ["TOTAL"], avgRow = ["AVERAGE"];
                let addedAnyFormula = false;
                for (let c = 1; c < colCount; c++) {
                    const colLetter = XLSX.utils.encode_col(c);
                    if (aoa.slice(1).some(r => typeof r[c] === "number")) {
                        totalRow.push({ t: 'n', f: `SUM(${colLetter}2:${colLetter}${lastDataRow})` });
                        avgRow.push({ t: 'n', f: `AVERAGE(${colLetter}2:${colLetter}${lastDataRow})` });
                        addedAnyFormula = true;
                    } else { totalRow.push(""); avgRow.push(""); }
                }
                if (addedAnyFormula) { aoa.push(totalRow); aoa.push(avgRow); }
            }
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = aoa[0].map((_, ci) => ({ wch: Math.min(34, Math.max(14, ...aoa.map(r => String(r[ci]?.f || r[ci] || "").length)) + 4) }));
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        };

        const parseCellForXlsx = (txt, formulaAttr = "") => {
            const fStr = (formulaAttr && formulaAttr.startsWith('=')) ? formulaAttr : (txt.startsWith('=') ? txt : "");
            if (fStr) return { t: 'n', f: fStr.slice(1) };
            const cleanNumStr = txt.replace(/[₹$,%\s,]/g, '');
            const numVal = Number(cleanNumStr);
            if (cleanNumStr !== "" && !isNaN(numVal) && /^[0-9.,%₹$\s-]+$/.test(txt)) return numVal;
            return txt;
        };

        if (domTables.length > 0) {
            domTables.forEach((tbl, idx) => {
                const aoa = [];
                const ths = Array.from(tbl.querySelectorAll('thead th')).map(th => th.innerText.trim());
                if (ths.length) aoa.push(ths);
                tbl.querySelectorAll('tbody tr').forEach(tr => {
                    const tds = Array.from(tr.querySelectorAll('td')).map(td => parseCellForXlsx(td.innerText.trim(), td.getAttribute('data-formula') || ""));
                    if (tds.some(v => v !== "")) aoa.push(tds);
                });
                addSheetAoaToBook(makeUniqueSheetName(tbl.getAttribute('data-sheet-name'), idx), aoa);
            });
        } else {
            const sheets = parseMultiSheetExcelData(topicTitle, rawContent);
            sheets.forEach((sh, idx) => {
                const aoa = [sh.headers.length ? sh.headers : ["Item", "Value", "Notes"]];
                sh.rows.forEach(r => aoa.push(r.map(v => parseCellForXlsx(String(v).trim()))));
                addSheetAoaToBook(makeUniqueSheetName(sh.name, idx), aoa);
            });
        }

        XLSX.writeFile(wb, `KIZA_${safeTopic}.xlsx`);
        showNotification("📗 Multi-Sheet Excel Saved", `Downloaded KIZA_${safeTopic}.xlsx (${wb.SheetNames.length} tabs with live formulas)!`, false, { skipStore: true });
    } catch (e) {
        triggerTextDownload(`${safeTopic}.csv`, rawContent);
    }
}

// ==========================================================
// 4. EXECUTIVE POWERPOINT (.PPTX) STUDIO WITH SPEAKER NOTES
// ==========================================================
function parseSlideBlocksFromContent(rawContent) {
    const cleanBody = stripSlashesFromText(rawContent).replace(/\[GENERATE_FILE:[^\]]+\]/g, '').replace(/AI_INTRO:[^\n]*/gi, '').replace(/\*/g, '').trim();
    const slideRegex = /(?:SLIDE|PAGE)\s*\d+\s*:\s*([^\n]+)\n([\s\S]*?)(?=(?:SLIDE|PAGE)\s*\d+\s*:|$)/gi;
    let match, idx = 0;
    const slides = [];
    while ((match = slideRegex.exec(cleanBody)) !== null) {
        idx++;
        const title = sanitizePdfText(match[1].trim());
        const lines = match[2].trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
        let imageQuery = "", statValue = `0${idx}`, statLabel = "KEY METRIC", notes = "";
        const bullets = [];
        lines.forEach(l => {
            if (/^(LAYOUT|TITLE|SUBTITLE):/i.test(l)) return;
            if (/^IMAGE_QUERY:/i.test(l)) imageQuery = sanitizePdfText(l.replace(/^IMAGE_QUERY:\s*/i, '').trim());
            else if (/^NOTES:/i.test(l)) notes = sanitizePdfText(l.replace(/^NOTES:\s*/i, '').trim());
            else if (/^STAT:/i.test(l)) { const sp = l.replace(/^STAT:\s*/i, '').split('|').map(x => sanitizePdfText(x.trim())); if (sp[0]) statValue = sp[0]; if (sp[1]) statLabel = sp[1]; }
            else bullets.push(sanitizePdfText(l.replace(/^[-•*\d.)\s]+/, '').trim()));
        });
        slides.push({ idx, title, imageQuery, statValue, statLabel, bullets, notes });
    }
    return slides;
}

function buildPPTXSlidePreviewHTML(topicTitle, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark") {
    const titleOverride = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const subOverride = stripSlashesFromText(rawContent).match(/^SUBTITLE\s*:\s*([^\n]+)/im);
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
    const cleanTopic = sanitizePdfText(titleOverride ? titleOverride[1].trim() : parsedTopic.cleanTopic).toUpperCase();
    const activeTheme = THEME_PALETTES[styleTheme] ? styleTheme : parsedTopic.styleTheme;
    const pal = THEME_PALETTES[activeTheme] || THEME_PALETTES.cyber_dark;
    const slides = parseSlideBlocksFromContent(rawContent);

    const slideCards = slides.map(s => {
        const asset = s.imageQuery ? getVisualAssetSync(s.imageQuery, activeTheme, s.idx) : null;
        const rightHTML = asset
            ? `<div style="flex:1; min-width:180px; background:#${pal.cardHex}; border:1.5px solid #${pal.secHex}; border-radius:8px; padding:8px; text-align:center;"><img src="${asset.url}" crossorigin="anonymous" style="width:100%; height:135px; object-fit:${asset.isPhoto ? 'cover' : 'contain'}; border-radius:6px;" onerror="this.src='${generateCustomHighResArtworkDataUrl(s.imageQuery, activeTheme, s.idx)}'">${asset.isPhoto ? `<div style="font-size:9.5px; color:#${pal.subHex}; margin-top:5px; font-family:monospace;">${escapeHtml(s.imageQuery.toUpperCase())}</div>` : ''}</div>`
            : `<div style="flex:1; min-width:130px; background:#${pal.cardHex}; border:2px solid #${pal.secHex}; border-radius:8px; padding:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;"><div style="font-size:26px; font-weight:800; color:#${pal.accentHex};">${escapeHtml(s.statValue)}</div><div style="font-size:10px; font-weight:700; color:#${pal.subHex}; margin-top:4px; font-family:monospace;">${escapeHtml(s.statLabel.toUpperCase())}</div></div>`;
        const notesHTML = s.notes ? `<div style="margin-top:9px; padding-top:7px; border-top:1px dashed #${pal.accentHex}44; font-size:10.5px; color:#${pal.subHex}; font-style:italic;">🎤 Speaker Note: ${escapeHtml(s.notes)}</div>` : '';
        return `<div class="ppt-slide-preview" style="background:#${pal.bgHex}; color:#${pal.textHex}; border:2px solid #${pal.accentHex};"><div style="font-size:10px; color:#${pal.accentHex}; font-family:monospace; margin-bottom:4px;">SLIDE 0${s.idx} • ${activeTheme.toUpperCase()}</div><div style="font-size:18px; font-weight:800; margin-bottom:12px; border-bottom:1px solid #${pal.accentHex}44; padding-bottom:8px;">${escapeHtml(s.title.toUpperCase())}</div><div style="display:flex; gap:14px; align-items:stretch; flex-wrap:wrap;"><div style="flex:2; min-width:220px; background:#${pal.cardHex}; border:1px solid #${pal.accentHex}33; border-radius:8px; padding:12px;">${s.bullets.map(b => `<div style="margin-bottom:7px; font-size:12.5px; display:flex; gap:8px;"><span style="color:#${pal.accentHex};">▸</span><span>${escapeHtml(b)}</span></div>`).join('')}</div>${rightHTML}</div>${notesHTML}</div>`;
    });
    return `<div style="padding:10px;"><div class="ppt-slide-preview" style="background:#${pal.bgHex}; color:#${pal.textHex}; border:2px solid #${pal.accentHex};"><div style="font-size:10px; color:#${pal.accentHex}; font-family:monospace;">COVER SLIDE • ${activeTheme.toUpperCase()}</div><div style="font-size:24px; font-weight:800; margin:10px 0 4px 0;">${escapeHtml(cleanTopic)}</div>${subOverride ? `<div style="font-size:13px; color:#${pal.subHex}; margin-bottom:8px;">${escapeHtml(sanitizePdfText(subOverride[1].trim()))}</div>` : ''}<div style="font-size:11px; color:#${pal.subHex}; font-family:monospace;">Prepared by ${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())} • ${slides.length} Slides</div></div>${slideCards.join('')}</div>`;
}

function compileAndDownloadPPTX(topicTitle, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark") {
    const titleOverride = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const subOverride = stripSlashesFromText(rawContent).match(/^SUBTITLE\s*:\s*([^\n]+)/im);
    const parsed = extractClientTopicAndStyle(topicTitle);
    const cleanTopic = sanitizePdfText(titleOverride ? titleOverride[1].trim() : parsed.cleanTopic).toUpperCase();
    const activeTheme = THEME_PALETTES[styleTheme] ? styleTheme : parsed.styleTheme;
    const pal = THEME_PALETTES[activeTheme] || THEME_PALETTES.cyber_dark;

    if (typeof PptxGenJS === "undefined") { triggerTextDownload(`KIZA_Presentation_${Date.now()}.txt`, rawContent); return; }
    try {
        const pptx = new PptxGenJS();
        pptx.layout = "LAYOUT_16x9"; pptx.author = cleanDisplayNameOnly(currentUser); pptx.title = cleanTopic;

        let titleSlide = pptx.addSlide();
        titleSlide.background = { color: pal.bgHex };
        titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 5.625, fill: { color: pal.accentHex } });
        titleSlide.addText("KIZA EXECUTIVE PRESENTATION", { x: 0.75, y: 1.0, w: 8.5, h: 0.4, fontSize: 11, color: pal.accentHex, bold: true, charSpacing: 3 });
        titleSlide.addText(cleanTopic, { x: 0.75, y: 1.5, w: 8.5, h: 1.6, fontSize: 32, color: pal.textHex, bold: true });
        if (subOverride) titleSlide.addText(sanitizePdfText(subOverride[1].trim()), { x: 0.75, y: 3.15, w: 8.5, h: 0.7, fontSize: 15, color: pal.subHex });
        titleSlide.addText(`Prepared by ${cleanDisplayNameOnly(currentUser)} • ${new Date().toLocaleDateString('en-IN')}`, { x: 0.75, y: 4.85, w: 8.5, h: 0.35, fontSize: 10.5, color: pal.subHex });

        const slides = parseSlideBlocksFromContent(rawContent);
        slides.forEach(s => {
            let slide = pptx.addSlide();
            slide.background = { color: pal.bgHex };
            slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: pal.accentHex } });
            slide.addText(`0${s.idx}  |  ${s.title.toUpperCase()}`, { x: 0.5, y: 0.32, w: 9.0, h: 0.55, fontSize: 20, color: pal.accentHex, bold: true });
            slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.05, w: 6.1, h: 3.9, fill: { color: pal.cardHex }, line: { color: pal.accentHex, pt: 1 } });
            if (s.bullets.length > 0) {
                slide.addText(
                    s.bullets.map(b => ({ text: b, options: { bullet: true, color: pal.textHex, fontSize: 14, breakLine: true, paraSpaceAfter: 10 } })),
                    { x: 0.7, y: 1.25, w: 5.7, h: 3.5, valign: "top" }
                );
            }
            slide.addShape(pptx.ShapeType.roundRect, { x: 6.85, y: 1.05, w: 2.65, h: 3.9, fill: { color: pal.cardHex }, line: { color: pal.secHex, pt: 1.5 } });
            slide.addText(String(s.statValue), { x: 6.95, y: 2.0, w: 2.45, h: 0.9, fontSize: 34, color: pal.accentHex, bold: true, align: "center" });
            slide.addText(String(s.statLabel).toUpperCase(), { x: 6.95, y: 2.95, w: 2.45, h: 0.8, fontSize: 11, color: pal.subHex, bold: true, align: "center" });
            slide.addText(`KIZA Pro Studio • Slide ${s.idx} of ${slides.length}`, { x: 0.5, y: 5.18, w: 9.0, h: 0.3, fontSize: 9, color: pal.subHex, align: "right" });
            if (s.notes) slide.addNotes(s.notes);
        });

        pptx.writeFile({ fileName: `KIZA_${cleanTopic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28)}.pptx` });
        showNotification("📙 PowerPoint Saved", `Downloaded ${slides.length + 1}-slide executive deck with speaker notes!`, false, { skipStore: true });
    } catch (err) {
        triggerTextDownload(`KIZA_Presentation_${Date.now()}.txt`, rawContent);
    }
}

// ==========================================================
// STUDIO MODAL CONTROLLER & CRISP A4 PDF EXPORTER
// ==========================================================
async function prepareAndPreviewUniversalFile(ext, topic, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark", layoutFormat = "infographic") {
    let cleanExt = (ext || "pdf").toLowerCase().trim();
    if (cleanExt === "doc") cleanExt = "docx";
    if (cleanExt === "xls") cleanExt = "xlsx";
    const parsed = extractClientTopicAndStyle(topic);
    const finalTheme = (styleTheme && styleTheme !== "cyber_dark") ? styleTheme : parsed.styleTheme;
    const finalLayout = (finalTheme === "movie_theater" || layoutFormat === "movie_theater") ? "movie_theater" : (layoutFormat || parsed.layoutFormat || "infographic");

    if (cleanExt === "pdf" || cleanExt === "pptx") {
        await preloadAllQueryImagesInContent(rawContent);
    }

    lastCompiledFileCache = {
        ext: cleanExt, topic: parsed.cleanTopic, rawContent, embeddedImgBase64,
        styleTheme: finalTheme, layoutFormat: finalLayout, isPreRenderedAuditHtml: false
    };

    kizaContinuityState = {
        ...kizaContinuityState,
        type: cleanExt,
        docExt: cleanExt,
        title: parsed.cleanTopic,
        docTheme: finalTheme,
        docLayout: finalLayout,
        docRawContent: rawContent,
        docBlueprint: extractDocumentFormatBlueprint(rawContent, cleanExt, parsed.cleanTopic)
    };

    const themeDropdown = document.getElementById('previewThemeSelect');
    if (themeDropdown && Array.from(themeDropdown.options).some(o => o.value === finalTheme)) themeDropdown.value = finalTheme;
    syncFormatDropdownForFileType(cleanExt, finalLayout);
    const expDropdown = document.getElementById('previewExportTypeSelect');
    if (expDropdown && Array.from(expDropdown.options).some(o => o.value === cleanExt)) expDropdown.value = cleanExt;

    if (typeof playTacticalSFX === "function") playTacticalSFX("complete");
    renderInChatVisualFileCard(cleanExt, parsed.cleanTopic, rawContent, embeddedImgBase64, finalTheme, finalLayout);
    openFilePreviewModal();
    showNotification("Studio Ready", `View, edit directly, or switch to Split View for live .${cleanExt.toUpperCase()} edits!`, false, { skipStore: true });
}

function switchPreviewExportFormat(newExt) {
    if (!lastCompiledFileCache) return;
    const cleanExt = newExt.toLowerCase();
    lastCompiledFileCache.ext = cleanExt;
    lastCompiledFileCache.layoutFormat = syncFormatDropdownForFileType(cleanExt, lastCompiledFileCache.layoutFormat);
    if (!lastCompiledFileCache.isPreRenderedAuditHtml) {
        kizaContinuityState.type = cleanExt;
        kizaContinuityState.docExt = cleanExt;
        kizaContinuityState.docLayout = lastCompiledFileCache.layoutFormat;
    }
    openFilePreviewModal();
}

function openAuditOrChatInPreviewStudio(ext, titleStr, rawTextOrHtml, isHtmlPreview = false) {
    lastCompiledFileCache = { ext: ext.toLowerCase(), topic: titleStr, rawContent: rawTextOrHtml, embeddedImgBase64: null, styleTheme: "cyber_dark", layoutFormat: "infographic", isPreRenderedAuditHtml: isHtmlPreview };
    openFilePreviewModal();
}

function changePreviewLayoutOrTheme() {
    if (!lastCompiledFileCache) return;
    lastCompiledFileCache.layoutFormat = document.getElementById('previewLayoutFormatSelect')?.value || "infographic";
    lastCompiledFileCache.styleTheme = document.getElementById('previewThemeSelect')?.value || "cyber_dark";
    if (!lastCompiledFileCache.isPreRenderedAuditHtml) {
        kizaContinuityState.docLayout = lastCompiledFileCache.layoutFormat;
        kizaContinuityState.docTheme = lastCompiledFileCache.styleTheme;
    }
    openFilePreviewModal();
}

function openFilePreviewModal() {
    if (!lastCompiledFileCache) return;
    const { ext, topic, rawContent, embeddedImgBase64, styleTheme, isPreRenderedAuditHtml } = lastCompiledFileCache;
    const layoutFormat = syncFormatDropdownForFileType(ext, lastCompiledFileCache.layoutFormat);
    lastCompiledFileCache.layoutFormat = layoutFormat;

    const titleMatch = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const cleanDisplayTopic = sanitizePdfText(titleMatch ? titleMatch[1].trim() : extractClientTopicAndStyle(topic).cleanTopic);

    const modal = document.getElementById('filePreviewModal');
    document.getElementById('filePreviewModalTitle').innerText = `🎨 KIZA Pro Studio • ${cleanDisplayTopic} (.${ext.toUpperCase()})`;
    document.getElementById('confirmDownloadBtn').innerText = `⬇️ Download .${ext.toUpperCase()}`;
    const expSel = document.getElementById('previewExportTypeSelect');
    if (expSel && Array.from(expSel.options).some(o => o.value === ext)) expSel.value = ext;
    const themeSel = document.getElementById('previewThemeSelect');
    if (themeSel && Array.from(themeSel.options).some(o => o.value === styleTheme)) themeSel.value = styleTheme;

    const viewport = document.getElementById('filePreviewViewport');
    const selectorsBox = document.getElementById('previewLayoutThemeSelectors');
    viewport.spellcheck = false;

    if (isPreRenderedAuditHtml) {
        if (selectorsBox) selectorsBox.style.display = "none";
        viewport.contentEditable = "false";
        viewport.innerHTML = rawContent;
    } else if (ext === "xlsx" || ext === "xls") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.contentEditable = "false";
        viewport.innerHTML = buildExcelSheetPreviewHTML(cleanDisplayTopic, rawContent, layoutFormat);
    } else if (ext === "docx" || ext === "doc") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.contentEditable = "true";
        viewport.innerHTML = buildWordDocumentHTML(cleanDisplayTopic, rawContent, layoutFormat);
    } else if (ext === "pptx" || ext === "ppt") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.contentEditable = "true";
        viewport.innerHTML = buildPPTXSlidePreviewHTML(cleanDisplayTopic, rawContent, embeddedImgBase64, styleTheme);
    } else if (ext === "pdf") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.contentEditable = "true";
        viewport.innerHTML = buildDecorativeReportHTML(cleanDisplayTopic, rawContent, embeddedImgBase64, styleTheme, layoutFormat || "infographic").html;
    } else {
        if (selectorsBox) selectorsBox.style.display = "none";
        viewport.contentEditable = "true";
        const cleanBody = sanitizePdfText(stripSlashesFromText(rawContent).replace(/\[GENERATE_FILE:[^\]]+\]/g, '').replace(/AI_INTRO:[^\n]*/gi, '').trim());
        viewport.innerHTML = `<pre style="background:#0f172a; color:#f8fafc; padding:18px; border-radius:10px; overflow-x:auto; font-family:'JetBrains Mono', monospace; font-size:12px;">${escapeHtml(cleanBody)}</pre>`;
    }
    renderMathInElementSafe(viewport);
    modal.classList.toggle('split-docked', isSplitStudioActive);
    modal.style.display = "flex";
}

function closeFilePreviewModal() {
    document.getElementById('filePreviewModal').style.display = "none";
    if (isSplitStudioActive && document.getElementById('codeSandboxModal')?.style.display !== 'flex') {
        toggleSplitStudioMode(false);
    }
}

async function confirmAndDownloadPreviewedFile() {
    if (!lastCompiledFileCache) return;
    const { ext, topic, rawContent, embeddedImgBase64, styleTheme, layoutFormat } = lastCompiledFileCache;
    const cleanExt = (ext || "pdf").toLowerCase().trim();
    const titleMatch = stripSlashesFromText(rawContent).match(/^TITLE\s*:\s*([^\n]+)/im);
    const finalName = titleMatch ? titleMatch[1].trim() : topic;
    const safeTopic = (finalName || "KIZA_Export").replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);

    if (cleanExt === "xlsx" || cleanExt === "xls") { compileAndDownloadXLSX(topic, rawContent); return; }
    if (cleanExt === "doc" || cleanExt === "docx") { await compileAndDownloadNativeDOCX(topic, rawContent, layoutFormat); return; }
    if (cleanExt === "pptx" || cleanExt === "ppt") { compileAndDownloadPPTX(topic, rawContent, embeddedImgBase64, styleTheme); return; }
    if (cleanExt === "pdf") {
        const viewportEl = document.getElementById('filePreviewViewport');
        const targetNode = viewportEl.firstElementChild || viewportEl;
        const opt = {
            margin: [8, 8, 8, 8],
            filename: `KIZA_${safeTopic}.pdf`,
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.kiza-page-break', avoid: ['.kiza-avoid-break', 'tr', 'table'] }
        };
        showNotification("Downloading PDF", `Saving crisp A4 PDF ${opt.filename}...`, false, { skipStore: true });
        html2pdf().set(opt).from(targetNode).save();
        return;
    }
    const cleanBody = sanitizePdfText(stripSlashesFromText(rawContent).replace(/\[GENERATE_FILE:[^\]]+\]/g, '').replace(/AI_INTRO:[^\n]*/gi, '').trim());
    triggerTextDownload(`KIZA_${safeTopic}.${cleanExt}`, cleanBody);
    showNotification("File Downloaded", `Saved KIZA_${safeTopic}.${cleanExt}`, false, { skipStore: true });
}

function renderInChatVisualFileCard(ext, topic, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark", layoutFormat = "infographic") {
    const parsed = buildDecorativeReportHTML(topic, rawContent, embeddedImgBase64, styleTheme, layoutFormat);
    const logBox = document.getElementById('actionLog');
    const card = document.createElement('div');
    card.style.cssText = "background:var(--card-bg); border:1.5px solid var(--accent-primary); border-radius:14px; padding:14px; margin-top:6px; white-space:normal;";
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--card-border); padding-bottom:8px; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <div>
                <span style="font-size:10.5px; font-weight:700; color:var(--accent-primary); background:var(--chip-bg); padding:3px 9px; border-radius:6px;">🎨 ${ext.toUpperCase()} Ready</span>
                <div style="font-weight:700; font-size:13.5px; margin-top:5px;">${escapeHtml(parsed.cleanTopic)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="chip-btn" style="width:auto; padding:6px 11px; font-size:11px;" onclick="openFilePreviewModal()">👁️ View & Edit</button>
                <button type="button" class="chip-btn" style="width:auto; padding:6px 11px; font-size:11px;" onclick="prefillInput('Copy this file format and make a new one on ')">📋 Copy Format</button>
                <button type="button" class="chip-btn" style="width:auto; padding:6px 11px; font-size:11px; border-color:var(--accent-primary); color:var(--accent-primary);" onclick="openFilePreviewModal(); toggleSplitStudioMode(true);">◧ Split View</button>
                <button type="button" class="send-btn" style="padding:6px 13px; font-size:11px;" onclick="confirmAndDownloadPreviewedFile()">⬇️ Download .${ext.toUpperCase()}</button>
            </div>
        </div>
        <div style="font-size:11.5px; color:var(--text-muted);">Edit in place (e.g. "edit page 2"), copy this exact format to a new topic, or open Split View!</div>
    `;
    logBox.appendChild(card);
    logBox.scrollTop = logBox.scrollHeight;
}

// ==========================================================
// CODE SANDBOX, KATEX, MERMAID, CHART.JS, QUIZ & EXPORTS
// ==========================================================
function renderMathInElementSafe(el) {
    if (!el || typeof renderMathInElement !== "function") return;
    try {
        renderMathInElement(el, {
            delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
            ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "b"],
            throwOnError: false
        });
    } catch (e) {}
}

async function extractAndRenderMermaidBlocks(rawText) {
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)(?:```|$)/gi;
    let match;
    const logBox = document.getElementById('actionLog');
    while ((match = mermaidRegex.exec(rawText)) !== null) {
        const graphCode = match[1].trim();
        if (!graphCode) continue;
        const card = document.createElement('div');
        card.className = "mermaid-diagram-card";
        const diagId = "mermaid_svg_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><span style="font-size:12px; font-weight:700; color:var(--accent-primary);">🔀 Architecture & Flowchart Diagram</span><button type="button" class="chip-btn" style="width:auto; padding:3px 10px; font-size:10.5px;" onclick="navigator.clipboard.writeText(${JSON.stringify(graphCode)}); showNotification('Copied', 'Mermaid syntax copied!', false, {skipStore:true});">📋 Copy</button></div><div class="mermaid-svg-container" id="${diagId}_wrap">Rendering diagram...</div>`;
        logBox.appendChild(card);
        logBox.scrollTop = logBox.scrollHeight;
        if (typeof mermaid !== "undefined") {
            try {
                const { svg } = await mermaid.render(diagId, graphCode);
                const wrapEl = document.getElementById(`${diagId}_wrap`);
                if (wrapEl) wrapEl.innerHTML = svg;
            } catch (err) {
                const wrapEl = document.getElementById(`${diagId}_wrap`);
                if (wrapEl) wrapEl.innerHTML = `<pre style="color:#0f172a; font-size:11.5px; margin:0;">${escapeHtml(graphCode)}</pre>`;
            }
        }
    }
}

function extractAndRenderChartBlocks(rawText) {
    if (typeof Chart === "undefined") return;
    const chartRegex = /\[CHART_DATA\]([\s\S]*?)\[\/CHART_DATA\]/gi;
    let match;
    const logBox = document.getElementById('actionLog');
    while ((match = chartRegex.exec(rawText)) !== null) {
        try {
            const cfg = JSON.parse(match[1].trim());
            if (!cfg || !Array.isArray(cfg.labels) || !Array.isArray(cfg.values)) continue;
            const chartId = "kiza_chart_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
            const card = document.createElement('div');
            card.className = "chart-widget-card";
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;"><span style="font-size:12.5px; font-weight:800; color:var(--accent-primary);">📊 ${escapeHtml(cfg.title || 'Interactive Data Visualization')}</span><div style="display:flex; gap:5px;"><button type="button" class="chip-btn" style="width:auto; padding:2px 9px; font-size:10px;" onclick="switchChartWidgetType('${chartId}', 'bar')">📊 Bar</button><button type="button" class="chip-btn" style="width:auto; padding:2px 9px; font-size:10px;" onclick="switchChartWidgetType('${chartId}', 'line')">📈 Line</button><button type="button" class="chip-btn" style="width:auto; padding:2px 9px; font-size:10px;" onclick="switchChartWidgetType('${chartId}', 'pie')">🥧 Pie</button></div></div><div style="position:relative; width:100%; max-height:250px; display:flex; justify-content:center;"><canvas id="${chartId}"></canvas></div>`;
            logBox.appendChild(card);
            logBox.scrollTop = logBox.scrollHeight;
            const ctx = document.getElementById(chartId).getContext('2d');
            const palette = ['#0284c7', '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
            const chartObj = new Chart(ctx, {
                type: (cfg.type || 'bar').toLowerCase(),
                data: {
                    labels: cfg.labels,
                    datasets: [{
                        label: cfg.datasetLabel || cfg.title || 'Value',
                        data: cfg.values,
                        backgroundColor: cfg.labels.map((_, i) => palette[i % palette.length] + 'CC'),
                        borderColor: cfg.labels.map((_, i) => palette[i % palette.length]),
                        borderWidth: 2, borderRadius: 6, tension: 0.35
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }
            });
            activeChartInstances[chartId] = { instance: chartObj, config: cfg, palette };
        } catch (e) {}
    }
}

function switchChartWidgetType(chartId, newType) {
    const entry = activeChartInstances[chartId];
    if (!entry) return;
    try {
        entry.instance.destroy();
        const ctx = document.getElementById(chartId).getContext('2d');
        entry.instance = new Chart(ctx, {
            type: newType,
            data: {
                labels: entry.config.labels,
                datasets: [{
                    label: entry.config.datasetLabel || entry.config.title || 'Value',
                    data: entry.config.values,
                    backgroundColor: entry.config.labels.map((_, i) => entry.palette[i % entry.palette.length] + 'CC'),
                    borderColor: entry.config.labels.map((_, i) => entry.palette[i % entry.palette.length]),
                    borderWidth: 2, borderRadius: 6, tension: 0.35
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) {}
}

function shareCurrentSandboxMiniAppUrl() {
    if (!currentSandboxCodeObj || !currentSandboxCodeObj.code) return;
    try {
        const encoded = btoa(unescape(encodeURIComponent(currentSandboxCodeObj.code)));
        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#kiza_app=${encoded}`);
        showNotification("🔗 App Link Copied!", "Shareable Mini-App URL copied to clipboard!", false, { skipStore: true });
    } catch (e) {
        showNotification("Share Notice", "Mini-app is too large for a URL hash—use Download instead.", true, { skipStore: true });
    }
}

function checkUrlForSharedMiniApp() {
    const hash = window.location.hash || "";
    if (hash.startsWith("#kiza_app=")) {
        try {
            const decodedHtml = decodeURIComponent(escape(atob(hash.replace("#kiza_app=", "").trim())));
            if (decodedHtml) {
                generatedCodeSnippetsStore.push({ lang: "html", code: decodedHtml, filename: "shared_mini_app.html" });
                setTimeout(() => openCodeSandboxByIndex(generatedCodeSnippetsStore.length - 1), 600);
            }
        } catch (e) {}
    }
}

function extractAndRenderCodeBlocks(rawText) {
    const codeRegex = /```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)(?:```|$)/g;
    let match;
    const logBox = document.getElementById('actionLog');
    while ((match = codeRegex.exec(rawText)) !== null) {
        let lang = (match[1] || "").toLowerCase().trim();
        if (lang === "mermaid") continue;
        let codeContent = match[2].replace(/https:\s*•\s*/g, 'https://').replace(/http:\s*•\s*/g, 'http://').trim();
        if (!codeContent) continue;

        if (!lang) {
            if (/<!doctype|<html|<body|<div|<canvas|<style/i.test(codeContent)) lang = "html";
            else if (/\bdef\s+\w+\(|import\s+\w+|print\(/i.test(codeContent)) lang = "python";
            else lang = "javascript";
        }

        const extMap = { html: "html", htm: "html", javascript: "js", js: "js", css: "css", python: "py", py: "py", json: "json", sql: "sql", c: "c", cpp: "cpp", svg: "svg" };
        const filename = `index.${extMap[lang] || "txt"}`;
        const snippetIdx = generatedCodeSnippetsStore.length;
        generatedCodeSnippetsStore.push({ lang, code: codeContent, filename });
        const canRunLive = ["html", "htm", "javascript", "js", "svg"].includes(lang);

        const card = document.createElement('div');
        card.className = "code-block-card";
        card.innerHTML = `<div class="code-block-header"><div style="display:flex; align-items:center; gap:8px;"><span style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:3px 8px; border-radius:6px; font-weight:700;">${escapeHtml(lang.toUpperCase())}</span><span style="color:#e2e8f0; font-weight:600;">${escapeHtml(filename)}</span></div><div style="display:flex; gap:6px; flex-wrap:wrap;">${canRunLive ? `<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#10b981; color:#ffffff; border:none;" onclick="openCodeSandboxByIndex(${snippetIdx})">▶ Run Live</button>` : ''}${canRunLive ? `<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#0284c7; color:#ffffff; border:none;" onclick="openCodeSandboxByIndex(${snippetIdx}); toggleSplitStudioMode(true);">◧ Split</button>` : ''}${canRunLive ? `<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#4f46e5; color:#ffffff; border:none;" onclick="currentSandboxCodeObj=generatedCodeSnippetsStore[${snippetIdx}]; shareCurrentSandboxMiniAppUrl();">🔗 Share</button>` : ''}<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#f59e0b; color:#000000; border:none;" onclick="currentSandboxCodeObj=generatedCodeSnippetsStore[${snippetIdx}]; autoFixCurrentSandboxCode();">⚡ Fix</button><button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#334155; color:#f8fafc; border:1px solid #475569;" onclick="copyCodeSnippetByIndex(${snippetIdx})">📋 Copy</button><button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#0284c7; color:#ffffff; border:none;" onclick="downloadCodeSnippetByIndex(${snippetIdx})">⬇️ Save</button></div></div><pre class="code-block-pre"><code>${escapeHtml(codeContent)}</code></pre>`;
        logBox.appendChild(card);
        logBox.scrollTop = logBox.scrollHeight;
    }
}

function openCodeSandboxByIndex(idx) {
    const item = generatedCodeSnippetsStore[idx];
    if (!item) return;
    currentSandboxCodeObj = item;
    document.getElementById('codeSandboxTitle').innerText = `💻 KIZA Isolated Sandbox • ${item.filename}`;
    const banner = document.getElementById('sandboxDiagnosticBanner');
    const bannerTxt = document.getElementById('sandboxDiagnosticText');
    let htmlToRun = item.code;

    const looksCutOff = (item.lang === "html" || /<!doctype|<html|<style/i.test(htmlToRun)) && (!/<\/body>/i.test(htmlToRun) || (/<script/i.test(htmlToRun) && !/<\/script>/i.test(htmlToRun)));
    if (looksCutOff && banner && bannerTxt) {
        bannerTxt.innerText = "⚠️ Code was cut off before finishing! Tap '⚡ Fix Now' to complete the working app.";
        banner.style.display = "flex";
    } else if (banner) {
        banner.style.display = "none";
    }

    if (item.lang === "javascript" || item.lang === "js") {
        htmlToRun = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;"><h3>JavaScript Output:</h3><pre id="out"></pre><script>const origLog = console.log; console.log = (...a) => { document.getElementById('out').innerText += a.join(' ') + '\\n'; origLog(...a); }; try { ${item.code} } catch(e) { document.getElementById('out').innerText += 'Error: ' + e.message; }<\/script></body></html>`;
    }
    const errorHook = `<script>window.onerror = function(msg, src, line) { window.parent.postMessage({ type: 'kiza_sandbox_error', message: msg + ' (Line ' + line + ')' }, '*'); };<\/script>`;
    htmlToRun = htmlToRun.includes("<head>") ? htmlToRun.replace("<head>", "<head>" + errorHook) : (errorHook + htmlToRun);
    document.getElementById('codeSandboxIframe').srcdoc = htmlToRun;
    const modal = document.getElementById('codeSandboxModal');
    modal.classList.toggle('split-docked', isSplitStudioActive);
    modal.style.display = "flex";
}

window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'kiza_sandbox_error') {
        const banner = document.getElementById('sandboxDiagnosticBanner');
        const bannerTxt = document.getElementById('sandboxDiagnosticText');
        if (banner && bannerTxt) { bannerTxt.innerText = `⚠️ Runtime Error: ${e.data.message}`; banner.style.display = "flex"; }
    }
});

function reloadCurrentSandboxIframe() { const i = document.getElementById('codeSandboxIframe'); if (i && i.srcdoc) { const d = i.srcdoc; i.srcdoc = ""; setTimeout(() => { i.srcdoc = d; }, 40); } }
function autoFixCurrentSandboxCode() { if (!currentSandboxCodeObj?.code) return; closeCodeSandboxModal(); document.getElementById('textInput').value = `Fix and complete this single-file HTML5 web app cleanly so it runs with zero errors:\n${currentSandboxCodeObj.code.slice(0, 700)}`; submitCommand(); }
function closeCodeSandboxModal() {
    document.getElementById('codeSandboxModal').style.display = "none";
    document.getElementById('codeSandboxIframe').srcdoc = "";
    if (isSplitStudioActive && document.getElementById('filePreviewModal')?.style.display !== 'flex') {
        toggleSplitStudioMode(false);
    }
}
function copyCodeSnippetByIndex(idx) { const i = generatedCodeSnippetsStore[idx]; if (i) { navigator.clipboard.writeText(i.code); showNotification("Copied", `Copied ${i.filename}`, false, { skipStore: true }); } }
function downloadCodeSnippetByIndex(idx) { const i = generatedCodeSnippetsStore[idx]; if (i) { triggerTextDownload(i.filename, i.code); showNotification("Downloaded", `Saved ${i.filename}`, false, { skipStore: true }); } }
function copyCurrentSandboxCode() { if (currentSandboxCodeObj?.code) { navigator.clipboard.writeText(currentSandboxCodeObj.code); showNotification("Copied", "Code copied!", false, { skipStore: true }); } }
function downloadCurrentSandboxCode() { if (currentSandboxCodeObj?.code) { triggerTextDownload(currentSandboxCodeObj.filename, currentSandboxCodeObj.code); showNotification("Downloaded", `Saved ${currentSandboxCodeObj.filename}`, false, { skipStore: true }); } }

function extractAndRenderInteractiveQuiz(rawText) {
    const quizMatch = rawText.match(/\[QUIZ_DATA\]([\s\S]*?)\[\/QUIZ_DATA\]/i);
    if (!quizMatch) return;
    try {
        const questions = JSON.parse(quizMatch[1].trim());
        if (!Array.isArray(questions) || !questions.length) return;
        const logBox = document.getElementById('actionLog');
        const quizId = 'quiz_' + Date.now();
        let score = 0;
        const card = document.createElement('div');
        card.className = "quiz-card";
        card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; font-weight:700; color:var(--accent-primary);">📝 Interactive Quiz (${questions.length} Questions)</span><span id="${quizId}_score" style="font-size:12px; font-weight:700; color:var(--success); background:rgba(16,185,129,0.12); padding:3px 10px; border-radius:999px;">Score: 0 / ${questions.length}</span></div>`;
        questions.forEach((qObj, qIdx) => {
            const qBox = document.createElement('div');
            qBox.className = "quiz-question-box";
            const qTitle = document.createElement('div'); qTitle.style.cssText = "font-weight:700; font-size:13px;"; qTitle.innerText = `${qIdx + 1}. ${qObj.q}`;
            qBox.appendChild(qTitle);
            const optsContainer = document.createElement('div'); optsContainer.style.cssText = "display:flex; flex-direction:column; gap:6px;";
            const expBox = document.createElement('div'); expBox.style.cssText = "display:none; font-size:11.5px; margin-top:4px; color:var(--text-muted);";
            const letters = ["A", "B", "C", "D"];
            (qObj.options || []).forEach((optText, oIdx) => {
                const btn = document.createElement('button'); btn.type = "button"; btn.className = "quiz-opt-btn";
                btn.innerText = `${letters[oIdx] || (oIdx + 1)}. ${optText}`;
                btn.onclick = () => {
                    const allBtns = optsContainer.querySelectorAll('.quiz-opt-btn');
                    allBtns.forEach(b => b.disabled = true);
                    if (oIdx === Number(qObj.answer)) { btn.classList.add('correct'); score++; playTacticalSFX("complete"); }
                    else { btn.classList.add('wrong'); if (allBtns[Number(qObj.answer)]) allBtns[Number(qObj.answer)].classList.add('correct'); playTacticalSFX("alert"); }
                    document.getElementById(`${quizId}_score`).innerText = `Score: ${score} / ${questions.length}`;
                    if (qObj.explanation) { expBox.innerText = `💡 ${qObj.explanation}`; expBox.style.display = "block"; }
                };
                optsContainer.appendChild(btn);
            });
            qBox.appendChild(optsContainer); qBox.appendChild(expBox); card.appendChild(qBox);
        });
        logBox.appendChild(card);
        renderMathInElementSafe(card);
        logBox.scrollTop = logBox.scrollHeight;
    } catch (e) {}
}

function renderWebSearchBadgeInFeed(queryStr) {
    if (typeof playTacticalSFX === "function") playTacticalSFX("sonar");
    const logBox = document.getElementById('actionLog');
    const badge = document.createElement('div');
    badge.innerHTML = `<span class="web-search-pill">🌐 Live News & Web Search: "${escapeHtml(queryStr)}"</span>`;
    logBox.appendChild(badge);
    logBox.scrollTop = logBox.scrollHeight;
}

function renderTaskPlannerQueueInFeed(stepsArray) {
    if (!Array.isArray(stepsArray) || stepsArray.length === 0) return;
    const logBox = document.getElementById('actionLog');
    const detailsEl = document.createElement('details');
    detailsEl.className = "planner-dropdown";
    detailsEl.innerHTML = `<summary><span>🧠 Step-by-Step Plan (${stepsArray.length} Steps)</span></summary><div class="planner-steps-body">${stepsArray.map((st, i) => `<div><span style="color:var(--success); font-weight:800;">✓</span> <b>Step ${i + 1}:</b> ${escapeHtml(st)}</div>`).join('')}</div>`;
    logBox.appendChild(detailsEl);
    logBox.scrollTop = logBox.scrollHeight;
}

function triggerTextDownload(filename, textContent) {
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function collectActiveChatMessagesFromDOM() {
    const items = [];
    Array.from(document.getElementById('actionLog').children).forEach(el => {
        if (el.id === 'chatIndicator' || el.tagName === 'DETAILS') return;
        const clone = el.cloneNode(true);
        const actBar = clone.querySelector('.msg-action-bar');
        if (actBar) actBar.remove();
        const txt = (clone.innerText || "").replace(/^>\s*/, '').trim();
        if (txt) items.push({ time: new Date().toLocaleTimeString('en-IN', { hour12: false }), sender: txt.startsWith("[KIZA]") ? "KIZA" : cleanDisplayNameOnly(currentUser).toUpperCase(), message: txt });
    });
    return items;
}

function exportCurrentActiveChatTXT() {
    const msgs = collectActiveChatMessagesFromDOM();
    if (msgs.length) openAuditOrChatInPreviewStudio("txt", "Live_Chat_Transcript", msgs.map(m => `[${m.time}] ${m.message}`).join("\n"), false);
}

function exportCurrentActiveChatPDF() {
    const msgs = collectActiveChatMessagesFromDOM();
    if (!msgs.length) return;
    const rowsHtml = msgs.map(m => `<div class="kiza-avoid-break" style="margin-bottom:10px; padding:10px 14px; border-left:4px solid ${m.sender === 'KIZA' ? '#0284c7' : '#4f46e5'}; background:#f8fafc; border-radius:8px; color:#0f172a;"><div style="font-size:10px; color:#64748b;">[${m.time}]</div><div style="font-size:12.5px; margin-top:3px;">${escapeHtml(m.message)}</div></div>`).join("");
    openAuditOrChatInPreviewStudio("pdf", `Chat_Transcript_${cleanDisplayNameOnly(currentUser)}`, `<div style="font-family:'Inter',sans-serif; background:#fff; color:#0f172a; padding:24px; border-radius:10px;"><h2 style="margin:0 0 14px 0; color:#0284c7;">KIZA Chat Export</h2>${rowsHtml}</div>`, true);
}

function exportArchiveTXT() { if (currentArchiveExportData.length) openAuditOrChatInPreviewStudio("txt", "Saved_Archive", currentArchiveExportData.map(m => `[${m.time}] [${m.sender}]: ${m.message}`).join("\n"), false); }
function exportArchivePDF() { if (currentArchiveExportData.length) openAuditOrChatInPreviewStudio("pdf", "Saved_Archive", `<div style="font-family:'Inter',sans-serif; padding:22px; background:#fff; color:#0f172a;"><h2 style="color:#0284c7;">KIZA Saved Chat Archive</h2>${currentArchiveExportData.map(m => `<div class="kiza-avoid-break" style="margin-bottom:8px; padding:8px 12px; border-left:3px solid #0284c7; background:#f8fafc; color:#0f172a;"><b>[${m.time}] ${escapeHtml(m.sender)}:</b> ${escapeHtml(m.message)}</div>`).join("")}</div>`, true); }
function exportSecurityReportCSV() { if (cachedThreatLogs.length) openAuditOrChatInPreviewStudio("csv", "Security_Audit", ["ID,Timestamp,Event,User,IP,Details", ...cachedThreatLogs.map(t => `${t.id},"${t.timestamp}","${t.event_type}","${t.username}","${t.ip_address}","${String(t.details || '').replace(/"/g, '""')}"`)].join("\n"), false); }
function exportSecurityReportTXT() { if (cachedThreatLogs.length) openAuditOrChatInPreviewStudio("txt", "Security_Audit", cachedThreatLogs.map(t => `[${t.timestamp}] ${t.event_type} | ${t.username} | ${t.ip_address} | ${t.details}`).join("\n"), false); }

// ==========================================================
// OFFICIAL KIZA SECURITY MANAGEMENT FORENSIC RECORD PDF
// ==========================================================
function exportSecurityReportPDF() {
    if (!cachedThreatLogs || !cachedThreatLogs.length) {
        showNotification("No Records", "No security incidents available to export.", true, { skipStore: true });
        return;
    }

    const nowIst = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    const reportId = `KSM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
    const officerName = cleanDisplayNameOnly(currentUser || "Viyan Arora").toUpperCase();
    const officerRank = `RANK ${typeof currentRankNum !== "undefined" ? currentRankNum : 1} • ${(typeof currentRole !== "undefined" ? currentRole : "MASTER OWNER").toUpperCase()}`;

    const criticalTypes = new Set([
        "BRUTE_FORCE_LOCKOUT", "HACKING_ATTEMPT_BLOCKED", "MANUAL_IP_BAN",
        "BIOMETRIC_SPOOF_BLOCKED", "UNAUTHORIZED_PURGE_PIN_CHANGE"
    ]);
    const highTypes = new Set([
        "WRONG_PASSWORD", "WRONG_SECURITY_PIN", "WRONG_PURGE_PIN",
        "INAPPROPRIATE_CONTENT", "UNAUTHORIZED_REMOTE_LOGOUT"
    ]);

    const uniqueIps = new Set(cachedThreatLogs.map(t => t.ip_address).filter(Boolean));
    const criticalCount = cachedThreatLogs.filter(t => criticalTypes.has(String(t.event_type || "").toUpperCase())).length;
    const evidenceCount = cachedThreatLogs.filter(t => Boolean(t.mugshot)).length;
    const liveBanBanner = (document.getElementById('threatsBannedBanner')?.innerText || "").trim();

    const parseSecurityDetails = (raw) => {
        const str = String(raw || "Security event logged.");
        let reason = str, location = "Not resolved", isp = "Not recorded", gps = "Unavailable";
        const gpsM = str.match(/\[GPS:\s*([^\]]+)\]/i);
        if (gpsM) gps = gpsM[1].trim();
        const ispM = str.match(/\(ISP:\s*([^)]+)\)/i);
        if (ispM) isp = ispM[1].trim();
        const locParts = str.split(/•\s*📍|📍/);
        if (locParts.length > 1) {
            reason = locParts[0].replace(/•\s*$/, '').trim();
            location = locParts[1]
                .replace(/\[GPS:[^\]]+\]/gi, '')
                .replace(/\(ISP:[^)]+\)/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim() || "Tracked Network";
        }
        return { reason: reason || str, location, isp, gps };
    };

    const incidentCardsHtml = cachedThreatLogs.map((t, idx) => {
        const evType = String(t.event_type || "SECURITY_EVENT").toUpperCase();
        const isCrit = criticalTypes.has(evType);
        const isHigh = highTypes.has(evType);
        const sevLabel = isCrit ? "CRITICAL" : (isHigh ? "HIGH" : "AUDIT");
        const sevColor = isCrit ? "#dc2626" : (isHigh ? "#d97706" : "#0284c7");
        const sevBg = isCrit ? "#fef2f2" : (isHigh ? "#fffbeb" : "#f0f9ff");
        const caseCode = `INC-${String(t.id || (cachedThreatLogs.length - idx)).padStart(4, '0')}`;
        const parsed = parseSecurityDetails(t.details);

        const evidenceBox = t.mugshot
            ? `<div style="width:128px; flex-shrink:0; background:#0f172a; border:1.5px solid ${sevColor}; border-radius:8px; padding:5px; text-align:center;">
                    <img src="${t.mugshot}" style="width:116px; height:88px; object-fit:cover; border-radius:5px; display:block; margin:0 auto;">
                    <div style="font-size:8px; font-weight:800; color:#fca5a5; font-family:monospace; margin-top:4px; letter-spacing:0.6px;">CAMERA CAPTURE</div>
               </div>`
            : `<div style="width:128px; flex-shrink:0; background:#f1f5f9; border:1px dashed #94a3b8; border-radius:8px; padding:10px 6px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                    <div style="font-size:18px; line-height:1; color:#64748b;">🛡️</div>
                    <div style="font-size:8px; font-weight:800; color:#475569; font-family:monospace; margin-top:6px; line-height:1.3;">NO CAMERA SNAPSHOT ATTACHED</div>
               </div>`;

        return `
            <div class="kiza-avoid-break" style="border:1px solid #cbd5e1; border-left:4px solid ${sevColor}; border-radius:9px; background:#ffffff; margin-bottom:12px; overflow:hidden; page-break-inside:avoid; break-inside:avoid;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:${sevBg}; padding:7px 12px; border-bottom:1px solid #e2e8f0; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                        <span style="font-family:monospace; font-size:10px; font-weight:800; color:#0f172a; background:#ffffff; border:1px solid #cbd5e1; padding:2px 6px; border-radius:4px;">${escapeHtml(caseCode)}</span>
                        <span style="font-size:9.5px; font-weight:800; color:#ffffff; background:${sevColor}; padding:2px 7px; border-radius:4px; letter-spacing:0.5px;">${sevLabel}</span>
                        <span style="font-size:11px; font-weight:800; color:#0f172a;">${escapeHtml(evType)}</span>
                    </div>
                    <span style="font-family:monospace; font-size:10px; font-weight:700; color:#334155;">${escapeHtml(t.timestamp || nowIst)}</span>
                </div>
                <div style="display:flex; gap:12px; padding:10px 12px; align-items:stretch;">
                    ${evidenceBox}
                    <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; font-size:11px; color:#0f172a;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:5px 8px;">
                                <div style="font-size:8.5px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.6px;">Target Account / Subject</div>
                                <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:2px;">${escapeHtml(t.username || "UNKNOWN")}</div>
                            </div>
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:5px 8px;">
                                <div style="font-size:8.5px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.6px;">Source IP Address</div>
                                <div style="font-family:monospace; font-size:11.5px; font-weight:800; color:${sevColor}; margin-top:2px;">${escapeHtml(t.ip_address || "unknown")}</div>
                            </div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px;">
                            <div style="font-size:8.5px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.6px;">Incident Description & Action</div>
                            <div style="font-size:11px; font-weight:600; color:#1e293b; margin-top:2px; line-height:1.4;">${escapeHtml(parsed.reason)}</div>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:10px; color:#334155; padding:2px 2px 0 2px;">
                            <span><b>Location:</b> ${escapeHtml(parsed.location)}</span>
                            <span><b>ISP:</b> ${escapeHtml(parsed.isp)}</span>
                            <span><b>GPS:</b> ${escapeHtml(parsed.gps)}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join("");

    const enforcementHtml = liveBanBanner
        ? `<div class="kiza-avoid-break" style="background:#fef2f2; border:1px solid #fca5a5; border-left:4px solid #b91c1c; border-radius:8px; padding:9px 12px; margin-bottom:14px; font-size:10.5px; color:#7f1d1d;">
                <b style="letter-spacing:0.5px;">ACTIVE ENFORCEMENT & ACCESS CONTROL ROSTER:</b> ${escapeHtml(liveBanBanner)}
           </div>`
        : "";

    const securityDossierHtml = `
        <div style="font-family:'Inter', Arial, sans-serif; background:#ffffff; color:#0f172a; padding:22px 26px; border-radius:10px; border:1px solid #cbd5e1; box-sizing:border-box;">
            <div class="kiza-avoid-break" style="background:linear-gradient(135deg, #090d16 0%, #1e293b 70%, #450a0a 100%); color:#ffffff; padding:18px 22px; border-radius:10px; border-bottom:4px solid #dc2626; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; border-bottom:1px solid rgba(255,255,255,0.18); padding-bottom:8px; margin-bottom:10px;">
                    <span style="font-family:monospace; font-size:9px; font-weight:800; color:#fca5a5; letter-spacing:2px;">CONFIDENTIAL • INTERNAL SECURITY RECORD • RANKS 1–4 CLEARANCE</span>
                    <span style="font-family:monospace; font-size:9px; font-weight:800; color:#ffffff; background:#dc2626; padding:2px 8px; border-radius:4px;">OFFICIAL AUDIT</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:14px; flex-wrap:wrap;">
                    <div>
                        <div style="font-size:21px; font-weight:900; letter-spacing:1.2px; color:#ffffff; line-height:1.15;">KIZA SECURITY MANAGEMENT</div>
                        <div style="font-size:11px; color:#cbd5e1; margin-top:4px; font-weight:600;">Forensic Intrusion Ledger, IP Geolocation & Evidence Record</div>
                    </div>
                    <div style="text-align:right; font-family:monospace; font-size:9.5px; color:#e2e8f0; line-height:1.5; border-left:1px solid rgba(255,255,255,0.22); padding-left:12px;">
                        <div><b>RECORD ID:</b> ${escapeHtml(reportId)}</div>
                        <div><b>OFFICER:</b> ${escapeHtml(officerName)} (${escapeHtml(officerRank)})</div>
                        <div><b>ISSUED:</b> ${escapeHtml(nowIst)} IST</div>
                    </div>
                </div>
            </div>

            <div class="kiza-avoid-break" style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; margin-bottom:14px; page-break-inside:avoid;">
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-top:3px solid #0f172a; border-radius:8px; padding:9px 10px;">
                    <div style="font-size:8.5px; font-weight:800; color:#64748b; text-transform:uppercase;">Total Incidents</div>
                    <div style="font-size:19px; font-weight:900; color:#0f172a; margin-top:2px;">${cachedThreatLogs.length}</div>
                </div>
                <div style="background:#fef2f2; border:1px solid #fecaca; border-top:3px solid #dc2626; border-radius:8px; padding:9px 10px;">
                    <div style="font-size:8.5px; font-weight:800; color:#991b1b; text-transform:uppercase;">Critical Threats</div>
                    <div style="font-size:19px; font-weight:900; color:#dc2626; margin-top:2px;">${criticalCount}</div>
                </div>
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-top:3px solid #1d4ed8; border-radius:8px; padding:9px 10px;">
                    <div style="font-size:8.5px; font-weight:800; color:#1e40af; text-transform:uppercase;">Unique Source IPs</div>
                    <div style="font-size:19px; font-weight:900; color:#1d4ed8; margin-top:2px;">${uniqueIps.size}</div>
                </div>
                <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-top:3px solid #059669; border-radius:8px; padding:9px 10px;">
                    <div style="font-size:8.5px; font-weight:800; color:#065f46; text-transform:uppercase;">Visual Evidence</div>
                    <div style="font-size:19px; font-weight:900; color:#059669; margin-top:2px;">${evidenceCount}</div>
                </div>
            </div>

            ${enforcementHtml}

            <div style="font-size:11px; font-weight:800; color:#0f172a; letter-spacing:1px; text-transform:uppercase; border-bottom:2px solid #0f172a; padding-bottom:5px; margin-bottom:12px;">
                CHRONOLOGICAL INCIDENT & EVIDENCE LOG (${cachedThreatLogs.length} ENTRIES)
            </div>

            ${incidentCardsHtml}

            <div class="kiza-avoid-break" style="margin-top:14px; padding-top:10px; border-top:2px solid #0f172a; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-family:monospace; font-size:9px; color:#475569; page-break-before:avoid;">
                <span><b>KIZA SECURITY MANAGEMENT</b> • RECORD ${escapeHtml(reportId)} • DO NOT DISTRIBUTE</span>
                <span>AUTHORIZED: ${escapeHtml(officerName)} • ${escapeHtml(nowIst)} IST</span>
            </div>
        </div>`;

    openAuditOrChatInPreviewStudio("pdf", "Security_Management_Record", securityDossierHtml, true);
}
