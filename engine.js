'use strict';
/* ============================================================
 * 《餐饮大亨》纯逻辑引擎（无 DOM，node 可加载）
 * 对外暴露 G（浏览器挂 window.G / node 走 global.G 与 module.exports）
 * ============================================================ */
(function () {
  const BAL = DATA.BAL;

  /* ---------------- 种子随机 ---------------- */
  let _s = 1;
  function seedRng(seed) { _s = (seed >>> 0) || 1; }
  function rnd() { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const chance = p => rnd() < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- 小工具 ---------------- */
  const find = (arr, id) => arr.find(x => x.id === id);
  const cityById = id => find(DATA.cities, id);
  const locById = id => find(DATA.locations, id);
  const cuisineById = id => find(DATA.cuisines, id);
  const supplierById = id => find(DATA.suppliers, id);
  const platformById = id => find(BAL.platforms, id);
  const itemById = id => { for (const cu in DATA.menuItems) { const it = DATA.menuItems[cu].find(i => i.id === id); if (it) return it; } return null; };
  const itemCuisine = id => { for (const cu in DATA.menuItems) if (DATA.menuItems[cu].some(i => i.id === id)) return cu; return null; };
  const randName = () => pick(DATA.surnames) + pick(DATA.givens);
  const sizeName = ['小型', '中型', '大型'];

  /* ---------------- 引擎对象 ---------------- */
  const G = {

    /* ========== 生命周期 ========== */
    newGame(seed, difficulty) {
      const diff = DATA.DIFFS[difficulty] ? difficulty : 'normal';
      seedRng(seed ?? (Date.now() & 0xffffffff));
      const s = {
        ver: BAL.version,
        seed: _s,
        diff,
        year: BAL.startYear, month: BAL.startMonth, turn: 0,
        cash: Math.round(BAL.startCash * DATA.DIFFS[diff].startCashMul), loan: 0,
        fame: 5, brandRep: 2.5,
        seq: 1,
        stores: [], bench: [], market: [],
        research: { done: [], active: null },
        supplierId: 's_std',
        upgrades: {}, brandAd: false,
        unlocked: DATA.cities.filter(c => c.fee === 0).map(c => c.id),
        rivals: DATA.rivals.map(r => ({
          id: r.id, strength: r.strength, rep: r.rep, aggr: r.aggr,
          alive: true, discount: 0,
          stores: Array.from({ length: rint(2, 4) }, () => ({ cityId: pick(DATA.cities.filter(c => c.tier <= 2)).id, tag: pick(DATA.cuisines).tag })),
        })),
        mods: [], pending: [], log: [],
        achievements: {},
        flags: { over: false, ipo: false, acquired: 0, hadLoan: false, negStreak: 0, started: false },
        history: [],
      };
      this.state = s;
      this.refreshMarket(4, 0);
      this.log2('🍜', `白手起家（${DATA.DIFFS[diff].emoji}${DATA.DIFFS[diff].name}），兜里揣着 ${this.fmt(s.cash)}，第一件事：找个铺面开张。`);
      this.save();
      return s;
    },

    state: null,

    /* ========== 查询辅助 ========== */
    cityOf(st) { return cityById(st.cityId); },
    locOf(st) { return locById(st.locId); },
    cuisineOf(st) { return cuisineById(st.cuisineId); },
    storeById(id) { return this.state.stores.find(s => s.id === id); },
    supplier() { return supplierById(this.state.supplierId); },
    upLv(id) { return this.state.upgrades[id] || 0; },
    /* 当前难度参数（旧档无 diff 字段按标准算） */
    diff() { return DATA.DIFFS[(this.state && this.state.diff) || 'normal'] || DATA.DIFFS.normal; },
    /* 当前实际月利率（含难度与供应链金融） */
    loanRate() { return (this.upLv('u_scf') ? 0.009 : BAL.loanRate) * this.diff().loanRateMul; },
    staffOf(st, role) { return st.staff.filter(x => x.role === role); },
    needChef(st) { return BAL.sizeChef[st.size]; },
    needWaiter(st) { return BAL.sizeWaiter[st.size]; },
    countFranchise() { return this.state.stores.filter(x => x.mode === 'fr').length; },
    frCap() { return BAL.frCap; },

    addLog(icon, text) { this.state.log.unshift({ icon, text, t: this.label() }); if (this.state.log.length > 80) this.state.log.pop(); },
    log2(icon, text) { this.addLog(icon, text); },

    label() { const s = this.state; return `${s.year}年${s.month}月`; },

    /* ========== 数值核心 ========== */
    modMul(type, targetId) {
      let m = 1;
      for (const mod of this.state.mods) {
        if (mod.type !== type) continue;
        if (targetId != null && mod.targetId != null && mod.targetId !== targetId) continue;
        m *= mod.mul;
      }
      return m;
    },

    ingQuality() { return clamp(this.supplier().ing + this.upLv('u_ck') * 0.08, 0, 1); },

    costMul() { return this.diff().costMul; },

    costRateOf(st) {
      const cu = this.cuisineOf(st);
      let adj = 0;
      for (const id of st.menu) { const it = itemById(id); if (it) adj += it.cost; }
      return Math.max(0.15, cu.costRate * this.supplier().costMul
        * (1 - 0.06 * this.upLv('u_ck')) * (1 - 0.04 * this.upLv('u_scf'))
        * (1 + adj) * this.modMul('food_cost') * this.costMul());
    },

    menuLoad(st) {
      let prep = 0;
      for (const id of st.menu) { const it = itemById(id); if (it) prep += it.prep; }
      const chefs = this.staffOf(st, 'chef').length;
      return prep / (6 + (st.equipment.kitchen || 0) * 3 + chefs * 2);
    },

    qualityOf(st) {
      const chefs = this.staffOf(st, 'chef');
      const need = this.needChef(st);
      const cov = clamp(chefs.length / need, 0, 1);
      const avgStars = chefs.length ? chefs.reduce((a, c) => a + c.stars, 0) / chefs.length : 0;
      let q = BAL.qBase + Math.min(2.0, avgStars * cov * BAL.qChef)
        + (st.equipment.kitchen || 0) * BAL.qKitchen
        + (st.equipment.hygiene || 0) * BAL.qHygiene
        + (st.equipment.front || 0) * BAL.qFront
        + this.ingQuality() * BAL.qIng
        + Math.min(BAL.qRichCap, Math.max(0, st.menu.length - 2) * BAL.qRichItem);
      for (const c of st.staff) if (c.trait === 'tongue') q += 0.15;
      q += this.upLv('u_star') * 0.3;
      const load = this.menuLoad(st);
      if (load > 1) q -= (load - 1) * 0.8;
      q *= 0.85 + st.morale / 100 * 0.25;
      const mgr = this.staffOf(st, 'manager')[0];
      if (mgr) q += mgr.stars * 0.04;
      return clamp(q, 0.5, 5.2);
    },

    expectation(lv) { return BAL.expBase + BAL.expStep * lv; },

    ticketOf(st) {
      const cu = this.cuisineOf(st);
      let t = cu.ticket * (BAL.ticketBase + BAL.ticketStep * st.priceLv);
      t *= 1 + (st.equipment.front || 0) * 0.03;
      for (const w of st.staff) if (w.trait === 'social') t *= 1.03;
      return t;
    },

    capacityOf(st) {
      const load = this.menuLoad(st);
      const lf = load <= 1 ? 1 : Math.max(0.4, 1 - (load - 1) * 0.6);
      let eq = 1 + (st.equipment.kitchen || 0) * 0.13 + (st.equipment.smart || 0) * 0.09 + (st.addons.terrace ? 0.12 : 0);
      for (const c of st.staff) if (c.trait === 'speed') { eq *= 1.10; break; }
      const mgr = this.staffOf(st, 'manager')[0];
      const chefFac = clamp(this.staffOf(st, 'chef').length / this.needChef(st), 0.3, 1.15);
      const waiterFac = clamp(this.staffOf(st, 'waiter').length / this.needWaiter(st), 0.3, 1.1);
      const moraleFac = 0.80 + st.morale / 100 * 0.25;
      return BAL.sizeSeats[st.size] * eq * (mgr ? 1 + mgr.stars * 0.04 : 1) * chefFac * waiterFac * moraleFac * lf;
    },

    pressureOf(cityId, tag) {
      let p = 0;
      for (const r of this.state.rivals) {
        if (!r.alive) continue;
        for (const rs of r.stores) {
          if (rs.cityId !== cityId) continue;
          p += r.strength / 100 * 0.018 * (rs.tag === tag ? 1 : 0.55);
        }
      }
      return Math.min(BAL.rivalShareMax, p * this.diff().pressureMul);
    },

    demandOf(st) {
      const city = this.cityOf(st), loc = this.locOf(st), cu = this.cuisineOf(st);
      const taste = city.tastes[cu.tag] || 1;
      const season = (DATA.season[cu.tag] && DATA.season[cu.tag][this.state.month]) || 1;
      const holiday = DATA.holiday[this.state.month] || 1;
      let seasonMul = season * holiday;
      if (loc.id === 'l_scenic') seasonMul *= ([7, 8].includes(this.state.month)) ? 1.2 : ([12, 1, 2].includes(this.state.month)) ? 0.72 : 1;
      const effTicket = this.ticketOf(st);
      const afford = effTicket / (BAL.priceRef * Math.pow(city.spend, 1.5));
      const priceFactor = clamp(BAL.priceBase - BAL.priceSlope * Math.log2(Math.max(0.3, afford)) + (st.rep - BAL.repRef) * BAL.repPriceBonus, 0.3, 1.8);
      const repF = Math.pow(st.rep / BAL.repRef, BAL.repExp);
      let mkt = 1 + BAL.mktMul * st.marketing * (this.upLv('u_bd') ? 1.3 : 1);
      for (const w of st.staff) if (w.trait === 'hype') { mkt *= 1.2; break; }
      const fameF = 1 + this.state.fame / BAL.fameDiv;
      const rival = 1 - this.pressureOf(st.cityId, cu.tag);
      const fr = st.mode === 'fr' ? 0.9 : 1;
      return city.traffic * loc.traffic * taste * BAL.shareBase * BAL.sizeDraw[st.size] * repF * priceFactor * mkt * fameF * rival * seasonMul
        * this.diff().demandMul
        * this.modMul('demand') * this.modMul('demand_city', st.cityId) * this.modMul('demand_store', st.id) * fr;
    },

    rentOf(st) {
      const city = this.cityOf(st), loc = this.locOf(st);
      return city.rent * BAL.sizeRentMul[st.size] * loc.rent * this.modMul('rent_city', st.cityId) * this.costMul();
    },

    laborOf(st) {
      const pol = BAL.salaryPolicies[this.state.salaryPolicy ?? 1];
      let sum = 0;
      for (const w of st.staff) {
        let sal = w.salary * pol * (st.salaryBuff || 1);
        if (w.trait === 'cheap') sal *= 0.8;
        sum += sal;
      }
      return sum * (1 - 0.08 * this.upLv('u_sched')) * this.costMul();
    },

    mktCost(lv) { return [0, 6000, 15000, 35000][lv] || 0; },

    /* 单店单月完整测算（不落账），preview 与结算共用 */
    computeStoreMonth(st) {
      const demand = this.demandOf(st);
      const ticket = this.ticketOf(st);
      const out = { demand, ticket, cust: 0, rev: 0, delCust: 0, delRev: 0, delFee: 0, cut: 0, food: 0, rent: 0, labor: 0, mkt: 0, dep: 0, util: 0, cost: 0, profit: 0, quality: this.qualityOf(st), exp: this.expectation(st.priceLv) };
      if (st.mode === 'fr') {
        out.cust = Math.min(demand, BAL.sizeSeats[st.size] * 1.1);
        out.cut = out.cust * ticket * BAL.frCut;
        out.profit = out.cut;
        return out;
      }
      const cap = this.capacityOf(st);
      out.cust = Math.min(demand, cap);
      out.cap = cap;
      out.rev = out.cust * ticket;
      if (st.delivery.on && st.addons.pack) {
        const plat = platformById(st.delivery.platform || 'p_rider');
        out.delCust = Math.min(demand * BAL.deliveryShare * plat.reach * this.modMul('delivery'), out.cust * 0.5);
        out.delRev = out.delCust * ticket * 0.9;
        out.delFee = out.delRev * plat.fee;
      }
      out.food = out.rev * this.costRateOf(st);
      out.rent = this.rentOf(st);
      out.labor = this.laborOf(st);
      out.mkt = this.mktCost(st.marketing);
      out.dep = st.equipSpent / BAL.depMonths;
      out.util = BAL.sizeUtil[st.size] * this.costMul();
      out.cost = out.food + out.rent + out.labor + out.mkt + out.dep + out.util + out.delFee;
      out.profit = out.rev + out.delRev - out.cost;
      return out;
    },

    /* 模糊预览：没大数据中心时数字带 ±15% 噪声（每店每月固定） */
    previewOf(st) {
      const r = this.computeStoreMonth(st);
      if (this.upLv('u_bd')) return r;
      const h = Math.abs(Math.sin((st.id * 131 + this.state.turn * 17))) * 0.30 - 0.15;
      const fz = v => v * (1 + h);
      return { ...r, demand: fz(r.demand), cust: fz(r.cust), rev: fz(r.rev), profit: fz(r.profit), cap: fz(r.cap), delCust: fz(r.delCust), fuzzy: true };
    },

    /* ========== 月度结算 ========== */
    advanceMonth() {
      const s = this.state;
      if (s.flags.over) return null;
      s.turn++; s.month++;
      if (s.month > 12) { s.month = 1; s.year++; }
      const report = { label: this.label(), events: [], rivals: [], notes: [], rows: [] };
      const notes = [];
      if (DATA.holidayName[s.month]) notes.push(`${DATA.holidayName[s.month]}，客流有加成`);

      /* 1) 随机事件（先落 modifier，再算账） */
      this.rollEvents(report);

      /* 2) 逐店结算 */
      let totRev = 0, totDel = 0, totCut = 0, totCost = 0, totCust = 0, totFood = 0;
      for (const st of s.stores) {
        const r = this.computeStoreMonth(st);
        st.last = { ...r, turn: s.turn };
        s.cash += r.profit;
        if (st.mode === 'dr') { totRev += r.rev; totDel += r.delRev - r.delFee; totCost += r.cost; totFood += r.food; }
        else totCut += r.cut;
        totCust += r.cust;
        /* 口碑演化 */
        let target = clamp(3.2 + (r.quality - r.exp) * 1.6, 1, 5);
        if (st.mode === 'fr') target = clamp(target - BAL.frDrift / (this.upLv('u_qc') ? Math.pow(2, this.upLv('u_qc')) : 1) * 10, 1, 5);
        const d = (target - st.rep) * BAL.repSpeed + (rnd() - 0.5) * 0.1;
        st.rep = clamp(st.rep + d, 1, 5);
        report.rows.push({ id: st.id, name: st.name, emoji: this.cuisineOf(st).emoji, rev: r.rev + r.delRev + r.cut, profit: r.profit, cust: Math.round(r.cust), rep: st.rep, d });
        /* 士气与离职 */
        if (st.mode === 'dr') {
          const pol = s.salaryPolicy ?? 1;
          const mgr = this.staffOf(st, 'manager')[0];
          const util = cap => cap > 0 ? r.cust / cap : 0;
          let mt = BAL.moraleTarget + (pol - 1) * 14 + (mgr ? mgr.stars * 2.5 : -2) + (st.equipment.hygiene || 0) * 1.5;
          if (st.staff.some(x => x.trait === 'steady')) mt += 4;
          if (util(st.last.cap) > 0.97) mt -= 4;
          st.morale = clamp(st.morale + (clamp(mt, 10, 100) - st.morale) * 0.3, 10, 100);
          const pQuit = st.morale < 30 ? 0.28 : st.morale < 45 ? 0.08 : 0.02;
          if (st.staff.length > 0 && chance(pQuit)) {
            const i = Math.floor(rnd() * st.staff.length);
            const who = st.staff.splice(i, 1)[0];
            report.events.push(`😞 「${st.name}」的${this.roleName(who.role)}${who.name}（${who.stars}★）撂挑子走人了`);
          }
        }
      }

      /* 3) 总部开销 / 利息 / 分红 */
      const upTotal = Object.values(s.upgrades).reduce((a, b) => a + b, 0);
      const hq = BAL.hqOverhead + BAL.hqPerUpgrade * upTotal + (s.brandAd ? BAL.brandAdCost : 0);
      const interest = s.loan * this.loanRate();
      let dividend = 0;
      for (const m of s.mods) if (m.type === 'dividend') dividend += m.mul;
      s.cash -= hq + interest + dividend;
      totCost += hq + interest + dividend;

      /* 4) 对手行动 */
      this.rivalsAct(report);

      /* 5) 研发 */
      if (s.research.active) {
        s.research.active.left--;
        if (s.research.active.left <= 0) {
          const opts = this.rollResearchOptions(s.research.active.cuisineId);
          if (opts.length) {
            s.pending.push({ uid: 'p' + s.seq++, kind: 'research', cuisineId: s.research.active.cuisineId, options: opts, icon: '🧪', name: '研发出成果' });
            notes.push('研发结题，等你在成果里三选一');
          } else notes.push('研发结题：这个菜系已经全部研究透了');
          s.research.active = null;
        } else notes.push(`研发进行中（还差 ${s.research.active.left} 个月）`);
      }

      /* 6) 招聘市场刷新 */
      this.refreshMarket(4, this.upLv('u_ta'));

      /* 7) modifier 到期 / 知名度 / 品牌分 */
      s.mods = s.mods.filter(m => --m.months > 0);
      s.fame = clamp(s.fame - BAL.fameDecay + (s.brandAd ? BAL.brandAdFame : 0) + (this.upLv('u_pr') ? 1 : 0), 0, 100);
      let wsum = 0, wrep = 0;
      for (const st of s.stores) { const w = st.mode === 'fr' ? 0.5 : 1; wsum += w; wrep += st.rep * w; }
      const bTarget = wsum ? wrep / wsum + s.fame * 0.004 : 2.5;
      s.brandRep = clamp(s.brandRep + (clamp(bTarget, 1, 5) - s.brandRep) * 0.35, 1, 5);

      /* 8) 历史 / 成就 / 破产 */
      const profit = totRev + totDel + totCut - totCost;
      s.history.push({ label: report.label, rev: totRev + totDel + totCut, cost: totCost, profit, cust: totCust });
      if (s.history.length > BAL.historyLen) s.history.shift();
      report.kpi = { rev: totRev + totDel + totCut, cost: totCost, profit, cust: totCust, cash: s.cash, food: totFood, hq, interest, dividend };
      this.checkAchievements(report);
      /* 破产判定 */
      if (s.cash < 0) {
        s.flags.negStreak++;
        if ((this.borrowable() <= 0 && s.stores.length === 0) || s.flags.negStreak >= BAL.bankruptMonths) {
          s.flags.over = true;
          this.addLog('💀', '资不抵债，餐饮帝国梦碎。重开一局吧。');
        } else if (s.flags.negStreak === 1) {
          report.events.push('⚠️ 现金转负！尽快贷款回血或收缩战线，连续 6 个月负现金流会被清算');
        }
      } else s.flags.negStreak = 0;

      report.notes = notes;
      this.save();
      return report;
    },

    roleName(role) { return { chef: '厨师', waiter: '服务员', manager: '店长' }[role] || role; },

    /* ========== 事件系统 ========== */
    rollEvents(report) {
      const s = this.state;
      const pool = DATA.events.filter(e => e.weight > 0 && (!e.cond || e.cond(this)));
      const r = rnd();
      const count = r < 0.15 ? 0 : r < 0.72 ? 1 : 2;
      const poolRest = pool.slice();
      for (let i = 0; i < count; i++) {
        const got = this.weightedPick(poolRest);
        if (!got) break;
        poolRest.splice(got.i, 1);
        const ev = got.ev;
        if (!ev) break;
        const ctx = {};
        if (ev.target === 'city') {
          const ids = [...new Set(s.stores.map(x => x.cityId))];
          if (!ids.length) continue;
          ctx.cityId = pick(ids);
          ctx.cityName = cityById(ctx.cityId).name;
        } else if (ev.target === 'store') {
          const drs = s.stores.filter(x => x.mode === 'dr');
          if (!drs.length) continue;
          ctx.store = pick(drs);
          ctx.storeId = ctx.store.id;
        }
        if (ev.choices) {
          s.pending.push({ uid: 'p' + s.seq++, kind: 'event', evId: ev.id, ctx, icon: ev.icon, name: ev.name });
        } else {
          const text = ev.fx(this, ctx);
          if (text) { report.events.push(text); this.addLog(ev.icon, text); }
        }
      }
    },

    weightedPick(pool) {
      const total = pool.reduce((a, e) => a + e.weight, 0);
      let x = rnd() * total;
      for (let i = 0; i < pool.length; i++) { x -= pool[i].weight; if (x <= 0) return { ev: pool[i], i }; }
      return { ev: pool[pool.length - 1], i: pool.length - 1 };
    },

    setPending(p) { this.state.pending.push({ uid: 'p' + this.state.seq++, kind: 'event', evId: 'ev_inspect_c', ctx: p, icon: p.icon, name: '食安整改' }); },

    /* 抉择事件/研发三选一 的落子入口，返回结果文本 */
    resolvePending(uid, choiceIdx) {
      const s = this.state;
      const i = s.pending.findIndex(p => p.uid === uid);
      if (i < 0) return { ok: false, text: '' };
      const p = s.pending.splice(i, 1)[0];
      if (p.kind === 'research') {
        const itemId = p.options[choiceIdx];
        if (!itemId) return { ok: false, text: '' };
        s.research.done.push(itemId);
        const it = itemById(itemId);
        this.addLog('🧪', `研发成功：「${it.name}」${it.emoji} 已可上架`);
        this.save();
        return { ok: true, text: `「${it.name}」研发成功，可在该菜系门店上架了！` };
      }
      const ev = find(DATA.events, p.evId);
      let text;
      if (ev.choices) text = (ev.choices[choiceIdx] ? ev.choices[choiceIdx].fx(this, p.ctx) : '') || '处理完毕';
      else text = ev.fx(this, p.ctx) || '处理完毕';
      this.addLog(ev.icon, text);
      this.save();
      return { ok: true, text };
    },

    addMod(type, targetId, mul, months, name) { this.state.mods.push({ type, targetId, mul, months, name }); },
    spendCash(v) { this.state.cash -= v; },
    gainCash(v) { this.state.cash += v; },
    bumpStoreRep(st, d) {
      if (!st) return;
      if (d < 0) d *= this.diff().badMul * (this.upLv('u_pr') ? 0.6 : 1); // 困难更疼、简单更宽容；公关部再砍四成
      st.rep = clamp(st.rep + d, 1, 5);
    },

    /* ========== 对手 AI ========== */
    rivalsAct(report) {
      const s = this.state;
      for (const r of s.rivals) {
        if (!r.alive) continue;
        const dMeta = this.diff();
        const growth = ({ volume: 0.5, premium: 0.35, expand: 0.7, hype: 0.45 }[find(DATA.rivals, r.id).strategy] || 0.5) * dMeta.rivalGrowMul;
        let d = growth + (rnd() - 0.5) * 2.4;
        if (s.stores.length > r.stores.length * 3) d += 0.5;
        r.strength = clamp(r.strength + d, 10, 220);
        const vol = r.id === 'rv_wh' ? 0.15 : 0.08;
        r.rep = clamp(r.rep + (rnd() - 0.5) * 2 * vol, 2, 4.8);
        if (chance(r.aggr * dMeta.rivalAggrMul * 0.28)) {
          const tierW = DATA.cities.filter(c => c.tier <= 3);
          const city = pick(tierW);
          r.stores.push({ cityId: city.id, tag: pick(DATA.cuisines).tag });
          r.strength = Math.max(10, r.strength - 3);
          report.rivals.push(`${find(DATA.rivals, r.id).emoji} ${find(DATA.rivals, r.id).name} 在${city.name}新开了一家店`);
        }
        if (r.id === 'rv_wh' && chance(0.15)) { s.fame = Math.max(0, s.fame - 2); report.rivals.push('📸 网红食验室又搞了一波营销，你的知名度 -2'); }
        if (r.strength < 15 && chance(0.2)) {
          r.alive = false;
          report.rivals.push(`💀 ${find(DATA.rivals, r.id).name} 资金链断裂，宣布破产清算`);
          this.addLog('💀', `${find(DATA.rivals, r.id).name}破产了，市场空了出来`);
        }
      }
    },

    rivalPrice(id) {
      const meta = find(DATA.rivals, id);
      const r = this.state.rivals.find(x => x.id === id);
      return Math.round((r.stores.length * 350000 + r.strength * 5000) * (r.discount ? 0.75 : 1));
    },

    buyRival(id) {
      const s = this.state;
      const meta = find(DATA.rivals, id);
      const r = s.rivals.find(x => x.id === id);
      if (!r || !r.alive) return { ok: false, msg: '对方已经不在了' };
      const price = this.rivalPrice(id);
      if (s.cash < price) return { ok: false, msg: `现金不够，还差 ${this.fmt(price - s.cash)}` };
      s.cash -= price;
      r.alive = false;
      s.flags.acquired++;
      let absorbed = 0;
      for (const rs of r.stores) {
        const cu = pick(DATA.cuisines.filter(c => c.tag === rs.tag));
        if (!cu) continue;
        if (!s.unlocked.includes(rs.cityId)) s.unlocked.push(rs.cityId);
        const st = this.makeStore(rs.cityId, pick(DATA.locations).id, cu.id, 1, 'dr', `${find(DATA.rivals, r.id).name}吞并店`);
        st.rep = clamp(r.rep * 0.9, 1, 5);
        st.morale = 50;
        s.stores.push(st);
        absorbed++;
      }
      this.addLog('🤝', `收购${meta.name}完成，接手 ${absorbed} 家门店（含未开拓城市据点）`);
      return { ok: true, msg: `收购成功！接手 ${absorbed} 家门店`, price };
    },

    grantFranchise() {
      const s = this.state;
      const cityIds = s.unlocked.length ? s.unlocked : DATA.cities.filter(c => c.tier === 1).map(c => c.id);
      const cityId = pick(cityIds);
      const cu = pick(DATA.cuisines);
      const st = this.makeStore(cityId, pick(DATA.locations).id, cu.id, 1, 'fr', `${cu.name}·${cityById(cityId).name.slice(0, 2)}加盟店`);
      s.stores.push(st);
      this.addLog('🤝', `「${st.name}」加盟挂牌，总部坐收 25% 流水`);
      return st;
    },

    /* ========== 研发 ========== */
    rollResearchOptions(cuisineId) {
      const s = this.state;
      const all = DATA.menuItems[cuisineId] || [];
      const avail = all.filter(i => !s.research.done.includes(i.id));
      if (!avail.length) return [];
      const rareBoost = 1 + this.upLv('u_rd');
      const weighted = [];
      for (const it of avail) for (let k = 0; k < (it.rare ? rareBoost : 3); k++) weighted.push(it);
      const opts = [];
      while (opts.length < 3 && weighted.length) {
        const it = pick(weighted);
        if (!opts.includes(it.id)) opts.push(it.id);
        if (new Set(opts).size === avail.length) break;
      }
      return opts;
    },
    startResearch(cuisineId) {
      const s = this.state;
      if (s.research.active) return { ok: false, msg: '已有研发在进行' };
      const avail = (DATA.menuItems[cuisineId] || []).filter(i => !s.research.done.includes(i.id));
      if (!avail.length) return { ok: false, msg: '该菜系已全部研透' };
      if (s.cash < BAL.researchCost) return { ok: false, msg: '现金不足' };
      s.cash -= BAL.researchCost;
      s.research.active = { cuisineId, left: Math.max(1, BAL.researchMonths - this.upLv('u_rd')) };
      return { ok: true, msg: '研发立项' };
    },

    /* ========== 招聘 / 员工 ========== */
    salaryOf(role, stars) {
      const base = { chef: 7500, waiter: 4200, manager: 11000 }[role];
      return Math.round(base * [0, 0.7, 1.0, 1.45, 2.0, 2.8][stars]);
    },
    refreshMarket(n, academy) {
      const s = this.state;
      s.market = [];
      for (let i = 0; i < n; i++) {
        const role = chance(0.40) ? 'chef' : chance(0.75) ? 'waiter' : 'manager';
        let r = rnd() - (academy >= 1 ? 0.08 : 0) - (academy >= 2 ? 0.06 : 0);
        const stars = r < 0.25 ? 1 : r < 0.60 ? 2 : r < 0.85 ? 3 : r < 0.97 ? 4 : 5;
        s.market.push({ id: s.seq++, role, name: randName(), stars, salary: this.salaryOf(role, stars), trait: chance(0.5) ? pick(DATA.traits).id : null });
      }
    },
    hire(idx, storeId) {
      const s = this.state;
      const c = s.market[idx];
      if (!c) return { ok: false, msg: '候选人不存在' };
      s.market.splice(idx, 1);
      const staff = { id: s.seq++, role: c.role, name: c.name, stars: c.stars, salary: c.salary, trait: c.trait };
      if (storeId) {
        const st = this.storeById(storeId);
        if (!st || st.mode === 'fr') { s.bench.push(staff); return { ok: true, msg: '加盟店不归你派人，进了人才库' }; }
        st.staff.push(staff);
        return { ok: true, msg: `${c.name} 入职「${st.name}」` };
      }
      s.bench.push(staff);
      return { ok: true, msg: `${c.name} 进入人才库` };
    },
    assign(storeId, staffId) {
      const s = this.state;
      const i = s.bench.findIndex(x => x.id === staffId);
      if (i < 0) return { ok: false, msg: '人才库没这个人' };
      const st = this.storeById(storeId);
      if (!st || st.mode === 'fr') return { ok: false, msg: '目标门店不可派员' };
      st.staff.push(s.bench.splice(i, 1)[0]);
      return { ok: true, msg: '调派完成' };
    },
    unassign(storeId, staffId) {
      const st = this.storeById(storeId);
      if (!st) return { ok: false };
      const i = st.staff.findIndex(x => x.id === staffId);
      if (i < 0) return { ok: false };
      this.state.bench.push(st.staff.splice(i, 1)[0]);
      return { ok: true };
    },
    fireStaff(scopeId, staffId) {
      const s = this.state;
      let list, inStore = null;
      if (scopeId) { const st = this.storeById(scopeId); list = st.staff; inStore = st; }
      else list = s.bench;
      const i = list.findIndex(x => x.id === staffId);
      if (i < 0) return { ok: false };
      const who = list.splice(i, 1)[0];
      s.cash -= who.salary; // 一个月遣散费
      if (inStore) inStore.morale = clamp(inStore.morale - 4, 10, 100);
      return { ok: true, msg: `辞退${this.roleName(who.role)}${who.name}，付遣散费 ${this.fmt(who.salary)}` };
    },
    trainStaff(scopeId, staffId) {
      const cost = Math.round(BAL.trainCost * (this.upLv('u_ta') >= 1 ? 0.7 : 1));
      if (this.state.cash < cost) return { ok: false, msg: '现金不足' };
      let list = scopeId ? this.storeById(scopeId).staff : this.state.bench;
      const w = list.find(x => x.id === staffId);
      if (!w) return { ok: false };
      if (w.stars >= 5) return { ok: false, msg: '已经满星' };
      this.state.cash -= cost;
      w.stars = Math.min(5, w.stars + 0.5);
      w.salary = this.salaryOf(w.role, Math.floor(w.stars)) + Math.round((w.stars % 1) * this.salaryOf(w.role, Math.ceil(w.stars)) * 0.5);
      return { ok: true, msg: `${w.name} 培训结业，${w.stars}★` };
    },
    setSalaryPolicy(idx) { this.state.salaryPolicy = idx; },

    /* ========== 门店操作 ========== */
    makeStore(cityId, locId, cuisineId, size, mode, name) {
      const s = this.state;
      const cu = cuisineById(cuisineId);
      const defaults = (DATA.menuItems[cuisineId] || []).filter(i => !i.rare).slice(0, 2).map(i => i.id);
      return {
        id: s.seq++, name, cityId, locId, cuisineId, size, mode,
        menu: defaults, priceLv: 1, marketing: 0,
        equipment: { kitchen: 0, hygiene: 0, front: 0, smart: 0 }, addons: {},
        staff: [], morale: 60, rep: 2.5, salaryBuff: 1,
        delivery: { on: false, platform: 'p_rider' },
        equipSpent: 0, openedAt: s.turn, last: null,
      };
    },

    cityUnlockState(cityId) {
      const s = this.state;
      const c = cityById(cityId);
      if (s.unlocked.includes(cityId)) return { unlocked: true };
      if (c.tier === 2 && (s.stores.length < 5 || s.brandRep < 3.0)) return { unlocked: false, reason: '需 5 家门店且品牌评分 ≥3.0' };
      if (c.tier === 3 && (!this.upLv('u_intl') || s.stores.length < 10 || s.brandRep < 3.8)) return { unlocked: false, reason: '需国际化事业部 + 10 家门店 + 品牌评分 ≥3.8' };
      return { unlocked: false, reason: `支付开拓费 ${this.fmt(c.fee)}` };
    },
    unlockCity(cityId) {
      const s = this.state;
      const st = this.cityUnlockState(cityId);
      if (st.unlocked) return { ok: false, msg: '已开通' };
      if (st.reason.includes('需')) return { ok: false, msg: st.reason };
      const c = cityById(cityId);
      if (s.cash < c.fee) return { ok: false, msg: '现金不足' };
      s.cash -= c.fee;
      s.unlocked.push(cityId);
      this.addLog('🗺️', `进军${c.name}，新市场开门了`);
      return { ok: true, msg: `${c.name}市场开通！` };
    },

    openStore(opts) {
      const s = this.state;
      const { cityId, locId, cuisineId, size, mode, name } = opts;
      if (!s.unlocked.includes(cityId)) return { ok: false, msg: '城市未开通' };
      const fit = BAL.sizeFit[size];
      if (mode === 'fr') {
        if (!this.upLv('u_fc')) return { ok: false, msg: '需先建加盟管理中心' };
        if (this.countFranchise() >= BAL.frCap) return { ok: false, msg: '加盟店已达上限' };
        const cost = Math.round(fit * BAL.frSetup);
        if (s.cash < cost) return { ok: false, msg: '现金不足' };
        s.cash -= cost;
      } else {
        if (s.cash < fit) return { ok: false, msg: `装修费要 ${this.fmt(fit)}，现金不够` };
        s.cash -= fit;
      }
      const st = this.makeStore(cityId, locId, cuisineId, size, mode, name || this.autoName(cityId, cuisineId));
      if (mode === 'dr') {
        for (let i = 0; i < BAL.sizeChef[size]; i++) st.staff.push({ id: s.seq++, role: 'chef', name: randName(), stars: 2, salary: this.salaryOf('chef', 2), trait: chance(0.3) ? pick(DATA.traits).id : null });
        for (let i = 0; i < BAL.sizeWaiter[size]; i++) st.staff.push({ id: s.seq++, role: 'waiter', name: randName(), stars: 2, salary: this.salaryOf('waiter', 2), trait: chance(0.3) ? pick(DATA.traits).id : null });
        if (size >= 2) st.staff.push({ id: s.seq++, role: 'manager', name: randName(), stars: 2, salary: this.salaryOf('manager', 2), trait: null });
      }
      s.stores.push(st);
      this.addLog('🏪', `「${st.name}」开业大吉！`);
      return { ok: true, store: st, msg: '开业大吉！' };
    },
    autoName(cityId, cuisineId) {
      const c = cityById(cityId), cu = cuisineById(cuisineId);
      const n = this.state.stores.filter(s => s.cityId === cityId).length + 1;
      return `${cu.name}·${c.name.slice(0, 2)}${n}号店`;
    },
    renameStore(id, name) { const st = this.storeById(id); if (st && name.trim()) st.name = name.trim().slice(0, 16); },
    expandStore(id) {
      const st = this.storeById(id);
      if (!st || st.size >= 2) return { ok: false, msg: '已是最大规模' };
      const cost = Math.round(BAL.sizeFit[st.size + 1] * BAL.expandCostMul);
      if (this.state.cash < cost) return { ok: false, msg: `扩建要 ${this.fmt(cost)}` };
      this.state.cash -= cost;
      st.size++;
      this.addLog('🏗️', `「${st.name}」扩建为${sizeName[st.size]}店`);
      return { ok: true, msg: '扩建完成' };
    },
    transferStore(id) {
      const s = this.state;
      const st = this.storeById(id);
      if (!st) return { ok: false };
      const refund = Math.round(st.equipSpent * BAL.transferRate + BAL.sizeFit[st.size] * 0.25);
      s.cash += refund;
      s.stores = s.stores.filter(x => x.id !== id);
      this.addLog('🏷️', `「${st.name}」转让出手，回笼 ${this.fmt(refund)}`);
      return { ok: true, msg: `转让完成，回笼资金 ${this.fmt(refund)}` };
    },
    setPrice(id, lv) { const st = this.storeById(id); if (st) st.priceLv = clamp(lv, 0, 5); },
    setMarketing(id, lv) { const st = this.storeById(id); if (st) st.marketing = clamp(lv, 0, 3); },
    toggleDelivery(id, on, platform) {
      const st = this.storeById(id);
      if (!st) return { ok: false };
      if (on && !st.addons.pack) return { ok: false, msg: '先装外卖打包台' };
      st.delivery.on = !!on;
      if (platform) st.delivery.platform = platform;
      return { ok: true };
    },
    setMenu(id, itemIds) {
      const st = this.storeById(id);
      if (!st) return { ok: false };
      for (const iid of itemIds) {
        const cu = itemCuisine(iid);
        if (cu !== st.cuisineId) return { ok: false, msg: '菜系不符' };
        if (!this.state.research.done.includes(iid) && !(DATA.menuItems[st.cuisineId] || []).filter(i => !i.rare).slice(0, 2).some(i => i.id === iid)) return { ok: false, msg: '菜品未研发' };
      }
      if (!itemIds.length) return { ok: false, msg: '至少留一道菜' };
      st.menu = itemIds;
      return { ok: true };
    },
    autoMenu(id) {
      const st = this.storeById(id);
      if (!st) return { ok: false };
      const pool = (DATA.menuItems[st.cuisineId] || []).filter(i => this.state.research.done.includes(i.id) || st.menu.includes(i.id));
      pool.sort((a, b) => b.appeal - a.appeal);
      st.menu = pool.slice(0, 6).map(i => i.id);
      return { ok: true, msg: '已按吸引力排菜' };
    },
    buyEquipment(id, track) {
      const st = this.storeById(id);
      if (!st) return { ok: false };
      const def = find(DATA.equipment, track);
      const lv = st.equipment[track] || 0;
      if (lv >= def.maxLv) return { ok: false, msg: '已满级' };
      const cost = def.costs[lv];
      if (this.state.cash < cost) return { ok: false, msg: '现金不足' };
      this.state.cash -= cost;
      st.equipment[track] = lv + 1;
      st.equipSpent += cost;
      return { ok: true, msg: `${def.names[lv]} 到位` };
    },
    buyAddon(id, addonId) {
      const st = this.storeById(id);
      if (!st || st.addons[addonId]) return { ok: false };
      const def = find(DATA.addons, addonId);
      if (this.state.cash < def.cost) return { ok: false, msg: '现金不足' };
      this.state.cash -= def.cost;
      st.addons[addonId] = true;
      st.equipSpent += def.cost;
      return { ok: true, msg: `${def.name} 装好了` };
    },

    /* ========== 总部 / 金融 / 上市 ========== */
    buyUpgrade(id) {
      const s = this.state;
      const def = find(DATA.upgrades, id);
      const lv = this.upLv(id);
      if (lv >= def.lvls.length) return { ok: false, msg: '已满级' };
      if (def.req && !def.req(s)) return { ok: false, msg: '前置条件不满足' };
      const cost = def.lvls[lv];
      if (s.cash < cost) return { ok: false, msg: '现金不足' };
      s.cash -= cost;
      s.upgrades[id] = lv + 1;
      this.addLog(def.emoji, `总部升级：${def.name} Lv.${lv + 1}`);
      return { ok: true, msg: `${def.name} 建成` };
    },
    toggleBrandAd() {
      const s = this.state;
      if (!s.brandAd && s.cash < BAL.brandAdCost) return { ok: false, msg: '现金不足' };
      s.brandAd = !s.brandAd;
      return { ok: true };
    },
    setSupplier(id) { this.state.supplierId = id; },
    assets() {
      const s = this.state;
      let v = Math.max(0, s.cash);
      for (const st of s.stores) v += st.equipSpent * 0.6 + BAL.sizeFit[st.size] * 0.3;
      return v;
    },
    borrowable() {
      return Math.max(0, Math.floor(this.assets() * BAL.loanAssetRatio) - this.state.loan);
    },
    borrow(amount) {
      const s = this.state;
      const cap = this.borrowable();
      if (amount <= 0 || amount > cap) return { ok: false, msg: `最多可贷 ${this.fmt(cap)}` };
      s.loan += amount;
      s.cash += amount;
      s.flags.hadLoan = true;
      return { ok: true, msg: `放款 ${this.fmt(amount)}` };
    },
    repay(amount) {
      const s = this.state;
      const amt = Math.min(amount, s.loan, s.cash);
      if (amt <= 0) return { ok: false, msg: '无贷可还或现金不足' };
      s.loan -= amt;
      s.cash -= amt;
      return { ok: true, msg: `还贷 ${this.fmt(amt)}` };
    },
    ipoReq() {
      const m = this.diff().ipoMul;
      return { stores: Math.ceil(BAL.ipo.stores * m.stores), rep: BAL.ipo.rep * m.rep, profit: BAL.ipo.profit6m * m.profit };
    },
    ipoCheck() {
      const s = this.state;
      const req = this.ipoReq();
      const miss = [];
      if (s.flags.ipo) miss.push('已上市');
      if (s.stores.length < req.stores) miss.push(`门店 ≥${req.stores}（现 ${s.stores.length}）`);
      if (s.brandRep < req.rep) miss.push(`品牌评分 ≥${req.rep.toFixed(2)}（现 ${s.brandRep.toFixed(2)}）`);
      const last6 = s.history.slice(-6);
      const avg = last6.length ? last6.reduce((a, h) => a + h.profit, 0) / last6.length : 0;
      if (avg < req.profit) miss.push(`近 6 个月月均净利 ≥${this.fmt(req.profit)}（现 ${this.fmt(avg)}）`);
      return { ok: miss.length === 0, miss };
    },
    startIPO() {
      const chk = this.ipoCheck();
      if (!chk.ok) return { ok: false, msg: chk.miss.join('；') };
      const s = this.state;
      const annual = s.history.slice(-12).reduce((a, h) => a + h.profit, 0);
      const pe = 8 + s.brandRep * 2;
      const valuation = Math.max(5000000, Math.round(annual * pe));
      const injection = Math.round(valuation * 0.25);
      s.cash += injection;
      s.flags.ipo = true;
      this.addLog('🔔', `上市敲钟！估值 ${this.fmt(valuation)}，募资 ${this.fmt(injection)}`);
      return { ok: true, valuation, injection, msg: '上市成功！' };
    },

    /* ========== 成就 ========== */
    checkAchievements(report) {
      const s = this.state;
      for (const a of DATA.achievements) {
        if (s.achievements[a.id]) continue;
        let ok = false;
        try { ok = a.test(s); } catch (e) { ok = false; }
        if (ok) {
          s.achievements[a.id] = true;
          const msg = `🏆 达成成就「${a.name}」：${a.desc}`;
          if (report) report.notes.push(msg);
          this.addLog('🏆', msg);
        }
      }
    },

    /* ========== 存档 ========== */
    save() {
      if (typeof localStorage === 'undefined') return;
      try { localStorage.setItem(BAL.saveKey, JSON.stringify(this.state)); } catch (e) { /* 隐私模式等场景静默 */ }
    },
    load() {
      if (typeof localStorage === 'undefined') return false;
      try {
        const raw = localStorage.getItem(BAL.saveKey);
        if (!raw) return false;
        const s = JSON.parse(raw);
        if (!s || s.ver !== BAL.version) return false;
        if (!s.diff || !DATA.DIFFS[s.diff]) s.diff = 'normal'; // 旧档迁移：无难度字段按标准档
        s.flags = s.flags || {};
        if (s.flags.started === undefined) s.flags.started = true; // 有档即已开局，避免旧档被难度弹窗覆盖
        this.state = s;
        // 回读后重建 pending 里的门店引用（JSON 化会切断对象引用）
        for (const p of s.pending || []) {
          if (p.ctx && p.ctx.storeId) p.ctx.store = s.stores.find(x => x.id === p.ctx.storeId) || null;
        }
        seedRng(s.seed + s.turn);
        return true;
      } catch (e) { return false; }
    },
    exportSave() { return JSON.stringify(this.state); },
    importSave(json) {
      try {
        const s = JSON.parse(json);
        if (!s || s.ver !== BAL.version || !Array.isArray(s.stores)) return { ok: false, msg: '存档格式不对' };
        if (!s.diff || !DATA.DIFFS[s.diff]) s.diff = 'normal';
        s.flags = s.flags || {};
        if (s.flags.started === undefined) s.flags.started = true;
        if (![0, 1, 2].includes(s.salaryPolicy)) s.salaryPolicy = 1; // 防越界值 NaN 传播
        this.state = s;
        // 回读后重建 pending 里的门店引用（与 load 同理）
        for (const p of s.pending || []) {
          if (p.ctx && p.ctx.storeId) p.ctx.store = s.stores.find(x => x.id === p.ctx.storeId) || null;
        }
        seedRng(s.seed + s.turn);
        this.save();
        return { ok: true, msg: '读档成功' };
      } catch (e) { return { ok: false, msg: '存档解析失败' }; }
    },
    resetGame(seed, difficulty) { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(BAL.saveKey); } catch (e) {} this.newGame(seed, difficulty); },

    /* ========== 格式化 ========== */
    fmt(v) {
      const n = Math.round(v);
      if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
      if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
      return n + '';
    },
  };

  /* 启动：有档读档，没档开新局（UI 层负责调用 UI 渲染） */
  G.rnd = rnd; // 事件 fx 里用 g.rnd()
  G.booted = false;
  G.boot = function () {
    if (!this.load()) this.newGame();
    this.booted = true;
    return this.state;
  };

  /* node 支持 */
  if (typeof window !== 'undefined') { window.G = G; window.RT = { st: () => G.state, jump: n => { for (let i = 0; i < n; i++) G.advanceMonth(); return G.state; }, cash: n => { G.state.cash += n; return G.state.cash; } }; }
  if (typeof global !== 'undefined') global.G = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
