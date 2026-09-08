'use strict';
/* ============================================================
 * 《餐饮大亨》UI 层：渲染 + 交互（依赖 data.js / engine.js）
 * ============================================================ */

const uiState = { tab: 'overview', expanded: null, wizard: null, assignTo: null, pickDiff: 'normal' };

/* ---------------- 小工具 ---------------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => G.fmt(v);
const signCls = v => v >= 0 ? 'good' : 'bad';
const bar = (pct, cls) => `<div class="bar"><i class="${cls || ''}" style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const stars = v => {
  const full = Math.floor(v), half = v - full >= 0.5;
  return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
};
const repCls = v => v >= 4 ? 'good' : v >= 3 ? 'mid' : 'bad';
const traitName = id => { const t = DATA.traits.find(x => x.id === id); return t ? `${t.emoji}${t.name}` : '—'; };
const cityDef = id => DATA.cities.find(c => c.id === id);
const cuisineDef = id => DATA.cuisines.find(c => c.id === id);
const itemDef = id => { for (const cu in DATA.menuItems) { const it = DATA.menuItems[cu].find(i => i.id === id); if (it) return it; } return null; };
/* 指定难度下的上市门槛（用于文案展示） */
const ipoReqText = diffId => {
  const m = DATA.DIFFS[diffId].ipoMul, b = DATA.BAL.ipo;
  return { stores: Math.ceil(b.stores * m.stores), rep: (b.rep * m.rep).toFixed(2).replace(/\.?0+$/, ''), profit: b.profit6m * m.profit };
};

function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

/* ============================================================
 * 顶栏
 * ============================================================ */
function renderTop() {
  const s = G.state;
  const last = s.history[s.history.length - 1];
  return `
  <div class="topbar">
    <div class="brand">🍜 餐饮大亨 <em class="tag diff">${G.diff().emoji} ${G.diff().name}</em></div>
    <div class="kpis">
      <span class="kpi">💰 <b class="${signCls(s.cash)}">${fmt(s.cash)}</b></span>
      <span class="kpi">📈 上月净利 <b class="${signCls(last ? last.profit : 0)}">${fmt(last ? last.profit : 0)}</b></span>
      <span class="kpi">⭐ 品牌 <b>${s.brandRep.toFixed(2)}</b></span>
      <span class="kpi">📣 知名度 <b>${Math.round(s.fame)}</b></span>
      <span class="kpi">🏪 门店 <b>${s.stores.length}</b></span>
      <span class="kpi">🏦 贷款 <b>${fmt(s.loan)}</b></span>
      ${s.flags.ipo ? '<span class="kpi ipo">🔔 已上市</span>' : ''}
    </div>
    <div class="topbtns">
      <button class="btn primary big" data-act="next" ${s.pending.length ? 'disabled title="先处理待抉择事件"' : ''}>▶ 下一个月</button>
      <button class="btn ghost" data-act="menu-save" title="存档管理">💾</button>
    </div>
  </div>
  <nav class="tabs">
    ${['overview|总览', 'stores|门店', 'expand|扩张', 'hq|总部', 'rivals|竞争', 'achv|成就', 'log|日志']
      .map(x => { const [id, name] = x.split('|'); return `<button class="tab ${uiState.tab === id ? 'on' : ''}" data-act="tab:${id}">${name}${id === 'overview' && s.pending.length ? '<i class="dot"></i>' : ''}</button>`; }).join('')}
  </nav>`;
}

/* ============================================================
 * 总览
 * ============================================================ */
const MILESTONES = [
  { id: 'a_first', text: '开出第一家店', done: s => s.stores.length >= 1 },
  { id: null, text: '单店实现月度盈利', done: s => s.history.some(h => h.profit > 0) },
  { id: 'a_five', text: '连锁化：拥有 5 家门店', done: s => s.stores.length >= 5 },
  { id: 'a_national', text: '进军国内市场', done: s => s.stores.some(x => G.cityOf(x).tier === 2) },
  { id: 'a_ten', text: '拥有 10 家门店', done: s => s.stores.length >= 10 },
  { id: 'a_overseas', text: '扬帆出海', done: s => s.stores.some(x => G.cityOf(x).tier === 3) },
  { id: 'a_ipo', text: '条件达标，上市敲钟', done: s => s.flags.ipo },
  { id: null, text: '无尽模式：做全球第一餐饮集团', done: () => false },
];

function renderOverview() {
  const s = G.state;
  const last = s.history[s.history.length - 1];
  const ms = MILESTONES.find(m => !m.done(s));
  /* 待办提示 */
  const todos = [];
  if (s.pending.length) todos.push(`⚠️ 有 ${s.pending.length} 件待抉择的事等着你拍板`);
  if (s.cash < 0) todos.push('🩸 现金为负！贷款回血或转让亏损店，连续 6 个月负现金流会被清算');
  for (const st of s.stores) {
    if (st.mode === 'dr' && G.staffOf(st, 'manager').length === 0 && st.size >= 1) todos.push(`🧑‍💼 「${st.name}」没有店长，士气会垮`);
    if (st.mode === 'dr' && st.morale < 40) todos.push(`😤 「${st.name}」士气仅 ${Math.round(st.morale)}，加薪或配店长`);
  }
  if (!todos.length) todos.push('✅ 一切正常，安心扩张');
  /* 利润柱状图 */
  const hs = s.history.slice(-18);
  const maxP = Math.max(1, ...hs.map(h => Math.abs(h.profit)));
  const chart = hs.length ? `<div class="chart">${hs.map(h => {
    const h2 = Math.max(2, Math.abs(h.profit) / maxP * 72);
    return `<div class="col" title="${h.label} 净利 ${fmt(h.profit)}"><i class="${h.profit >= 0 ? 'up' : 'down'}" style="height:${h2}px"></i></div>`;
  }).join('')}</div><div class="chart-x"><span>${hs[0].label}</span><span>月度净利</span><span>${hs[hs.length - 1].label}</span></div>` : '<div class="empty">开业后这里会出现利润走势图</div>';
  /* 门店速览（每店只算一次预估） */
  const previews = s.stores.map(st => ({ st, pv: G.previewOf(st) }));
  const rows = previews.map(({ st, pv }) => {
    return `<tr>
      <td>${G.cuisineOf(st).emoji} ${esc(st.name)}${st.mode === 'fr' ? ' <em class="tag fr">加盟</em>' : ''}</td>
      <td>${G.cityOf(st).name}·${G.locOf(st).name}</td>
      <td class="${repCls(st.rep)}">${st.rep.toFixed(2)}★</td>
      <td>≈${Math.round(pv.cust)}客</td>
      <td class="${signCls(pv.profit)}">${fmt(pv.profit)}</td></tr>`;
  }).join('');
  return `
  <div class="grid kpi-cards">
    <div class="card kpi-card"><h4>本月预估营收</h4><div class="big">${fmt(previews.reduce((a, x) => a + x.pv.rev + x.pv.delRev + x.pv.cut, 0))}</div></div>
    <div class="card kpi-card"><h4>上月净利</h4><div class="big ${signCls(last ? last.profit : 0)}">${fmt(last ? last.profit : 0)}</div></div>
    <div class="card kpi-card"><h4>总资产</h4><div class="big">${fmt(G.assets())}</div><small>贷款额度余 ${fmt(G.borrowable())}</small></div>
    <div class="card kpi-card"><h4>研发 / 成就</h4><div class="big">${s.research.done.length}<small>道菜</small> · ${Object.keys(s.achievements).length}<small>项</small></div></div>
  </div>
  <div class="grid2">
    <div class="card">
      <h3>🎯 当前目标</h3>
      <p class="goal">${ms.text}</p>
      ${chart}
    </div>
    <div class="card">
      <h3>📋 经营提醒</h3>
      ${todos.map(t => `<p class="todo">${esc(t)}</p>`).join('')}
      <h3 style="margin-top:14px">📅 ${G.label()}</h3>
      <p class="dim">${DATA.holidayName[s.month] ? '本月是「' + DATA.holidayName[s.month] + '」客流有加成。' : '普通月份。'}月初记得：调价、看招聘、查对手动向，然后点「下一个月」。</p>
    </div>
  </div>
  <div class="card">
    <h3>🏪 门店速览（点击「门店」标签管理）</h3>
    ${s.stores.length ? `<table class="tbl"><tr><th>门店</th><th>位置</th><th>评分</th><th>预估客流</th><th>预估净利</th></tr>${rows}</table>` : '<div class="empty">还没有店，去「扩张」标签开第一家店吧！</div>'}
  </div>
  ${renderHiring()}`;
}

