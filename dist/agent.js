async function w(e,t=5){let n=`https://s.jina.ai/${encodeURIComponent(e)}`,o=await fetch(n,{headers:{Accept:"application/json","X-Return-Format":"json"}});if(!o.ok)throw new Error(`Jina search failed: ${o.status} ${o.statusText}`);let r=await o.json(),s=(r.data||r||[]).slice(0,t).map(a=>({title:a.title||"",url:a.url||"",description:a.description||"",content:a.content||""})),l=s.map((a,d)=>`[${d+1}] ${a.title}
    ${a.url}
    ${a.description}`).join(`

`);return{query:e,results:s,raw:l}}async function y(e,t=5e3){let n=`https://r.jina.ai/${e}`,o=await fetch(n,{headers:{Accept:"text/markdown"}});if(!o.ok)throw new Error(`Jina scrape failed: ${o.status} ${o.statusText}`);let r=await o.text(),s=r.match(/^#\s+(.+)/m),l=s?s[1]:new URL(e).hostname,a=r.length>t?r.slice(0,t)+`

[...truncated]`:r;return{url:e,title:l,content:a}}var g={web_search:{name:"web_search",description:"Search the web for current information. Returns titles, URLs, and descriptions.",parameters:{query:"The search query string"},execute:async e=>(await w(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the main content from a URL as markdown.",parameters:{url:"The URL to scrape"},execute:async e=>{let t=await y(e.url,5e3);return`# ${t.title}

${t.content}`}}};function _(e){return g[e]}function T(){return Object.values(g).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function v(e){return e in g}var b=5,f=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function $(){return`You have access to the following tools:

${T()}

When you need to use a tool, output a tool_call block EXACTLY like this:

<tool_call name="tool_name">{"param":"value"}</tool_call>

Rules:
- You can output ONE tool_call per response.
- The tool_call must be on its own line.
- After the tool_call, you can add a brief explanation of what you're searching for.
- When you receive tool results, use them to answer the user's question.
- Do NOT output tool_call blocks when responding to tool results \u2014 give your final answer.
- For general knowledge questions, respond directly without using tools.`}function A(e){let t=[],n;for(f.lastIndex=0;(n=f.exec(e))!==null;){let[,o,r]=n;try{let s=JSON.parse(r);v(o)&&t.push({name:o,args:s})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${r}`)}}return t}function O(e){return e.replace(f,"").trim()}async function R(e,t,n,o){let s=`${$()}

User message: ${t}`,l=0;for(;l<b;){l++,n?.(`Thinking... (step ${l})`);let d=(await e.generateText({instruction:s})).toString(),m=A(d);if(m.length===0)return O(d);for(let c of m){let x=_(c.name);if(x){n?.(`Using ${c.name}...`);try{let u=await x.execute(c.args);o?.(c.name,c.args,u);let p=`

[Tool Result - ${c.name}]:
${u}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;s+=p}catch(u){let p=u instanceof Error?u.message:String(u);console.error(`[Agent] Tool ${c.name} failed:`,p),s+=`

[Tool Error - ${c.name}]: ${p}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var i=window.oc;function E(){console.log("\u{1F916} Agent v0.1.0+a845982"),console.log("   Build: 2026-06-27 01:09:52"),console.log("   https://github.com/Fahell/agent-perchance")}function S(){return i?i.thread?typeof i.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function I(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <h2 style="margin: 0 0 12px 0; color: #00d4ff; font-size: 16px;">\u{1F916} Agent Panel</h2>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `,i.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function M(e){return e.trim().startsWith("/agent")}function L(e){let t=e.trim();t==="/agent open"?(i.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(i.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}function h(e){let t=document.getElementById("agent-output");t&&(t.innerHTML+=e,t.scrollTop=t.scrollHeight)}async function k(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80)),h(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">\u{1F4E8} ${e.content.slice(0,80)}</div>
  </div>`);let t=await R(i,e.content,n=>{console.log("\u{1F916} [Agent]",n)},(n,o,r)=>{let s=o.query||o.url||"",l=r.slice(0,300).replace(/\n/g," ");h(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">\u{1F527} ${n}: ${s}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${l}...</div>
      </div>`)});console.log("\u{1F916} [Agent] Response:",t.slice(0,100)),i.thread.messages.push({author:"ai",content:t}),h(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">\u2705 Response sent to chat (${t.length} chars)</div>
  </div>`)}function U(){E(),console.log("\u{1F680} [Agent] Loading..."),I(),i.thread.on("MessageAdded",function({message:e}){if(e.author==="user"){if(M(e.content)){e.expectsReply=!1,e.hiddenFrom=["ai"],L(e.content),setTimeout(()=>{let t=i.thread.messages.indexOf(e);t!==-1&&i.thread.messages.splice(t,1)},100);return}e.expectsReply=!1,e.hiddenFrom=["ai"],k(e).catch(t=>{console.error("\u274C [Agent] Error:",t),i.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}S()&&U();
