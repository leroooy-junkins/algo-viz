/*
 * Randomized vertex cover.
 *   C = {}; while an edge is uncovered: pick a random uncovered edge, add a random end of it to C.
 * A smallest cover C* is found by brute force (graphs are small) only to score the run. A coin flip
 * is "lucky" if the vertex it adds is in C*. On average |C| <= 2|C*|.
 * The data panel lists all edges and the edges covered so far; the run ends when they match.
 */
(() => {
  const { el } = VIZ;
  const W = 640, H = 460;

  const label = i => String.fromCharCode(97 + i);
  const SIZES = { small: 5, medium: 8, large: 12 };            // vertices
  const DENSITIES = { sparse: 0.2, medium: 0.35, dense: 0.55 }; // chance of each possible edge

  const CODE = [
    'C ← ∅',
    'while some edge is uncovered:',
    '    (u, v) ← random uncovered edge',
    '    x ← u or v (coin flip)',
    '    C ← C ∪ {x}',
    'return C',
  ];

  function makeGraph(p, rand) {
    const n = SIZES[p.size], chance = DENSITIES[p.density];
    let edges;
    do {
      edges = [];
      for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (rand() < chance) edges.push([u, v]);
    } while (edges.length < 2);
    const pos = Array.from({ length: n }, (_, i) => [Math.cos(2 * Math.PI * i / n), -Math.sin(2 * Math.PI * i / n)]);
    return { n, edges, pos };
  }

  // Smallest vertex cover by brute force over all subsets.
  function minCover(n, edges) {
    const bits = m => { let c = 0; for (; m; m &= m - 1) c++; return c; };
    let best = 0, bestK = n + 1;
    for (let m = 0; m < 1 << n; m++) {
      const k = bits(m);
      if (k < bestK && edges.every(([u, v]) => (m >> u & 1) || (m >> v & 1))) { best = m; bestK = k; }
    }
    return new Set([...Array(n).keys()].filter(i => best >> i & 1));
  }

  function randomRun(n, edges, rand) {
    const C = new Set(), flips = [];
    for (;;) {
      const open = edges.filter(([u, v]) => !C.has(u) && !C.has(v));
      if (!open.length) return flips;
      const edge = open[Math.floor(rand() * open.length)];
      const added = edge[Math.floor(rand() * 2)];
      C.add(added);
      flips.push({ edge, added, open: open.length, C: new Set(C) });
    }
  }

  function create(params, rand) {
    const { n, edges, pos } = makeGraph(params, rand);
    const star = minCover(n, edges);
    const k = star.size;
    const flips = randomRun(n, edges, rand);
    const total = flips.length;

    // Each step: text for the side panel + what to draw.
    const steps = [];
    const add = (title, lines, view, code) => steps.push({ title, lines, view, code });
    const none = new Set();
    const covers = (C, [u, v]) => C.has(u) || C.has(v);
    const plural = (m, word) => `${m} ${word}${m === 1 ? '' : 's'}`;

    add('The problem', [
      'Given a graph G = (V, E), a vertex cover is a subset C ⊆ V such that every edge (u, v) ∈ E has u ∈ C or v ∈ C. In other words, C is a subset of the vertices, and every edge in G has at least one end (vertex u or vertex v) in C.',
      'Finding a minimum cover is NP-hard (no polynomial-time algorithm is known, and finding one would prove P = NP). This randomized algorithm returns a cover whose expected size is at most twice the minimum.',
      'Start with C empty. While an edge is uncovered, pick one uniformly at random, flip a coin, and add one of its endpoints to C.',
      'Why a coin? Always taking the first endpoint can be forced into a bad cover: on a star whose edges all list the leaf first, it picks every leaf instead of the center. A random choice means no fixed graph can reliably trick it.',
    ], { C: none }, [0]);

    add('Why at most twice the smallest', [
      `Let C* be a minimum cover (blue rings, ${k} ${k === 1 ? 'vertex' : 'vertices'}). Brute force finds it here to score the run; the algorithm never sees it.`,
      'C* covers every edge, so each uncovered edge has an endpoint in C*. A flip is lucky if it picks that endpoint, which happens with probability at least 0.5.',
      `Every flip adds a vertex not yet in C, so each lucky flip finds a new vertex of C*. That happens at most ${k} times. Since each flip is lucky with probability at least 0.5, C has at most 2 × ${k} = ${2 * k} vertices on average.`,
    ], { C: none, star: true }, []);

    let hits = 0, misses = 0;
    flips.forEach((f, i) => {
      const prev = i ? flips[i - 1].C : none;
      add(`Round ${i + 1}: pick an edge`, [
        `${f.open === edges.length ? `All ${edges.length} edges are` : `${f.open} of ${edges.length} edges ${f.open === 1 ? 'is' : 'are'}`} still uncovered. One is picked at random (red).`,
        'At least one endpoint is in C*. A coin flip chooses which one joins C.',
      ], { C: prev, star: true, picked: f.edge }, [1, 2]);

      const hit = star.has(f.added);
      hit ? hits++ : misses++;
      const fresh = edges.filter(e => covers(f.C, e) && !covers(prev, e)).length;
      add(`Round ${i + 1}: ${hit ? 'lucky' : 'unlucky'} flip`, [
        `The coin picks ${label(f.added)}, so C = {${[...f.C].sort((a, b) => a - b).map(label).join(', ')}}.`,
        `${label(f.added)} covers ${plural(fresh, 'more edge')}, now dashed.`,
        hit ? `Lucky: ${label(f.added)} is in C*. ${hits} of ${k} found.`
            : `Unlucky: ${label(f.added)} is not in C*. ${misses} extra so far.`,
      ], { C: f.C, prev, star: true, added: f.added }, [3, 4]);
    });

    add('Result', [
      'Every edge is covered, so the loop ends.',
      `C has ${total} vertices, the minimum is ${k}. ${hits} lucky flips, ${misses} unlucky.`,
      `The bound holds on average, at most ${2 * k} here. A single run can exceed it, but never goes below ${k}.`,
    ], { C: flips[total - 1].C, star: true }, [1, 5]);

    // Scale graph coordinates into the drawing area.
    const xs = pos.map(p => p[0]), ys = pos.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    function draw(svg, idx) {
      const { C, star: showStar, picked, added } = steps[idx].view;
      // On a narrow stage the 640-wide drawing shrinks; grow nodes and text so they stay readable.
      const shrink = W / ((svg.getBoundingClientRect().width || W) - 2);
      const k = shrink < 1.2 ? 1 : Math.min(1.8, shrink);       // desktop keeps the original sizes
      const kn = Math.min(k, 1.35);                               // nodes grow less, so the graph keeps room
      const m = 32 * kn + 18;                                     // room for the highlight ring
      const box = { x: m, y: 40, w: W - 2 * m, h: 330 };
      const scale = Math.min(box.w / ((x1 - x0) || 1), box.h / ((y1 - y0) || 1));
      const at = i => [
        box.x + box.w / 2 + (pos[i][0] - (x0 + x1) / 2) * scale,
        box.y + box.h / 2 + (pos[i][1] - (y0 + y1) / 2) * scale,
      ];
      const isPicked = ([u, v]) => picked && picked[0] === u && picked[1] === v;

      for (const e of edges) {
        const [a, b] = [at(e[0]), at(e[1])];
        const look = isPicked(e) ? { stroke: 'var(--red)', 'stroke-width': 6, 'stroke-linecap': 'round' }
          : (C.has(e[0]) || C.has(e[1])) ? { stroke: 'var(--gray)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }
          : { stroke: 'var(--ink)', 'stroke-width': 2 };
        el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...look }, svg);
      }
      for (let i = 0; i < n; i++) {
        const [x, y] = at(i);
        const inStar = showStar && star.has(i);
        const fill = C.has(i) ? (star.has(i) ? 'var(--blue)' : 'var(--orange)') : 'var(--node)';
        if (picked && picked.includes(i)) el('circle', { cx: x, cy: y, r: 31 * kn, fill: 'none', stroke: 'var(--red)', 'stroke-width': 3 }, svg);
        if (i === added) el('circle', { cx: x, cy: y, r: 32 * kn, fill: 'none', stroke: fill, 'stroke-width': 4, opacity: .5 }, svg);
        el('circle', {
          cx: x, cy: y, r: 22 * kn, fill,
          stroke: inStar ? 'var(--blue)' : 'var(--ink)', 'stroke-width': inStar ? 5 : 1.5,
        }, svg);
        el('text', {
          x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 17 * kn, 'font-weight': 700,
          style: `fill:${C.has(i) ? 'var(--on-fill)' : 'var(--ink)'}`,
        }, svg, label(i));
      }

      // legend: only the colors of nodes in C (rings and dashed edges are explained in the step text)
      const items = [
        ['Nodes in C:', 'head'],
        ['also in C*', 'var(--blue)'],
        ['not in C*', 'var(--orange)'],
      ];
      let x = 24, y = 412 + 12 * k;                               // legend wraps onto more rows when scaled up
      for (const [text, color] of items) {
        const head = color === 'head';
        const pad = head ? 0 : 24;
        const wid = (pad + text.length * (head ? 7.6 : 7.2) + 18) * k;
        if (x > 24 && x + wid - 18 * k > W - 12) { x = 24; y += 26 * k; }
        if (!head) el('circle', { cx: x + 8 * k, cy: y, r: 7 * k, fill: color }, svg);
        el('text', { x: x + pad * k, y, 'dominant-baseline': 'central', 'font-size': 13 * k, ...(head ? { 'font-weight': 700 } : {}) }, svg, text);
        x += wid;
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${Math.max(H, y + 22 * k)}`);
    }

    // One adjacency list; each neighbor chip shows its edge's state, matching the drawing:
    // uncovered (solid), covered (dashed, faded), just covered by the latest pick (blue), picked (red).
    function data(box, idx) {
      const { C, prev, picked } = steps[idx].view;
      const isPicked = (u, v) => picked && ((picked[0] === u && picked[1] === v) || (picked[0] === v && picked[1] === u));
      const vertex = i => C.has(i) ? (star.has(i) ? 'blue' : 'orange') : '';
      const entry = (u, v) => isPicked(u, v) ? 'picked'
        : !covers(C, [u, v]) ? ''
        : prev && !covers(prev, [u, v]) ? 'new' : 'covered';
      const covered = edges.filter(e => covers(C, e)).length;

      const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });
      const head = node('div', 'adj-head');
      const meter = node('span', 'meter'), fill = node('i', '');
      fill.style.width = `${100 * covered / edges.length}%`;
      meter.append(fill);
      head.append(node('strong', '', `${covered} of ${edges.length} edges covered`), meter);

      const parts = [head, VIZ.adjacency({ n, edges, label, vertex, entry })];
      if (picked) {
        const key = node('p', 'note key'), item = node('span', '');
        item.append(node('span', 'cell picked', 'x'), ' picked');
        key.append(item);
        parts.push(key);
      }
      box.replaceChildren(...parts);
    }

    // One-line state for the collapsed data card.
    function summary(idx) {
      const { C, picked } = steps[idx].view;
      const cov = edges.filter(e => covers(C, e)).length;
      return `C: ${C.size} vertices · ${cov}/${edges.length} edges covered` + (picked ? ` · picked ${label(picked[0])}–${label(picked[1])}` : '');
    }

    return { steps, draw, data, summary };
  }

  VIZ.register({
    id: 'vertex-cover',
    name: 'Vertex Cover',
    kind: 'Graph problem',
    tagline: 'Randomized 2-approximation',
    viewBox: [W, H],
    code: CODE,
    dataTitle: 'Adjacency list',
    newLabel: 'New graph',
    params: [
      { key: 'size', label: 'Size', type: 'select', value: 'medium', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
      { key: 'density', label: 'Edges', type: 'select', value: 'medium', options: [['sparse', 'Sparse'], ['medium', 'Medium'], ['dense', 'Dense']] },
    ],
    create,
  });
})();