/* ============================================================
 * 招聘（挂在总览页）
 * ============================================================ */
function renderHiring() {
  const s = G.state;
  const roleEmoji = { chef: '👨‍🍳', waiter: '🙋', manager: '🧑‍💼' };
  const mk = s.market.map((c, i) => `<tr>
    <td>${roleEmoji[c.role]} ${G.roleName(c.role)}</td><td>${esc(c.name)}</td><td>${c.stars}★</td><td>${traitName(c.trait)}</td><td>${fmt(c.salary)}/月</td>
    <td><button class="btn mini" data-act="hire:${i}">签下</button></td></tr>`).join('');
  const bench = s.bench.map(w => {
    const base = `<td>🧳 ${G.roleName(w.role)}</td><td>${esc(w.name)}</td><td>${w.stars}★</td><td>${traitName(w.trait)}</td><td>${fmt(w.salary)}/月</td>`;
    if (uiState.assignTo === w.id) {
      const chips = s.stores.filter(x => x.mode === 'dr').map(st => `<button class="btn mini" data-act="assign:${st.id}/${w.id}">${esc(st.name.slice(0, 10))}</button>`).join(' ');
      return `<tr>${base}<td class="ops">${chips || '<span class="dim">暂无直营店</span>'} <button class="btn mini ghost" data-act="bench:${w.id}">取消</button></td></tr>`;
    }
    return `<tr>${base}<td class="ops"><button class="btn mini" data-act="bench:${w.id}" ${s.stores.some(x => x.mode === 'dr') ? '' : 'disabled'}>调派</button>
      <button class="btn mini danger" data-act="fire:/${w.id}">辞退</button></td></tr>`;
  }).join('');
  return `<div class="card">
    <h3>🧑‍💼 招聘市场（每月刷新，签下后进人才库）</h3>
    <table class="tbl slim"><tr><th>岗位</th><th>姓名</th><th>星级</th><th>特长</th><th>要价</th><th></th></tr>${mk || '<tr><td colspan="6" class="empty">本月没人来找工作</td></tr>'}</table>
    ${s.bench.length ? `<h3 style="margin-top:12px">🧳 人才库（${s.bench.length} 人待命，工资照发）</h3>
      <table class="tbl slim"><tr><th>岗位</th><th>姓名</th><th>星级</th><th>特长</th><th>薪资</th><th></th></tr>${bench}</table>` : ''}
  </div>`;
}

/* ============================================================
 * 门店
 * ============================================================ */
function renderStores() {
  const s = G.state;
  if (!s.stores.length) return '<div class="card"><div class="empty">还没有门店。餐饮帝国的第一步：去「扩张」标签找个铺面。</div></div>';
  return s.stores.map(st => storeCard(st)).join('');
}

function storeCard(st) {
  const open = uiState.expanded === st.id;
  const pv = G.previewOf(st);
  const cu = G.cuisineOf(st);
  const head = `
  <div class="card store ${open ? 'open' : ''}" data-store="${st.id}">
    <div class="store-head" data-act="store:${st.id}/toggle">
      <span class="emoji">${cu.emoji}</span>
      <div class="store-title">
        <b>${esc(st.name)}</b>
        <small>${G.cityOf(st).name} · ${G.locOf(st).emoji}${G.locOf(st).name} · ${['小型', '中型', '大型'][st.size]}${st.mode === 'fr' ? ' · <em class="tag fr">加盟</em>' : ''}${st.delivery.on ? ' · <em class="tag dl">外卖中</em>' : ''}</small>
      </div>
      <span class="score ${repCls(st.rep)}">${st.rep.toFixed(2)}★</span>
      <span class="morale ${st.morale < 40 ? 'bad' : st.morale < 55 ? 'mid' : 'good'}">士气 ${Math.round(st.morale)}</span>
      <span class="est">≈ <b class="${signCls(pv.profit)}">${fmt(pv.profit)}</b>/月</span>
      <span class="chev">${open ? '▾' : '▸'}</span>
    </div>`;
  if (!open) return head + '</div>';
  return head + `<div class="store-body">${storeDetail(st, pv)}</div></div>`;
}

