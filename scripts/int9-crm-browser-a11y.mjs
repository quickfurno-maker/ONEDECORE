#!/usr/bin/env node
// INT9C local-only rendered CRM keyboard/mobile accessibility probe.
// Requires synthetic QA identity on dedicated disposable Supabase; no provider activity.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
const ROOT=process.cwd(), BASE=process.env.INT10_BASE_URL ?? "http://127.0.0.1:3900";
assert.match(BASE, /^http:\/\/127\.0\.0\.1:\d+$/, "local browser only");
assert.match(fs.readFileSync("supabase/config.toml","utf8"),/project_id = "OneDecoreInt(?:9|10)Cert"/);
assert.equal(process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE,"disabled");
assert.equal(process.env.ONEDECORE_WHATSAPP_WEBHOOK_MODE,"disabled");
const pw=process.env.PHASE_5C1_QA_PASSWORD;
assert.ok(pw && pw.length>=12,"synthetic local QA password required");
const chrome="C:/Program Files/Google/Chrome/Application/chrome.exe";
assert.ok(fs.existsSync(chrome));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"int9-crm-a11y-")),port=9733;
const browser=spawn(chrome,["--headless=new","--remote-debugging-port="+port,"--user-data-dir="+profile,"--no-first-run","--disable-gpu","about:blank"],{stdio:"ignore"});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=85000){const end=Date.now()+ms;let last;while(Date.now()<end){try{const v=await fn();if(v)return v}catch(e){last=e;}await pause(250);}throw Error("timeout "+(last?.message||""));}
class CDP {
 constructor(ws){this.ws=ws;this.id=1;this.wait=new Map();ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id && this.wait.has(m.id)){const [ok,bad]=this.wait.get(m.id);this.wait.delete(m.id);m.error?bad(Error(m.error.message)):ok(m.result);}});}
 send(method,params={}){return new Promise((ok,bad)=>{const id=this.id++;this.wait.set(id,[ok,bad]);this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(src){const r=await this.send("Runtime.evaluate",{expression:"(async()=>{"+src+"})()",returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
 async go(url){await this.send("Page.navigate",{url});const pathname=new URL(url).pathname;await until(async()=>await this.eval("return document.readyState==='complete' && location.pathname==="+JSON.stringify(pathname)),90000);await pause(500);}
 async viewport(w,h){await this.send("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<600});}
}
const findings=[], routes=["/admin/crm/leads","/admin/crm/nurture","/admin/whatsapp/scheduler","/admin/crm/reports"];
let cdp;
try {
 const entry=await until(async()=>{const j=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();return j.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);});
 const ws=new WebSocket(entry.webSocketDebuggerUrl);await new Promise((ok,bad)=>{ws.addEventListener("open",ok,{once:true});ws.addEventListener("error",bad,{once:true});});cdp=new CDP(ws);
 await cdp.send("Page.enable");await cdp.send("Runtime.enable");
 await cdp.viewport(1366,768);await cdp.go(BASE+"/auth/login?next=%2Fadmin%2Fcrm%2Fleads");
 await until(async()=>cdp.eval("return Boolean(document.querySelector('input[type=email]') && document.querySelector('input[type=password]'))"));
 await cdp.eval(`const em=document.querySelector('input[type=email]'),pw=document.querySelector('input[type=password]');const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};set(em,${JSON.stringify("owner-qa-sa@example.test")});set(pw,${JSON.stringify(pw)});em.form.requestSubmit();return true;`);
 await until(async()=>{const x=await cdp.eval("return location.pathname");return x.startsWith("/admin")?x:false;},90000);
 console.log("PASS local synthetic Super Admin browser login");
 for(const route of routes){
  for(const [w,h] of [[360,800],[390,844],[768,1024],[1366,768]]){
   await cdp.viewport(w,h);await cdp.go(BASE+route);
   const probe=await cdp.eval(`
   const root=document.documentElement, visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
   const controls=[...document.querySelectorAll('button,a[href],input,select,textarea,[role=button]')].filter(visible);
   const unnamed=controls.filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.getAttribute('title')||e.innerText?.trim()||e.getAttribute('placeholder')||e.labels?.length)).map(e=>e.tagName+'.'+String(e.className).slice(0,45)).slice(0,8);
   return {path:location.pathname,overflow:root.scrollWidth-root.clientWidth,main:!!document.querySelector('main'),controls:controls.length,unnamed,appError:document.body.innerText?.includes('Application error: a client-side exception')};
   `);
   const row={route,viewport:w+"x"+h,...probe,focus:null};
   if(w===360 || w===1366){
    await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
    await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
    row.focus=await cdp.eval("const e=document.activeElement;return {tag:e?.tagName||'',name:(e?.getAttribute('aria-label')||e?.innerText||e?.getAttribute('title')||'').trim().slice(0,60)};");
   }
   findings.push(row);
   const ok=probe.path===route&&!probe.appError&&probe.main&&probe.overflow<=1&&probe.controls>0&&probe.unnamed.length===0&&(!row.focus || (row.focus.tag!=="BODY"&&row.focus.tag!=="HTML"));
   console.log((ok?"PASS":"FAIL")+" CRM A11Y "+route+" "+w+"x"+h+" unnamed="+probe.unnamed.length+" overflow="+probe.overflow+" focus="+(row.focus?.tag||"n/a"));
  }
 }
 const pass=findings.filter(x=>x.path===x.route&&!x.appError&&x.main&&x.overflow<=1&&x.controls>0&&x.unnamed.length===0&&(!x.focus || !["BODY","HTML"].includes(x.focus.tag))).length;
 fs.mkdirSync(".artifacts/int9",{recursive:true});
 fs.writeFileSync(".artifacts/int9/crm-browser-a11y.json",JSON.stringify({at:new Date().toISOString(),count:findings.length,pass,findings},null,2));
 console.log("INT9C_BROWSER_A11Y "+pass+"/"+findings.length);
 if(pass!==findings.length)process.exitCode=1;
} finally {
 try{cdp?.ws?.close();}catch{}
 browser.kill();
 try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
}
