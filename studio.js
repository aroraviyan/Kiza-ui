// ==========================================================
// KIZA v11.1 — MULTI-FORMAT DOCUMENT, EXCEL, DOCX & SANDBOX STUDIO
// ==========================================================
let attachedImageBase64 = null;
let attachedImageName = "";
let lastAttachedFileTopic = "";
let lastUploadedDocumentContext = "";
let attachedImageExtractedContext = "";
let isScanningAttachment = false;
let attachmentScanPromise = null;

let lastCompiledFileCache = null;
let currentSandboxCodeObj = { lang: "html", code: "", filename: "kiza_app.html" };
let generatedCodeSnippetsStore = [];
const activeChartInstances = {};
const webImageCache = {};

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
        { value: "infographic", label: "📊 Infographic Dossier" },
        { value: "academic", label: "📚 Academic / NCERT" },
        { value: "exam_paper", label: "📝 CBSE Exam Paper" },
        { value: "lab_manual", label: "🔬 Lab Practical File" },
        { value: "magazine", label: "📰 Editorial Magazine" },
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
        { value: "xlsx_budget", label: "💰 Financial Budget (=SUM & =AVG)" },
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
// INTENT & THEME PARSERS
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
        return `Image File Name: '${filename}' (${imgEl.naturalWidth}x${imgEl.naturalHeight}px, ${tone}, Dominant RGB(${Math.round(rSum/pixels)},${Math.round(gSum/pixels)},${Math.round(bSum/pixels)}))`;
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
    return fullText;
}

async function extractTextFromUploadedDOCX(file) {
    if (typeof mammoth === "undefined") return "Word document attached.";
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = (result.value || "").trim().slice(0, 5000);
    lastUploadedDocumentContext = rawText;
    lastAttachedFileTopic = (file.name || "Word_Document").replace(/\.(docx|doc)$/i, '');
    return rawText;
}

async function extractTextFromUploadedXLSX(file) {
    if (typeof XLSX === "undefined") return "Excel workbook attached.";
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    let outBlocks = [];
    workbook.SheetNames.slice(0, 4).forEach(sheetName => {
        const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        outBlocks.push(`[SHEET: ${sheetName}]\n${csvText}`);
    });
    const combined = outBlocks.join("\n\n").slice(0, 5000);
    lastUploadedDocumentContext = combined;
    lastAttachedFileTopic = (file.name || "Excel_Sheet").replace(/\.(xlsx|xls)$/i, '');
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
                lastUploadedDocumentContext = rawTxt;
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
    document.getElementById('textInput').value = `Make a clean typed PDF report on ${cleanTitle} by transcribing all handwritten text, cleaning up grammar, formatting math/science equations in LaTeX ($...$), and organizing into clear study sections.`;
    submitCommand();
}