function storeDetail(st, pv) {
  const s = G.state;
  const pol = DATA.BAL.salaryPolicies[s.salaryPolicy ?? 1];
  /* 价格段 */
  const ticket = G.ticketOf(st);
  const exp = G.expectation(st.priceLv);
  const priceRow = `
    <div class="rowline"><b>定价：</b>
      ${[0, 1, 2, 3, 4, 5].map(lv => `<button class="chip ${st.priceLv === lv ? 'on' : ''}" data-act="store:${st.id}/price:${lv}">${['乞丐', '经济', '舒适', '精品', '高端', '奢华'][lv]}</button>`).join('')}
      <span class="dim">客单价 ≈${ticket.toFixed(0)} 元 · 该档评分期望 ${exp.toFixed(1)}（当前质量 ${pv.quality.toFixed(1)}）</span></div>`;
  /* 营销 */
  const mktRow = `
    <div class="rowline"><b>营销：</b>
      ${['不投', '传单 0.6万', '本地推广 1.5万', '达人探店 3.5万'].map((n, lv) => `<button class="chip ${st.marketing === lv ? 'on' : ''}" data-act="store:${st.id}/mkt:${lv}">${n}</button>`).join('')}
      <span class="dim">需求预估 ≈${Math.round(pv.demand)} / 接待力 ≈${Math.round(pv.cap || 0)}</span></div>`;
  /* 菜单 */
  const menuRows = (DATA.menuItems[st.cuisineId] || []).map(it => {
    const on = st.menu.includes(it.id);
    const locked = !s.research.done.includes(it.id) && !on;
    return `<button class="mitem ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="store:${st.id}/menu:${it.id}" ${locked ? 'title="需要研发解锁"' : ''}>
      ${it.emoji} ${it.name} <small>${it.appeal}吸${it.rare ? '·稀有' : ''}</small></button>`;
  }).join('');
  const menuRow = `
    <div class="rowline col"><b>菜单（点选上架，已选 ${st.menu.length}；菜越多吸引力越高，但后厨负荷会拖慢出餐）</b>
      <div class="menu-grid">${menuRows}</div>
      <div class="dim">后厨负荷 ${(G.menuLoad(st) * 100).toFixed(0)}% ${G.menuLoad(st) > 1 ? '⚠️ 超载，出餐变慢评分下滑' : ''} · <button class="btn mini" data-act="store:${st.id}/automenu">一键排菜</button></div></div>`;
  /* 设备 */
  const eqRows = DATA.equipment.map(eq => {
    const lv = st.equipment[eq.id] || 0;
    const maxed = lv >= eq.maxLv;
    const cost = maxed ? 0 : eq.costs[lv];
    return `<div class="eqline">
      <span>${eq.emoji} <b>${eq.name}</b> <small>${lv > 0 ? '现役:' + eq.names[lv - 1] : '未购置'}</small></span>
      <span class="dots">${'●'.repeat(lv)}${'○'.repeat(eq.maxLv - lv)}</span>
      <button class="btn mini" data-act="store:${st.id}/equip:${eq.id}" ${maxed || s.cash < cost ? 'disabled' : ''}>${maxed ? '已满级' : `升级 ${fmt(cost)}`}</button></div>`;
  }).join('');
  const addonRow = DATA.addons.map(ad => st.addons[ad.id]
    ? `<span class="tag ok">${ad.emoji} ${ad.name} ✓</span>`
    : `<button class="btn mini" data-act="store:${st.id}/addon:${ad.id}" ${s.cash < ad.cost ? 'disabled' : ''}>${ad.emoji} ${ad.name} ${fmt(ad.cost)}</button>`).join(' ');
  /* 员工 */
  const staffRows = st.staff.map(w => `<tr>
    <td>${{ chef: '👨‍🍳', waiter: '🙋', manager: '🧑‍💼' }[w.role] || '👤'} ${G.roleName(w.role)}</td>
    <td>${esc(w.name)}</td>
    <td>${w.stars}★</td>
    <td>${traitName(w.trait)}</td>
    <td>${fmt(w.salary * pol * (st.salaryBuff || 1))}/月</td>
    <td class="ops">
      <button class="btn mini" data-act="train:${st.id}/${w.id}" ${s.cash < 8000 ? 'disabled' : ''}>培训</button>
      <button class="btn mini" data-act="unassign:${st.id}/${w.id}">调离</button>
      <button class="btn mini danger" data-act="fire:${st.id}/${w.id}">辞退</button></td></tr>`).join('');
  const nc = G.staffOf(st, 'chef').length, needc = G.needChef(st);
  const nw = G.staffOf(st, 'waiter').length, needw = G.needWaiter(st);
  const hasMgr = G.staffOf(st, 'manager').length > 0;
  const staffCard = `
    <div class="card inner"><h4>👥 员工（厨师 ${nc}/${needc} · 服务员 ${nw}/${needw} · 店长 ${hasMgr ? '有' : '⚠️ 无'}）</h4>
    <table class="tbl slim"><tr><th>岗位</th><th>姓名</th><th>星级</th><th>特长</th><th>实发</th><th></th></tr>${staffRows || '<tr><td colspan="6" class="empty">空空如也</td></tr>'}</table>
    <div class="dim">培训一次性 ${fmt(8000)}（培训学院打折）+0.5★；辞退付 1 个月遣散费；人才库在「总览→招聘」下面。</div></div>`;
  /* 外卖 */
  const delRow = st.addons.pack ? `
    <div class="rowline"><b>外卖：</b>
      <button class="chip ${st.delivery.on ? 'on' : ''}" data-act="store:${st.id}/delivery">${st.delivery.on ? '营业中' : '已关闭'}</button>
      ${DATA.BAL.platforms.map(p => `<button class="chip ${st.delivery.platform === p.id ? 'on' : ''}" data-act="store:${st.id}/platform:${p.id}">${p.name}（抽成${Math.round(p.fee * 100)}%）</button>`).join('')}
      <span class="dim">外卖客 ≈${Math.round(pv.delCust)}</span></div>` : '';
  /* 加盟店精简面板 */
  if (st.mode === 'fr') {
    return `${priceRow}<div class="rowline dim">加盟店由加盟老板经营，总部只抽 ${Math.round(DATA.BAL.frCut * 100)}% 流水，不付租金人力；缺点是品控会慢慢下滑，品控实验室可缓解。</div>
      <div class="rowline"><b>操作：</b><button class="btn mini danger" data-act="store:${st.id}/transfer">转让（回笼 ${fmt(st.equipSpent * DATA.BAL.transferRate + DATA.BAL.sizeFit[st.size] * 0.25)}）</button></div>`;
  }
  const benchHire = s.bench.length ? `<div class="rowline"><b>人才库调入：</b>${s.bench.map(w => `<button class="btn mini" data-act="assign:${st.id}/${w.id}">${esc(w.name)} ${w.stars}★</button>`).join(' ')}</div>` : '';
  return `${priceRow}${mktRow}${menuRow}
    <div class="card inner"><h4>🔧 设备与加装</h4>${eqRows}<div class="rowline" style="margin-top:6px">${addonRow}</div></div>
    ${delRow}
    ${staffCard}
    ${benchHire}
    <div class="rowline"><b>操作：</b>
      ${st.size < 2 ? `<button class="btn mini" data-act="store:${st.id}/expand">扩建成${['', '中型', '大型'][st.size + 1]}（${fmt(DATA.BAL.sizeFit[st.size + 1] * DATA.BAL.expandCostMul)}）</button>` : '<span class="tag">已是最大规模</span>'}
      <button class="btn mini" data-act="store:${st.id}/rename">改名</button>
      <button class="btn mini danger" data-act="store:${st.id}/transfer">转让（回笼 ${fmt(st.equipSpent * DATA.BAL.transferRate + DATA.BAL.sizeFit[st.size] * 0.25)}）</button></div>`;
}

