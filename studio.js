// ==========================================================
// KIZA v11.5 — PRO MULTI-FORMAT STUDIO, SPLIT-SCREEN & SANDBOX
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
let activeSplitStudioModalId = null;

const THEME_PALETTES = {
    movie_theater: { bgHex: "0D0205", cardHex: "1A050A", accentHex: "FBBF24", secHex: "DC2626", textHex: "FFFBEB", subHex: "FCA5A5", pdfHero: "linear-gradient(135deg, #450a0a 0%, #1a050a 50%, #78350f 100%)", pdfPageBg: "#0d0205", pdfText: "#fffbeb", pdfCardBg: "#1a050a" },
    black: { bgHex: "000000", cardHex: "0A0A0A", accentHex: "00F2FE", secHex: "A855F7", textHex: "FFFFFF", subHex: "94A3B8", pdfHero: "linear-gradient(135deg, #000000 0%, #111111 70%, #1e293b 100%)", pdfPageBg: "#090d16", pdfText: "#f8fafc", pdfCardBg: "#111827" },
    cyber_dark: { bgHex: "060A17", cardHex: "111827", accentHex: "38BDF8", secHex: "A855F7", textHex: "F8FAFC", subHex: "94A3B8", pdfHero: "linear-gradient(135deg, #090d16 0%, #0f172a 55%, #0284c7 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#f8fafc" },
    light: { bgHex: "F8FAFC", cardHex: "FFFFFF", accentHex: "0284C7", secHex: "2563EB", textHex: "0F172A", subHex: "475569", pdfHero: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#f1f5f9" },
    blue: { bgHex: "071936", cardHex: "0C264E", accentHex: "38BDF8", secHex: "60A5FA", textHex: "FFFFFF", subHex: "93C5FD", pdfHero: "linear-gradient(135deg, #071936 0%, #1d4ed8 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#eff6ff" },
    purple: { bgHex: "130726", cardHex: "210E3D", accentHex: "C084FC", secHex: "F472B6", textHex: "FFFFFF", subHex: "D8B4FE", pdfHero: "linear-gradient(135deg, #130726 0%, #7e22ce 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#faf5ff" },
    green: { bgHex: "041E16", cardHex: "062E22", accentHex: "10B981", secHex: "34D399", textHex: "FFFFFF", subHex: "A7F3D0", pdfHero: "linear-gradient(135deg, #041e16 0%, #059669 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#ecfdf5" },
    red: { bgHex: "28070C", cardHex: "3F0B13", accentHex: "FB7185", secHex: "F43F5E", textHex: "FFFFFF", subHex: "FDA4AF", pdfHero: "linear-gradient(135deg, #28070c 0%, #e11d48 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#fff1f2" },
    gold: { bgHex: "1C1605", cardHex: "2E2408", accentHex: "FBBF24", secHex: "F59E0B", textHex: "FFFFFF", subHex: "FDE68A", pdfHero: "linear-gradient(135deg, #1c1605 0%, #d97706 100%)", pdfPageBg: "#ffffff", pdfText: "#0f172a", pdfCardBg: "#fffbeb" }
};

const FILE_TYPE_FORMATS = {
    pdf: [
        { value: "movie_theater", label: "🎬 Movie Theater Stage" },
        { value: "infographic", label: "📊 Executive Infographic Dossier" },
        { value: "academic", label: "📚 Academic / NCERT Two-Column" },
        { value: "exam_paper", label: "📝 CBSE Exam Paper" },
        { value: "lab_manual", label: "🔬 Lab Practical File" },
        { value: "magazine", label: "📰 Editorial Magazine" },
        { value: "minimal", label: "💼 Clean Minimalist Brief" }
    ],
    docx: [
        { value: "docx_report", label: "📘 Executive Word Report" },
        { value: "docx_letter", label: "✉️ Formal Letter / Application" },
        { value: "docx_assignment", label: "🎓 School Assignment / Essay" },
        { value: "docx_resume", label: "📄 Resume / CV Layout" },
        { value: "docx_minutes", label: "🗒️ Meeting Minutes" }
    ],
    xlsx: [
        { value: "xlsx_budget", label: "💰 Financial Budget (Live Formulas)" },
        { value: "xlsx_marksheet", label: "🎓 Student Marksheet (=SUM & =AVG)" },
        { value: "xlsx_tracker", label: "📋 Project / Study Tracker" },
        { value: "xlsx_comparison", label: "⚖️ Comparison Matrix" }
    ],
    pptx: [
        { value: "pptx_cinematic", label: "🎬 Cinematic 16:9 Keynote" },
        { value: "pptx_pitch", label: "🚀 Startup Pitch Deck" },
        { value: "pptx_academic", label: "📚 Academic Lecture Deck" }
    ],
    csv: [
        { value: "csv_raw", label: "📊 Clean Raw CSV Table" }
    ]
};

// ==========================================================
// SPLIT-SCREEN STUDIO CONTROLLER (CHAT LEFT | STUDIO RIGHT)
// ==========================================================
function ensureSplitScreenButtonInModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const btnId = `${modalId}_splitBtn`; if (document.getElementById(btnId)) return; const header = modal.querySelector('.section-title'); if (!header) return;  const btn = document.createElement('button'); btn.type = "button"; btn.id = btnId; btn.className = "chip-btn"; btn.style.cssText = "width:auto; padding:4px 10px; border-color:var(--accent-primary); color:var(--accent-primary); font-size:11px;"; btn.innerText = "◫ Split Screen"; btn.onclick = () => toggleSplitScreenStudio(modalId);  const closeBtn = header.querySelector('button[onclick*="close"]'); if (closeBtn && closeBtn.parentNode === header) { const wrap = document.createElement('div'); wrap.style.cssText = "display:flex; gap:6px; align-items:center;"; header.insertBefore(wrap, closeBtn); wrap.appendChild(btn); wrap.appendChild(closeBtn); } else if (closeBtn && closeBtn.parentNode) { closeBtn.parentNode.insertBefore(btn, closeBtn); } else { header.appendChild(btn); } }  function toggleSplitScreenStudio(modalId, forceState = null) { const modal = document.getElementById(modalId); if (!modal) return; const currentlyDocked = modal.classList.contains('split-docked'); const nextState = forceState !== null ? forceState : !currentlyDocked;  ["filePreviewModal", "codeSandboxModal"].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('split-docked'); const b = document.getElementById(`${id}_splitBtn`);
        if (b) b.innerText = "◫ Split Screen";
    });

    if (nextState) {
        document.body.classList.add('split-studio-open');
        modal.classList.add('split-docked');
        activeSplitStudioModalId = modalId;
        const b = document.getElementById(`${modalId}_splitBtn`);
        if (b) b.innerText = "⬜ Full Modal";
        if (typeof showNotification === "function") {
            showNotification("Split-Screen Live Studio", "Type any edit in chat on the left to update this panel live!", false, { skipStore: true });
        }
    } else {
        document.body.classList.remove('split-studio-open');
        activeSplitStudioModalId = null;
    }
}

function getActiveSplitStudioContext() {
    if (!document.body.classList.contains('split-studio-open') || !activeSplitStudioModalId) return null;
    if (activeSplitStudioModalId === "filePreviewModal" && lastCompiledFileCache) {
        return `FILE_TYPE=.${lastCompiledFileCache.ext} | TOPIC=${lastCompiledFileCache.topic}\n${lastCompiledFileCache.rawContent}`;
    }
    if (activeSplitStudioModalId === "codeSandboxModal" && currentSandboxCodeObj?.code) {
        return `SANDBOX_FILE=${currentSandboxCodeObj.filename} (${currentSandboxCodeObj.lang})\n\`\`\`${currentSandboxCodeObj.lang}\n${currentSandboxCodeObj.code}\n\`\`\``;
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
// INTENT & CLEAN TITLE PARSERS
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
// MULTI-FILE ATTACHMENT READERS (.PDF, .DOCX, .XLSX, OCR)
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
        return `Image File Name: '${filename}' (${imgEl.naturalWidth}x${imgEl.naturalHeight}px,${tone}, Dominant RGB(${Math.round(rSum/pixels)},${Math.round(g
