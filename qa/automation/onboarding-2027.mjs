// Local-only browser QA. Run against a dev server or a development build.
// All account responses are intercepted fixtures; nothing reaches a backend.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.ONLYFAST_PLAYWRIGHT_MODULE
  ? pathToFileURL(path.resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href : 'playwright');
const origin = process.env.ONLYFAST_LAYOUT_URL || 'http://127.0.0.1:8081';
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Local review only');
const testing2027 = process.argv.includes('--testing-2027');
const out = path.resolve(process.env.ONLYFAST_ONBOARDING_OUTPUT || 'tmp/onboarding-2027');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
const report = { layouts: [], checks: [], flows: [] };
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const next = page => page.locator('.of-intro-next').click();
async function localContext(options = {}) {
  const context = await browser.newContext(options);
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  return context;
}
try {
  if (!testing2027 && !process.argv.includes('--flows-only')) {
    const sizes = [[320,568],[360,640],[375,667],[390,844],[393,852],[412,915],[430,932],
      [768,1024],[820,1180],[1024,768],[1440,900],[1920,1080],[568,320],[844,390]];
    for (const [width, height] of sizes) {
      const context = await localContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/onboarding-showcase', { waitUntil: 'domcontentloaded' });
      await page.locator('.of-intro').waitFor();
      const slides = [];
      for (let slide = 1; slide <= 8; slide++) {
        await page.getByLabel(`Slide ${slide} of 8`, { exact: true }).waitFor();
        await page.mouse.move(0, 0);
        await settle(page);
        const metrics = await page.locator('.of-intro').evaluate(main => {
          const box = element => element.getBoundingClientRect().toJSON();
          const visual = [...main.querySelectorAll('.of-intro-demo svg')].find(el => getComputedStyle(el).display !== 'none');
          return { title: main.querySelector('h1').textContent, titleBox: box(main.querySelector('h1')),
            copy: box(main.querySelector('.of-intro-copy')), visual: box(visual),
            footer: box(main.querySelector('footer')), controls: [...main.querySelectorAll('nav button:not(:disabled)')].map(box),
            overflowX: document.documentElement.scrollWidth - innerWidth,
            overflowY: document.documentElement.scrollHeight - innerHeight,
            nestedOverflow: main.scrollHeight - main.clientHeight,
            palette: { page: getComputedStyle(main).backgroundColor, heading: getComputedStyle(main.querySelector('h1')).color,
              button: getComputedStyle(main.querySelector('.of-intro-next')).backgroundColor,
              panel: getComputedStyle(visual.querySelector('.of-v-panel')).fill,
              panelBorder: getComputedStyle(visual.querySelector('.of-v-panel')).stroke },
            activeAnimations: document.getAnimations().filter(a => a.playState === 'running').length };
        });
        slides.push(metrics);
        assert(metrics.overflowX <= 1 && metrics.overflowY <= 1, `${width}x${height} slide ${slide}: page overflow ${JSON.stringify(metrics)}`);
        assert(metrics.nestedOverflow <= 1, `${width}x${height} slide ${slide}: internal scrolling`);
        assert(metrics.visual.height >= 65, 'visual must remain visible');
        assert(metrics.visual.bottom <= metrics.footer.top + 1, 'visual overlaps navigation');
        if (width <= 760 && height > 480) assert(metrics.copy.bottom <= metrics.visual.top + 1, 'copy overlaps visual');
        for (const control of metrics.controls) assert(control.y >= 0 && control.bottom <= height + 1 && control.right <= width + 1, 'navigation outside viewport');
        assert.equal(metrics.activeAnimations, 0, 'reduced motion must disable animations');
        assert.deepEqual(metrics.palette, {page:'rgb(236, 238, 240)',heading:'rgb(26, 27, 35)',button:'rgb(0, 168, 232)',panel:'rgb(255, 255, 255)',panelBorder:'rgb(229, 231, 235)'}, 'slides must use the actual light app palette');
        assert.equal(await page.getByRole('button', { name: 'Skip Intro', exact: true }).count(), slide >= 5 ? 1 : 0);
        if ([320,390,430,768,1440].includes(width)) await page.screenshot({ path: path.join(out, `${width}-slide-${slide}.png`) });
        if (slide < 8) await next(page);
      }
      for (let slide = 7; slide >= 1; slide--) {
        await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
        await page.getByLabel(`Slide ${slide} of 8`, { exact: true }).waitFor();
      }
      assert.deepEqual(errors, []);
      report.layouts.push({ width, height, slides });
      await context.close();
      console.log(`${width}x${height}: all 8 slides fit; reduced motion; Back passed`);
    }

    const context = await localContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(origin + '/onboarding-showcase');
    await page.locator('.of-intro').waitFor();
    await page.addStyleTag({ content: '.of-intro { --of-top:47px !important; --of-bottom:34px !important; }' });
    for (let slide = 1; slide <= 8; slide++) {
      for (const height of [640,744,844]) {
        await page.setViewportSize({ width: 390, height }); await settle(page);
        assert(await page.locator('.of-intro-header').evaluate(el => el.getBoundingClientRect().top >= 47));
        assert(await page.locator('.of-intro-next').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight - 34 + 1));
        assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
      }
      if (slide < 8) await next(page);
    }
    report.checks.push('All slides respect simulated 47px top / 34px bottom safe areas and live height changes 640/744/844');
    await context.close();

    // Actual running animation, pause, unmount and restart checks.
    const motionContext = await localContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    const motion = await motionContext.newPage();
    await motion.goto(origin + '/onboarding-showcase');
    await motion.locator('.of-v-mobile .of-v-car').waitFor();
    const position = () => motion.locator('.of-v-mobile .of-v-car').evaluate(el => getComputedStyle(el).offsetDistance);
    const start = await position(); await motion.waitForTimeout(300); assert.notEqual(await position(), start, 'car must actually move');
    await motion.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await motion.locator('.of-intro[data-paused=true]').waitFor();
    const paused = await position(); await motion.waitForTimeout(150); assert.equal(await position(), paused, 'background animation must pause');
    await motion.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await motion.locator('.of-intro[data-paused=false]').waitFor();
    await motion.evaluate(() => { window.previousScene = document.querySelector('.of-intro-slide'); });
    await next(motion);
    assert(await motion.evaluate(() => !window.previousScene.isConnected), 'inactive scene must unmount');
    await motion.getByRole('button', { name: 'Previous slide' }).click();
    assert(await motion.locator('.of-v-mobile .of-v-car').evaluate(el => el.getAnimations()[0].currentTime < 500), 'revisit restarts animation');
    for (let slide = 1; slide <= 8; slide++) {
      await motion.waitForTimeout(80);
      assert(await motion.locator('.of-intro-slide').evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'running')), `slide ${slide} needs real animation`);
      if (slide < 8) await next(motion);
    }
    report.checks.push('All scenes animate; car moves; document visibility pauses; inactive scenes unmount; revisits restart');
    await motionContext.close();

    // Self-contained review sheet, using the actual browser captures.
    for (const width of [390,1440]) {
      const captures = await Promise.all(Array.from({ length:8 }, (_, i) => readFile(path.join(out,`${width}-slide-${i + 1}.png`))));
      const html = `<!doctype html><html><meta charset="utf-8"><title>OnlyFast 2027 / ${width}px review</title><style>body{margin:0;padding:24px;background:#F5F5F7;color:#1A1B23;font-family:system-ui}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}figure{margin:0}img{width:100%;display:block;border:1px solid #E5E7EB;border-radius:12px}figcaption{padding:8px 0;color:#007DAE;font-size:12px}</style><h1>OnlyFast 2027 — ${width === 390 ? 'Phone' : 'Desktop'} / 8-slide introduction</h1><main>${captures.map((data, i) => `<figure><img alt="Slide ${i+1}" src="data:image/png;base64,${data.toString('base64')}"><figcaption>0${i+1} / 08</figcaption></figure>`).join('')}</main></html>`;
      await writeFile(path.join(out, `${width}-all-slides.html`), html);
      const gallery = await browser.newPage({ viewport: { width: width === 390 ? 1240 : 1600, height: 100 } });
      await gallery.setContent(html);
      await gallery.screenshot({ path:path.join(out,`${width}-all-slides.png`),fullPage:true });
      await gallery.close();
    }
  }

  // Exercise real /app handlers and real selectors with local account fixtures.
  for (const exit of ['skip5','skip6','skip7','skip8','finish','returning']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const user = { id:'00000000-0000-4000-8000-000000000088',aud:'authenticated',role:'authenticated',email:'onboarding@example.invalid',app_metadata:{},user_metadata:{onboarding_completed:exit==='returning'} };
    const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.local-fixture`;
    const session = {access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'local-only',user};
    const state = {active_class:exit==='returning'?'Dwarf Cars':null,tier:testing2027?'sportsman':'rookie',can_change:true,unlimited:false,active_discipline:null,onboarding_step:exit==='returning'?'complete':'tutorial',onboarding_discipline:null,onboarding_race_class:null};
    const mutations = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url()), request = route.request();
      if (url.origin === origin) return route.continue();
      if (!url.hostname.endsWith('.supabase.co')) return route.abort();
      let data = [];
      if (url.pathname.includes('/auth/v1/user')) data = user;
      else if (url.pathname.includes('/auth/v1/token')) data = session;
      else if (url.pathname.includes('/rpc/')) {
        const rpc = url.pathname.split('/').pop();
        if (rpc === 'get_onlyfast_2027_environment') data = {project_ref:'mfzajhnfonrfuiwxgvhe',schema_version:'phase1b-v1'};
        else if (rpc === 'get_onlyfast_test_tier') data = testing2027 ? 'sportsman' : null;
        else if (rpc === 'get_onlyfast_membership') data = {tier:'sportsman'};
        else if (rpc === 'get_onlyfast_2027_billing_status') data = {version:1,user_id:user.id,server_now:new Date().toISOString(),tier:'sportsman',valid_until:null,provider:null,store:null,interval:null,status:'active',expires_at:null,trial_ends_at:null,will_renew:null,promo_claimed_at:null,promo_expires_at:null,claim_window_start:'2027-01-01T00:00:00Z',claim_window_end:'2027-02-01T00:00:00Z',claim_eligible:false,grandfathered:false,protection_status:null,protection_ends_at:null};
        else {
          if (rpc === 'save_racing_onboarding_progress') {
            const args = request.postDataJSON(); mutations.push({rpc,...args});
            Object.assign(state,{onboarding_step:args.p_step,onboarding_discipline:args.p_discipline,onboarding_race_class:args.p_class});
          } else if (rpc === 'complete_racing_onboarding') {
            mutations.push({rpc}); Object.assign(state,{active_class:state.onboarding_race_class,active_discipline:state.onboarding_discipline,onboarding_step:'complete'});
          }
          data = ['get_active_race_class_state','save_racing_onboarding_progress','complete_racing_onboarding'].includes(rpc)?state:[];
        }
      } else if (request.headers().accept?.includes('vnd.pgrst.object')) data = null;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await context.addInitScript(({session,testing2027}) => {
      localStorage.setItem('onlyfast_cookie_consent','declined');
      localStorage.setItem(testing2027?'onlyfast_analytics_consent_preview_v1':'onlyfast_analytics_consent_v1','denied');
      localStorage.setItem(testing2027?'onlyfast-2027-mfzajhnfonrfuiwxgvhe-auth':'sb-thpyjvwtfvfxiufchrxn-auth-token',JSON.stringify(session));
    },{session,testing2027});
    const page = await context.newPage(); const errors = []; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/app',{waitUntil:'domcontentloaded'});
    if (exit !== 'returning') {
      await page.locator('.of-intro').waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollHeight <= innerHeight + 1), 'intro must fit inside testing shell');
      const last = exit === 'finish' ? 8 : Number(exit.slice(-1));
      for (let slide = 1; slide < last; slide++) await next(page);
      if (exit === 'finish') await page.getByRole('button',{name:'LET’S GET FASTER',exact:true}).click();
      else await page.getByRole('button',{name:'Skip Intro',exact:true}).click();
      await page.getByRole('heading',{name:'Select Your Discipline',exact:true}).waitFor();
      assert.equal(state.onboarding_step,'discipline'); assert.equal(state.active_class,null);
      await page.getByRole('button',{name:/^Dirt Track Oval -/}).click();
      await page.getByRole('heading',{name:'Select Your Car',exact:true}).waitFor();
      await page.getByRole('button',{name:'Go back to discipline selection',exact:true}).click();
      await page.getByRole('button',{name:/^Dirt Track Oval -/}).click();
      await page.getByRole('button',{name:/^Dwarf Cars -/}).click();
      if (testing2027) {
        await page.getByRole('heading',{name:'Choose your 2027 plan',exact:true}).waitFor();
        await page.getByRole('button',{name:'Sportsman — Selected',exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:/Factory — Select test tier/}).count(),1);
        assert.equal(await page.getByRole('button',{name:'Continue Free',exact:true}).count(),0);
        assert.equal(state.active_class,null);
        await page.getByRole('button',{name:'Continue',exact:true}).click();
      } else {
        await page.getByRole('heading',{name:'Choose Your OnlyFast Plan',exact:true}).waitFor();
        assert.equal(state.active_class,null);
        await page.getByRole('button',{name:'Go back',exact:true}).click();
        await page.getByRole('button',{name:/^Dwarf Cars -/}).click();
        await page.getByRole('button',{name:'Continue Free',exact:true}).click();
      }
      assert.equal(mutations.filter(m=>m.rpc==='complete_racing_onboarding').length,1);
    }
    await page.getByRole('button',{name:'Continue Saved Setup',exact:true}).waitFor();
    assert.equal(state.active_class,'Dwarf Cars');
    if (exit === 'returning') assert.deepEqual(mutations,[],'completed user must bypass introduction and profile writes');
    await page.screenshot({path:path.join(out,`${testing2027?'2027':'legacy'}-${exit}-landing.png`)});
    if (exit === 'returning') {
      const appPalette = await page.locator('[data-home-action="new-setup"]').evaluate(card => ({
        card: getComputedStyle(card).backgroundColor, border: getComputedStyle(card).borderTopColor,
        radius: getComputedStyle(card).borderRadius, label: getComputedStyle(card.lastElementChild).color,
        accent: getComputedStyle(card.querySelector('svg')).color,
      }));
      assert.equal(appPalette.card, 'rgb(255, 255, 255)');
      assert.equal(appPalette.border, 'rgb(229, 231, 235)');
      assert.equal(appPalette.label, 'rgb(26, 27, 35)');
      assert.equal(appPalette.accent, 'rgb(0, 168, 232)');
      report.checks.push({ actualDashboardPalette: appPalette });
      if (!process.argv.includes('--flows-only')) {
        const files = [testing2027?'2027-returning-landing.png':'legacy-returning-landing.png','390-slide-2.png','390-slide-5.png'];
        const pictures = await Promise.all(files.map(file => readFile(path.join(out,file))));
        const comparison = `<!doctype html><html><meta charset="utf-8"><title>OnlyFast visual consistency review</title><style>body{margin:0;padding:24px;background:#F5F5F7;color:#1A1B23;font:14px system-ui}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}figure{margin:0}img{width:100%;display:block;border:1px solid #E5E7EB;border-radius:16px}figcaption{font-weight:600;margin-bottom:12px;color:#4B5563}</style><h1>Actual OnlyFast dashboard alongside the corrected onboarding</h1><p>Same official logo, white cards, gray borders, dark text and OnlyFast blue. Dashboard uses a local account fixture.</p><main>${pictures.map((data,i)=>`<figure><figcaption>${['Actual app dashboard','Setup Notebook slide','Track Trace slide'][i]}</figcaption><img src="data:image/png;base64,${data.toString('base64')}" alt="${files[i]}"></figure>`).join('')}</main></html>`;
        const comparisonName = testing2027 ? '2027-dashboard-comparison' : 'dashboard-comparison';
        await writeFile(path.join(out,comparisonName+'.html'),comparison);
        const review = await browser.newPage({viewport:{width:1240,height:100}});
        await review.setContent(comparison);
        await review.screenshot({path:path.join(out,comparisonName+'.png'),fullPage:true});
        await review.close();
      }
    }
    assert.deepEqual(errors,[]);
    report.flows.push(`${testing2027?'2027':'existing'} ${exit}: discipline → class → existing plan selection → dashboard; fixture requests only`);
    await context.close();
    console.log(report.flows.at(-1));
  }
} finally {
  await writeFile(path.join(out,testing2027?'testing-2027-results.json':process.argv.includes('--flows-only')?'flow-results.json':'results.json'),JSON.stringify(report,null,2));
  await browser.close();
}