// ==========================================================
// WIKIMEDIA + CUSTOM HIGH-RES SVG VISUALS ENGINE
// ==========================================================
function generateCustomHighResArtworkDataUrl(queryStr) {
    const cleanTitle = (queryStr || "KIZA Visual").replace(/[^a-zA-Z0-9\s:.-]/g, '').trim().toUpperCase().slice(0, 44);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="340" viewBox="0 0 720 340">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1a050a"/><stop offset="50%" stop-color="#090d16"/><stop offset="100%" stop-color="#1e1b4b"/>
            </linearGradient>
            <radialGradient id="glow" cx="50%" cy="45%" r="45%">
                <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.42"/><stop offset="55%" stop-color="#dc2626" stop-opacity="0.18"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <rect width="720" height="340" fill="url(#bg)"/>
        <circle cx="360" cy="155" r="180" fill="url(#glow)"/>
        <rect x="0" y="0" width="720" height="22" fill="#050811"/>
        <rect x="0" y="318" width="720" height="22" fill="#050811"/>
        <ellipse cx="360" cy="155" rx="165" ry="40" fill="none" stroke="#fbbf24" stroke-width="5" opacity="0.85"/>
        <circle cx="360" cy="155" r="52" fill="#050811" stroke="#f59e0b" stroke-width="4"/>
        <text x="360" y="262" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#fbbf24" text-anchor="middle" letter-spacing="2">🎬 ${cleanTitle}</text>
        <text x="360" y="286" font-family="monospace" font-size="11" fill="#cbd5e1" text-anchor="middle" letter-spacing="1.5">KIZA HIGH-RES STAGE VISUALIZATION</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

async function fetchTopicWebImageUrl(queryStr) {
    const rawClean = (queryStr || "space science")
        .replace(/\b(theatre|theater|stage|lighting|set|costume|production|library|poster)\b/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const shortQuery = rawClean.split(' ').slice(0, 3).join(' ') || "galaxy";
    if (webImageCache[queryStr]) return webImageCache[queryStr];

    try {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(shortQuery + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
        const res = await fetch(commonsUrl);
        const data = await res.json();
        if (data && data.query && data.query.pages) {
            for (const p of Object.values(data.query.pages)) {
                const thumbUrl = p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url;
                if (thumbUrl && /\.(jpg|jpeg|png|webp)$/i.test(thumbUrl)) {
                    webImageCache[queryStr] = thumbUrl;
                    return thumbUrl;
                }
            }
        }
    } catch (e) {}

    const customSvgUrl = generateCustomHighResArtworkDataUrl(queryStr);
    webImageCache[queryStr] = customSvgUrl;
    return customSvgUrl;
}

async function preloadAllQueryImagesInContent(rawContent) {
    const regex = /(?:IMAGE_QUERY|FIGURE):\s*([^\n]+)/gi;
    let m;
    const queries = [];
    while ((m = regex.exec(rawContent)) !== null) queries.push(m[1].trim());
    await Promise.all(queries.map(q => fetchTopicWebImageUrl(q)));
}

function getVisualImageUrlSync(queryStr) {
    return webImageCache[queryStr] || generateCustomHighResArtworkDataUrl(queryStr);
}

// ==========================================================
// 1. PDF REPORT & MOVIE THEATER STAGE RENDERER
// ==========================================================
function buildDecorativeReportHTML(topicTitle, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark", layoutFormat = "infographic") {
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
    const cleanTopic = parsedTopic.cleanTopic.toUpperCase();

    const isMovieMode = (
        styleTheme === "movie_theater" ||
        layoutFormat === "movie_theater" ||
        parsedTopic.styleTheme === "movie_theater" ||
        /\b(movie\s*theat|stage\s*production|cinema)\b/i.test(rawContent)
    );
    const activeTheme = isMovieMode ? "movie_theater" : ((styleTheme && styleTheme !== "cyber_dark") ? styleTheme : parsedTopic.styleTheme);
    const activeFormat = isMovieMode ? "movie_theater" : layoutFormat;
    const pal = THEME_PALETTES[activeTheme] || THEME_PALETTES.cyber_dark;
    const isDarkDoc = (activeTheme === "black" || activeTheme === "movie_theater");

    const rawLines = stripSlashesFromText(rawContent)
        .replace(/\[GENERATE_FILE:[^\]]+\]/g, '')
        .replace(/\[GENERATING_PDF:[^\]]+\]/g, '')
        .replace(/AI_INTRO:[^\n]*/gi, '')
        .replace(/\*\*/g, '')
        .split('\n');

    let subtitle = isMovieMode ? "🎬 IMAX & STAGE PRODUCTION DOSSIER" : "COMPREHENSIVE VISUAL REPORT & DATA ANALYSIS";
    const kpis = [], charts = [], tableRows = [], bodyBlocks = [];
    let tableHeaders = [], lastSeenHeading = "";

    rawLines.forEach(line => {
        const t = line.trim();
        if (!t || /^(LAYOUT|SHEET)\s*:/i.test(t)) return;

        if (/^(SLIDE|PAGE)\s*(\d+)\s*:\s*(.*)$/i.test(t)) {
            const m = t.match(/^(SLIDE|PAGE)\s*(\d+)\s*:\s*(.*)$/i);
            const pNum = parseInt(m[2], 10);
            const pTitle = (m[3] || "").trim();
            bodyBlocks.push({ type: 'page_break', pageNum: pNum, title: pTitle });
            if (pTitle) lastSeenHeading = pTitle.toLowerCase();
            return;
        }
        if (/^TITLE\s*:/i.test(t)) {
            const titleTxt = t.replace(/^TITLE\s*:\s*/i, '').trim();
            if (titleTxt && titleTxt.toLowerCase() !== lastSeenHeading) {
                bodyBlocks.push({ type: 'section', text: titleTxt });
                lastSeenHeading = titleTxt.toLowerCase();
            }
            return;
        }
        if (/^SUBTITLE:/i.test(t)) {
            subtitle = t.replace(/^SUBTITLE:\s*/i, '').trim();
        } else if (/^(?:IMAGE_QUERY|FIGURE):/i.test(t)) {
            const q = t.replace(/^(?:IMAGE_QUERY|FIGURE):\s*/i, '').trim();
            const url = getVisualImageUrlSync(q);
            const prevBlock = bodyBlocks[bodyBlocks.length - 1];
            if (!prevBlock || prevBlock.type !== 'web_image' || prevBlock.query !== q) {
                bodyBlocks.push({ type: 'web_image', query: q, url });
            }
        } else if (/^KPI:/i.test(t)) {
            const parts = t.replace(/^KPI:\s*/i, '').split('|').map(s => s.trim());
            if (parts.length >= 2) kpis.push({ label: parts[0], value: parts[1], sub: parts[2] || "Key Metric" });
        } else if (/^CHART:/i.test(t)) {
            const parts = t.replace(/^CHART:\s*/i, '').split('|').map(s => s.trim());
            if (parts.length >= 2) {
                let pct = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
                charts.push({ label: parts[0], pct: isNaN(pct) ? 80 : Math.min(100, Math.max(5, pct)) });
            }
        } else if (/^TABLE_HEADER:/i.test(t)) {
            tableHeaders = t.replace(/^TABLE_HEADER:\s*/i, '').split('|').map(s => s.trim());
        } else if (/^TABLE_ROW:/i.test(t)) {
            tableRows.push(t.replace(/^TABLE_ROW:\s*/i, '').split('|').map(s => s.trim()));
        } else if (/^SECTION:/i.test(t)) {
            const secTxt = t.replace(/^SECTION:\s*/i, '').trim();
            if (secTxt && secTxt.toLowerCase() !== lastSeenHeading) {
                bodyBlocks.push({ type: 'section', text: secTxt });
                lastSeenHeading = secTxt.toLowerCase();
            }
        } else if (/^(?:CALLOUT|KEY CONCEPT):/i.test(t)) {
            bodyBlocks.push({ type: 'callout', text: t.replace(/^(?:CALLOUT|KEY CONCEPT):\s*/i, '').trim() });
        } else if (/^[-•*◆]\s+/.test(t)) {
            bodyBlocks.push({ type: 'bullet', text: t.replace(/^[-•*◆]\s+/, '').trim() });
        } else if (t.toLowerCase() !== lastSeenHeading) {
            bodyBlocks.push({ type: 'p', text: t });
        }
    });

    const kpiHtml = kpis.length > 0 ? `
        <div style="display:flex; gap:14px; margin-bottom:20px; flex-wrap:wrap;">
            ${kpis.slice(0, 3).map((k, idx) => {
                const colors = isMovieMode ? ['#fbbf24', '#ef4444', '#f59e0b'] : ['#0284c7', '#7c3aed', '#059669'];
                const bgColors = isMovieMode ? ['#2a0810', '#2a0810', '#2a0810'] : (isDarkDoc ? ['#111827', '#1e1b4b', '#062e22'] : ['#f0f9ff', '#f5f3ff', '#ecfdf5']);
                const c = colors[idx % 3], bg = bgColors[idx % 3];
                return `<div style="flex:1; min-width:150px; background:${bg}; border:1.5px solid ${c}88; border-top:4px solid ${c}; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:10px; font-weight:800; color:${isDarkDoc ? '#fde68a' : '#475569'}; text-transform:uppercase; letter-spacing:1px;">${isMovieMode ? '🎟️ ' : ''}${escapeHtml(k.label)}</div>
                    <div style="font-size:21px; font-weight:800; color:${c}; margin:4px 0;">${escapeHtml(k.value)}</div>
                    <div style="font-size:10.5px; color:${isDarkDoc ? '#fca5a5' : '#64748b'};">${escapeHtml(k.sub)}</div>
                </div>`;
            }).join('')}
        </div>` : '';

    const chartHtml = charts.length > 0 ? `
        <div style="background:${pal.pdfCardBg}; border:1.5px solid ${isMovieMode ? '#fbbf24' : (isDarkDoc ? '#334155' : '#cbd5e1')}; border-radius:12px; padding:15px 18px; margin:16px 0;">
            <div style="font-size:11px; font-weight:800; color:${isMovieMode ? '#fbbf24' : pal.pdfText}; letter-spacing:1.4px; text-transform:uppercase; margin-bottom:12px;">📊 DATA & BENCHMARK GRAPH</div>
            ${charts.map((ch, idx) => {
                const barColors = isMovieMode
                    ? ['linear-gradient(90deg, #dc2626, #fbbf24)', 'linear-gradient(90deg, #b91c1c, #f59e0b)', 'linear-gradient(90deg, #991b1b, #fde047)']
                    : ['linear-gradient(90deg, #0284c7, #38bdf8)', 'linear-gradient(90deg, #6366f1, #a855f7)', 'linear-gradient(90deg, #059669, #10b981)'];
                return `<div style="margin-bottom:9px;">
                    <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; color:${pal.pdfText}; margin-bottom:4px;"><span>${escapeHtml(ch.label)}</span><span style="color:${isMovieMode ? '#fbbf24' : '#0284c7'};">${ch.pct}%</span></div>
                    <div style="width:100%; height:11px; background:${isDarkDoc ? '#2e0912' : '#e2e8f0'}; border-radius:999px; overflow:hidden;"><div style="width:${ch.pct}%; height:100%; background:${barColors[idx % 3]}; border-radius:999px;"></div></div>
                </div>`;
            }).join('')}
        </div>` : '';

    const tableHtml = tableRows.length > 0 ? `
        <table style="width:100%; border-collapse:collapse; margin:18px 0; font-size:11.5px; border-radius:8px; overflow:hidden; border:1.5px solid ${isMovieMode ? '#fbbf24' : '#334155'};">
            <thead><tr style="background:${isMovieMode ? '#7f1d1d' : '#' + (pal.bgHex === 'F8FAFC' ? '0f172a' : pal.bgHex)}; color:#ffffff; text-align:left;">
                ${(tableHeaders.length ? tableHeaders : ['Parameter', 'Category A', 'Category B']).map(h => `<th style="padding:9px 12px; font-weight:800; border-bottom:2px solid #fbbf24; color:#fde68a;">${escapeHtml(h)}</th>`).join('')}
            </tr></thead>
            <tbody>${tableRows.map((row, rIdx) => `
                <tr style="background:${isMovieMode ? (rIdx % 2 === 0 ? '#1a050a' : '#2a0810') : (isDarkDoc ? (rIdx % 2 === 0 ? '#111827' : '#1e293b') : (rIdx % 2 === 0 ? '#ffffff' : '#f1f5f9'))}; border-bottom:1px solid #450a0a;">
                    ${row.map((cell, cIdx) => `<td style="padding:8px 12px; color:${pal.pdfText}; ${cIdx === 0 ? 'font-weight:700; color:' + (isMovieMode ? '#fbbf24' : '#0284c7') + ';' : ''}">${escapeHtml(cell)}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
        </table>` : '';

    const imgBlockHtml = embeddedImgBase64 ? `
        <div style="margin:14px 0 20px 0; text-align:center; background:${pal.pdfCardBg}; padding:14px; border-radius:12px; border:1.5px dashed #fbbf24;">
            <img src="${embeddedImgBase64}" crossorigin="anonymous" style="max-width:82%; max-height:220px; border-radius:8px;">
            <div style="font-size:10px; color:#fde68a; margin-top:6px; font-weight:600;">ATTACHED VISUAL FIGURE</div>
        </div>` : '';

    let renderedBody = "";
    bodyBlocks.forEach(b => {
        if (b.type === 'page_break') {
            const breakCss = b.pageNum > 1 ? "page-break-before: always; break-before: page; margin-top: 24px; padding-top: 16px; border-top: 2px dashed rgba(251, 191, 36, 0.45);" : "margin-top: 8px;";
            renderedBody += `<div style="${breakCss}"><div style="display:flex; justify-content:space-between; align-items:center; background:${isMovieMode ? 'linear-gradient(90deg, #7f1d1d 0%, #450a0a 60%, #1a050a 100%)' : 'linear-gradient(90deg, #0284c7 0%, #1e293b 100%)'}; color:#fde68a; padding:10px 16px; border-radius:10px; border:1px solid #fbbf24; margin-bottom:12px;"><span style="font-size:13px; font-weight:900; letter-spacing:1.2px;">${isMovieMode ? '🎬 SCENE / PAGE ' + b.pageNum : '📄 PAGE ' + b.pageNum}${b.title ? ' — ' + escapeHtml(b.title.toUpperCase()) : ''}</span><span style="font-size:10px; font-family:monospace; color:#ffffff; background:rgba(0,0,0,0.45); padding:2px 8px; border-radius:99px;">PAGE ${b.pageNum}</span></div></div>`;
        } else if (b.type === 'web_image') {
            renderedBody += `<div style="margin:12px 0; text-align:center; background:${isMovieMode ? '#090204' : pal.pdfCardBg}; padding:10px; border-radius:12px; border:2px solid ${isMovieMode ? '#fbbf24' : (isDarkDoc ? '#334155' : '#e2e8f0')};"><img src="${b.url}" crossorigin="anonymous" style="width:100%; max-width:520px; height:200px; object-fit:cover; border-radius:8px; display:block; margin:0 auto;" onerror="this.src='${generateCustomHighResArtworkDataUrl(b.query)}'"><div style="font-size:10px; color:${isMovieMode ? '#fbbf24' : '#64748b'}; margin-top:6px; font-weight:700; text-transform:uppercase; letter-spacing:1px;">🎞️ ${escapeHtml(b.query)}</div></div>`;
        } else if (b.type === 'section') {
            renderedBody += `<h2 style="font-size:14px; font-weight:800; color:${isMovieMode ? '#fbbf24' : pal.pdfText}; text-transform:uppercase; letter-spacing:1px; border-left:4px solid ${isMovieMode ? '#dc2626' : '#0284c7'}; padding-left:10px; margin:18px 0 9px 0;">${escapeHtml(b.text)}</h2>`;
        } else if (b.type === 'callout') {
            renderedBody += `<div style="background:${isMovieMode ? '#2a0810' : pal.pdfCardBg}; border-left:4px solid ${isMovieMode ? '#fbbf24' : '#7c3aed'}; padding:11px 15px; border-radius:0 8px 8px 0; margin:12px 0; font-size:12px; font-weight:600; color:${pal.pdfText};">📌 <b>KEY INSIGHT:</b> ${escapeHtml(b.text)}</div>`;
        } else if (b.type === 'bullet') {
            renderedBody += `<div style="display:flex; align-items:flex-start; gap:8px; margin:5px 0 5px 8px; font-size:12.5px; color:${pal.pdfText};"><span style="color:${isMovieMode ? '#fbbf24' : '#0284c7'}; font-weight:bold;">◆</span><span>${escapeHtml(b.text)}</span></div>`;
        } else {
            renderedBody += `<p style="font-size:12.5px; color:${pal.pdfText}; margin:7px 0; line-height:1.62; text-align:justify;">${escapeHtml(b.text)}</p>`;
        }
    });

    if (chartHtml) renderedBody += chartHtml;
    if (tableHtml) renderedBody += tableHtml;

    let headerBannerHTML = "";
    let mainContentWrapperHTML = `${kpiHtml}${imgBlockHtml}${renderedBody}`;

    if (isMovieMode) {
        headerBannerHTML = `<div style="background:radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.35) 0%, rgba(127,29,29,0.85) 55%, #0d0205 100%); border:2.5px solid #fbbf24; color:#fffbeb; padding:24px 28px; border-radius:14px; margin-bottom:22px; text-align:center;"><div style="font-size:10.5px; font-weight:900; color:#fbbf24; letter-spacing:3px;">★ NOW SHOWING • KIZA CINEMA STAGE EDITION ★</div><h1 style="margin:8px 0 5px 0; font-size:26px; font-weight:900; color:#ffffff;">${escapeHtml(cleanTopic)}</h1><div style="font-size:12px; color:#fde68a; font-style:italic;">${escapeHtml(subtitle)}</div><div style="margin-top:10px; font-size:10px; font-family:monospace; color:#fca5a5;">AUTHOR: ${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())} • DATE: ${new Date().toLocaleDateString('en-IN')}</div></div>`;
    } else if (activeFormat === "exam_paper") {
        headerBannerHTML = `<div style="border:2px solid #0f172a; padding:16px 20px; margin-bottom:20px; text-align:center; background:#ffffff; color:#0f172a;"><div style="font-size:11px; font-weight:800; letter-spacing:1.5px;">CBSE PATTERN ASSESSMENT • QUESTION PAPER</div><h1 style="margin:6px 0; font-size:21px; font-weight:800;">${escapeHtml(cleanTopic)}</h1><div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; border-top:1px solid #cbd5e1; padding-top:8px; margin-top:8px;"><span>Time: 2 Hours</span><span>Candidate: ${escapeHtml(cleanDisplayNameOnly(currentUser))}</span><span>Max Marks: 40</span></div></div>`;
    } else if (activeFormat === "lab_manual") {
        headerBannerHTML = `<div style="border-left:6px solid #059669; background:#ecfdf5; color:#064e3b; padding:16px 20px; border-radius:0 10px 10px 0; margin-bottom:20px;"><div style="font-size:10px; font-weight:800; letter-spacing:1.5px; color:#059669;">PRACTICAL LAB RECORD</div><h1 style="margin:4px 0; font-size:21px; font-weight:800;">${escapeHtml(cleanTopic)}</h1><div style="font-size:11px;">Student: <b>${escapeHtml(cleanDisplayNameOnly(currentUser))}</b> • Date: ${new Date().toLocaleDateString('en-IN')}</div></div>`;
    } else if (activeFormat === "academic") {
        headerBannerHTML = `<div style="border-bottom:3px double #0284c7; padding-bottom:14px; margin-bottom:20px;"><div style="font-size:10px; font-weight:800; color:#0284c7; letter-spacing:1.5px;">ACADEMIC STUDY MODULE • NCERT & CBSE</div><h1 style="margin:4px 0; font-size:23px; font-weight:800; color:${pal.pdfText}; font-family:Georgia, serif;">${escapeHtml(cleanTopic)}</h1><div style="font-size:12px; font-style:italic; color:#64748b;">${escapeHtml(subtitle)}</div></div>`;
        mainContentWrapperHTML = `${kpiHtml}<div style="column-count:2; column-gap:22px; text-align:justify;">${imgBlockHtml}${renderedBody}</div>`;
    } else {
        headerBannerHTML = `<div style="background:${pal.pdfHero}; color:#ffffff; padding:22px 26px; border-radius:14px; margin-bottom:22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;"><div><div style="font-size:10px; font-weight:700; color:#38bdf8; letter-spacing:2px; text-transform:uppercase;">KIZA INTELLIGENCE DOSSIER • ${activeTheme.toUpperCase()}</div><h1 style="margin:6px 0 4px 0; font-size:22px; font-weight:800; color:#ffffff;">${escapeHtml(cleanTopic)}</h1><div style="font-size:11.5px; color:#cbd5e1;">${escapeHtml(subtitle)}</div></div><div style="text-align:right; font-family:monospace; font-size:10px; color:#94a3b8; border-left:1px solid rgba(255,255,255,0.2); padding-left:14px;"><div style="color:#ffffff; font-weight:bold;">AUTHOR: ${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())}</div><div>DATE: ${new Date().toLocaleDateString('en-IN')}</div></div></div>`;
    }

    const outerShellStyle = isMovieMode
        ? `font-family:'Inter', Arial, sans-serif; color:#fffbeb; background:linear-gradient(90deg, #5c0a14 0%, #881322 4%, #3b040a 7%, #0d0205 10%, #0d0205 90%, #3b040a 93%, #881322 96%, #5c0a14 100%); padding:28px 46px; border-radius:12px; border:3px solid #fbbf24;`
        : `font-family:'Inter', Arial, sans-serif; color:${pal.pdfText}; background:${pal.pdfPageBg}; padding:28px 34px; border-radius:10px;`;

    return {
        cleanTopic, subtitle, kpis, charts, tableHeaders, tableRows, activeTheme,
        html: `<div style="${outerShellStyle}">${headerBannerHTML}${mainContentWrapperHTML}<div style="margin-top:30px; border-top:2px solid ${isMovieMode ? '#fbbf24' : '#334155'}; padding-top:10px; font-size:9.5px; color:${isMovieMode ? '#fde68a' : '#64748b'}; display:flex; justify-content:space-between; font-family:monospace;"><span>GENERATED BY KIZA AI • FORMAT: ${activeFormat.toUpperCase()}</span><span>DATE: ${new Date().toLocaleDateString('en-IN')}</span></div></div>`
    };
}

// ==========================================================
// 2. TRUE NATIVE OPENXML WORD (.DOCX) PREVIEW & EXPORTER (docx.js)
// ==========================================================
function parseStructuredWordBlocks(topicTitle, rawContent) {
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
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
        if (!t || /^(KPI|CHART|IMAGE_QUERY|FIGURE|LAYOUT|SHEET):/i.test(t)) return;

        if (/^TABLE_HEADER:/i.test(t)) {
            const headers = t.replace(/^TABLE_HEADER:\s*/i, '').split('|').map(x => x.trim());
            activeTable = { type: 'table', headers, rows: [] };
            blocks.push(activeTable);
            return;
        }
        if (/^TABLE_ROW:/i.test(t)) {
            const cols = t.replace(/^TABLE_ROW:\s*/i, '').split('|').map(x => x.trim());
            if (!activeTable) {
                activeTable = { type: 'table', headers: cols.map((_, i) => `Column ${i + 1}`), rows: [] };
                blocks.push(activeTable);
            }
            activeTable.rows.push(cols);
            return;
        }
        activeTable = null;

        if (/^SUBTITLE:/i.test(t)) {
            subtitle = t.replace(/^SUBTITLE:\s*/i, '').trim();
        } else if (/^(SECTION|PAGE|SLIDE|TITLE)\s*\d*\s*:/i.test(t)) {
            blocks.push({ type: 'heading', text: t.replace(/^(SECTION|PAGE|SLIDE|TITLE)\s*\d*\s*:\s*/i, '').trim() });
        } else if (/^CALLOUT:/i.test(t)) {
            blocks.push({ type: 'callout', text: t.replace(/^CALLOUT:\s*/i, '').trim() });
        } else if (/^[-•*◆]\s+/.test(t)) {
            blocks.push({ type: 'bullet', text: t.replace(/^[-•*◆]\s+/, '').trim() });
        } else {
            blocks.push({ type: 'p', text: t });
        }
    });

    return { title: parsedTopic.cleanTopic, subtitle, blocks };
}

function buildWordDocumentHTML(topicTitle, rawContent, layoutFormat = "docx_report") {
    const docData = parseStructuredWordBlocks(topicTitle, rawContent);
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const author = cleanDisplayNameOnly(currentUser);

    const bodyHtml = docData.blocks.map(b => {
        if (b.type === 'heading') {
            return `<h2 style="color:#1e3a8a; border-bottom:1.5px solid #cbd5e1; padding-bottom:4px; margin-top:18px; font-size:15px;">${escapeHtml(b.text)}</h2>`;
        }
        if (b.type === 'bullet') {
            return `<div style="margin:4px 0 4px 16px;">• ${escapeHtml(b.text)}</div>`;
        }
        if (b.type === 'callout') {
            return `<div style="background:#eff6ff; border-left:4px solid #2563eb; padding:9px 13px; margin:10px 0; font-size:12.5px;"><b>Note:</b> ${escapeHtml(b.text)}</div>`;
        }
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
    const safeTopic = (topicTitle || "KIZA_Document").replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
    const author = cleanDisplayNameOnly(currentUser);
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    if (typeof window.docx === "undefined") {
        // Fallback only if CDN failed to load
        const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body>${document.getElementById('filePreviewViewport').innerHTML}</body></html>`;
        const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `KIZA_${safeTopic}.docx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        return;
    }

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } = window.docx;
    const docData = parseStructuredWordBlocks(topicTitle, rawContent);
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
            children.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: b.text, bold: true, color: "1E3A8A", size: 28 })],
                spacing: { before: 240, after: 120 }
            }));
        } else if (b.type === 'bullet') {
            children.push(new Paragraph({
                text: b.text,
                bullet: { level: 0 },
                spacing: { after: 80 }
            }));
        } else if (b.type === 'callout') {
            children.push(new Paragraph({
                shading: { type: ShadingType.CLEAR, fill: "EFF6FF" },
                children: [new TextRun({ text: "Note: ", bold: true, color: "1D4ED8" }), new TextRun({ text: b.text, color: "0F172A" })],
                spacing: { before: 120, after: 140 }
            }));
        } else if (b.type === 'table' && b.headers.length > 0) {
            const headerRow = new TableRow({
                tableHeader: true,
                children: b.headers.map(h => new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: "1E3A8A" },
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })] })]
                }))
            });
            const dataRows = b.rows.map((r, rIdx) => new TableRow({
                children: b.headers.map((_, ci) => new TableCell({
                    shading: rIdx % 2 === 1 ? { type: ShadingType.CLEAR, fill: "F8FAFC" } : undefined,
                    children: [new Paragraph({ children: [new TextRun({ text: String(r[ci] || ""), size: 20 })] })]
                }))
            }));
            children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [headerRow, ...dataRows]
            }));
            children.push(new Paragraph({ text: "", spacing: { after: 140 } }));
        } else {
            children.push(new Paragraph({
                children: [new TextRun({ text: b.text, size: 22 })],
                spacing: { after: 140 }
            }));
        }
    });

    if (layoutFormat === "docx_letter") {
        children.push(new Paragraph({ children: [new TextRun("Sincerely,")], spacing: { before: 280 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: author, bold: true })] }));
    }

    const doc = new Document({
        creator: author,
        title: docData.title,
        sections: [{ properties: {}, children }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KIZA_${safeTopic}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("📘 Native .DOCX Saved", `Downloaded real Microsoft Word file KIZA_${safeTopic}.docx!`, false, { skipStore: true });
}

// ==========================================================
// 3. MULTI-SHEET EXCEL (.XLSX) PREVIEW & FORMULA EXPORTER
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
        if (!t) return;
        if (/^SHEET\s*:/i.test(t)) {
            const sName = t.replace(/^SHEET\s*:\s*/i, '').replace(/[\[\]:*?/\\]/g, '').trim().slice(0, 28) || `Sheet_${sheets.length + 1}`;
            currentSheet = { name: sName, headers: [], rows: [] };
            sheets.push(currentSheet);
        } else if (/^TABLE_HEADER\s*:/i.test(t)) {
            const sh = ensureSheet("Primary_Data");
            sh.headers = t.replace(/^TABLE_HEADER\s*:\s*/i, '').split('|').map(x => x.trim());
        } else if (/^TABLE_ROW\s*:/i.test(t)) {
            const sh = ensureSheet("Primary_Data");
            sh.rows.push(t.replace(/^TABLE_ROW\s*:\s*/i, '').split('|').map(x => x.trim()));
        }
    });

    const validSheets = sheets.filter(s => s.headers.length > 0 || s.rows.length > 0);
    if (validSheets.length === 0) {
        const parsed = buildDecorativeReportHTML(topicTitle, rawContent);
        if (parsed.charts.length > 0) {
            validSheets.push({
                name: "Metrics",
                headers: ["Category", "Score", "Status"],
                rows: parsed.charts.map(c => [c.label, String(c.pct), c.pct >= 75 ? "Optimal" : "Standard"])
            });
        } else {
            const cleanLines = lines.map(l => l.trim()).filter(Boolean).slice(0, 12);
            validSheets.push({
                name: "KIZA_Data",
                headers: ["Row", "Details", "Status"],
                rows: cleanLines.map((l, i) => [`Row ${i + 1}`, l, "Verified"])
            });
        }
    }
    return validSheets;
}

