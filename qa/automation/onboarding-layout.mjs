// Run after npm run dev. Local-only review of the real tutorial and app.
// No production services, accounts, purchases, or deployment are used.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.ONLYFAST_PLAYWRIGHT_MODULE
  ? pathToFileURL(path.resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href : 'playwright');
const output = path.resolve('tmp/onboarding-mobile');
await mkdir(output, { recursive: true });
const origin = process.env.ONLYFAST_LAYOUT_URL || 'http://127.0.0.1:8080';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname), 'Local review only');
const entry = '/tmp/onboarding-mobile/entry.tsx';
await writeFile(path.join(output,'entry.tsx'), `import React from 'react';
  import { createRoot } from 'react-dom/client';
  import HowOnlyFastWorks from '/src/components/HowOnlyFastWorks.tsx';
  import '/src/index.css';
  const done = () => document.getElementById('root').textContent = 'Tutorial complete';
  createRoot(document.getElementById('root')).render(React.createElement(HowOnlyFastWorks,
    { onComplete: done, onSkip: done, onLogin: () => {}, isReplay: location.search.includes('replay') }));`);
await writeFile(path.join(output,'layout.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>OnlyFast local onboarding review</title></head><body><div id="root"></div>
<script type="module" src="${entry}"></script></body></html>`);
const reviewURL = origin + '/tmp/onboarding-mobile/layout.html';
console.log('Local review: ' + reviewURL);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const extraChecks = [];
const baseline = process.argv.includes('--baseline');
try {
  const sizes = process.argv.includes('--extras') ? [] : [[320,568],[375,667],[390,844],[393,852],[430,932],
    [568,320],[667,375],[844,390],[852,393],[932,430],
    [768,1024],[1024,768],[820,1180],[1180,820],[1440,900],[1920,1080]];
  for (const [width,height] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return [origin, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin)
        ? route.continue() : route.abort();
    });
    await page.goto(reviewURL, {waitUntil:'domcontentloaded',timeout:15000});
    await page.getByRole('heading', {name:'Welcome to OnlyFast',exact:true}).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const record = { width,height,slides:[] };
    results.push(record);
    for (let i=1;i<=12;i++) {
      await page.getByLabel(`Slide ${i} of 12`, {exact:true}).waitFor();
      await page.mouse.move(0,0);
      await page.waitForTimeout(80);
      const metrics = await page.locator('.onlyfast-onboarding-card').evaluate(card => {
        const box = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
        const content=card.querySelector('.onlyfast-slide-content');
        const description=card.querySelector('.onlyfast-slide-description');
        return { title:card.querySelector('h1').textContent,card:box(card),
          titleBox:box(card.querySelector('h1')), visual:box(card.querySelector('.onlyfast-slide-visual')),
          artFrame:box(card.querySelector('.onlyfast-artwork-area')),art:box(card.querySelector('.onlyfast-artwork')),
          description:box(description),primary:box(card.querySelector('.onlyfast-pulse')),
          pageOverflowX:document.documentElement.scrollWidth-innerWidth,
          pageOverflowY:document.documentElement.scrollHeight-innerHeight,
          contentOverflowY:content.scrollHeight-content.clientHeight,
          descriptionOverflowY:description.scrollHeight-description.clientHeight,
          textSize:getComputedStyle(description).fontSize,
          controls:[...card.querySelectorAll('button:not(:disabled)')].filter(b=>!b.classList.contains('onlyfast-dot')).map(box) };
      });
      record.slides.push(metrics);
      if (!baseline) {
        assert(metrics.pageOverflowX<=1, `${width}x${height} slide ${i}: horizontal page overflow`);
        assert(metrics.contentOverflowY<=1 && metrics.descriptionOverflowY<=1,
          `${width}x${height} slide ${i}: nested vertical scrolling`);
        assert(metrics.titleBox.y+metrics.titleBox.h<=metrics.visual.y+1, 'heading overlaps image');
        assert(metrics.art.w<=metrics.artFrame.w+1 && metrics.art.h<=metrics.artFrame.h+1, 'artwork must fit uniformly');
        if(height>=568) {
          assert(metrics.pageOverflowY<=1, `${width}x${height} slide ${i}: vertical page overflow ${metrics.pageOverflowY}`);
          for (const control of metrics.controls) assert(control.y>=0 && control.y+control.h<=height+1, 'controls outside viewport');
        }
      }
      if (!baseline && height<568) {
        await page.locator('.onlyfast-pulse').scrollIntoViewIfNeeded();
        const control=await page.locator('.onlyfast-pulse').boundingBox();
        assert(control.y>=0 && control.y+control.height<=height+1,'landscape navigation must remain reachable');
      }
      if ([320,390,430].includes(width)) await page.screenshot({path:path.join(output,`${baseline?'before':'after'}-${width}-slide-${i}.png`),fullPage:true});
      if(i<12) await page.getByRole('button', {name:i===1?/Let.s Get Faster/:'Continue',exact:true}).click();
    }
    assert.deepEqual(errors,[]);
    if (!baseline) {
      for (let i=11;i>=1;i--) {
        await page.getByRole('button', {name:new RegExp(`^Go to slide ${i}:`)}).click();
        await page.getByLabel(`Slide ${i} of 12`, {exact:true}).waitFor();
      }
      // Skip remains unlocked when going back, and retains its original callback.
      await page.getByRole('button', {name:'Skip onboarding',exact:true}).click();
      await page.getByText('Tutorial complete', {exact:true}).waitFor();
      record.backwardTransitions = 11;
    }
    await context.close();
    console.log(`${width}x${height}: 12 slides ${baseline?'measured':'passed'}`);
  }
  if (!baseline) {
    const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(reviewURL);
    await page.getByRole('heading',{name:'Welcome to OnlyFast',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const safeArea = await page.addStyleTag({content:'.onlyfast-onboarding { --onboarding-top:47px !important; --onboarding-bottom:34px !important; }'});
    const settle = () => page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await settle();
    for(let i=1;i<=12;i++) {
      const card=await page.locator('.onlyfast-onboarding-card').boundingBox();
      assert(card.y>=47 && card.y+card.height<=810+1,'simulated safe areas');
      if(i<12) await page.locator('.onlyfast-pulse').click();
    }
    await safeArea.evaluate(el=>el.remove());
    extraChecks.push('All 12 slides respect simulated 47px top / 34px bottom safe areas at 390x844');
    await page.reload();
    for(let i=1;i<=12;i++) {
      for(const height of [650,744,844]) {
        await page.setViewportSize({width:390,height});
        await settle();
        const primary=await page.locator('.onlyfast-pulse').boundingBox();
        assert(primary.y>=0 && primary.y+primary.height<=height+1,`slide ${i}, height ${height}: dynamic resize keeps navigation visible ${JSON.stringify(primary)}`);
        assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
      }
      if(i<12) await page.locator('.onlyfast-pulse').click();
    }
    extraChecks.push('All 12 slides fit after live viewport resizes 390x650 → 744 → 844');
    await page.reload();
    await page.addStyleTag({content:'html { font-size:200% !important }'});
    await page.setViewportSize({width:320,height:568});
    await settle();
    for(let i=1;i<=12;i++) {
      await page.getByLabel(`Slide ${i} of 12`,{exact:true}).waitFor();
      const reachable = await page.locator('.onlyfast-onboarding-card').evaluate(card=>{
        const title=card.querySelector('h1').getBoundingClientRect();
        const visual=card.querySelector('.onlyfast-slide-visual').getBoundingClientRect();
        const text=card.querySelector('.onlyfast-slide-description');
        return document.documentElement.scrollWidth<=innerWidth+1 && card.getBoundingClientRect().top+scrollY>=0
          && title.bottom<=visual.top+1 && text.scrollHeight<=text.clientHeight+1;
      });
      assert(reachable,'large text remains readable without horizontal overflow or nested scrolling');
      await page.locator('.onlyfast-pulse').scrollIntoViewIfNeeded();
      const primary=await page.locator('.onlyfast-pulse').boundingBox();
      assert(primary.y>=0 && primary.y+primary.height<=568+1,'large text navigation reachable');
      if(i===1) await page.screenshot({path:path.join(output,'accessibility-200-percent.png'),fullPage:true});
      if(i<12) await page.locator('.onlyfast-pulse').click();
    }
    extraChecks.push('All 12 slides remain scrollable and navigation reachable with 200% root text at 320x568');
    await context.close();
    // Exercise the actual application entry and selection handlers with intercepted
    // local fixtures. These responses never reach an account or a payment service.
    for (const exit of ['finish','skip']) {
      const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      const user={id:'00000000-0000-4000-8000-000000000088',aud:'authenticated',role:'authenticated',
        email:'onboarding-preview@example.invalid',app_metadata:{},user_metadata:{onboarding_completed:false}};
      const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.local-fixture`;
      const session={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'local-only',user};
      const state={active_class:null,tier:'rookie',can_change:true,unlimited:false,active_discipline:null,
        onboarding_step:'tutorial',onboarding_discipline:null,onboarding_race_class:null};
      const mutations=[];
      await context.route('**/*', async route=>{
        const url=new URL(route.request().url());
        if(url.origin===origin) return route.continue();
        if(!url.hostname.endsWith('.supabase.co')) return route.abort();
        const request=route.request();
        let data=[];
        if(url.pathname.includes('/auth/v1/user')) data=user;
        else if(url.pathname.includes('/auth/v1/token')) data=session;
        else if(url.pathname.includes('/rpc/')) {
          const rpc=url.pathname.split('/').pop();
          if(rpc==='save_racing_onboarding_progress') {
            const args=request.postDataJSON();
            mutations.push({rpc,...args});
            Object.assign(state,{onboarding_step:args.p_step,onboarding_discipline:args.p_discipline,onboarding_race_class:args.p_class});
          } else if(rpc==='complete_racing_onboarding') {
            mutations.push({rpc});
            Object.assign(state,{active_class:state.onboarding_race_class,active_discipline:state.onboarding_discipline,onboarding_step:'complete'});
          }
          data=['get_active_race_class_state','save_racing_onboarding_progress','complete_racing_onboarding'].includes(rpc)?state:[];
        } else if(request.headers().accept?.includes('vnd.pgrst.object')) data=null;
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      });
      await context.addInitScript(session=>{
        localStorage.setItem('onlyfast_cookie_consent','declined');
        localStorage.setItem('sb-thpyjvwtfvfxiufchrxn-auth-token',JSON.stringify(session));
      },session);
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/app');
      await page.getByRole('heading',{name:'Welcome to OnlyFast',exact:true}).waitFor();
      const last=exit==='finish'?12:6;
      for(let i=1;i<last;i++) await page.locator('.onlyfast-pulse').click();
      if(exit==='skip') await page.getByRole('button',{name:'Skip onboarding',exact:true}).click();
      else await page.getByRole('button',{name:'Select My Discipline',exact:true}).click();
      await page.getByRole('heading',{name:'Select Your Discipline',exact:true}).waitFor();
      assert.equal(state.onboarding_step,'discipline');
      assert.equal(state.active_class,null);
      await page.getByRole('button',{name:/^Dirt Track Oval -/}).click();
      await page.getByRole('heading',{name:'Select Your Car',exact:true}).waitFor();
      await page.getByRole('button',{name:'Go back to discipline selection',exact:true}).click();
      await page.getByRole('button',{name:/^Dirt Track Oval -/}).click();
      await page.getByRole('button',{name:/^Dwarf Cars -/}).click();
      await page.getByRole('heading',{name:'Choose Your OnlyFast Plan',exact:true}).waitFor();
      assert.equal(state.active_class,null);
      await page.getByRole('button',{name:'Go back',exact:true}).click();
      await page.getByRole('button',{name:/^Dwarf Cars -/}).click();
      await page.getByRole('button',{name:'Continue Free',exact:true}).click();
      await page.getByRole('button',{name:'Continue Saved Setup',exact:true}).waitFor();
      assert.equal(state.active_class,'Dwarf Cars');
      assert.equal(mutations.filter(m=>m.rpc==='complete_racing_onboarding').length,1);
      assert.deepEqual(errors,[]);
      await context.close();
      extraChecks.push(`Actual /app browser ${exit} → discipline → car → plan → Rookie landing; Back works; no required selection bypassed`);
    }
  }
} finally {
  if(results.length) await writeFile(path.join(output,baseline?'baseline.json':'results.json'),JSON.stringify(results,null,2));
  if(!baseline) {
    await writeFile(path.join(output,'extra-checks.json'),JSON.stringify(extraChecks,null,2));
    extraChecks.forEach(check=>console.log('PASS '+check));
  }
  await browser.close();
}