/* ============================================================
 * 扩张（城市 + 开店向导）
 * ============================================================ */
function renderExpand() {
  const s = G.state;
  const tiers = [[1, '🏘️ 本地市场'], [2, '🌆 国内市场'], [3, '🌏 海外市场']];
  const wiz = uiState.wizard;
  const wizHtml = wiz ? wizardHtml(wiz) : '';
  const cityCard = c => {
    const un = G.cityUnlockState(c.id);
    const myStores = s.stores.filter(x => x.cityId === c.id).length;
    const taste = Object.entries(c.tastes).map(([k, v]) => v >= 1.2 ? `<em class="tag hot">${{ fast: '快餐', sweet: '甜品', spicy: '辣', light: '清淡', sea: '海鲜', exotic: '异国' }[k]}</em>` : '').join('');
    return `<div class="card city">
      <div class="city-head"><b>${c.name}</b><small>客流 ${c.traffic / 10000}万/月 · 消费力 ${c.spend.toFixed(2)} · 租金 ${fmt(c.rent)}/月${myStores ? ` · 我有 ${myStores} 家店` : ''}</small>${taste}</div>
      ${un.unlocked
        ? `<button class="btn mini primary" data-act="wiz-city:${c.id}">开店选址</button>`
        : `<span class="dim">${un.reason}</span> ${un.reason.startsWith('支付') ? `<button class="btn mini" data-act="unlock:${c.id}" ${s.cash < c.fee ? 'disabled' : ''}>开拓 ${fmt(c.fee)}</button>` : ''}`}
    </div>`;
  };
  return `${wizHtml}` + tiers.map(([t, name]) =>
    `<h3 class="sect">${name}</h3><div class="grid cities">${DATA.cities.filter(c => c.tier === t).map(cityCard).join('')}</div>`).join('');
}

function wizardHtml(w) {
  const pickChip = (cur, val, act, label) => `<button class="chip ${cur === val ? 'on' : ''}" data-act="${act}:${val}">${label}</button>`;
  const locs = w.cityId ? DATA.locations : [];
  const cuisines = w.cityId ? DATA.cuisines : [];
  const canOpen = w.cityId && w.locId && w.cuisineId && w.size != null && w.mode;
  const fit = w.size != null ? DATA.BAL.sizeFit[w.size] : 0;
  const cost = w.mode === 'fr' ? Math.round(fit * DATA.BAL.frSetup) : fit;
  return `<div class="card wizard">
    <h3>🧭 开店向导 ${w.cityId ? '· ' + cityDef(w.cityId).name : ''} <button class="btn mini ghost" data-act="wiz-cancel">收起</button></h3>
    <div class="rowline"><b>城市：</b><span class="tag ok">${w.cityId ? cityDef(w.cityId).name : '未选'}</span></div>
    <div class="rowline"><b>地段：</b>${locs.map(l => pickChip(w.locId, l.id, 'wiz-loc', `${l.emoji}${l.name}`)).join('')}</div>
    ${w.cityId ? `<div class="dim" style="margin:-4px 0 6px 56px">${locs.map(l => `<div>${l.emoji} <b>${l.name}</b>：${l.desc}（客流×${l.traffic} 租金×${l.rent}）</div>`).join('')}</div>` : ''}
    <div class="rowline"><b>菜系：</b>${cuisines.map(cu => pickChip(w.cuisineId, cu.id, 'wiz-cuisine', `${cu.emoji}${cu.name}`)).join('')}</div>
    <div class="rowline"><b>规模：</b>${[0, 1, 2].map(n => pickChip(w.size, n, 'wiz-size', ['小型（装修4万）', '中型（装修8万）', '大型（装修15万）'][n])).join('')}</div>
    <div class="rowline"><b>模式：</b>
      ${pickChip(w.mode, 'dr', 'wiz-mode', '直营（全控全收）')}
      ${G.upLv('u_fc') ? pickChip(w.mode, 'fr', 'wiz-mode', `加盟（只出 ${Math.round(DATA.BAL.frSetup * 100)}% 装修费，抽成 25%）`) : '<span class="dim">加盟需总部升级「加盟管理中心」</span>'}</div>
    <div class="rowline"><b>店名：</b><input id="wiz-name" placeholder="留空自动起名" maxlength="16" style="flex:0 1 220px"></div>
    <div class="rowline">
      <button class="btn primary" data-act="wiz-open" ${!canOpen || G.state.cash < cost ? 'disabled' : ''}>🎬 开张！（${fmt(cost)}）</button>
      ${!canOpen ? '<span class="dim">把城市/地段/菜系/规模/模式都选好</span>' : G.state.cash < cost ? '<span class="dim bad">现金不够装修费</span>' : ''}
    </div></div>`;
}

/* ============================================================
 * 总部
 * ============================================================ */
