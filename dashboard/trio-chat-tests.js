// Dependency-free regression checks. Run: node dashboard/trio-chat-tests.js
const fs=require("node:fs");
const assert=require("node:assert/strict");
const root=__dirname;
const html=fs.readFileSync(root+"/trio-chat.html","utf8");
const script=html.slice(html.indexOf("<script>")+8,html.indexOf("</script>"));
assert.ok(script.length>0,"script exists");
new Function(script);
for(const id of ["newChat","settingsBtn","selectMode","send","searchMessagesBtn","connectAllBtn","folderAdd","connectDialog","searchDialog","folderDialog","apiToken","apiConnect","generateBtn","stopBtn","delegateBtn","taskMonitorBtn"])assert.ok(html.includes('id="'+id+'"'),"missing control "+id);
for(const marker of ["trioNewChat","trioLocalAction","searchResults","Connect everything","branch-msg","bookmark-msg","reply-msg","edit-msg","data-localact","data-remoteact","generateResponse","streamModel","localStorage"])assert.ok(html.includes(marker),"missing behavior "+marker);
assert.ok(html.includes("aria-label"),"controls expose accessible names");
assert.ok(html.includes("min-height:44px"),"touch target CSS");
assert.ok(!html.includes("onmouseover"),"no hover-only event handlers");
for(const file of ["api/trio.js","api/generate.js","api/task.js"]){const code=fs.readFileSync(root+"/"+file,"utf8");new Function("module","require","process","Buffer","fetch",code)}
JSON.parse(fs.readFileSync(root+"/vercel.json","utf8"));
async function unauth(code,req){const mod={exports:{}};mod.exports=new Function("module","require","process","Buffer","fetch",code)(mod,require,process,Buffer,fetch);let status=200,body;const res={status(n){status=n;return this},setHeader(){return this},end(v){body=v},json(v){body=v}};await mod.exports(req,res);return{status,body}}
(async()=>{const api=fs.readFileSync(root+"/api/trio.js","utf8"),gen=fs.readFileSync(root+"/api/generate.js","utf8"),task=fs.readFileSync(root+"/api/task.js","utf8");assert.equal((await unauth(api,{method:"GET",url:"/api/trio/conversations",query:{path:"conversations"},headers:{}})).status,401);assert.equal((await unauth(gen,{method:"POST",headers:{},body:{messages:[]}})).status,401);assert.equal((await unauth(task,{method:"GET",headers:{},query:{id:"task_test"}})).status,401);console.log("Trio Chat syntax, UI invariant and auth-boundary tests passed.")})().catch(e=>{console.error(e);process.exitCode=1});
