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
  // Context menu
  "editor.closeTab": "close",
  "editor.closeOthers": "close others",
  "editor.copyPath": "copy path",
  "editor.closeTabTooltip": "Close tab (Ctrl+W)",
  "editor.newFile": "New file",

  // Editor status bar
  "editorStatusBar.sel": "Sel",
  "editorStatusBar.ln": "Ln",
  "editorStatusBar.col": "Col",

  // Confirm modal
  "confirmModal.confirm": "confirm",
  "confirmModal.cancel": "cancel",

  // History (conversations)
  "history.title": "Conversations",
  "history.empty": "No archived conversations.",
  "history.messages": "{n} messages",
  "history.delete": "Delete conversation",
  "history.close": "Close",

  // Settings
  "settings.title": "settings",
  "settings.section.editor": "editor",
  "settings.section.tools": "agent tools",
  "settings.section.keys": "api keys",
  "settings.apiKey": "jina api key",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "current: {key}",
  "settings.apiKey.error.empty": "insert a key",
  "settings.apiKey.validating": "validating...",
  "settings.apiKey.saved": "saved",
  "settings.apiKey.error.invalid": "invalid key",
  "settings.language": "language",
  "settings.toggle.on": "on",
  "settings.toggle.off": "off",
  "settings.autoSave": "auto save",
  "settings.autoSave.desc": "save files automatically on change",
  "settings.fontSize": "font size",
  "settings.fontSize.desc": "editor text size in pixels",
  "settings.wordWrap": "word wrap",
  "settings.wordWrap.desc": "wrap long lines in the editor",
  "settings.tabSize": "tab size",
  "settings.tabSize.desc": "indentation width in spaces",
  "settings.tools.web": "web tools",
  "settings.tools.web.desc": "web search and page scraping",
  "settings.tools.context": "context tools",
  "settings.tools.context.desc": "conversation history search",
  "settings.tools.files": "file tools",
  "settings.tools.files.desc": "read, write, and edit virtual files",
  "settings.tools.terminal": "Python tools",
  "settings.tools.terminal.desc": "run Python code in the browser",
  "settings.tools.node": "Node.js tools",
  "settings.tools.node.desc": "run npm/node via BrowserPod (requires API key)",
  "settings.browserPodApiKey": "BrowserPod API key",
  "settings.browserPodApiKey.placeholder": "bp_xxx...",
  "settings.browserPodApiKey.current": "current: {key}",
  "settings.save": "save",
  "settings.validate": "test connection",
  "settings.validating": "testing...",
  "settings.validate.success": "connection ok",
  "settings.validate.error": "connection failed",
  "settings.close": "close",

  // Header
  "header.title": "agent",

  // Panel
  "panel.ready": "ready",

  // Response
  "response.label": "agent",
  "response.expand": "expand",
  "response.collapse": "collapse",

  // User
  "user.you": "you",

  // Tool cards
  "tool.args": "args:",

  // Onboarding
  "onboarding.title": "welcome",
  "onboarding.greeting": "Welcome to Perchance IDE",
  "onboarding.description": "An AI-powered IDE that runs entirely in your browser. Code with the help of an autonomous AI Agent — create, edit, and manage projects through natural conversation.",
  "onboarding.whatIs": "what is this?",
  "onboarding.features.editor": "Full code editor with syntax highlighting for 10+ languages, file management, and live preview",
  "onboarding.features.agent": "AI agent that can read, write, edit files, run Python, search the web, and execute shell commands",
  "onboarding.features.python": "Python execution in-browser via Pyodide (numpy, pandas, and more)",
  "onboarding.keys": "optional api keys",
  "onboarding.keys.desc": "Web search requires a free Jina AI API key. Node.js tools require a BrowserPod API key. Both can be configured later in Settings.",
  "onboarding.start": "get started",
  "onboarding.versionInfo": "v{version} — everything runs client-side. Your files are saved in your browser.",

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
  "footer.processing": "Processing...",
  "footer.placeholder": "> _",
  "suggests.0": "try: create a new file",
  "suggests.1": "try: write some code",
  "suggests.2": "try: search the web",
  "suggests.3": "try: edit a file",

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
  "editor.unsavedConfirm": "Unsaved changes. Discard changes?",
  "editor.saving": "Saving…",
  "editor.saved": "Saved",
  "editor.saveAndClose": "save & close",
  "editor.closeAnyway": "close anyway",
  "editor.cancel": "cancel",

  // Right Panel
  "rightPanel.placeholder": "panel coming soon",

  // File Explorer
  "fileExplorer.title": "files",
  "fileExplorer.empty": "empty project",
  "fileExplorer.rename": "rename",
  "fileExplorer.delete": "delete",
  "fileExplorer.count": "files",

  // Tool cards
  "tool.loadingPyodide": "Loading Python runtime (3.5 MB)…",
  "tool.pyodideError": "Python runtime failed to load",

  // Editor — tab rename (10.3)
  "editor.rename": "rename",

  // Outline (10.1)
  "outline.title": "outline",
  "outline.noSymbols": "no symbols found",
  "outline.noEditor": "no file open",

  // File search (10.5)
  "fileSearch.placeholder": "Search files...",
  "fileSearch.noResults": "no results",
  "fileSearch.noFiles": "no files in project",
  "fileSearch.results": "{n} results",

  // Preview (11.2)
  "preview.title": "preview",
  "preview.noFile": "no file open",
  "preview.noHtml": "open an HTML file to preview",

  // Output (11.3)
  "output.title": "output",
  "output.empty": "no outputs yet",
  "output.clear": "clear",
  "output.exitCode": "exit code: {code}",
  "output.stdout": "stdout",
  "output.stderr": "stderr",
  "output.copy": "copy",
  "output.copied": "copied!",

  // VFS download/upload (11.4)
  "vfs.download": "download project",
  "vfs.uploadFile": "upload file",
  "vfs.uploadFolder": "upload folder",
  "vfs.uploaded": "uploaded {n} files",
};

