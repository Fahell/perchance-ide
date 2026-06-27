var A="jina_4cefc39c7f9c4e5e99ffabf239a709b4J1Z5UwXFlX-iw5hg3csfGGruBTo7";function y(e){return{Authorization:`Bearer ${A}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function x(e,t=5){let n=await fetch("https://s.jina.ai/",{method:"POST",headers:y({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!n.ok)throw new Error(`Jina search failed: ${n.status} ${n.statusText}`);let r=await n.json(),a=(r.data||r||[]).slice(0,t).map(o=>({title:o.title||"",url:o.url||"",description:o.description||"",content:o.content||""})),i=a.map((o,f)=>`[${f+1}] ${o.title}
    ${o.url}
    ${o.description}`).join(`

`);return{query:e,results:a,raw:i}}async function _(e,t=5e3){let n=await fetch("https://r.jina.ai/",{method:"POST",headers:y({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!n.ok)throw new Error(`Jina scrape failed: ${n.status} ${n.statusText}`);let r=await n.text(),a=r.match(/^#\s+(.+)/m),i=a?a[1]:new URL(e).hostname,o=r.length>t?r.slice(0,t)+`

[...truncated]`:r;return{url:e,title:i,content:o}}var d={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await x(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",parameters:{url:"The full URL to scrape (must start with http:// or https://)"},execute:async e=>{let t=await _(e.url,5e3);return`# ${t.title}

${t.content}`}}};function T(e){return d[e]}function b(){return Object.values(d).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function v(e){return e in d}var $=5,p=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function O(){return`You are a helpful assistant with access to web search.

Available tools:
${b()}

IMPORTANT RULES:
- ALWAYS use web_search when the user asks about real-time data (prices, scores, news, weather, dates, events).
- For general knowledge you are confident about, answer directly.
- When unsure, search first \u2014 it's better to search than to guess.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.
After receiving tool results, give your FINAL answer \u2014 do NOT output more tool_calls.
Never make up data \u2014 if the search fails, tell the user.`}function E(e){let t=[],n;for(p.lastIndex=0;(n=p.exec(e))!==null;){let[,r,a]=n;try{let i=JSON.parse(a);v(r)&&t.push({name:r,args:i})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${a}`)}}return t}function S(e){return e.replace(p,"").trim()}async function R(e,t,n,r){let i=`${O()}

User message: ${t}`,o=0;for(;o<$;){o++,n?.(`Thinking... (step ${o})`);let h=(await e.generateText({instruction:i})).toString(),m=E(h);if(m.length===0)return S(h);for(let c of m){let w=T(c.name);if(w){n?.(`Using ${c.name}...`);try{let l=await w.execute(c.args);r?.(c.name,c.args,l);let u=`

[Tool Result - ${c.name}]:
${l}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;i+=u}catch(l){let u=l instanceof Error?l.message:String(l);console.error(`[Agent] Tool ${c.name} failed:`,u),i+=`

[Tool Error - ${c.name}]: ${u}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var s=window.oc;function I(){console.log("\u{1F916} Agent v0.1.0+88f5ade"),console.log("   Build: 2026-06-27 02:38:01"),console.log("   https://github.com/Fahell/agent-perchance")}function M(){return s?s.thread?typeof s.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function L(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <span style="font-size: 11px; color: #666;">v0.1.0+88f5ade \xB7 2026-06-27 02:38:01</span>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function N(e){return e.trim().startsWith("/agent")}function P(e){let t=e.trim();t==="/agent open"?(s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(s.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function g(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function U(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),g(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=await R(s,e.content,n=>{console.log("\u{1F916} [Agent]",n)},(n,r,a)=>{let i=r.query||r.url||"",o=a.slice(0,300).replace(/\n/g," ");g(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${i}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${o}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",t.slice(0,100)),s.thread.messages.push({author:"ai",content:t}),g(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${t.length} chars)</div>
  </div>`)}function j(){I(),console.log("\u{1F680} [Agent] Loading..."),L(),s.messageRenderingPipeline.push(({message:e,reader:t})=>{t==="ai"&&e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom=["ai"],console.log("\u{1F6E1}\uFE0F [Agent] Pipeline: blocked AI from seeing user message"))}),s.thread.on("MessageAdded",function({message:e}){if(e.author==="user"){if(N(e.content)){P(e.content),setTimeout(()=>{let t=s.thread.messages.indexOf(e);t!==-1&&s.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),U(e).catch(t=>{console.error("\u274C [Agent] Error:",t),s.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}M()&&j();
