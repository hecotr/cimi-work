/* Local-only resource configuration and execution-binding prototype. No runtime or permission service is contacted. */
window.createCimiWorkbench = function (api) {
  'use strict';
  const { getState, esc: e, clone, resource, space, task, icon, button, pageHead, footer, route, go, render, persist, showDialog, closeDialog, now, saveTask, startRun, nextTaskId, status, getFiles, clearFiles } = api;
  const state = () => getState();
  const types = { agent: '单 Agent', team: '通用 Team', matrix: 'Matrix AgentTeams', harness: '业务 Harness' };
  const toolNames = { search: '知识检索', data: '数据连接器', files: '工作区文件', notify: '通知渠道' };
  const select = (name, label, values, picked = '', extra = '') => `<div class="form-section"><label for="${e(name)}">${e(label)}</label><select id="${e(name)}" name="${e(name)}" ${extra}>${values.map(([id, text]) => `<option value="${e(id)}"${id === picked ? ' selected' : ''}>${e(text)}</option>`).join('')}</select></div>`;
  const input = (name, label, value = '', help = '', required = false) => `<div class="form-section"><label for="${e(name)}">${e(label)}</label><input class="input" id="${e(name)}" name="${e(name)}" value="${e(value)}"${required ? ' required' : ''} autocomplete="off">${help ? `<p class="helper">${e(help)}</p>` : ''}</div>`;
  const text = (name, label, value = '', help = '', required = false) => `<div class="form-section"><label for="${e(name)}">${e(label)}</label><textarea id="${e(name)}" name="${e(name)}"${required ? ' required' : ''}>${e(value)}</textarea>${help ? `<p class="helper">${e(help)}</p>` : ''}</div>`;
  const csv = value => String(value || '').split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
  const notice = (message, kind = '') => `<div class="notice ${kind}">${icon(kind === 'error' ? 'alert' : 'info')}<span>${e(message)}</span></div>`;
  const feedback = (form, message) => { const el = form.querySelector('[data-feedback]'); if (el) { el.textContent = message; el.classList.add('error'); el.focus(); } };
  const published = r => r?.versions?.find(v => v.version === r.publishedVersion);
  const config = r => published(r)?.config;
  const links = c => c?.type === 'agent' ? c.delegates || [] : c?.type === 'harness' ? c.roles || [] : c?.members || [];
  const canManage = r => r?.owner === 'Hector' || r?.managers?.includes('Hector');
  const canEdit = r => canManage(r) || r?.editors?.includes('Hector');
  const canPublish = r => canManage(r) || r?.publishers?.includes('Hector');
  const scopeName = r => r?.originSpace === 'personal' ? '个人私有配置' : `${space(r?.originSpace)?.name || '项目'}共享配置`;
  const defaultConfig = type => ({ type, prompt: '', runtime: 'Agent OS 云端（演示）', model: '空间模型网关（演示）', skills: [], tools: ['search'], knowledge: 'space', location: 'cloud', connection: 'ready', delegates: [], members: [], roles: [], coordinator: '', workflow: 'parallel', aggregation: '由协调者汇总有来源的结果', externalId: '', parameters: '', gates: '人工确认关键边界，交付后按规则验收', limit: '最大委派深度 3，不重复派发相同工作' });
  function initialise() {
    if (!state().resources.some(r => r.id === 'reporter')) state().resources.push({ id: 'reporter', name: '报告整理 Agent', type: 'agent', typeName: types.agent, description: '汇总证据与分析结果，形成交付报告。', capabilities: ['报告', '文档', '交付'], location: 'cloud', available: true });
    if (!state().resources.some(r => r.id === 'developer')) state().resources.push({ id: 'developer', name: '研发 Agent', type: 'agent', typeName: types.agent, description: '依据需求与工作区规则处理开发工作。', capabilities: ['研发', '需求', '代码'], location: 'cloud', available: true });
    if (!state().resources.some(r => r.id === 'verifier')) state().resources.push({ id: 'verifier', name: '验证 Agent', type: 'agent', typeName: types.agent, description: '复核实现、质量门禁与交付证据。', capabilities: ['验证', '验收', '权限'], location: 'cloud', available: true });
    for (const r of state().resources) {
      if (r.versions) continue;
      const c = defaultConfig(r.type); c.location = r.location; c.connection = r.available ? 'ready' : 'offline'; c.prompt = r.description;
      if (r.id === 'analyst' || r.id === 'ops-team') c.tools = ['search', 'data'];
      if (r.id === 'developer' || r.id === 'verifier' || r.type === 'harness') c.tools = ['search', 'files'];
      const member = (id, role, dep = '') => ({ resourceId: id, role, trigger: '需要该角色能力时', input: '仅任务与项目已授权上下文', output: '结果与来源证据', dependsOn: dep });
      if (r.id === 'ops-team') { c.members = [member('research', '资料与口径'), member('analyst', '数据分析', 'research'), member('reporter', '报告汇总', 'analyst')]; c.coordinator = 'analyst'; c.workflow = 'sequential'; }
      if (r.id === 'delivery-team') { c.members = [member('research', '材料复核'), member('reporter', '成果整理', 'research')]; c.coordinator = 'research'; }
      if (r.type === 'matrix') { c.externalId = '!cimi-review:matrix.example（演示）'; c.members = [member('research', '研究评审'), member('verifier', '证据复核')]; }
      if (r.type === 'harness') { c.externalId = 'semi-loop/demo-v1'; c.roles = [member('research', 'N1'), member('developer', 'N2'), member('verifier', 'N3'), member('reporter', 'N4'), member('research', 'N5')]; }
      r.owner = 'Hector'; r.managers = ['Hector']; r.originSpace = r.type === 'harness' || r.type === 'matrix' ? 'product' : 'ops';
      r.grants = state().spaces.map(s => s.id); r.management = ['matrix', 'harness'].includes(r.type) ? 'external' : 'local';
      r.publishedVersion = 1; r.disabled = false; r.versions = [{ version: 1, name: r.name, description: r.description, capabilities: clone(r.capabilities), config: c, actor: 'Hector', time: '初始演示配置' }];
    }
    for (const r of state().resources) { r.editors ||= clone(r.managers || [r.owner]); r.publishers ||= clone(r.managers || [r.owner]); }
    for (const s of state().spaces) {
      s.allowedTools ||= ['search', 'data', 'files'];
      s.rule ||= { version: 1, artifact: true, subtasks: true, sources: false };
      s.docs.forEach(d => { d.access ||= 'allowed'; });
    }
    for (const t of state().tasks) {
      t.acceptor ||= t.owner || 'Hector'; t.artifactType ||= 'markdown'; t.forceManual ||= false;
      t.deliveryConfig ||= { target: /报送|发送/.test(t.goal) ? '项目相关人员' : '', channel: 'none' };
      t.retrieval ||= (t.sources || []).map(id => ({ id, status: 'read', actor: resource(t.resource)?.name, runId: t.runs.at(-1)?.id, purpose: '初始演示中的已使用来源', version: 1 }));
      t.assignmentHistory ||= [];
      if (t.resource && !t.binding) t.binding = snapshot(resource(t.resource));
      for (const run of t.runs) if (!run.snapshot && t.binding) run.snapshot = clone(t.binding);
      t.subtasks.forEach((st, i) => { st.id ||= 'step-' + i; st.required ??= true; st.dependsOn ||= []; st.origin ||= 'seed'; });
    }
    state().workbenchSchema = 2;
  }
  function snapshot(r, seen = new Set()) {
    if (!r || !published(r) || seen.has(r.id)) return null;
    const p = published(r), next = new Set(seen).add(r.id);
    return { id: r.id, name: p.name, type: r.type, version: p.version, config: clone(p.config), members: links(p.config).map(m => ({ ...clone(m), snapshot: snapshot(resource(m.resourceId), next) })) };
  }
  function configurationErrors(r, c) {
    const out = [];
    if (c.type === 'agent' && (!c.prompt.trim() || !c.model.trim())) out.push('Agent 需要职责指令与模型引用。');
    if (['matrix', 'harness'].includes(c.type) && !c.externalId.trim()) out.push('请填写已有主体的外部标识。');
    const refs = links(c), ids = refs.map(m => m.resourceId);
    if (c.type === 'team' && (!refs.length || !ids.includes(c.coordinator))) out.push('Team 需要成员，并从成员中指定协调者。');
    if (c.type === 'harness' && ['N1', 'N2', 'N3', 'N4', 'N5'].some(p => !refs.some(m => m.role === p))) out.push('请配置 N1–N5 各阶段的执行角色。');
    if (c.type !== 'harness' && new Set(ids).size !== ids.length) out.push('同一成员请合并职责，避免重复引用。');
    for (const m of refs) {
      const dep = resource(m.resourceId);
      if (!dep || !published(dep)) out.push('成员必须引用已发布的主体。');
      if (['agent', 'team', 'matrix'].includes(c.type) && dep?.type !== 'agent') out.push('子 Agent 和 Team 成员须引用单 Agent。');
      if (!m.role.trim() || !m.input.trim() || !m.output.trim()) out.push('成员的职责、输入范围和预期输出不能为空。');
      if (m.dependsOn && (!ids.includes(m.dependsOn) || m.dependsOn === m.resourceId)) out.push('前置依赖必须是另一个已选成员。');
    }
    const visit = (id, path) => { if (path.has(id)) return true; const item = resource(id); const cs = id === r.id ? c : config(item); return links(cs).some(m => visit(m.resourceId, new Set(path).add(id))); };
    if (visit(r.id, new Set())) out.push('存在循环委派关系，请移除循环引用。');
    const dependencyCycle = (id, path) => { if (path.has(id)) return true; const m = refs.find(x => x.resourceId === id); return !!m?.dependsOn && dependencyCycle(m.dependsOn, new Set(path).add(id)); };
    if (ids.some(id => dependencyCycle(id, new Set()))) out.push('成员前置依赖不能形成循环。');
    return [...new Set(out)];
  }
  function issues(r, s, seen = new Set(), bound = null) {
    if (!r) return ['尚未选择执行主体'];
    if (seen.has(r.id)) return ['循环依赖'];
    const c = bound?.config || config(r), out = [], label = r.name;
    if (!c) return [label + ' 尚未发布配置'];
    if (r.disabled) out.push(label + ' 已停用');
    if (c.location === 'local' || c.connection !== 'ready') out.push(label + ' 连接未就绪（演示）');
    if (!r.grants.includes(s.id)) out.push(label + ' 未向该空间开放');
    if (c.knowledge === 'private' && !s.private) out.push(label + ' 限制为个人知识范围，不适用于项目');
    for (const tool of c.tools) if (!s.allowedTools.includes(tool)) out.push(label + ' 所需工具未授权：' + (toolNames[tool] || tool));
    const refs = bound?.members || links(c);
    for (const m of refs) out.push(...issues(resource(m.resourceId), s, new Set(seen).add(r.id), m.snapshot));
    return [...new Set(out)];
  }
  function options(s, selected = 'auto', auto = true, q = '') {
    let out = auto ? '<option value="auto">自动匹配合适的执行主体</option>' : '<option value="">不设置默认主体</option>';
    for (const [type, label] of Object.entries(types)) {
      const list = state().resources.filter(r => r.type === type && s.resources.includes(r.id) && (!q || (r.name + r.capabilities.join(' ')).toLowerCase().includes(q.toLowerCase())));
      if (list.length) out += `<optgroup label="${label}">${list.map(r => { const errors = issues(r, s); return `<option value="${e(r.id)}"${selected === r.id ? ' selected' : ''}${errors.length ? ' disabled' : ''}>${e(r.name)} / v${r.publishedVersion || '草稿'} / ${errors.length ? e(errors[0]) : '云端演示就绪'}</option>`; }).join('')}</optgroup>`;
    }
    return out;
  }
  const category = goal => /代码|开发|研发|需求|缺陷|功能|实现/.test(goal) ? 'dev' : /分析|数据|指标|收入|周报/.test(goal) ? 'data' : /交付|材料|验收|复核/.test(goal) ? 'delivery' : 'research';
  function match(s, goal, chosen = 'auto') {
    if (chosen !== 'auto') { const r = resource(chosen), errors = r && s.resources.includes(r.id) ? issues(r, s) : ['未在当前空间启用']; return { r: errors.length ? null : r, requested: chosen, reason: errors.length ? errors.join('；') : '用户明确指定 ' + r.name }; }
    const cat = category(goal), words = { dev: /开发|研发|需求|代码|验证|harness/i, data: /数据|指标|分析|周报|收入/, delivery: /交付|报告|复核|验收|材料/, research: /研究|检索|资料|文档|整理/ };
    const pool = state().resources.filter(r => s.resources.includes(r.id) && !issues(r, s).length);
    const score = r => { const p = published(r); return words[cat].test(p.name + p.capabilities.join(' ')) ? (cat === 'dev' && r.type === 'harness' ? 4 : r.type === 'team' ? 3 : 2) : 0; };
    const def = pool.find(r => r.id === s.defaultResource);
    if (def && score(def) > 0) return { r: def, reason: '空间默认主体适合当前目标，按能力标签选用 ' + def.name };
    const best = pool.filter(r => score(r) > 0).sort((a, b) => score(b) - score(a))[0];
    return { r: best || null, reason: best ? '默认主体未设置、不适用或不可用；按目标与能力标签匹配 ' + best.name : '当前空间没有匹配且就绪的主体，任务会保留为未开始' };
  }
  function resourceRows(list, sid = '') {
    const s = sid ? space(sid) : null;
    return `<div class="resource-list">${list.map(r => { const problems = s ? issues(r, s) : !published(r) ? ['尚未发布'] : r.disabled ? ['已停用'] : []; return `<div class="resource-row"><span class="avatar agent">${icon(r.type === 'agent' ? 'agent' : r.type === 'team' ? 'team' : r.type)}</span><div><h2><a href="#/resources/${e(r.id)}">${e(r.name)}</a></h2><p>${e(r.description)}</p><small class="row-note">${e(scopeName(r))} / ${r.publishedVersion ? '已发布 v' + r.publishedVersion : '草稿'}${r.draft ? ' / 有未发布修改' : ''}</small>${problems.length ? `<p class="resource-problem">${e(problems.join('；'))}</p>` : ''}</div><span class="type-label">${types[r.type]}</span><span class="caption">${r.location === 'local' ? '本地待接入' : r.disabled ? '已停用' : '云端演示'}</span><a class="button quiet" href="#/resources/${e(r.id)}">配置详情</a></div>`; }).join('') || notice('没有匹配资源，可新建配置或接入已有主体。')}</div>`;
  }
  function resourcesPage() {
    const id = route().parts[1];
    if (id === 'new' || route().parts[2] === 'edit') return resourceEditor(id === 'new' ? null : resource(id));
    if (id) return resourceDetail(resource(id));
    const type = route().params.get('type') || '', q = route().params.get('q') || '';
    return pageHead('执行资源', '配置可复用的执行主体，再向个人或项目空间开放。', '<a class="button" href="#/resources/new?mode=connect">接入已有主体</a><a class="button primary" href="#/resources/new">新建配置</a>') + `<div class="toolbar"><nav class="filter-tabs" aria-label="执行资源类型">${[['', '全部'], ...Object.entries(types)].map(([v, n]) => `<a class="filter-tab${type === v ? ' active' : ''}" href="#/resources${v ? '?type=' + v : ''}">${n}</a>`).join('')}</nav><form data-form="resource-search" class="resource-search"><label class="visually-hidden" for="resource-query">搜索资源名称或能力</label><input class="input" id="resource-query" name="q" value="${e(q)}" placeholder="搜索名称或能力"><button class="button" type="submit">搜索</button></form></div>${api.stateView() || resourceRows(state().resources.filter(r => (!type || r.type === type) && (!q || (r.name + r.capabilities.join(' ')).includes(q))))}${footer()}`;
  }
  function memberRow(m = {}, type = 'team') {
    const id = 'member-' + Math.random().toString(36).slice(2, 9), agentOnly = type !== 'harness';
    const candidates = state().resources.filter(r => published(r) && (agentOnly ? r.type === 'agent' : ['agent', 'team'].includes(r.type)));
    const choice = candidates.map(r => [r.id, r.name]);
    return `<div class="composition-row" data-member>${select(id + '-agent', type === 'agent' ? '子 Agent' : '执行成员', choice, m.resourceId || choice[0]?.[0], 'data-member-field="resourceId"')}${input(id + '-role', type === 'harness' ? '阶段角色（N1–N5）' : '职责 / 角色', m.role || '')}${input(id + '-trigger', '委派时机', m.trigger || '需要该角色能力时')}${input(id + '-input', '传入上下文', m.input || '仅任务与当前空间已授权资料')}${input(id + '-output', '预期输出', m.output || '结论与来源证据')}${select(id + '-depends', '前置成员（可选）', [['', '无前置依赖'], ...choice], m.dependsOn || '', 'data-member-field="dependsOn"')}<p class="caption member-ref">引用具体 Agent 配置；向项目开放时仍需检查成员授权。</p>${button('移除此成员', 'wb-remove-member', { quiet: true })}</div>`;
  }
  function fields(c, r, connect) {
    const externalLocked = r?.management === 'external';
    let html = `<div class="form-grid">${select('config-location', '执行环境', [['cloud', '云端'], ['local', '本地（下一阶段）']], c.location)}${select('config-connection', '连接就绪状态（演示）', [['ready', '演示就绪'], ['offline', '未就绪']], c.connection)}</div>`;
    html += `<fieldset class="plain-fieldset"${externalLocked ? ' disabled' : ''}>${externalLocked ? notice('下列接入字段由外部 Runtime 维护，在此只读；角色映射与空间授权可在 Cimi Work 管理。') : ''}${input('config-runtime', 'Runtime / 适配器引用', c.runtime, '只保存引用，不在此保存凭据。', true)}${connect || ['matrix', 'harness'].includes(c.type) ? input('config-external', '已有主体的外部标识', c.externalId, '例如已注册的 Agent ID、Matrix 房间或 Harness 标识。', true) : ''}`;
    if (c.type === 'agent') html += `${text('config-prompt', '职责与指令', c.prompt, '', true)}${input('config-model', '模型 / 网关引用', c.model, '', true)}${input('config-skills', 'Skills 引用', c.skills.join('，'), '使用逗号分隔，不复制外部能力实现。')}`;
    html += `${input('config-tools', '工具与 MCP 引用', c.tools.join('，'), '演示标识：search、data、files、notify；项目分别授权。')}${select('config-knowledge', '知识使用范围', [['space', '仅当前任务和所属空间授权资料'], ['private', '仅个人私有知识（不可用于项目）']], c.knowledge)}</fieldset>`;
    if (c.type === 'team') html += `<div class="form-grid">${select('config-coordinator', '协调者（须为 Team 成员）', state().resources.filter(r => r.type === 'agent' && published(r)).map(r => [r.id, r.name]), c.coordinator)}${select('config-workflow', '协作方式', [['parallel', '按依赖并行'], ['sequential', '按成员顺序串行']], c.workflow)}</div>${text('config-aggregation', '结果汇总规则', c.aggregation, '', true)}`;
    if (c.type === 'harness') html += `${text('config-parameters', 'Harness 开放参数', c.parameters, '仅配置适配器公开的参数，不编辑内部编排。')}${text('config-gates', '阶段门禁与交付规则', c.gates)}${select('config-acceptance', 'Harness 验收策略', [['inherit', '继承空间策略'], ['manual', '本 Harness 强制人工'], ['auto', '显式启用 Harness 自动验收（演示）']], c.acceptanceMode || 'inherit')}<label class="check-option"><input type="checkbox" name="config-rule-sources"${c.ruleSources ? ' checked' : ''}><span>Harness 自动规则还要求实际来源证据</span></label><p class="helper">成果存在、必需子工作完成和所选渠道就绪始终必需。Task 强制人工优先。</p>`;
    html += `<section class="composition-section"><div class="section-head"><h2>${c.type === 'agent' ? '子 Agent 委派配置' : c.type === 'harness' ? '阶段执行角色' : c.type === 'matrix' ? 'Matrix 成员映射' : 'Team 成员与分工'}</h2>${button('添加成员', 'wb-add-member', { icon: 'plus' })}</div><p class="caption">引用已发布的具体主体。配置成员仅表示可委派关系，Task 中会记录实际派发。</p><div id="composition-members">${links(c).map(m => memberRow(m, c.type)).join('')}</div></section>${text('config-limit', '委派限制', c.limit)}`;
    return html;
  }
  function resourceEditor(r) {
    if (r && !canEdit(r)) return pageHead('无配置编辑权限', '可使用资源不代表可以编辑资源配置。');
    const connect = r ? r.management === 'external' : route().params.get('mode') === 'connect', draft = r?.draft;
    const c = clone(draft?.config || config(r) || defaultConfig('agent'));
    return `<a class="text-button" href="#/resources${r ? '/' + e(r.id) : ''}">${icon('back', true)}返回资源</a>${pageHead(r ? '编辑配置草稿' : connect ? '接入已有主体' : '新建执行资源', '保存草稿后检查并发布；不会覆盖已有任务的配置。')}<form class="resource-editor" data-form="wb-resource" data-id="${e(r?.id || '')}" data-connect="${connect}"><div class="resource-editor-main"><section>${input('resource-name', '名称', draft?.name || r?.name || '', '', true)}${text('resource-description', '用途与能力说明', draft?.description || r?.description || '', '', true)}<div class="form-grid">${select('resource-type', '主体类型', Object.entries(types), c.type, `${r ? 'disabled' : ''} data-wb-control="type"`)}${select('resource-origin', '资源归属', state().spaces.map(s => [s.id, s.name + (s.private ? '（私有）' : '（项目共享）')]), r?.originSpace || route().params.get('space') || 'personal', r ? 'disabled' : '')}</div>${input('resource-capabilities', '能力标签', (draft?.capabilities || r?.capabilities || []).join('，'), '自动匹配依据；例如研究、数据分析、研发、交付。', true)}</section><section id="resource-config-fields">${fields(c, r, connect)}</section><p class="helper error" data-feedback role="status" tabindex="-1"></p><div class="form-actions"><button class="button primary" type="submit">保存草稿</button><a class="button quiet" href="#/resources${r ? '/' + e(r.id) : ''}">取消</a></div></div><aside class="editor-guide"><h2>配置的生效范围</h2><p>草稿仅供编辑。发布后用于新的任务指派。</p><p>已有 Task 和 Run 保留实际使用的配置版本。采用新版本需明确重新绑定。</p><p>${connect ? '接入字段保存外部引用，原型不会连接或读取真实 Runtime。' : '新建配置由已有 Runtime 承载，原型仅模拟配置管理。'}</p><p>个人主体向项目开放时，不开放个人知识和凭据。</p></aside></form>${footer(false)}`;
  }
  function configSummary(c) {
    return `<dl class="definition-list"><dt>运行平台</dt><dd>${e(c.runtime)}</dd><dt>环境 / 连接</dt><dd>${c.location === 'cloud' ? '云端' : '本地'} / ${c.connection === 'ready' ? '演示就绪' : '未就绪'}</dd><dt>工具引用</dt><dd>${e(c.tools.join('、') || '无')}</dd><dt>知识范围</dt><dd>${c.knowledge === 'private' ? '个人私有知识' : '当前 Task 与空间授权资料'}</dd>${c.type === 'agent' ? `<dt>模型 / Skills</dt><dd>${e(c.model)} / ${e(c.skills.join('、') || '未配置')}</dd><dt>职责指令</dt><dd>${e(c.prompt)}</dd>` : ''}${c.externalId ? `<dt>外部标识</dt><dd>${e(c.externalId)}</dd>` : ''}${c.type === 'team' ? `<dt>协调与汇总</dt><dd>${e(resource(c.coordinator)?.name)} / ${c.workflow === 'sequential' ? '串行' : '按依赖并行'}<br>${e(c.aggregation)}</dd>` : ''}${c.type === 'harness' ? `<dt>参数与门禁</dt><dd>${e(c.parameters || '采用适配器默认')}<br>${e(c.gates)}</dd>` : ''}<dt>委派限制</dt><dd>${e(c.limit)}</dd></dl>${links(c).length ? `<div class="composition-preview section-gap"><h3>${c.type === 'agent' ? '可委派子 Agent' : '配置成员与角色'}</h3>${links(c).map(m => `<div class="source-row">${icon('agent')}<div><h3><a href="#/resources/${e(m.resourceId)}">${e(resource(m.resourceId)?.name || '缺失主体')}</a></h3><p>${e(m.role)} / ${e(m.trigger)}<br>输入：${e(m.input)}<br>输出：${e(m.output)}</p><p class="caption">${m.dependsOn ? '依赖：' + e(resource(m.dependsOn)?.name) : '无前置成员'}</p></div></div>`).join('')}</div>` : ''}`;
  }
  function managementFields(r, manager) {
    const users = [...new Set(state().spaces.flatMap(s => s.members))];
    return `<h3 class="section-gap">配置管理权限</h3><p class="caption">所有者：${e(r.owner)}。使用权由上方空间授权控制，以下权限分别授予。</p>${[['editors', '可编辑配置草稿'], ['publishers', '可发布版本与停用']].map(([key, title]) => `<fieldset class="rule-options"><legend>${title}</legend>${users.map(name => `<label class="check-option"><input type="checkbox" name="${key}" value="${e(name)}"${r[key].includes(name) ? ' checked' : ''}${!manager || name === r.owner ? ' disabled' : ''}><span>${e(name)}</span></label>`).join('')}</fieldset>`).join('')}`;
  }
  function resourceActions(r) {
    return `${canEdit(r) ? `<a class="button" href="#/resources/${e(r.id)}/edit">编辑草稿</a>` : ''}${canPublish(r) ? button(r.disabled ? '启用资源' : '停用资源', 'wb-toggle-ask', { id: r.id }) : ''}${published(r) && !r.disabled ? button('用于新任务', 'wb-use', { id: r.id, primary: true }) : ''}`;
  }
  function resourceDetail(r) {
    if (!r) return pageHead('资源不存在', '可能已重置演示数据。');
    const tab = route().params.get('tab') || 'configuration', p = published(r), manager = canManage(r);
    let content = '';
    if (tab === 'access') content = `<form class="form-page" data-form="wb-access" data-id="${e(r.id)}"><h2>空间使用授权</h2><p class="caption">归属：${e(scopeName(r))}。管理人：${e(r.managers.join('、'))}；当前用户${manager ? '可管理' : '仅可使用'}。开放主体不会开放个人资料或密钥。</p>${state().spaces.map(s => `<label class="check-option"><input type="checkbox" name="grants" value="${e(s.id)}"${r.grants.includes(s.id) ? ' checked' : ''}${!manager || s.id === r.originSpace ? ' disabled' : ''}><span>${e(s.name)}<small>${s.private ? '个人使用范围' : '明确允许项目使用；项目仍需启用该主体，依赖另行检查'}</small></span></label>`).join('')}${managementFields(r, manager)}<p class="helper" data-feedback role="status" tabindex="-1"></p>${manager ? '<button class="button primary" type="submit">保存空间授权</button>' : ''}</form>`;
    else if (tab === 'versions') content = `<section><h2>已发布版本</h2><p class="caption">历史版本不可编辑。已有 Task 与 Run 使用自己的快照。</p>${r.versions.slice().reverse().map(v => `<details><summary>v${v.version} ${e(v.name)} / ${e(v.actor)} / ${e(v.time)}</summary>${configSummary(v.config)}</details>`).join('') || notice('尚未发布配置。')}</section>`;
    else content = `${r.draft ? `<section class="draft-banner"><div><h2>未发布草稿</h2><p>${e(r.draft.name)} / 将成为 v${r.publishedVersion + 1}；已有绑定保持不变。</p></div><div class="actions">${button('检查并发布', 'wb-publish', { id: r.id, primary: true })}${button('放弃草稿', 'wb-discard-ask', { id: r.id, quiet: true })}</div></section>` : ''}${p ? configSummary(p.config) : notice('配置尚未发布，不能被任务执行。')}<section class="section-gap"><h2>空间就绪检查</h2><p class="caption">检查为本地模拟，不会连接实际 Runtime 或权限服务。</p>${state().spaces.filter(s => r.grants.includes(s.id)).map(s => { const problems = issues(r, s); return `<div class="readiness-row"><div><strong>${e(s.name)}</strong><p class="caption">${problems.length ? e(problems.join('；')) : '依赖、工具与空间范围检查通过（演示）'}</p></div><span class="status ${problems.length ? 'blocked' : 'completed'}">${problems.length ? '待配置' : '就绪'}</span></div>`; }).join('')}</section>`;
    return `<a class="text-button" href="#/resources">${icon('back', true)}执行资源目录</a>${pageHead(r.name, `${types[r.type]} / ${scopeName(r)} / ${r.management === 'external' ? '外部维护接入字段' : 'Cimi Work 管理配置'}`, resourceActions(r))}<nav class="page-tabs" aria-label="资源详情">${[['configuration', '配置与就绪'], ['versions', '发布版本'], ['access', '空间授权']].map(([v, n]) => `<a class="page-tab${tab === v ? ' active' : ''}" href="#/resources/${e(r.id)}?tab=${v}">${n}</a>`).join('')}</nav><div class="resource-detail" data-resource="${e(r.id)}">${content}</div>${footer(false)}`;
  }
  function readConfig(form, previous = null) {
    const f = new FormData(form), type = f.get('resource-type') || previous?.type || 'agent', c = clone(previous || defaultConfig(type)); c.type = type;
    const val = (key, fallback = '') => f.has(key) ? String(f.get(key)).trim() : fallback;
    c.location = val('config-location', c.location); c.connection = val('config-connection', c.connection);
    c.runtime = val('config-runtime', c.runtime); c.externalId = val('config-external', c.externalId); c.prompt = val('config-prompt', c.prompt); c.model = val('config-model', c.model); c.skills = f.has('config-skills') ? csv(f.get('config-skills')) : c.skills; c.tools = f.has('config-tools') ? csv(f.get('config-tools')) : c.tools; c.knowledge = val('config-knowledge', c.knowledge);
    c.coordinator = val('config-coordinator', c.coordinator); c.workflow = val('config-workflow', c.workflow); c.aggregation = val('config-aggregation', c.aggregation); c.parameters = val('config-parameters', c.parameters); c.gates = val('config-gates', c.gates); c.limit = val('config-limit', c.limit);
    if (type === 'harness') { c.acceptanceMode = val('config-acceptance', 'inherit'); c.ruleSources = f.has('config-rule-sources'); }
    const refs = [...form.querySelectorAll('[data-member]')].map(row => { const fields = row.querySelectorAll('input'); return { resourceId: row.querySelector('select').value, role: fields[0].value.trim(), trigger: fields[1].value.trim(), input: fields[2].value.trim(), output: fields[3].value.trim(), dependsOn: row.querySelector('[data-member-field="dependsOn"]').value }; });
    c.delegates = type === 'agent' ? refs : []; c.members = ['team', 'matrix'].includes(type) ? refs : []; c.roles = type === 'harness' ? refs : [];
    return c;
  }
  function configureDialog(s) {
    showDialog('配置空间执行资源', s.name + '：可启用多个主体；顶层启用与依赖授权分别检查。', `<form data-form="wb-bind" data-id="${e(s.id)}"><div class="section-head"><h3>可直接指派的主体</h3><a class="text-button" href="#/resources/new?space=${e(s.id)}" data-close-dialog="true">新建资源配置</a></div>${state().resources.map(r => `<label class="check-option"><input type="checkbox" name="resources" value="${e(r.id)}"${s.resources.includes(r.id) ? ' checked' : ''}${!r.grants.includes(s.id) ? ' disabled' : ''}><span>${e(r.name)}<small>${types[r.type]} / ${r.grants.includes(s.id) ? e(issues(r, s).join('；') || '已获得主体及依赖使用权') : '未向此空间开放，请在资源详情中授权'}</small></span></label>`).join('')}<details><summary>项目工具授权（演示）</summary>${Object.entries(toolNames).map(([id, label]) => `<label class="check-option"><input type="checkbox" name="tools" value="${id}"${s.allowedTools.includes(id) ? ' checked' : ''}><span>${label}</span></label>`).join('')}</details><p class="helper error" data-feedback role="status" tabindex="-1"></p><div class="dialog-actions"><button class="button" type="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">检查并保存资源</button></div></form>`, '', true);
  }
  function settingsContent(s) {
    return `<form class="form-page" data-form="wb-settings" data-id="${e(s.id)}">${input('space-name', '空间名称', s.name, '', true)}${text('space-description', '空间说明', s.description)}<div class="form-section"><label for="space-resource">默认执行主体（可选）</label><select id="space-resource" name="resource">${options(s, s.defaultResource, false)}</select><p class="helper">先判断默认主体是否适合目标，不适合时从其他就绪主体匹配。已有任务绑定不变。</p></div><label class="check-option"><input type="checkbox" name="autoAccept"${s.autoAccept ? ' checked' : ''}><span>显式启用自动验收演示<small>Task 可强制人工；无法判断时转人工。</small></span></label><fieldset class="rule-options"><legend>空间验收规则 v${s.rule.version}</legend><label class="check-option"><input type="checkbox" name="rule-artifact" checked disabled><span>存在当前提交成果（必需）</span></label><label class="check-option"><input type="checkbox" name="rule-subtasks" checked disabled><span>必需子工作完成（必需）</span></label><label class="check-option"><input type="checkbox" name="rule-sources"${s.rule.sources ? ' checked' : ''}><span>具有实际使用的来源证据</span></label></fieldset>${notice('规则为本地模拟，不批准真实业务动作；修改规则保留版本，评估结果与成果版本关联。')}<p class="helper" data-feedback role="status" tabindex="-1"></p><div class="form-actions"><button class="button primary" type="submit">保存本地设置</button></div></form>`;
  }
  function newTaskPage() {
    const s = space(api.currentSpace()) || space('personal'), chosen = route().params.get('resource') || 'auto';
    return `<div class="form-page">${pageHead('把目标交给合适的协作者', '先描述目标，再决定具体交给谁。Agent 会在授权范围内主动查找上下文。')}<form data-form="create-task" novalidate>${select('new-space', '所属空间', state().spaces.map(x => [x.id, x.name + (x.private ? '（私有）' : '')]), s.id, 'data-control="new-space"')}${text('task-goal', '任务目标（必填）', '', '', true)}<p class="helper" id="goal-help">一句目标即可开始，复杂要求也可以直接写在这里。</p><section class="assignment-picker section-gap"><h2>执行主体</h2><label class="visually-hidden" for="resource-search">搜索可用主体</label><input class="input" id="resource-search" type="search" placeholder="搜索当前空间的名称或能力"><label class="visually-hidden" for="new-resource">具体执行主体</label><select id="new-resource" name="resource" data-wb-control="task-resource">${options(s, chosen)}</select><p class="helper" id="assignment-preview">填写目标后显示匹配依据。自动匹配采用本地能力标签规则演示。</p><a class="text-button" href="#/space/${e(s.id)}?tab=members">管理空间可用资源</a></section><div class="form-section section-gap"><span class="field-label">相关材料（可选）</span><div class="file-control"><label class="button" for="attachments">${icon('attach')}添加本地文件</label><input class="visually-hidden" type="file" id="attachments" name="attachments" multiple><span class="caption">仅在当前浏览器使用，不上传</span></div><ul class="attachment-list" id="attachment-list"></ul></div><details><summary>交付、验收人与高级设置</summary>${text('new-acceptance', '验收标准')}<div class="form-grid">${select('new-owner', '负责人', s.members.map(m => [m, m]), 'Hector')}${select('new-acceptor', '验收人', s.members.map(m => [m, m]), 'Hector')}${select('new-artifact', '成果类型', [['markdown', 'Markdown 文档'], ['report', '分析报告'], ['checklist', '交付清单']], 'markdown')}${input('new-target', '报送对象（可选）', '', '不自动授予 Task 或资料访问权。')}${select('new-channel', '交付渠道', [['none', '仅在 Task 交付'], ['internal', '站内待办（演示）'], ['external', '外部通知（未接入）']], 'none')}<div class="form-section"><label for="new-deadline">期望完成日期</label><input class="input" type="date" id="new-deadline" name="deadline"></div></div><label class="check-option"><input type="checkbox" name="forceManual"><span>本 Task 强制人工验收，覆盖空间自动规则</span></label></details><div class="notice" id="new-space-notice">${icon(s.private ? 'lock' : 'folder')}<span>${s.private ? '当前目标与材料保存在个人空间，默认仅你可见。' : '当前任务属于 ' + e(s.name) + '，使用该项目已开放的上下文。'} 执行与成果为原型演示。</span></div><div class="form-actions section-gap"><button type="submit" class="button primary">${icon('plus')}创建任务</button><a class="button quiet" href="#/space/${e(s.id)}">取消</a></div></form></div>${footer(false)}`;
  }
  function schedule(t) {
    const bound = t.binding; if (!bound) return;
    const refs = bound.members || [], phaseRefs = bound.type === 'harness' ? refs.filter(m => m.role === t.phase) : refs;
    for (const [i, m] of phaseRefs.entries()) {
      const key = `${bound.id}-${bound.version}-${m.role}-${m.resourceId}`;
      if (t.subtasks.some(st => st.configKey === key && !st.superseded)) continue;
      let dep = m.dependsOn;
      if (!dep && bound.config.workflow === 'sequential' && i > 0) dep = phaseRefs[i - 1].resourceId;
      const previous = t.subtasks.find(st => st.resourceId === dep && !st.superseded);
      t.subtasks.push({ id: 'work-' + t.id + '-' + t.subtasks.length, resourceId: m.resourceId, configKey: key, title: m.role, owner: m.snapshot?.name || resource(m.resourceId)?.name, status: 'waiting', required: true, input: m.input, output: m.output, dependsOn: previous ? [previous.id] : [], origin: 'configuration', assigned: false, snapshot: clone(m.snapshot) });
    }
  }
  function prepareRun(t, run) { run.snapshot = clone(t.binding || snapshot(resource(t.resource))); run.startedAt = now(); run.ruleVersion = space(t.space).rule.version; const coordinator = run.snapshot?.members.find(m => m.resourceId === run.snapshot.config.coordinator)?.snapshot?.name; if (coordinator && !t.participants.includes(coordinator)) t.participants.push(coordinator); schedule(t); }
  function progress(t, complete = false) {
    schedule(t);
    for (let pass = 0; pass < (complete ? t.subtasks.length + 1 : 1); pass++) {
      for (const st of t.subtasks) {
        if (st.superseded || st.human || st.origin === 'seed' || st.status === 'completed') continue;
        if (st.dependsOn.some(id => t.subtasks.find(x => x.id === id)?.status !== 'completed')) continue;
        const errors = issues(resource(st.resourceId), space(t.space), new Set(), st.snapshot);
        if (errors.length) { st.status = 'blocked'; continue; }
        st.assigned = true; if (!t.participants.includes(st.owner)) t.participants.push(st.owner); st.status = complete ? 'completed' : st.status === 'running' ? 'completed' : 'running';
        if (st.status === 'completed') st.result = '演示结果：' + (st.output || '已按职责提交结论与来源');
      }
    }
  }
  function createTask(values, attachments = []) {
    const s = space(values.space) || space('personal'), picked = match(s, values.goal, values.resource || 'auto'), r = picked.r;
    const id = nextTaskId(), harness = r?.type === 'harness';
    const t = { id, title: values.goal.slice(0, 30), goal: values.goal, space: s.id, resource: r?.id || '', requestedResource: picked.requested || '', assignmentReason: picked.reason, binding: r ? snapshot(r) : null, status: r ? harness ? 'confirm' : 'running' : 'waiting', stage: 0, phase: harness ? 'N1' : null, owner: values.owner || 'Hector', acceptor: s.members.includes(values.acceptor) ? values.acceptor : 'Hector', acceptance: values.acceptance || '结果符合目标，保留关键来源，成果可查看并能够验收。', artifactType: values.artifactType || 'markdown', forceManual: !!values.forceManual, deliveryConfig: { target: values.deliveryTarget || '', channel: values.deliveryChannel || 'none' }, updated: now(), created: '2026-11-02', deadline: values.deadline || '', participants: [...new Set(['Hector', values.owner || 'Hector', ...(r ? [r.name] : [])])], sources: [], retrieval: [], attachments: clone(attachments), artifacts: [], subtasks: [], runs: [], events: [], decisions: [], phaseHistory: [], assignmentHistory: [], version: 0, humanAction: harness ? scopeAction() : null };
    if (r) startRun(t, picked.reason + '。开始在授权范围内查找上下文。');
    t.events.push({ actor: 'Hector', kind: 'human', text: '创建 Task：' + picked.reason + '（本地规则演示）。', time: now() }); state().tasks.unshift(t); persist(); return t;
  }
  const scopeAction = () => ({ kind: 'scope', title: '确认本轮工作的范围', question: '请确认目标边界，Harness 将在同一 Task 组织各阶段工作。', options: ['按当前目标与空间范围推进', '先补充边界，再扩大执行范围'], person: 'Hector' });
  function guard(t) {
    if (t.pendingAssignment) { t.status = 'blocked'; t.blockReason = '等待旧执行停止确认，请在改派入口完成交接'; saveTask(t, t.blockReason); render(); return false; }
    const s = space(t.space), r = resource(t.resource), errors = r && s.resources.includes(r.id) ? issues(r, s, new Set(), t.binding) : ['当前主体未在空间启用'];
    if (!errors.length) return true;
    t.status = t.resource ? 'blocked' : 'waiting'; t.blockReason = errors.join('；'); saveTask(t, '执行前检查未通过：' + t.blockReason); render(); return false;
  }
  function discover(t) {
    const s = space(t.space), docs = s.docs, cat = category(t.goal), pattern = cat === 'data' ? /数据|指标|口径|分析/ : cat === 'dev' ? /需求|研发|规则|仓库/ : cat === 'delivery' ? /交付|历史|规则|材料/ : /研究|笔记|资料|清单|文档/;
    const relevant = docs.filter(d => pattern.test(d.title + d.kind));
    for (const d of relevant.slice(0, 2)) {
      const old = t.retrieval.find(x => x.id === d.id); if (old?.status === 'read') continue;
      const record = { id: d.id, status: d.access === 'denied' ? 'denied' : 'read', actor: t.binding?.name, runId: t.runs.at(-1)?.id, purpose: '按目标与资料标签匹配（演示）', version: d.version || 1 };
      if (old) Object.assign(old, record); else t.retrieval.push(record);
      if (record.status === 'read' && !t.sources.includes(d.id)) t.sources.push(d.id);
    }
    t.sources = t.sources.filter(id => docs.some(d => d.id === id && d.access !== 'denied'));
  }
  function collaboration(t) {
    return `<section class="paper-section"><div class="section-head"><h2>实际协作与子工作</h2>${button('委派工作', 'invite', { id: t.id, icon: 'plus', disabled: ['completed', 'cancelled'].includes(t.status) })}</div><p class="caption">主导：${e(t.binding?.name || '待指派')}。配置关系表示可调用能力；以下分别记录计划、派发与结果。</p>${t.subtasks.filter(st => !st.superseded).map(st => `<div class="work-row"><div><h3>${e(st.title)}</h3><p class="caption">${e(st.owner)} / ${st.required ? '必需工作' : '可选工作'} / ${st.assigned || st.origin === 'seed' || st.human ? '已派发' : '计划待派发'}${st.snapshot ? ' / v' + st.snapshot.version : ''}</p><p class="caption">输入：${e(st.input || '当前任务已授权上下文')}<br>预期：${e(st.output || '明确答复或交付证据')}</p>${st.dependsOn.length ? `<p class="caption">依赖：${st.dependsOn.map(id => e(t.subtasks.find(x => x.id === id)?.title || id)).join('、')}</p>` : ''}${st.result ? `<p class="work-result">${e(st.result)}</p>` : ''}</div><div>${status(st.status)}${!st.human && st.origin !== 'seed' && !['completed', 'cancelled'].includes(t.status) && st.status !== 'completed' ? button(st.status === 'running' ? '完成演示' : '派发演示', 'wb-work', { id: t.id + ':' + st.id, quiet: true }) : ''}</div></div>`).join('') || '<p class="caption section-gap">尚未产生子工作。单 Agent 可以直接完成，也可以根据配置或明确委派邀请协作者。</p>'}${t.subtasks.some(st => st.superseded) ? '<p class="caption section-gap">旧指派的子工作已结束并留在执行历史，不再参与当前成果验收。</p>' : ''}</section>`;
  }
  function assignmentPanel(t) {
    const s = space(t.space), latest = resource(t.resource)?.publishedVersion, outdated = t.binding && latest > t.binding.version;
    return `<section class="assignment-strip section-gap"><div><h2>主导执行主体</h2><strong>${e(t.binding?.name || '待指派')}${t.binding ? ' / v' + t.binding.version : ''}</strong><p class="caption">${e(t.assignmentReason || '初始演示任务已绑定具体主体')}${outdated ? '；已发布 v' + latest + '，本 Task 继续使用已绑定版本' : ''}</p>${t.blockReason ? `<p class="resource-problem">${e(t.blockReason)}</p>` : ''}</div><div class="actions">${t.resource ? `<a class="button quiet" href="#/resources/${e(t.resource)}">查看资源</a>` : ''}${button(t.resource ? '改派 / 采用新版本' : '选择执行主体', 'wb-reassign', { id: t.id, disabled: ['completed', 'cancelled'].includes(t.status) })}${button('交付与验收', 'wb-delivery', { id: t.id })}</div></section>${t.assignmentHistory.length ? `<details><summary>改派与交接记录（${t.assignmentHistory.length}）</summary>${t.assignmentHistory.map(h => `<p class="caption">${e(h.from || '待指派')} → ${e(h.to)} / ${e(h.time)}<br>${e(h.reason)}；${e(h.result)}</p>`).join('')}</details>` : ''}`;
  }
  function contextPanel(t) {
    const s = space(t.space), read = t.retrieval.filter(x => x.status === 'read' && s.docs.find(d => d.id === x.id)?.access !== 'denied'), denied = t.retrieval.filter(x => x.status === 'denied');
    return `<section class="paper-section"><h2>上下文与访问范围</h2><p class="caption">空间：${e(s.name)}。可检索不等于已读取；原型按目标标签模拟检索，不访问实际业务系统。</p><h3 class="section-gap">实际使用的来源</h3>${read.map(x => { const d = s.docs.find(d => d.id === x.id); return d ? `<div class="source-row">${icon('book')}<div><h3>${e(d.title)}</h3><p>${e(d.excerpt)}</p><p class="caption">${e(x.actor)} / ${e(x.runId || '初始 Run')} / 来源 v${x.version}<br>${e(x.purpose)}</p></div>${button('查看', 'source', { id: d.id, quiet: true })}</div>` : ''; }).join('') || notice('尚未实际使用来源。推进演示后，仅将相关且获准读取的资料记入这里。')}<h3 class="section-gap">可检索资料范围</h3>${s.docs.map(d => `<div class="readiness-row"><div><strong class="small-text">${e(d.title)}</strong><p class="caption">${d.access === 'denied' ? '待授权，不展示正文' : read.some(x => x.id === d.id) ? '已用于本 Task' : '允许检索，尚未使用'}</p></div>${button(d.access === 'denied' ? (t.accessRequests?.includes(d.id) ? '查看授权待办' : '申请授权') : '演示撤权', d.access === 'denied' && t.accessRequests?.includes(d.id) ? 'wb-source-process' : 'wb-source-access', { id: t.id + ':' + d.id, quiet: true })}</div>`).join('') || notice('空间还没有资料，可在知识与连接中补充。')}<h3 class="section-gap">访问失败 / 待授权</h3>${denied.length ? denied.map(x => `<p class="caption">${e(s.docs.find(d => d.id === x.id)?.title || '受限资料')}：读取被拒绝，未取得正文。</p>`).join('') : '<p class="caption">暂无已记录的访问失败。</p>'}<h3 class="section-gap">用户附加材料</h3>${t.attachments?.map(f => `<p class="caption">${e(f.name)} / 用户主动提供，仅本地保存</p>`).join('') || '<p class="caption">没有附加材料。</p>'}</section>`;
  }
  function runsPanel(t) {
    return `<section class="paper-section"><h2>执行记录与配置快照</h2><p class="caption">历史 Run 不随资源编辑改变。快照不是持续执行的授权。</p>${t.runs.slice().reverse().map(r => `<details open><summary>${e(r.id)} / ${e(r.status)}</summary><p>${e(r.detail)}</p><p class="caption">${e(r.snapshot?.name || r.mechanism)} / 配置 v${r.snapshot?.version || '未记录'} / ${e(r.startedAt || '初始演示')}</p>${r.snapshot ? `<details><summary>查看本次不可变配置快照</summary>${configSummary(r.snapshot.config)}${r.snapshot.members?.length ? `<p class="caption">成员版本：${r.snapshot.members.map(m => e(m.snapshot?.name || m.resourceId) + ' v' + (m.snapshot?.version || '?')).join('；')}</p>` : ''}</details>` : ''}${r.workSnapshot?.length ? `<details><summary>交接前的子工作记录</summary>${r.workSnapshot.map(st => `<p class="caption">${e(st.owner)}：${e(st.title)} / ${e(st.status)} / ${e(st.result || '未提交结果')}</p>`).join('')}</details>` : ''}</details>`).join('') || notice('尚未创建 Run，请先选择就绪的执行主体。')}</section>`;
  }
  function reassignDialog(t) {
    const s = space(t.space);
    showDialog('改派与配置交接', '保留原 Task、目标、决定和已有成果。新指派使用新 Run。', `<form data-form="wb-reassign" data-id="${e(t.id)}"><div class="form-section"><label for="reassign-resource">新的执行主体 / 已发布版本</label><select id="reassign-resource" name="resource">${options(s, (t.pendingAssignment?.resourceId || t.resource), false)}</select></div>${text('reassign-reason', '改派原因', t.pendingAssignment?.reason || '', '', true)}${select('handoff-status', '旧执行停止确认（演示）', [['confirmed', '模拟已收到旧执行停止确认'], ['pending', '模拟尚未收到停止确认']], 'confirmed')}${notice('交接保留目标、关键决定、已有来源和成果版本。旧子工作保留为历史；当前待确认事项保留，过期验收不沿用。')}<p class="helper error" data-feedback role="status" tabindex="-1"></p><div class="dialog-actions"><button class="button" type="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">确认改派</button></div></form>`);
  }
  function deliveryDialog(t) {
    const s = space(t.space), c = t.binding?.config, custom = t.binding?.type === 'harness' && ['manual', 'auto'].includes(c.acceptanceMode);
    const ruleSource = custom ? 'Harness' : '空间', ruleVersion = custom ? t.binding.version : s.rule.version, enabled = custom ? c.acceptanceMode === 'auto' : s.autoAccept, requireSources = custom ? c.ruleSources : s.rule.sources;
    showDialog('交付与验收配置', '配置报送对象不自动授予资料权限。未接入的渠道不会实际发送。', `<form data-form="wb-delivery" data-id="${e(t.id)}">${select('delivery-acceptor', '验收人', s.members.map(m => [m, m]), t.acceptor)}${select('delivery-artifact', '成果类型', [['markdown', 'Markdown 文档'], ['report', '分析报告'], ['checklist', '交付清单']], t.artifactType)}${input('delivery-target', '报送对象', t.deliveryConfig.target)}${select('delivery-channel', '交付渠道', [['none', '仅在 Task 交付'], ['internal', '站内待办（演示）'], ['external', '外部通知（未接入）']], t.deliveryConfig.channel)}<label class="check-option"><input type="checkbox" name="forceManual"${t.forceManual ? ' checked' : ''}><span>本 Task 强制人工验收</span></label><h3>${e(ruleSource)}规则 v${ruleVersion}：${enabled ? '已显式启用' : '人工验收'}</h3><p class="caption">成果存在、必需子工作完成、所选渠道就绪${requireSources ? '、实际来源证据存在' : ''}。Task 强制人工优先，证据不足转人工。</p>${t.ruleEvaluation ? `<p class="caption">最近评估：成果 v${t.ruleEvaluation.artifactVersion} / 规则 v${t.ruleEvaluation.ruleVersion} / ${e(t.ruleEvaluation.result)}</p>` : ''}${t.acceptanceRecord ? `<p class="caption">当前已验收成果 v${t.acceptanceRecord.version}；此处修改仅对下一轮交付生效。</p>` : ''}<p class="helper" data-feedback role="status" tabindex="-1"></p><div class="dialog-actions"><button class="button" type="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">保存交付配置</button></div></form>`);
  }
  function canAccept(t, auto = false) {
    if (!t.artifacts.some(a => a.version === t.version) || t.subtasks.some(st => st.required && !st.superseded && st.status !== 'completed')) { announceProblem('尚有未完成的必需子工作或缺少当前成果，请先处理。'); return false; }
    if (t.currentSubmission?.deliveryConfig.channel === 'external') { announceProblem('所选外部报送渠道未接入，尚未完成交付。可在下一轮修改中调整交付配置。'); return false; }
    if (auto && ((t.currentSubmission?.forceManual ?? t.forceManual) || t.ruleEvaluation?.result !== '通过')) return false;
    return true;
  }
  function acceptanceLabel(t) {
    const c = t.binding?.type === 'harness' ? t.binding.config : null;
    if (t.currentSubmission?.forceManual || t.forceManual || c?.acceptanceMode === 'manual') return '本任务人工验收';
    if (c?.acceptanceMode === 'auto') return 'Harness 自动规则（演示）';
    return space(t.space).autoAccept ? '空间自动规则（演示）' : '默认人工验收';
  }
  function deliveryPanel(t) {
    const submitted = t.currentSubmission, channels = { none: 'Task 成果区', internal: '站内待办（演示）', external: '外部通知（未接入）' };
    return `<section class="paper-section"><div class="section-head"><h2>交付与验收依据</h2>${button('配置下一轮交付', 'wb-delivery', { id: t.id, quiet: true })}</div><dl class="definition-list"><dt>验收人</dt><dd>${e(submitted?.acceptor || t.acceptor)}（原型模拟该人员处理）</dd><dt>成果类型</dt><dd>${e(({ markdown: 'Markdown 文档', report: '分析报告', checklist: '交付清单' })[submitted?.artifactType || t.artifactType])}</dd><dt>报送对象</dt><dd>${e(submitted?.deliveryConfig.target || t.deliveryConfig.target || '当前 Task')}</dd><dt>渠道 / 状态</dt><dd>${e(channels[submitted?.deliveryConfig.channel || t.deliveryConfig.channel])}<br>${e(t.delivery?.status || '初始演示成果保存在 Task，未发送外部通知')}</dd><dt>验收方式</dt><dd>${e(acceptanceLabel(t))}</dd></dl>${t.ruleEvaluation ? `<h3 class="section-gap">成果 v${t.ruleEvaluation.artifactVersion} / ${e(t.ruleEvaluation.ruleOrigin)}规则 v${t.ruleEvaluation.ruleVersion}</h3>${Object.entries(t.ruleEvaluation.checks).map(([key, passed]) => `<p class="caption">${e(({ artifact: '当前成果存在', subtasks: '必需子工作完成', sources: '来源证据条件', delivery: '交付渠道条件' })[key])}：${passed ? '通过（演示）' : '不满足，需处理'}</p>`).join('')}<p class="caption section-gap">${e(t.ruleEvaluation.result)}。检查通过仍服从人工验收或显式自动策略。</p>` : ''}</section>`;
  }
  function announceProblem(message) { showDialog('需要先处理', '', `<p>${e(message)}</p>`, button('知道了', 'close-dialog')); }
  function finished(t) {
    const s = space(t.space); progress(t, true);
    const hc = t.binding?.type === 'harness' ? t.binding.config : null, harnessRule = hc && hc.acceptanceMode && hc.acceptanceMode !== 'inherit';
    const enabled = harnessRule ? hc.acceptanceMode === 'auto' : s.autoAccept, requireSources = harnessRule ? hc.ruleSources : s.rule.sources;
    t.currentSubmission = { acceptor: t.acceptor, artifactType: t.artifactType, forceManual: t.forceManual, deliveryConfig: clone(t.deliveryConfig), ruleOrigin: harnessRule ? 'Harness' : '空间' };
    const artifact = t.artifacts.at(-1); if (artifact) artifact.deliverySpec = clone(t.currentSubmission);
    t.delivery = { destination: t.deliveryConfig.target || 'Task 成果区', status: t.deliveryConfig.channel === 'external' ? '未发送：渠道未接入' : t.deliveryConfig.channel === 'internal' ? '本地模拟回执' : '已保存在 Task（演示）', text: '没有实际发送外部通知。真实交付需连接已授权渠道。' };
    t.ruleEvaluation = { ruleOrigin: harnessRule ? 'Harness' : '空间', ruleVersion: harnessRule ? t.binding.version : s.rule.version, artifactVersion: t.version, time: now(), checks: { artifact: t.artifacts.some(a => a.version === t.version), subtasks: !t.subtasks.some(st => st.required && !st.superseded && st.status !== 'completed'), sources: !requireSources || t.sources.some(id => s.docs.find(d => d.id === id)?.access !== 'denied'), delivery: t.deliveryConfig.channel !== 'external' }, result: '' };
    t.ruleEvaluation.result = Object.values(t.ruleEvaluation.checks).every(Boolean) ? '通过' : '证据不足，转人工';
    persist(); return enabled && !t.forceManual && t.ruleEvaluation.result === '通过';
  }
  function inviteDialog(t) {
    const s = space(t.space);
    showDialog('邀请协作者', '已有授权的主体可直接委派；人的协作事项明确记录是否阻塞交付。', `<form data-form="wb-invite" data-id="${e(t.id)}"><div class="form-section"><label for="invite-person">参与者</label><select id="invite-person" name="participant"><optgroup label="有权参与的人员">${s.members.map(p => `<option value="person:${e(p)}">${e(p)}</option>`).join('')}</optgroup><optgroup label="已授权且就绪的执行主体">${state().resources.filter(r => s.resources.includes(r.id) && !issues(r, s).length).map(r => `<option value="agent:${e(r.id)}">${e(r.name)} / ${types[r.type]}</option>`).join('')}</optgroup></select></div>${text('invite-goal', '协作目的（必填）', '', '', true)}${input('invite-output', '预期输出', '结论与来源证据')}${select('invite-dependency', '前置子工作', [['', '无前置依赖'], ...t.subtasks.filter(st => !st.superseded).map(st => [st.id, st.title])], '')}<label class="check-option"><input type="checkbox" name="required"><span>此工作必须完成后，Task 才能验收</span></label><p class="caption">不会发送外部消息或扩大资料范围；无前置依赖时可直接派发。</p><p class="helper error" data-feedback role="status" tabindex="-1"></p><div class="dialog-actions"><button class="button" type="button" data-action="close-dialog">取消</button><button class="button primary" type="submit">添加协作事项</button></div></form>`);
  }
  function action(action, id, el) {
    const r = resource(id), t = task(id);
    if (action === 'configure-resources') configureDialog(space(id));
    else if (action === 'resource') go('/resources/' + id);
    else if (action === 'invite') inviteDialog(t);
    else if (action === 'wb-add-member') { const form = el.closest('form'), type = form.querySelector('#resource-type').value; document.getElementById('composition-members').insertAdjacentHTML('beforeend', memberRow({}, type)); }
    else if (action === 'wb-remove-member') el.closest('[data-member]').remove();
    else if (action === 'wb-publish') {
      if (!canPublish(r) || !r.draft) return true;
      const errors = configurationErrors(r, r.draft.config); if (!r.draft.capabilities.length) errors.push('至少填写一个能力标签。');
      if (errors.length) { showDialog('配置检查未通过', '草稿已保留，修改后可以再次发布。', `<ul>${errors.map(x => `<li>${e(x)}</li>`).join('')}</ul>`, '<a class="button" href="#/resources/' + e(id) + '/edit" data-close-dialog="true">修改草稿</a>'); return true; }
      r.publishedVersion++; const v = { ...clone(r.draft), version: r.publishedVersion, actor: 'Hector', time: now() }; r.versions.push(v); r.name = v.name; r.description = v.description; r.capabilities = clone(v.capabilities); r.location = v.config.location; r.available = v.config.connection === 'ready' && v.config.location === 'cloud'; r.type = v.config.type; r.typeName = types[r.type]; delete r.draft; persist(); render();
    }
    else if (action === 'wb-discard-ask') showDialog('放弃未发布草稿？', '已发布版本与已有任务保持不变。', '', button('保留草稿', 'close-dialog') + button('确认放弃', 'wb-discard', { id }));
    else if (action === 'wb-discard') { if (canEdit(r)) { delete r.draft; persist(); closeDialog(); render(); } }
    else if (action === 'wb-toggle-ask') showDialog(r.disabled ? '重新启用资源？' : '停用资源？', '停用后禁止新的调用和恢复；进行中的 Task 下次执行前会检查并显示阻塞。', '', button('取消', 'close-dialog') + button(r.disabled ? '确认启用' : '确认停用', 'wb-toggle', { id }));
    else if (action === 'wb-toggle') { if (canPublish(r)) { r.disabled = !r.disabled; persist(); closeDialog(); render(); } }
    else if (action === 'wb-use' || action === 'use-resource') showDialog('选择目标空间', '只使用所选空间已开放的主体和资料。', `<form data-form="wb-use" data-id="${e(id)}">${select('use-space', '在哪个空间创建任务', state().spaces.filter(s => s.resources.includes(id) && !issues(r, s).length).map(s => [s.id, s.name]), '')}<p class="helper" data-feedback role="status" tabindex="-1"></p><div class="dialog-actions"><button class="button primary" type="submit">继续创建任务</button></div></form>`);
    else if (action === 'wb-reassign') reassignDialog(t);
    else if (action === 'wb-delivery') deliveryDialog(t);
    else if (action === 'wb-work') {
      const split = id.indexOf(':'), workTask = task(id.slice(0, split)), st = workTask?.subtasks.find(x => x.id === id.slice(split + 1)); if (!st || !guard(workTask)) return true;
      if (st.dependsOn.some(dep => workTask.subtasks.find(x => x.id === dep)?.status !== 'completed')) { announceProblem('前置子工作尚未完成，请先处理依赖。'); return true; }
      const errors = issues(resource(st.resourceId), space(workTask.space), new Set(), st.snapshot);
      if (errors.length) { announceProblem(errors.join('；')); return true; }
      st.assigned = true; if (!workTask.participants.includes(st.owner)) workTask.participants.push(st.owner); st.status = st.status === 'running' ? 'completed' : 'running'; if (st.status === 'completed') st.result = '演示结果：' + st.output; saveTask(workTask, st.owner + '：' + st.title + '，' + (st.status === 'completed' ? '模拟结果已提交' : '模拟工作已派发')); render();
    }
    else if (action === 'wb-source-access') {
      const split = id.indexOf(':'), ct = task(id.slice(0, split)), d = space(ct.space).docs.find(d => d.id === id.slice(split + 1));
      if (d.access === 'denied') showDialog('申请资料授权（演示）', '只向当前资料管理员请求，不自动批准。', `<p>${e(d.title)}</p><p>确认后记录授权待办。原型提供单独的管理员模拟批准入口。</p>`, button('取消', 'close-dialog') + button('记录授权申请', 'wb-source-request', { id }));
      else { d.access = 'denied'; ct.sources = ct.sources.filter(x => x !== d.id); ct.retrieval = ct.retrieval.filter(x => x.id !== d.id); ct.retrieval.push({ id: d.id, status: 'denied', purpose: '演示撤权', version: 1 }); saveTask(ct, '演示撤回资料访问权，后续读取需重新授权。'); render(); }
    }
    else if (action === 'wb-source-request' || action === 'wb-source-process') { const [tid, did] = id.split(':'); const ct = task(tid); ct.accessRequests ||= []; if (!ct.accessRequests.includes(did)) ct.accessRequests.push(did); saveTask(ct, '已记录资料授权申请（演示），尚未获得正文。'); showDialog('授权申请已记录', '此处可模拟资料管理员处理，不会修改真实权限。', '<p>批准仅对当前空间的演示资料生效，后续还需重新检索。</p>', button('暂不批准', 'close-dialog') + button('模拟管理员批准', 'wb-source-approve', { id })); }
    else if (action === 'wb-source-approve') { const [tid, did] = id.split(':'); const ct = task(tid); space(ct.space).docs.find(d => d.id === did).access = 'allowed'; ct.accessRequests = (ct.accessRequests || []).filter(x => x !== did); ct.retrieval = ct.retrieval.filter(x => x.id !== did); saveTask(ct, '模拟管理员已批准资料授权，正文尚未重新读取。'); closeDialog(); render(); }
    else return false;
    return true;
  }
  function submit(form, values) {
    const type = form.dataset.form, id = form.dataset.id, r = resource(id), t = task(id), s = space(id);
    if (type === 'resource-search') { go('/resources', { type: route().params.get('type'), q: String(values.get('q') || '').trim() }); }
    else if (type === 'wb-resource') {
      if (r && !canEdit(r)) return true;
      const c = readConfig(form, r?.draft?.config || config(r)), name = String(values.get('resource-name') || '').trim(), description = String(values.get('resource-description') || '').trim();
      if (!name || !description) { feedback(form, '名称与用途不能为空。'); return true; }
      const item = r || { id: 'resource-' + Date.now(), type: c.type, typeName: types[c.type], name, description, capabilities: [], location: c.location, available: false, owner: 'Hector', managers: ['Hector'], originSpace: values.get('resource-origin'), management: form.dataset.connect === 'true' ? 'external' : 'local', publishedVersion: 0, versions: [], disabled: false };
      if (!r) { item.grants = [item.originSpace]; item.editors = ['Hector']; item.publishers = ['Hector']; state().resources.push(item); }
      item.draft = { name, description, capabilities: csv(values.get('resource-capabilities')), config: c }; persist(); go('/resources/' + item.id);
    }
    else if (type === 'wb-access') { if (canManage(r)) { r.grants = [...new Set([r.originSpace, ...values.getAll('grants')])]; r.editors = [...new Set([r.owner, ...values.getAll('editors')])]; r.publishers = [...new Set([r.owner, ...values.getAll('publishers')])]; persist(); feedback(form, '空间使用权、编辑权与发布停用权已分别保存。'); } }
    else if (type === 'wb-bind') {
      const ids = values.getAll('resources'), proposed = { ...s, allowedTools: values.getAll('tools') }, errors = ids.flatMap(rid => issues(resource(rid), proposed));
      if (errors.length) { feedback(form, errors.join('；')); return true; }
      s.resources = ids; s.allowedTools = proposed.allowedTools; if (!ids.includes(s.defaultResource)) s.defaultResource = ''; persist(); closeDialog(); render();
    }
    else if (type === 'wb-settings') {
      const def = String(values.get('resource') || '');
      if (def && (!s.resources.includes(def) || issues(resource(def), s).length)) { feedback(form, '默认主体未就绪，请先修复资源。'); return true; }
      const rule = { artifact: true, subtasks: true, sources: values.has('rule-sources') };
      if (rule.sources !== s.rule.sources || s.autoAccept !== values.has('autoAccept')) s.rule.version++;
      Object.assign(s.rule, rule); s.autoAccept = values.has('autoAccept'); s.defaultResource = def; s.name = String(values.get('space-name')).trim() || s.name; s.description = String(values.get('space-description')).trim(); persist(); render(); document.querySelector('[data-form="wb-settings"] [data-feedback]').textContent = '已保存本地设置与规则版本。';
    }
    else if (type === 'wb-use') { const sid = values.get('use-space'), target = space(sid); if (!target || !target.resources.includes(id) || issues(r, target).length) { feedback(form, '该主体尚未在任何合适空间启用，请先配置空间资源。'); return true; } closeDialog(); clearFiles(); go('/new', { space: sid, resource: id }); }
    else if (type === 'create-task') {
      const goal = String(values.get('task-goal') || values.get('goal') || '').trim();
      if (!goal) { document.getElementById('task-goal').setAttribute('aria-invalid', 'true'); document.getElementById('goal-help').textContent = '请填写希望完成的目标，再创建任务。'; document.getElementById('task-goal').focus(); return true; }
      const created = createTask({ goal, space: values.get('new-space'), resource: values.get('resource'), owner: values.get('new-owner'), acceptor: values.get('new-acceptor'), acceptance: String(values.get('new-acceptance') || '').trim(), deadline: values.get('deadline'), artifactType: values.get('new-artifact'), deliveryTarget: values.get('new-target'), deliveryChannel: values.get('new-channel'), forceManual: values.has('forceManual') }, getFiles()); clearFiles(); go('/task/' + created.id);
    }
    else if (type === 'wb-reassign') {
      if (['completed', 'cancelled'].includes(t.status)) return true;
      const chosen = resource(values.get('resource')), ss = space(t.space), reason = String(values.get('reassign-reason') || '').trim();
      if (!reason || !chosen || !ss.resources.includes(chosen.id) || issues(chosen, ss).length) { feedback(form, '请填写原因并选择当前空间就绪的主体。'); return true; }
      const old = t.runs.at(-1), history = { from: t.binding ? t.binding.name + ' v' + t.binding.version : '', to: chosen.name + ' v' + chosen.publishedVersion, reason, time: now(), result: '' };
      if (values.get('handoff-status') === 'pending' && old) { t.pendingAssignment = { resourceId: chosen.id, reason }; t.status = 'blocked'; t.blockReason = '等待旧执行停止确认，尚未启动新 Run'; old.status = '停止待确认'; history.result = '尚未收到停止确认，保留原绑定'; t.assignmentHistory.push(history); saveTask(t, t.blockReason); closeDialog(); render(); return true; }
      if (old) { old.status = '已停止并交接（演示确认）'; old.workSnapshot = clone(t.subtasks.filter(st => !st.superseded)); }
      t.subtasks.forEach(st => { if (!st.superseded && !st.human) { st.superseded = true; if (st.status !== 'completed') st.status = 'cancelled'; } });
      t.resource = chosen.id; t.binding = snapshot(chosen); t.stage = 0; t.phase = chosen.type === 'harness' ? 'N1' : null; t.humanAction ||= chosen.type === 'harness' ? scopeAction() : null; t.status = t.humanAction ? 'confirm' : 'running'; delete t.blockReason; delete t.pendingAssignment;
      if (t.acceptanceRecord) { t.acceptanceHistory ||= []; t.acceptanceHistory.push(t.acceptanceRecord); delete t.acceptanceRecord; }
      t.assignmentReason = '人工改派：' + reason; history.result = '旧执行已模拟确认停止；保留目标、决定、成果与人工事项'; t.assignmentHistory.push(history); startRun(t, history.result); saveTask(t, '改派到 ' + chosen.name + '：' + reason); closeDialog(); go('/task/' + t.id, { tab: 'overview' }); render();
    }
    else if (type === 'wb-delivery') { t.acceptor = values.get('delivery-acceptor'); t.artifactType = values.get('delivery-artifact'); t.deliveryConfig = { target: String(values.get('delivery-target') || '').trim(), channel: values.get('delivery-channel') }; t.forceManual = values.has('forceManual'); saveTask(t, '更新下一次交付配置：验收人为 ' + t.acceptor + '，不改变已有验收记录。'); closeDialog(); render(); }
    else if (type === 'wb-invite') {
      if (['completed', 'cancelled'].includes(t.status)) return true;
      const value = String(values.get('participant')), purpose = String(values.get('invite-goal') || '').trim(), human = value.startsWith('person:'), rr = human ? null : resource(value.slice(6)), ss = space(t.space);
      if (!purpose || (!human && (!ss.resources.includes(rr?.id) || issues(rr, ss).length))) { feedback(form, '协作目的不能为空，且执行主体必须已获授权并就绪。'); return true; }
      const name = human ? value.slice(7) : rr.name, dependency = String(values.get('invite-dependency') || ''), ready = !dependency || t.subtasks.find(st => st.id === dependency)?.status === 'completed';
      const st = { id: 'work-' + t.id + '-' + t.subtasks.length, resourceId: rr?.id || '', title: purpose, owner: name, status: ready && !human ? 'running' : 'waiting', assigned: ready, required: values.has('required'), human, input: '仅当前 Task 与空间已授权资料', output: String(values.get('invite-output') || '').trim(), dependsOn: dependency ? [dependency] : [], origin: 'explicit', snapshot: rr ? snapshot(rr) : null };
      t.subtasks.push(st); if (!t.participants.includes(name)) t.participants.push(name);
      if (human) { t.collabRequests ||= []; t.collabRequests.push({ id: 'collab-' + Date.now(), person: name, purpose, answer: null, time: now(), subtaskId: st.id }); }
      saveTask(t, (human ? '请人参与：' : '已授权委派：') + name + '，' + purpose + '（演示）'); closeDialog(); render();
    }
    else if (type === 'collab-reply') {
      const request = t.collabRequests?.find(r => r.id === form.dataset.request), answer = String(values.get('answer') || '').trim();
      const st = request && (t.subtasks.find(x => x.id === request.subtaskId) || t.subtasks.find(x => x.title === request.purpose && x.owner === request.person));
      if (!request || !answer || st?.superseded) return true;
      if (st?.dependsOn.some(dep => t.subtasks.find(x => x.id === dep)?.status !== 'completed')) { announceProblem('前置子工作尚未完成，暂不能记录本项完成结果。'); return true; }
      request.answer = answer; if (st) { st.status = 'completed'; st.result = answer; st.assigned = true; }
      saveTask(t, '协作答复（演示）：' + answer, request.person, 'human'); render();
    }
    else return false;
    return true;
  }
  function updateMatching() {
    const form = document.querySelector('[data-form="create-task"]'); if (!form) return;
    const s = space(document.getElementById('new-space').value), chosen = document.getElementById('new-resource').value, goal = document.getElementById('task-goal').value;
    document.getElementById('assignment-preview').textContent = match(s, goal, chosen).reason + '（本地规则演示）';
  }
  function change(target) {
    if (target.dataset.wbControl === 'type') { const form = target.closest('form'); document.getElementById('resource-config-fields').innerHTML = fields(defaultConfig(target.value), null, form.dataset.connect === 'true'); }
    if (target.dataset.wbControl === 'task-resource') updateMatching();
  }
  function inputChange(target) {
    if (target.id === 'resource-search') { const s = space(document.getElementById('new-space').value), el = document.getElementById('new-resource'); el.innerHTML = options(s, el.value, true, target.value); updateMatching(); }
    if (target.id === 'task-goal') updateMatching();
  }
  return { initialise, options, resourceRows, resourcesPage, settingsContent, newTaskPage, createTask, prepareRun, guard, discover, progress, finished, canAccept, acceptanceLabel, deliveryPanel, assignmentPanel, collaboration, contextPanel, runsPanel, action, submit, change, inputChange, updateMatching, issues, snapshot, boundResource: t => t.binding ? { ...resource(t.resource), ...t.binding, location: t.binding.config.location, typeName: types[t.binding.type] } : resource(t.resource) };
};
