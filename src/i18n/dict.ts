/**
 * Translation dictionaries — Agent Panel i18n
 *
 * Keys use dot notation: "section.key"
 * Fallback chain: current locale → en → raw key
 * ThinkingIndicator fragments and tool names are intentionally NOT translated.
 */

export const LOCALES = ["en", "pt-BR", "es", "ja", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
  ja: "日本語",
  zh: "中文",
};

type Translations = Record<string, string>;

const en: Translations = {
  // Settings
  "settings.title": "settings",
  "settings.compactMode": "compact mode",
  "settings.compactMode.desc": "tool calls + status only",
  "settings.panelInput": "panel input",
  "settings.panelInput.desc": "type messages in the panel",
  "settings.apiKey": "jina api key",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "current: {key}",
  "settings.apiKey.error.empty": "[!!] insert a key",
  "settings.apiKey.validating": "[...] validating",
  "settings.apiKey.saved": "[ok] saved",
  "settings.apiKey.error.invalid": "[!!] invalid key",
  "settings.language": "language",
  "settings.toggle.on": "on",
  "settings.toggle.off": "off",
  "settings.save": "save",
  "settings.close": "close",

  // Panel
  "panel.ready": "ready",
  "panel.compact": "compact — tool calls only",

  // Response
  "response.label": "agent",
  "response.expand": "expand",
  "response.collapse": "collapse",

  // User
  "user.you": "you",

  // Tool cards
  "tool.args": "args:",

  // Setup
  "setup.title": "agent",
  "setup.sectionHeader": "[ setup ] jina api key",
  "setup.description.1": "web search requires a free",
  "setup.description.2": "Jina AI",
  "setup.description.3": "API key.",
  "setup.step1": "go to",
  "setup.step2": "create free account (or login)",
  "setup.step3": "copy your api key",
  "setup.step4": "paste below",
  "setup.apiKey.placeholder": "jina_xxx...",
  "setup.saveAndStart": "save + start",
  "setup.validating": "[...] validating",
  "setup.skip": "skip (no web search)",
  "setup.privacy": "your key is stored locally and never shared.",
  "setup.success": "valid key. starting...",
  "setup.desc": "web search requires a free Jina AI API key.",
  "setup.error.empty": "insert a key",
  "setup.error.invalid": "invalid key. check and try again.",
  "setup.save": "save + start",
  "setup.note": "your key is stored locally and never shared.",

  // Footer
  "footer.waiting": "waiting...",

  // Context Viewer
  "context.title": "context",
  "context.tokens": "tokens",
  "context.summary": "summary",
  "context.noSummary": "no summary yet — will be generated when conversation exceeds token budget",
  "context.messages": "messages",
  "context.noMessages": "no messages yet",
  "context.memories": "memories",
  "context.noMemories": "no memories extracted yet",
  "context.tier.hot": "hot — in prompt",
  "context.tier.warm": "warm — searchable",
  "context.chunks": "chunked summaries",
  "context.noChunks": "no chunks yet",
  "context.totalHistory": "total messages",
  "context.searchPlaceholder": "search history...",
  "context.search": "search",

  // FAQ
  "faq.title": "faq",

  // Editor
  "editor.title": "editor",
  "editor.placeholder": "// write code or text here...",
  "editor.clear": "clear",
  "editor.send": "send →",

  // Right Panel
  "rightPanel.placeholder": "panel coming soon",
};

