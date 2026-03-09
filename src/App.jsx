import { useState, useRef, useCallback } from "react";

const GEMINI_API_KEY = "AIzaSyCBJvS-sxFyDSeuRsGXQ4CxTfm2drmGHAk";
const IMAGE_MODEL = "gemini-2.5-flash-preview-04-17";

// ─── Templates ───────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "obsidian",
    name: "Obsidian & Gold",
    preview: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
    accent: "#d4a853",
    accentRgb: "212,168,83",
    textColor: "#f5f0e8",
    subtextColor: "#c9b99a",
  },
  {
    id: "midnight",
    name: "Midnight Luxe",
    preview: "linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 50%, #0d0d1a 100%)",
    accent: "#c5a55a",
    accentRgb: "197,165,90",
    textColor: "#ede6d6",
    subtextColor: "#b8a882",
  },
  {
    id: "ember",
    name: "Ember & Bronze",
    preview: "linear-gradient(135deg, #1a0a00 0%, #2a1510 50%, #1a0a00 100%)",
    accent: "#e8a849",
    accentRgb: "232,168,73",
    textColor: "#faf0e0",
    subtextColor: "#d4b88a",
  },
];

const IMAGE_STYLES = [
  { id: "realistic", name: "Realista", prompt: "photorealistic, cinematic lighting, professional photography, 8k ultra detailed", expertPrompt: "photorealistic portrait preserving exact facial features and likeness" },
  { id: "animated", name: "Animado", prompt: "digital illustration, vibrant colors, stylized animation, high quality digital art", expertPrompt: "stylized digital illustration character version, preserving facial features and likeness" },
  { id: "pixar", name: "Estilo Pixar", prompt: "3D rendered, Pixar-style animation, soft lighting, colorful, charming characters, high quality CGI", expertPrompt: "3D Pixar-style animated character version, soft lighting, preserving facial features and likeness" },
  { id: "comic", name: "Comic Book", prompt: "comic book art style, bold ink outlines, halftone dots, dramatic shading, vibrant panel colors, Marvel/DC comic aesthetic", expertPrompt: "comic book character version with bold ink outlines, halftone shading, preserving facial features and likeness" },
];

// ─── Helpers ─────────────────────────────────────────────────────────