function renderHQ() {
  const s = G.state;
  /* 供应链 */
  const sup = DATA.suppliers.map(sp => `<div class="card inner sup ${s.supplierId === sp.id ? 'on' : ''}">
    <h4>${sp.emoji} ${sp.name} ${s.supplierId === sp.id ? '<em class="tag ok">当前</em>' : ''}</h4>
    <p class="dim">${sp.desc}</p>
    <button class="btn mini" data-act="supplier:${sp.id}" ${s.supplierId === sp.id ? 'disabled' : ''}>签这家</button></div>`).join('');
  /* 薪酬 */
  const pols = ['抠门（-14% 士气）', '标准', '厚待（+14% 士气）'];
  const polRow = pols.map((n, i) => `<button class="chip ${(s.salaryPolicy ?? 1) === i ? 'on' : ''}" data-act="policy:${i}">${n}</button>`).join(' ');
  /* 升级 */
  const upRows = DATA.upgrades.map(u => {
    const lv = G.upLv(u.id);
    const maxed = lv >= u.lvls.length;
    const reqOk = !u.req || u.req(s);
    const cost = maxed ? 0 : u.lvls[lv];
    return `<div class="card inner up ${maxed ? 'done' : ''}">
      <h4>${u.emoji} ${u.name} <span class="dots">${'●'.repeat(lv)}${'○'.repeat(u.lvls.length - lv)}</span></h4>
      <p class="dim">${u.desc}</p>
      ${maxed ? '<em class="tag ok">已满级</em>' : !reqOk ? '<em class="tag">前置未满足</em>' : `<button class="btn mini" data-act="upgrade:${u.id}" ${s.cash < cost ? 'disabled' : ''}>升级 Lv.${lv + 1}（${fmt(cost)}）</button>`}
    </div>`;
  }).join('');
  /* 研发 */
  const rd = s.research.active;
  const rdRows = DATA.cuisines.map(cu => {
    const all = DATA.menuItems[cu.id] || [];
    const done = all.filter(i => s.research.done.includes(i.id)).length;
    return `<div class="rdline"><span>${cu.emoji} ${cu.name}</span><span class="dots">${'●'.repeat(done)}${'○'.repeat(all.length - done)}</span>
      <button class="btn mini" data-act="research:${cu.id}" ${rd || s.cash < DATA.BAL.researchCost || done >= all.length ? 'disabled' : ''}>${done >= all.length ? '已研透' : '立项 ' + fmt(DATA.BAL.researchCost)}</button></div>`;
  }).join('');
  const rdCard = `<div class="card inner"><h4>🧪 菜品研发（每项 ${DATA.BAL.researchMonths - G.upLv('u_rd')} 个月，出成果三选一）</h4>
    ${rd ? `<p>进行中：${cuisineDef(rd.cuisineId).name}（还差 ${rd.left} 个月）</p>` : ''}
    ${rdRows}</div>`;
  /* 金融 */
  const finCard = `<div class="card inner"><h4>🏦 银行贷款</h4>
    <p>当前贷款 <b>${fmt(s.loan)}</b> · 月利率 ${(G.loanRate() * 100).toFixed(2)}% · 还可借 <b>${fmt(G.borrowable())}</b></p>
    <div class="rowline">
      <button class="btn mini" data-act="borrow:100000" ${G.borrowable() < 100000 ? 'disabled' : ''}>借 10 万</button>
      <button class="btn mini" data-act="borrow:500000" ${G.borrowable() < 500000 ? 'disabled' : ''}>借 50 万</button>
      <button class="btn mini" data-act="borrow:full" ${G.borrowable() <= 0 ? 'disabled' : ''}>借满</button>
      <button class="btn mini" data-act="repay:all" ${s.loan <= 0 || s.cash <= 0 ? 'disabled' : ''}>还贷</button>
    </div></div>
    <div class="card inner"><h4>📣 品牌广告（月花 ${fmt(DATA.BAL.brandAdCost)}，知名度 +${DATA.BAL.brandAdFame}/月）</h4>
      <button class="chip ${s.brandAd ? 'on' : ''}" data-act="brandad">${s.brandAd ? '投放中（点击停）' : '未投放'}</button></div>`;
  /* IPO */
  const chk = G.ipoCheck();
  const ipoCard = `<div class="card inner ipo"><h4>🔔 上市敲钟（终局目标，之后转无尽模式）</h4>
    <ul class="checklist">${chk.miss.length ? chk.miss.map(m => `<li>○ ${m}</li>`).join('') : '<li class="ok">✓ 全部条件达成，随时可以敲钟！</li>'}</ul>
    <button class="btn primary" data-act="ipo" ${!chk.ok ? 'disabled' : ''}>申请上市</button></div>`;
  return `
  <h3 class="sect">🚚 供应链</h3><div class="grid3">${sup}</div>
  <h3 class="sect">👷 薪酬策略（全局）</h3><div class="rowline">${polRow}</div>
  <h3 class="sect">🏢 总部升级</h3><div class="grid3">${upRows}</div>
  <div class="grid2"><div>${rdCard}</div><div>${finCard}${ipoCard}</div></div>`;
}

/* ============================================================
 * 竞争
 * ============================================================ */
function renderRivals() {
  const s = G.state;
  const cards = s.rivals.map(r => {
    const meta = DATA.rivals.find(x => x.id === r.id);
    const price = G.rivalPrice(r.id);
    if (!r.alive) return `<div class="card rival dead"><h4>${meta.emoji} ${meta.name}</h4><p class="dim">已退出市场${s.flags.acquired ? '（被你收购）' : '（破产）'}</p></div>`;
    return `<div class="card rival">
      <h4>${meta.emoji} ${meta.name} <em class="tag">${{ volume: '低价走量', premium: '高端精品', expand: '激进扩张', hype: '营销轰炸' }[meta.strategy]}</em></h4>
      <p class="dim">${meta.desc}</p>
      <div class="rowline"><span>实力 ${Math.round(r.strength)}</span>${bar(r.strength / 2.2, 'rival')}</div>
      <div class="rowline"><span>评分 ${r.rep.toFixed(1)}★</span><span>门店 ${r.stores.length} 家</span></div>
      ${r.discount ? '<em class="tag hot">资金链紧张：收购打 75 折！</em>' : ''}
      <button class="btn mini" data-act="rival-buy:${r.id}" ${s.cash < price ? 'disabled' : ''}>收购（${fmt(price)}）</button>
    </div>`;
  }).join('');
  /* 城市争夺 */
  const cityRows = DATA.cities.map(c => {
    const mine = s.stores.filter(x => x.cityId === c.id).length;
    const theirs = s.rivals.filter(r => r.alive).reduce((a, r) => a + r.stores.filter(x => x.cityId === c.id).length, 0);
    const total = mine + theirs;
    return { c, mine, theirs, total };
  }).filter(x => x.total > 0).sort((a, b) => (b.theirs + b.mine) - (a.theirs + a.mine)).slice(0, 10)
    .map(x => `<div class="rowline"><span class="w80">${x.c.name}</span>${bar(x.total ? x.mine / x.total * 100 : 0, 'mine')}<small class="dim">我 ${x.mine} : 敌 ${x.theirs}</small></div>`).join('');
  return `<div class="grid3">${cards}</div><div class="card"><h3>🗺️ 城市攻防（门店数对比）</h3>${cityRows || '<div class="empty">还没有交战城市</div>'}<p class="dim">对手在你有店的城市发动价格战、挖角时，会弹出抉择事件，见招拆招。</p></div>`;
}

