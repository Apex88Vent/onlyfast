// Copies vendor source to a NEW directory. Never edits the downloaded test project.
import assert from 'node:assert/strict';
import { access,cp,mkdir,readFile,writeFile,realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2);
const value=flag=>args[args.indexOf(flag)+1];
assert.ok(args.includes('--source')&&args.includes('--output'),'Provide --source AND --output explicitly.');
const source=await realpath(path.resolve(value('--source')));
const requestedOutput=path.resolve(value('--output'));
const output=path.join(await realpath(path.dirname(requestedOutput)),path.basename(requestedOutput));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(source!==output&&!output.toLowerCase().startsWith(source.toLowerCase()+path.sep)&&!source.toLowerCase().startsWith(output.toLowerCase()+path.sep),'Source and output must be separate directories.');
try{await access(output);throw Error('Refusing to overwrite an existing output directory.')}catch(error){if(error.code!=='ENOENT')throw error}
const activityPath='app/src/main/java/co/median/android/MainActivity.java';
const original=await readFile(path.join(source,activityPath),'utf8');
const hook='        setupWebviewTheme(appTheme);';
assert.equal(original.split(hook).length,2,'Median source changed: review the pre-load WebView hook manually.');
const gradle=await readFile(path.join(source,'app/build.gradle'),'utf8');
assert.match(gradle,/applicationId "app\.onlyfast"/);
const config=JSON.parse(await readFile(path.join(source,'app/src/main/assets/appConfig.json'),'utf8'));
assert.equal(config.general.androidPackageName,'app.onlyfast');
assert.ok(['https://onlyfast.app','https://www.onlyfast.app'].includes(new URL(config.general.initialUrl).origin),'Release startup URL must be the approved production origin.');
assert.equal(config.services.revenueCat.active,true,'Preserve the existing licensed Median RevenueCat plugin.');
await mkdir(output);
await cp(source,output,{recursive:true,dereference:true,filter:entry=>{
 const parts=path.relative(source,entry).split(path.sep);
 return !parts.some(part=>['.gradle','.gradle-user-home','.git','.idea','build','diagnostics'].includes(part))&&
   !parts.join('/').match(/(^|\/)src\/debug(\/|$)/)&&
   !/\.env(?:\.|$)|\.keystore$|\.jks$|\.p8$|\.p12$|local\.properties$/.test(path.basename(entry));
}});
await cp(path.join(root,'native/android/src/main/java'),path.join(output,'app/src/main/java'),{recursive:true});
const addition='        // OnlyFast named-offering release extension; before restoreState/loadUrl.\n'+
 '        if (!appConfig.geckoViewEnabled) {\n'+
 '            app.onlyfast.billing.OnlyFastBilling.attach(this, (android.webkit.WebView) this.mWebview);\n'+
 '        }\n\n';
await writeFile(path.join(output,activityPath),original.replace(hook,addition+hook));
await writeFile(path.join(output,'app/build.gradle'),gradle+"\n// Same SDK already shipped by Median RevenueCat plugin 1.3.0.\ndependencies { implementation('com.revenuecat.purchases:purchases:10.3.0') { version { strictly '10.3.0' } } }\n");
await writeFile(path.join(output,'ONLYFAST_RELEASE_PREPARATION.json'),JSON.stringify({source,extensionProtocol:1,offering:'onlyfast_monthly_v1',sourceSet:'main',transactionsEnabled:false,debugSourceExcluded:true,signingUnchanged:true,signingKeysNotCopied:true},null,2));
console.log(JSON.stringify({output,sourceUntouched:true,extensionProtocol:1,transactionsEnabled:false,debugSourceExcluded:true}));
