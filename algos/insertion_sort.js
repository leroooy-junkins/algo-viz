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
      'Insertion sort puts an array in order by taking the elements one at a time, left to right. Each one (the key) is held aside while every larger element before it moves one slot right; then the key drops into the gap. Each one-slot move is a shift, and shifts are most of the work.',
      'Question: on a randomly shuffled array of n elements, how many shifts does insertion sort make on average?',
      'Approach: count the pairs of elements that are in the wrong order (inversions). Each shift fixes exactly one such pair, so shifts = inversions. In a random shuffle each pair is in the wrong order half the time, so the average is half of all pairs.',
    ], { ...base }, [], 'intro0');

    add('Inversions', [
      'An inversion is a pair of elements in the wrong order: the larger one comes first. The two do not have to be next to each other.',
      'Example: in 3 1 2 the inversions are (3, 1) and (3, 2); the pair (1, 2) is in order. A sorted array has no inversions. A reversed array has every pair inverted: n(n−1)/2 of them.',
      `This array has ${plural(inv, 'inversion')} out of ${total} pairs. Each is drawn as an arc joining the two elements.`,
    ], { ...base, arcs: allArcs, all: true }, [], 'intro1');

    add('Each shift fixes one inversion', [
      'A shift moves one larger element one slot right, past the key. That swaps the order of just those two elements, so it fixes exactly one inversion and leaves every other pair as it was.',
      'When the sort ends the array is sorted, with no inversions left. So the total number of shifts equals the number of inversions in the starting array.',
      'The grids in the data panel track this: the first marks every inverted pair in the input, the second the ones fixed so far. They match when the sort ends.',
    ], { ...base, arcs: allArcs, all: true }, [3, 4], 'intro2');

    add('The average is half of all pairs', [
      'In a random shuffle, for any two values the smaller is just as likely to come first as the larger. So each pair is an inversion with probability ½.',
      `There are n(n−1)/2 = ${total} pairs (n = ${n}). Averages add up across pairs (linearity of expectation, which holds even though the pairs are not independent), so the average number of inversions, and so of shifts, is ${total} × ½ = ${fmt(average)} = n(n−1)/4.`,
      `The worst case is a reversed array: every pair is an inversion, so n(n−1)/2 = ${total} shifts, twice the average. Both are marked on the bar.` +
        (params.input === 'reversed' ? ' This array is reversed, so this run hits the worst case, not the average.' : ''),
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
        `The key is A[${i1}] = ${key}. It is held aside above the array, leaving position ${i1} free (dashed). ` +
          (s.i === 1 ? `The element before it, ${prefix}, is sorted on its own; j starts there, at position 1.`
                     : `The elements before it, ${prefix}, are already sorted; j starts at the last of them, position ${i1 - 1}.`),
        m ? `${andList(s.larger)} ${m === 1 ? 'is' : 'are'} larger than ${key}. ${m === 1 ? 'That pair is an inversion' : 'Each of those pairs is an inversion'} (orange ${m === 1 ? 'arc' : 'arcs'}), so inserting ${key} takes ${plural(m, 'shift')}.`
          : `Nothing before it is larger than ${key}, so ${key} is in no inversions yet and inserting it takes 0 shifts.`,
        ...(m ? [`${m === 1 ? 'The pair is' : 'The pairs are'} boxed in red in the first grid.`] : []),
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
          `A[${jo + 1}] = ${w} is larger than the key ${key}, so ${w} shifts one slot right, into position ${jo + 2}, and j moves left to ${jo}.`,
          `Position ${jo + 1} (dashed) still holds an old copy of ${w}; the next shift or the key will overwrite it.`,
          `This shift fixes the inversion (${w}, ${key}), now marked in the second grid. ` +
            (left.length ? `${plural(left.length, 'larger element')} still to pass.` : 'No larger elements left to pass.'),
        ], {
          ...common, a: mem.slice(), count: shifts, gap: jo, keyVal: key, j,
          reg: { i: i1, j: j + 1, key }, moved: moved.slice(), fresh: [[key, w]], toKey: left, ends: left,
        }, [3, 4], anchor);
      }

      // The loop test that failed, then A[j+1] ← key.
      const stop = j < 0
        ? `j = 0: there is nothing left to compare, so the loop stops. ${key} is smaller than everything before it.`
        : `A[${j + 1}] = ${mem[j]} is smaller than the key ${key}, so the loop stops.`;
      mem[j + 1] = key;
      const view = {
        ...common, a: mem, sorted: s.i + 1, count: shifts, landed: j + 1, moved, j,
        reg: { i: i1, j: j + 1, key }, fresh: perShift ? [] : pairs,
      };
      const tail = `Shifts so far: ${shifts} of the ${inv} inversions in this array. Positions 1–${i1} are now sorted.`;
      if (perShift) {
        add(`i = ${i1}: ${m ? 'place' : 'keep'} ${key}`, [
          stop,
          `The key ${key} drops into the free slot, position ${j + 2} (A[j+1] ← key). ` + (m ? `It took ${plural(m, 'shift')}, one per inversion it was in.` : 'Nothing moved: 0 shifts.'),
          tail,
        ], view, [3, 5], anchor);
      } else {
        add(`i = ${i1}: ${m ? 'insert' : 'keep'} ${key}`, [
          m ? `${plural(m, 'larger element')} (orange) ${m === 1 ? 'shifts' : 'shift'} one slot right, and the key ${key} drops into position ${j + 2}. Each shift fixes one inversion; ${m === 1 ? 'it is' : 'they are'} now marked in the second grid.`
            : `${key} stays at position ${j + 2}: the element to its left is already smaller, so the loop stops at once.`,
          ...(m ? [stop] : []),
          tail,
        ], view, m ? [3, 4, 5] : [3, 5], anchor);
      }
    });

    add('Result', [
      'The array is sorted, so no inversions are left. Each one was fixed by exactly one shift, so the two grids match.',
      `This run: ${plural(inv, 'shift')}, one per inversion.`,
      params.input === 'reversed'
        ? `Reversed array: every pair is an inversion, so this is the worst case, n(n−1)/2 = ${total}.`
        : `On a random shuffle each pair is an inversion with probability ½, so the average is n(n−1)/4 = ${fmt(average)} shifts, half the worst case of ${total}. New input gives a different count with the same average.`,
    ], { ...base, a: ins[ins.length - 1].after, sorted: n, count: shifts, bounds: true }, [], 'result');

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
      const box = (x, y, value, { fill = 'var(--node)', stroke = 'var(--ink)', sw = 1.5, dash, faded, light } = {}) => {
        el('rect', { x: x - bw / 2, y, width: bw, height: ch, rx: 6, fill, stroke, 'stroke-width': sw, ...(dash ? { 'stroke-dasharray': '4 3' } : {}) }, svg);
        el('text', {
          x, y: y + ch / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs, 'font-weight': 700,
          style: `fill:${light ? 'var(--on-fill)' : 'var(--ink)'}`, ...(faded ? { opacity: .35 } : {}),
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
          stroke: end ? 'var(--orange)' : 'var(--ink)', sw: end ? 4 : 1.5, light: moved || settled,
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
        node('p', 'note', 'Each cell is a pair of values: row x, column y, with x < y (values, not positions). 1 means y comes before x in the input: an inversion.'),
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
