var h="";function g(e){h=e}function k(){return h}async function x(e){try{return(await fetch("https://s.jina.ai/",{method:"POST",headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({q:"test"})})).ok}catch{return!1}}function T(e){return{Authorization:`Bearer ${h}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function E(e,t=5){let s=await fetch("https://s.jina.ai/",{method:"POST",headers:T({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!s.ok)throw new Error(`Jina search failed: ${s.status} ${s.statusText}`);let n=await s.json(),o=(n.data||n||[]).slice(0,t).map(i=>({title:i.title||"",url:i.url||"",description:i.description||"",content:i.content||""})),a=o.map((i,l)=>`[${l+1}] ${i.title}
    ${i.url}
    ${i.description}`).join(`

`);return{query:e,results:o,raw:a}}async function S(e,t=5e3){let s=await fetch("https://r.jina.ai/",{method:"POST",headers:T({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!s.ok)throw new Error(`Jina scrape failed: ${s.status} ${s.statusText}`);let n=await s.text(),o=n.match(/^#\s+(.+)/m),a=o?o[1]:new URL(e).hostname,i=n.length>t?n.slice(0,t)+`

[...truncated]`:n;return{url:e,title:a,content:i}}var m={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await E(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",parameters:{url:"The full URL to scrape (must start with http:// or https://)"},execute:async e=>{let t=await S(e.url,5e3);return`# ${t.title}

${t.content}`}}};function I(e){return m[e]}function R(){return Object.values(m).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function $(e){return e in m}var P=5;var v=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function z(){return`You are a helpful assistant with access to web search.

Available tools:
${R()}

IMPORTANT RULES:
- ALWAYS use web_search when the user asks about real-time data (prices, scores, news, weather, dates, events).
- For general knowledge you are confident about, answer directly.
- When unsure, search first \u2014 it's better to search than to guess.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.
After receiving tool results, give your FINAL answer \u2014 do NOT output more tool_calls.
Never make up data \u2014 if the search fails, tell the user.`}function L(e){let t=[],s;for(v.lastIndex=0;(s=v.exec(e))!==null;){let[,n,o]=s;try{let a=JSON.parse(o);$(n)&&t.push({name:n,args:a})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${o}`)}}return t}function j(e){return e.replace(v,"").trim()}async function O(e,t,s=[],n,o){let i=z()+`

`;if(s.length>0){i+=`Recent conversation:
`;for(let y of s){let p=y.role==="user"?"User":"Assistant";i+=`${p}: ${y.content}
`}i+=`
`}i+=`User message: ${t}`;let l=0;for(;l<P;){l++,n?.(`Thinking... (step ${l})`);let p=(await e.generateText({instruction:i})).toString(),A=L(p);if(A.length===0)return j(p);for(let c of A){let _=I(c.name);if(_){n?.(`Using ${c.name}...`);try{let d=await _.execute(c.args);o?.(c.name,c.args,d);let u=`

[Tool Result - ${c.name}]:
${d}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;i+=u}catch(d){let u=d instanceof Error?d.message:String(d);console.error(`[Agent] Tool ${c.name} failed:`,u),i+=`

[Tool Error - ${c.name}]: ${u}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var r=window.oc,f=!1,B=10,C="agent_jina_key";function N(){console.log("\u{1F916} Agent v0.1.0+c974c50"),console.log("   Build: 2026-06-27 17:29:13"),console.log("   https://github.com/Fahell/agent-perchance")}function U(){try{return localStorage.getItem(C)}catch{return null}}function M(e){try{localStorage.setItem(C,e)}catch(t){console.warn("[Agent] Could not save API key to localStorage:",t)}}function F(){return r?r.thread?typeof r.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function K(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 24px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 480px; width: 100%;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 8px;">\u{1F916}</div>
          <h2 style="margin: 0; color: #00d4ff; font-size: 20px;">Agent for Perchance</h2>
          <span style="font-size: 11px; color: #666;">v0.1.0+c974c50</span>
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
  `;let e=document.getElementById("api-key-input"),t=document.getElementById("api-key-save"),s=document.getElementById("api-key-skip"),n=document.getElementById("api-key-error"),o=document.getElementById("api-key-success");async function a(){let i=e.value.trim();if(!i){n.textContent="Por favor, insira uma chave de API.",n.style.display="block",o.style.display="none";return}t.textContent="Validando...",t.disabled=!0,n.style.display="none",o.style.display="none",await x(i)?(M(i),g(i),o.textContent="\u2705 Chave v\xE1lida! Iniciando...",o.style.display="block",console.log("\u{1F511} [Agent] API key saved"),setTimeout(()=>w(),800)):(n.textContent="\u274C Chave inv\xE1lida. Verifique e tente novamente.",n.style.display="block",t.textContent="Salvar e Iniciar",t.disabled=!1)}t.addEventListener("click",a),e.addEventListener("keydown",i=>{i.key==="Enter"&&a()}),s.addEventListener("click",()=>{console.log("\u23ED\uFE0F [Agent] Setup skipped (no API key)"),w()}),r.window.show()}function H(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: #666;">v0.1.0+c974c50</span>
          <button id="settings-btn" style="background: none; border: 1px solid #2a3a5e; color: #666; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">\u2699\uFE0F</button>
        </div>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,document.getElementById("settings-btn").addEventListener("click",J),r.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function J(){let e=k(),t=e?e.slice(0,8)+"..."+e.slice(-4):"Nenhuma",s=document.createElement("div");s.id="settings-overlay",s.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui;",s.innerHTML=`
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
  `,document.body.appendChild(s),document.getElementById("settings-close").addEventListener("click",()=>s.remove()),document.getElementById("settings-save").addEventListener("click",async()=>{let n=document.getElementById("settings-key-input").value.trim(),o=document.getElementById("settings-msg");if(!n){o.textContent="Insira uma chave.",o.style.color="#f87171",o.style.display="block";return}o.textContent="Validando...",o.style.color="#aaa",o.style.display="block",await x(n)?(M(n),g(n),o.textContent="\u2705 Chave salva!",o.style.color="#4ade80",setTimeout(()=>s.remove(),1e3)):(o.textContent="\u274C Chave inv\xE1lida.",o.style.color="#f87171")})}function q(e){return e.trim().startsWith("/agent")}function D(e){let t=e.trim();t==="/agent open"?(r.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(r.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function b(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function V(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),b(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=r.thread.messages.filter(n=>(n.author==="user"||n.author==="ai")&&n!==e).slice(-B).map(n=>({role:n.author==="user"?"user":"assistant",content:n.content})),s=await O(r,e.content,t,n=>{console.log("\u{1F916} [Agent]",n)},(n,o,a)=>{let i=o.query||o.url||"",l=a.slice(0,300).replace(/\n/g," ");b(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${i}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${l}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",s.slice(0,100)),f=!1,r.thread.messages.push({author:"ai",content:s}),b(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${s.length} chars)</div>
  </div>`)}function w(){H(),r.messageRenderingPipeline.push(({message:e,reader:t})=>{e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes(t)||e.hiddenFrom.push(t),console.log(`\u{1F6E1}\uFE0F [Agent] Pipeline: blocked '${t}'`))}),r.thread.on("MessageAdded",function({message:e}){if(e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes("ai")||e.hiddenFrom.push("ai"),console.log("\u{1F6E1}\uFE0F [Agent] Set expectsReply=false, hiddenFrom=[ai] on user message")),e.author==="ai"&&f){let t=r.thread.messages.indexOf(e);t!==-1&&(r.thread.messages.splice(t,1),console.log("\u{1F5D1}\uFE0F [Agent] Removed internal generator message"));return}if(e.author==="user"){if(q(e.content)){D(e.content),setTimeout(()=>{let t=r.thread.messages.indexOf(e);t!==-1&&r.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),f=!0,V(e).catch(t=>{f=!1,console.error("\u274C [Agent] Error:",t),r.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}function W(){N(),console.log("\u{1F680} [Agent] Loading...");let e=U();e?(g(e),console.log("\u{1F511} [Agent] API key loaded from storage"),w()):(console.log("\u{1F511} [Agent] No API key found \u2014 showing setup screen"),K())}F()&&W();
