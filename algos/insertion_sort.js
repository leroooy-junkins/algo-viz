/*
 * Average number of shifts insertion sort makes on a randomly shuffled array.
 *   Each shift fixes exactly one inversion (pair in the wrong order), so shifts = inversions. On a
 *   random shuffle each pair is inverted with probability 1/2, so by linearity of expectation the
 *   average is (n(n-1)/2) / 2 = n(n-1)/4, half the worst case n(n-1)/2.
 * Values are 1..n (a shuffle of 1..n). The two grids show every inversion in the input and the
 * ones fixed so far, as pairs of values x < y; the run ends when they match.
 * By default there is one frame per while-loop iteration (the array as it is in memory,
 * including the stale copy each shift leaves); "Skip shift steps" shows one frame per key.
 */
(() => {
  const { el } = VIZ;
  const SIZES = { small: 5, medium: 8, large: 12 };            // elements

  const CODE = [
    'for i ← 2 to n:',
    '    key ← A[i]',
    '    j ← i − 1',
    '    while j ≥ 1 and A[j] > key:',
    '        A[j+1] ← A[j];  j ← j − 1',
    '    A[j+1] ← key',
  ];

  function makeInput(p, rand) {
    const a = Array.from({ length: SIZES[p.size] }, (_, i) => i + 1);
    if (p.input === 'reversed') return a.reverse();
    for (let i = a.length - 1; i > 0; i--) {                    // Fisher-Yates: uniform permutation
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function create(params, rand) {
    const input = makeInput(params, rand);
    const n = input.length, perShift = !params.skip;
    const total = n * (n - 1) / 2, average = total / 2;
    const fmt = x => +x.toFixed(2);
    const plural = (m, word) => `${m} ${word}${m === 1 ? '' : 's'}`;
    const andList = xs => xs.length < 2 ? `${xs[0]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
    const pk = (x, y) => `${x},${y}`;                           // key of the pair of values x < y

    // Run insertion sort once, recording what each insertion does.
    const a = input.slice(), ins = [];
    for (let i = 1; i < n; i++) {
      const key = a[i], before = a.slice();
      const larger = before.slice(0, i).filter(v => v > key);   // prefix elements the key must pass
      let j = i - 1;
      while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
      a[j + 1] = key;
      ins.push({ i, key, before, after: a.slice(), larger, pos: j + 1 });
    }
    const where = [];
    input.forEach((v, p) => { where[v] = p; });
    const bad = (x, y) => where[y] < where[x];                  // values x < y are inverted: y comes first
    let inv = 0;
    for (let x = 1; x < n; x++) for (let y = x + 1; y <= n; y++) if (bad(x, y)) inv++;

    // Each step: text for the side panel + what to draw. Positions in views are 0-based;
    // text and registers use the pseudocode's 1-based indices.
    const steps = [];
    const add = (title, lines, view, code, anchor) => steps.push({ title, lines, view, code, anchor });
    const base = {
      a: input, sorted: 0, count: 0, picked: [], fresh: [], arcs: [], moved: [], ends: [], toKey: [],
      gap: null, keyVal: null, j: null, reg: null, landed: null,
    };
    const order = [];                                           // fixed pairs, in shift order
    const allArcs = [];
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) if (input[p] > input[q]) allArcs.push([p, q]);

    add('The problem', [
      'Insertion sort takes each element in turn as the key, shifts every larger element before it one slot right, and drops the key into the gap.',
      'Question: how many shifts does it make on a uniformly random permutation of n elements, on average?',
      'Each shift fixes exactly one inversion, so shifts = inversions. Each pair is inverted with probability 0.5, so the average is half of all pairs.',
    ], { ...base }, [], 'intro0');

    add('Inversions', [
      'An inversion is a pair of elements in the wrong order: the larger one comes first. The two need not be adjacent.',
      'In 3 1 2 the inversions are (3, 1) and (3, 2); (1, 2) is in order. A sorted array has none, and a reversed array has every pair inverted.',
      `This array has ${plural(inv, 'inversion')} out of ${total} pairs, drawn as arcs.`,
    ], { ...base, arcs: allArcs, all: true }, [], 'intro1');

    add('Each shift fixes one inversion', [
      'A shift moves one larger element past the key, reversing the order of that pair only. Every other pair is unchanged.',
      'The sorted output has no inversions, so total shifts = inversions in the input.',
      'The grids track this: the first marks every inverted pair in the input, the second the pairs fixed so far.',
    ], { ...base, arcs: allArcs, all: true }, [3, 4], 'intro2');

    add('The average is half of all pairs', [
      'In a uniformly random permutation, either order of two values is equally likely, so each pair is an inversion with probability 0.5.',
      `With ${n} elements there are ${total} pairs, so the average number of inversions, and therefore shifts, is ${total} × 0.5 = ${fmt(average)}. This is linearity of expectation: the expected value of a sum is the sum of the expected values, with no independence required.`,
      `The best case is a sorted array: no inversions, 0 shifts. The worst case is a reversed array: every pair is inverted, ${total} shifts, twice the average. Both are marked on the bar.` +
        (params.input === 'reversed' ? ' This array is reversed, so this run is the worst case.' : ''),
    ], { ...base, arcs: allArcs, all: true, bounds: true }, [], 'intro3');

    let shifts = 0;
    ins.forEach((s, k) => {
      const m = s.larger.length, key = s.key, i1 = s.i + 1, anchor = `ins${k}`;
      const pairs = s.larger.map(w => [key, w]);
      const largerPos = [];
      s.before.slice(0, s.i).forEach((v, p) => { if (v > key) largerPos.push(p); });
      const common = { ...base, sorted: s.i, bounds: true, picked: pairs };

      const prefix = s.before.slice(0, s.i).join(' ');
      add(`i = ${i1}: pick up ${key}`, [
        `Key = A[${i1}] = ${key}, held above the array with position ${i1} free. ` +
          (s.i === 1 ? `The prefix ${prefix} is sorted; j starts at position 1.`
                     : `The prefix ${prefix} is sorted; j starts at position ${i1 - 1}.`),
        m ? `${andList(s.larger)} ${m === 1 ? 'is' : 'are'} larger than ${key}, forming ${m === 1 ? 'an inversion' : 'inversions'} (orange), so ${key} takes ${plural(m, 'shift')}.`
          : `Nothing before it is larger, so ${key} takes 0 shifts.`,
        ...(m ? [`Boxed in red in the first grid.`] : []),
      ], {
        ...common, a: s.before, count: shifts, gap: s.i, keyVal: key, j: s.i - 1,
        reg: { i: i1, j: i1 - 1, key }, toKey: largerPos, ends: largerPos,
      }, [0, 1, 2], anchor);

      // While loop: the memory array as the pseudocode leaves it after each shift.
      const mem = s.before.slice(), moved = [];
      let j = s.i - 1;
      while (j >= 0 && mem[j] > key) {
        const w = mem[j], jo = j;                               // 0-based j before this iteration
        mem[j + 1] = mem[j]; moved.push(j + 1); j--;
        shifts++; order.push(pk(key, w));
        if (!perShift) continue;
        const left = largerPos.filter(p => p <= j);
        add(`i = ${i1}: shift ${w} right`, [
          `A[${jo + 1}] = ${w} > ${key}, so ${w} moves to position ${jo + 2} and j drops to ${jo}.`,
          `Position ${jo + 1} still holds a stale copy of ${w}, to be overwritten.`,
          `Fixes the inversion (${w}, ${key}), marked in the second grid. ` +
            (left.length ? `${plural(left.length, 'larger element')} left to pass.` : 'No larger elements left.'),
        ], {
          ...common, a: mem.slice(), count: shifts, gap: jo, keyVal: key, j,
          reg: { i: i1, j: j + 1, key }, moved: moved.slice(), fresh: [[key, w]], toKey: left, ends: left,
        }, [3, 4], anchor);
      }

      // The loop test that failed, then A[j+1] ← key.
      const stop = j < 0
        ? `j = 0, so the loop stops. ${key} is smaller than everything before it.`
        : `A[${j + 1}] = ${mem[j]} ≤ ${key}, so the loop stops.`;
      mem[j + 1] = key;
      const view = {
        ...common, a: mem, sorted: s.i + 1, count: shifts, landed: j + 1, moved, j,
        reg: { i: i1, j: j + 1, key }, fresh: perShift ? [] : pairs,
      };
      const tail = `${shifts} of ${inv} shifts so far. Positions 1–${i1} are sorted.`;
      if (perShift) {
        add(`i = ${i1}: ${m ? 'place' : 'keep'} ${key}`, [
          stop,
          `${key} goes to position ${j + 2} (A[j+1] ← key). ` + (m ? `${plural(m, 'shift')}, one per inversion.` : '0 shifts.'),
          tail,
        ], view, [3, 5], anchor);
      } else {
        add(`i = ${i1}: ${m ? 'insert' : 'keep'} ${key}`, [
          m ? `${plural(m, 'larger element')} (orange) shifted right and ${key} landed at position ${j + 2}. The fixed ${m === 1 ? 'inversion is' : 'inversions are'} marked in the second grid.`
            : `${key} stays at position ${j + 2}; its left neighbor is already smaller.`,
          ...(m ? [stop] : []),
          tail,
        ], view, m ? [3, 4, 5] : [3, 5], anchor);
      }
    });

    add('Result', [
      'The array is sorted and the grids match: one shift per inversion.',
      `This run: ${plural(inv, 'shift')}.`,
      params.input === 'reversed'
        ? `Reversed input is the worst case: every pair is inverted, ${total} shifts.`
        : `The average is ${fmt(average)}, half the worst case of ${total}. Other inputs vary around it.`,
    ], { ...base, a: ins[ins.length - 1].after, sorted: n, count: shifts, bounds: true }, [], 'result');

    add('Running time', [
      'The running time is proportional to n plus the number of shifts.',
      'The average and worst cases both grow with the square of n, written Θ(n²). A sorted array needs no shifts, so it takes only linear time, Θ(n).',
    ], { ...base, a: ins[ins.length - 1].after, sorted: n, count: shifts, bounds: true }, [], 'time');

    // The drawing fits the stage's rendered width (1 unit ≈ 1 CSS px), so text stays readable on phones.
    function draw(svg, idx) {
      const v = steps[idx].view;
      const W = Math.round(Math.min(640, Math.max(300, (svg.getBoundingClientRect().width || 640) - 2)));
      const pad = W < 480 ? 14 : 24;
      // n + 1 slots: slot −1 (left of the array) is where the j pointer goes when j = 0.
      const cw = Math.min(56, (W - 2 * pad + 16) / (n + 1)), bw = cw - Math.max(3, cw * .12);
      const x0 = (W - (n + 1) * cw) / 2 + cw;
      const ch = Math.round(Math.min(48, Math.max(34, bw * 1.15)));
      const fs = bw >= 34 ? 18 : bw >= 26 ? 15 : 13;
      const kGap = 16, y0 = 62 + ch + kGap, keyY = y0 - ch - kGap;
      const cx = p => x0 + cw * (p + .5);
      const box = (x, y, value, { fill = 'var(--node)', stroke = 'var(--ink)', sw = 1.5, dash, faded, text = 'var(--ink)' } = {}) => {
        el('rect', { x: x - bw / 2, y, width: bw, height: ch, rx: 6, fill, stroke, 'stroke-width': sw, ...(dash ? { 'stroke-dasharray': '4 3' } : {}) }, svg);
        el('text', {
          x, y: y + ch / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs, 'font-weight': 700,
          style: `fill:${text}`, ...(faded ? { opacity: .35 } : {}),
        }, svg, value);
      };

      // registers
      if (v.reg) {
        el('text', { x: pad, y: 20, 'dominant-baseline': 'central', 'font-size': 14, style: 'font-family:ui-monospace,monospace;white-space:pre' }, svg,
          `i = ${v.reg.i}   j = ${v.reg.j}   key = ${v.reg.key}`);
      }

      // inversions in the input: arcs between positions
      for (const [p, q] of v.arcs) {
        const h = Math.min(y0 - 30, 14 + 13 * (q - p));
        el('path', {
          d: `M${cx(p)} ${y0} Q${(cx(p) + cx(q)) / 2} ${y0 - 2 * h} ${cx(q)} ${y0}`,
          fill: 'none', stroke: 'var(--orange)', 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: .6,
        }, svg);
      }
      // inversions the key is still in: arcs from each larger element up to the held-aside key
      for (const p of v.toKey) {
        const h = Math.min(30, 8 + 6 * (v.gap - p)), xa = cx(p), xb = cx(v.gap) - bw / 4;
        el('path', {
          d: `M${xa} ${y0} Q${(xa + xb) / 2} ${keyY - h} ${xb} ${keyY}`,
          fill: 'none', stroke: 'var(--orange)', 'stroke-width': 2.5, 'stroke-linecap': 'round',
        }, svg);
      }

      // the array, as stored in memory
      for (let p = 0; p < n; p++) {
        const x = cx(p);
        if (p === v.gap) { box(x, y0, v.a[p], { fill: 'none', stroke: 'var(--muted)', dash: true, faded: true }); continue; }
        const moved = v.moved.includes(p), settled = p < v.sorted, end = v.ends.includes(p);
        if (p === v.landed) el('rect', { x: x - bw / 2 - 4, y: y0 - 4, width: bw + 8, height: ch + 8, rx: 9, fill: 'none', stroke: 'var(--blue)', 'stroke-width': 4, opacity: .5 }, svg);
        box(x, y0, v.a[p], {
          fill: moved ? 'var(--orange)' : settled ? 'var(--blue)' : 'var(--node)',
          stroke: end ? 'var(--orange)' : 'var(--ink)', sw: end ? 4 : 1.5, text: moved ? 'var(--on-orange)' : settled ? 'var(--on-blue)' : 'var(--ink)',
        });
      }
      // the key, held aside above its free slot
      if (v.keyVal !== null) box(cx(v.gap), keyY, v.keyVal, { stroke: 'var(--red)', sw: 3 });

      // positions and the j pointer
      const yIdx = y0 + ch + 14;
      if (v.j !== -1) el('text', { x: cx(-1), y: yIdx, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11, style: 'fill:var(--muted)' }, svg, 'pos');
      for (let p = 0; p < n; p++) {
        el('text', { x: cx(p), y: yIdx, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 12, style: 'fill:var(--muted)' }, svg, p + 1);
      }
      if (v.j !== null) {
        const x = cx(v.j), y = yIdx + 10;
        el('path', { d: `M${x} ${y} l6 9 h-12 z`, fill: 'var(--red)' }, svg);
        el('text', { x, y: y + 20, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--red)' }, svg, 'j');
      }

      // shifts so far vs. the average and worst-case marks
      const bx = pad, bwid = W - 2 * pad, yb = yIdx + 72;
      el('text', { x: bx, y: yb, 'font-size': 14, 'font-weight': 700 }, svg, `Shifts so far: ${v.count}`);
      el('rect', { x: bx, y: yb + 10, width: bwid, height: 14, rx: 4, fill: 'var(--line)' }, svg);
      if (v.count) el('rect', { x: bx, y: yb + 10, width: bwid * v.count / total, height: 14, rx: 4, fill: 'var(--orange)' }, svg);
      if (v.bounds) {
        for (const frac of [.5, 1]) el('line', { x1: bx + bwid * frac, y1: yb + 6, x2: bx + bwid * frac, y2: yb + 28, stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
        el('text', { x: bx + bwid, y: yb, 'text-anchor': 'end', 'font-size': 13 }, svg, `worst n(n−1)/2 = ${total}`);
        el('text', { x: bx + bwid / 2, y: yb + 44, 'text-anchor': 'middle', 'font-size': 13 }, svg, `average n(n−1)/4 = ${fmt(average)}`);
      }

      // legend (always the same items, so the height does not jump between steps)
      const items = [
        ['sorted', 'dot', 'var(--blue)'],
        ['shifted', 'dot', 'var(--orange)'],
        ['key', 'square', 'var(--red)'],
        ['larger than key', 'square', 'var(--orange)'],
        ['free slot', 'dash', 'var(--muted)'],
        ['inversion', 'line', 'var(--orange)'],
      ];
      let x = pad, y = yb + 84;
      for (const [text, kind, color] of items) {
        const wid = 26 + text.length * 7 + 14;
        if (x + wid - 14 > W - pad) { x = pad; y += 24; }
        if (kind === 'line') el('line', { x1: x, y1: y, x2: x + 18, y2: y, stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        else if (kind === 'dot') el('circle', { cx: x + 8, cy: y, r: 7, fill: color }, svg);
        else el('rect', { x: x + 2, y: y - 7, width: 14, height: 14, rx: 3, fill: 'none', stroke: color, 'stroke-width': kind === 'dash' ? 1.5 : 3, ...(kind === 'dash' ? { 'stroke-dasharray': '3 2' } : {}) }, svg);
        el('text', { x: x + 24, y, 'dominant-baseline': 'central', 'font-size': 13 }, svg, text);
        x += wid;
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${y + 18}`);
    }

    // Two triangles over the pairs of values (row x, column y, x < y). First: 1 for every inverted pair in the
    // input, the key's pairs boxed in red. Second: only the inversions fixed so far; the latest ones highlighted.
    const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });
    function grid(title, cell) {
      const fig = node('div', 'arr'), g = node('div', 'tri');
      g.style.gridTemplateColumns = `repeat(${n}, 21px)`;
      g.append(node('span', 'h'));
      for (let y = 2; y <= n; y++) g.append(node('span', 'h', y));
      for (let x = 1; x < n; x++) {
        g.append(node('span', 'h', x));
        for (let y = 2; y <= n; y++) {
          if (y <= x) { g.append(node('span', 'c void')); continue; }
          const [cls, text] = cell(x, y);
          g.append(node('span', `c ${cls}`, text));
        }
      }
      fig.append(node('h4', '', title), g);
      return fig;
    }

    function data(box, idx) {
      const v = steps[idx].view;
      const counted = new Set(order.slice(0, v.count));
      const picked = new Set(v.picked.map(([x, y]) => pk(x, y)));
      const fresh = new Set(v.fresh.map(([x, y]) => pk(x, y)));
      box.replaceChildren(
        node('p', 'note', 'Cell (x, y), x < y, is 1 if y precedes x in the input, an inversion. Indexed by value, not position.'),
        grid(`Inversions in the input: ${inv} of ${total} pairs`, (x, y) => [
          `${bad(x, y) ? 'one' : 'zero'}${picked.has(pk(x, y)) ? ' picked' : ''}`, bad(x, y) ? '1' : '0',
        ]),
        grid(`Fixed so far: ${counted.size} of ${inv}`, (x, y) => counted.has(pk(x, y))
          ? [`one${fresh.has(pk(x, y)) ? ' new' : ''}`, '1'] : ['', '']),
      );
    }

    // One-line state for the collapsed data card.
    function summary(idx) {
      const v = steps[idx].view;
      return `Fixed ${new Set(order.slice(0, v.count)).size} of ${inv} inversions` + (v.fresh.length ? ` · +${v.fresh.length} now` : '');
    }

    return { steps, draw, data, summary };
  }

  VIZ.register({
    id: 'insertion-sort',
    name: 'Insertion Sort',
    kind: 'Sorting problem',
    tagline: 'Average shifts on a random array',
    viewBox: [640, 360],                                        // draw() replaces this to fit the stage width
    code: CODE,
    dataTitle: 'Inversion grids',
    newLabel: 'New input',
    newDisabled: p => p.input === 'reversed',                   // a reversed input is always the same
    newDisabledHint: 'A reversed input is always the same. Switch to Random for a new one.',
    params: [
      { key: 'input', label: 'Input', type: 'select', value: 'random', options: [['random', 'Random'], ['reversed', 'Reversed']] },
      { key: 'size', label: 'Size', type: 'select', value: 'medium', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
      { key: 'skip', label: 'Skip shift steps', type: 'toggle', value: false, keepRun: true },
    ],
    create,
  });
})();
