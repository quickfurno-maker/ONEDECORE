"use client";

import { useMemo,useState,type ReactNode } from "react";
import type { AutomationRuleRow,CommerceAutomationDashboard } from "../server/automation-queries";
import {
  archiveCommerceAutomationRuleAction,cancelCommerceAutomationJobAction,
  cancelCommerceAutomationNotificationAction,cancelCommerceAutomationTaskAction,
  completeCommerceAutomationTaskAction,replayCommerceAutomationEventAction,
  retryCommerceAutomationJobAction,runCommerceAutomationWorkerAction,
  saveCommerceAutomationRuleAction,setCommerceAutomationChannelEnabledAction,
  setCommerceAutomationRuleEnabledAction,setCommerceAutomationRuntimeEnabledAction,
  updateCommerceAutomationChannelAction,
} from "../server/automation-actions";

const TABS=["Overview","Workflows","Queue","Tasks","WhatsApp","Activity"] as const;
type Tab=(typeof TABS)[number];
const EVENTS=[
  "order.confirmed","order.processing","order.shipped","order.delivered","order.cancelled",
  "vendor.product_submitted","vendor.changes_requested","vendor.product_approved",
  "vendor.product_rejected","vendor.product_published",
] as const;
const panel="rounded-2xl border border-[var(--od-border)] bg-[var(--od-surface)] shadow-sm";
const input="min-h-10 w-full rounded-xl border border-[var(--od-border)] bg-[var(--od-bg)] px-3 text-sm text-[var(--od-text)] outline-none focus:border-[var(--od-gold)]";
const button="inline-flex min-h-9 items-center justify-center rounded-xl border border-[var(--od-border-strong)] px-3 text-xs font-semibold text-[var(--od-text)] transition hover:bg-[var(--od-hover)]";
const primary="inline-flex min-h-9 items-center justify-center rounded-xl bg-[var(--od-gold)] px-4 text-xs font-semibold text-[#111] transition hover:opacity-90";
const danger="inline-flex min-h-9 items-center justify-center rounded-xl border border-red-500/30 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-500/10";
function time(value:string|null):string {
  if(!value) return "—";
  return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}
