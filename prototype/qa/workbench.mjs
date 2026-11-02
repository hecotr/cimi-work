import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'qa-deps', 'noop.js'));
const puppeteer = require('puppeteer-core');
const base = process.env.CIMI_PREVIEW_URL || 'http://127.0.0.1:4173';
const screenshots = path.join(root, 'qa/screenshots');
mkdirSync(screenshots, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const page = await browser.newPage();
const results = [], errors = [];
page.on('pageerror', err => errors.push(err.message));
await page.setViewport({ width: 1440, height: 1000 });
const st = () => page.evaluate(() => window.CimiPrototype.getState());
const getResource = async id => (await st()).resources.find(r => r.id === id);
const getTask = async id => (await st()).tasks.find(t => t.id === id);
const getSpace = async id => (await st()).spaces.find(s => s.id === id);
async function open(route) { await page.goto(base + '/#' + route); await page.waitForFunction(() => !!window.CimiPrototype && document.querySelector('main')?.dataset.route === location.hash); }
async function click(selector) { await page.waitForSelector(selector, { visible: true }); await page.click(selector); }
async function fill(selector, value) { await page.$eval(selector, (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value); }
async function shot(name) { await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true }); }
async function test(name, body) { try { await body(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); } catch (err) { results.push({ name, status: 'failed', error: err.message }); await shot('workbench-failure'); throw err; } }
async function waitResourceRoute() { await page.waitForFunction(() => /^#\/resources\/[^/?]+$/.test(location.hash) && !['new'].includes(location.hash.split('/').pop()) && document.querySelector('main')?.dataset.route === location.hash); }
async function createResource({ name, type = 'agent', origin = 'personal', connect = false, members = [], coordinator = '', capabilities = '研究，资料，文档' }) {
  await open('/resources/new' + (connect ? '?mode=connect' : ''));
  await fill('#resource-name', name); await fill('#resource-description', '用于 Cimi Work 资源配置验收的演示主体。');
  await page.select('#resource-type', type); await page.select('#resource-origin', origin);
  await fill('#resource-capabilities', capabilities);
  if (type === 'agent') await fill('#config-prompt', '主动检索当前任务已授权的资料，委派明确工作，提供可追溯结论。');
  if (connect || ['matrix', 'harness'].includes(type)) await fill('#config-external', 'demo-ref-' + type);
  if (type === 'team') { await page.select('#config-coordinator', coordinator); if (name === '数据整理工作队') await page.select('#config-workflow', 'sequential'); }
  for (const [index, member] of members.entries()) {
    await click('[data-action="wb-add-member"]');
    const row = `[data-member]:nth-child(${index + 1})`;
    await page.select(row + ' select', member.id);
    await fill(row + ' input[id$="-role"]', member.role);
    if (member.dependsOn) await page.select(row + ' select[id$="-depends"]', member.dependsOn);
  }
  if (name === '数据整理工作队') await shot('13-team-editor');
  if (name === '财务资料主管') await shot('14-agent-editor');
  await click('form[data-form="wb-resource"] button[type="submit"]');
  await waitResourceRoute();
  return (await st()).resources.find(r => r.draft?.name === name).id;
}
async function publish(id) { await click('[data-action="wb-publish"]'); assert.ok((await getResource(id)).publishedVersion > 0); assert.equal(await page.$eval('#dialog', el => el.open), false); }
async function grant(id, sid, enabled = true) {
  await open('/resources/' + id + '?tab=access');
  const selector = `input[name="grants"][value="${sid}"]`;
  if (await page.$eval(selector, el => el.checked) !== enabled) await click(selector);
  await click('form[data-form="wb-access"] button[type="submit"]');
  assert.equal((await getResource(id)).grants.includes(sid), enabled);
}
async function bind(sid, id, success = true) {
  await open('/space/' + sid + '?tab=members'); await click('[data-action="configure-resources"]');
  const selector = `input[name="resources"][value="${id}"]`;
  if (!await page.$eval(selector, el => el.checked)) await click(selector);
  await click('form[data-form="wb-bind"] button[type="submit"]');
  assert.equal(await page.$eval('#dialog', el => el.open), !success);
}
async function createTask(sid, id, goal, configure = null) {
  await open(`/new?space=${sid}${id ? '&resource=' + id : ''}`); await fill('#task-goal', goal);
  if (configure) { await click('form[data-form="create-task"] details summary'); await configure(); }
  await click('form[data-form="create-task"] button[type="submit"]');
  await page.waitForFunction(() => location.hash.startsWith('#/task/') && document.querySelector('.assignment-strip'));
  return (await st()).tasks[0].id;
}
async function advanceToReview(id) {
  for (let i = 0; i < 9; i++) {
    const t = await getTask(id); if (['review', 'completed'].includes(t.status)) return t;
    if (t.humanAction) await click('form[data-form="human-action"] button[type="submit"]');
    else await click('[data-action="advance"]');
  }
  throw Error('Task did not reach review');
}
async function reassign(id, rid, reason, pending = false) {
  await open('/task/' + id); await click('[data-action="wb-reassign"]'); await page.select('#reassign-resource', rid);
  await fill('#reassign-reason', reason); await page.select('#handoff-status', pending ? 'pending' : 'confirmed');
  await click('form[data-form="wb-reassign"] button[type="submit"]');
}
let principal, team, projectTeam, mainTask, projectTask, newProject, matrix, harness;
try {
  await open('/home'); await page.evaluate(() => localStorage.removeItem('cimi-work-prototype-v1')); await page.reload(); await page.waitForFunction(() => !!window.CimiPrototype);
  await test('Schema-one browser data migrates without losing prior discussion', async () => {
    await page.evaluate(() => { const old = window.CimiPrototype.getState(); delete old.workbenchSchema; for (const r of old.resources) { delete r.versions; delete r.grants; } old.tasks[0].events.push({ actor: 'Hector', kind: 'human', text: '保留的旧版用户讨论', time: '11:00' }); localStorage.setItem('cimi-work-prototype-v1', JSON.stringify(old)); });
    await page.reload(); await page.waitForFunction(() => window.CimiPrototype?.getState().workbenchSchema === 2);
    assert.ok((await getTask('CW-1042')).events.some(x => x.text === '保留的旧版用户讨论')); assert.equal((await getResource('research')).versions.length, 1);
  });
  await test('Private Agent draft can reference a concrete sub-Agent with input and output', async () => {
    principal = await createResource({ name: '财务资料主管', members: [{ id: 'research', role: '研究资料复核' }], capabilities: '财务，收入，数据分析' });
    let r = await getResource(principal); assert.equal(r.publishedVersion, 0); assert.deepEqual(r.grants, ['personal']); assert.equal(r.draft.config.delegates[0].resourceId, 'research'); assert.ok(r.draft.config.delegates[0].output); await publish(principal); await shot('07-private-agent');
  });
  await test('Private resource is unavailable to a project until explicitly granted', async () => {
    await open('/space/ops?tab=members'); await click('[data-action="configure-resources"]'); assert.equal(await page.$eval(`input[value="${principal}"]`, el => el.disabled), true); await click('[data-action="close-dialog"]');
    await open('/new?space=ops'); assert.equal(await page.$(`#new-resource option[value="${principal}"]`), null);
  });
  await test('Space binding enables a concrete Agent and snapshots its exact configuration', async () => {
    await bind('personal', principal); mainTask = await createTask('personal', principal, '归纳财务资料并形成说明'); const t = await getTask(mainTask);
    assert.equal(t.binding.version, 1); assert.equal(t.runs[0].snapshot.members[0].snapshot.id, 'research'); assert.equal(t.sources.length, 0); assert.equal(t.subtasks[0].status, 'waiting');
  });
  await test('Saving and publishing v2 preserves an existing Task and Run on v1', async () => {
    await open('/resources/' + principal + '/edit'); await fill('#config-prompt', '第二版指令：复核证据并保留输出出处。'); await click('form[data-form="wb-resource"] button[type="submit"]'); await waitResourceRoute();
    assert.equal((await getResource(principal)).publishedVersion, 1); await publish(principal); assert.equal((await getResource(principal)).publishedVersion, 2);
    const t = await getTask(mainTask); assert.equal(t.binding.version, 1); assert.equal(t.runs[0].snapshot.version, 1); assert.ok(!t.runs[0].snapshot.config.prompt.includes('第二版'));
    await open('/task/' + mainTask); assert.match(await page.$eval('.assignment-strip', el => el.textContent), /继续使用已绑定版本/);
  });
  await test('Adopting a published version creates a new Run after explicit handoff', async () => {
    await reassign(mainTask, principal, '明确采用配置第二版'); const t = await getTask(mainTask); assert.equal(t.runs.length, 2); assert.equal(t.runs[0].snapshot.version, 1); assert.equal(t.runs[1].snapshot.version, 2); assert.match(t.runs[0].status, /已停止/); assert.equal(t.binding.version, 2);
  });
  await test('An unconfirmed stop blocks new execution and resumption', async () => {
    const before = await getTask(mainTask); await reassign(mainTask, 'research', '改由研究 Agent 承接', true); let t = await getTask(mainTask); assert.equal(t.status, 'blocked'); assert.equal(t.resource, principal); assert.equal(t.runs.length, before.runs.length);
    await click('[data-action="resume"]'); assert.equal((await getTask(mainTask)).runs.length, before.runs.length);
    await reassign(mainTask, 'research', '旧执行已停止，继续交接'); t = await getTask(mainTask); assert.equal(t.resource, 'research'); assert.equal(t.runs.length, before.runs.length + 1); await shot('08-task-handoff');
  });
  await test('Circular sub-Agent references cannot be published', async () => {
    await open('/resources/research/edit'); await click('[data-action="wb-add-member"]'); const row = '[data-member]:last-child'; await page.select(row + ' select', principal); await fill(row + ' input[id$="-role"]', '循环关系测试'); await click('form[data-form="wb-resource"] button[type="submit"]'); await waitResourceRoute(); await click('[data-action="wb-publish"]'); assert.match(await page.$eval('#dialog', el => el.textContent), /循环委派/); assert.equal((await getResource('research')).publishedVersion, 1); await click('[data-action="close-dialog"]'); await click('[data-action="wb-discard-ask"]'); await click('[data-action="wb-discard"]');
  });
  await test('Team configuration binds concrete members, coordinator and serial dependencies', async () => {
    team = await createResource({ name: '数据整理工作队', type: 'team', coordinator: 'research', capabilities: '数据分析，交付', members: [{ id: 'research', role: '资料整理' }, { id: 'analyst', role: '数据复核', dependsOn: 'research' }] }); await publish(team);
    const c = (await getResource(team)).versions[0].config; assert.equal(c.members.length, 2); assert.equal(c.coordinator, 'research'); assert.equal(c.members[1].dependsOn, 'research'); await shot('09-team-configuration');
  });
  await test('Project readiness rejects a Team with an unauthorized dependency', async () => {
    projectTeam = await createResource({ name: '项目财务协作队', type: 'team', origin: 'ops', coordinator: principal, capabilities: '数据分析，报告', members: [{ id: principal, role: '财务分析' }] }); await publish(projectTeam);
    await bind('ops', projectTeam, false); assert.match(await page.$eval('#dialog [data-feedback]', el => el.textContent), /未向该空间开放/); assert.ok(!(await getSpace('ops')).resources.includes(projectTeam)); await click('[data-action="close-dialog"]');
  });
  await test('Explicit grant fixes dependencies without enabling each child as a top-level choice', async () => {
    await grant(principal, 'ops'); await bind('ops', projectTeam); const s = await getSpace('ops'); assert.ok(s.resources.includes(projectTeam)); assert.ok(!s.resources.includes(principal));
    projectTask = await createTask('ops', projectTeam, '分析财务资料形成报告'); const t = await getTask(projectTask); assert.equal(t.binding.members[0].snapshot.id, principal); assert.equal(t.binding.members[0].snapshot.version, 2); assert.ok(t.sources.every(id => !id.startsWith('p-')));
  });
  await test('Resource use explicitly asks for the destination space', async () => {
    await open('/resources/' + projectTeam); await click('[data-action="wb-use"]'); assert.ok(await page.$('#use-space')); await page.select('#use-space', 'ops'); await click('form[data-form="wb-use"] button[type="submit"]'); await page.waitForFunction(() => location.hash.startsWith('#/new') && !!document.getElementById('new-space')); assert.equal(await page.$eval('#new-space', el => el.value), 'ops'); assert.equal(await page.$eval('#new-resource', el => el.value), projectTeam);
  });
  await test('Default subject is evaluated for suitability before capability matching', async () => {
    await open('/settings?space=ops'); await page.select('#space-resource', 'research'); await click('form[data-form="wb-settings"] button[type="submit"]');
    const id = await createTask('ops', null, '分析本周运营数据'); const t = await getTask(id); assert.notEqual(t.resource, 'research'); assert.match(t.assignmentReason, /默认主体.*不适用/); assert.equal(t.resource, 'ops-team');
  });
  await test('No ready or matching resource preserves the Task without inventing a Run', async () => {
    await open('/home'); await click('[data-action="new-space"]'); await fill('#project-name', '无资源验证项目'); await click('form[data-form="new-space"] button[type="submit"]'); await page.waitForFunction(() => location.hash.startsWith('#/space/project-'));
    newProject = (await st()).spaces.at(-1).id; assert.equal((await getSpace(newProject)).defaultResource, '');
    const id = await createTask(newProject, null, '整理项目研究目标'); const t = await getTask(id); assert.equal(t.status, 'waiting'); assert.equal(t.runs.length, 0); assert.equal(t.goal, '整理项目研究目标'); assert.ok(await page.$('[data-action="wb-reassign"]'));
  });
  await test('Matrix registration keeps an external identity and read-only Runtime fields', async () => {
    matrix = await createResource({ name: '外部 Matrix 评审团队', type: 'matrix', connect: true, members: [{ id: 'research', role: '评审成员映射' }] }); await publish(matrix);
    assert.equal((await getResource(matrix)).management, 'external'); await open('/resources/' + matrix + '/edit'); assert.equal(await page.$eval('#config-runtime', el => el.disabled || el.closest('fieldset').disabled), true); assert.equal(await page.$eval('#config-external', el => el.closest('fieldset').disabled), true); assert.ok(await page.$('[data-member]'));
  });
  await test('Harness registration maps N1–N5 roles and an explicit automatic policy', async () => {
    harness = await createResource({ name: '工程闭环 Harness', type: 'harness', connect: true, capabilities: '研发，需求，代码', members: [{ id: 'research', role: 'N1' }, { id: 'developer', role: 'N2' }, { id: 'verifier', role: 'N3' }, { id: 'reporter', role: 'N4' }, { id: 'research', role: 'N5' }] });
    await open('/resources/' + harness + '/edit'); await page.select('#config-acceptance', 'auto'); await click('form[data-form="wb-resource"] button[type="submit"]'); await waitResourceRoute(); await publish(harness); await bind('personal', harness);
    const id = await createTask('personal', harness, '实现一项研发需求并验证'); const t = await advanceToReview(id); assert.equal(t.status, 'completed'); assert.equal(t.ruleEvaluation.ruleOrigin, 'Harness'); assert.match(t.acceptanceRecord.actor, /Harness验收规则/);
  });
  await test('Required human work prevents acceptance until its explicit reply is recorded', async () => {
    await open('/task/' + mainTask); await click('[aria-label="邀请协作者"]'); await page.select('#invite-person', 'person:Hector'); await fill('#invite-goal', '复核关键结论与证据'); await click('input[name="required"]'); await click('form[data-form="wb-invite"] button[type="submit"]');
    await advanceToReview(mainTask); await click('.task-heading [data-action="accept"]'); assert.equal((await getTask(mainTask)).status, 'review'); assert.match(await page.$eval('#dialog', el => el.textContent), /必需子工作/); await click('[data-action="close-dialog"]');
    await fill('form[data-form="collab-reply"] input', '已复核，结论与证据一致。'); await click('form[data-form="collab-reply"] button[type="submit"]'); await click('.task-heading [data-action="accept"]'); assert.equal((await getTask(mainTask)).status, 'completed');
  });
  await test('Dependent Agent work cannot be dispatched before its predecessor completes', async () => {
    await bind('personal', team); const id = await createTask('personal', team, '整理资料并复核数据'); const before = await getTask(id), second = before.subtasks[1];
    await click(`[data-action="wb-work"][data-id="${id}:${second.id}"]`); assert.match(await page.$eval('#dialog', el => el.textContent), /前置子工作/); assert.equal((await getTask(id)).subtasks[1].assigned, false); await click('[data-action="close-dialog"]');
    const first = before.subtasks[0]; await click(`[data-action="wb-work"][data-id="${id}:${first.id}"]`); await click(`[data-action="wb-work"][data-id="${id}:${first.id}"]`); await click(`[data-action="wb-work"][data-id="${id}:${second.id}"]`); assert.equal((await getTask(id)).subtasks[1].status, 'running'); await shot('10-actual-collaboration');
  });
  await test('Context distinguishes searchable scope, used sources and denied contents', async () => {
    const id = await createTask('personal', 'research', '整理研究笔记与资料'); await open('/task/' + id + '?tab=context'); assert.equal((await getTask(id)).sources.length, 0); assert.match(await page.$eval('main', el => el.textContent), /允许检索，尚未使用/);
    await click(`[data-action="wb-source-access"][data-id="${id}:p-notes"]`); await open('/task/' + id); await click('[data-action="advance"]');
    const t = await getTask(id); assert.ok(!t.sources.includes('p-notes')); assert.ok(t.retrieval.some(x => x.id === 'p-notes' && x.status === 'denied')); assert.ok(t.sources.includes('p-reading'));
    await open('/task/' + id + '?tab=context'); assert.ok(!(await page.$eval('main', el => el.textContent)).includes('关注任务连续性、Agent 自主获取上下文')); await click(`[data-action="wb-source-access"][data-id="${id}:p-notes"]`); await click('[data-action="wb-source-request"]'); await click('[data-action="close-dialog"]'); await page.reload(); assert.ok((await getTask(id)).accessRequests.includes('p-notes'));
    await click(`[data-action="wb-source-process"][data-id="${id}:p-notes"]`); await click('[data-action="wb-source-approve"]'); assert.equal((await getTask(id)).sources.includes('p-notes'), false); assert.equal((await getSpace('personal')).docs.find(d => d.id === 'p-notes').access, 'allowed'); await shot('11-context-boundaries');
  });
  await test('Source-required automatic rules fall back to manual when evidence is missing', async () => {
    await grant('research', newProject); await bind(newProject, 'research'); await open('/settings?space=' + newProject); await click('input[name="autoAccept"]'); await click('input[name="rule-sources"]'); await click('form[data-form="wb-settings"] button[type="submit"]');
    const id = await createTask(newProject, 'research', '整理研究计划'); const t = await advanceToReview(id); assert.equal(t.status, 'review'); assert.equal(t.ruleEvaluation.checks.sources, false); assert.match(t.ruleEvaluation.result, /证据不足/);
  });
  await test('Task manual override wins over an enabled automatic space rule', async () => {
    await open('/settings?space=personal'); await click('input[name="autoAccept"]'); await click('form[data-form="wb-settings"] button[type="submit"]');
    const id = await createTask('personal', 'research', '整理研究资料生成摘要', async () => { await click('input[name="forceManual"]'); }); const t = await advanceToReview(id); assert.equal(t.status, 'review'); assert.equal(t.currentSubmission.forceManual, true);
  });
  await test('Unconnected external delivery never produces a sent receipt or automatic completion', async () => {
    const id = await createTask('personal', 'research', '整理研究资料并报送', async () => { await fill('#new-target', '项目相关人员'); await page.select('#new-channel', 'external'); }); const t = await advanceToReview(id);
    assert.equal(t.status, 'review'); assert.match(t.delivery.status, /未发送/); assert.equal(t.ruleEvaluation.checks.delivery, false); await click('.task-heading [data-action="accept"]'); assert.equal((await getTask(id)).status, 'review'); assert.match(await page.$eval('#dialog', el => el.textContent), /尚未完成交付/); await click('[data-action="close-dialog"]');
  });
  await test('Acceptance uses the submitted recipient and artifact specification', async () => {
    const id = await createTask('ops', 'research', '整理研究资料与项目结论', async () => { await page.select('#new-acceptor', '林悦'); await page.select('#new-artifact', 'report'); }); await advanceToReview(id);
    await click('[data-action="wb-delivery"]'); await page.select('#delivery-acceptor', '陈安'); await click('form[data-form="wb-delivery"] button[type="submit"]'); await click('.task-heading [data-action="accept"]'); const t = await getTask(id); assert.equal(t.acceptanceRecord.actor, '林悦'); assert.equal(t.artifacts.at(-1).deliverySpec.artifactType, 'report');
  });
  await test('Revoked dependency access blocks existing execution without changing its snapshot', async () => {
    const before = await getTask(projectTask); await grant(principal, 'ops', false); await open('/task/' + projectTask); await click('[data-action="advance"]'); const t = await getTask(projectTask); assert.equal(t.status, 'blocked'); assert.equal(t.runs.length, before.runs.length); assert.equal(t.binding.members[0].snapshot.version, 2); assert.match(t.blockReason, /未向该空间开放/); await grant(principal, 'ops');
  });
  await test('Stopping a resource blocks its active Task and re-enabling allows an explicit new Run', async () => {
    const id = await createTask('personal', principal, '复核财务资料'); await open('/resources/' + principal); await click('[data-action="wb-toggle-ask"]'); await click('[data-action="wb-toggle"]'); await open('/task/' + id); await click('[data-action="advance"]'); assert.equal((await getTask(id)).status, 'blocked');
    await open('/resources/' + principal); await click('[data-action="wb-toggle-ask"]'); await click('[data-action="wb-toggle"]'); await open('/task/' + id); await click('[data-action="resume"]'); assert.equal((await getTask(id)).runs.length, 2);
  });
  await test('New configuration screens fit 320–1920 pixels and preserve keyboard dialog behavior', async () => {
    for (const width of [320, 375, 768, 1280, 1440, 1920]) {
      await page.setViewport({ width, height: 900 });
      for (const route of ['/resources', '/resources/new', '/resources/' + principal, '/resources/' + team + '/edit', '/task/' + projectTask + '?tab=runs']) {
        await open(route); const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, title: document.querySelector('.page-head > div:first-child')?.getBoundingClientRect().width })); assert.ok(size.scroll <= size.width + 1, `${width}px ${route}: ${size.scroll}`); if (width <= 375 && size.title) assert.ok(size.title > 220, 'Mobile heading must retain a readable full-width measure');
      }
    }
    await page.setViewport({ width: 375, height: 812 }); await open('/resources/' + team); await shot('12-resource-mobile');
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); assert.equal(await page.evaluate(() => document.activeElement.id), 'global-search'); await page.keyboard.press('Escape'); assert.equal(await page.$eval('#dialog', el => el.open), false);
  });
  await test('Published versions, grants and task history survive browser reload', async () => {
    const before = await getResource(principal), prior = await getTask(mainTask); await page.reload(); await page.waitForFunction(() => !!window.CimiPrototype); assert.deepEqual((await getResource(principal)).versions, before.versions); assert.deepEqual((await getTask(mainTask)).assignmentHistory, prior.assignmentHistory);
  });
  await test('Resource usage, editing and publishing permissions are saved independently', async () => {
    await page.setViewport({ width: 1440, height: 1000 }); await open('/resources/' + principal + '?tab=access'); await click('input[name="editors"][value="林悦"]'); await click('input[name="publishers"][value="陈安"]'); await click('form[data-form="wb-access"] button[type="submit"]');
    const r = await getResource(principal); assert.ok(r.editors.includes('林悦')); assert.ok(!r.publishers.includes('林悦')); assert.ok(r.publishers.includes('陈安')); assert.ok(!r.editors.includes('陈安')); assert.ok(r.grants.includes('ops'));
  });
  await test('A referenced tool must be authorized before a resource can be enabled', async () => {
    await open('/space/ops?tab=members'); await click('[data-action="configure-resources"]'); await click('form[data-form="wb-bind"] details summary'); assert.equal(await page.$eval('input[name="tools"][value="data"]', el => el.checked), true); await click('input[name="tools"][value="data"]'); assert.equal(await page.$eval('input[name="tools"][value="data"]', el => el.checked), false); await click('form[data-form="wb-bind"] button[type="submit"]');
    assert.equal(await page.$eval('#dialog', el => el.open), true); assert.match(await page.$eval('[data-feedback]', el => el.textContent), /工具未授权/); assert.ok((await getSpace('ops')).allowedTools.includes('data')); await click('[data-action="close-dialog"]');
  });
  await test('Private knowledge stays unusable in projects even when the Agent is granted', async () => {
    const rid = await createResource({ name: '仅个人知识的研究 Agent' }); await open('/resources/' + rid + '/edit'); await page.select('#config-knowledge', 'private'); await click('form[data-form="wb-resource"] button[type="submit"]'); await waitResourceRoute(); await publish(rid); await grant(rid, 'ops'); await bind('ops', rid, false); assert.match(await page.$eval('[data-feedback]', el => el.textContent), /个人知识范围/); await click('[data-action="close-dialog"]');
  });
  await test('User-added material remains separate from the automatically used sources', async () => {
    const fixture = path.join(screenshots, 'local-material.txt'); writeFileSync(fixture, '仅本地的任务附加材料。');
    await open('/new?space=personal&resource=research'); await fill('#task-goal', '整理研究资料与附加材料'); const handle = await page.$('#attachments'); await handle.uploadFile(fixture); await page.waitForSelector('#attachment-list li'); await click('form[data-form="create-task"] button[type="submit"]'); await page.waitForSelector('.assignment-strip');
    const t = (await st()).tasks[0]; assert.equal(t.attachments.length, 1); assert.equal(t.sources.length, 0); await open('/task/' + t.id + '?tab=context'); assert.match(await page.$eval('main', el => el.textContent), /local-material\.txt/); assert.match(await page.$eval('main', el => el.textContent), /用户主动提供/);
  });
  assert.deepEqual(errors, []);
  console.log(`Verified ${results.length} workbench scenarios; no browser errors.`);
} finally {
  writeFileSync(path.join(root, 'qa/workbench-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), scenarios: results, browserErrors: errors }, null, 2));
  await browser.close();
}
