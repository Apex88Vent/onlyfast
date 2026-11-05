// In-memory public-client/RLS model for testing the operator guards, not a live Auth substitute.
import { QAAuthentication } from '../qa/automation/auth.mjs';
import { qaConfig } from '../qa/automation/config.mjs';
export const qaUser='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export function qaHarness(mode='local') {
  const env={ONLYFAST_QA_URL:mode==='production'?'https://thpyjvwtfvfxiufchrxn.supabase.co':'http://127.0.0.1:54321',
    ONLYFAST_QA_PUBLIC_KEY:'sb_publishable_synthetic_fixture',ONLYFAST_QA_USER_ID:mode==='production'?'4b9864ff-2195-4be0-83a4-39308446577e':qaUser,
    ONLYFAST_QA_PASSWORD:'fixture-password',ONLYFAST_QA_PRODUCTION_READS_APPROVED:'true'};
  const config=qaConfig(env,mode);
  const state={user:{id:config.userId,email:'test@test.com'},expires:Date.now()/1000+3600,signedIn:false,refreshes:0,logouts:[],writes:[],tables:new Map(),authReads:0,
    loseInsertResponse:false,refreshFails:false,failRead:null,tier:'team',library:true};
  state.tables.set('beta_tester_accounts',[{user_id:config.userId,is_test_account:true,beta_features_enabled:true,tester_kind:'experimental'}]);
  state.tables.set('user_feature_flags',[{user_id:config.userId,feature_key:'test_account_reset',enabled:true}]);
  const client = (observer=false) => ({
    auth:{
      signInWithPassword:async({password})=>{if(password==='incorrect')return {data:{},error:{message:'sensitive credential detail'}};state.signedIn=true;return {data:{session:{user:state.user}},error:null};},
      getSession:async()=>({data:{session:state.signedIn?{user:state.user,expires_at:state.expires}:null},error:null}),
      getUser:async()=>{state.authReads++;return {data:{user:state.signedIn?state.user:null},error:state.signedIn?null:{status:401}};},
      refreshSession:async()=>{state.refreshes++;if(state.refreshFails)return {data:{},error:{message:'refresh secret'}};state.signedIn=true;state.expires=Date.now()/1000+3600;return {data:{session:{user:state.user}},error:null};},
      signOut:async options=>{state.logouts.push(options);state.signedIn=false;return {error:null};},stopAutoRefresh(){},
    },
    from(table) {
      let action='read',payload,cap=Infinity;const filters=[];
      const query={
        select(){return this;},eq(column,value){filters.push([column,value]);return this;},limit(n){cap=n;return this;},
        insert(row){action='insert';payload=row;return this;},update(row){action='update';payload=row;return this;},delete(){action='delete';return this;},
        async execute(single=false) {
          if(state.failRead===table)return {data:null,error:{message:'private remote detail'}};
          const rows=state.tables.get(table)||[];const owner=table==='shared_setups'?'shared_by':'user_id';
          let selected=rows.filter(row=>filters.every(([k,v])=>row[k]===v)&&(observer||row[owner]===state.user.id)).slice(0,cap);
          if(action==='insert') {
            if(rows.some(row=>row.id===payload.id))return {data:null,error:{code:'23505'}};
            if(payload[owner]!==state.user.id)return {data:null,error:{code:'42501'}};
            const row=structuredClone(payload);rows.push(row);state.tables.set(table,rows);selected=[row];state.writes.push({table,action,id:row.id,filters});
            if(state.loseInsertResponse){state.loseInsertResponse=false;return {data:null,error:{message:'response lost'}};}
          }
          if(action==='update')for(const row of selected){Object.assign(row,structuredClone(payload));state.writes.push({table,action,id:row.id,filters});}
          if(action==='delete')for(const row of selected){rows.splice(rows.indexOf(row),1);state.writes.push({table,action,id:row.id,filters});}
          return {data:single?(structuredClone(selected[0])??null):structuredClone(selected),error:null};
        },
        maybeSingle(){return this.execute(true);},single(){return this.execute(true);},then(a,b){return this.execute().then(a,b);},
      };return query;
    },
    rpc:async name=>({data:name==='get_onlyfast_membership'?{tier:state.tier}:name==='onlyfast_can_use_setup_library'?state.library:null,error:null}),
    functions:{invoke:async(name,options)=>state.edgeInvoke?state.edgeInvoke(name,options):({data:null,error:{message:'not configured'}})},
  });
  const factory=(_url,key)=>client(key==='service-fixture');
  return {env,config,state,factory,auth:new QAAuthentication(config,factory)};
}
