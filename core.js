/*
 * Shell for the algorithm visualizers: algorithm picker, parameter controls,
 * "New graph", step player. Algorithms plug in with VIZ.register(...):
 *
 *   VIZ.register({
 *     id: 'vertex-cover',          // used in the URL hash
 *     name: 'Randomized vertex cover',
 *     viewBox: [640, 460],         // SVG size used by draw()
 *     code: ['C ← ∅', ...],        // optional pseudocode, one string per line (leading spaces = indent)
 *     dataTitle: 'Adjacency lists',// optional; title of the data panel under the drawing
 *     newLabel: 'New graph',       // optional; text of the re-roll button (default 'New run')
 *     newDisabled: p => bool,      // optional; true grays out the re-roll button (a new run would be identical)
 *     newDisabledHint: '...',      // optional; tooltip on the grayed-out button
 *     kind: 'Graph problem',       // optional; small label above the name on the problem tab
 *     tagline: 'Randomized ...',   // optional; one-line subtitle on the problem tab (hidden on phones)
 *     params: [                    // optional; each becomes a row of buttons
 *       { key, label, type: 'select', value, options: [[value, text]], when: p => bool,
 *       { key, label, type: 'toggle', value: false },   // on/off switch, params[key] is a boolean
 *         keepRun: true },         // optional; changing it rebuilds the same random run (same seed)
 *     ],
 *     create(params, rand) {       // build one run; rand() is a seeded Math.random-like PRNG
 *       return {
 *         steps: [{ title, lines: ['text', ...],
 *                   code: [0, 2],  // pseudocode line numbers (0-based) to highlight
 *                   anchor: 'k' }, // optional; after a keepRun change, the first step with the same anchor opens
 *                ...],
 *         draw(svg, i) { ... },    // render step i into the (already emptied) svg; it may set its
 *                                  // own viewBox (e.g. to fit the rendered width); re-run on resize
 *         data(box, i) { ... },    // optional; fill the data panel for step i (see VIZ.adjacency)
 *       };
 *     },
 *   });
 */
