var $="jina_4cefc39c7f9c4e5e99ffabf239a709b4J1Z5UwXFlX-iw5hg3csfGGruBTo7";function _(e){return{Authorization:`Bearer ${$}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function T(e,t=5){let r=await fetch("https://s.jina.ai/",{method:"POST",headers:_({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!r.ok)throw new Error(`Jina search failed: ${r.status} ${r.statusText}`);let n=await r.json(),i=(n.data||n||[]).slice(0,t).map(o=>({title:o.title||"",url:o.url||"",description:o.description||"",content:o.content||""})),a=i.map((o,l)=>`[${l+1}] ${o.title}
    ${o.url}
    ${o.description}`).join(`

`);return{query:e,results:i,raw:a}}async function R(e,t=5e3){let r=await fetch("https://r.jina.ai/",{method:"POST",headers:_({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!r.ok)throw new Error(`Jina scrape failed: ${r.status} ${r.statusText}`);let n=await r.text(),i=n.match(/^#\s+(.+)/m),a=i?i[1]:new URL(e).hostname,o=n.length>t?n.slice(0,t)+`

[...truncated]`:n;return{url:e,title:a,content:o}}var h={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await T(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",parameters:{url:"The full URL to scrape (must start with http:// or https://)"},execute:async e=>{let t=await R(e.url,5e3);return`# ${t.title}

${t.content}`}}};function v(e){return h[e]}function b(){return Object.values(h).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function A(e){return e in h}var O=5;var m=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function E(){return`You are a helpful assistant with access to web search.

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
Never make up data \u2014 if the search fails, tell the user.`}function M(e){let t=[],r;for(m.lastIndex=0;(r=m.exec(e))!==null;){let[,n,i]=r;try{let a=JSON.parse(i);A(n)&&t.push({name:n,args:a})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${i}`)}}return t}function I(e){return e.replace(m,"").trim()}async function S(e,t,r=[],n,i){let o=E()+`

`;if(r.length>0){o+=`Recent conversation:
`;for(let f of r){let d=f.role==="user"?"User":"Assistant";o+=`${d}: ${f.content}
`}o+=`
`}o+=`User message: ${t}`;let l=0;for(;l<O;){l++,n?.(`Thinking... (step ${l})`);let d=(await e.generateText({instruction:o})).toString(),x=M(d);if(x.length===0)return I(d);for(let c of x){let y=v(c.name);if(y){n?.(`Using ${c.name}...`);try{let u=await y.execute(c.args);i?.(c.name,c.args,u);let p=`

[Tool Result - ${c.name}]:
${u}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;o+=p}catch(u){let p=u instanceof Error?u.message:String(u);console.error(`[Agent] Tool ${c.name} failed:`,p),o+=`

[Tool Error - ${c.name}]: ${p}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var s=window.oc,g=!1,L=10;function P(){console.log("\u{1F916} Agent v0.1.0+f54828e"),console.log("   Build: 2026-06-27 04:27:30"),console.log("   https://github.com/Fahell/agent-perchance")}function N(){return s?s.thread?typeof s.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function U(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <span style="font-size: 11px; color: #666;">v0.1.0+f54828e \xB7 2026-06-27 04:27:30</span>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function F(e){return e.trim().startsWith("/agent")}function j(e){let t=e.trim();t==="/agent open"?(s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(s.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function w(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function k(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),w(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=s.thread.messages.filter(n=>(n.author==="user"||n.author==="ai")&&n!==e).slice(-L).map(n=>({role:n.author==="user"?"user":"assistant",content:n.content})),r=await S(s,e.content,t,n=>{console.log("\u{1F916} [Agent]",n)},(n,i,a)=>{let o=i.query||i.url||"",l=a.slice(0,300).replace(/\n/g," ");w(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${o}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${l}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",r.slice(0,100)),g=!1,s.thread.messages.push({author:"ai",content:r}),w(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${r.length} chars)</div>
  </div>`)}function C(){P(),console.log("\u{1F680} [Agent] Loading..."),U(),s.messageRenderingPipeline.push(({message:e,reader:t})=>{e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes(t)||e.hiddenFrom.push(t),console.log(`\u{1F6E1}\uFE0F [Agent] Pipeline: blocked '${t}'`))}),s.thread.on("MessageAdded",function({message:e}){if(e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes("ai")||e.hiddenFrom.push("ai"),console.log("\u{1F6E1}\uFE0F [Agent] Set expectsReply=false, hiddenFrom=[ai] on user message")),e.author==="ai"&&g){let t=s.thread.messages.indexOf(e);t!==-1&&(s.thread.messages.splice(t,1),console.log("\u{1F5D1}\uFE0F [Agent] Removed internal generator message"));return}if(e.author==="user"){if(F(e.content)){j(e.content),setTimeout(()=>{let t=s.thread.messages.indexOf(e);t!==-1&&s.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),g=!0,k(e).catch(t=>{g=!1,console.error("\u274C [Agent] Error:",t),s.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}N()&&C();