const ptBR: Translations = {
  // Onboarding
  "onboarding.title": "boas-vindas",
  "onboarding.greeting": "Bem-vindo ao Perchance IDE",
  "onboarding.description": "Um IDE com IA que roda inteiramente no seu navegador. Programe com a ajuda de um AI Agent autônomo — crie, edite e gerencie projetos através de conversa natural.",
  "onboarding.whatIs": "o que é isto?",
  "onboarding.features.editor": "Editor de código completo com syntax highlighting para 10+ linguagens, gerenciamento de arquivos e preview ao vivo",
  "onboarding.features.agent": "AI Agent que pode ler, escrever, editar arquivos, executar Python, buscar na web e executar comandos shell",
  "onboarding.features.python": "Execução Python no navegador via Pyodide (numpy, pandas e mais)",
  "onboarding.keys": "chaves api opcionais",
  "onboarding.keys.desc": "Busca web requer uma chave Jina AI gratuita. Ferramentas Node.js requerem uma chave BrowserPod. Ambas podem ser configuradas depois nas Configurações.",
  "onboarding.start": "começar",
  "onboarding.versionInfo": "v{version} — tudo roda no cliente. Seus arquivos são salvos no seu navegador.",

  // Header
  "header.title": "agente",

  // Context menu
  "editor.closeTab": "fechar",
  "editor.closeOthers": "fechar outros",
  "editor.copyPath": "copiar caminho",
  "editor.closeTabTooltip": "Fechar aba (Ctrl+W)",
  "editor.newFile": "Novo arquivo",

  // Editor status bar
  "editorStatusBar.sel": "Sel",
  "editorStatusBar.ln": "Ln",
  "editorStatusBar.col": "Col",

  // Confirm modal
  "confirmModal.confirm": "confirmar",
  "confirmModal.cancel": "cancelar",

  // History (conversations)
  "history.title": "Conversas",
  "history.empty": "Nenhuma conversa arquivada.",
  "history.messages": "{n} mensagens",
  "history.delete": "Excluir conversa",
  "history.close": "Fechar",

  // Footer
  "footer.processing": "Processando...",

  // Settings
  "settings.title": "configurações",
  "settings.section.editor": "editor",
  "settings.section.tools": "ferramentas do agente",
  "settings.section.keys": "chaves de api",
  "settings.apiKey": "chave api jina",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "atual: {key}",
  "settings.apiKey.error.empty": "insira uma chave",
  "settings.apiKey.validating": "validando...",
  "settings.apiKey.saved": "salva",
  "settings.apiKey.error.invalid": "chave inválida",
  "settings.language": "idioma",
  "settings.toggle.on": "ligado",
  "settings.toggle.off": "desligado",
  "settings.autoSave": "auto save",
  "settings.autoSave.desc": "salvar arquivos automaticamente ao alterar",
  "settings.fontSize": "tamanho da fonte",
  "settings.fontSize.desc": "tamanho do texto no editor em pixels",
  "settings.wordWrap": "quebra de linha",
  "settings.wordWrap.desc": "quebrar linhas longas no editor",
  "settings.tabSize": "tamanho da tab",
  "settings.tabSize.desc": "largura da identação em espaços",
  "settings.tools.web": "ferramentas web",
  "settings.tools.web.desc": "busca e raspagem de páginas",
  "settings.tools.context": "ferramentas de contexto",
  "settings.tools.context.desc": "busca no histórico da conversa",
  "settings.tools.files": "ferramentas de arquivo",
  "settings.tools.files.desc": "ler, escrever e editar arquivos virtuais",
  "settings.tools.terminal": "ferramentas Python",
  "settings.tools.terminal.desc": "executar código Python no navegador",
  "settings.tools.node": "ferramentas Node.js",
  "settings.tools.node.desc": "executar npm/node via BrowserPod (requer chave API)",
  "settings.browserPodApiKey": "chave API BrowserPod",
  "settings.browserPodApiKey.placeholder": "bp_xxx...",
  "settings.browserPodApiKey.current": "atual: {key}",
  "settings.save": "salvar",
  "settings.validate": "testar conexão",
  "settings.validating": "testando...",
  "settings.validate.success": "conexão ok",
  "settings.validate.error": "conexão falhou",
  "settings.close": "fechar",

  // Panel
  "panel.ready": "pronto",

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
  "footer.placeholder": "> _",
  "suggests.0": "tente: criar um arquivo",
  "suggests.1": "tente: escrever código",
  "suggests.2": "tente: pesquisar na web",
  "suggests.3": "tente: editar um arquivo",

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
  "editor.unsavedConfirm": "Alterações não salvas. Descartar alterações?",
  "editor.saving": "Salvando…",
  "editor.saved": "Salvo",
  "editor.saveAndClose": "salvar e fechar",
  "editor.closeAnyway": "fechar mesmo assim",
  "editor.cancel": "cancelar",

  // Right Panel
  "rightPanel.placeholder": "painel em breve",

  "fileExplorer.title": "arquivos",
  "fileExplorer.empty": "projeto vazio",
  "fileExplorer.rename": "renomear",
  "fileExplorer.delete": "excluir",
  "fileExplorer.count": "arquivos",

  // Tool cards
  "tool.loadingPyodide": "Carregando Python runtime (3.5 MB)…",
  "tool.pyodideError": "Falha ao carregar Python runtime",

  // Editor — tab rename (10.3)
  "editor.rename": "renomear",

  // Outline (10.1)
  "outline.title": "estrutura",
  "outline.noSymbols": "nenhum símbolo encontrado",
  "outline.noEditor": "nenhum arquivo aberto",

  // File search (10.5)
  "fileSearch.placeholder": "Buscar arquivos...",
  "fileSearch.noResults": "nenhum resultado",
  "fileSearch.noFiles": "nenhum arquivo no projeto",
  "fileSearch.results": "{n} resultados",

  // Preview (11.2)
  "preview.title": "visualização",
  "preview.noFile": "nenhum arquivo aberto",
  "preview.noHtml": "abra um arquivo HTML para visualizar",

  // Output (11.3)
  "output.title": "saída",
  "output.empty": "nenhuma saída ainda",
  "output.clear": "limpar",
  "output.exitCode": "código de saída: {code}",
  "output.stdout": "saída padrão",
  "output.stderr": "erro padrão",
  "output.copy": "copiar",
  "output.copied": "copiado!",

  // VFS download/upload (11.4)
  "vfs.download": "baixar projeto",
  "vfs.uploadFile": "enviar arquivo",
  "vfs.uploadFolder": "enviar pasta",
  "vfs.uploaded": "{n} arquivos enviados",
};

