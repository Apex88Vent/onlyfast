// Optional emulator smoke test for the --qa export. Uses only Google's demo units.
import { createServer } from 'node:http';

const html = String.raw`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width">
<title>OnlyFast native ad QA</title><h1>OnlyFast native ad QA</h1>
<button id="privacy">Open UMP privacy options</button><button id="show">Try a ready interstitial</button>
<pre id="output"></pre><script>
let id = 0;
const pending = new Map();
const output = document.getElementById('output');
const report = (step, result) => {
  output.textContent += step + ': ' + result + '\n';
  void fetch('/result?' + new URLSearchParams({ step, result })).catch(() => {});
};
if (window.onlyfastAdmob) {
  window.onlyfastAdmob.onmessage = event => {
    const data = JSON.parse(event.data);
    pending.get(data.id)?.(data.value);
  };
  const send = (action, extra = {}) => new Promise(resolve => {
    const next = ++id;
    const timer = setTimeout(() => { pending.delete(next); resolve('timeout'); }, 30000);
    pending.set(next, value => { clearTimeout(timer); pending.delete(next); resolve(value); });
    window.onlyfastAdmob.postMessage(JSON.stringify({ id: next, action, url: location.href, ...extra }));
  });
  const show = async (step, permitted, issued = Date.now()) => {
    window.onlyfastAdOpportunity = token => permitted && token === '1';
    report(step, await send('showInterstitialIfReady', { token: '1', issued }));
    delete window.onlyfastAdOpportunity;
  };
  document.getElementById('show').onclick = () => show('manual-test-trigger', true);
  document.getElementById('privacy').onclick = async () => report('privacy-form', await send('privacy'));
  (async () => {
    report('release-capability-in-debug', await send('releaseCapability'));
    report('pre-consent-banner', await send('banner.enable'));
    await show('pre-consent-interstitial', true);
    report('privacy-status', await send('status'));
    const consent = await send('consent');
    report('consent', consent);
    report('post-consent-banner', await send('banner.enable'));
    await show('expired-trigger', true, Date.now() - 2000);
    await show('invalidated-trigger', false);
    if (consent === 'completed') setTimeout(async () => {
      await show('cached-expired-trigger', true, Date.now() - 2000);
      await show('cached-invalidated-trigger', false);
      await show('fresh-trigger', true);
    }, 45000);
  })();
} else report('bridge', 'missing');
</script></html>`;

createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4179');
  if (url.pathname === '/result') {
    console.log(url.searchParams.get('step'), url.searchParams.get('result'));
    res.writeHead(204).end();
  } else if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  } else res.writeHead(404).end();
}).listen(4179, '127.0.0.1', () => console.log('OnlyFast Android QA is listening on 4179'));
