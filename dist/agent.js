async function m(e,t=5){let r=`https://s.jina.ai/${encodeURIComponent(e)}`,n=await fetch(r,{headers:{Accept:"application/json","X-Return-Format":"json"}});if(!n.ok)throw new Error(`Jina search failed: ${n.status} ${n.statusText}`);let o=await n.json(),i=(o.data||o||[]).slice(0,t).map(s=>({title:s.title||"",url:s.url||"",description:s.description||"",content:s.content||""})),u=i.map((s,g)=>`[${g+1}] ${s.title}
    ${s.url}
    ${s.description}`).join(`

`);return{query:e,results:i,raw:u}}async function w(e,t=5e3){let r=`https://r.jina.ai/${e}`,n=await fetch(r,{headers:{Accept:"text/markdown"}});if(!n.ok)throw new Error(`Jina scrape failed: ${n.status} ${n.statusText}`);let o=await n.text(),i=o.match(/^#\s+(.+)/m),u=i?i[1]:new URL(e).hostname,s=o.length>t?o.slice(0,t)+`

[...truncated]`:o;return{url:e,title:u,content:s}}var d={web_search:{name:"web_search",description:"Search the web for current information. Returns titles, URLs, and descriptions.",parameters:{query:"The search query string"},execute:async e=>(await m(e.query,5)).raw||"No results found."},scrape_url:{name:"scrape_url",description:"Fetch and extract the main content from a URL as markdown.",parameters:{url:"The URL to scrape"},execute:async e=>{let t=await w(e.url,5e3);return`# ${t.title}

${t.content}`}}};function y(e){return d[e]}function x(){return Object.values(d).map(e=>`- ${e.name}: ${e.description}
  Parameters: ${JSON.stringify(e.parameters)}`).join(`
`)}function T(e){return e in d}var $=5,h=/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;function A(){return`You have access to the following tools:

${x()}

When you need to use a tool, output a tool_call block EXACTLY like this:

<tool_call name="tool_name">{"param":"value"}</tool_call>

Rules:
- You can output ONE tool_call per response.
- The tool_call must be on its own line.
- After the tool_call, you can add a brief explanation of what you're searching for.
- When you receive tool results, use them to answer the user's question.
- Do NOT output tool_call blocks when responding to tool results \u2014 give your final answer.
- For general knowledge questions, respond directly without using tools.`}function v(e){let t=[],r;for(h.lastIndex=0;(r=h.exec(e))!==null;){let[,n,o]=r;try{let i=JSON.parse(o);T(n)&&t.push({name:n,args:i})}catch{console.warn(`[Agent] Failed to parse tool_call args: ${o}`)}}return t}function b(e){return e.replace(h,"").trim()}async function R(e,t,r){let o=`${A()}

User message: ${t}`,i=0;for(;i<$;){i++,r?.(`Thinking... (step ${i})`);let s=(await e.generateText({instruction:o})).toString(),g=v(s);if(g.length===0)return b(s);for(let c of g){let f=y(c.name);if(f){r?.(`Using ${c.name}...`);try{let l=await f.execute(c.args),p=`

[Tool Result - ${c.name}]:
${l}

Now respond to the user based on this information. Do NOT use any more tools \u2014 give your final answer.`;o+=p}catch(l){let p=l instanceof Error?l.message:String(l);console.error(`[Agent] Tool ${c.name} failed:`,p),o+=`

[Tool Error - ${c.name}]: ${p}

The tool failed. Respond to the user explaining the issue.`}}}}return"I apologize, but I wasn't able to complete that task after multiple attempts."}var a=window.oc;function _(){return a?a.thread?typeof a.generateText!="function"?(console.error("\u274C [Agent] oc.generateText not available"),!1):!0:(console.error("\u274C [Agent] oc.thread not available"),!1):(console.error("\u274C [Agent] window.oc not found \u2014 are you running inside Perchance?"),!1)}function O(){document.body.innerHTML=`
    <div style="font-family: system-ui; padding: 20px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0;">
      <h2 style="margin: 0 0 10px 0; color: #00d4ff;">\u{1F916} Agent Panel</h2>
      <p style="color: #888; font-size: 14px;">Window is active. Agent is running.</p>
      <div id="agent-output" style="margin-top: 20px;"></div>
    </div>
  `,a.window.show(),console.log("\u{1FA9F} [Agent] Window opened")}function S(e){return e.trim().startsWith("/agent")}function E(e){let t=e.trim();t==="/agent open"?(a.window.show(),console.log("\u{1FA9F} [Agent] Window opened")):t==="/agent close"&&(a.window.hide(),console.log("\u{1FA9F} [Agent] Window closed"))}async function L(e){console.log("\u{1F916} [Agent] Processing:",e.content.slice(0,80));let t=document.getElementById("agent-output");t&&(t.innerHTML+=`<div style="margin: 5px 0; color: #00d4ff;">\u{1F50D} ${e.content.slice(0,60)}...</div>`);let r=await R(a,e.content,n=>{console.log("\u{1F916} [Agent]",n)});console.log("\u{1F916} [Agent] Response:",r.slice(0,100)),a.thread.messages.push({author:"ai",content:r}),t&&(t.innerHTML+=`<div style="margin: 5px 0; color: #4ade80;">\u2705 Done (${r.length} chars)</div>`)}function P(){console.log("\u{1F680} [Agent] Loading..."),O(),a.thread.on("MessageAdded",function({message:e}){if(e.author==="user"){if(S(e.content)){e.expectsReply=!1,e.hiddenFrom=["ai"],E(e.content),setTimeout(()=>{let t=a.thread.messages.indexOf(e);t!==-1&&a.thread.messages.splice(t,1)},100);return}e.expectsReply=!1,e.hiddenFrom=["ai"],L(e).catch(t=>{console.error("\u274C [Agent] Error:",t),a.thread.messages.push({author:"ai",content:`Sorry, I encountered an error: ${t instanceof Error?t.message:String(t)}`})})}}),console.log("\u2705 [Agent] Ready!")}_()&&P();