function buildExcelSheetPreviewHTML(topicTitle, rawContent, layoutFormat = "xlsx_budget") {
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
    const sheets = parseMultiSheetExcelData(topicTitle, rawContent);
    const headerColors = { xlsx_budget: "#059669", xlsx_marksheet: "#2563eb", xlsx_tracker: "#7c3aed", xlsx_comparison: "#0f766e" };
    const hdrBg = headerColors[layoutFormat] || "#059669";
    const badgeText = {
        xlsx_budget: "💰 BUDGET WORKBOOK (=SUM & =AVERAGE)",
        xlsx_marksheet: "🎓 MARKSHEET WORKBOOK (=SUM & =AVERAGE)",
        xlsx_tracker: "📋 TRACKER WORKBOOK",
        xlsx_comparison: "⚖️ COMPARISON WORKBOOK"
    }[layoutFormat] || "📗 MULTI-SHEET EXCEL WORKBOOK";

    const tablesHtml = sheets.map((sh, sIdx) => {
        const hdrs = sh.headers.length ? sh.headers : ["Item", "Value", "Notes"];
        return `
            <div style="margin-bottom:16px;">
                <div style="display:inline-block; background:${hdrBg}; color:#ffffff; font-size:11px; font-weight:800; padding:4px 12px; border-radius:8px 8px 0 0;">📑 Tab ${sIdx + 1}: ${escapeHtml(sh.name)}</div>
                <table class="excel-preview-table" data-sheet-name="${escapeHtml(sh.name)}">
                    <thead><tr>${hdrs.map(h => `<th style="background:${hdrBg};">${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${sh.rows.map(r => `<tr>${hdrs.map((_, cIdx) => `<td>${escapeHtml(r[cIdx] !== undefined ? r[cIdx] : '')}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>
        `;
    }).join('');

    return `<div style="background:#ffffff; padding:20px; border-radius:12px; color:#0f172a;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:2px solid ${hdrBg}; padding-bottom:8px;">
            <div><span style="font-size:10px; font-weight:800; color:${hdrBg};">${badgeText} • ${sheets.length} TAB(S) • CLICK ANY CELL TO EDIT</span><h2 style="margin:3px 0 0 0; font-size:18px;">${escapeHtml(parsedTopic.cleanTopic)}</h2></div>
            <span style="font-size:11px; color:#64748b;">Auto-Formulas Included</span>
        </div>
        ${tablesHtml}
    </div>`;
}

function compileAndDownloadXLSX(topicTitle, rawContent) {
    const safeTopic = (topicTitle || "KIZA_Workbook").replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
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
            if (aoa.length >= 3) {
                const lastDataRow = aoa.length;
                const colCount = aoa[0].length;
                const totalRow = ["TOTAL"];
                const avgRow = ["AVERAGE"];
                for (let c = 1; c < colCount; c++) {
                    const colLetter = XLSX.utils.encode_col(c);
                    if (aoa.slice(1).some(r => typeof r[c] === "number")) {
                        totalRow.push({ t: 'n', f: `SUM(${colLetter}2:${colLetter}${lastDataRow})` });
                        avgRow.push({ t: 'n', f: `AVERAGE(${colLetter}2:${colLetter}${lastDataRow})` });
                    } else {
                        totalRow.push("");
                        avgRow.push("");
                    }
                }
                aoa.push(totalRow);
                aoa.push(avgRow);
            }
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = aoa[0].map(() => ({ wch: 20 }));
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        };

        if (domTables.length > 0) {
            domTables.forEach((tbl, idx) => {
                const aoa = [];
                const ths = Array.from(tbl.querySelectorAll('thead th')).map(th => th.innerText.trim());
                if (ths.length) aoa.push(ths);
                tbl.querySelectorAll('tbody tr').forEach(tr => {
                    const tds = Array.from(tr.querySelectorAll('td')).map(td => {
                        const txt = td.innerText.trim();
                        const numVal = Number(txt.replace(/[%$,₹]/g, ''));
                        return (!isNaN(numVal) && txt !== "" && /^[0-9.,%₹$-]+$/.test(txt)) ? numVal : txt;
                    });
                    if (tds.some(v => v !== "")) aoa.push(tds);
                });
                addSheetAoaToBook(makeUniqueSheetName(tbl.getAttribute('data-sheet-name'), idx), aoa);
            });
        } else {
            const sheets = parseMultiSheetExcelData(topicTitle, rawContent);
            sheets.forEach((sh, idx) => {
                const aoa = [sh.headers.length ? sh.headers : ["Item", "Value", "Notes"]];
                sh.rows.forEach(r => aoa.push(r.map(v => {
                    const num = Number(String(v).replace(/[%$,₹]/g, ''));
                    return (!isNaN(num) && String(v).trim() !== "" && /^[0-9.,%₹$-]+$/.test(String(v).trim())) ? num : v;
                })));
                addSheetAoaToBook(makeUniqueSheetName(sh.name, idx), aoa);
            });
        }

        XLSX.writeFile(wb, `KIZA_${safeTopic}.xlsx`);
        showNotification("📗 Multi-Sheet Excel Saved", `Downloaded KIZA_${safeTopic}.xlsx (${wb.SheetNames.length} tab(s) with =SUM & =AVERAGE)!`, false, { skipStore: true });
    } catch (e) {
        triggerTextDownload(`${safeTopic}.csv`, rawContent);
    }
}

// ==========================================================
// 4. POWERPOINT (.PPTX) STUDIO
// ==========================================================
function parseSlideBlocksFromContent(rawContent) {
    const cleanBody = stripSlashesFromText(rawContent).replace(/\[GENERATE_FILE:[^\]]+\]/g, '').replace(/AI_INTRO:[^\n]*/gi, '').replace(/\*/g, '').trim();
    const slideRegex = /(?:SLIDE|PAGE)\s*\d+\s*:\s*([^\n]+)\n([\s\S]*?)(?=(?:SLIDE|PAGE)\s*\d+\s*:|$)/gi;
    let match, idx = 0;
    const slides = [];
    while ((match = slideRegex.exec(cleanBody)) !== null) {
        idx++;
        const title = match[1].trim();
        const lines = match[2].trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
        let imageQuery = "", statValue = `0${idx}`, statLabel = "KEY METRIC";
        const bullets = [];
        lines.forEach(l => {
            if (/^LAYOUT:/i.test(l)) return;
            if (/^IMAGE_QUERY:/i.test(l)) imageQuery = l.replace(/^IMAGE_QUERY:\s*/i, '').trim();
            else if (/^STAT:/i.test(l)) { const sp = l.replace(/^STAT:\s*/i, '').split('|').map(x => x.trim()); if (sp[0]) statValue = sp[0]; if (sp[1]) statLabel = sp[1]; }
            else bullets.push(l.replace(/^[-•*\d.)\s]+/, '').trim());
        });
        slides.push({ idx, title, imageQuery, statValue, statLabel, bullets });
    }
    return slides;
}

function buildPPTXSlidePreviewHTML(topicTitle, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark") {
    const parsedTopic = extractClientTopicAndStyle(topicTitle);
    const cleanTopic = parsedTopic.cleanTopic.toUpperCase();
    const activeTheme = (styleTheme && styleTheme !== "cyber_dark") ? styleTheme : parsedTopic.styleTheme;
    const pal = THEME_PALETTES[activeTheme] || THEME_PALETTES.cyber_dark;
    const slides = parseSlideBlocksFromContent(rawContent);
    const slideCards = slides.map(s => {
        const rightHTML = s.imageQuery
            ? `<div style="flex:1; min-width:180px; background:#${pal.cardHex}; border:1.5px solid #${pal.secHex}; border-radius:8px; padding:8px; text-align:center;"><img src="${getVisualImageUrlSync(s.imageQuery)}" crossorigin="anonymous" style="width:100%; height:135px; object-fit:cover; border-radius:6px;" onerror="this.src='${generateCustomHighResArtworkDataUrl(s.imageQuery)}'"><div style="font-size:9.5px; color:#${pal.subHex}; margin-top:5px; font-family:monospace;">📸 ${escapeHtml(s.imageQuery.toUpperCase())}</div></div>`
            : `<div style="flex:1; min-width:130px; background:#${pal.cardHex}; border:2px solid #${pal.secHex}; border-radius:8px; padding:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;"><div style="font-size:26px; font-weight:800; color:#${pal.accentHex};">${escapeHtml(s.statValue)}</div><div style="font-size:10px; font-weight:700; color:#${pal.subHex}; margin-top:4px; font-family:monospace;">${escapeHtml(s.statLabel.toUpperCase())}</div></div>`;
        return `<div class="ppt-slide-preview" style="background:#${pal.bgHex}; color:#${pal.textHex}; border:2px solid #${pal.accentHex};"><div style="font-size:10px; color:#${pal.accentHex}; font-family:monospace; margin-bottom:4px;">SLIDE 0${s.idx} • ${activeTheme.toUpperCase()}</div><div style="font-size:18px; font-weight:800; margin-bottom:12px; border-bottom:1px solid #${pal.accentHex}44; padding-bottom:8px;">${escapeHtml(s.title.toUpperCase())}</div><div style="display:flex; gap:14px; align-items:stretch; flex-wrap:wrap;"><div style="flex:2; min-width:220px; background:#${pal.cardHex}; border:1px solid #${pal.accentHex}33; border-radius:8px; padding:12px;">${s.bullets.map(b => `<div style="margin-bottom:7px; font-size:12.5px; display:flex; gap:8px;"><span style="color:#${pal.accentHex};">▸</span><span>${escapeHtml(b)}</span></div>`).join('')}</div>${rightHTML}</div></div>`;
    });
    return `<div style="padding:10px;"><div class="ppt-slide-preview" style="background:#${pal.bgHex}; color:#${pal.textHex}; border:2px solid #${pal.accentHex};"><div style="font-size:10px; color:#${pal.accentHex}; font-family:monospace;">COVER SLIDE • ${activeTheme.toUpperCase()}</div><div style="font-size:24px; font-weight:800; margin:10px 0;">${escapeHtml(cleanTopic)}</div><div style="font-size:11px; color:#${pal.subHex}; font-family:monospace;">Prepared by ${escapeHtml(cleanDisplayNameOnly(currentUser).toUpperCase())}</div></div>${slideCards.join('')}</div>`;
}

function compileAndDownloadPPTX(topicTitle, rawContent, embeddedImgBase64 = null, styleTheme = "cyber_dark") {
    const parsed = extractClientTopicAndStyle(topicTitle);
    const cleanTopic = parsed.cleanTopic.toUpperCase();
    const activeTheme = (styleTheme && styleTheme !== "cyber_dark") ? styleTheme : parsed.styleTheme;
    const pal = THEME_PALETTES[activeTheme] || THEME_PALETTES.cyber_dark;
    if (typeof PptxGenJS === "undefined") { triggerTextDownload(`KIZA_Presentation_${Date.now()}.txt`, rawContent); return; }
    try {
        const pptx = new PptxGenJS();
        pptx.layout = "LAYOUT_16x9"; pptx.author = cleanDisplayNameOnly(currentUser); pptx.title = cleanTopic;
        let titleSlide = pptx.addSlide(); titleSlide.background = { color: pal.bgHex };
        titleSlide.addText(cleanTopic, { x: 0.8, y: 1.4, w: 8.4, h: 1.8, fontSize: 30, color: pal.textHex, bold: true });
        parseSlideBlocksFromContent(rawContent).forEach(s => {
            let slide = pptx.addSlide(); slide.background = { color: pal.bgHex };
            slide.addText(`0${s.idx} // ${s.title.toUpperCase()}`, { x: 0.5, y: 0.35, w: 9.0, h: 0.55, fontSize: 20, color: pal.accentHex, bold: true });
            if (s.bullets.length > 0) slide.addText(s.bullets.map(b => ({ text: b, options: { bullet: true, color: pal.textHex, fontSize: 14, breakLine: true } })), { x: 0.6, y: 1.2, w: 8.6, h: 3.8, valign: "top" });
        });
        pptx.writeFile({ fileName: `KIZA_${cleanTopic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28)}.pptx` });
    } catch (err) { triggerTextDownload(`KIZA_Presentation_${Date.now()}.txt`, rawContent); }
}

// ==========================================================
// STUDIO MODAL CONTROLLER
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

    const themeDropdown = document.getElementById('previewThemeSelect');
    if (themeDropdown && Array.from(themeDropdown.options).some(o => o.value === finalTheme)) themeDropdown.value = finalTheme;
    syncFormatDropdownForFileType(cleanExt, finalLayout);
    const expDropdown = document.getElementById('previewExportTypeSelect');
    if (expDropdown && Array.from(expDropdown.options).some(o => o.value === cleanExt)) expDropdown.value = cleanExt;

    if (typeof playTacticalSFX === "function") playTacticalSFX("complete");
    renderInChatVisualFileCard(cleanExt, parsed.cleanTopic, rawContent, embeddedImgBase64, finalTheme, finalLayout);
    openFilePreviewModal();
    showNotification("Studio Ready", `View, edit directly, or download .${cleanExt.toUpperCase()}!`, false, { skipStore: true });
}

function switchPreviewExportFormat(newExt) {
    if (!lastCompiledFileCache) return;
    const cleanExt = newExt.toLowerCase();
    lastCompiledFileCache.ext = cleanExt;
    lastCompiledFileCache.layoutFormat = syncFormatDropdownForFileType(cleanExt, lastCompiledFileCache.layoutFormat);
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
    openFilePreviewModal();
}

function openFilePreviewModal() {
    if (!lastCompiledFileCache) return;
    const { ext, topic, rawContent, embeddedImgBase64, styleTheme, isPreRenderedAuditHtml } = lastCompiledFileCache;
    const layoutFormat = syncFormatDropdownForFileType(ext, lastCompiledFileCache.layoutFormat);
    lastCompiledFileCache.layoutFormat = layoutFormat;

    const modal = document.getElementById('filePreviewModal');
    document.getElementById('filePreviewModalTitle').innerText = `🎨 KIZA Multi-Format Studio • ${topic || 'Document'} (.${ext.toUpperCase()})`;
    document.getElementById('confirmDownloadBtn').innerText = `⬇️ Confirm & Download .${ext.toUpperCase()}`;
    const expSel = document.getElementById('previewExportTypeSelect');
    if (expSel && Array.from(expSel.options).some(o => o.value === ext)) expSel.value = ext;

    const viewport = document.getElementById('filePreviewViewport');
    const selectorsBox = document.getElementById('previewLayoutThemeSelectors');

    if (isPreRenderedAuditHtml) {
        if (selectorsBox) selectorsBox.style.display = "none";
        viewport.innerHTML = rawContent;
    } else if (ext === "xlsx" || ext === "xls") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.innerHTML = buildExcelSheetPreviewHTML(topic, rawContent, layoutFormat);
    } else if (ext === "docx" || ext === "doc") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.innerHTML = buildWordDocumentHTML(topic, rawContent, layoutFormat);
    } else if (ext === "pptx" || ext === "ppt") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.innerHTML = buildPPTXSlidePreviewHTML(topic, rawContent, embeddedImgBase64, styleTheme);
    } else if (ext === "pdf") {
        if (selectorsBox) selectorsBox.style.display = "flex";
        viewport.innerHTML = buildDecorativeReportHTML(topic, rawContent, embeddedImgBase64, styleTheme, layoutFormat || "infographic").html;
    } else {
        if (selectorsBox) selectorsBox.style.display = "none";
        const cleanBody = stripSlashesFromText(rawContent).replace(/\[GENERATE_FILE:[^\]]+\]/g, '').replace(/AI_INTRO:[^\n]*/gi, '').trim();
        viewport.innerHTML = `<pre style="background:#0f172a; color:#f8fafc; padding:18px; border-radius:10px; overflow-x:auto; font-family:'JetBrains Mono', monospace; font-size:12px;">${escapeHtml(cleanBody)}</pre>`;
    }
    renderMathInElementSafe(viewport);
    modal.style.display = "flex";
}

