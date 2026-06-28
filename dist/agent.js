var v="";function m(e){v=e}function E(){return v}async function w(e){try{return(await fetch("https://s.jina.ai/",{method:"POST",headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({q:"test"})})).ok}catch{return!1}}function R(e){return{Authorization:`Bearer ${v}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function S(e,t=5){let o=await fetch("https://s.jina.ai/",{method:"POST",headers:R({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!o.ok)throw new Error(`Jina search failed: ${o.status} ${o.statusText}`);let n=await o.json(),r=(n.data||n||[]).slice(0,t).map(s=>({title:s.title||"",url:s.url||"",description:s.description||"",content:s.content||""})),a=r.map((s,u)=>`[${u+1}] ${s.title}
    ${s.url}
    ${s.description}`).join(`

`);return{query:e,results:r,raw:a}}async function I(e,t=3e3){let o=await fetch("https://r.jina.ai/",{method:"POST",headers:R({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!o.ok)throw new Error(`Jina scrape failed: ${o.status} ${o.statusText}`);let n=await o.text(),r=n.match(/^#\s+(.+)/m),a=r?r[1]:new URL(e).hostname,s=n.length>t?n.slice(0,t)+`

[...truncated]`:n;return{url:e,title:a,content:s}}var k={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await S(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this after web_search to read the actual page content of the most relevant URLs. Returns real article/page text, not just summaries.",parameters:{url:"The full URL to scrape (must start with http:// or https://)",maxChars:"Maximum characters to return (default 3000). Use higher values for detailed articles."},execute:async e=>{let t=typeof e.maxChars=="number"?e.maxChars:3e3,o=await I(e.url,t);return`# ${o.title}

${o.content}`}}};function $(e){return k[e]}function M(){return Object.values(k).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function B(e){return e in k}var O=8;var _=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function D(){return`You are a helpful research assistant with access to web search and page fetching.

Available tools:
${M()}

RESEARCH WORKFLOW (two phases):
1. SEARCH: Use web_search to find relevant results with URLs and summaries.
2. FETCH: Review the results, then use scrape_url on the 1-2 most relevant URLs to read their full content.
3. SYNTHESIZE: Give your final answer based on the real page content you fetched.

RULES:
- ALWAYS use web_search when the user asks about real-time data (prices, scores, news, weather, dates, events) or any topic you're not 100% sure about.
- For simple general knowledge you are confident about, answer directly without searching.
- After web_search: analyze the results, then use scrape_url on the best 1-2 URLs. Do NOT answer from summaries alone.
- After scrape_url: give your FINAL answer based on the real page content.
- You may use web_search ONCE per query, then up to 2 scrape_url calls.
- If scrape_url fails for a URL, try another URL from the results or answer from what you have.
- Never make up data \u2014 if everything fails, tell the user.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.`}function N(e){let t=[],o;for(_.lastIndex=0;(o=_.exec(e))!==null;){let[,n,r]=o;try{let a=JSON.parse(r);B(n)&&t.push({name:n,args:a})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${r}`)}}return t}function F(e){return e.replace(_,"").trim()}async function C(e,t,o=[],n,r){let s=D()+`

`;if(o.length>0){s+=`Recent conversation:
`;for(let g of o){let f=g.role==="user"?"User":"Assistant";s+=`${f}: ${g.content}
`}s+=`
`}s+=`User message: ${t}`;let u=0;for(;u<O;){u++,n?.(`Thinking... (step ${u})`);let f=(await e.generateText({instruction:s})).toString(),y=N(f);if(y.length===0){let l=F(f);if(l.length>0)return l;if(u<O){n?.("Retrying \u2014 empty response..."),s+=`

Your previous response was empty. Write a clear, concise answer to the user's question using the information above. Do NOT output tool_call XML \u2014 just write your answer directly.`;continue}}for(let l of y){let h=$(l.name);if(h){n?.(`Using ${l.name}...`);try{let d=await h.execute(l.args);r?.(l.name,l.args,d);let c="";l.name==="web_search"?c="Analyze these search results. Pick the 1-2 most relevant URLs and use scrape_url to read their full content before answering.":l.name==="scrape_url"?c="Write a clear, direct answer to the user's original question using the page content above. Keep it concise \u2014 2-4 sentences. If the content doesn't contain the answer, use the search results from earlier.":c="Now respond to the user based on this information.";let b=`

[Tool Result - ${l.name}]:
${d}

${c}`;s+=b}catch(d){let c=d instanceof Error?d.message:String(d);console.error(`[Agent] Tool ${l.name} failed:`,c),s+=`

[Tool Error - ${l.name}]: ${c}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var x=null;function z(e){x=e}function H(){return x?.thread?.customData?x.thread.customData:{}}function L(e){try{return H()[e]??void 0}catch(t){console.warn("[Storage] get("+e+") failed:",t);return}}function P(e,t){try{if(!x?.thread?.customData){console.warn("[Storage] set: oc.thread.customData not available");return}x.thread.customData[e]=t}catch(o){console.warn("[Storage] set("+e+") failed:",o)}}var i=window.oc,A=!1,W=10;function Y(){console.log("\u{1F916} Agent v0.1.0+0215d2b"),console.log("   Build: 2026-06-28 00:28:28"),console.log("   https://github.com/Fahell/agent-perchance")}var K="agent:jina_key";function q(){return L(K)??null}function j(e){P(K,e)}function J(){return i?i.thread?typeof i.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function X(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 24px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 480px; width: 100%;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 8px;">\u{1F916}</div>
          <h2 style="margin: 0; color: #00d4ff; font-size: 20px;">Agent for Perchance</h2>
          <span style="font-size: 11px; color: #666;">v0.1.0+0215d2b</span>
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
  `;let e=document.getElementById("api-key-input"),t=document.getElementById("api-key-save"),o=document.getElementById("api-key-skip"),n=document.getElementById("api-key-error"),r=document.getElementById("api-key-success");async function a(){let s=e.value.trim();if(!s){n.textContent="Por favor, insira uma chave de API.",n.style.display="block",r.style.display="none";return}t.textContent="Validando...",t.disabled=!0,n.style.display="none",r.style.display="none",await w(s)?(j(s),m(s),r.textContent="\u2705 Chave v\xE1lida! Iniciando...",r.style.display="block",console.log("\u{1F511} [Agent] API key saved to customData"),setTimeout(()=>T(),800)):(n.textContent="\u274C Chave inv\xE1lida. Verifique e tente novamente.",n.style.display="block",t.textContent="Salvar e Iniciar",t.disabled=!1)}t.addEventListener("click",a),e.addEventListener("keydown",s=>{s.key==="Enter"&&a()}),o.addEventListener("click",()=>{console.log("\u23ED\uFE0F [Agent] Setup skipped (no API key)"),T()}),i.window.show()}function V(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 8px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-shrink: 0;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 14px;">\u{1F916} Agent Panel</h2>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 10px; color: #666;">v0.1.0+0215d2b</span>
          <button id="settings-btn" style="background: none; border: 1px solid #2a3a5e; color: #666; font-size: 10px; padding: 1px 6px; border-radius: 4px; cursor: pointer;">\u2699\uFE0F</button>
        </div>
      </div>
      <div id="agent-output" style="flex: 1; min-height: 0; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,document.getElementById("settings-btn").addEventListener("click",G),i.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function G(){let e=E(),t=e?e.slice(0,8)+"..."+e.slice(-4):"Nenhuma",o=document.createElement("div");o.id="settings-overlay",o.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui;",o.innerHTML=`
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
  `,document.body.appendChild(o),document.getElementById("settings-close").addEventListener("click",()=>o.remove()),document.getElementById("settings-save").addEventListener("click",async()=>{let n=document.getElementById("settings-key-input").value.trim(),r=document.getElementById("settings-msg");if(!n){r.textContent="Insira uma chave.",r.style.color="#f87171",r.style.display="block";return}r.textContent="Validando...",r.style.color="#aaa",r.style.display="block",await w(n)?(j(n),m(n),r.textContent="\u2705 Chave salva!",r.style.color="#4ade80",setTimeout(()=>o.remove(),1e3)):(r.textContent="\u274C Chave inv\xE1lida.",r.style.color="#f87171")})}function Z(e){let t=e.trim();return t.startsWith("/agent")||t.startsWith("/test-storage")}function Q(e){let t=e.trim();t==="/agent open"?(i.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"?(i.window.hide(),console.log("\u{1FA9F} [Agent] Window closed")):t==="/test-storage"||t==="/test-storage run"?ee():t==="/test-storage check"?te():t==="/test-storage clean"&&(U(),p(`<div style="margin:8px 0;padding:8px;background:#16213e;border-radius:6px;border-left:3px solid #4ade80;">
      <div style="color:#4ade80;">\u{1F9F9} Dados de teste limpos</div>
    </div>`))}function ee(){let e="__test_",t=a=>a<1024?a+" B":a<1048576?(a/1024).toFixed(0)+" KB":(a/1048576).toFixed(0)+" MB";p(`<div style="margin:8px 0;padding:8px;background:#1a1a2e;border-radius:6px;border-left:3px solid #f59e0b;">
    <div style="color:#f59e0b;font-weight:bold;">\u{1F52C} Iniciando teste de storage...</div>
  </div>`);let o=[{label:"1KB",bytes:1024},{label:"5KB",bytes:5*1024},{label:"10KB",bytes:10*1024},{label:"50KB",bytes:50*1024},{label:"100KB",bytes:100*1024},{label:"500KB",bytes:500*1024},{label:"1MB",bytes:1048576},{label:"5MB",bytes:5*1048576},{label:"10MB",bytes:10*1048576},{label:"25MB",bytes:25*1048576},{label:"50MB",bytes:50*1048576},{label:"100MB",bytes:100*1048576}];U();let n=[],r="";for(let{label:a,bytes:s}of o){p(`<div style="margin:2px 0 2px 12px;padding:4px 8px;color:#aaa;font-size:12px;">\u23F3 ${a} (${t(s)})...</div>`);let u="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",g="";for(;g.length<s;)g+=u;g=g.slice(0,s);let f=!1,y=0,l=!1,h=0;try{let c=performance.now();i.thread.customData[e+a]=g,y=Math.round(performance.now()-c),f=!0}catch(c){p(`<div style="margin:1px 0 1px 16px;padding:2px 8px;font-size:11px;color:#f87171;">
        \u274C WRITE FAILED: ${c instanceof Error?c.message:c}
      </div>`),n.push(`${a}\u274C`);break}try{let c=performance.now(),b=i.thread.customData[e+a];h=Math.round(performance.now()-c),l=b===g}catch{l=!1}let d=f&&l;if(p(`<div style="margin:1px 0 1px 16px;padding:2px 8px;font-size:11px;color:${d?"#4ade80":"#f87171"};">
      ${d?"\u2705":"\u274C"} Write: ${y}ms | Read: ${h}ms
    </div>`),n.push(`${a}${d?"\u2705":"\u274C"}`),d&&(r=a),!d)break}p(`<div style="margin:8px 0;padding:8px;background:#16213e;border-radius:6px;border-left:3px solid #4ade80;">
    <div style="color:#4ade80;font-weight:bold;">\u{1F3AF} M\xE1ximo: ${r||"nenhum"}</div>
    <div style="color:#aaa;font-size:11px;margin-top:4px;">${n.join(" \u2192 ")}</div>
    <div style="color:#666;font-size:11px;margin-top:4px;">Recarregue e envie /test-storage check para testar persist\xEAncia</div>
  </div>`)}function te(){let e="__test_",t=["1KB","5KB","10KB","50KB","100KB","500KB","1MB","5MB","10MB","25MB","50MB","100MB"],o=i.thread.customData||{},n=0;p(`<div style="margin:8px 0;padding:8px;background:#1a1a2e;border-radius:6px;border-left:3px solid #f59e0b;">
    <div style="color:#f59e0b;font-weight:bold;">\u{1F50D} Verificando persist\xEAncia...</div>
  </div>`);for(let r of t){let a=o[e+r]!==void 0;a&&n++,p(`<div style="margin:1px 0 1px 16px;padding:2px 8px;font-size:11px;color:${a?"#4ade80":"#f87171"};">
      ${a?"\u2705":"\u274C"} ${r}
    </div>`)}p(`<div style="margin:8px 0;padding:8px;background:#16213e;border-radius:6px;border-left:3px solid #4ade80;">
    <div style="color:#4ade80;font-weight:bold;">\u{1F4CA} ${n}/${t.length} sobreviveram ao reload</div>
  </div>`)}function U(){try{let e=i.thread.customData;if(!e)return;for(let t of Object.keys(e))t.startsWith("__test_")&&delete e[t]}catch{}}function p(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function ne(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),p(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=i.thread.messages.filter(n=>(n.author==="user"||n.author==="ai")&&n!==e).slice(-W).map(n=>({role:n.author==="user"?"user":"assistant",content:n.content})),o=await C(i,e.content,t,n=>{console.log("\u{1F916} [Agent]",n)},(n,r,a)=>{let s=r.query||r.url||"",u=a.slice(0,300).replace(/\n/g," ");p(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${s}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${u}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",o.slice(0,100)),i.thread.messages.push({author:"ai",content:o}),p(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${o.length} chars)</div>
  </div>`)}function T(){V(),i.thread.on("MessageAdded",async function({message:e}){if(e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes("ai")||e.hiddenFrom.push("ai"),console.log("\u{1F6E1}\uFE0F [Agent] Set expectsReply=false, hiddenFrom=[ai] on user message")),e.author==="ai"&&A){let t=i.thread.messages.indexOf(e);t!==-1&&(i.thread.messages.splice(t,1),console.log("\u{1F5D1}\uFE0F [Agent] Removed internal generator message"));return}if(e.author==="user"){if(Z(e.content)){Q(e.content),setTimeout(()=>{let t=i.thread.messages.indexOf(e);t!==-1&&i.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),A=!0;try{await ne(e)}catch(t){console.error("\u274C [Agent] Error:",t),i.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})}finally{A=!1}}}),console.log("\u2705 [Agent] Ready!")}async function oe(){Y(),console.log("\u{1F680} [Agent] Loading..."),z(i);let e=q();e?(m(e),console.log("\u{1F511} [Agent] API key loaded from customData"),T()):(console.log("\u{1F511} [Agent] No API key found \u2014 showing setup screen"),X())}J()&&oe();