const ptBR: Translations = {
  // Settings
  "settings.title": "configurações",
  "settings.compactMode": "modo compacto",
  "settings.compactMode.desc": "apenas tool calls + status",
  "settings.panelInput": "input no painel",
  "settings.panelInput.desc": "digitar mensagens no painel",
  "settings.apiKey": "chave api jina",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "atual: {key}",
  "settings.apiKey.error.empty": "[!!] insira uma chave",
  "settings.apiKey.validating": "[...] validando",
  "settings.apiKey.saved": "[ok] salva",
  "settings.apiKey.error.invalid": "[!!] chave inválida",
  "settings.language": "idioma",
  "settings.toggle.on": "ligado",
  "settings.toggle.off": "desligado",
  "settings.save": "salvar",
  "settings.close": "fechar",

  // Panel
  "panel.ready": "pronto",
  "panel.compact": "compacto — apenas tool calls",

  // Response
  "response.label": "agente",
  "response.expand": "expandir",
  "response.collapse": "recolher",

  // User
  "user.you": "você",

  // Tool cards
  "tool.args": "args:",

  // Setup
  "setup.title": "agente",
  "setup.sectionHeader": "[ config ] chave api jina",
  "setup.description.1": "busca web requer uma",
  "setup.description.2": "Jina AI",
  "setup.description.3": "gratuita.",
  "setup.step1": "acesse",
  "setup.step2": "crie uma conta gratuita (ou faça login)",
  "setup.step3": "copie sua chave api",
  "setup.step4": "cole abaixo",
  "setup.apiKey.placeholder": "jina_xxx...",
  "setup.saveAndStart": "salvar + iniciar",
  "setup.validating": "[...] validando",
  "setup.skip": "pular (sem busca web)",
  "setup.privacy": "sua chave é armazenada localmente e nunca compartilhada.",
  "setup.success": "chave válida. iniciando...",
  "setup.desc": "busca web requer uma chave API gratuita da Jina AI.",
  "setup.error.empty": "insira uma chave",
  "setup.error.invalid": "chave inválida. verifique e tente novamente.",
  "setup.save": "salvar + iniciar",
  "setup.note": "sua chave é armazenada localmente e nunca compartilhada.",

  // Footer
  "footer.waiting": "aguardando...",

  // Context Viewer
  "context.title": "contexto",
  "context.tokens": "tokens",
  "context.summary": "resumo",
  "context.noSummary": "sem resumo — será gerado quando a conversa exceder o orçamento de tokens",
  "context.messages": "mensagens",
  "context.noMessages": "nenhuma mensagem ainda",
  "context.memories": "memórias",
  "context.noMemories": "nenhuma memória extraída ainda",
  "context.tier.hot": "hot — no prompt",
  "context.tier.warm": "warm — pesquisável",
  "context.chunks": "resumos fragmentados",
  "context.noChunks": "nenhum chunk ainda",
  "context.totalHistory": "total de mensagens",
  "context.searchPlaceholder": "buscar histórico...",
  "context.search": "buscar",

  // FAQ
  "faq.title": "perguntas frequentes",

  // Editor
  "editor.title": "editor",
  "editor.placeholder": "// escreva código ou texto aqui...",
  "editor.clear": "limpar",
  "editor.send": "enviar →",

  // Right Panel
  "rightPanel.placeholder": "painel em breve",
};