function closeFilePreviewModal() {
    document.getElementById('filePreviewModal').style.display = "none";
}

async function confirmAndDownloadPreviewedFile() {
    if (!lastCompiledFileCache) return;
    const { ext, topic, rawContent, embeddedImgBase64, styleTheme, layoutFormat } = lastCompiledFileCache;
    const cleanExt = (ext || "pdf").toLowerCase().trim();
    const safeTopic = (topic || "KIZA_Export").replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);

    if (cleanExt === "xlsx" || cleanExt === "xls") { compileAndDownloadXLSX(topic, rawContent); return; }
    if (cleanExt === "doc" || cleanExt === "docx") { await compileAndDownloadNativeDOCX(topic, rawContent, layoutFormat); return; }
    if (cleanExt === "pptx" || cleanExt === "ppt") { compileAndDownloadPPTX(topic, rawContent, embeddedImgBase64, styleTheme); return; }
    if (cleanExt === "pdf") {
        const viewportEl = document.getElementById('filePreviewViewport');
        const opt = {
            margin: [6, 6, 6, 6],
            filename: `KIZA_${safeTopic}.pdf`,
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        showNotification("Downloading PDF", `Saving ${opt.filename}...`, false, { skipStore: true });
        html2pdf().set(opt).from(viewportEl.firstElementChild || viewportEl).save();
        return;
    }
    const cleanBody = stripSlashesFromText(rawContent).replace(/\[GENERATE_FILE:[^\]]+\]/g, '').replace(/AI_INTRO:[^\n]*/gi, '').trim();
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
                <button type="button" class="chip-btn" style="width:auto; padding:6px 12px; font-size:11px;" onclick="openFilePreviewModal()">👁️ View & Edit</button>
                <button type="button" class="send-btn" style="padding:6px 13px; font-size:11px;" onclick="confirmAndDownloadPreviewedFile()">⬇️ Download .${ext.toUpperCase()}</button>
            </div>
        </div>
        <div style="font-size:11.5px; color:var(--text-muted);">Switch formats anytime inside Studio or ask KIZA in chat to revise!</div>
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
        let lang = (match[1] || "html").toLowerCase().trim();
        if (lang === "mermaid") continue;
        let codeContent = match[2].replace(/https:\s*•\s*/g, 'https://').replace(/http:\s*•\s*/g, 'http://').trim();
        if (!codeContent) continue;
        const extMap = { html: "html", javascript: "js", js: "js", css: "css", python: "py", py: "py", json: "json", sql: "sql", c: "c", cpp: "cpp" };
        const filename = `index.${extMap[lang] || "html"}`;
        const snippetIdx = generatedCodeSnippetsStore.length;
        generatedCodeSnippetsStore.push({ lang, code: codeContent, filename });
        const canRunLive = ["html", "javascript", "js", "svg"].includes(lang) || codeContent.includes("<html") || codeContent.includes("<body");
        const card = document.createElement('div');
        card.className = "code-block-card";
        card.innerHTML = `<div class="code-block-header"><div style="display:flex; align-items:center; gap:8px;"><span style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:3px 8px; border-radius:6px; font-weight:700;">${escapeHtml(lang.toUpperCase())}</span><span style="color:#e2e8f0; font-weight:600;">${escapeHtml(filename)}</span></div><div style="display:flex; gap:6px; flex-wrap:wrap;">${canRunLive ? `<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#10b981; color:#ffffff; border:none;" onclick="openCodeSandboxByIndex(${snippetIdx})">▶ Run Live</button>` : ''}${canRunLive ? `<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#4f46e5; color:#ffffff; border:none;" onclick="currentSandboxCodeObj=generatedCodeSnippetsStore[${snippetIdx}]; shareCurrentSandboxMiniAppUrl();">🔗 Share</button>` : ''}<button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#f59e0b; color:#000000; border:none;" onclick="currentSandboxCodeObj=generatedCodeSnippetsStore[${snippetIdx}]; autoFixCurrentSandboxCode();">⚡ Fix</button><button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#334155; color:#f8fafc; border:1px solid #475569;" onclick="copyCodeSnippetByIndex(${snippetIdx})">📋 Copy</button><button type="button" class="chip-btn" style="width:auto; padding:4px 11px; font-size:11px; background:#0284c7; color:#ffffff; border:none;" onclick="downloadCodeSnippetByIndex(${snippetIdx})">⬇️ Save</button></div></div><pre class="code-block-pre"><code>${escapeHtml(codeContent)}</code></pre>`;
        logBox.appendChild(card);
        logBox.scrollTop = logBox.scrollHeight;
    }
}

