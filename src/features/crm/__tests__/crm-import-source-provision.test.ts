import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  simpleNameMobileMapping,
  applyMappingToRawRecords,
  parseCsvRecordsForMapping,
} from "../server/lead-import-file-parser.ts";
import { resolveMappedImportSources } from "../server/lead-import-source-resolver.ts";

const sources = [
  { id: "11111111-1111-4111-8111-111111111111", code: "google_ads", displayName: "Google Ads" },
  { id: "22222222-2222-4222-8222-222222222222", code: "instagram_ads", displayName: "Instagram Ads" },
];

test("optional Excel Source column auto-maps while original two-column template remains supported", () => {
  assert.deepEqual(simpleNameMobileMapping(["Name","Mobile Number","Source"]),{
    Name:"submitted_name", "Mobile Number":"phone", Source:"primary_source_id"
  });
  assert.deepEqual(simpleNameMobileMapping(["Name","Mobile Number","Source (optional)"]), {
    Name:"submitted_name", "Mobile Number":"phone", "Source (optional)":"primary_source_id"
  });
  assert.deepEqual(simpleNameMobileMapping(["Name","Mobile Number"]), {
    Name:"submitted_name", "Mobile Number":"phone"
  });
  assert.equal(simpleNameMobileMapping(["Name","Mobile Number","Unknown"]),null);
});

test("source names/codes matched per row, blank Source uses current default", () => {
  const bytes=Buffer.from("Name,Mobile Number,Source\nPerson A,9876543210,Google Ads\nPerson B,9876543211,instagram_ads\nPerson C,9876543212,\n");
  const parsed=parseCsvRecordsForMapping(bytes);
  const mapping=simpleNameMobileMapping(parsed.headers);
  assert.ok(mapping);
  const mapped=applyMappingToRawRecords(parsed.headers,parsed.records,mapping);
  const resolved=resolveMappedImportSources(mapped,sources,sources[0].id);
  assert.deepEqual(resolved.map(row=>row.primarySourceId),[
    sources[0].id,sources[1].id,sources[0].id
  ]);
  assert.deepEqual(resolved.map(row=>row.phone),[
    "+919876543210","+919876543211","+919876543212"
  ]);
});

test("every Excel row may specify a source with no default fallback", () => {
  const row=applyMappingToRawRecords(["Name","Mobile Number","Source"],
    [{Name:"Tester","Mobile Number":"9876543210",Source:"Google Ads"}],
    {Name:"submitted_name","Mobile Number":"phone",Source:"primary_source_id"});
  assert.equal(resolveMappedImportSources(row,sources,null)[0].primarySourceId,sources[0].id);
  assert.throws(()=>resolveMappedImportSources([{...row[0],primarySourceId:null}],sources,null),/choose an active default source/);
});

test("unknown source refuses to create or misattribute imported leads", () => {
  const rows=applyMappingToRawRecords(
    ["Name","Mobile Number","Source"],
    [{Name:"Person A","Mobile Number":"9876543210",Source:"Unknown Expo"}],
    {Name:"submitted_name","Mobile Number":"phone",Source:"primary_source_id"}
  );
  assert.throws(()=>resolveMappedImportSources(rows,sources,sources[0].id),/Excel row 2: Source 'Unknown Expo' is not active/);
});

test("ambiguous display source names are rejected and source code is unambiguous", () => {
  const list=[...sources,{id:"33333333-3333-4333-8333-333333333333",code:"google_ads_special",displayName:"Google Ads"}];
  const row=applyMappingToRawRecords(["Name","Mobile Number","Source"],
    [{Name:"Test","Mobile Number":"9876543210",Source:"Google Ads"}],
    {Name:"submitted_name","Mobile Number":"phone",Source:"primary_source_id"});
  assert.throws(()=>resolveMappedImportSources(row,list,sources[0].id),/ambiguous/);
  assert.equal(resolveMappedImportSources([{...row[0],primarySourceId:"google_ads"}],list,sources[0].id)[0].primarySourceId,sources[0].id);
});

test("source creation is explicit and authenticated, never triggered automatically by importing", () => {
  const root=process.cwd();
  const actions=readFileSync(join(root,"src/features/crm/server/crm-import-actions.ts"),"utf8");
  const upload=readFileSync(join(root,"src/app/api/mobile/crm/admin/imports/upload/route.ts"),"utf8");
  const template=readFileSync(join(root,"src/app/admin/crm/imports/template/route.ts"),"utf8");
  const listPage=readFileSync(join(root,"src/app/admin/crm/imports/page.tsx"),"utf8");
  assert.match(actions,/context\.canManageLeadSources/);
  assert.match(actions,/db\.rpc\("create_lead_source"/);
  assert.match(upload,/resolveMappedImportSources/);
  assert.doesNotMatch(upload,/create_lead_source/);
  assert.match(template,/await requireCrmBulkImportAccess/);
  assert.match(template,/fetchActiveLeadSources/);
  assert.match(template,/ExcelJS/);
  assert.match(template,/OneDecoreSources/);
  assert.match(listPage,/Download Excel/);
  assert.match(listPage,/Bulk upload/);
});
