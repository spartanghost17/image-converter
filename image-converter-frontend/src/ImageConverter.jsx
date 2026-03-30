import { useState, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8080/api";

// ─── Styles ───────────────────────────────────────────
const palette = {
  bg: "#0C0C0E",
  surface: "#151518",
  surfaceHover: "#1C1C20",
  border: "#2A2A30",
  borderFocus: "#5B5BFF",
  text: "#E8E8EC",
  textMuted: "#8A8A96",
  textDim: "#5A5A66",
  accent: "#6C6CFF",
  accentGlow: "rgba(108, 108, 255, 0.15)",
  success: "#3DDC84",
  successBg: "rgba(61, 220, 132, 0.08)",
  error: "#FF5C5C",
  errorBg: "rgba(255, 92, 92, 0.08)",
  white: "#FFFFFF",
};

const font = `'DM Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif`;
const mono = `'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace`;

// ─── Main Component ───────────────────────────────────
export default function ImageConverter() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [quality, setQuality] = useState(0.85);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState(null); // { url, size, name }
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    setImageInfo(null);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);

    // Get image info from backend
    const formData = new FormData();
    formData.append("file", f);
    fetch(`${API_BASE}/info`, { method: "POST", body: formData })
      .then((r) => r.ok ? r.json() : null)
      .then((info) => info && setImageInfo(info))
      .catch(() => {}); // non-critical
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const convert = async () => {
    if (!file) return;
    setConverting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("quality", quality.toString());

      const resp = await fetch(`${API_BASE}/convert`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "Conversion failed");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const disposition = resp.headers.get("Content-Disposition");
      let name = "converted.jpg";
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match) name = match[1];
      }

      setResult({ url, size: blob.size, name });
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  };

  const reset = () => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setImageInfo(null);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  };

  const getExtension = (name) => {
    const parts = name?.split(".");
    return parts?.length > 1 ? parts.pop().toUpperCase() : "?";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: palette.bg,
      fontFamily: font,
      color: palette.text,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "48px 24px",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          padding: "6px 16px",
          background: palette.accentGlow,
          borderRadius: 100,
          border: `1px solid ${palette.accent}33`,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: palette.accent,
            boxShadow: `0 0 8px ${palette.accent}`,
          }}/>
          <span style={{ fontSize: 13, fontWeight: 500, color: palette.accent, letterSpacing: "0.04em" }}>
            IMAGE CONVERTER
          </span>
        </div>
        <h1 style={{
          fontSize: 40, fontWeight: 700, margin: "0 0 8px",
          background: `linear-gradient(135deg, ${palette.text} 0%, ${palette.textMuted} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
        }}>
          Any image → JPG
        </h1>
        <p style={{ fontSize: 16, color: palette.textMuted, margin: 0, lineHeight: 1.5 }}>
          PNG, WebP, TIFF, BMP, GIF, PSD — drop it in, get a JPG out
        </p>
      </div>

      {/* Main card */}
      <div style={{
        width: "100%",
        maxWidth: 620,
        background: palette.surface,
        borderRadius: 20,
        border: `1px solid ${palette.border}`,
        overflow: "hidden",
      }}>

        {/* Drop zone */}
        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: "64px 40px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? palette.accentGlow : "transparent",
              transition: "background 0.2s",
              borderBottom: `1px solid ${palette.border}`,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              style={{ display: "none" }}
            />
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px",
              background: palette.accentGlow,
              border: `2px dashed ${dragOver ? palette.accent : palette.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "border-color 0.2s",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, margin: "0 0 6px", color: palette.text }}>
              Drop your image here
            </p>
            <p style={{ fontSize: 14, color: palette.textMuted, margin: 0 }}>
              or click to browse — supports PNG, WebP, TIFF, BMP, GIF, PSD
            </p>
          </div>
        )}

        {/* File loaded state */}
        {file && (
          <>
            {/* Preview */}
            <div style={{
              padding: 20,
              borderBottom: `1px solid ${palette.border}`,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}>
              {preview && (
                <div style={{
                  width: 80, height: 80, borderRadius: 12,
                  overflow: "hidden", flexShrink: 0,
                  border: `1px solid ${palette.border}`,
                  background: `repeating-conic-gradient(${palette.border} 0% 25%, transparent 0% 50%) 0 0 / 16px 16px`,
                }}>
                  <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 15, fontWeight: 600, margin: "0 0 4px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {file.name}
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Tag label={getExtension(file.name)} />
                  <Tag label={formatSize(file.size)} />
                  {imageInfo && <Tag label={`${imageInfo.width} × ${imageInfo.height}`} />}
                  {imageInfo?.hasAlpha && <Tag label="Has alpha" color={palette.accent} />}
                </div>
              </div>
              <button onClick={reset} style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: palette.textMuted, padding: 8, borderRadius: 8,
                display: "flex",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Quality slider */}
            <div style={{ padding: "20px 20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: palette.text }}>
                  JPG quality
                </label>
                <span style={{
                  fontFamily: mono, fontSize: 14, fontWeight: 600,
                  color: palette.accent, letterSpacing: "-0.01em",
                }}>
                  {Math.round(quality * 100)}%
                </span>
              </div>

              {/* Custom slider */}
              <div style={{ position: "relative", height: 36, display: "flex", alignItems: "center" }}>
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 4,
                  borderRadius: 2, background: palette.border,
                }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    width: `${quality * 100}%`,
                    background: `linear-gradient(90deg, ${palette.accent}, #8B8BFF)`,
                    transition: "width 0.05s",
                  }}/>
                </div>
                <input
                  type="range" min="0" max="100" value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(parseInt(e.target.value) / 100)}
                  style={{
                    position: "absolute", width: "100%", height: 36,
                    opacity: 0, cursor: "pointer", margin: 0,
                  }}
                />
                <div style={{
                  position: "absolute",
                  left: `calc(${quality * 100}% - 10px)`,
                  width: 20, height: 20, borderRadius: "50%",
                  background: palette.white, border: `3px solid ${palette.accent}`,
                  boxShadow: `0 0 12px ${palette.accent}55`,
                  transition: "left 0.05s",
                  pointerEvents: "none",
                }}/>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: palette.textDim }}>Smaller file</span>
                <span style={{ fontSize: 12, color: palette.textDim }}>Higher quality</span>
              </div>
            </div>

            {/* Convert button */}
            <div style={{ padding: "0 20px 20px" }}>
              <button
                onClick={convert}
                disabled={converting}
                style={{
                  width: "100%", padding: "14px 24px",
                  background: converting ? palette.border : palette.accent,
                  color: palette.white, border: "none",
                  borderRadius: 12, fontSize: 15, fontWeight: 600,
                  cursor: converting ? "not-allowed" : "pointer",
                  fontFamily: font, letterSpacing: "0.01em",
                  transition: "all 0.2s",
                  boxShadow: converting ? "none" : `0 4px 24px ${palette.accent}44`,
                }}
              >
                {converting ? "Converting..." : "Convert to JPG"}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                margin: "0 20px 20px", padding: "12px 16px",
                background: palette.errorBg, borderRadius: 10,
                border: `1px solid ${palette.error}22`,
                fontSize: 14, color: palette.error,
              }}>
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div style={{
                margin: "0 20px 20px", padding: 20,
                background: palette.successBg, borderRadius: 14,
                border: `1px solid ${palette.success}22`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={palette.success} strokeWidth="2" strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 600, color: palette.success }}>
                    Conversion complete
                  </span>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <Stat label="Original" value={formatSize(file.size)} />
                  <Stat label="JPG output" value={formatSize(result.size)} />
                  <Stat
                    label="Reduction"
                    value={`${Math.round((1 - result.size / file.size) * 100)}%`}
                    highlight
                  />
                </div>

                {/* Side-by-side preview */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <PreviewPane label="Original" src={preview} />
                  <PreviewPane label="JPG" src={result.url} />
                </div>

                <a
                  href={result.url}
                  download={result.name}
                  style={{
                    display: "block", textAlign: "center",
                    padding: "12px 24px",
                    background: palette.success, color: palette.bg,
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    textDecoration: "none", fontFamily: font,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = "0.88"}
                  onMouseLeave={(e) => e.target.style.opacity = "1"}
                >
                  Download {result.name}
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pipeline info footer */}
      <div style={{
        marginTop: 32, maxWidth: 620, width: "100%",
        padding: "20px 24px",
        background: palette.surface,
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
      }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: palette.textMuted, margin: "0 0 10px" }}>
          What happens when you click convert:
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Decode source", "RGB → YCbCr", "Chroma subsample", "8×8 DCT", "Quantize", "Huffman encode"].map((step, i) => (
            <span key={i} style={{
              fontSize: 12, fontFamily: mono,
              padding: "4px 10px", borderRadius: 6,
              background: `${palette.accent}11`,
              border: `1px solid ${palette.accent}22`,
              color: palette.accent,
              whiteSpace: "nowrap",
            }}>
              {i + 1}. {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────
function Tag({ label, color }) {
  return (
    <span style={{
      fontSize: 12, fontFamily: `'JetBrains Mono', monospace`,
      padding: "3px 8px", borderRadius: 6,
      background: color ? `${color}15` : `${palette.text}08`,
      color: color || palette.textMuted,
      border: `1px solid ${color ? `${color}22` : palette.border}`,
    }}>
      {label}
    </span>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{
      flex: 1, padding: "10px 12px",
      background: highlight ? `${palette.accent}11` : `${palette.bg}88`,
      borderRadius: 10,
      border: `1px solid ${highlight ? `${palette.accent}22` : palette.border}`,
    }}>
      <p style={{ fontSize: 11, color: palette.textMuted, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <p style={{
        fontSize: 16, fontWeight: 700, margin: 0, fontFamily: `'JetBrains Mono', monospace`,
        color: highlight ? palette.accent : palette.text,
      }}>
        {value}
      </p>
    </div>
  );
}

function PreviewPane({ label, src }) {
  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 11, color: palette.textMuted, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <div style={{
        height: 120, borderRadius: 10, overflow: "hidden",
        border: `1px solid ${palette.border}`,
        background: `repeating-conic-gradient(${palette.border} 0% 25%, transparent 0% 50%) 0 0 / 12px 12px`,
      }}>
        <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
      </div>
    </div>
  );
}