function openCodeSandboxByIndex(idx) {
    const item = generatedCodeSnippetsStore[idx];
    if (!item) return;
    currentSandboxCodeObj = item;
    document.getElementById('codeSandboxTitle').innerText = `💻 KIZA Live Code Sandbox • ${item.filename}`;
    const banner = document.getElementById('sandboxDiagnosticBanner');
    if (banner) banner.style.display = "none";
    let htmlToRun = item.code;
    if (item.lang === "javascript" || item.lang === "js") {
        htmlToRun = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;"><h3>JavaScript Output:</h3><pre id="out"></pre><script>const origLog = console.log; console.log = (...a) => { document.getElementById('out').innerText += a.join(' ') + '\\n'; origLog(...a); }; try { ${item.code} } catch(e) { document.getElementById('out').innerText += 'Error: ' + e.message; }<\/script></body></html>`;
    }
    const errorHook = `<script>window.onerror = function(msg, src, line) { window.parent.postMessage({ type: 'kiza_sandbox_error', message: msg + ' (Line ' + line + ')' }, '*'); };<\/script>`;
    htmlToRun = htmlToRun.includes("<head>") ? htmlToRun.replace("<head>", "<head>" + errorHook) : (errorHook + htmlToRun);
    document.getElementById('codeSandboxIframe').srcdoc = htmlToRun;
    document.getElementById('codeSandboxModal').style.display = "flex";
}

