import { h } from "preact";
import { useState } from "preact/hooks";
import { colors } from "./theme.js";

import type { PanelMode } from "./types.js";

interface SettingsModalProps {
  isOpen: boolean;
  currentKey: string;
  panelMode: PanelMode;
  onClose: () => void;
  onSave: (key: string) => Promise<boolean>;
  onPanelModeChange: (mode: PanelMode) => void;
}

export function SettingsModal({ isOpen, currentKey, panelMode, onClose, onSave, onPanelModeChange }: SettingsModalProps) {
  const [key, setKey] = useState(currentKey);
  const [msg, setMsg] = useState("");

  if (!isOpen) return null;

  async function handleSave() {
    if (!key.trim()) {
      setMsg("Insira uma chave.");
      return;
    }
    setMsg("Validando...");
    const ok = await onSave(key.trim());
    setMsg(ok ? "✅ Chave salva!" : "❌ Chave inválida.");
    if (ok) setTimeout(onClose, 800);
  }

  const maskedKey = currentKey
    ? currentKey.slice(0, 8) + "..." + currentKey.slice(-4)
    : "Nenhuma";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        background: "rgba(0,0,0,0.7)",
        zIndex: "1000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.card,
          borderRadius: "10px",
          padding: "16px",
          maxWidth: "360px",
          width: "90%",
          border: `1px solid ${colors.border}`,
        }}
      >
        <h3 style={{ margin: "0 0 10px", color: colors.text, fontSize: "14px" }}>⚙️ Configurações</h3>

        {/* Panel mode toggle */}
        <div style={{ marginBottom: "12px", padding: "8px", borderRadius: "6px", background: colors.inputBg, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: colors.text, fontSize: "12px", fontWeight: "bold" }}>📊 Modo compacto</div>
              <div style={{ color: colors.textMuted, fontSize: "10px", marginTop: "2px" }}>Mostra apenas tool calls e status</div>
            </div>
            <div
              onClick={() => onPanelModeChange(panelMode === "full" ? "tools-only" : "full")}
              style={{
                width: "36px", height: "20px", borderRadius: "10px", cursor: "pointer",
                background: panelMode === "tools-only" ? colors.accent : colors.border,
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                width: "16px", height: "16px", borderRadius: "50%", background: colors.text,
                position: "absolute", top: "2px",
                left: panelMode === "tools-only" ? "18px" : "2px",
                transition: "left 0.2s",
              }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label style={{ color: colors.textSecondary, fontSize: "11px", display: "block", marginBottom: "3px" }}>
            Chave de API da Jina:
          </label>
          <input
            type="password"
            value={key}
            onInput={(e) => setKey((e.target as HTMLInputElement).value)}
            placeholder="jina_xxx..."
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "4px",
              border: `1px solid ${colors.border}`,
              background: colors.inputBg,
              color: colors.text,
              fontSize: "12px",
              fontFamily: "monospace",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <div style={{ color: colors.textMuted, fontSize: "10px", marginTop: "3px" }}>
            Atual: {maskedKey}
          </div>
        </div>

        {msg && (
          <div style={{
            fontSize: "11px",
            marginBottom: "6px",
            color: msg.startsWith("✅") ? colors.success : msg.startsWith("❌") ? colors.error : colors.textSecondary,
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
          <button
            onClick={handleSave}
            style={{
              flex: "1",
              padding: "6px",
              borderRadius: "4px",
              border: "none",
              background: colors.accent,
              color: colors.bg,
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            style={{
              flex: "1",
              padding: "6px",
              borderRadius: "4px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textSecondary,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