const es: Translations = {
  "settings.title": "configuración",
  "settings.compactMode": "modo compacto",
  "settings.compactMode.desc": "solo tool calls + estado",
  "settings.panelInput": "input en el panel",
  "settings.panelInput.desc": "escribir mensajes en el panel",
  "settings.apiKey": "clave api jina",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "actual: {key}",
  "settings.apiKey.error.empty": "[!!] ingrese una clave",
  "settings.apiKey.validating": "[...] validando",
  "settings.apiKey.saved": "[ok] guardada",
  "settings.apiKey.error.invalid": "[!!] clave inválida",
  "settings.language": "idioma",
  "settings.toggle.on": "sí",
  "settings.toggle.off": "no",
  "settings.save": "guardar",
  "settings.close": "cerrar",
  "panel.ready": "listo",
  "panel.compact": "compacto — solo tool calls",
  "response.label": "agente",
  "response.expand": "expandir",
  "response.collapse": "contraer",
  "user.you": "tú",
  "tool.args": "args:",
  "setup.title": "agente",
  "setup.sectionHeader": "[ config ] clave api jina",
  "setup.description.1": "la búsqueda web requiere una",
  "setup.description.2": "Jina AI",
  "setup.description.3": "gratuita.",
  "setup.step1": "visita",
  "setup.step2": "crea una cuenta gratuita (o inicia sesión)",
  "setup.step3": "copia tu clave api",
  "setup.step4": "pega aquí",
  "setup.apiKey.placeholder": "jina_xxx...",
  "setup.saveAndStart": "guardar + iniciar",
  "setup.validating": "[...] validando",
  "setup.skip": "ommitir (sin búsqueda web)",
  "setup.privacy": "tu clave se almacena localmente y nunca se comparte.",
  "setup.success": "clave válida. iniciando...",
  "setup.desc": "la búsqueda web requiere una clave API gratuita de Jina AI.",
  "setup.error.empty": "ingrese una clave",
  "setup.error.invalid": "clave inválida. verifique e intente de nuevo.",
  "setup.save": "guardar + iniciar",
  "setup.note": "tu clave se almacena localmente y nunca se comparte.",
  "footer.waiting": "esperando...",

  // Context Viewer
  "context.title": "contexto",
  "context.tokens": "tokens",
  "context.summary": "resumen",
  "context.noSummary": "sin resumen — se generará cuando la conversación exceda el presupuesto",
  "context.messages": "mensajes",
  "context.noMessages": "sin mensajes aún",
  "context.memories": "memorias",
  "context.noMemories": "sin memorias extraídas aún",  "context.tier.hot": "hot — en prompt",
  "context.tier.warm": "warm — buscable",
  "context.chunks": "resumenes fragmentados",
  "context.noChunks": "sin chunks aun",
  "context.totalHistory": "total de mensajes",
  "context.searchPlaceholder": "buscar historial...",
  "context.search": "buscar",

  // FAQ
  "faq.title": "preguntas frecuentes",

  // Editor
  "editor.title": "editor",
  "editor.placeholder": "// escribe código o texto aquí...",
  "editor.clear": "limpiar",
  "editor.send": "enviar →",

  // Right Panel
  "rightPanel.placeholder": "panel próximamente",
};

const ja: Translations = {
  "settings.title": "設定",
  "settings.compactMode": "コンパクトモード",
  "settings.compactMode.desc": "ツール呼び出しとステータスのみ",
  "settings.panelInput": "パネル入力",
  "settings.panelInput.desc": "パネルでメッセージを入力",
  "settings.apiKey": "Jina APIキー",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "現在: {key}",
  "settings.apiKey.error.empty": "[!!] キーを入力してください",
  "settings.apiKey.validating": "[...] 検証中",
  "settings.apiKey.saved": "[ok] 保存済み",
  "settings.apiKey.error.invalid": "[!!] 無効なキー",
  "settings.language": "言語",
  "settings.toggle.on": "オン",
  "settings.toggle.off": "オフ",
  "settings.save": "保存",
  "settings.close": "閉じる",
  "panel.ready": "準備完了",
  "panel.compact": "コンパクト — ツールのみ",
  "response.label": "エージェント",
  "response.expand": "展開",
  "response.collapse": "折りたたむ",
  "user.you": "あなた",
  "tool.args": "引数:",
  "setup.title": "エージェント",
  "setup.sectionHeader": "[ セットアップ ] Jina APIキー",
  "setup.description.1": "Web検索には無料の",
  "setup.description.2": "Jina AI",
  "setup.description.3": "APIキーが必要です。",
  "setup.step1": "アクセス:",
  "setup.step2": "無料アカウントを作成（またはログイン）",
  "setup.step3": "APIキーをコピー",
  "setup.step4": "以下に貼り付け",
  "setup.apiKey.placeholder": "jina_xxx...",
  "setup.saveAndStart": "保存して開始",
  "setup.validating": "[...] 検証中",
  "setup.skip": "スキップ（Web検索なし）",
  "setup.privacy": "キーはローカルに保存され、共有されることはありません。",
  "setup.success": "有効なキー。開始します...",
  "setup.desc": "Web検索には無料のJina AI APIキーが必要です。",
  "setup.error.empty": "キーを入力してください",
  "setup.error.invalid": "無効なキー。確認して再試行してください。",
  "setup.save": "保存して開始",
  "setup.note": "キーはローカルに保存され、共有されることはありません。",
  "footer.waiting": "待機中...",

  // Context Viewer
  "context.title": "コンテキスト",
  "context.tokens": "トークン",
  "context.summary": "要約",
  "context.noSummary": "要約なし — トークン予算超過時に生成されます",
  "context.messages": "メッセージ",
  "context.noMessages": "メッセージなし",
  "context.memories": "メモリ",
  "context.noMemories": "メモリなし",
  "context.tier.hot": "hot — プロンプト内",
  "context.tier.warm": "warm — 検索可能",
  "context.chunks": "チャンク要約",
  "context.noChunks": "チャンクなし",
  "context.totalHistory": "総メッセージ数",
  "context.searchPlaceholder": "履歴を検索...",
  "context.search": "検索",

  // FAQ
  "faq.title": "よくある質問",

  // Editor
  "editor.title": "エディタ",
  "editor.placeholder": "// コードまたはテキストをここに書く...",
  "editor.clear": "クリア",
  "editor.send": "送信 →",

  // Right Panel
  "rightPanel.placeholder": "パネル準備中",
};

