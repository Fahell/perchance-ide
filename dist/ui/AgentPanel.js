import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n/index.js";
import { clearMessages as clearPersistedMessages } from "../message-store.js";
import { ideStore } from "../store.js";
import { ChatMessages } from "./ChatMessages.js";
import { CodeEditor } from "./CodeEditor.js";
import { ContextViewer } from "./ContextViewer.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FaqModal } from "./FaqModal.js";
import { FileSearchModal } from "./FileSearchModal.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { MessageList } from "./MessageList.js";
import { RightPanel } from "./RightPanel.js";
import { ScrollFAB } from "./ScrollFAB.js";
import { SettingsModal } from "./SettingsModal.js";
import { colors, fonts } from "./theme.js";
export function AgentPanel({ version, commit, currentApiKey, userName, locale: initialLocale, onSettingsSave, onLocaleChange, onSendMessage, onCancel, onContinue }) {
    const [store, setStore] = useState(ideStore.getState());
    useEffect(() => ideStore.subscribe((s) => setStore(s)), []);
    const { messages, agentStatus } = store;
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [contextOpen, setContextOpen] = useState(false);
    const [faqOpen, setFaqOpen] = useState(false);
    const [showFileSearch, setShowFileSearch] = useState(false);
    const [apiKey, setApiKey] = useState(currentApiKey);
    const [locale, setLocale] = useState(initialLocale || "en");
    const scrollRef = useRef(null);
    const handleLocaleChange = (l) => {
        setLocale(l);
        onLocaleChange(l);
    };
    const handleClearConversation = async () => {
        if (agentStatus !== "idle")
            return;
        if (!confirm("Clear all messages? This cannot be undone."))
            return;
        ideStore.getState().clearMessages();
        await clearPersistedMessages();
    };
    // ── Global keyboard shortcuts ──────────────────────────
    useKeyboardShortcuts({
        settingsOpen,
        contextOpen,
        faqOpen,
        agentStatus,
        locale,
        setSettingsOpen,
        setContextOpen,
        setFaqOpen,
        setShowFileSearch,
    });
    return (_jsxs("div", { style: {
            fontFamily: fonts.mono,
            background: colors.bg,
            color: colors.text,
            width: "100%",
            height: "100vh",
            margin: "0",
            padding: "0",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            overflow: "hidden",
        }, children: [_jsx(Header, { version: version, commit: commit, onFaq: () => setFaqOpen(true) }), _jsxs("div", { style: {
                    display: "flex",
                    flex: "1",
                    minHeight: "0",
                    overflow: "hidden",
                }, children: [_jsxs("div", { style: {
                            width: "300px",
                            minWidth: "300px",
                            display: "flex",
                            flexDirection: "column",
                            borderRight: `1px solid ${colors.border}`,
                        }, children: [_jsxs("div", { style: { position: "relative", flex: "1", minHeight: "0", display: "flex", flexDirection: "column" }, children: [_jsx(ErrorBoundary, { name: "MessageList", children: _jsxs(MessageList, { outerRef: scrollRef, children: [messages.length === 0 && (_jsxs("div", { style: {
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        height: "100%",
                                                        color: colors.textMuted,
                                                        textAlign: "center",
                                                        padding: "20px",
                                                        fontFamily: fonts.mono,
                                                    }, children: [_jsx("div", { style: { fontSize: "12px", marginBottom: "6px" }, children: _jsxs("span", { children: [t("panel.ready", locale), _jsx("span", { style: { animation: "cursor-blink 1s step-end infinite" }, children: "|" })] }) }), _jsxs("div", { style: { fontSize: "9px", color: colors.textMuted }, children: ["v", version, "+", commit] })] })), _jsx(ChatMessages, { messages: messages, agentStatus: agentStatus, locale: locale, userName: userName, onContinue: onContinue })] }) }), _jsx(ScrollFAB, { scrollRef: scrollRef })] }), _jsx("div", { className: `status-line${agentStatus !== "idle" ? ` status-line--${agentStatus}` : ""}` }), _jsx(Footer, { onSettings: () => setSettingsOpen(true), onContext: () => setContextOpen(true), onClear: handleClearConversation, inputEnabled: true, onSend: onSendMessage, disabled: agentStatus !== "idle", onCancel: onCancel, locale: locale })] }), _jsx("div", { style: { flex: "1", minWidth: "0" }, children: _jsx(ErrorBoundary, { name: "CodeEditor", children: _jsx(CodeEditor, { locale: locale }) }) }), _jsx("div", { style: { width: "300px", minWidth: "300px" }, children: _jsx(ErrorBoundary, { name: "RightPanel", children: _jsx(RightPanel, { locale: locale }) }) })] }), _jsx(ContextViewer, { isOpen: contextOpen, locale: locale, onClose: () => setContextOpen(false), onRefresh: () => setContextOpen(false) }), _jsx(FaqModal, { isOpen: faqOpen, locale: locale, onClose: () => setFaqOpen(false) }), _jsx(SettingsModal, { isOpen: settingsOpen, currentKey: apiKey, onClose: () => setSettingsOpen(false), onSave: async (key) => {
                    const ok = await onSettingsSave(key);
                    if (ok)
                        setApiKey(key);
                    return ok;
                }, locale: locale, onLocaleChange: handleLocaleChange }), _jsx(FileSearchModal, { isOpen: showFileSearch, onClose: () => setShowFileSearch(false), locale: locale })] }));
}