window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'kiza_sandbox_error') {
        const banner = document.getElementById('sandboxDiagnosticBanner');
        const bannerTxt = document.getElementById('sandboxDiagnosticText');
        if (banner && bannerTxt) { bannerTxt.innerText = `⚠️ Runtime Error: ${e.data.message}`; banner.style.display = "flex"; }
    }
});

function reloadCurrentSandboxIframe() { const i = document.getElementById('codeSandboxIframe'); if (i && i.srcdoc) { const d = i.srcdoc; i.srcdoc = ""; setTimeout(() => { i.srcdoc = d; }, 40); } }
function autoFixCurrentSandboxCode() { if (!currentSandboxCodeObj?.code) return; closeCodeSandboxModal(); document.getElementById('textInput').value = `Fix and complete this HTML web app cleanly:\n${currentSandboxCodeObj.code.slice(0, 600)}`; submitCommand(); }
function closeCodeSandboxModal() { document.getElementById('codeSandboxModal').style.display = "none"; document.getElementById('codeSandboxIframe').srcdoc = ""; }
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
    const rowsHtml = msgs.map(m => `<div style="margin-bottom:10px; padding:10px 14px; border-left:4px solid ${m.sender === 'KIZA' ? '#0284c7' : '#4f46e5'}; background:#f8fafc; border-radius:8px; color:#0f172a;"><div style="font-size:10px; color:#64748b;">[${m.time}]</div><div style="font-size:12.5px; margin-top:3px;">${escapeHtml(m.message)}</div></div>`).join("");
    openAuditOrChatInPreviewStudio("pdf", `Chat_Transcript_${cleanDisplayNameOnly(currentUser)}`, `<div style="font-family:'Inter',sans-serif; background:#fff; color:#0f172a; padding:26px; border-radius:10px;"><h2 style="margin:0 0 16px 0; color:#0284c7;">KIZA Chat Export</h2>${rowsHtml}</div>`, true);
}