const es: Translations = {
  // Onboarding
  "onboarding.title": "bienvenido",
  "onboarding.greeting": "Bienvenido a Perchance IDE",
  "onboarding.description": "Un IDE con IA que funciona completamente en tu navegador. Programa con la ayuda de un AI Agent autónomo — crea, edita y gestiona proyectos mediante conversación natural.",
  "onboarding.whatIs": "¿qué es esto?",
  "onboarding.features.editor": "Editor de código completo con resaltado de sintaxis para 10+ lenguajes, gestión de archivos y vista previa en vivo",
  "onboarding.features.agent": "AI Agent que puede leer, escribir, editar archivos, ejecutar Python, buscar en la web y ejecutar comandos shell",
  "onboarding.features.python": "Ejecución de Python en el navegador via Pyodide (numpy, pandas y más)",
  "onboarding.keys": "claves api opcionales",
  "onboarding.keys.desc": "La búsqueda web requiere una clave Jina AI gratuita. Las herramientas Node.js requieren una clave BrowserPod. Ambas se pueden configurar más tarde en Ajustes.",
  "onboarding.start": "comenzar",
  "onboarding.versionInfo": "v{version} — todo funciona del lado del cliente. Tus archivos se guardan en tu navegador.",

  // Header
  "header.title": "agente",

  // Context menu
  "editor.closeTab": "cerrar",
  "editor.closeOthers": "cerrar otros",
  "editor.copyPath": "copiar ruta",
  "editor.closeTabTooltip": "Cerrar pestaña (Ctrl+W)",
  "editor.newFile": "Nuevo archivo",

  // Editor status bar
  "editorStatusBar.sel": "Sel",
  "editorStatusBar.ln": "Ln",
  "editorStatusBar.col": "Col",

  // Confirm modal
  "confirmModal.confirm": "confirmar",
  "confirmModal.cancel": "cancelar",

  // History (conversations)
  "history.title": "Conversaciones",
  "history.empty": "No hay conversaciones archivadas.",
  "history.messages": "{n} mensajes",
  "history.delete": "Eliminar conversación",
  "history.close": "Cerrar",

  // Footer
  "footer.processing": "Procesando...",

  // Settings
  "settings.title": "configuración",
  "settings.section.editor": "editor",
  "settings.section.tools": "herramientas del agente",
  "settings.section.keys": "claves de api",
  "settings.apiKey": "clave api jina",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "actual: {key}",
  "settings.apiKey.error.empty": "ingrese una clave",
  "settings.apiKey.validating": "validando...",
  "settings.apiKey.saved": "guardada",
  "settings.apiKey.error.invalid": "clave inválida",
  "settings.language": "idioma",
  "settings.toggle.on": "sí",
  "settings.toggle.off": "no",
  "settings.autoSave": "auto save",
  "settings.autoSave.desc": "guardar archivos automáticamente al cambiar",
  "settings.fontSize": "tamaño de fuente",
  "settings.fontSize.desc": "tamaño del texto en el editor en píxeles",
  "settings.wordWrap": "ajuste de línea",
  "settings.wordWrap.desc": "ajustar líneas largas en el editor",
  "settings.tabSize": "tamaño de tabulación",
  "settings.tabSize.desc": "ancho de sangría en espacios",
  "settings.tools.web": "herramientas web",
  "settings.tools.web.desc": "búsqueda y raspado de páginas",
  "settings.tools.context": "herramientas de contexto",
  "settings.tools.context.desc": "búsqueda en el historial de conversación",
  "settings.tools.files": "herramientas de archivos",
  "settings.tools.files.desc": "leer, escribir y editar archivos virtuales",
  "settings.tools.terminal": "herramientas Python",
  "settings.tools.terminal.desc": "ejecutar código Python en el navegador",
  "settings.tools.node": "herramientas Node.js",
  "settings.tools.node.desc": "ejecutar npm/node via BrowserPod (requiere clave API)",
  "settings.browserPodApiKey": "clave API BrowserPod",
  "settings.browserPodApiKey.placeholder": "bp_xxx...",
  "settings.browserPodApiKey.current": "actual: {key}",
  "settings.save": "guardar",
  "settings.validate": "probar conexión",
  "settings.validating": "probando...",
  "settings.validate.success": "conexión ok",
  "settings.validate.error": "conexión fallida",
  "settings.close": "cerrar",
  "panel.ready": "listo",
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
  "footer.placeholder": "> _",
  "suggests.0": "prueba: crear un archivo",
  "suggests.1": "prueba: escribir código",
  "suggests.2": "prueba: buscar en la web",
  "suggests.3": "prueba: editar un archivo",

  // Context Viewer
  "context.title": "contexto",
  "context.tokens": "tokens",
  "context.summary": "resumen",
  "context.noSummary": "sin resumen — se generará cuando la conversación exceda el presupuesto",
  "context.messages": "mensajes",
  "context.noMessages": "sin mensajes aún",
  "context.memories": "memorias",
  "context.noMemories": "sin memorias extraídas aún", "context.tier.hot": "hot — en prompt",
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
  "editor.unsavedConfirm": "¿Cambios sin guardar. Descartar cambios?",
  "editor.saving": "Guardando…",
  "editor.saved": "Guardado",
  "editor.saveAndClose": "guardar y cerrar",
  "editor.closeAnyway": "cerrar de todas formas",
  "editor.cancel": "cancelar",

  // Right Panel
  "rightPanel.placeholder": "panel próximamente",

  "fileExplorer.title": "archivos",
  "fileExplorer.empty": "proyecto vacío",
  "fileExplorer.rename": "renombrar",
  "fileExplorer.delete": "eliminar",
  "fileExplorer.count": "archivos",

  // Tool cards
  "tool.loadingPyodide": "Cargando Python runtime (3.5 MB)…",
  "tool.pyodideError": "Error al cargar Python runtime",

  // Editor — tab rename (10.3)
  "editor.rename": "renombrar",

  // Outline (10.1)
  "outline.title": "estructura",
  "outline.noSymbols": "sin símbolos",
  "outline.noEditor": "sin archivo abierto",

  // File search (10.5)
  "fileSearch.placeholder": "Buscar archivos...",
  "fileSearch.noResults": "sin resultados",
  "fileSearch.noFiles": "sin archivos en el proyecto",
  "fileSearch.results": "{n} resultados",

  // Preview (11.2)
  "preview.title": "vista previa",
  "preview.noFile": "sin archivo abierto",
  "preview.noHtml": "abre un archivo HTML para previsualizar",

  // Output (11.3)
  "output.title": "salida",
  "output.empty": "sin salidas aún",
  "output.clear": "limpiar",
  "output.exitCode": "código de salida: {code}",
  "output.stdout": "salida estándar",
  "output.stderr": "error estándar",
  "output.copy": "copiar",
  "output.copied": "copiado!",

  // VFS download/upload (11.4)
  "vfs.download": "descargar proyecto",
  "vfs.uploadFile": "subir archivo",
  "vfs.uploadFolder": "subir carpeta",
  "vfs.uploaded": "{n} archivos subidos",
};