(() => {
  const registry = [];
  const NS = 'http://www.w3.org/2000/svg';

  const VIZ = {
    register(v) { registry.push(v); },
    // Create an SVG element: el('circle', {cx: 1, class: 'node'}, parent, 'optional text')
    el(tag, attrs = {}, parent, text) {
      const e = document.createElementNS(NS, tag);
      // WebKit (Safari, every iOS browser) does not reliably resolve CSS variables in SVG
      // presentation attributes (stroke="var(--ink)"), which left graph edges unpainted. Any value
      // using var() goes into the style attribute instead; an explicit style still wins.
      let style = '';
      for (const k in attrs) {
        const v = String(attrs[k]);
        if (k !== 'style' && v.includes('var(')) style += `${k}:${v};`;
        else e.setAttribute(k, v);
      }
      if (style) e.setAttribute('style', style + (attrs.style || ''));
      if (text !== undefined) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    },
    // One adjacency list for an undirected graph: a row "u → v w ..." per vertex, one chip per
    // neighbor. Vertices are 0..n-1; label(i) names them. vertex(u) / entry(u, v) return a CSS class
    // (e.g. 'blue', 'picked', 'new', 'covered') or ''. title is optional. Rows flow into columns
    // when there is room. Returns an element to put in the data panel.
    adjacency({ title, n, edges, label, vertex = () => '', entry = () => '' }) {
      const adj = Array.from({ length: n }, () => []);
      for (const [u, v] of edges) { adj[u].push(v); adj[v].push(u); }
      const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });
      const fig = node('div', 'arr'), rows = node('div', 'rows');
      if (title) fig.append(node('h4', '', title));
      adj.forEach((nbrs, u) => {
        const row = node('div', 'row'), cells = node('span', 'cells');
        for (const v of nbrs.sort((a, b) => a - b)) cells.append(node('span', `cell ${entry(u, v)}`, label(v)));
        if (!nbrs.length) cells.append(node('span', 'cell empty', 'none'));
        row.append(node('span', `v ${vertex(u)}`, label(u)), node('span', 'to', '→'), cells);
        rows.append(row);
      });
      fig.append(rows);
      return fig;
    },
    start,
  };
  window.VIZ = VIZ;

  function start() {
    const $ = id => document.getElementById(id);
    let viz, params, run, step = 0, seed;
    // Seeded PRNG (mulberry32), so a keepRun parameter can rebuild the same run.
    const prng = a => () => {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    $('controls').addEventListener('submit', e => e.preventDefault());   // no inline handlers (CSP script-src 'self')

    // ---- algorithm picker ----
    // Big two-line tabs (kind of problem + name), visually distinct from the parameter buttons.
    const picker = $('algo');
    picker.parentElement.hidden = registry.length < 2;
    for (const v of registry) {
      const b = Object.assign(document.createElement('button'), { type: 'button' });
      b.dataset.value = v.id;
      for (const [cls, text] of [['kind', v.kind], ['name', v.name], ['tag', v.tagline]]) {
        if (text) b.append(Object.assign(document.createElement('span'), { className: cls, textContent: text }));
      }
      b.onclick = () => {
        if (viz === v) return;
        if (location.hash.slice(1) === v.id) load(v.id);
        else location.hash = v.id;                              // the hashchange handler loads it
      };
      picker.append(b);
    }
    // Mark the active button of a button group.
    const markActive = (group, value) => {
      for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === String(value)));
    };

    // ---- parameter controls ----
    function buildControls() {
      const box = $('params');
      box.replaceChildren();
      params = {};
      for (const p of viz.params || []) {
        params[p.key] = p.value;
        const label = document.createElement(p.type === 'select' ? 'div' : 'label');
        label.dataset.key = p.key;
        const cap = document.createElement('span');            // label text, styled separately (aligned column on phones)
        cap.className = 'lbl';
        cap.textContent = p.label;
        label.append(cap);
        if (p.type === 'toggle') {                              // on/off switch; params[key] is a boolean
          const sw = document.createElement('button');
          sw.type = 'button';
          sw.className = 'switch';
          sw.setAttribute('role', 'switch');
          sw.setAttribute('aria-checked', String(!!p.value));
          params[p.key] = !!p.value;
          sw.onclick = () => {
            params[p.key] = !params[p.key];
            sw.setAttribute('aria-checked', String(params[p.key]));
            syncVisibility();
            generate(p.keepRun);
          };
          label.append(sw);
          box.append(label);
          continue;
        }
        if (p.type === 'select') {
          const group = document.createElement('div');
          group.className = 'seg';
          group.setAttribute('role', 'group');
          group.setAttribute('aria-label', p.label);
          for (const [v, t] of p.options) {
            const b = Object.assign(document.createElement('button'), { type: 'button', textContent: t });
            b.dataset.value = v;
            b.onclick = () => {
              if (params[p.key] === v) return;
              params[p.key] = v;
              markActive(group, v);
              syncVisibility();
              generate(p.keepRun);
            };
            group.append(b);
          }
          markActive(group, p.value);
          label.append(group);
          box.append(label);
          continue;
        }
        const input = document.createElement('input'), out = document.createElement('output');
        input.type = 'range';
        Object.assign(input, { min: p.min, max: p.max, step: p.step || 1, value: p.value });
        out.textContent = p.value;
        input.setAttribute('aria-label', p.label);
        input.oninput = () => { out.textContent = input.value; };
        input.onchange = () => {
          params[p.key] = +input.value;
          syncVisibility();
          generate(p.keepRun);
        };
        label.append(input);
        label.append(out);
        box.append(label);
      }
      syncVisibility();
    }
    function syncVisibility() {
      for (const p of viz.params || []) {
        if (p.when) $('params').querySelector(`[data-key="${p.key}"]`).hidden = !p.when(params);
      }
      // newDisabled(params): gray out the re-roll button when a new run would be identical.
      const off = !!(viz.newDisabled && viz.newDisabled(params));
      $('new').disabled = off;
      $('new').title = off ? (viz.newDisabledHint || '') : '';
    }

    // ---- run / render ----
    // keepRun: rebuild the current run (same seed) and stay on the matching step.
    function generate(keepRun = false) {
      const anchor = keepRun && run ? run.steps[step].anchor : undefined;
      if (!keepRun || seed === undefined) seed = Math.random() * 2 ** 32 >>> 0;
      run = viz.create({ ...params }, prng(seed));
      $('seek').max = run.steps.length - 1;
      const k = anchor === undefined ? -1 : run.steps.findIndex(s => s.anchor === anchor);
      show(Math.max(0, k));
    }

    function drawStage() {
      const svg = $('stage');
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${viz.viewBox[0]} ${viz.viewBox[1]}`);
      run.draw(svg, step);
    }
    // Redraw when the stage width changes (rotation, window resize), for draw()s that fit the width.
    let stageW = 0;
    new ResizeObserver(() => {
      const w = Math.round($('stage').getBoundingClientRect().width);
      if (run && w !== stageW) { stageW = w; drawStage(); }
    }).observe($('stage'));

    function show(k) {
      step = Math.max(0, Math.min(run.steps.length - 1, k));
      const s = run.steps[step];
      drawStage();
      $('head').textContent = s.title;
      $('text').replaceChildren(...(s.lines || []).map(t => Object.assign(document.createElement('p'), { textContent: t })));
      [...$('code').children].forEach((li, i) => {
        const on = (s.code || []).includes(i);
        li.classList.toggle('on', on);
        on ? li.setAttribute('aria-current', 'true') : li.removeAttribute('aria-current');
      });
      $('data').replaceChildren();
      if (run.data) run.data($('data'), step);
      // collapsed-card summaries (phones)
      const on = [...$('code').children].filter(li => li.classList.contains('on')).map(li => li.textContent.trim());
      $('code-sum').textContent = on.join('  ·  ');
      $('data-sum').textContent = run.summary ? run.summary(step) : '';
      $('seek').value = step;
      $('count').textContent = `${step + 1} / ${run.steps.length}`;
      $('prev').disabled = step === 0;
      $('next').textContent = step === run.steps.length - 1 ? 'Restart' : 'Next';
    }

    // ---- collapsible cards (phones; CSS ignores .collapsed on wide screens) ----
    // Both cards start collapsed. Toggle buttons sit in the card headers.
    for (const [btnId, cardId] of [['aside-tog', 'info'], ['data-tog', 'data-box']]) {
      const btn = $(btnId), card = $(cardId);
      btn.onclick = () => {
        const c = card.classList.toggle('collapsed');
        btn.textContent = c ? '+' : '−';
        btn.setAttribute('aria-expanded', String(!c));
        btn.setAttribute('aria-label', (c ? 'Expand ' : 'Collapse ') + btn.dataset.name);
      };
    }

    // ---- player ----
    $('prev').onclick = () => { show(step - 1); };
    const next = () => show(step === run.steps.length - 1 ? 0 : step + 1);   // wraps to the first step
    $('next').onclick = next;
    $('seek').oninput = e => { show(+e.target.value); };
    $('new').onclick = () => generate();
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Sliders and text fields use the arrow keys; a focused button already clicks on Space.
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ' && e.target.closest('button')) return;
      if (e.key === 'ArrowRight') { next(); }
      else if (e.key === 'ArrowLeft') { show(step - 1); }
      else if (e.key === ' ') { e.preventDefault(); next(); }
    });

    function load(id) {
      viz = registry.find(v => v.id === id) || registry[0];
      markActive(picker, viz.id);
      document.title = `${viz.name} – Algorithm visualizer`;
      $('code').replaceChildren(...(viz.code || []).map(t => Object.assign(document.createElement('li'), { textContent: t })));
      $('code-box').hidden = !viz.code;
      $('data-box').hidden = !viz.dataTitle;
      $('data-title').textContent = viz.dataTitle || '';
      $('new').textContent = viz.newLabel || 'New run';
      buildControls();
      generate();
    }
    window.addEventListener('hashchange', () => load(location.hash.slice(1)));   // Back/Forward
    load(location.hash.slice(1));
  }
})();
