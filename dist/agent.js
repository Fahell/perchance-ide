var $="jina_4cefc39c7f9c4e5e99ffabf239a709b4J1Z5UwXFlX-iw5hg3csfGGruBTo7";function y(e){return{Authorization:`Bearer ${$}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function _(e,t=5){let n=await fetch("https://s.jina.ai/",{method:"POST",headers:y({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!n.ok)throw new Error(`Jina search failed: ${n.status} ${n.statusText}`);let r=await n.json(),i=(r.data||r||[]).slice(0,t).map(o=>({title:o.title||"",url:o.url||"",description:o.description||"",content:o.content||""})),a=i.map((o,h)=>`[${h+1}] ${o.title}
    ${o.url}
    ${o.description}`).join(`

`);return{query:e,results:i,raw:a}}async function T(e,t=5e3){let n=await fetch("https://r.jina.ai/",{method:"POST",headers:y({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!n.ok)throw new Error(`Jina scrape failed: ${n.status} ${n.statusText}`);let r=await n.text(),i=r.match(/^#\s+(.+)/m),a=i?i[1]:new URL(e).hostname,o=r.length>t?r.slice(0,t)+`

[...truncated]`:r;return{url:e,title:a,content:o}}var p={web_search:{name:"web_search",description:"Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",parameters:{query:"The search query string. Be specific \u2014 include topic, year, or context when relevant."},execute:async e=>(await _(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",parameters:{url:"The full URL to scrape (must start with http:// or https://)"},execute:async e=>{let t=await T(e.url,5e3);return`# ${t.title}

${t.content}`}}};function b(e){return p[e]}function v(){return Object.values(p).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function R(e){return e in p}var O=5,g=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function E(){return`You are a helpful assistant with access to web search.

Available tools:
${v()}

IMPORTANT RULES:
- ALWAYS use web_search when the user asks about real-time data (prices, scores, news, weather, dates, events).
- For general knowledge you are confident about, answer directly.
- When unsure, search first \u2014 it's better to search than to guess.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.
After receiving tool results, give your FINAL answer \u2014 do NOT output more tool_calls.
Never make up data \u2014 if the search fails, tell the user.`}function S(e){let t=[],n;for(g.lastIndex=0;(n=g.exec(e))!==null;){let[,r,i]=n;try{let a=JSON.parse(i);R(r)&&t.push({name:r,args:a})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${i}`)}}return t}function I(e){return e.replace(g,"").trim()}async function A(e,t,n,r){let a=`${E()}

User message: ${t}`,o=0;for(;o<O;){o++,n?.(`Thinking... (step ${o})`);let m=(await e.generateText({instruction:a})).toString(),w=S(m);if(w.length===0)return I(m);for(let c of w){let x=b(c.name);if(x){n?.(`Using ${c.name}...`);try{let l=await x.execute(c.args);r?.(c.name,c.args,l);let d=`

[Tool Result - ${c.name}]:
${l}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;a+=d}catch(l){let d=l instanceof Error?l.message:String(l);console.error(`[Agent] Tool ${c.name} failed:`,d),a+=`

[Tool Error - ${c.name}]: ${d}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var s=window.oc,u=!1;function M(){console.log("\u{1F916} Agent v0.1.0+516fc2d"),console.log("   Build: 2026-06-27 03:46:50"),console.log("   https://github.com/Fahell/agent-perchance")}function L(){return s?s.thread?typeof s.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function P(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <span style="font-size: 11px; color: #666;">v0.1.0+516fc2d \xB7 2026-06-27 03:46:50</span>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function N(e){return e.trim().startsWith("/agent")}function U(e){let t=e.trim();t==="/agent open"?(s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(s.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function f(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function j(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),f(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=await A(s,e.content,n=>{console.log("\u{1F916} [Agent]",n)},(n,r,i)=>{let a=r.query||r.url||"",o=i.slice(0,300).replace(/\n/g," ");f(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${a}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${o}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",t.slice(0,100)),u=!1,s.thread.messages.push({author:"ai",content:t}),f(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${t.length} chars)</div>
  </div>`)}function k(){M(),console.log("\u{1F680} [Agent] Loading..."),P(),s.messageRenderingPipeline.push(({message:e,reader:t})=>{e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom||(e.hiddenFrom=[]),e.hiddenFrom.includes(t)||e.hiddenFrom.push(t),console.log(`\u{1F6E1}\uFE0F [Agent] Pipeline: blocked '${t}'`))}),s.thread.on("MessageAdded",function({message:e}){if(e.author==="ai"&&u){let t=s.thread.messages.indexOf(e);t!==-1&&(s.thread.messages.splice(t,1),console.log("\u{1F5D1}\uFE0F [Agent] Removed internal generator message"));return}if(e.author==="user"){if(N(e.content)){U(e.content),setTimeout(()=>{let t=s.thread.messages.indexOf(e);t!==-1&&s.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),u=!0,j(e).catch(t=>{u=!1,console.error("\u274C [Agent] Error:",t),s.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}L()&&k();