/* ============================================================
 * 成就 / 日志
 * ============================================================ */
function renderAchv() {
  const s = G.state;
  return `<div class="grid3">${DATA.achievements.map(a => {
    const got = !!s.achievements[a.id];
    return `<div class="card achv ${got ? 'got' : ''}"><h4>${got ? '🏆' : '🔒'} ${a.name}</h4><p class="dim">${a.desc}</p></div>`;
  }).join('')}</div>`;
}
function renderLog() {
  return `<div class="card">${G.state.log.map(l => `<p class="logline"><b>${l.t}</b> ${l.icon} ${esc(l.text)}</p>`).join('') || '<div class="empty">还没有故事</div>'}</div>`;
}

/* ============================================================
 * 结算弹窗 / 抉择 / 全屏画面
 * ============================================================ */
function showSettlement(report) {
  const s = G.state;
  const k = report.kpi;
  const pendingHtml = s.pending.map(p => pendingCard(p)).join('');
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal wide">
    <h2>📊 ${report.label} · 月度财报</h2>
    <div class="grid settle-kpis">
      <div><small>总营收</small><b>${fmt(k.rev)}</b></div>
      <div><small>总成本</small><b>${fmt(k.cost)}</b></div>
      <div><small>净利</small><b class="${signCls(k.profit)}">${fmt(k.profit)}</b></div>
      <div><small>客流</small><b>${Math.round(k.cust)}</b></div>
      <div><small>现金</small><b class="${signCls(k.cash)}">${fmt(k.cash)}</b></div>
    </div>
    ${report.rows.length ? `<table class="tbl slim"><tr><th>门店</th><th>营收</th><th>净利</th><th>客流</th><th>评分</th></tr>
      ${report.rows.map(r => `<tr><td>${r.emoji} ${esc(r.name)}</td><td>${fmt(r.rev)}</td><td class="${signCls(r.profit)}">${fmt(r.profit)}</td><td>${r.cust}</td><td class="${repCls(r.rep)}">${r.rep.toFixed(2)}★${r.d >= 0.02 ? ' ↑' : r.d <= -0.02 ? ' ↓' : ''}</td></tr>`).join('')}</table>` : ''}
    ${(report.events.length || report.rivals.length || report.notes.length) ? `<div class="evbox">${report.notes.map(t => `<p>📌 ${t}</p>`).join('')}${report.events.map(t => `<p>${esc(t)}</p>`).join('')}${report.rivals.map(t => `<p class="rival">${esc(t)}</p>`).join('')}</div>` : ''}
    ${pendingHtml ? `<h3>⏸️ 待你拍板（${s.pending.length} 件）</h3>${pendingHtml}` : ''}
    <div class="modal-ops"><button class="btn primary" data-act="close-modal" ${s.pending.length ? 'disabled' : ''}>${s.pending.length ? '先处理上面的事' : '知道了，继续经营'}</button></div>
  </div></div>`;
}

function pendingCard(p) {
  if (p.kind === 'research') {
    const opts = p.options.map(id => { const it = itemDef(id); return { label: `${it.emoji} ${it.name}（吸引 ${it.appeal}${it.rare ? ' · 稀有' : ''}）` }; });
    return `<div class="card inner pend"><h4>🧪 研发出成果！三选一：</h4>
      <div class="rowline">${opts.map((o, i) => `<button class="btn" data-act="pend:${p.uid}:${i}">${o.label}</button>`).join('')}</div></div>`;
  }
  const ev = DATA.events.find(e => e.id === p.evId);
  const ctx = p.ctx || {};
  const text = ev && ev.text ? ev.text(ctx.store || ctx.cityName || ctx) : '';
  return `<div class="card inner pend"><h4>${p.icon} ${p.name}</h4><p>${esc(text)}</p>
    <div class="rowline">${(ev.choices || []).map((c, i) => `<button class="btn" data-act="pend:${p.uid}:${i}">${esc(c.label)}</button>`).join('')}</div></div>`;
}

function resolvePendInModal(uid, idx) {
  const r = G.resolvePending(uid, idx);
  if (r.ok) toast(r.text);
  const s = G.state;
  if (s.pending.length) showSettlement({ label: G.label(), kpi: lastKpi(), rows: [], events: [], rivals: [], notes: [] });
  else { $('#modal-root').innerHTML = ''; render(); }
}
let _lastKpi = null;
const lastKpi = () => _lastKpi || { rev: 0, cost: 0, profit: 0, cust: 0, cash: G.state.cash };

function showGameOver() {
  const s = G.state;
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal">
    <h2>💀 破产清算</h2>
    <p>经营到 ${G.label()}，现金见底、无力回天。这一局你开出过 <b>${s.stores.length}</b> 家店，解锁 <b>${Object.keys(s.achievements).length}</b> 项成就。</p>
    <p class="dim">餐饮最难的不是把店开起来，是让每个月的账都平。</p>
    <div class="modal-ops"><button class="btn primary" data-act="restart">重开一局</button></div>
  </div></div>`;
}

function showIpo(res) {
  const s = G.state;
  const score = Math.min(100, Math.round(s.stores.length * 2 + s.brandRep * 10 + G.assets() / 1000000 * 0.5));
  const grade = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : 'C';
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal">
    <h2>🔔 敲钟！${esc(G.state.stores[0] ? '从一家小店到上市公司' : '餐饮帝国')}</h2>
    <p>市值估值 <b class="good">${fmt(res.valuation)}</b>，IPO 募资 <b class="good">${fmt(res.injection)}</b> 已到账。</p>
    <p>评级：<b class="good big">${grade}</b>（评分 ${score}）</p>
    <p class="dim">上市不是终点：股价随业绩波动，你可以继续开店、并购、出海，冲击更大的市值。</p>
    <div class="modal-ops"><button class="btn primary" data-act="close-modal">继续经营（无尽模式）</button></div>
  </div></div>`;
}

function showSaveMenu() {
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal">
    <h2>💾 存档管理</h2>
    <p class="dim">游戏每月自动存到浏览器（localStorage）。换设备可以用下面的导出/导入搬档。</p>
    <div class="rowline">
      <button class="btn" data-act="export">导出存档（复制到剪贴板）</button>
      <button class="btn" data-act="import">从剪贴板导入</button>
      <button class="btn danger" data-act="reset">重开新局</button>
    </div>
    <textarea id="savebox" placeholder="导出的存档会出现在这里；导入时把存档粘贴进这里再点导入"></textarea>
    <div class="modal-ops"><button class="btn ghost" data-act="close-modal">关闭</button></div>
  </div></div>`;
}

