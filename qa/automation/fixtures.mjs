import { randomUUID } from 'node:crypto';
import { EXPANDED_CLASS_CONFIGS } from '../../src/lib/setupLibrary.ts';
import { buildLibraryCustomFields } from '../../src/lib/setupLibraryStorage.ts';
import { mergeTimingScanResults } from '../../src/lib/timingData.ts';
import { QA_CATALOG, QA_MARKER, QA_TABLE_OWNERS, QA_RESET_CONFIRMATION, QA_CLEANUP_CONFIRMATION, qaFixtureId, qaMarker,
  qaScheduleOrganization, assertQARecordOwnership, validateQARecords } from '../../supabase/functions/_shared/qa-fixtures.ts';
import { QAError } from './config.mjs';

export async function fixtureCatalog(config, date = new Date().toISOString().slice(0,10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new QAError('QA_FIXTURE_DATE_INVALID');
  const id = key => qaFixtureId(config.ref, config.userId, key);
  const day = offset => new Date(Date.parse(date+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
  const records = [];
  for (const [kind,offset] of [['past',-14],['current',0],['next',14]]) {
    const key='schedule:'+kind;
    records.push({ table:'race_schedule',id:await id(key),key,row:{id:await id(key),user_id:config.userId,
      race_date:day(offset),race_end_date:day(offset),race_class:'Dwarf Cars',track:'OnlyFast QA '+kind,
      organization:qaScheduleOrganization(key),finishing_position:kind==='past'?'3':null} });
  }
  for (const [kind,raceClass] of [['dirt','Dwarf Cars'],['pavement','Legends'],['road','GT3'],['shifter','Shifter Kart'],['clutch','Clutch Kart']]) {
    const extra = EXPANDED_CLASS_CONFIGS[raceClass];
    const fields = extra ? Object.fromEntries(extra.extraSections.flatMap(s=>s.fields).map(f=>[f.key,f.type==='number'?'1':'QA synthetic'])) : {};
    for (const session of ['base','hotlaps','heat','main']) {
      const key=`setup:${kind}:${session}`, fixtureId=await id(key);
      const custom = { [QA_MARKER]:{...qaMarker(key),persistent:true}, qa_note:'Synthetic, no real driver data' };
      const row={id:fixtureId,user_id:config.userId,race_class:raceClass,
        setup_name:session==='base'?`[BASE TEMPLATE] OnlyFast QA ${kind}`:`[OnlyFast QA] ${kind} weekend`,
        setup_type:session==='base'?'base_template':session==='hotlaps'?'base':session,
        session_label:session,track_name:`OnlyFast QA ${kind}`,race_date:date,
        notes:'OnlyFast synthetic fixture. Preserve during ordinary QA runs.',
        custom_fields:extra?buildLibraryCustomFields(raceClass,fields,custom):custom,
        ...(session!=='base'&&kind==='dirt'?{race_schedule_id:await id('schedule:current')}:{}),
      };
      if (session==='main') row.timing_data={...mergeTimingScanResults([{lap_times:[{lap_number:1,lap_time:12.4},{lap_number:2,lap_time:12.1}],finishing_position:3}],fixtureId),source:'OnlyFast QA synthetic',session_id:fixtureId};
      records.push({table:'race_setups',id:fixtureId,key,row});
    }
  }
  const key='share:valid';
  records.push({table:'shared_setups',id:await id(key),key,row:{id:await id(key),shared_by:config.userId,
    setup_id:await id('setup:dirt:hotlaps'),share_code:randomUUID().replaceAll('-','').slice(0,8),is_public:true}});
  return records;
}

export class QAFixtures {
  constructor(auth) { this.auth=auth; this.created=new Map(); this.runId=randomUUID(); }
  async find(record) {
    await this.auth.verify();
    const {data,error}=await this.auth.client.from(record.table).select('*')
      .eq('id',record.id).eq(QA_TABLE_OWNERS[record.table],this.auth.config.userId).maybeSingle();
    if(error)throw new QAError('QA_FIXTURE_READ_FAILED');
    if(data) {
      try { assertQARecordOwnership(data,record,this.auth.config.userId); } catch { throw new QAError('QA_FIXTURE_CONFLICT'); }
      if(record.table==='shared_setups') {
        const parent={table:'race_setups',key:'setup:dirt:hotlaps',id:await qaFixtureId(this.auth.config.ref,this.auth.config.userId,'setup:dirt:hotlaps')};
        if(data.setup_id!==parent.id || !await this.find(parent))throw new QAError('QA_FIXTURE_PARENT_REQUIRED');
      }
    }
    return data;
  }
  async seed(catalog) {
    await this.auth.beforeMutation();
    await validateQARecords(catalog,this.auth.config.ref,this.auth.config.userId);
    for(const r of catalog) {
      try { assertQARecordOwnership(r.row,r,this.auth.config.userId); } catch { throw new QAError('QA_FIXTURE_CONFLICT'); }
      if(r.table==='shared_setups' && r.row.setup_id!==await qaFixtureId(this.auth.config.ref,this.auth.config.userId,'setup:dirt:hotlaps'))throw new QAError('QA_FIXTURE_PARENT_REQUIRED');
    }
    const tier=await this.auth.client.rpc('get_onlyfast_membership');
    const library=await this.auth.client.rpc('onlyfast_can_use_setup_library');
    if(tier.error || !['team','admin'].includes(tier.data?.tier) || library.error || library.data!==true)throw new QAError('QA_CATALOG_EXISTING_ACCESS_REQUIRED');
    const inventory=await this.auth.client.from('race_setups').select('id,user_id,setup_name,custom_fields').eq('user_id',this.auth.config.userId).limit(1000);
    if(inventory.error)throw new QAError('QA_FIXTURE_READ_FAILED');
    const catalogIds=new Set(catalog.filter(r=>r.table==='race_setups').map(r=>r.id));
    if(inventory.data.some(row=>(row.custom_fields?.[QA_MARKER]?.catalog===QA_CATALOG || /^\[(BASE TEMPLATE|OnlyFast QA)\].*OnlyFast QA|^\[OnlyFast QA\]/.test(row.setup_name||''))&&!catalogIds.has(row.id)))throw new QAError('QA_EXISTING_FIXTURE_RECONCILIATION_REQUIRED');
    // Check all collisions before any insert. Existing records are never upserted.
    const existing = new Set();
    for(const r of catalog)if(await this.find(r))existing.add(r.id);
    let inserted=0;
    for(const r of catalog) {
      if(existing.has(r.id))continue;
      await this.auth.beforeMutation();
      const {data,error}=await this.auth.client.from(r.table).insert(r.row).select('*').single();
      if(error) {
        if(error.code==='23505' && await this.find(r))continue;
        throw new QAError('QA_FIXTURE_INSERT_FAILED');
      }
      try { assertQARecordOwnership(data,r,this.auth.config.userId); } catch { throw new QAError('QA_INSERT_OWNER_MISMATCH'); }
      inserted++;
    }
    return {inserted,preserved:existing.size,catalog:QA_CATALOG};
  }
  async createDisposable() {
    await this.auth.beforeMutation();
    // Refuse insertion when the separately deployed dependency auditor is absent.
    const ready=await this.auth.client.functions.invoke('reset-test-account',{body:{action:'verify_qa_cleanup'}});
    if(ready.error || ready.data?.protocol!==QA_CATALOG || ready.data?.cleanupReady!==true)throw new QAError('QA_SAFE_CLEANUP_NOT_CONFIGURED');
    const record={table:'race_setups',id:randomUUID(),key:'setup:dirt:hotlaps'};
    const row={id:record.id,user_id:this.auth.config.userId,race_class:'Dwarf Cars',setup_type:'base_template',
      setup_name:'[BASE TEMPLATE] OnlyFast QA disposable '+this.runId,
      custom_fields:{[QA_MARKER]:{...qaMarker(record.key),persistent:false,runId:this.runId}}};
    const receipt=Object.freeze(record);
    // Retain intent even if the database commits but its response is lost.
    // Cleanup still requires fresh Auth plus this run's exact row marker.
    this.created.set(record.id,receipt);
    const {data,error}=await this.auth.client.from(record.table).insert(row).select('*').single();
    if(error)throw new QAError('QA_DISPOSABLE_INSERT_FAILED');
    try { assertQARecordOwnership(data,record,this.auth.config.userId); } catch { throw new QAError('QA_INSERT_OWNER_MISMATCH'); }
    return receipt;
  }
  async updateDisposable(record, changes) {
    await this.auth.beforeMutation();
    if(this.created.get(record.id)!==record || Object.keys(changes).some(k=>!['setup_name','notes','lf_pressure'].includes(k))) throw new QAError('QA_RUN_ALLOWLIST_REQUIRED');
    const row=await this.find(record);
    if(!row || row.custom_fields?.[QA_MARKER]?.runId!==this.runId || row.custom_fields?.[QA_MARKER]?.persistent!==false)throw new QAError('QA_RUN_MARKER_REQUIRED');
    const {data,error}=await this.auth.client.from(record.table).update(changes).eq('id',record.id).eq('user_id',this.auth.config.userId).select('*').single();
    if(error || !data)throw new QAError('QA_DISPOSABLE_UPDATE_FAILED');
    try { assertQARecordOwnership(data,record,this.auth.config.userId); } catch { throw new QAError('QA_INSERT_OWNER_MISMATCH'); }
    return data;
  }
  async cleanup() {
    const failures=[];
    for(const record of [...this.created.values()].reverse()) {
      try {
        await this.auth.beforeMutation();
        const row=await this.find(record);
        if(!row) { this.created.delete(record.id); continue; }
        const marker=row.custom_fields?.[QA_MARKER];
        if(marker?.runId!==this.runId || marker.persistent!==false)throw new QAError('QA_RUN_MARKER_REQUIRED');
        const shares=await this.auth.client.from('shared_setups').select('id').eq('setup_id',record.id).limit(1);
        const links=await this.auth.client.from('onlyfast_onlylaps_session_links').select('id').eq('onlyfast_session_id',record.id).limit(1);
        if(shares.error || links.error || shares.data?.length || links.data?.length)throw new QAError('QA_CLEANUP_REFERENCED');
        const {data,error}=await this.auth.client.functions.invoke('reset-test-account',{body:{action:'cleanup_qa_run',confirmation:QA_CLEANUP_CONFIRMATION,runId:this.runId,records:[record]}});
        if(error || data?.ok!==true || data.deleted!==1)throw new QAError('QA_CLEANUP_DELETE_FAILED');
        this.created.delete(record.id);
      } catch { failures.push(record.id); }
    }
    if(failures.length)throw new QAError('QA_CLEANUP_INCOMPLETE');
    return {remaining:this.created.size};
  }
  async reset(catalog, confirmation) {
    await this.auth.beforeMutation();
    if(!this.auth.config.resetApproved || confirmation!==QA_RESET_CONFIRMATION)throw new QAError('QA_RESET_APPROVAL_REQUIRED');
    const records=[];
    for(const r of catalog)if(await this.find(r))records.push({table:r.table,id:r.id,key:r.key});
    if(!records.length)return {reset:0};
    const {data,error}=await this.auth.client.functions.invoke('reset-test-account',{body:{action:'reset_qa_fixtures',confirmation,records}});
    if(error || data?.ok!==true)throw new QAError('QA_EXPLICIT_RESET_FAILED');
    return {reset:data.deleted};
  }
}
