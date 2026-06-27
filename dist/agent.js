var x="";function f(e){x=e}function _(){return x}async function h(e){try{return(await fetch("https://s.jina.ai/",{method:"POST",headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({q:"test"})})).ok}catch{return!1}}function S(e){return{Authorization:`Bearer ${x}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function E(e,t=5){let o=await fetch("https://s.jina.ai/",{method:"POST",headers:S({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!o.ok)throw new Error(`Jina search failed: ${o.status} ${o.statusText}`);let n=await o.json(),r=(n.data||n||[]).slice(0,t).map(s=>({title:s.title||"",url:s.url||"",description:s.description||"",content:s.content||""})),i=r.map((s,l)=>`[${l+1}] ${s.title}
    ${s.url}
    ${s.description}`).join(`

`);return{query:e,results:r,raw:i}}async function I(e,t=5e3){let o=await fetch("https://r.jina.ai/",{method:"POST",headers:S({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!o.ok)throw new Error(`Jina scrape failed: ${o.status} ${o.statusText}`);let n=await o.text(),r=n.match(/^#\s+(.+)/m),i=r?r[1]:new URL(e).hostname,s=n.length>t?n.slice(0,t)+`

[...truncated]`:n;return{url:e,title:i,content:s}}var v={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await E(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",parameters:{url:"The full URL to scrape (must start with http:// or https://)"},execute:async e=>{let t=await I(e.url,5e3);return`# ${t.title}

${t.content}`}}};function R(e){return v[e]}function O(){return Object.values(v).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function $(e){return e in v}var B=5;var b=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function N(){return`You are a helpful assistant with access to web search.

Available tools:
${O()}

IMPORTANT RULES:
- ALWAYS use web_search when the user asks about real-time data (prices, scores, news, weather, dates, events).
- For general knowledge you are confident about, answer directly.
- When unsure, search first \u2014 it's better to search than to guess.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.
After receiving tool results, give your FINAL answer \u2014 do NOT output more tool_calls.
Never make up data \u2014 if the search fails, tell the user.`}function U(e){let t=[],o;for(b.lastIndex=0;(o=b.exec(e))!==null;){let[,n,r]=o;try{let i=JSON.parse(r);$(n)&&t.push({name:n,args:i})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${r}`)}}return t}function D(e){return e.replace(b,"").trim()}async function C(e,t,o=[],n,r){let s=N()+`

`;if(o.length>0){s+=`Recent conversation:
`;for(let m of o){let u=m.role==="user"?"User":"Assistant";s+=`${u}: ${m.content}
`}s+=`
`}s+=`User message: ${t}`;let l=0;for(;l<B;){l++,n?.(`Thinking... (step ${l})`);let u=(await e.generateText({instruction:s})).toString(),T=U(u);if(T.length===0)return D(u);for(let c of T){let k=R(c.name);if(k){n?.(`Using ${c.name}...`);try{let d=await k.execute(c.args);r?.(c.name,c.args,d);let g=`

[Tool Result - ${c.name}]:
${d}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;s+=g}catch(d){let g=d instanceof Error?d.message:String(d);console.error(`[Agent] Tool ${c.name} failed:`,g),s+=`

[Tool Error - ${c.name}]: ${g}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var p=null;function M(e){p=e}function K(){return p?.thread?.customData?p.thread.customData:{}}function P(e){try{return K()[e]??void 0}catch(t){console.warn("[Storage] get("+e+") failed:",t);return}}function z(e,t){try{if(!p?.thread?.customData){console.warn("[Storage] set: oc.thread.customData not available");return}p.thread.customData[e]=t}catch(o){console.warn("[Storage] set("+e+") failed:",o)}}var a=window.oc,y=!1,H=10;function F(){console.log("\u{1F916} Agent v0.1.0+dev"),console.log("   Build: 2026-06-27 21:43:27"),console.log("   https://github.com/Fahell/agent-perchance")}var L="agent:jina_key";function J(){return P(L)??null}function j(e){z(L,e)}function q(){return a?a.thread?typeof a.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function V(){document.body.innerHTML=`
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
  `;let e=document.getElementById("api-key-input"),t=document.getElementById("api-key-save"),o=document.getElementById("api-key-skip"),n=document.getElementById("api-key-error"),r=document.getElementById("api-key-success");async function i(){let s=e.value.trim();if(!s){n.textContent="Por favor, insira uma chave de API.",n.style.display="block",r.style.display="none";return}t.textContent="Validando...",t.disabled=!0,n.style.display="none",r.style.display="none",await h(s)?(j(s),f(s),r.textContent="\u2705 Chave v\xE1lida! Iniciando...",r.style.display="block",console.log("\u{1F511} [Agent] API key saved to customData"),setTimeout(()=>A(),800)):(n.textContent="\u274C Chave inv\xE1lida. Verifique e tente novamente.",n.style.display="block",t.textContent="Salvar e Iniciar",t.disabled=!1)}t.addEventListener("click",i),e.addEventListener("keydown",s=>{s.key==="Enter"&&i()}),o.addEventListener("click",()=>{console.log("\u23ED\uFE0F [Agent] Setup skipped (no API key)"),A()}),a.window.show()}function W(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: #666;">v0.1.0+dev</span>
          <button id="settings-btn" style="background: none; border: 1px solid #2a3a5e; color: #666; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">\u2699\uFE0F</button>
        </div>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,document.getElementById("settings-btn").addEventListener("click",Y),a.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function Y(){let e=_(),t=e?e.slice(0,8)+"..."+e.slice(-4):"Nenhuma",o=document.createElement("div");o.id="settings-overlay",o.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui;",o.innerHTML=`
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
  `,document.body.appendChild(o),document.getElementById("settings-close").addEventListener("click",()=>o.remove()),document.getElementById("settings-save").addEventListener("click",async()=>{let n=document.getElementById("settings-key-input").value.trim(),r=document.getElementById("settings-msg");if(!n){r.textContent="Insira uma chave.",r.style.color="#f87171",r.style.display="block";return}r.textContent="Validando...",r.style.color="#aaa",r.style.display="block",await h(n)?(j(n),f(n),r.textContent="\u2705 Chave salva!",r.style.color="#4ade80",setTimeout(()=>o.remove(),1e3)):(r.textContent="\u274C Chave inv\xE1lida.",r.style.color="#f87171")})}function G(e){return e.trim().startsWith("/agent")}function X(e){let t=e.trim();t==="/agent open"?(a.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(a.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function w(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function Q(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),w(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=a.thread.messages.filter(n=>(n.author==="user"||n.author==="ai")&&n!==e).slice(-H).map(n=>({role:n.author==="user"?"user":"assistant",content:n.content})),o=await C(a,e.content,t,n=>{console.log("\u{1F916} [Agent]",n)},(n,r,i)=>{let s=r.query||r.url||"",l=i.slice(0,300).replace(/\n/g," ");w(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${s}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${l}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",o.slice(0,100)),y=!1,a.thread.messages.push({author:"ai",content:o}),w(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${o.length} chars)</div>
  </div>`)}function A(){W(),a.thread.on("MessageAdded",function({message:e}){if(e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes("ai")||e.hiddenFrom.push("ai"),console.log("\u{1F6E1}\uFE0F [Agent] Set expectsReply=false, hiddenFrom=[ai] on user message")),e.author==="ai"&&y){let t=a.thread.messages.indexOf(e);t!==-1&&(a.thread.messages.splice(t,1),console.log("\u{1F5D1}\uFE0F [Agent] Removed internal generator message"));return}if(e.author==="user"){if(G(e.content)){X(e.content),setTimeout(()=>{let t=a.thread.messages.indexOf(e);t!==-1&&a.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),y=!0,Q(e).catch(t=>{y=!1,console.error("\u274C [Agent] Error:",t),a.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}async function Z(){F(),console.log("\u{1F680} [Agent] Loading..."),M(a);let e=J();e?(f(e),console.log("\u{1F511} [Agent] API key loaded from customData"),A()):(console.log("\u{1F511} [Agent] No API key found \u2014 showing setup screen"),V())}q()&&Z();