function showIntro() {
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal wide">
    <h2>🍜 欢迎开《餐饮大亨》！</h2>
    <p>你揣着一笔本钱，要从街边小店干成全球餐饮帝国。先选个开局难度：</p>
    <div class="grid3 diffcards">${diffCards()}</div>
    <ul class="intro">
      <li>🧭 先去<b>「扩张」</b>开第一家店：选地段 → 菜系 → 规模，装修费一次性扣</li>
      <li>🏪 店开起来后进<b>「门店」</b>：定价、排菜单、买设备、招人，门店卡片点开有全部操作</li>
      <li>▶️ 每月决策做完点<b>「下一个月」</b>统一结算：财报、随机事件、对手动作一起看</li>
      <li>⭐ 评分看质量配不配得上这个价：升质量才能涨定价，评分高了客人才多</li>
      <li>⚔️ 对手会开店、打价格战、挖你的人；有钱了反过来<b>收购他们</b></li>
      <li>🔔 终局目标：门店 ≥${ipoReqText(uiState.pickDiff).stores} + 品牌 ${ipoReqText(uiState.pickDiff).rep} 分 + 月均净利 ${fmt(ipoReqText(uiState.pickDiff).profit)} → <b>上市敲钟</b>，之后无尽模式</li>
    </ul>
    <div class="modal-ops"><button class="btn primary" data-act="start-diff">开干！</button></div>
  </div></div>`;
}

function diffCards() {
  return Object.values(DATA.DIFFS).map(d => `
    <div class="card inner diffcard ${uiState.pickDiff === d.id ? 'on' : ''}" data-act="pick-diff:${d.id}">
      <h4>${d.emoji} ${d.name} ${uiState.pickDiff === d.id ? '<em class="tag ok">已选</em>' : ''}</h4>
      <p class="dim">${d.desc}</p>
      <small>开局 ${fmt(Math.round(DATA.BAL.startCash * d.startCashMul))} · 客流 ×${d.demandMul} · 成本 ×${d.costMul} · 对手 ×${d.rivalAggrMul}</small>
    </div>`).join('');
}

function showDiffPicker() {
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal">
    <h2>🎯 选择开局难度</h2>
    <div class="grid3 diffcards">${diffCards()}</div>
    <p class="dim">上市门槛只在简单模式降低（12 店 / 品牌 3.7 / 月均 24 万），标准与困难都是 15 店 / 4.0 / 30 万——困难模式难在过程，不在终点。</p>
    <div class="modal-ops">
      <button class="btn ghost" data-act="close-modal">再想想</button>
      <button class="btn primary" data-act="start-diff">就这个难度，开干！</button>
    </div>
  </div></div>`;
}

/* ============================================================
 * 渲染总入口
 * ============================================================ */
function render() {
  const s = G.state;
  $('#top').innerHTML = renderTop();
  const body = { overview: renderOverview, stores: renderStores, expand: renderExpand, hq: renderHQ, rivals: renderRivals, achv: renderAchv, log: renderLog }[uiState.tab]();
  $('#content').innerHTML = body;
  if (s.flags.over && !$('#modal-root .overlay')) showGameOver();
}

/* ============================================================
 * 事件派发
 * ============================================================ */