const ja: Translations = {
  // Onboarding
  "onboarding.title": "ようこそ",
  "onboarding.greeting": "Perchance IDEへようこそ",
  "onboarding.description": "ブラウザ上で完全に動作するAI搭載IDEです。自律AI Agentの助けを借りて、自然な会話を通じてプロジェクトを作成、編集、管理できます。",
  "onboarding.whatIs": "これは何ですか？",
  "onboarding.features.editor": "10以上の言語に対応したコードエディタ、ファイル管理、ライブプレビュー",
  "onboarding.features.agent": "ファイルの読み書き・編集、Python実行、Web検索、シェルコマンド実行が可能なAI Agent",
  "onboarding.features.python": "Pyodide経由でブラウザ内でPython実行（numpy、pandasなど）",
  "onboarding.keys": "オプションのAPIキー",
  "onboarding.keys.desc": "Web検索には無料のJina AI APIキーが必要です。Node.jsツールにはBrowserPod APIキーが必要です。どちらも後で設定から構成できます。",
  "onboarding.start": "はじめる",
  "onboarding.versionInfo": "v{version} — すべてクライアントサイドで動作。ファイルはブラウザに保存されます。",

  // Header
  "header.title": "エージェント",

  // Context menu
  "editor.closeTab": "閉じる",
  "editor.closeOthers": "他を閉じる",
  "editor.copyPath": "パスをコピー",
  "editor.closeTabTooltip": "タブを閉じる (Ctrl+W)",
  "editor.newFile": "新規ファイル",

  // Editor status bar
  "editorStatusBar.sel": "Sel",
  "editorStatusBar.ln": "行",
  "editorStatusBar.col": "列",

  // Confirm modal
  "confirmModal.confirm": "確認",
  "confirmModal.cancel": "キャンセル",

  // History (conversations)
  "history.title": "会話",
  "history.empty": "アーカイブされた会話はありません。",
  "history.messages": "{n} メッセージ",
  "history.delete": "会話を削除",
  "history.close": "閉じる",

  // Footer
  "footer.processing": "処理中...",

  // Settings
  "settings.title": "設定",
  "settings.section.editor": "エディタ",
  "settings.section.tools": "エージェントツール",
  "settings.section.keys": "APIキー",
  "settings.apiKey": "Jina APIキー",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "現在: {key}",
  "settings.apiKey.error.empty": "キーを入力してください",
  "settings.apiKey.validating": "検証中...",
  "settings.apiKey.saved": "保存済み",
  "settings.apiKey.error.invalid": "無効なキー",
  "settings.language": "言語",
  "settings.toggle.on": "オン",
  "settings.toggle.off": "オフ",
  "settings.autoSave": "auto save",
  "settings.autoSave.desc": "変更時に自動保存",
  "settings.fontSize": "フォントサイズ",
  "settings.fontSize.desc": "エディタのテキストサイズ（px）",
  "settings.wordWrap": "ワードラップ",
  "settings.wordWrap.desc": "エディタで長い行を折り返す",
  "settings.tabSize": "タブサイズ",
  "settings.tabSize.desc": "インデント幅（スペース数）",
  "settings.tools.web": "Webツール",
  "settings.tools.web.desc": "ウェブ検索とスクレイピング",
  "settings.tools.context": "コンテキストツール",
  "settings.tools.context.desc": "会話履歴の検索",
  "settings.tools.files": "ファイルツール",
  "settings.tools.files.desc": "仮想ファイルの読み書き・編集",
  "settings.tools.terminal": "Pythonツール",
  "settings.tools.terminal.desc": "ブラウザでPythonコードを実行",
  "settings.tools.node": "Node.jsツール",
  "settings.tools.node.desc": "BrowserPod経由でnpm/nodeを実行（APIキーが必要）",
  "settings.browserPodApiKey": "BrowserPod APIキー",
  "settings.browserPodApiKey.placeholder": "bp_xxx...",
  "settings.browserPodApiKey.current": "現在: {key}",
  "settings.save": "保存",
  "settings.validate": "接続テスト",
  "settings.validating": "テスト中...",
  "settings.validate.success": "接続OK",
  "settings.validate.error": "接続失敗",
  "settings.close": "閉じる",
  "panel.ready": "準備完了",
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
  "footer.placeholder": "> _",
  "suggests.0": "試す: ファイルを作成",
  "suggests.1": "試す: コードを書く",
  "suggests.2": "試す: Web検索",
  "suggests.3": "試す: ファイルを編集",

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
  "editor.unsavedConfirm": "未保存の変更があります。破棄しますか？",
  "editor.saving": "保存中…",
  "editor.saved": "保存完了",
  "editor.saveAndClose": "保存して閉じる",
  "editor.closeAnyway": "閉じる",
  "editor.cancel": "キャンセル",

  // Right Panel
  "rightPanel.placeholder": "パネル準備中",

  "fileExplorer.title": "ファイル",
  "fileExplorer.empty": "空のプロジェクト",
  "fileExplorer.rename": "名前変更",
  "fileExplorer.delete": "削除",
  "fileExplorer.count": "ファイル",

  // Tool cards
  "tool.loadingPyodide": "Pythonランタイムを読み込み中 (3.5 MB)…",
  "tool.pyodideError": "Pythonランタイムの読み込みに失敗しました",

  // Editor — tab rename (10.3)
  "editor.rename": "名前変更",

  // Outline (10.1)
  "outline.title": "アウトライン",
  "outline.noSymbols": "シンボルがありません",
  "outline.noEditor": "ファイルが開かれていません",

  // File search (10.5)
  "fileSearch.placeholder": "ファイルを検索...",
  "fileSearch.noResults": "結果なし",
  "fileSearch.noFiles": "プロジェクトにファイルがありません",
  "fileSearch.results": "{n}件",

  // Preview (11.2)
  "preview.title": "プレビュー",
  "preview.noFile": "ファイルが開かれていません",
  "preview.noHtml": "プレビューするにはHTMLファイルを開いてください",

  // Output (11.3)
  "output.title": "出力",
  "output.empty": "出力はまだありません",
  "output.clear": "クリア",
  "output.exitCode": "終了コード: {code}",
  "output.stdout": "標準出力",
  "output.stderr": "標準エラー出力",
  "output.copy": "コピー",
  "output.copied": "コピーしました!",

  // VFS download/upload (11.4)
  "vfs.download": "プロジェクトをダウンロード",
  "vfs.uploadFile": "ファイルをアップロード",
  "vfs.uploadFolder": "フォルダをアップロード",
  "vfs.uploaded": "{n} 個のファイルをアップロードしました",
};

