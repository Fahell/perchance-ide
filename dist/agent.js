var $="jina_4cefc39c7f9c4e5e99ffabf239a709b4J1Z5UwXFlX-iw5hg3csfGGruBTo7";function x(e){return{Authorization:`Bearer ${$}`,"Content-Type":"application/json",Accept:"application/json",...e}}async function y(e,t=5){let n=await fetch("https://s.jina.ai/",{method:"POST",headers:x({"X-Return-Format":"json"}),body:JSON.stringify({q:e,num:t})});if(!n.ok)throw new Error(`Jina search failed: ${n.status} ${n.statusText}`);let r=await n.json(),i=(r.data||r||[]).slice(0,t).map(o=>({title:o.title||"",url:o.url||"",description:o.description||"",content:o.content||""})),a=i.map((o,f)=>`[${f+1}] ${o.title}
    ${o.url}
    ${o.description}`).join(`

`);return{query:e,results:i,raw:a}}async function _(e,t=5e3){let n=await fetch("https://r.jina.ai/",{method:"POST",headers:x({Accept:"text/markdown"}),body:JSON.stringify({url:e})});if(!n.ok)throw new Error(`Jina scrape failed: ${n.status} ${n.statusText}`);let r=await n.text(),i=r.match(/^#\s+(.+)/m),a=i?i[1]:new URL(e).hostname,o=r.length>t?r.slice(0,t)+`

[...truncated]`:r;return{url:e,title:a,content:o}}var d={web_search:{name:"web_search",description:"Search the web for current information. Returns titles, URLs, and descriptions.",parameters:{query:"The search query string"},execute:async e=>(await y(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the main content from a URL as markdown.",parameters:{url:"The URL to scrape"},execute:async e=>{let t=await _(e.url,5e3);return`# ${t.title}

${t.content}`}}};function T(e){return d[e]}function b(){return Object.values(d).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function v(e){return e in d}var A=5,g=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function O(){return`You have access to the following tools:

${b()}

When you need to use a tool, output a tool_call block EXACTLY like this:

<tool_call name="tool_name">{"param":"value"}</tool_call>

Rules:
- You can output ONE tool_call per response.
- The tool_call must be on its own line.
- After the tool_call, you can add a brief explanation of what you're searching for.
- When you receive tool results, use them to answer the user's question.
- Do NOT output tool_call blocks when responding to tool results \u2014 give your final answer.
- For general knowledge questions, respond directly without using tools.`}function S(e){let t=[],n;for(g.lastIndex=0;(n=g.exec(e))!==null;){let[,r,i]=n;try{let a=JSON.parse(i);v(r)&&t.push({name:r,args:a})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${i}`)}}return t}function E(e){return e.replace(g,"").trim()}async function R(e,t,n,r){let a=`${O()}

User message: ${t}`,o=0;for(;o<A;){o++,n?.(`Thinking... (step ${o})`);let h=(await e.generateText({instruction:a})).toString(),m=S(h);if(m.length===0)return E(h);for(let c of m){let w=T(c.name);if(w){n?.(`Using ${c.name}...`);try{let l=await w.execute(c.args);r?.(c.name,c.args,l);let u=`

[Tool Result - ${c.name}]:
${l}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;a+=u}catch(l){let u=l instanceof Error?l.message:String(l);console.error(`[Agent] Tool ${c.name} failed:`,u),a+=`

[Tool Error - ${c.name}]: ${u}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var s=window.oc;function I(){console.log("\u{1F916} Agent v0.1.0+7431ed5"),console.log("   Build: 2026-06-27 02:18:05"),console.log("   https://github.com/Fahell/agent-perchance")}function M(){return s?s.thread?typeof s.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function P(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
        <span style="font-size: 11px; color: #666;">v0.1.0+7431ed5 \xB7 2026-06-27 02:18:05</span>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function L(e){return e.trim().startsWith("/agent")}function k(e){let t=e.trim();t==="/agent open"?(s.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(s.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function p(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function N(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),p(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=await R(s,e.content,n=>{console.log("\u{1F916} [Agent]",n)},(n,r,i)=>{let a=r.query||r.url||"",o=i.slice(0,300).replace(/\n/g," ");p(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${a}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${o}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",t.slice(0,100)),s.thread.messages.push({author:"ai",content:t}),p(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${t.length} chars)</div>
  </div>`)}function j(){I(),console.log("\u{1F680} [Agent] Loading..."),P(),s.messageRenderingPipeline.push(({message:e,reader:t})=>{t==="ai"&&e.author==="user"&&(e.expectsReply=!1,e.hiddenFrom=["ai"],console.log("\u{1F6E1}\uFE0F [Agent] Pipeline: blocked AI from seeing user message"))}),s.thread.on("MessageAdded",function({message:e}){if(e.author==="user"){if(L(e.content)){k(e.content),setTimeout(()=>{let t=s.thread.messages.indexOf(e);t!==-1&&s.thread.messages.splice(t,1)},100);return}console.log("\u{1F4E8} [Agent] Processing:",e.content.slice(0,80)),N(e).catch(t=>{console.error("\u274C [Agent] Error:",t),s.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}M()&&j();