function pretty(value:string):string {
  return value.replace(/[._-]+/g," ").replace(/\b\w/g,(char)=>char.toUpperCase());
}
function Pill({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"good"|"warn"|"bad"}) {
  const styles={neutral:"border-[var(--od-border)] text-[var(--od-text-2)]",good:"border-emerald-500/25 bg-emerald-500/8 text-emerald-400",warn:"border-amber-500/25 bg-amber-500/8 text-amber-300",bad:"border-red-500/25 bg-red-500/8 text-red-400"};
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${styles[tone]}`}>{children}</span>;
}
function Metric({label,value,detail}:{label:string;value:string;detail:string}) {
  return <div className={`${panel} p-4`}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--od-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--od-text)]">{value}</p><p className="mt-1 text-xs text-[var(--od-text-2)]">{detail}</p></div>;
}
function SectionTitle({title,detail,action}:{title:string;detail?:string;action?:ReactNode}) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-base font-semibold text-[var(--od-text)]">{title}</h2>{detail?<p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--od-muted)]">{detail}</p>:null}</div>{action}</div>;
}

function RuleEditor({rule,channels}:{rule?:AutomationRuleRow;channels:CommerceAutomationDashboard["channels"]}) {
  const [kind,setKind]=useState(rule?.action_kind ?? "notification");
  const isNotification=kind==="notification";
  return <form action={saveCommerceAutomationRuleAction} className="grid gap-4 lg:grid-cols-2">
    <input type="hidden" name="id" value={rule?.id ?? ""}/>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Workflow name</span><input className={input} name="name" defaultValue={rule?.name ?? ""} required placeholder="Order confirmed customer update"/></label>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Rule code</span><input className={input} name="code" defaultValue={rule?.code ?? ""} required pattern="[a-z0-9_.-]{3,120}" placeholder="order-confirmed-customer"/></label>
    <label className="space-y-1.5 lg:col-span-2"><span className="text-xs font-medium text-[var(--od-text-2)]">Description</span><input className={input} name="description" defaultValue={rule?.description ?? ""} required maxLength={500} placeholder="What this automation does and when it should run"/></label>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Trigger event</span><select className={input} name="eventCode" defaultValue={rule?.event_code ?? EVENTS[0]}>{EVENTS.map((event)=><option key={event} value={event}>{pretty(event)}</option>)}</select></label>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Action type</span><select className={input} name="actionKind" value={kind} onChange={(event)=>setKind(event.target.value)}><option value="notification">Notification</option><option value="task">Internal admin task</option></select></label>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Audience</span><select className={input} name="audience" defaultValue={rule?.audience ?? (isNotification?"customer":"admin")} disabled={!isNotification}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="admin">Admin</option></select>{!isNotification?<input type="hidden" name="audience" value="admin"/>:null}</label>
    {isNotification?<label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Channel</span><select className={input} name="channelCode" defaultValue={rule?.channel_code ?? "whatsapp"}>{channels.map((channel)=><option key={channel.channel_code} value={channel.channel_code}>{channel.display_name}</option>)}</select></label>:<input type="hidden" name="channelCode" value=""/>}
    {isNotification?<label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Template code</span><input className={input} name="templateCode" defaultValue={rule?.template_code ?? ""} required placeholder="order_confirmed_cod"/></label>:<input type="hidden" name="templateCode" value=""/>}
    {!isNotification?<label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Task code</span><input className={input} name="taskCode" defaultValue={rule?.task_code ?? ""} required placeholder="order_start_fulfilment"/></label>:<input type="hidden" name="taskCode" value=""/>}
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Delay (seconds)</span><input className={input} name="delaySeconds" type="number" min="0" max="2592000" defaultValue={rule?.delay_seconds ?? 0}/></label>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Maximum attempts</span><input className={input} name="maxAttempts" type="number" min="1" max="10" defaultValue={rule?.max_attempts ?? 5}/></label>
    <label className="space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Retry base (seconds)</span><input className={input} name="retryBaseSeconds" type="number" min="5" max="86400" defaultValue={rule?.retry_base_seconds ?? 60}/></label>
    <label className="space-y-1.5 lg:col-span-2"><span className="text-xs font-medium text-[var(--od-text-2)]">Advanced config (JSON)</span><textarea className={`${input} min-h-28 py-3 font-mono text-xs`} name="configJson" defaultValue={JSON.stringify(rule?.config ?? {},null,2)} spellCheck={false}/><span className="block text-[11px] text-[var(--od-muted)]">Optional non-secret configuration only. Provider credentials must never be stored here.</span></label>
    <div className="lg:col-span-2 flex justify-end"><button className={primary} type="submit">{rule?"Save workflow":"Create workflow"}</button></div>
  </form>;
}

export function AutomationWorkspace({data,engineEnabled,workerReady}:{data:CommerceAutomationDashboard;engineEnabled:boolean;workerReady:boolean}) {
  const [tab,setTab]=useState<Tab>("Overview");
  const runtimeEnabled=data.settings?.runtime_enabled ?? false;
  const effectiveEngine=engineEnabled && runtimeEnabled;
  const activeRules=data.rules.filter((rule)=>rule.enabled).length;
  const pendingJobs=data.jobs.filter((job)=>job.status==="pending"||job.status==="claimed").length;
  const deadJobs=data.jobs.filter((job)=>job.status==="dead").length;
  const openTasks=data.tasks.filter((task)=>task.status==="open");
  const waitingNotifications=data.outbox.filter((item)=>item.status==="pending_adapter");
  const whatsapp=data.channels.find((channel)=>channel.channel_code==="whatsapp") ?? null;
  const successRate=useMemo(()=>{
    const finished=data.jobs.filter((job)=>job.status==="succeeded"||job.status==="dead");
    if(!finished.length) return "—";
    return `${Math.round((finished.filter((job)=>job.status==="succeeded").length/finished.length)*100)}%`;
  },[data.jobs]);
  return <div className="space-y-5">
    <div className={`${panel} overflow-hidden`}>
      <div className="flex flex-col gap-4 border-b border-[var(--od-border)] p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--od-text)]">E-commerce Automation Control</h2>
            <Pill tone={effectiveEngine?"good":"warn"}>{effectiveEngine?"Running":"Paused"}</Pill>
            <Pill tone={whatsapp?.adapter_status==="certified"?"good":"neutral"}>WhatsApp {whatsapp?.adapter_status?.replace("_"," ") ?? "not provisioned"}</Pill>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--od-muted)]">OneDecore owns the workflow engine. Channel adapters are optional outputs and cannot change commerce state.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runCommerceAutomationWorkerAction}><input type="hidden" name="maxBatch" value="50"/><button className={button} type="submit" disabled={!effectiveEngine||!workerReady}>Run now</button></form>
          <form action={setCommerceAutomationRuntimeEnabledAction}><input type="hidden" name="enabled" value={runtimeEnabled?"false":"true"}/><button className={runtimeEnabled?danger:primary} type="submit">{runtimeEnabled?"Pause runtime":"Resume runtime"}</button></form>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pt-2">
        {TABS.map((item)=><button key={item} type="button" onClick={()=>setTab(item)} className={`relative min-h-11 shrink-0 px-4 text-xs font-semibold transition ${tab===item?"text-[var(--od-gold)]":"text-[var(--od-muted)] hover:text-[var(--od-text)]"}`}>{item}{tab===item?<span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--od-gold)]"/>:null}</button>)}
      </div>
    </div>

    {tab==="Overview"?<div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Engine" value={effectiveEngine?"Live":"Paused"} detail={!engineEnabled?"Deployment gate is OFF":runtimeEnabled?"Runtime processing enabled":"Paused from admin"}/>
        <Metric label="Workflows" value={`${activeRules}/${data.rules.length}`} detail="enabled rules"/>
        <Metric label="Queue" value={String(pendingJobs)} detail="pending / claimed"/>
        <Metric label="Success" value={successRate} detail="completed vs dead"/>
        <Metric label="Tasks" value={String(openTasks.length)} detail="open admin actions"/>
        <Metric label="Outbox" value={String(waitingNotifications.length)} detail="waiting for adapter"/>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className={`${panel} p-5`}>
          <SectionTitle title="Runtime safety" detail="Two independent controls prevent accidental execution. The deployment gate must be on before the admin runtime can process jobs."/>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Deployment gate</p><div className="mt-2"><Pill tone={engineEnabled?"good":"warn"}>{engineEnabled?"Enabled":"Off"}</Pill></div><p className="mt-3 text-xs leading-5 text-[var(--od-text-2)]">Hard environment-level master switch. Admin UI cannot override it.</p></div>
            <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Admin runtime</p><div className="mt-2"><Pill tone={runtimeEnabled?"good":"warn"}>{runtimeEnabled?"Enabled":"Paused"}</Pill></div><p className="mt-3 text-xs leading-5 text-[var(--od-text-2)]">Operational pause/resume without redeploying the application.</p></div>
            <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Worker authentication</p><div className="mt-2"><Pill tone={workerReady?"good":"bad"}>{workerReady?"Ready":"Missing"}</Pill></div><p className="mt-3 text-xs leading-5 text-[var(--od-text-2)]">Internal worker calls require a dedicated commerce automation secret.</p></div>
          </div>
        </section>
        <section className={`${panel} p-5`}>
          <SectionTitle title="Health summary" detail="Actionable issues are surfaced here before they become silent failures."/>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-[var(--od-border)] px-4 py-3"><span className="text-sm text-[var(--od-text-2)]">Dead-letter jobs</span><Pill tone={deadJobs?"bad":"good"}>{deadJobs}</Pill></div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--od-border)] px-4 py-3"><span className="text-sm text-[var(--od-text-2)]">Open admin tasks</span><Pill tone={openTasks.length?"warn":"good"}>{openTasks.length}</Pill></div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--od-border)] px-4 py-3"><span className="text-sm text-[var(--od-text-2)]">Unsent notifications</span><Pill tone="neutral">{waitingNotifications.length}</Pill></div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--od-border)] px-4 py-3"><span className="text-sm text-[var(--od-text-2)]">WhatsApp adapter</span><Pill tone={whatsapp?.adapter_status==="certified"?"good":"neutral"}>{whatsapp?.adapter_status ?? "not connected"}</Pill></div>
          </div>
        </section>
      </div>
    </div>:null}
    {tab==="Workflows"?<div className="space-y-5">
      <section className={`${panel} p-5`}>
        <SectionTitle title="Create workflow" detail="New workflows start disabled. Review the trigger, action and retry policy, then enable them explicitly."/>
        <div className="mt-5"><RuleEditor channels={data.channels}/></div>
      </section>
      <section className={`${panel} p-5`}>
        <SectionTitle title="Workflow library" detail="Editing changes future jobs only. Already queued jobs keep an immutable snapshot of the rule that created them."/>
        <div className="mt-4 space-y-3">
          {data.rules.map((rule)=><details key={rule.id} className="group rounded-xl border border-[var(--od-border)] bg-[var(--od-bg)]">
            <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[var(--od-text)]">{rule.name}</p><Pill tone={rule.enabled?"good":"neutral"}>{rule.enabled?"Enabled":"Disabled"}</Pill>{rule.action_kind==="notification"?<Pill>{rule.channel_code ?? "channel"}</Pill>:<Pill>Internal task</Pill>}</div>
                <p className="mt-1 text-xs text-[var(--od-muted)]">{pretty(rule.event_code)} → {rule.action_kind==="notification"?rule.template_code:rule.task_code}{rule.delay_seconds?` · ${rule.delay_seconds}s delay`:" · immediate"}</p>
              </div>
              <span className="text-xs font-semibold text-[var(--od-muted)] group-open:text-[var(--od-gold)]">Configure</span>
            </summary>
            <div className="border-t border-[var(--od-border)] p-4">
              <p className="mb-4 text-xs leading-5 text-[var(--od-text-2)]">{rule.description}</p>
              <RuleEditor rule={rule} channels={data.channels}/>
              <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-[var(--od-border)] pt-4">
                <form action={archiveCommerceAutomationRuleAction}><input type="hidden" name="id" value={rule.id}/><button className={danger} type="submit">Archive workflow</button></form>
                <form action={setCommerceAutomationRuleEnabledAction}><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="enabled" value={rule.enabled?"false":"true"}/><button className={rule.enabled?danger:primary} type="submit">{rule.enabled?"Disable":"Enable"}</button></form>
              </div>
            </div>
          </details>)}
          {!data.rules.length?<p className="py-6 text-center text-sm text-[var(--od-muted)]">No active workflows.</p>:null}
        </div>
      </section>
    </div>:null}
    {tab==="Queue"?<section className={`${panel} p-5`}>
      <SectionTitle title="Execution queue" detail="Every job carries an immutable action snapshot. Retry and cancellation are explicit admin actions and are written to the automation audit trail." action={<form action={runCommerceAutomationWorkerAction} className="flex items-center gap-2"><input className={`${input} w-20`} name="maxBatch" type="number" min="1" max="100" defaultValue="25"/><button className={primary} type="submit" disabled={!effectiveEngine||!workerReady}>Run batch</button></form>}/>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="border-b border-[var(--od-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--od-muted)]"><tr><th className="p-3">State</th><th className="p-3">Action snapshot</th><th className="p-3">Channel / audience</th><th className="p-3">Attempts</th><th className="p-3">Scheduled</th><th className="p-3">Last error</th><th className="p-3 text-right">Control</th></tr></thead>
          <tbody className="divide-y divide-[var(--od-border)]">
            {data.jobs.map((job)=>{
              const tone=job.status==="succeeded"?"good":job.status==="dead"?"bad":job.status==="pending"||job.status==="claimed"?"warn":"neutral";
              return <tr key={job.id} className="align-top">
                <td className="p-3"><Pill tone={tone}>{job.status}</Pill></td>
                <td className="p-3"><p className="font-medium text-[var(--od-text)]">{job.action_kind_snapshot==="notification"?job.template_code_snapshot:job.task_code_snapshot}</p><p className="mt-1 text-[11px] text-[var(--od-muted)]">{pretty(job.action_kind_snapshot)}</p></td>
                <td className="p-3 text-[var(--od-text-2)]">{job.channel_code_snapshot ?? "Internal"}<span className="block text-[11px] text-[var(--od-muted)]">{job.audience_snapshot ?? "—"}</span></td>
                <td className="p-3 text-[var(--od-text-2)]">{job.attempt_count}/{job.max_attempts}</td>
                <td className="p-3 text-[var(--od-text-2)]">{time(job.scheduled_for)}</td>
                <td className="max-w-56 p-3 text-[11px] text-[var(--od-muted)]">{job.last_error_code ?? "—"}</td>
                <td className="p-3"><div className="flex justify-end gap-2">{job.status==="dead"?<form action={retryCommerceAutomationJobAction}><input type="hidden" name="id" value={job.id}/><button className={button} type="submit">Retry</button></form>:null}{job.status==="pending"||job.status==="dead"?<form action={cancelCommerceAutomationJobAction}><input type="hidden" name="id" value={job.id}/><button className={danger} type="submit">Cancel</button></form>:null}</div></td>
              </tr>;
            })}
          </tbody>
        </table>
        {!data.jobs.length?<p className="py-8 text-center text-sm text-[var(--od-muted)]">No jobs have been generated yet.</p>:null}
      </div>
    </section>:null}
    {tab==="Tasks"?<div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <section className={`${panel} p-5`}>
        <SectionTitle title="Open admin tasks" detail="Automation can create operational work, but it never mutates order or catalogue state on behalf of staff."/>
        <div className="mt-4 space-y-3">
          {openTasks.map((task)=><div key={task.id} className="rounded-xl border border-[var(--od-border)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[var(--od-text)]">{task.title}</p><Pill tone="warn">Open</Pill></div><p className="mt-1 text-xs text-[var(--od-text-2)]">{task.detail}</p><p className="mt-2 text-[11px] text-[var(--od-muted)]">{pretty(task.task_code)} · created {time(task.created_at)}{task.due_at?` · due ${time(task.due_at)}`:""}</p></div><div className="flex gap-2"><form action={completeCommerceAutomationTaskAction}><input type="hidden" name="id" value={task.id}/><button className={primary} type="submit">Complete</button></form><form action={cancelCommerceAutomationTaskAction}><input type="hidden" name="id" value={task.id}/><button className={danger} type="submit">Cancel</button></form></div></div>
          </div>)}
          {!openTasks.length?<div className="rounded-xl border border-dashed border-[var(--od-border)] py-10 text-center"><p className="text-sm font-medium text-[var(--od-text)]">No open automation tasks</p><p className="mt-1 text-xs text-[var(--od-muted)]">New operational tasks will appear here automatically.</p></div>:null}
        </div>
      </section>
      <section className={`${panel} p-5`}>
        <SectionTitle title="Recent task history" detail="Completed and cancelled work remains visible for operational review."/>
        <div className="mt-4 space-y-2">{data.tasks.filter((task)=>task.status!=="open").slice(0,30).map((task)=><div key={task.id} className="flex items-start justify-between gap-3 border-b border-[var(--od-border)] py-3 last:border-0"><div><p className="text-xs font-medium text-[var(--od-text)]">{task.title}</p><p className="mt-1 text-[11px] text-[var(--od-muted)]">{task.detail} · {time(task.created_at)}</p></div><Pill tone={task.status==="done"?"good":"neutral"}>{task.status}</Pill></div>)}</div>
      </section>
    </div>:null}
    {tab==="WhatsApp"?<div className="space-y-5">
      <section className={`${panel} p-5`}>
        <SectionTitle title="WhatsApp adapter" detail="Provisioned now, deliberately disconnected. Commerce creates notification intents; a future certified adapter will deliver them without owning workflow state."/>
        {whatsapp?<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Adapter</p><div className="mt-2"><Pill tone={whatsapp.adapter_status==="certified"?"good":"neutral"}>{whatsapp.adapter_status.replace("_"," ")}</Pill></div></div>
          <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Sending</p><div className="mt-2"><Pill tone={whatsapp.enabled?"good":"neutral"}>{whatsapp.enabled?"Enabled":"Disabled"}</Pill></div></div>
          <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Mode</p><div className="mt-2"><Pill tone={whatsapp.test_mode?"warn":"good"}>{whatsapp.test_mode?"Test":"Live"}</Pill></div></div>
          <div className="rounded-xl border border-[var(--od-border)] p-4"><p className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">Outbox waiting</p><p className="mt-2 text-2xl font-semibold text-[var(--od-text)]">{waitingNotifications.filter((item)=>item.channel_code==="whatsapp").length}</p></div>
        </div>:null}
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-xs font-semibold text-amber-300">Live delivery is locked</p><p className="mt-1 text-xs leading-5 text-[var(--od-text-2)]">Meta credentials, WABA/phone binding, webhook verification and message-template certification are intentionally not connected yet. Provider secrets will remain server-side and will never be stored in this UI configuration.</p></div>
      </section>
      {whatsapp?<div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className={`${panel} p-5`}>
          <SectionTitle title="Channel configuration" detail="Safe, non-secret settings only. Template codes are managed per workflow in the Workflows tab."/>
          <form action={updateCommerceAutomationChannelAction} className="mt-5 space-y-4">
            <input type="hidden" name="channelCode" value="whatsapp"/>
            <label className="block space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Default locale</span><select className={input} name="defaultLocale" defaultValue={whatsapp.default_locale}><option value="en">English</option><option value="en_IN">English (India)</option><option value="hi_IN">Hindi (India)</option></select></label>
            <label className="block space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Delivery mode</span><select className={input} name="testMode" defaultValue={whatsapp.test_mode?"true":"false"}><option value="true">Test mode</option><option value="false">Live mode</option></select><span className="block text-[11px] text-[var(--od-muted)]">Live mode does not send anything until the adapter is certified and enabled.</span></label>
            <label className="block space-y-1.5"><span className="text-xs font-medium text-[var(--od-text-2)]">Adapter config (JSON)</span><textarea className={`${input} min-h-36 py-3 font-mono text-xs`} name="configJson" defaultValue={JSON.stringify(whatsapp.config,null,2)} spellCheck={false}/></label>
            <div className="flex justify-end pt-2"><button className={primary} type="submit">Save configuration</button></div>
          </form>
          <div className="mt-3 flex justify-end">{whatsapp.adapter_status==="certified"?<form action={setCommerceAutomationChannelEnabledAction}><input type="hidden" name="channelCode" value="whatsapp"/><input type="hidden" name="enabled" value={whatsapp.enabled?"false":"true"}/><button className={whatsapp.enabled?danger:primary} type="submit">{whatsapp.enabled?"Disable sending":"Enable sending"}</button></form>:<button type="button" className={`${button} cursor-not-allowed opacity-50`} disabled>Enable after certification</button>}</div>
        </section>
        <section className={`${panel} p-5`}>
          <SectionTitle title="Integration readiness" detail="These gates must be green before the adapter can be certified and live sending can be enabled."/>
          <div className="mt-4 space-y-2">{[
            ["Meta Cloud API credentials","Pending"],["WABA + final phone binding","Pending"],["Webhook verification","Pending"],["Template sync and approval","Pending"],["Sandbox send / delivery certification","Pending"],["Production enable approval","Locked"],
          ].map(([label,state])=><div key={label} className="flex items-center justify-between rounded-xl border border-[var(--od-border)] px-4 py-3"><span className="text-xs text-[var(--od-text-2)]">{label}</span><Pill tone={state==="Pending"?"warn":"neutral"}>{state}</Pill></div>)}</div>
        </section>
      </div>:null}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className={`${panel} p-5`}>
          <SectionTitle title="WhatsApp notification outbox" detail="These are durable communication intents only. They can be cancelled now; no external message can leave OneDecore until the adapter is connected and certified."/>
          <div className="mt-4 space-y-2">
            {data.outbox.filter((item)=>item.channel_code==="whatsapp").slice(0,40).map((item)=><div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[var(--od-border)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-[var(--od-text)]">{pretty(item.template_code)}</p><Pill tone={item.status==="sent"?"good":item.status==="failed"?"bad":item.status==="pending_adapter"?"warn":"neutral"}>{item.status.replace("_"," ")}</Pill></div><p className="mt-1 text-[11px] text-[var(--od-muted)]">{pretty(item.audience)} · {pretty(item.source_kind)} · {time(item.created_at)}</p></div>{item.status==="pending_adapter"?<form action={cancelCommerceAutomationNotificationAction}><input type="hidden" name="id" value={item.id}/><button className={danger} type="submit">Cancel intent</button></form>:null}</div>)}
            {!data.outbox.filter((item)=>item.channel_code==="whatsapp").length?<p className="py-8 text-center text-sm text-[var(--od-muted)]">No WhatsApp notification intents yet.</p>:null}
          </div>
        </section>
        <section className={`${panel} p-5`}>
          <SectionTitle title="Template mappings" detail="Workflow templates are editable without touching provider credentials."/>
          <div className="mt-4 space-y-2">{data.rules.filter((rule)=>rule.action_kind==="notification"&&rule.channel_code==="whatsapp").map((rule)=><div key={rule.id} className="rounded-xl border border-[var(--od-border)] px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-[var(--od-text)]">{rule.name}</p><Pill tone={rule.enabled?"good":"neutral"}>{rule.enabled?"On":"Off"}</Pill></div><p className="mt-1 font-mono text-[11px] text-[var(--od-muted)]">{rule.template_code}</p></div>)}</div>
        </section>
      </div>
    </div>:null}
    {tab==="Activity"?<div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <section className={`${panel} p-5`}>
        <SectionTitle title="Automation events" detail="Immutable intake from canonical commerce lifecycle events. Replay only creates jobs for enabled rules that have not already consumed the event."/>
        <div className="mt-4 space-y-2">{data.events.slice(0,60).map((event)=><details key={event.id} className="rounded-xl border border-[var(--od-border)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><div><p className="text-xs font-semibold text-[var(--od-text)]">{pretty(event.event_code)}</p><p className="mt-1 text-[11px] text-[var(--od-muted)]">{pretty(event.source_kind)} · {time(event.occurred_at)}</p></div><Pill>Inspect</Pill></summary><div className="border-t border-[var(--od-border)] p-4"><pre className="max-h-56 overflow-auto rounded-xl bg-[var(--od-bg)] p-3 text-[11px] leading-5 text-[var(--od-text-2)]">{JSON.stringify(event.payload,null,2)}</pre><div className="mt-3 flex justify-end"><form action={replayCommerceAutomationEventAction}><input type="hidden" name="id" value={event.id}/><button className={button} type="submit">Replay event</button></form></div></div></details>)}</div>
      </section>
      <section className={`${panel} p-5`}>
        <SectionTitle title="Control audit" detail="Rule changes and manual recovery actions remain visible for accountability."/>
        <div className="mt-4 space-y-1">{data.audit.slice(0,60).map((entry)=><div key={entry.id} className="border-b border-[var(--od-border)] py-3 last:border-0"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-[var(--od-text)]">{pretty(entry.action_code)}</p><p className="mt-1 text-[11px] text-[var(--od-muted)]">{pretty(entry.entity_kind)} · {time(entry.created_at)}</p></div><Pill>{entry.entity_kind}</Pill></div>{Object.keys(entry.metadata).length?<p className="mt-2 break-all font-mono text-[10px] leading-4 text-[var(--od-muted)]">{JSON.stringify(entry.metadata)}</p>:null}</div>)}</div>
      </section>
    </div>:null}
  </div>;
}