const zh: Translations = {
  // Onboarding
  "onboarding.title": "欢迎",
  "onboarding.greeting": "欢迎使用 Perchance IDE",
  "onboarding.description": "一个完全在浏览器中运行的AI驱动IDE。在自主AI Agent的帮助下，通过自然对话创建、编辑和管理项目。",
  "onboarding.whatIs": "这是什么？",
  "onboarding.features.editor": "支持10+语言的代码编辑器、文件管理和实时预览",
  "onboarding.features.agent": "可以读写编辑文件、运行Python、搜索网络和执行Shell命令的AI Agent",
  "onboarding.features.python": "通过Pyodide在浏览器中运行Python（支持numpy、pandas等）",
  "onboarding.keys": "可选的API密钥",
  "onboarding.keys.desc": "网络搜索需要免费的Jina AI API密钥。Node.js工具需要BrowserPod API密钥。两者都可以稍后在设置中配置。",
  "onboarding.start": "开始",
  "onboarding.versionInfo": "v{version} — 一切在客户端运行。您的文件保存在浏览器中。",

  // Header
  "header.title": "代理",

  // Context menu
  "editor.closeTab": "关闭",
  "editor.closeOthers": "关闭其他",
  "editor.copyPath": "复制路径",
  "editor.closeTabTooltip": "关闭标签页 (Ctrl+W)",
  "editor.newFile": "新建文件",

  // Editor status bar
  "editorStatusBar.sel": "选",
  "editorStatusBar.ln": "行",
  "editorStatusBar.col": "列",

  // Confirm modal
  "confirmModal.confirm": "确认",
  "confirmModal.cancel": "取消",

  // History (conversations)
  "history.title": "对话",
  "history.empty": "没有已归档的对话。",
  "history.messages": "{n} 条消息",
  "history.delete": "删除对话",
  "history.close": "关闭",

  // Footer
  "footer.processing": "处理中...",

  // Settings
  "settings.title": "设置",
  "settings.section.editor": "编辑器",
  "settings.section.tools": "代理工具",
  "settings.section.keys": "API 密钥",
  "settings.apiKey": "Jina API 密钥",
  "settings.apiKey.placeholder": "jina_xxx...",
  "settings.apiKey.current": "当前: {key}",
  "settings.apiKey.error.empty": "请输入密钥",
  "settings.apiKey.validating": "验证中...",
  "settings.apiKey.saved": "已保存",
  "settings.apiKey.error.invalid": "无效密钥",
  "settings.language": "语言",
  "settings.toggle.on": "开",
  "settings.toggle.off": "关",
  "settings.autoSave": "auto save",
  "settings.autoSave.desc": "更改时自动保存文件",
  "settings.fontSize": "字体大小",
  "settings.fontSize.desc": "编辑器文字大小（像素）",
  "settings.wordWrap": "自动换行",
  "settings.wordWrap.desc": "在编辑器中换行长行",
  "settings.tabSize": "制表符大小",
  "settings.tabSize.desc": "缩进宽度（空格数）",
  "settings.tools.web": "网络工具",
  "settings.tools.web.desc": "网络搜索和页面抓取",
  "settings.tools.context": "上下文工具",
  "settings.tools.context.desc": "对话历史搜索",
  "settings.tools.files": "文件工具",
  "settings.tools.files.desc": "读取、写入和编辑虚拟文件",
  "settings.tools.terminal": "Python 工具",
  "settings.tools.terminal.desc": "在浏览器中运行 Python 代码",
  "settings.tools.node": "Node.js 工具",
  "settings.tools.node.desc": "通过 BrowserPod 运行 npm/node（需要 API 密钥）",
  "settings.browserPodApiKey": "BrowserPod API 密钥",
  "settings.browserPodApiKey.placeholder": "bp_xxx...",
  "settings.browserPodApiKey.current": "当前: {key}",
  "settings.save": "保存",
  "settings.validate": "测试连接",
  "settings.validating": "测试中...",
  "settings.validate.success": "连接成功",
  "settings.validate.error": "连接失败",
  "settings.close": "关闭",
  "panel.ready": "就绪",
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
  "footer.placeholder": "> _",
  "suggests.0": "试试：创建文件",
  "suggests.1": "试试：写代码",
  "suggests.2": "试试：搜索网络",
  "suggests.3": "试试：编辑文件",

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
  "editor.unsavedConfirm": "有未保存的更改。放弃更改？",
  "editor.saving": "保存中…",
  "editor.saved": "已保存",
  "editor.saveAndClose": "保存并关闭",
  "editor.closeAnyway": "仍要关闭",
  "editor.cancel": "取消",

  // Right Panel
  "rightPanel.placeholder": "面板即将推出",

  "fileExplorer.title": "文件",
  "fileExplorer.empty": "空项目",
  "fileExplorer.rename": "重命名",
  "fileExplorer.delete": "删除",
  "fileExplorer.count": "文件",

  // Tool cards
  "tool.loadingPyodide": "正在加载 Python 运行时 (3.5 MB)…",
  "tool.pyodideError": "Python 运行时加载失败",

  // Editor — tab rename (10.3)
  "editor.rename": "重命名",

  // Outline (10.1)
  "outline.title": "大纲",
  "outline.noSymbols": "未找到符号",
  "outline.noEditor": "未打开文件",

  // File search (10.5)
  "fileSearch.placeholder": "搜索文件...",
  "fileSearch.noResults": "无结果",
  "fileSearch.noFiles": "项目中无文件",
  "fileSearch.results": "{n}个结果",

  // Preview (11.2)
  "preview.title": "预览",
  "preview.noFile": "未打开文件",
  "preview.noHtml": "打开HTML文件以预览",

  // Output (11.3)
  "output.title": "输出",
  "output.empty": "暂无输出",
  "output.clear": "清除",
  "output.exitCode": "退出代码: {code}",
  "output.stdout": "标准输出",
  "output.stderr": "标准错误",
  "output.copy": "复制",
  "output.copied": "已复制!",

  // VFS download/upload (11.4)
  "vfs.download": "下载项目",
  "vfs.uploadFile": "上传文件",
  "vfs.uploadFolder": "上传文件夹",
  "vfs.uploaded": "已上传 {n} 个文件",
};

export const dict: Record<Locale, Translations> = {
  en,
  "pt-BR": ptBR,
  es,
  ja,
  zh,
};