async function geminiImageWithRef(prompt, refImageBase64, refMimeType) {
  const parts = [];
  if (refImageBase64) {
    parts.push({ inlineData: { mimeType: refMimeType || "image/jpeg", data: refImageBase64 } });
    parts.push({ text: prompt });
  } else {
    parts.push({ text: prompt });
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageMimeType: "image/png" },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const resParts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = resParts.find((p) => p.inlineData);
  if (!imgPart) throw new Error("No se generó imagen");
  return imgPart.inlineData.data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseSlideText(raw) {
  return raw
    .split("---")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Canvas rendering ────────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderSlide(canvas, text, slideIndex, totalSlides, bgBase64, template, keyword) {
  const ctx = canvas.getContext("2d");
  const W = 1080, H = 1080;
  canvas.width = W;
  canvas.height = H;

  // Background
  try {
    const img = await loadImage("data:image/png;base64," + bgBase64);
    const scale = Math.max(W / img.width, H / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
  } catch {
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#0a0a0a");
    grd.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  // Overlay
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "rgba(0,0,0,0.72)");
  grd.addColorStop(0.4, "rgba(0,0,0,0.42)");
  grd.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Gold top line
  ctx.fillStyle = template.accent;
  ctx.fillRect(0, 0, W, 4);

  // Corner accents
  ctx.strokeStyle = template.accent;
  ctx.lineWidth = 2;
  const cL = 40;
  ctx.beginPath(); ctx.moveTo(30, 30 + cL); ctx.lineTo(30, 30); ctx.lineTo(30 + cL, 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 30 - cL, 30); ctx.lineTo(W - 30, 30); ctx.lineTo(W - 30, 30 + cL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, H - 30 - cL); ctx.lineTo(30, H - 30); ctx.lineTo(30 + cL, H - 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 30 - cL, H - 30); ctx.lineTo(W - 30, H - 30); ctx.lineTo(W - 30, H - 30 - cL); ctx.stroke();

  const pad = 80;
  const maxW = W - pad * 2;
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;

  // Split text into lines by newline, then wrap each
  const textLines = text.split("\n").filter(l => l.trim());

  if (isFirst) {
    // ─── HOOK SLIDE ───
    // First line = main title, rest = subtitle
    const title = textLines[0] || "";
    const subtitle = textLines.slice(1).join(" ");

    ctx.textAlign = "center";
    ctx.fillStyle = template.accent;
    ctx.font = "bold 54px sans-serif";
    const hookLines = wrapText(ctx, title.toUpperCase(), maxW);
    const startY = H / 2 - ((hookLines.length - 1) * 68) / 2 - (subtitle ? 20 : 0);
    hookLines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * 68));

    if (subtitle) {
      ctx.fillStyle = template.subtextColor;
      ctx.font = "italic 28px sans-serif";
      const subLines = wrapText(ctx, subtitle, maxW);
      subLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, startY + hookLines.length * 68 + 20 + i * 36);
      });
    }
  } else if (isLast && keyword) {
    // ─── CTA SLIDE ───
    const ctaText = textLines.join(" ");

    ctx.textAlign = "center";
    ctx.fillStyle = template.textColor;
    ctx.font = "bold 40px sans-serif";
    const ctaLines = wrapText(ctx, ctaText, maxW);
    const startY = H / 2 - 100;
    ctaLines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * 52));

    // Keyword box
    ctx.font = "bold 52px sans-serif";
    const kwW = ctx.measureText(keyword).width + 60;
    const kwH = 72;
    const kwX = (W - kwW) / 2;
    const kwY = startY + ctaLines.length * 52 + 30;
    ctx.fillStyle = template.accent;
    ctx.beginPath(); ctx.roundRect(kwX, kwY, kwW, kwH, 8); ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(keyword.toUpperCase(), W / 2, kwY + 50);
    ctx.fillStyle = template.subtextColor;
    ctx.font = "26px sans-serif";
    ctx.fillText("Comenta esta palabra para recibir info", W / 2, kwY + kwH + 40);
  } else {
    // ─── CONTENT SLIDE ───
    // First line = title, rest = body
    const title = textLines[0] || "";
    const body = textLines.slice(1).join(" ");

    // Slide number watermark
    ctx.fillStyle = `rgba(${template.accentRgb}, 0.25)`;
    ctx.font = "bold 180px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(slideIndex + 1).padStart(2, "0"), W - 60, 180);
    ctx.textAlign = "left";

    // Title
    ctx.fillStyle = template.accent;
    ctx.font = "bold 42px sans-serif";
    const titleLines = wrapText(ctx, title, maxW);
    let y = 280;
    titleLines.forEach((line, i) => ctx.fillText(line, pad, y + i * 54));
    y += titleLines.length * 54 + 20;

    // Divider
    ctx.fillStyle = `rgba(${template.accentRgb}, 0.5)`;
    ctx.fillRect(pad, y, 60, 3);
    y += 30;

    // Body
    if (body) {
      ctx.fillStyle = template.textColor;
      ctx.font = "32px sans-serif";
      const bodyLines = wrapText(ctx, body, maxW);
      bodyLines.forEach((line, i) => ctx.fillText(line, pad, y + i * 46));
    }
  }

  // Slide counter (bottom right)
  ctx.textAlign = "right";
  ctx.fillStyle = `rgba(${template.accentRgb}, 0.4)`;
  ctx.font = "16px sans-serif";
  ctx.fillText(`${slideIndex + 1}/${totalSlides}`, W - 40, H - 40);

  return canvas.toDataURL("image/png");
}

// ─── ZIP creation ────────────────────────────────────────────────────

function createZip(files) {
  const localFiles = [];
  const centralDir = [];
  let offset = 0;
  for (const file of files) {
    const nb = new TextEncoder().encode(file.name);
    const d = file.data;
    const l = new Uint8Array(30 + nb.length + d.length);
    const lv = new DataView(l.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
    lv.setUint32(14, 0, true); lv.setUint32(18, d.length, true);
    lv.setUint32(22, d.length, true); lv.setUint16(26, nb.length, true);
    lv.setUint16(28, 0, true);
    l.set(nb, 30); l.set(d, 30 + nb.length);
    localFiles.push(l);
    const c = new Uint8Array(46 + nb.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true); cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true); cv.setUint32(16, 0, true);
    cv.setUint32(20, d.length, true); cv.setUint32(24, d.length, true);
    cv.setUint16(28, nb.length, true); cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true); cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    c.set(nb, 46); centralDir.push(c);
    offset += l.length;
  }
  const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true); ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  const zip = new Uint8Array(offset + cdSize + 22);
  let pos = 0;
  for (const lf of localFiles) { zip.set(lf, pos); pos += lf.length; }
  for (const cd of centralDir) { zip.set(cd, pos); pos += cd.length; }
  zip.set(eocd, pos);
  return zip;
}

