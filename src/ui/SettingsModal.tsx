import { h } from "preact";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";

import type { PanelMode } from "./types.js";

interface SettingsModalProps {
  isOpen: boolean;
  currentKey: string;
  panelMode: PanelMode;
  inputEnabled: boolean;
  onClose: () => void;
  onSave: (key: string) => Promise<boolean>;
  onPanelModeChange: (mode: PanelMode) => void;
  onInputEnabledChange: (enabled: boolean) => void;
}

export function SettingsModal({ isOpen, currentKey, panelMode, inputEnabled, onClose, onSave, onPanelModeChange, onInputEnabledChange }: SettingsModalProps) {
  const [key, setKey] = useState(currentKey);
  const [msg, setMsg] = useState("");

  if (!isOpen) return null;

  async function handleSave() {
    if (!key.trim()) {
      setMsg("[!!] insert a key");
      return;
    }
    setMsg("[...] validating");
    const ok = await onSave(key.trim());
    setMsg(ok ? "[ok] saved" : "[!!] invalid key");
    if (ok) setTimeout(onClose, 800);
  }

  const maskedKey = currentKey
    ? currentKey.slice(0, 8) + "..." + currentKey.slice(-4)
    : "none";

  const isCompact = panelMode === "tools-only";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        background: "rgba(0,0,0,0.85)",
        zIndex: "1000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg,
          padding: "20px",
          maxWidth: "380px",
          width: "90%",
          border: `1px solid ${colors.border}`,
        }}
      >
        <h3 style={{ margin: "0 0 16px", color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
          settings
        </h3>

        {/* Panel mode toggle */}
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>compact mode</div>
              <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "2px", fontFamily: fonts.mono }}>tool calls + status only</div>
            </div>
            <div
              onClick={() => onPanelModeChange(isCompact ? "full" : "tools-only")}
              style={{
                cursor: "pointer",
                fontFamily: fonts.mono,
                fontSize: "10px",
                color: isCompact ? colors.text : colors.textMuted,
                border: `1px solid ${isCompact ? colors.text : colors.border}`,
                padding: "3px 8px",
                letterSpacing: "0.5px",
                transition: "all 0.15s",
              }}
            >
              {isCompact ? "on" : "off"}
            </div>
          </div>
        </div>

        {/* Panel input toggle */}
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>panel input</div>
              <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "2px", fontFamily: fonts.mono }}>type messages in the panel</div>
            </div>
            <div
              onClick={() => onInputEnabledChange(!inputEnabled)}
              style={{
                cursor: "pointer",
                fontFamily: fonts.mono,
                fontSize: "10px",
                color: inputEnabled ? colors.text : colors.textMuted,
                border: `1px solid ${inputEnabled ? colors.text : colors.border}`,
                padding: "3px 8px",
                letterSpacing: "0.5px",
                transition: "all 0.15s",
              }}
            >
              {inputEnabled ? "on" : "off"}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ color: colors.textMuted, fontSize: "9px", display: "block", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
            jina api key
          </label>
          <input
            type="password"
            value={key}
            onInput={(e) => setKey((e.target as HTMLInputElement).value)}
            placeholder="jina_xxx..."
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}>
            current: {maskedKey}
          </div>
        </div>

        {msg && (
          <div style={{
            fontSize: "10px",
            marginBottom: "10px",
            color: msg.startsWith("[ok]") ? colors.textSecondary : msg.startsWith("[!!]") ? colors.statusError : colors.textMuted,
            fontFamily: fonts.mono,
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            onClick={handleSave}
            style={{
              flex: "1",
              padding: "8px",
              border: `1px solid ${colors.text}`,
              background: "transparent",
              color: colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              letterSpacing: "0.5px",
            }}
          >
            save
          </button>
          <button
            onClick={onClose}
            style={{
              flex: "1",
              padding: "8px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textMuted,
              fontSize: "11px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              letterSpacing: "0.5px",
            }}
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
