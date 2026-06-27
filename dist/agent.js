var b="";function h(e){b=e}function A(){return b}async function v(e){try{return(await fetch("https://s.jina.ai/",{method:"POST",headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({q:"test"})})).ok}catch{return!1}}function E(e){return{Authorization:`Bearer ${b}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function S(e,t=5){let r=await fetch("https://s.jina.ai/",{method:"POST",headers:E({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!r.ok)throw new Error(`Jina search failed: ${r.status} ${r.statusText}`);let n=await r.json(),o=(n.data||n||[]).slice(0,t).map(s=>({title:s.title||"",url:s.url||"",description:s.description||"",content:s.content||""})),a=o.map((s,u)=>`[${u+1}] ${s.title}
    ${s.url}
    ${s.description}`).join(`

`);return{query:e,results:o,raw:a}}async function I(e,t=5e3){let r=await fetch("https://r.jina.ai/",{method:"POST",headers:E({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!r.ok)throw new Error(`Jina scrape failed: ${r.status} ${r.statusText}`);let n=await r.text(),o=n.match(/^#\s+(.+)/m),a=o?o[1]:new URL(e).hostname,s=n.length>t?n.slice(0,t)+`

[...truncated]`:n;return{url:e,title:a,content:s}}var w={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await S(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",parameters:{url:"The full URL to scrape (must start with http:// or https://)"},execute:async e=>{let t=await I(e.url,5e3);return`# ${t.title}

${t.content}`}}};function R(e){return w[e]}function $(){return Object.values(w).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function B(e){return e in w}var D=5;var k=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function N(){return`You are a helpful assistant with access to web search.

Available tools:
${$()}

IMPORTANT RULES:
- ALWAYS use web_search when the user asks about real-time data (prices, scores, news, weather, dates, events).
- For general knowledge you are confident about, answer directly.
- When unsure, search first \u2014 it's better to search than to guess.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.
After receiving tool results, give your FINAL answer \u2014 do NOT output more tool_calls.
Never make up data \u2014 if the search fails, tell the user.`}function F(e){let t=[],r;for(k.lastIndex=0;(r=k.exec(e))!==null;){let[,n,o]=r;try{let a=JSON.parse(o);B(n)&&t.push({name:n,args:a})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${o}`)}}return t}function U(e){return e.replace(k,"").trim()}async function M(e,t,r=[],n,o){let s=N()+`

`;if(r.length>0){s+=`Recent conversation:
`;for(let g of r){let f=g.role==="user"?"User":"Assistant";s+=`${f}: ${g.content}
`}s+=`
`}s+=`User message: ${t}`;let u=0;for(;u<D;){u++,n?.(`Thinking... (step ${u})`);let f=(await e.generateText({instruction:s})).toString(),x=F(f);if(x.length===0)return U(f);for(let l of x){let y=R(l.name);if(y){n?.(`Using ${l.name}...`);try{let c=await y.execute(l.args);o?.(l.name,l.args,c);let d=`

[Tool Result - ${l.name}]:
${c}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;s+=d}catch(c){let d=c instanceof Error?c.message:String(c);console.error(`[Agent] Tool ${l.name} failed:`,d),s+=`

[Tool Error - ${l.name}]: ${d}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var m=null;function O(e){m=e}function H(){return m?.thread?.customData?m.thread.customData:{}}function z(e){try{return H()[e]??void 0}catch(t){console.warn("[Storage] get("+e+") failed:",t);return}}function C(e,t){try{if(!m?.thread?.customData){console.warn("[Storage] set: oc.thread.customData not available");return}m.thread.customData[e]=t}catch(r){console.warn("[Storage] set("+e+") failed:",r)}}var i=window.oc,_=!1,W=10;function J(){console.log("\u{1F916} Agent v0.1.0+dev"),console.log("   Build: 2026-06-27 23:29:46"),console.log("   https://github.com/Fahell/agent-perchance")}var L="agent:jina_key";function q(){return z(L)??null}function P(e){C(L,e)}function Y(){return i?i.thread?typeof i.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function V(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 24px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 480px; width: 100%;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 8px;">\u{1F916}</div>
          <h2 style="margin: 0; color: #00d4ff; font-size: 20px;">Agent for Perchance</h2>
          <span style="font-size: 11px; color: #666;">v0.1.0+dev</span>
        </div>
        <div style="background: #16213e; border-radius: 12px; padding: 20px; border: 1px solid #2a3a5e;">
          <h3 style="margin: 0 0 12px 0; color: #eee; font-size: 15px;">\u26A1 Setup \u2014 Chave de API da Jina</h3>
          <p style="color: #aaa; font-size: 13px; margin: 0 0 12px 0; line-height: 1.5;">
            Para usar busca na web, voc\xEA precisa de uma chave de API <strong style="color: #4ade80;">gratuita</strong> da Jina AI.
          </p>
          <ol style="color: #aaa; font-size: 13px; margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
            <li>Acesse <a href="https://jina.ai/?sui=apikey" target="_blank" style="color: #00d4ff; text-decoration: none;">jina.ai/?sui=apikey</a></li>
            <li>Crie uma conta gratuita (ou fa\xE7a login)</li>
            <li>Copie sua chave de API</li>
            <li>Cole no campo abaixo</li>
          </ol>
          <div style="margin-bottom: 12px;">
            <input id="api-key-input" type="password" placeholder="jina_xxxxxxxxxxxx..."
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a3a5e; background: #0f3460; color: #eee; font-size: 14px; font-family: monospace; box-sizing: border-box; outline: none;"
            />
          </div>
          <div id="api-key-error" style="display: none; color: #f87171; font-size: 12px; margin-bottom: 8px;"></div>
          <div id="api-key-success" style="display: none; color: #4ade80; font-size: 12px; margin-bottom: 8px;"></div>
          <button id="api-key-save" style="width: 100%; padding: 10px; border-radius: 8px; border: none; background: #00d4ff; color: #1a1a2e; font-size: 14px; font-weight: bold; cursor: pointer;">
            Salvar e Iniciar
          </button>
          <button id="api-key-skip" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #2a3a5e; background: transparent; color: #666; font-size: 12px; cursor: pointer; margin-top: 8px;">
            Pular (sem busca na web)
          </button>
        </div>
        <p style="color: #555; font-size: 11px; text-align: center; margin-top: 16px;">
          \u2139\uFE0F Sua chave \xE9 salva localmente neste navegador e nunca \xE9 compartilhada.
        </p>
      </div>
    </div>
  `;let e=document.getElementById("api-key-input"),t=document.getElementById("api-key-save"),r=document.getElementById("api-key-skip"),n=document.getElementById("api-key-error"),o=document.getElementById("api-key-success");async function a(){let s=e.value.trim();if(!s){n.textContent="Por favor, insira uma chave de API.",n.style.display="block",o.style.display="none";return}t.textContent="Validando...",t.disabled=!0,n.style.display="none",o.style.display="none",await v(s)?(P(s),h(s),o.textContent="\u2705 Chave v\xE1lida! Iniciando...",o.style.display="block",console.log("\u{1F511} [Agent] API key saved to customData"),setTimeout(()=>T(),800)):(n.textContent="\u274C Chave inv\xE1lida. Verifique e tente novamente.",n.style.display="block",t.textContent="Salvar e Iniciar",t.disabled=!1)}t.addEventListener("click",a),e.addEventListener("keydown",s=>{s.key==="Enter"&&a()}),r.addEventListener("click",()=>{console.log("\u23ED\uFE0F [Agent] Setup skipped (no API key)"),T()}),i.window.show()}function X(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: #666;">v0.1.0+dev</span>
          <button id="fs-btn" title="Tela cheia" style="background: none; border: 1px solid #2a3a5e; color: #666; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">\u26F6</button>
          <button id="settings-btn" style="background: none; border: 1px solid #2a3a5e; color: #666; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">\u2699\uFE0F</button>
        </div>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,document.getElementById("fs-btn").addEventListener("click",G),document.getElementById("settings-btn").addEventListener("click",Z),document.addEventListener("fullscreenchange",()=>{let e=document.getElementById("fs-btn");e&&(e.textContent=document.fullscreenElement?"\u2199":"\u26F6")}),i.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function G(){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(e=>{console.warn("\u{1FA9F} [Agent] Fullscreen failed:",e)})}function Z(){let e=A(),t=e?e.slice(0,8)+"..."+e.slice(-4):"Nenhuma",r=document.createElement("div");r.id="settings-overlay",r.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui;",r.innerHTML=`
    <div style="background:#16213e;border-radius:12px;padding:20px;max-width:400px;width:90%;border:1px solid #2a3a5e;">
      <h3 style="margin:0 0 12px;color:#eee;font-size:15px;">\u2699\uFE0F Configura\xE7\xF5es</h3>
      <div style="margin-bottom:12px;">
        <label style="color:#aaa;font-size:12px;display:block;margin-bottom:4px;">Chave de API da Jina:</label>
        <div style="display:flex;gap:8px;">
          <input id="settings-key-input" type="password" value="${e}" placeholder="jina_xxx..."
            style="flex:1;padding:8px;border-radius:6px;border:1px solid #2a3a5e;background:#0f3460;color:#eee;font-size:13px;font-family:monospace;box-sizing:border-box;outline:none;" />
        </div>
        <div style="color:#666;font-size:11px;margin-top:4px;">Atual: ${t}</div>
      </div>
      <div id="settings-msg" style="display:none;font-size:12px;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;">
        <button id="settings-save" style="flex:1;padding:8px;border-radius:6px;border:none;background:#00d4ff;color:#1a1a2e;font-size:13px;font-weight:bold;cursor:pointer;">Salvar</button>
        <button id="settings-close" style="flex:1;padding:8px;border-radius:6px;border:1px solid #2a3a5e;background:transparent;color:#aaa;font-size:13px;cursor:pointer;">Fechar</button>
      </div>
    </div>
  `,document.body.appendChild(r),document.getElementById("settings-close").addEventListener("click",()=>r.remove()),document.getElementById("settings-save").addEventListener("click",async()=>{let n=document.getElementById("settings-key-input").value.trim(),o=document.getElementById("settings-msg");if(!n){o.textContent="Insira uma chave.",o.style.color="#f87171",o.style.display="block";return}o.textContent="Validando...",o.style.color="#aaa",o.style.display="block",await v(n)?(P(n),h(n),o.textContent="\u2705 Chave salva!",o.style.color="#4ade80",setTimeout(()=>r.remove(),1e3)):(o.textContent="\u274C Chave inv\xE1lida.",o.style.color="#f87171")})}function Q(e){let t=e.trim();return t.startsWith("/agent")||t.startsWith("/test-storage")}function ee(e){let t=e.trim();t==="/agent open"?(i.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"?(i.window.hide(),console.log("\u{1FA9F} [Agent] Window closed")):t==="/test-storage"||t==="/test-storage run"?te():t==="/test-storage check"?ne():t==="/test-storage clean"&&(K(),p(`<div style="margin:8px 0;padding:8px;background:#16213e;border-radius:6px;border-left:3px solid #4ade80;">
      <div style="color:#4ade80;">\u{1F9F9} Dados de teste limpos</div>
    </div>`))}function te(){let e="__test_",t=a=>a<1024?a+" B":a<1048576?(a/1024).toFixed(0)+" KB":(a/1048576).toFixed(0)+" MB";p(`<div style="margin:8px 0;padding:8px;background:#1a1a2e;border-radius:6px;border-left:3px solid #f59e0b;">
    <div style="color:#f59e0b;font-weight:bold;">\u{1F52C} Iniciando teste de storage...</div>
  </div>`);let r=[{label:"1KB",bytes:1024},{label:"5KB",bytes:5*1024},{label:"10KB",bytes:10*1024},{label:"50KB",bytes:50*1024},{label:"100KB",bytes:100*1024},{label:"500KB",bytes:500*1024},{label:"1MB",bytes:1048576},{label:"5MB",bytes:5*1048576},{label:"10MB",bytes:10*1048576},{label:"25MB",bytes:25*1048576},{label:"50MB",bytes:50*1048576},{label:"100MB",bytes:100*1048576}];K();let n=[],o="";for(let{label:a,bytes:s}of r){p(`<div style="margin:2px 0 2px 12px;padding:4px 8px;color:#aaa;font-size:12px;">\u23F3 ${a} (${t(s)})...</div>`);let u="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",g="";for(;g.length<s;)g+=u;g=g.slice(0,s);let f=!1,x=0,l=!1,y=0;try{let d=performance.now();i.thread.customData[e+a]=g,x=Math.round(performance.now()-d),f=!0}catch(d){p(`<div style="margin:1px 0 1px 16px;padding:2px 8px;font-size:11px;color:#f87171;">
        \u274C WRITE FAILED: ${d instanceof Error?d.message:d}
      </div>`),n.push(`${a}\u274C`);break}try{let d=performance.now(),j=i.thread.customData[e+a];y=Math.round(performance.now()-d),l=j===g}catch{l=!1}let c=f&&l;if(p(`<div style="margin:1px 0 1px 16px;padding:2px 8px;font-size:11px;color:${c?"#4ade80":"#f87171"};">
      ${c?"\u2705":"\u274C"} Write: ${x}ms | Read: ${y}ms
    </div>`),n.push(`${a}${c?"\u2705":"\u274C"}`),c&&(o=a),!c)break}p(`<div style="margin:8px 0;padding:8px;background:#16213e;border-radius:6px;border-left:3px solid #4ade80;">
    <div style="color:#4ade80;font-weight:bold;">\u{1F3AF} M\xE1ximo: ${o||"nenhum"}</div>
    <div style="color:#aaa;font-size:11px;margin-top:4px;">${n.join(" \u2192 ")}</div>
    <div style="color:#666;font-size:11px;margin-top:4px;">Recarregue e envie /test-storage check para testar persist\xEAncia</div>
  </div>`)}function ne(){let e="__test_",t=["1KB","5KB","10KB","50KB","100KB","500KB","1MB","5MB","10MB","25MB","50MB","100MB"],r=i.thread.customData||{},n=0;p(`<div style="margin:8px 0;padding:8px;background:#1a1a2e;border-radius:6px;border-left:3px solid #f59e0b;">
    <div style="color:#f59e0b;font-weight:bold;">\u{1F50D} Verificando persist\xEAncia...</div>
  </div>`);for(let o of t){let a=r[e+o]!==void 0;a&&n++,p(`<div style="margin:1px 0 1px 16px;padding:2px 8px;font-size:11px;color:${a?"#4ade80":"#f87171"};">
      ${a?"\u2705":"\u274C"} ${o}
    </div>`)}p(`<div style="margin:8px 0;padding:8px;background:#16213e;border-radius:6px;border-left:3px solid #4ade80;">
    <div style="color:#4ade80;font-weight:bold;">\u{1F4CA} ${n}/${t.length} sobreviveram ao reload</div>
  </div>`)}function K(){try{let e=i.thread.customData;if(!e)return;for(let t of Object.keys(e))t.startsWith("__test_")&&delete e[t]}catch{}}function p(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function oe(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),p(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=i.thread.messages.filter(n=>(n.author==="user"||n.author==="ai")&&n!==e).slice(-W).map(n=>({role:n.author==="user"?"user":"assistant",content:n.content})),r=await M(i,e.content,t,n=>{console.log("\u{1F916} [Agent]",n)},(n,o,a)=>{let s=o.query||o.url||"",u=a.slice(0,300).replace(/\n/g," ");p(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${s}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${u}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",r.slice(0,100)),i.thread.messages.push({author:"ai",content:r}),p(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${r.length} chars)</div>
  </div>`)}function T(){X(),i.thread.on("MessageAdded",async function({message:e}){if(e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes("ai")||e.hiddenFrom.push("ai"),console.log("\u{1F6E1}\uFE0F [Agent] Set expectsReply=false, hiddenFrom=[ai] on user message")),e.author==="ai"&&_){let t=i.thread.messages.indexOf(e);t!==-1&&(i.thread.messages.splice(t,1),console.log("\u{1F5D1}\uFE0F [Agent] Removed internal generator message"));return}if(e.author==="user"){if(Q(e.content)){ee(e.content),setTimeout(()=>{let t=i.thread.messages.indexOf(e);t!==-1&&i.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),_=!0;try{await oe(e)}catch(t){console.error("\u274C [Agent] Error:",t),i.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})}finally{_=!1}}}),console.log("\u2705 [Agent] Ready!")}async function re(){J(),console.log("\u{1F680} [Agent] Loading..."),O(i);let e=q();e?(h(e),console.log("\u{1F511} [Agent] API key loaded from customData"),T()):(console.log("\u{1F511} [Agent] No API key found \u2014 showing setup screen"),V())}Y()&&re();
