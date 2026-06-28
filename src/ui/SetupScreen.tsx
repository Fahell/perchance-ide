import { h } from "preact";
import { useState } from "preact/hooks";
import { colors } from "./theme.js";

interface SetupScreenProps {
  version: string;
  onSetupComplete: () => void;
  validateApiKey: (key: string) => Promise<boolean>;
  saveApiKey: (key: string) => void;
}

export function SetupScreen({ version, onSetupComplete, validateApiKey, saveApiKey }: SetupScreenProps) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "error" | "success">("idle");
  const [error, setError] = useState("");

  async function handleSave() {
    if (!key.trim()) {
      setError("Por favor, insira uma chave de API.");
      setStatus("error");
      return;
    }
    setStatus("validating");
    const valid = await validateApiKey(key.trim());
    if (valid) {
      saveApiKey(key.trim());
      setStatus("success");
      setTimeout(() => onSetupComplete(), 800);
    } else {
      setError("Chave inválida. Verifique e tente novamente.");
      setStatus("error");
    }
  }

  return (
    <div style={{
      fontFamily: fonts.main,
      padding: "24px",
      background: colors.bg,
      color: colors.text,
      height: "100vh",
      margin: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
    }}>
      <div style={{ maxWidth: "400px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "6px" }}>🤖</div>
          <h2 style={{ margin: "0", color: colors.accent, fontSize: "18px" }}>Agent for Perchance</h2>
          <span style={{ fontSize: "10px", color: colors.textMuted }}>v{version}</span>
        </div>

        <div style={{
          background: colors.card,
          borderRadius: "10px",
          padding: "16px",
          border: `1px solid ${colors.border}`,
        }}>
          <h3 style={{ margin: "0 0 10px", color: colors.text, fontSize: "14px" }}>
            ⚡ Setup — Chave de API da Jina
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: "12px", margin: "0 0 10px", lineHeight: "1.5" }}>
            Para usar busca na web, você precisa de uma chave de API{" "}
            <strong style={{ color: colors.success }}>gratuita</strong> da Jina AI.
          </p>
          <ol style={{ color: colors.textSecondary, fontSize: "12px", margin: "0 0 14px", paddingLeft: "18px", lineHeight: "1.8" }}>
            <li>Acesse <a href="https://jina.ai/?sui=apikey" target="_blank" style={{ color: colors.accent, textDecoration: "none" }}>jina.ai/?sui=apikey</a></li>
            <li>Crie uma conta gratuita (ou faça login)</li>
            <li>Copie sua chave de API</li>
            <li>Cole no campo abaixo</li>
          </ol>

          <input
            type="password"
            placeholder="jina_xxxxxxxxxxxx..."
            value={key}
            onInput={(e) => setKey((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: colors.inputBg,
              color: colors.text,
              fontSize: "13px",
              fontFamily: "monospace",
              boxSizing: "border-box",
              outline: "none",
              marginBottom: "10px",
            }}
          />

          {status === "error" && (
            <div style={{ color: colors.error, fontSize: "11px", marginBottom: "8px" }}>
              ❌ {error}
            </div>
          )}
          {status === "success" && (
            <div style={{ color: colors.success, fontSize: "11px", marginBottom: "8px" }}>
              ✅ Chave válida! Iniciando...
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={status === "validating"}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "none",
              background: colors.accent,
              color: colors.bg,
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              opacity: status === "validating" ? "0.6" : "1",
            }}
          >
            {status === "validating" ? "Validando..." : "Salvar e Iniciar"}
          </button>
          <button
            onClick={onSetupComplete}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textMuted,
              fontSize: "11px",
              cursor: "pointer",
              marginTop: "6px",
            }}
          >
            Pular (sem busca na web)
          </button>
        </div>

        <p style={{ color: "#555", fontSize: "10px", textAlign: "center", marginTop: "12px" }}>
          ℹ️ Sua chave é salva localmente e nunca é compartilhada.
        </p>
      </div>
    </div>
  );
}

const fonts = { main: "system-ui, -apple-system, sans-serif" };