function act(a) {
  const s = G.state;
  /* 统一解析：带 '/' 的动作键在 '/' 前，其余在第一个 ':' 前；无分隔符则整串是键 */
  let key, rest;
  const si = a.indexOf('/'), ci = a.indexOf(':');
  if (si >= 0 && (ci < 0 || si < ci)) { key = a.slice(0, si); rest = a.slice(si + 1); }
  else if (ci >= 0) { key = a.slice(0, ci); rest = a.slice(ci + 1); }
  else { key = a; rest = ''; }

  if (key === 'tab') { uiState.tab = rest; render(); return; }
  if (key === 'next') { doAdvance(); return; }
  if (key === 'close-modal') { $('#modal-root').innerHTML = ''; render(); return; }
  if (key === 'menu-save') { showSaveMenu(); return; }
  if (key === 'pick-diff') { uiState.pickDiff = rest; showDiffPicker(); return; }
  if (key === 'start-diff') {
    G.resetGame(undefined, uiState.pickDiff);
    if (!G.state.flags.started) { G.state.flags.started = true; G.save(); }
    $('#modal-root').innerHTML = '';
    render();
    toast(`${G.diff().emoji} ${G.diff().name}开局，${fmt(G.state.cash)}本钱到手`);
    return;
  }
  if (key === 'restart') { const d = G.state.diff; G.resetGame(undefined, d); G.state.flags.started = true; G.save(); $('#modal-root').innerHTML = ''; render(); toast(`${G.diff().emoji} ${G.diff().name}新的一局，开始吧`); return; }
  if (key === 'reset') { confirmBox('重开新局？当前进度会被覆盖（建议先导出存档）。', () => { uiState.pickDiff = G.state.diff || 'normal'; showDiffPicker(); }); return; }
  if (key === 'export') { const box = $('#savebox'); box.value = G.exportSave(); box.select(); try { document.execCommand('copy'); toast('存档已复制到剪贴板'); } catch (e) { toast('已生成，请手动复制', true); } return; }
  if (key === 'import') { const box = $('#savebox'); if (!box.value.trim()) { toast('先把存档粘贴进输入框', true); return; } const r = G.importSave(box.value.trim()); toast(r.msg, !r.ok); if (r.ok) { $('#modal-root').innerHTML = ''; render(); } return; }

  if (key === 'store') {
    const [id, sub] = [parseInt(rest), rest.slice(rest.indexOf('/') + 1)];
    const st = G.storeById(id);
    if (!st) return;
    if (sub === 'toggle') { uiState.expanded = uiState.expanded === id ? null : id; render(); return; }
    const ci = sub.indexOf(':');
    const cmd = ci >= 0 ? sub.slice(0, ci) : sub;
    const val = ci >= 0 ? sub.slice(ci + 1) : '';
    if (cmd === 'price') G.setPrice(id, parseInt(val));
    else if (cmd === 'mkt') G.setMarketing(id, parseInt(val));
    else if (cmd === 'menu') {
      const on = st.menu.includes(val);
      const next = on ? st.menu.filter(x => x !== val) : st.menu.concat([val]);
      if (next.length) { const r = G.setMenu(id, next); if (!r.ok) toast(r.msg, true); }
    }
    else if (cmd === 'automenu') { const r = G.autoMenu(id); toast(r.msg || '已排菜', !r.ok); }
    else if (cmd === 'equip') { const r = G.buyEquipment(id, val); toast(r.msg || (r.ok ? '购置成功' : '买不起'), !r.ok); }
    else if (cmd === 'addon') { const r = G.buyAddon(id, val); toast(r.msg, !r.ok); }
    else if (cmd === 'delivery') G.toggleDelivery(id, !st.delivery.on);
    else if (cmd === 'platform') G.toggleDelivery(id, st.delivery.on, val);
    else if (cmd === 'expand') { const r = G.expandStore(id); toast(r.msg, !r.ok); }
    else if (cmd === 'rename') { const n = prompt('新店名（16 字内）', st.name); if (n) { G.renameStore(id, n); } }
    else if (cmd === 'transfer') confirmBox(`转让「${st.name}」？回笼资金后店就没了。`, () => { const r = G.transferStore(id); toast(r.msg, !r.ok); uiState.expanded = null; render(); });
    render(); return;
  }
  if (key === 'train') { const [sid, wid] = rest.split('/').map(Number); const r = G.trainStaff(sid, wid); toast(r.msg || (r.ok ? '培训完成' : '失败'), !r.ok); render(); return; }
  if (key === 'unassign') { const [sid, wid] = rest.split('/').map(Number); const r = G.unassign(sid, wid); toast(r.ok ? '已调入人才库' : '操作失败', !r.ok); render(); return; }
  if (key === 'hire') { const r = G.hire(parseInt(rest), null); toast(r.msg, !r.ok); render(); return; }
  if (key === 'bench') { uiState.assignTo = uiState.assignTo === parseInt(rest) ? null : parseInt(rest); render(); return; }
  if (key === 'assign') { const [sid, wid] = rest.split('/').map(Number); const r = G.assign(sid, wid); uiState.assignTo = null; toast(r.msg || (r.ok ? '调派完成' : '失败'), !r.ok); render(); return; }
  if (key === 'fire') { const [sid, wid] = rest.split('/').map(Number); confirmBox('辞退要付 1 个月工资作遣散费，确定？', () => { const r = G.fireStaff(sid || null, wid); toast(r.msg || '已辞退', !r.ok); render(); }); return; }

  if (key === 'wiz-city') { uiState.wizard = { cityId: rest, locId: null, cuisineId: null, size: null, mode: null }; render(); return; }
  if (key === 'wiz-loc') { uiState.wizard.locId = rest; render(); return; }
  if (key === 'wiz-cuisine') { uiState.wizard.cuisineId = rest; render(); return; }
  if (key === 'wiz-size') { uiState.wizard.size = parseInt(rest); render(); return; }
  if (key === 'wiz-mode') { uiState.wizard.mode = rest; render(); return; }
  if (key === 'wiz-cancel') { uiState.wizard = null; render(); return; }
  if (key === 'wiz-open') {
    const w = uiState.wizard;
    const name = ($('#wiz-name') && $('#wiz-name').value.trim()) || '';
    const r = G.openStore({ cityId: w.cityId, locId: w.locId, cuisineId: w.cuisineId, size: w.size, mode: w.mode, name });
    toast(r.msg || (r.ok ? '开业大吉' : '开不了'), !r.ok);
    if (r.ok) { uiState.wizard = null; uiState.tab = 'stores'; uiState.expanded = r.store.id; }
    render(); return;
  }
  if (key === 'unlock') { const r = G.unlockCity(rest); toast(r.msg, !r.ok); render(); return; }

  if (key === 'supplier') { G.setSupplier(rest); toast('供应商已换'); render(); return; }
  if (key === 'policy') { G.setSalaryPolicy(parseInt(rest)); render(); return; }
  if (key === 'upgrade') { const r = G.buyUpgrade(rest); toast(r.msg, !r.ok); render(); return; }
  if (key === 'research') { const r = G.startResearch(rest); toast(r.msg, !r.ok); render(); return; }
  if (key === 'brandad') { const r = G.toggleBrandAd(); toast(r.ok ? (s.brandAd ? '广告已停' : '广告投放中') : r.msg, !r.ok); render(); return; }
  if (key === 'borrow') { const amt = rest === 'full' ? G.borrowable() : parseInt(rest); const r = G.borrow(amt); toast(r.msg, !r.ok); render(); return; }
  if (key === 'repay') { const r = G.repay(Math.min(s.loan, Math.max(0, s.cash))); toast(r.msg, !r.ok); render(); return; }
  if (key === 'ipo') { const r = G.startIPO(); if (r.ok) showIpo(r); else toast(r.msg, true); render(); return; }
  if (key === 'rival-buy') {
    const price = G.rivalPrice(rest);
    confirmBox(`出价 ${fmt(price)} 收购这家连锁？接手的门店会并进你的版图。`, () => { const r = G.buyRival(rest); toast(r.msg, !r.ok); render(); });
    return;
  }
  if (key === 'pend') { const [uid, idx] = [rest.slice(0, rest.lastIndexOf(':')), parseInt(rest.slice(rest.lastIndexOf(':') + 1))]; resolvePendInModal(uid, idx); return; }
}

function doAdvance() {
  const s = G.state;
  if (s.pending.length) { toast('还有事等你拍板', true); return; }
  const report = G.advanceMonth();
  if (!report) return;
  _lastKpi = report.kpi;
  if (s.flags.over) { showGameOver(); return; }
  showSettlement(report);
  render();
}

function confirmBox(text, onOk) {
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal">
    <p>${esc(text)}</p>
    <div class="modal-ops"><button class="btn danger" id="cf-ok">确定</button><button class="btn ghost" data-act="close-modal">取消</button></div>
  </div></div>`;
  $('#cf-ok').onclick = () => { $('#modal-root').innerHTML = ''; onOk(); };
}

/* ---------------- 启动 ---------------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  act(el.getAttribute('data-act'));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const ov = $('#modal-root .overlay'); if (ov && !G.state.pending.length) { $('#modal-root').innerHTML = ''; render(); } }
});

G.boot();
if (!G.state.flags.started) {
  showIntro(); // 首局先选难度，点「开干」才正式开局（start-diff 里置 started 并存档）
} else if (G.state.pending.length) {
  showSettlement({ label: G.label(), kpi: lastKpi(), rows: [], events: [], rivals: [], notes: [] });
}
render();