function base64ToUint8(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ─── Styles ──────────────────────────────────────────────────────────

const labelStyle = {
  display: "block", marginBottom: 8, fontSize: 13,
  color: "#a89870", textTransform: "uppercase", letterSpacing: 2,
};

const inputStyle = {
  width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(212,168,83,0.2)", borderRadius: 8, color: "#e8e0d0",
  fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

// ─── Main App ────────────────────────────────────────────────────────

export default function App() {
  const [slideText, setSlideText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sceneHint, setSceneHint] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("obsidian");
  const [selectedStyle, setSelectedStyle] = useState("realistic");
  const [expertPhoto, setExpertPhoto] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [previews, setPreviews] = useState([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const template = TEMPLATES.find((t) => t.id === selectedTemplate);
  const style = IMAGE_STYLES.find((s) => s.id === selectedStyle);
  const parsedSlides = parseSlideText(slideText);
  const slideCount = parsedSlides.length;

  const handleExpertUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    setExpertPhoto({ base64, mimeType: file.type, preview });
  }, []);

  const removeExpert = useCallback(() => {
    setExpertPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const generate = useCallback(async () => {
    if (parsedSlides.length < 2) return;
    setGenerating(true);
    setPreviews([]);
    setPreviewIdx(0);
    setTotalSteps(parsedSlides.length);
    setProgress(0);

    try {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvasRef.current = canvas;
      const newPreviews = [];
      const sceneContext = sceneHint.trim() ? sceneHint.trim() : "professional business environment, sales leadership context";

      for (let i = 0; i < parsedSlides.length; i++) {
        const text = parsedSlides[i];
        setStatus(`Generando imagen ${i + 1} de ${parsedSlides.length}...`);
        setProgress(i);

        let bgBase64 = null;
        try {
          let imgPrompt;
          if (expertPhoto) {
            imgPrompt = `Transform this person into the following scene, keeping their facial features and identity fully recognizable. Style: ${style.expertPrompt}. Scene: ${sceneContext}. The person should be the main subject, rendered in ${style.prompt} style. Dark moody atmosphere with dramatic lighting, suitable as an Instagram carousel background with text overlay. Square format 1:1. Do NOT add any text or words to the image.`;
            bgBase64 = await geminiImageWithRef(imgPrompt, expertPhoto.base64, expertPhoto.mimeType);
          } else {
            imgPrompt = `${sceneContext}. Style: ${style.prompt}. Dark moody atmosphere, dramatic lighting, suitable as Instagram carousel background with text overlay. No text or words in the image. Square format 1:1.`;
            bgBase64 = await geminiImageWithRef(imgPrompt, null, null);
          }
        } catch (err) {
          console.warn("Image gen failed for slide", i, err);
        }

        const dataUrl = await renderSlide(canvas, text, i, parsedSlides.length, bgBase64, template, keyword);
        newPreviews.push(dataUrl);
        setPreviews([...newPreviews]);
      }

      setProgress(parsedSlides.length);
      setStatus("¡Carrusel listo!");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [parsedSlides, keyword, sceneHint, template, style, expertPhoto]);

  const downloadZip = useCallback(() => {
    const files = previews.map((dataUrl, i) => {
      const b64 = dataUrl.split(",")[1];
      return { name: `slide_${String(i + 1).padStart(2, "0")}.png`, data: base64ToUint8(b64) };
    });
    const zip = createZip(files);
    const blob = new Blob([zip], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrusel_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [previews]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #080808 0%, #0d0d15 40%, #0a0812 100%)",
      color: "#e8e0d0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ padding: "32px 40px 24px", borderBottom: "1px solid rgba(212,168,83,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42,
            background: "linear-gradient(135deg, #d4a853, #8a6d2b)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: "bold", color: "#0a0a0a",
          }}>C</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#d4a853", letterSpacing: 1 }}>
              CAROUSEL STUDIO
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#8a7a5a", letterSpacing: 3, textTransform: "uppercase" }}>
              Generador de carruseles con IA
            </p>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 100px)" }}>
        {/* ─── Left Panel ─── */}
        <div style={{
          width: 440, padding: "32px 28px", borderRight: "1px solid rgba(212,168,83,0.1)",
          overflowY: "auto", flexShrink: 0,
        }}>
          {/* Expert Photo */}
          <label style={labelStyle}>Foto del experto</label>
          <div style={{
            display: "flex", alignItems: "center", gap: 14, marginBottom: 24,
            padding: 16, background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(212,168,83,0.25)", borderRadius: 10,
          }}>
            {expertPhoto ? (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", overflow: "hidden",
                  border: "2px solid rgba(212,168,83,0.4)", flexShrink: 0,
                }}>
                  <img src={expertPhoto.preview} alt="Expert" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#c9b99a" }}>Foto cargada</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6a5f48" }}>
                    Aparecerá en todos los slides
                  </p>
                </div>
                <button onClick={removeExpert} style={{
                  padding: "6px 12px", background: "rgba(255,80,80,0.1)",
                  border: "1px solid rgba(255,80,80,0.3)", borderRadius: 6,
                  color: "#ff6b6b", fontSize: 12, cursor: "pointer",
                }}>✕</button>
              </>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, textAlign: "center", cursor: "pointer", padding: "8px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.5 }}>📷</div>
                <p style={{ margin: 0, fontSize: 14, color: "#8a7a5a" }}>Click para subir foto del experto</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5a5040" }}>Se transformará al estilo elegido</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleExpertUpload} style={{ display: "none" }} />
          </div>

          {/* Slide Text */}
          <label style={labelStyle}>
            Texto de los slides
            <span style={{ fontSize: 11, color: "#6a5f48", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>
              (separá cada slide con ---)
            </span>
          </label>
          <textarea
            value={slideText}
            onChange={(e) => setSlideText(e.target.value)}
            placeholder={`¿Tu equipo de ventas no cierra?\nEl problema no son ellos...\n---\nError #1: No tener un proceso definido\nSin proceso, cada vendedor improvisa. Y la improvisación no escala.\n---\nError #2: No medir las métricas correctas\nSi solo mirás el cierre, llegás tarde. Medí actividad, no solo resultados.\n---\nError #3: No hacer role-play\nPracticar es lo que separa a los buenos de los excelentes.\n---\n¿Querés el checklist completo para tu equipo?`}
            rows={12}
            style={{
              ...inputStyle, padding: "14px 16px", resize: "vertical",
              lineHeight: 1.6, fontSize: 14,
            }}
          />

          {/* Slide count indicator */}
          <div style={{
            marginTop: 8, fontSize: 13, color: slideCount >= 2 ? "#6abf6a" : "#e85555",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              background: slideCount >= 2 ? "#6abf6a" : "#e85555",
            }} />
            {slideCount} slide{slideCount !== 1 ? "s" : ""} detectado{slideCount !== 1 ? "s" : ""}
            {slideCount < 2 && " — mínimo 2 slides"}
          </div>

          {/* Keyword + Scene */}
          <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Palabra clave CTA</label>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ej: VENTAS" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>
              Escena / Contexto visual
              <span style={{ fontSize: 11, color: "#6a5f48", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>
                (opcional)
              </span>
            </label>
            <input
              value={sceneHint}
              onChange={(e) => setSceneHint(e.target.value)}
              placeholder="Ej: oficina moderna con vista a la ciudad, parque con árboles verdes..."
              style={inputStyle}
            />
          </div>

          {/* Template */}
          <label style={{ ...labelStyle, marginTop: 24, marginBottom: 12 }}>Template</label>
          <div style={{ display: "flex", gap: 10 }}>
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setSelectedTemplate(t.id)} style={{
                flex: 1, padding: "14px 8px", background: t.preview,
                border: selectedTemplate === t.id ? `2px solid ${t.accent}` : "2px solid rgba(255,255,255,0.08)",
                borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
              }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: t.accent, margin: "0 auto 8px" }} />
                <span style={{ fontSize: 11, color: t.textColor, fontWeight: selectedTemplate === t.id ? 700 : 400 }}>
                  {t.name}
                </span>
              </button>
            ))}
          </div>

          {/* Style */}
          <label style={{ ...labelStyle, marginTop: 24, marginBottom: 12 }}>Estilo de imagen</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {IMAGE_STYLES.map((s) => (
              <button key={s.id} onClick={() => setSelectedStyle(s.id)} style={{
                padding: "12px 8px",
                background: selectedStyle === s.id ? "rgba(212,168,83,0.15)" : "rgba(255,255,255,0.03)",
                border: selectedStyle === s.id ? "1px solid rgba(212,168,83,0.5)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, cursor: "pointer", color: "#e8e0d0", fontSize: 14, fontFamily: "inherit",
                transition: "all 0.2s",
              }}>
                {s.name}
              </button>
            ))}
          </div>

          {expertPhoto && (
            <div style={{
              marginTop: 16, padding: "10px 14px",
              background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.15)",
              borderRadius: 8, fontSize: 12, color: "#a89870",
            }}>
              💡 El experto se transformará al estilo <strong style={{ color: "#d4a853" }}>{style.name}</strong>
            </div>
          )}

          {/* Generate */}
          <button
            onClick={generate}
            disabled={generating || slideCount < 2}
            style={{
              width: "100%", marginTop: 24, padding: "16px",
              background: generating ? "rgba(212,168,83,0.2)" : "linear-gradient(135deg, #d4a853, #a88230)",
              border: "none", borderRadius: 10, color: generating ? "#a89870" : "#0a0a0a",
              fontSize: 16, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
              letterSpacing: 1, textTransform: "uppercase", transition: "all 0.3s",
            }}
          >
            {generating ? "Generando..." : `Generar ${slideCount} Slides`}
          </button>

          {generating && (
            <div style={{ marginTop: 20 }}>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "linear-gradient(90deg, #d4a853, #e8c468)",
                  width: totalSteps ? `${(progress / totalSteps) * 100}%` : "0%",
                  transition: "width 0.5s ease", borderRadius: 2,
                }} />
              </div>
              <p style={{ marginTop: 10, fontSize: 13, color: "#8a7a5a" }}>{status}</p>
            </div>
          )}

          {!generating && status && (
            <p style={{ marginTop: 16, fontSize: 13, color: status.startsWith("Error") ? "#e85555" : "#6abf6a" }}>
              {status}
            </p>
          )}
        </div>

        {/* ─── Right Panel ─── */}
        <div style={{ flex: 1, padding: "32px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {previews.length === 0 && !generating && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "#4a4535", textAlign: "center", maxWidth: 400,
            }}>
              <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.3 }}>📊</div>
              <p style={{ fontSize: 18, margin: 0 }}>Tu carrusel aparecerá aquí</p>
              <p style={{ fontSize: 14, marginTop: 12, color: "#3a3525", lineHeight: 1.6 }}>
                Escribí el texto de cada slide separado por <strong style={{ color: "#8a7a5a" }}>---</strong> y hacé click en Generar
              </p>
            </div>
          )}

          {previews.length > 0 && (
            <>
              <div style={{
                width: "100%", maxWidth: 520, aspectRatio: "1",
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,168,83,0.1)",
              }}>
                <img src={previews[previewIdx]} alt={`Slide ${previewIdx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                  disabled={previewIdx === 0} style={{
                    padding: "8px 16px", background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, color: "#d4a853",
                    cursor: previewIdx === 0 ? "not-allowed" : "pointer", fontSize: 18,
                    opacity: previewIdx === 0 ? 0.3 : 1,
                  }}>←</button>
                <span style={{ fontSize: 14, color: "#8a7a5a", minWidth: 80, textAlign: "center" }}>
                  {previewIdx + 1} / {previews.length}
                </span>
                <button onClick={() => setPreviewIdx(Math.min(previews.length - 1, previewIdx + 1))}
                  disabled={previewIdx === previews.length - 1} style={{
                    padding: "8px 16px", background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, color: "#d4a853",
                    cursor: previewIdx === previews.length - 1 ? "not-allowed" : "pointer", fontSize: 18,
                    opacity: previewIdx === previews.length - 1 ? 0.3 : 1,
                  }}>→</button>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
                {previews.map((p, i) => (
                  <button key={i} onClick={() => setPreviewIdx(i)} style={{
                    width: 56, height: 56, padding: 0,
                    border: previewIdx === i ? "2px solid #d4a853" : "2px solid rgba(255,255,255,0.08)",
                    borderRadius: 6, overflow: "hidden", cursor: "pointer",
                    opacity: previewIdx === i ? 1 : 0.6, transition: "all 0.2s", background: "none",
                  }}>
                    <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button onClick={downloadZip} style={{
                  padding: "14px 32px",
                  background: "linear-gradient(135deg, #d4a853, #a88230)",
                  border: "none", borderRadius: 8, color: "#0a0a0a",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
                }}>⬇ Descargar ZIP</button>
              </div>
            </>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
