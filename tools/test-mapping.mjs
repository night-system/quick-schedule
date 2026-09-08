// 滚轮时间映射闭环测试(真实 Chromium + CDP 触摸模拟)
// 用法:node tools/test-mapping.mjs  (需先 node tools/serve.mjs 8080;puppeteer-core 经 PUPPETEER_CORE 或默认路径)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = require(process.env.PUPPETEER_CORE || 'C:/Users/33392/AppData/Local/Temp/qs-test/node_modules/puppeteer-core');
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8080/';
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: detail || '' });
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 820, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });

const getWheels = () => page.evaluate(() => {
  const g = (s) => {
    const w = document.querySelector(s);
    return [...w.querySelectorAll('.wi')].findIndex(x => x.classList.contains('sel'));
  };
  return { sh: g('#wsh'), sm: g('#wsm'), eh: g('#weh'), em: g('#wem'), lead: g('#wl') };
});
const wheelState = (sel) => page.evaluate((s) => {
  const w = document.querySelector(s);
  const r = w.getBoundingClientRect();
  return { scrollTop: w.scrollTop, x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);

const cdp = await page.target().createCDPSession();
async function swipe(sel, steps) {
  // steps>0:手指上滑(值增大);每格 36px
  const st = await wheelState(sel);
  const px = steps * 36;
  const N = 10;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: st.x, y: st.y }] });
  for (let i = 1; i <= N; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: st.x, y: st.y - px * (i / N) }] });
    await new Promise(r => setTimeout(r, 16));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const settle = () => new Promise(r => setTimeout(r, 1000));

/* 1. 默认值:高亮合法 */
let w = await getWheels();
let sm0 = w.sm;
const startDef = w.sh * 60 + w.sm, endDef = w.eh * 60 + w.em;
check('默认 结束>=开始+5', endDef >= startDef + 5, 'start=' + fmt(startDef) + ' end=' + fmt(endDef));

/* 2. 真实触摸滚动:开始分钟滚轮 +4 格 → 高亮正确 */
await swipe('#wsm', 4);
await settle();
w = await getWheels();
check('触摸滚动后分钟=初始+4', w.sm === Math.min(sm0 + 4, 11), 'expected=' + Math.min(sm0 + 4, 11) + ' got=' + w.sm);

/* 3. 添加任务:数据==提交前高亮  时间线==数据 */
await page.type('#f-title', '闭环测试任务');
const uiBefore = await getWheels();   // 提交前:添加后表单会重置为默认时间
await page.click('#btn-submit');
await new Promise(r => setTimeout(r, 400));
const data = await page.evaluate(() => JSON.parse(localStorage.getItem('quick-schedule-items-v1')));
const last = data[data.length - 1];
const uiStart = uiBefore.sh * 60 + uiBefore.sm * 5, uiEnd = uiBefore.eh * 60 + uiBefore.em * 5;
check('提交数据 startMin==提交前高亮', last.startMin === uiStart, 'data=' + fmt(last.startMin) + ' ui=' + fmt(uiStart));
check('提交数据 endMin==提交前高亮', last.endMin === uiEnd, 'data=' + fmt(last.endMin) + ' ui=' + fmt(uiEnd));
check('提交数据 endMin>=startMin+5', last.endMin >= last.startMin + 5, 'start=' + fmt(last.startMin) + ' end=' + fmt(last.endMin));
check('leadMin 属于 5/30/60', [5, 30, 60].includes(last.leadMin), 'lead=' + last.leadMin);
const evtTxt = await page.evaluate(() => {
  const el = document.querySelector('.evt');
  return el ? el.innerText.replace(/\s+/g, ' ') : '';
});
check('时间线块文本==数据时间', evtTxt.includes(fmt(last.startMin)) && evtTxt.includes(fmt(Math.min(last.endMin, 1439))), evtTxt);

/* 4. 拖动后系统误触 click → 不应跳变 */
await swipe('#wsh', 2);
await settle();
let w4 = await getWheels();
const before = w4.sh;
await page.evaluate(() => {
  const w = document.querySelector('#wsh');
  w.querySelectorAll('.wi')[5].click();   // 模拟误触的 click
});
await new Promise(r => setTimeout(r, 300));
w4 = await getWheels();
check('拖动误触click不跳变', w4.sh === before, 'before=' + before + ' after=' + w4.sh);

/* 5. 结束时间联动:开始小时滚到 10,结束自动>=开始+5 */
w4 = await getWheels();
let delta = 10 - w4.sh;
if (delta === 0) delta = 1;
await swipe('#wsh', delta);
await settle();
const w5 = await getWheels();
const s5 = w5.sh * 60 + w5.sm * 5, e5 = w5.eh * 60 + w5.em * 5;
check('结束联动>=开始+5', e5 >= s5 + 5, 'start=' + fmt(s5) + ' end=' + fmt(e5));

/* 6. 点击任务块 → 表单回填=任务数据 */
await page.click('.evt');
await new Promise(r => setTimeout(r, 400));
const w6 = await getWheels();
const ui6s = w6.sh * 60 + w6.sm * 5, ui6e = w6.eh * 60 + w6.em * 5;
check('点块回填==数据', ui6s === last.startMin && ui6e === last.endMin,
  'data=' + fmt(last.startMin) + '-' + fmt(last.endMin) + ' ui=' + fmt(ui6s) + '-' + fmt(ui6e));

/* 7. 提醒小滚轮:点第 3 档(1h)→ 映射 */
await page.evaluate(() => document.querySelector('#wl .wi[data-i="2"]').click());
await new Promise(r => setTimeout(r, 500));
const w7 = await getWheels();
check('提醒滚轮点击映射=1h档', w7.lead === 2, 'lead=' + w7.lead);

/* 汇总 */
const fails = results.filter(r => !r.ok);
console.log('======== ' + (fails.length ? 'FAILED ' + fails.length + ' / ' + results.length : 'ALL PASS ' + results.length + ' / ' + results.length) + ' ========');
await browser.close();
process.exit(fails.length ? 1 : 0);
