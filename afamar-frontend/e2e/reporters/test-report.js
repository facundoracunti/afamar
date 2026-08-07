import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function safeListDirs(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
    }
    catch {
        return [];
    }
}
async function safeListFiles(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter((e) => e.isFile()).map((e) => e.name);
    }
    catch {
        return [];
    }
}
function parseShotName(name) {
    const m = name.match(/^shot-(?:cross-)?([a-z0-9-]+?)(?:-([a-z0-9-]+))?$/);
    if (!m)
        return null;
    return { area: m[1] ?? 'general', sector: m[2] ?? 'screenshot' };
}
class TestReport {
    outputFile;
    projectRoot;
    skipAreas;
    tests = [];
    startedAt = Date.now();
    constructor(options = {}) {
        this.outputFile = options.outputFile ?? 'e2e/playwright-report/test_report.html';
        this.projectRoot = options.projectRoot ?? process.cwd();
        this.skipAreas = new Set(options.skipAreas ?? []);
    }
    onBegin(_config, _root) { }
    onTestEnd(test, result) {
        const images = [];
        for (const att of result.attachments) {
            if (att.contentType?.startsWith('image/') && att.body) {
                images.push({ name: att.name, bodyBase64: att.body.toString('base64') });
            }
        }
        const file = path.relative(process.cwd(), test.location.file).replace(/\\/g, '/');
        this.tests.push({
            title: test.title,
            project: test.parent.project()?.name ?? '—',
            file,
            specRel: file,
            status: result.status,
            duration: result.duration,
            errorMessage: result.errors[0]?.message,
            errorStack: result.errors[0]?.stack,
            images,
        });
    }
    async buildCoverage() {
        const srcPages = path.join(this.projectRoot, 'src', 'pages');
        const e2eRoot = path.join(this.projectRoot, 'e2e');
        const pages = await safeListDirs(srcPages);
        const e2eDirs = await safeListDirs(e2eRoot);
        const areaNames = new Set([...pages, ...e2eDirs].filter((n) => !this.skipAreas.has(n)));
        const result = [];
        for (const name of [...areaNames].sort()) {
            const specDir = path.join(e2eRoot, name);
            const specFiles = (await safeListFiles(specDir)).filter((f) => f.endsWith('.spec.ts'));
            const specs = specFiles.map((f) => path.relative(process.cwd(), path.join(specDir, f)).replace(/\\/g, '/'));
            let passed = 0;
            let failed = 0;
            let skipped = 0;
            for (const t of this.tests) {
                if (!specs.includes(t.specRel))
                    continue;
                if (t.status === 'passed')
                    passed++;
                else if (t.status === 'failed' || t.status === 'timedOut')
                    failed++;
                else if (t.status === 'skipped' || t.status === 'interrupted')
                    skipped++;
            }
            let state;
            if (specs.length === 0)
                state = 'missing';
            else if (passed === 0 && failed === 0)
                state = 'empty';
            else if (failed > 0)
                state = passed > 0 ? 'mixed' : 'failed';
            else
                state = 'passed';
            result.push({
                name,
                hasSource: pages.includes(name),
                hasSpec: specs.length > 0,
                specs,
                state,
                passed,
                failed,
                skipped,
            });
        }
        return result;
    }
    async onEnd(_result) {
        await fs.mkdir(path.dirname(this.outputFile), { recursive: true });
        const coverage = await this.buildCoverage();
        await fs.writeFile(this.outputFile, render(this.tests, coverage, this.startedAt), 'utf-8');
        // eslint-disable-next-line no-console
        console.log(`\n  Reporte custom -> ${path.relative(process.cwd(), this.outputFile)}`);
    }
}
function render(tests, coverage, startedAt) {
    const total = tests.length;
    const passed = tests.filter((t) => t.status === 'passed').length;
    const failed = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length;
    const skipped = tests.filter((t) => t.status === 'skipped' || t.status === 'interrupted').length;
    const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
    const byProject = new Map();
    for (const t of tests) {
        const arr = byProject.get(t.project) ?? [];
        arr.push(t);
        byProject.set(t.project, arr);
    }
    const keyShots = new Map();
    for (const t of tests) {
        if (t.status !== 'passed')
            continue;
        for (const img of t.images) {
            const parsed = parseShotName(img.name);
            if (!parsed)
                continue;
            const key = `${parsed.area}::${parsed.sector}`;
            const group = keyShots.get(key) ?? { area: parsed.area, sector: parsed.sector, shots: [] };
            group.shots.push({ project: t.project, bodyBase64: img.bodyBase64 });
            keyShots.set(key, group);
        }
    }
    const shotsByArea = new Map();
    for (const g of keyShots.values()) {
        const arr = shotsByArea.get(g.area) ?? [];
        arr.push(g);
        shotsByArea.set(g.area, arr);
    }
    const areasWithSource = coverage.filter((c) => c.hasSource).length;
    const areasCovered = coverage.filter((c) => c.hasSpec && c.state !== 'missing').length;
    const areasMissing = coverage.filter((c) => c.hasSource && !c.hasSpec);
    const areasFailing = coverage.filter((c) => c.state === 'failed' || c.state === 'mixed');
    const coverageRows = coverage
        .map((c) => {
        const stateBadge = {
            passed: `<span class="badge badge-ok">ok ${c.passed}/${c.passed + c.failed + c.skipped}</span>`,
            failed: `<span class="badge badge-err">fail ${c.failed} failed</span>`,
            mixed: `<span class="badge badge-warn">mixed ${c.passed}P / ${c.failed}F</span>`,
            empty: `<span class="badge badge-muted">sin tests</span>`,
            missing: `<span class="badge badge-err">SIN COBERTURA</span>`,
        }[c.state];
        const sourceTag = c.hasSource ? 'src' : '<span class="muted">-</span>';
        return `<tr class="cov-${c.state}">
      <td><strong>${esc(c.name)}</strong></td>
      <td>${sourceTag}</td>
      <td>${c.specs.length} spec(s)</td>
      <td>${stateBadge}</td>
    </tr>`;
    })
        .join('');
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>E2E Test Report - ${esc(new Date().toLocaleString('es-AR'))}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#f5f7fa;color:#1a202c}
  h1{margin:0 0 4px}
  .meta{color:#718096;margin-bottom:24px}
  .summary{display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap}
  .summary .card{flex:1;min-width:140px;background:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .summary .card .label{font-size:12px;text-transform:uppercase;color:#718096;letter-spacing:.05em}
  .summary .card .value{font-size:28px;font-weight:600;margin-top:4px}
  .passed{color:#38a169}.failed{color:#e53e3e}.skipped{color:#a0aec0}.muted{color:#a0aec0}
  section{background:#fff;padding:20px 24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:24px}
  section h2{margin-top:0}
  .key-shot{margin-bottom:20px}
  .key-shot h3{font-size:14px;margin:0 0 8px;color:#2d3748}
  .label-tag{display:inline-block;background:#edf2f7;color:#4a5568;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:6px}
  .key-shot img,.imgs img{max-width:320px;border:1px solid #e2e8f0;border-radius:4px;margin:4px;vertical-align:top}
  .imgs{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .imgs img{max-width:240px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{background:#edf2f7;font-weight:600}
  tr.fail{background:#fff5f5}tr.pass{background:#f0fff4}
  .status{font-weight:600;font-size:12px;text-transform:uppercase}
  .err{color:#c53030;font-family:'SF Mono',Consolas,monospace;font-size:12px;white-space:pre-wrap;margin-top:4px}
  details summary{cursor:pointer;color:#4a5568;font-size:12px}
  .file{color:#718096;font-size:12px}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
  .badge-ok{background:#c6f6d5;color:#22543d}
  .badge-err{background:#fed7d7;color:#742a2a}
  .badge-warn{background:#feebc8;color:#7b341e}
  .badge-muted{background:#e2e8f0;color:#4a5568}
  tr.cov-passed{background:#f0fff4}
  tr.cov-failed{background:#fff5f5}
  tr.cov-mixed{background:#fffaf0}
  tr.cov-missing{background:#fff5f5;font-weight:600}
  tr.cov-empty{background:#f7fafc;color:#718096}
  .area-block{margin-bottom:24px}
  .area-block h3{font-size:16px;color:#2d3748;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
  .sector-block{margin-left:16px;margin-top:10px;margin-bottom:14px}
  .sector-block h4{font-size:13px;margin:0 0 6px;color:#4a5568;font-weight:600}
</style>
</head>
<body>
  <h1>E2E Test Report</h1>
  <div class="meta">${esc(new Date().toLocaleString('es-AR'))} · ${duration}s total · ${total} tests</div>

  <div class="summary">
    <div class="card"><div class="label">Pasados</div><div class="value passed">${passed}</div></div>
    <div class="card"><div class="label">Fallados</div><div class="value failed">${failed}</div></div>
    <div class="card"><div class="label">Skipped</div><div class="value skipped">${skipped}</div></div>
    <div class="card"><div class="label">Projects</div><div class="value">${byProject.size}</div></div>
    <div class="card"><div class="label">Areas cubiertas</div><div class="value passed">${areasCovered}/${areasWithSource || '-'}</div></div>
  </div>

  ${areasMissing.length > 0 || areasFailing.length > 0
        ? `<section>
    <h2>Areas con problemas</h2>
    ${areasMissing.length > 0 ? `<p><strong>Sin cobertura E2E:</strong> ${areasMissing.map((a) => `<code>${esc(a.name)}</code>`).join(', ')}</p>` : ''}
    ${areasFailing.length > 0 ? `<p><strong>Specs fallando:</strong> ${areasFailing.map((a) => `<code>${esc(a.name)}</code> (${a.failed} failed)`).join(', ')}</p>` : ''}
    <p class="muted">Mapeo canonico <code>src/pages/&lt;area&gt;</code> ↔ <code>e2e/&lt;area&gt;</code>. Ver <code>e2e/COVERAGE.md</code>.</p>
  </section>`
        : ''}

  <section>
    <h2>Matriz de cobertura</h2>
    <table>
      <thead><tr><th>Area</th><th>Fuente</th><th>Specs</th><th>Estado</th></tr></thead>
      <tbody>${coverageRows}</tbody>
    </table>
  </section>

  ${keyShots.size > 0
        ? `<section>
    <h2>Vistas clave (por sector)</h2>
    ${[...shotsByArea.entries()]
            .map(([area, groups]) => `<div class="area-block">
      <h3>${esc(area)}</h3>
      ${groups
            .map((g) => `<div class="sector-block">
        <h4>${esc(g.sector)}</h4>
        ${g.shots
            .map((s) => `<div><span class="label-tag">${esc(s.project)}</span><a href="data:image/png;base64,${s.bodyBase64}" target="_blank"><img src="data:image/png;base64,${s.bodyBase64}" alt="${esc(g.area + '-' + g.sector)}"></a></div>`)
            .join('')}
      </div>`)
            .join('')}
    </div>`)
            .join('')}
  </section>`
        : ''}

  <section>
    <h2>Detalle por project</h2>
    ${[...byProject.entries()]
        .map(([project, ts]) => {
        const projPassed = ts.filter((t) => t.status === 'passed').length;
        return `<h3>${esc(project)} <span class="meta">(${projPassed}/${ts.length} passed)</span></h3>
        <table>
          <thead><tr><th>Test</th><th>Status</th><th>Duracion</th><th>Detalle</th></tr></thead>
          <tbody>
          ${ts
            .map((t) => `<tr class="${t.status === 'passed' ? 'pass' : t.status === 'failed' || t.status === 'timedOut' ? 'fail' : ''}">
              <td>${esc(t.title)}<br><span class="file">${esc(t.file)}</span></td>
              <td><span class="status ${t.status === 'passed' ? 'passed' : t.status === 'failed' || t.status === 'timedOut' ? 'failed' : 'skipped'}">${t.status}</span></td>
              <td>${(t.duration / 1000).toFixed(2)}s</td>
              <td>
                ${t.errorMessage ? `<details><summary>error</summary><div class="err">${esc(t.errorMessage)}${t.errorStack ? '\n\n' + esc(t.errorStack) : ''}</div></details>` : ''}
                ${t.images.length > 0 ? `<div class="imgs">${t.images.map((i) => `<a href="data:image/png;base64,${i.bodyBase64}" target="_blank" title="${esc(i.name)}"><img src="data:image/png;base64,${i.bodyBase64}" alt="${esc(i.name)}"></a>`).join('')}</div>` : ''}
              </td>
            </tr>`)
            .join('')}
          </tbody>
        </table>`;
    })
        .join('')}
  </section>
</body>
</html>`;
}
export default TestReport;
