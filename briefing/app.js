(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const D = window.CIMI;
  const text = (selector, value) => { $(selector).textContent = value; };
  const element = (tag, value, className) => { const el = document.createElement(tag); if (value) el.textContent = value; if (className) el.className = className; return el; };
  const explain = (host, title, body, source) => {
    host.replaceChildren(element('h3', title), element('p', body), element('span', `依据：${source}`, 'caption'));
  };
  let mapIndex = 0;
  const highlight = (nodes, edges = []) => {
    $$('[data-node]').forEach((n) => n.classList.toggle('active', nodes.includes(n.dataset.node)));
    $$('[data-edge]').forEach((e) => e.classList.toggle('hot', edges.includes(e.dataset.edge)));
  };
  const setMap = (index) => {
    mapIndex = Math.max(0, Math.min(D.tour.length - 1, index));
    const step = D.tour[mapIndex];
    highlight(step.nodes, step.edges);
    explain($('#mapDetail'), step.title, step.body, step.source);
    text('#mapCounter', `导览 ${mapIndex + 1} / ${D.tour.length}`);
    $('#mapPrev').disabled = mapIndex === 0;
    $('#mapNext').disabled = mapIndex === D.tour.length - 1;
  };
  $('#mapPrev').addEventListener('click', () => setMap(mapIndex - 1));
  $('#mapNext').addEventListener('click', () => setMap(mapIndex + 1));
  $$('[data-node]').forEach((node) => {
    const show = () => {
      const item = D.nodes[node.dataset.node];
      highlight([node.dataset.node]);
      explain($('#mapDetail'), ...item);
      text('#mapCounter', `探索：${item[0]}`);
    };
    node.addEventListener('click', show);
    if (node.tagName.toLowerCase() === 'g') node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(); }
    });
  });
  setMap(0);

  const makeFacts = (rows) => rows.map(([term, value]) => {
    const row = element('div'); row.append(element('dt', term), element('dd', value)); return row;
  });
  const setSpace = (space) => {
    $$('[data-space]').forEach((tab) => {
      const selected = tab.dataset.space === space;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      if (selected) $('#spacePanel').setAttribute('aria-labelledby', tab.id);
    });
    $('#spaceFacts').replaceChildren(...makeFacts(D.spaces[space]));
  };
  $$('[data-space]').forEach((button) => button.addEventListener('click', () => setSpace(button.dataset.space)));
  const updateShare = () => {
    const selected = [];
    if ($('#shareGoal').checked) selected.push('目标摘要');
    if ($('#shareReport').checked) selected.push('报告与证据');
    text('#shareResult', selected.length ? `新的项目 Task 将收到：${selected.join('、')}。` : '未选择内容，项目侧不会收到材料。');
  };
  $('#shareGoal').addEventListener('change', updateShare);
  $('#shareReport').addEventListener('change', updateShare);
  $$('[data-object]').forEach((button) => button.addEventListener('click', () => {
    const [title, body, source] = D.objects[button.dataset.object];
    text('#objectTitle', title); text('#objectBody', body); text('#objectSource', `依据：${source}`);
    $('#objectDialog').showModal();
  }));
  $('#closeDialog').addEventListener('click', () => $('#objectDialog').close());

  let storyIndex = 0;
  const setStory = (index) => {
    storyIndex = Math.max(0, Math.min(D.story.length - 1, index));
    const step = D.story[storyIndex];
    const fields = { storyTitle: 'title', storyBody: 'body', storyTask: 'task', storyRun: 'run', storyHuman: 'human', storyArtifact: 'artifact', storyPoint: 'point' };
    for (const [id, field] of Object.entries(fields)) text(`#${id}`, step[field]);
    text('#storySource', `依据：${step.source}`);
    $('#storyTask').dataset.tone = storyIndex === 2 ? 'human' : storyIndex === 6 ? 'done' : 'normal';
    $$('[data-story]').forEach((button) => {
      if (Number(button.dataset.story) === storyIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('#storyPrev').disabled = storyIndex === 0;
    $('#storyNext').disabled = storyIndex === D.story.length - 1;
  };
  $$('[data-story]').forEach((button) => button.addEventListener('click', () => setStory(Number(button.dataset.story))));
  $('#storyPrev').addEventListener('click', () => setStory(storyIndex - 1));
  $('#storyNext').addEventListener('click', () => setStory(storyIndex + 1));
  $('#storyReset').addEventListener('click', () => setStory(0));
  setStory(0);

  $$('[data-executor]').forEach((button) => button.addEventListener('click', () => {
    const item = D.executors[button.dataset.executor];
    $$('[data-executor]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const facts = element('dl', '', 'fact-list'); facts.append(...makeFacts([['示例', item.example], ['Task 保留', item.preserved]]));
    $('#executorDetail').replaceChildren(element('h3', item.title), element('p', item.body), facts);
  }));

  let rolledBack = false;
  const setPhase = (index) => {
    const item = D.phases[index];
    $$('[data-phase]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.phase) === index)));
    $('#phaseDetail').replaceChildren(element('h3', item[0]), element('p', item[1]), element('p', `保留：${item[2]}。`, 'note'));
  };
  $$('[data-phase]').forEach((button) => button.addEventListener('click', () => setPhase(Number(button.dataset.phase))));
  $('#rollbackBtn').addEventListener('click', () => {
    if (rolledBack) return;
    rolledBack = true; setPhase(0);
    $('#phaseHistory').append(element('li', '发现意图问题，从 N2 回到 N1（演示）。', 'rollback-event'), element('li', '保留原产物，原门禁证据需重新评估。'));
    text('#phaseStatus', 'Task 待确认，阶段 N1（演示）');
    $('[data-phase="0"]').classList.add('rolled-back');
    $('#rollbackBtn').disabled = true;
  });
  $('#phaseReset').addEventListener('click', () => {
    rolledBack = false; setPhase(1);
    $('#phaseHistory').replaceChildren(element('li', '目标经确认，进入 N2。'), element('li', '生成与验证正在推进（演示）。'));
    text('#phaseStatus', 'Task 进行中，阶段 N2（演示）');
    $('[data-phase="0"]').classList.remove('rolled-back');
    $('#rollbackBtn').disabled = false;
  });
  $$('[data-route]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-route]').forEach((b) => { b.setAttribute('aria-selected', String(b === button)); b.tabIndex = b === button ? 0 : -1; });
    const item = D.routes[button.dataset.route]; text('#routeTitle', item[0]); text('#routeBody', item[1]);
  }));
  $$('[role="tablist"]').forEach((list) => list.addEventListener('keydown', (event) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click();
  }));
  $$('[data-roadmap]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-roadmap]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const item = D.roadmap[Number(button.dataset.roadmap)];
    $('#roadmapProof').replaceChildren(element('h3', item[0]), element('p', item[1]), element('span', item[2], 'caption'));
  }));
  $$('[data-run]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-run]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    $('#continuity-note').textContent = D.continuity[Number(button.dataset.run)];
  }));
  const toggleNotes = () => {
    const on = document.body.classList.toggle('notes-open');
    $('#notesBtn').setAttribute('aria-pressed', String(on));
  };
  const toggleFocus = () => {
    const on = document.body.classList.toggle('immersive');
    $('#focusBtn').setAttribute('aria-pressed', String(on));
    (on ? $('#exitFocus') : $('#focusBtn')).focus({preventScroll: true});
  };
  $('#notesBtn').addEventListener('click', toggleNotes);
  $('#focusBtn').addEventListener('click', toggleFocus);
  $('#exitFocus').addEventListener('click', toggleFocus);
  $('#themeBtn').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#themeBtn').setAttribute('aria-pressed', String(dark));
    $('#themeBtn').textContent = dark ? '浅色模式' : '深色模式';
  });
  $('#printBtn').addEventListener('click', () => window.print());
  let themeBeforePrint;
  window.addEventListener('beforeprint', () => { themeBeforePrint = document.documentElement.dataset.theme; document.documentElement.dataset.theme = 'light'; });
  window.addEventListener('afterprint', () => { document.documentElement.dataset.theme = themeBeforePrint || 'light'; });
  $('#menuBtn').addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  $('#toc').addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    document.body.classList.remove('nav-open');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  });
  const chapters = $$('.chapter');
  let current = 0;
  let scheduled = false;
  const updateChapter = () => {
    scheduled = false;
    chapters.forEach((section, index) => { if (section.getBoundingClientRect().top <= window.innerHeight * .3) current = index; });
    $$('#toc a').forEach((a, index) => { if (index === current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    const range = document.documentElement.scrollHeight - window.innerHeight;
    $('#progress').style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0})`;
  };
  window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateChapter); } }, {passive: true});
  window.addEventListener('resize', updateChapter);
  const goChapter = (index) => {
    const target = chapters[Math.max(0, Math.min(chapters.length - 1, index))];
    target.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    try { history.replaceState(null, '', `#${target.id}`); } catch { /* File viewers can restrict history without affecting navigation. */ }
  };
  updateChapter();
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || $('#objectDialog').open) return;
    if (event.key.toLowerCase() === 'j') { event.preventDefault(); goChapter(current + 1); }
    if (event.key.toLowerCase() === 'k') { event.preventDefault(); goChapter(current - 1); }
    if (event.key.toLowerCase() === 'n') toggleNotes();
    if (event.key.toLowerCase() === 'f') toggleFocus();
    if (event.key === 'Escape' && document.body.classList.contains('immersive')) toggleFocus();
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (event.target.closest('[role="tablist"]')) return;
      event.preventDefault(); const delta = event.key === 'ArrowRight' ? 1 : -1;
      const focusedChapter = event.target.closest('.chapter');
      const activeChapter = focusedChapter || chapters[current];
      if (activeChapter.id === 'story') setStory(storyIndex + delta);
      else if (activeChapter.id === 'panorama') setMap(mapIndex + delta);
      else goChapter(current + delta);
    }
  });
})();