const zh: Translations = {
  "settings.title": "设置",
  "settings.compactMode": "紧凑模式",
  "settings.compactMode.desc": "仅显示工具调用和状态",
  "settings.panelInput": "面板输入",
  "settings.panelInput.desc": "在面板中输入消息",
  "settings.apiKey": "Jina API 密钥",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "当前: {key}",
  "settings.apiKey.error.empty": "[!!] 请输入密钥",
  "settings.apiKey.validating": "[...] 验证中",
  "settings.apiKey.saved": "[ok] 已保存",
  "settings.apiKey.error.invalid": "[!!] 无效密钥",
  "settings.language": "语言",
  "settings.toggle.on": "开",
  "settings.toggle.off": "关",
  "settings.save": "保存",
  "settings.close": "关闭",
  "panel.ready": "就绪",
  "panel.compact": "紧凑 — 仅工具调用",
  "response.label": "代理",
  "response.expand": "展开",
  "response.collapse": "折叠",
  "user.you": "你",
  "tool.args": "参数:",
  "setup.title": "代理",
  "setup.sectionHeader": "[ 设置 ] Jina API 密钥",
  "setup.description.1": "网络搜索需要免费的",
  "setup.description.2": "Jina AI",
  "setup.description.3": "API 密钥。",
  "setup.step1": "访问",
  "setup.step2": "创建免费账户（或登录）",
  "setup.step3": "复制 API 密钥",
  "setup.step4": "粘贴到下方",
  "setup.apiKey.placeholder": "jina_xxx...",
  "setup.saveAndStart": "保存并开始",
  "setup.validating": "[...] 验证中",
  "setup.skip": "跳过（无网络搜索）",
  "setup.privacy": "密钥仅本地存储，绝不共享。",
  "setup.success": "有效密钥。正在启动...",
  "setup.desc": "网络搜索需要免费的 Jina AI API 密钥。",
  "setup.error.empty": "请输入密钥",
  "setup.error.invalid": "密钥无效。请检查后重试。",
  "setup.save": "保存并开始",
  "setup.note": "密钥仅本地存储，绝不共享。",
  "footer.waiting": "等待中...",

  // Context Viewer
  "context.title": "上下文",
  "context.tokens": "令牌",
  "context.summary": "摘要",
  "context.noSummary": "无摘要 — 超出令牌预算时生成",
  "context.messages": "消息",
  "context.noMessages": "暂无消息",
  "context.memories": "记忆",
  "context.noMemories": "暂无提取的记忆",
  "context.tier.hot": "hot — 在提示中",
  "context.tier.warm": "warm — 可搜索",
  "context.chunks": "分块摘要",
  "context.noChunks": "暂无分块",
  "context.totalHistory": "总消息数",
  "context.searchPlaceholder": "搜索历史...",
  "context.search": "搜索",

  // FAQ
  "faq.title": "常见问题",

  // Editor
  "editor.title": "编辑器",
  "editor.placeholder": "// 在这里编写代码或文本...",
  "editor.clear": "清除",
  "editor.send": "发送 →",

  // Right Panel
  "rightPanel.placeholder": "面板即将推出",
};

export const dict: Record<Locale, Translations> = {
  en,
  "pt-BR": ptBR,
  es,
  ja,
  zh,
};