function exportArchiveTXT() { if (currentArchiveExportData.length) openAuditOrChatInPreviewStudio("txt", "Saved_Archive", currentArchiveExportData.map(m => `[${m.time}] [${m.sender}]: ${m.message}`).join("\n"), false); }
function exportArchivePDF() { if (currentArchiveExportData.length) openAuditOrChatInPreviewStudio("pdf", "Saved_Archive", `<div style="font-family:'Inter',sans-serif; padding:24px; background:#fff;"><h2>KIZA Saved Chat Archive</h2>${currentArchiveExportData.map(m => `<div style="margin-bottom:8px; padding:8px 12px; border-left:3px solid #0284c7; background:#f8fafc; color:#0f172a;"><b>[${m.time}] ${escapeHtml(m.sender)}:</b> ${escapeHtml(m.message)}</div>`).join("")}</div>`, true); }
function exportSecurityReportCSV() { if (cachedThreatLogs.length) openAuditOrChatInPreviewStudio("csv", "Security_Audit", ["ID,Timestamp,Event,User,IP,Details", ...cachedThreatLogs.map(t => `${t.id},"${t.timestamp}","${t.event_type}","${t.username}","${t.ip_address}","${String(t.details || '').replace(/"/g, '""')}"`)].join("\n"), false); }
function exportSecurityReportTXT() { if (cachedThreatLogs.length) openAuditOrChatInPreviewStudio("txt", "Security_Audit", cachedThreatLogs.map(t => `[${t.timestamp}] ${t.event_type} | ${t.username} | ${t.ip_address} | ${t.details}`).join("\n"), false); }
function exportSecurityReportPDF() { if (cachedThreatLogs.length) openAuditOrChatInPreviewStudio("pdf", "Security_Audit", `<div style="padding:24px; background:#fff;"><h2>KIZA Security Audit Report</h2>${cachedThreatLogs.map(t => `<div style="margin-bottom:10px; padding:10px; border-left:4px solid #ef4444; background:#fff1f2; color:#0f172a;"><b>[${escapeHtml(t.event_type)}] ${escapeHtml(t.username)} (${escapeHtml(t.ip_address)})</b><div>${escapeHtml(t.details)}</div></div>`).join("")}</div>`, true); }
