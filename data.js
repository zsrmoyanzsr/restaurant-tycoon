'use strict';
/* ============================================================
 * 《餐饮大亨》数据与文案层
 * 所有数值集中在这里，调平衡只改本文件。
 * 结构：BAL(核心参数) / cities / locations / cuisines / menuItems
 *      / equipment / addons / upgrades / suppliers / traits
 *      / events / rivals / achievements / 命名池 / 季节表
 * ============================================================ */

const DATA = {

  /* ---------------- 核心平衡参数 ---------------- */
  BAL: {
    version: 1,
    saveKey: 'restaurant-tycoon-save-v1',
    startCash: 200000,
    startYear: 2026,
    startMonth: 1,
    // 总部
    hqOverhead: 5000,          // 总部基础月开销
    hqPerUpgrade: 1500,        // 每级总部升级增加的月开销
    // 贷款
    loanRate: 0.012,           // 月利率
    loanAssetRatio: 0.5,       // 贷款上限 = 总资产 × 50%
    // 需求
    shareBase: 0.16,           // 城市客流基础份额
    sizeDraw: [1, 1.45, 2.0],  // 大店品牌牵引力
    repRef: 2.8,               // 口碑基准（=1 倍需求）
    repExp: 1.6,               // 口碑指数
    mktMul: 0.15,              // 每档营销的需求加成
    fameDiv: 200,              // 知名度需求加成 = fame / fameDiv
    rivalShareMax: 0.45,       // 对手压制上限
    // 定价
    priceRef: 25,              // 参考客单 = priceRef × spend^1.5
    priceSlope: 0.8,           // 对数斜率
    priceBase: 1.5,
    repPriceBonus: 0.22,       // 每点口碑对高价的容忍
    ticketBase: 0.78, ticketStep: 0.19,   // 客单价 = ticket × (base + step×档位)
    expBase: 2.2,  expStep: 0.55,         // 评分期望 = base + step×档位
    // 质量
    qBase: 1.6, qChef: 0.35, qKitchen: 0.18, qHygiene: 0.15,
    qFront: 0.12, qIng: 0.40, qRichItem: 0.2, qRichCap: 1.2,
    repSpeed: 0.25,
    // 规模
    sizeSeats:   [3000, 5200, 9500],     // 月接待能力基线（客次）
    sizeFit:     [40000, 80000, 150000], // 开店装修费
    sizeRentMul: [0.45, 1.0, 1.8],
    sizeChef:    [2, 3, 5],
    sizeWaiter:  [1, 3, 6],
    sizeUtil:    [2400, 5000, 8500],     // 月水电
    expandCostMul: 1.6,                  // 扩建费用 = 下一档装修费 × 此系数
    // 加盟
    frCut: 0.25, frSetup: 0.30, frDrift: 0.055, frCap: 15,
    // 员工
    salaryPolicies: [0.85, 1.0, 1.25],   // 薪酬策略：抠门/标准/厚待
    trainCost: 8000,
    moraleTarget: 52,
    // 外卖
    deliveryShare: 0.34,
    platforms: [
      { id: 'p_rider', name: '蜂鸟快送', fee: 0.20, reach: 1.0, desc: '抽成 20%，流量一般' },
      { id: 'p_mass',  name: '饿了么星选', fee: 0.14, reach: 1.35, desc: '抽成 14%，流量大' },
    ],
    // 研发
    researchCost: 20000, researchMonths: 2,
    // 设备折旧（月）
    depMonths: 36,
    transferRate: 0.4,       // 转让店回收设备残值比例
    // 知名度
    fameDecay: 0.8, brandAdCost: 20000, brandAdFame: 3,
    // 历史
    historyLen: 24,
    // IPO
    ipo: { stores: 15, rep: 4.0, profit6m: 300000 },
    // 破产
    bankruptMonths: 6,
  },

  /* ---------------- 难度 ----------------
   * startCashMul 开局资金 / demandMul 全局客流 / costMul 食材租金人力水电
   * rivalAggrMul 对手动作频率 / rivalGrowMul 对手实力增速 / pressureMul 对手客流压制
   * loanRateMul 月利率 / badMul 负面口碑类事件的伤害 / ipoMul 上市三门槛缩放
   * 原则：困难模式上市门槛不抬高（决策好仍可通关），靠经济与对手施压变难。 */
  DIFFS: {
    easy: {
      id: 'easy', name: '悠闲掌柜', emoji: '🌙',
      startCashMul: 1.5, demandMul: 1.25, costMul: 0.92,
      rivalAggrMul: 0.65, rivalGrowMul: 0.6, pressureMul: 0.7,
      loanRateMul: 0.8, badMul: 0.75,
      ipoMul: { stores: 0.8, rep: 0.93, profit: 0.8 },
      desc: '开局 30 万、客流旺、成本九二折、对手佛系；上市门槛降到 12 店。适合想轻松看报表的你。',
    },
    normal: {
      id: 'normal', name: '创业之路', emoji: '☕',
      startCashMul: 1, demandMul: 1, costMul: 1,
      rivalAggrMul: 1, rivalGrowMul: 1, pressureMul: 1,
      loanRateMul: 1, badMul: 1,
      ipoMul: { stores: 1, rep: 1, profit: 1 },
      desc: '标准平衡：开局 20 万，前紧后松，精打细算能做大。基准难度。',
    },
    hard: {
      id: 'hard', name: '存亡之战', emoji: '🔥',
      startCashMul: 0.9, demandMul: 0.9, costMul: 1.03,
      rivalAggrMul: 1.3, rivalGrowMul: 1.35, pressureMul: 1.25,
      loanRateMul: 1.25, badMul: 1.15,
      ipoMul: { stores: 1, rep: 1, profit: 1 },
      desc: '开局仅 18 万、客流九折、成本+3%、对手狂暴加息 25%、负面事件更疼。上市门槛不降——决策好照样敲钟，容错率很低。',
    },
  },

  /* ---------------- 城市（tier: 1本地 2国内 3海外） ---------------- */
  cities: [
    { id: 'c_ht',  name: '家乡老城', tier: 1, traffic: 18000, spend: 0.85, rent: 26000, tastes: { fast: 1.10, sweet: 1.00, spicy: 1.15, light: 0.95, sea: 0.80, exotic: 0.85 }, fee: 0 },
    { id: 'c_bjx', name: '滨江新区', tier: 1, traffic: 22000, spend: 1.00, rent: 32000, tastes: { fast: 1.05, sweet: 1.10, spicy: 1.00, light: 1.00, sea: 0.95, exotic: 1.00 }, fee: 0 },
    { id: 'c_qy',  name: '邻市清源', tier: 1, traffic: 15000, spend: 0.80, rent: 21000, tastes: { fast: 1.05, sweet: 0.95, spicy: 1.05, light: 1.00, sea: 0.85, exotic: 0.85 }, fee: 60000 },
    { id: 'c_cd',  name: '成都', tier: 2, traffic: 46000, spend: 0.95, rent: 52000, tastes: { fast: 1.00, sweet: 1.05, spicy: 1.40, light: 1.05, sea: 0.85, exotic: 0.95 }, fee: 150000 },
    { id: 'c_cq',  name: '重庆', tier: 2, traffic: 44000, spend: 0.90, rent: 48000, tastes: { fast: 1.00, sweet: 0.95, spicy: 1.45, light: 1.00, sea: 0.85, exotic: 0.90 }, fee: 150000 },
    { id: 'c_cs',  name: '长沙', tier: 2, traffic: 38000, spend: 0.92, rent: 42000, tastes: { fast: 1.10, sweet: 1.15, spicy: 1.35, light: 0.95, sea: 0.85, exotic: 1.00 }, fee: 140000 },
    { id: 'c_wh',  name: '武汉', tier: 2, traffic: 40000, spend: 0.98, rent: 46000, tastes: { fast: 1.15, sweet: 1.00, spicy: 1.20, light: 1.00, sea: 1.00, exotic: 0.95 }, fee: 150000 },
    { id: 'c_gz',  name: '广州', tier: 2, traffic: 50000, spend: 1.15, rent: 62000, tastes: { fast: 1.00, sweet: 1.15, spicy: 0.95, light: 1.25, sea: 1.30, exotic: 1.00 }, fee: 180000 },
    { id: 'c_hz',  name: '杭州', tier: 2, traffic: 42000, spend: 1.20, rent: 60000, tastes: { fast: 1.00, sweet: 1.10, spicy: 0.90, light: 1.25, sea: 1.10, exotic: 1.05 }, fee: 180000 },
    { id: 'c_sh',  name: '上海', tier: 2, traffic: 58000, spend: 1.35, rent: 78000, tastes: { fast: 1.10, sweet: 1.15, spicy: 0.95, light: 1.10, sea: 1.15, exotic: 1.25 }, fee: 220000 },
    { id: 'c_pek', name: '北京', tier: 2, traffic: 56000, spend: 1.25, rent: 74000, tastes: { fast: 1.10, sweet: 1.00, spicy: 1.05, light: 1.05, sea: 1.00, exotic: 1.10 }, fee: 220000 },
    { id: 'c_bkk', name: '曼谷', tier: 3, traffic: 50000, spend: 1.00, rent: 60000, tastes: { fast: 1.15, sweet: 1.25, spicy: 1.35, light: 1.00, sea: 1.20, exotic: 1.25 }, fee: 600000 },
    { id: 'c_sgp', name: '新加坡', tier: 3, traffic: 52000, spend: 1.40, rent: 90000, tastes: { fast: 1.10, sweet: 1.10, spicy: 1.20, light: 1.10, sea: 1.30, exotic: 1.20 }, fee: 700000 },
    { id: 'c_tky', name: '东京', tier: 3, traffic: 62000, spend: 1.60, rent: 105000, tastes: { fast: 1.00, sweet: 1.10, spicy: 0.90, light: 1.20, sea: 1.35, exotic: 1.30 }, fee: 800000 },
    { id: 'c_syd', name: '悉尼', tier: 3, traffic: 48000, spend: 1.45, rent: 88000, tastes: { fast: 1.20, sweet: 1.05, spicy: 0.95, light: 1.10, sea: 1.30, exotic: 1.10 }, fee: 750000 },
    { id: 'c_par', name: '巴黎', tier: 3, traffic: 56000, spend: 1.60, rent: 100000, tastes: { fast: 0.95, sweet: 1.20, spicy: 0.85, light: 1.20, sea: 1.10, exotic: 1.30 }, fee: 800000 },
    { id: 'c_nyc', name: '纽约', tier: 3, traffic: 70000, spend: 1.65, rent: 120000, tastes: { fast: 1.25, sweet: 1.05, spicy: 1.00, light: 1.00, sea: 1.15, exotic: 1.20 }, fee: 900000 },
  ],

  /* ---------------- 地段 ---------------- */
  locations: [
    { id: 'l_food',    name: '美食街',   emoji: '🏮', traffic: 1.45, rent: 1.25, desc: '客流旺，租金中高' },
    { id: 'l_campus',  name: '大学城',   emoji: '🎓', traffic: 1.20, rent: 0.70, desc: '学生多，价格敏感' },
    { id: 'l_office',  name: '写字楼',   emoji: '🏢', traffic: 1.30, rent: 1.50, desc: '工作日午市火爆' },
    { id: 'l_mall',    name: '购物中心', emoji: '🏬', traffic: 1.75, rent: 2.00, desc: '客流最大，租金最贵' },
    { id: 'l_comm',    name: '社区街',   emoji: '🏘️', traffic: 0.90, rent: 0.60, desc: '租金低，回头客稳' },
    { id: 'l_scenic',  name: '景区口',   emoji: '⛰️', traffic: 1.60, rent: 1.80, desc: '游客多，淡旺季分明' },
  ],

  /* ---------------- 菜系 ---------------- */
  cuisines: [
    { id: 'cu_fast',   name: '快餐',     emoji: '🍔', ticket: 26,  costRate: 0.42, tag: 'fast' },
    { id: 'cu_noodle', name: '面馆米粉', emoji: '🍜', ticket: 19,  costRate: 0.32, tag: 'fast' },
    { id: 'cu_tea',    name: '茶饮甜品', emoji: '🧋', ticket: 17,  costRate: 0.34, tag: 'sweet' },
    { id: 'cu_bakery', name: '烘焙',     emoji: '🥐', ticket: 24,  costRate: 0.38, tag: 'sweet' },
    { id: 'cu_hotpot', name: '火锅烧烤', emoji: '🔥', ticket: 85,  costRate: 0.45, tag: 'spicy' },
    { id: 'cu_sichuan',name: '川湘小炒', emoji: '🌶️', ticket: 52,  costRate: 0.40, tag: 'spicy' },
    { id: 'cu_canton', name: '粤式茶点', emoji: '🥟', ticket: 64,  costRate: 0.42, tag: 'light' },
    { id: 'cu_jp',     name: '日料',     emoji: '🍣', ticket: 92,  costRate: 0.47, tag: 'sea' },
    { id: 'cu_sea',    name: '海鲜排档', emoji: '🦞', ticket: 98,  costRate: 0.50, tag: 'sea' },
    { id: 'cu_west',   name: '西餐',     emoji: '🥩', ticket: 115, costRate: 0.50, tag: 'exotic' },
  ],

  /* ---------------- 菜品（cost: 成本率修正, appeal: 吸引力, prep: 后厨负荷） ---------------- */
  menuItems: {
    cu_fast: [
      { id: 'ff_burger',  name: '经典汉堡',   emoji: '🍔', cost: 0.00, appeal: 3, prep: 1 },
      { id: 'ff_chicken', name: '香辣鸡腿堡', emoji: '🍗', cost: 0.01, appeal: 4, prep: 1 },
      { id: 'ff_fries',   name: '黄金薯条',   emoji: '🍟', cost: -0.04, appeal: 2, prep: 1 },
      { id: 'ff_bucket',  name: '全家福鸡桶', emoji: '🍗', cost: 0.02, appeal: 5, prep: 2, rare: true },
      { id: 'ff_curry',   name: '咖喱鸡肉饭', emoji: '🍛', cost: 0.00, appeal: 3, prep: 2 },
      { id: 'ff_mango',   name: '芒果派',     emoji: '🥭', cost: -0.02, appeal: 3, prep: 1 },
      { id: 'ff_kids',    name: '开心儿童餐', emoji: '🧸', cost: 0.00, appeal: 4, prep: 1, rare: true },
    ],
    cu_noodle: [
      { id: 'nd_beef',    name: '红烧牛肉面', emoji: '🍜', cost: 0.00, appeal: 4, prep: 1 },
      { id: 'nd_suanla',  name: '酸辣粉',     emoji: '🌶️', cost: -0.03, appeal: 3, prep: 1 },
      { id: 'nd_daoxiao', name: '刀削面',     emoji: '🍜', cost: 0.00, appeal: 3, prep: 2 },
      { id: 'nd_wonton',  name: '鲜虾云吞面', emoji: '🥟', cost: 0.02, appeal: 4, prep: 2, rare: true },
      { id: 'nd_pigfoot', name: '隆江猪脚饭', emoji: '🍖', cost: 0.01, appeal: 4, prep: 1 },
      { id: 'nd_feichang',name: '肥肠粉',     emoji: '🍲', cost: 0.00, appeal: 3, prep: 1 },
      { id: 'nd_cold',    name: '鸡丝凉面',   emoji: '🥢', cost: -0.03, appeal: 3, prep: 1, rare: true },
    ],
    cu_tea: [
      { id: 'tea_boba',   name: '珍珠奶茶',   emoji: '🧋', cost: 0.00, appeal: 4, prep: 1 },
      { id: 'tea_lemon',  name: '手打柠檬茶', emoji: '🍋', cost: -0.02, appeal: 3, prep: 1 },
      { id: 'tea_mango',  name: '芒果冰沙',   emoji: '🥭', cost: 0.01, appeal: 4, prep: 1 },
      { id: 'tea_tira',   name: '提拉米苏',   emoji: '🍰', cost: 0.02, appeal: 4, prep: 2 },
      { id: 'tea_souffle',name: '舒芙蕾',     emoji: '🍮', cost: 0.03, appeal: 5, prep: 3, rare: true },
      { id: 'tea_grape',  name: '杨枝甘露',   emoji: '🍨', cost: 0.01, appeal: 4, prep: 2 },
      { id: 'tea_cheese', name: '芝士奶盖',   emoji: '🧀', cost: 0.01, appeal: 3, prep: 1, rare: true },
    ],
    cu_bakery: [
      { id: 'bk_crois',   name: '黄油可颂',   emoji: '🥐', cost: 0.00, appeal: 3, prep: 2 },
      { id: 'bk_toast',   name: '生乳吐司',   emoji: '🍞', cost: 0.00, appeal: 3, prep: 1 },
      { id: 'bk_cake',    name: '生日蛋糕',   emoji: '🎂', cost: 0.03, appeal: 5, prep: 2, rare: true },
      { id: 'bk_eclair',  name: '闪电泡芙',   emoji: '🥧', cost: 0.02, appeal: 4, prep: 2 },
      { id: 'bk_cookie',  name: '曲奇礼盒',   emoji: '🍪', cost: -0.02, appeal: 2, prep: 1 },
      { id: 'bk_pretzel', name: '碱水结',     emoji: '🥨', cost: -0.01, appeal: 3, prep: 1 },
      { id: 'bk_moon',    name: '流心月饼',   emoji: '🥮', cost: 0.02, appeal: 4, prep: 2, rare: true },
    ],
    cu_hotpot: [
      { id: 'hp_spicy',   name: '九宫格红锅', emoji: '🌶️', cost: 0.00, appeal: 5, prep: 2 },
      { id: 'hp_tomato',  name: '番茄浓汤锅', emoji: '🍅', cost: 0.00, appeal: 3, prep: 2 },
      { id: 'hp_beef',    name: '手切鲜黄牛', emoji: '🥩', cost: 0.04, appeal: 5, prep: 1 },
      { id: 'hp_stomach', name: '脆毛肚',     emoji: '🥢', cost: 0.03, appeal: 4, prep: 1 },
      { id: 'hp_skewer',  name: '炭烤羊肉串', emoji: '🍢', cost: 0.00, appeal: 4, prep: 2 },
      { id: 'hp_fish',    name: '重庆烤鱼',   emoji: '🐟', cost: 0.02, appeal: 5, prep: 3, rare: true },
      { id: 'hp_wagyu',   name: 'M9 和牛片',  emoji: '🥓', cost: 0.06, appeal: 6, prep: 1, rare: true },
      { id: 'hp_bing',    name: '手工冰粉',   emoji: '🍧', cost: -0.02, appeal: 2, prep: 1 },
    ],
    cu_sichuan: [
      { id: 'sc_tofu',    name: '麻婆豆腐',   emoji: '🌶️', cost: -0.02, appeal: 3, prep: 1 },
      { id: 'sc_fish',    name: '水煮鱼',     emoji: '🐟', cost: 0.02, appeal: 5, prep: 2 },
      { id: 'sc_pork',    name: '回锅肉',     emoji: '🥘', cost: 0.00, appeal: 4, prep: 1 },
      { id: 'sc_chicken', name: '歌乐辣子鸡', emoji: '🐔', cost: 0.01, appeal: 4, prep: 2 },
      { id: 'sc_fishhead',name: '剁椒鱼头',   emoji: '🐟', cost: 0.03, appeal: 5, prep: 2, rare: true },
      { id: 'sc_beef',    name: '小炒黄牛肉', emoji: '🥩', cost: 0.03, appeal: 5, prep: 2, rare: true },
      { id: 'sc_fatbeef', name: '酸汤肥牛',   emoji: '🍲', cost: 0.01, appeal: 4, prep: 1 },
    ],
    cu_canton: [
      { id: 'ct_shrimp',  name: '水晶虾饺',   emoji: '🥟', cost: 0.02, appeal: 5, prep: 2 },
      { id: 'ct_goose',   name: '脆皮烧鹅',   emoji: '🦆', cost: 0.03, appeal: 5, prep: 3 },
      { id: 'ct_rice',    name: '布拉肠粉',   emoji: '🌯', cost: 0.00, appeal: 3, prep: 1 },
      { id: 'ct_bbq',     name: '蜜汁叉烧包', emoji: '🍞', cost: 0.00, appeal: 4, prep: 1 },
      { id: 'ct_chicken', name: '白切鸡',     emoji: '🐔', cost: 0.01, appeal: 3, prep: 2 },
      { id: 'ct_pot',     name: '腊味煲仔饭', emoji: '🍚', cost: 0.01, appeal: 4, prep: 2 },
      { id: 'ct_platter', name: '烧味双拼',   emoji: '🍱', cost: 0.02, appeal: 4, prep: 2, rare: true },
    ],
    cu_jp: [
      { id: 'jp_salmon',  name: '三文鱼寿司', emoji: '🍣', cost: 0.02, appeal: 4, prep: 1 },
      { id: 'jp_tuna',    name: '金枪鱼丼',   emoji: '🍚', cost: 0.03, appeal: 5, prep: 1 },
      { id: 'jp_tempura', name: '什锦天妇罗', emoji: '🍤', cost: 0.01, appeal: 4, prep: 2 },
      { id: 'jp_ramen',   name: '豚骨拉面',   emoji: '🍜', cost: 0.00, appeal: 4, prep: 2 },
      { id: 'jp_eel',     name: '鳗鱼饭',     emoji: '🍱', cost: 0.04, appeal: 5, prep: 2, rare: true },
      { id: 'jp_sashimi', name: '刺身拼盘',   emoji: '🍥', cost: 0.05, appeal: 6, prep: 1, rare: true },
      { id: 'jp_wagyu',   name: '炙烤和牛寿司', emoji: '🥩', cost: 0.06, appeal: 7, prep: 1, rare: true },
    ],
    cu_sea: [
      { id: 'se_lobster', name: '蒜蓉开边龙虾', emoji: '🦞', cost: 0.04, appeal: 6, prep: 2 },
      { id: 'se_scallop', name: '粉丝蒸扇贝', emoji: '🐚', cost: 0.02, appeal: 4, prep: 1 },
      { id: 'se_crab',    name: '香辣炒蟹',   emoji: '🦀', cost: 0.03, appeal: 5, prep: 2, rare: true },
      { id: 'se_clam',    name: '辣炒花蛤',   emoji: '🦪', cost: 0.00, appeal: 3, prep: 1 },
      { id: 'se_fish',    name: '清蒸石斑',   emoji: '🐟', cost: 0.03, appeal: 5, prep: 2 },
      { id: 'se_shrimp',  name: '白灼海虾',   emoji: '🦐', cost: 0.02, appeal: 4, prep: 1 },
      { id: 'se_platter', name: '海鲜大咖',   emoji: '🥘', cost: 0.05, appeal: 6, prep: 3, rare: true },
    ],
    cu_west: [
      { id: 'we_steak',   name: '菲力牛排',   emoji: '🥩', cost: 0.03, appeal: 5, prep: 2 },
      { id: 'we_well',    name: '惠灵顿牛排', emoji: '🥐', cost: 0.06, appeal: 7, prep: 3, rare: true },
      { id: 'we_salad',   name: '凯撒沙拉',   emoji: '🥗', cost: -0.02, appeal: 2, prep: 1 },
      { id: 'we_pasta',   name: '黑松露意面', emoji: '🍝', cost: 0.02, appeal: 4, prep: 2 },
      { id: 'we_chicken', name: '烤春鸡',     emoji: '🍗', cost: 0.00, appeal: 3, prep: 2 },
      { id: 'we_seafood', name: '海鲜拼盘',   emoji: '🦐', cost: 0.04, appeal: 5, prep: 2 },
      { id: 'we_pork',    name: '慢煮猪肋排', emoji: '🍖', cost: 0.02, appeal: 4, prep: 2, rare: true },
      { id: 'we_truffle', name: '松露和牛堡', emoji: '🍔', cost: 0.05, appeal: 6, prep: 2, rare: true },
    ],
  },

  /* ---------------- 设备（每店四条升级线） ---------------- */
  equipment: [
    { id: 'kitchen', name: '灶具后厨', emoji: '🍳', maxLv: 4,
      costs: [30000, 60000, 120000, 220000],
      names: ['猛火灶台', '双头蒸柜', '万能蒸烤箱', '炒菜机器人'],
      desc: '出餐效率+ 评分+' },
    { id: 'hygiene', name: '冷链卫生', emoji: '🧊', maxLv: 4,
      costs: [20000, 45000, 85000, 150000],
      names: ['消毒柜', '风幕冷柜', '中央净水', '智能温控'],
      desc: '食安+ 评分+' },
    { id: 'front', name: '前厅环境', emoji: '🛋️', maxLv: 4,
      costs: [25000, 50000, 90000, 160000],
      names: ['软包卡座', '灯光改造', '明档厨房', '主题装修'],
      desc: '客单价+ 评分+' },
    { id: 'smart', name: '智能设备', emoji: '🤖', maxLv: 3,
      costs: [20000, 40000, 80000],
      names: ['扫码点餐', '排队叫号', '送餐机器人'],
      desc: '省人力 高峰接待+' },
  ],

  addons: [
    { id: 'pack',    name: '外卖打包台', emoji: '🥡', cost: 20000, desc: '解锁该店外卖渠道' },
    { id: 'terrace', name: '户外座区',   emoji: '⛱️', cost: 30000, desc: '接待能力 +12%' },
  ],

  /* ---------------- 总部升级（lvl 数组=每级费用，prereq=前置） ---------------- */
  upgrades: [
    { id: 'u_ck',   name: '中央厨房',     emoji: '🏭', lvls: [400000, 700000],
      desc: '每级：食材成本 -6%，食材品质 +', req: s => s.stores.length >= 3 },
    { id: 'u_ta',   name: '培训学院',     emoji: '🎓', lvls: [300000, 500000],
      desc: '培训效果 +，高星候选人更多', req: s => s.stores.length >= 2 },
    { id: 'u_qc',   name: '品控实验室',   emoji: '🔬', lvls: [350000, 600000],
      desc: '每级：加盟品控流失减半，食安事故更少', req: s => s.stores.length >= 4 },
    { id: 'u_bd',   name: '大数据中心',   emoji: '📊', lvls: [300000],
      desc: '经营预测去掉模糊区间，营销效果 +30%', req: s => s.stores.length >= 3 },
    { id: 'u_scf',  name: '供应链金融',   emoji: '💱', lvls: [500000],
      desc: '食材成本再 -4%，贷款利率降至 0.9%/月', req: s => s.upgrades.u_ck >= 1 },
    { id: 'u_app',  name: '会员 APP',     emoji: '📱', lvls: [450000],
      desc: '全店需求 +6%，解锁会员日事件', req: s => s.stores.length >= 4 },
    { id: 'u_pr',   name: '品牌公关部',   emoji: '🛡️', lvls: [400000],
      desc: '负面事件伤害 -40%，每月知名度 +1', req: s => s.brandRep >= 3.2 },
    { id: 'u_fc',   name: '加盟管理中心', emoji: '🤝', lvls: [600000],
      desc: '解锁加盟模式（上限 15 家），开店省 70% 现金', req: s => s.brandRep >= 3.2 && s.stores.length >= 5 },
    { id: 'u_rd',   name: '中央研究院',   emoji: '🧪', lvls: [350000, 550000],
      desc: '每级：研发提速 1 个月，更容易抽出稀有菜', req: s => s.research.done.length >= 3 },
    { id: 'u_star', name: '明星主厨团队', emoji: '👨‍🍳', lvls: [700000],
      desc: '全店质量 +0.3，被挖角概率大降', req: s => s.upgrades.u_ta >= 1 },
    { id: 'u_sched',name: '智能排班',     emoji: '🗓️', lvls: [350000],
      desc: '人力成本 -8%', req: s => s.stores.length >= 5 },
    { id: 'u_intl', name: '国际化事业部', emoji: '🌍', lvls: [800000],
      desc: '解锁海外市场', req: s => s.stores.length >= 10 && s.brandRep >= 3.8 },
  ],

  /* ---------------- 供应商 ---------------- */
  suppliers: [
    { id: 's_cheap', name: '鑫达批发', emoji: '📦', costMul: 0.88, ing: 0.00, risk: 1.6, desc: '便宜两成，但品质差、食安风险高' },
    { id: 's_std',   name: '绿源直采', emoji: '🥬', costMul: 1.00, ing: 0.55, risk: 1.0, desc: '中规中矩' },
    { id: 's_prem',  name: '金穗冷链', emoji: '❄️', costMul: 1.12, ing: 1.00, risk: 0.6, desc: '贵一成二，品质食安保出来了' },
  ],

  /* ---------------- 员工特长 ---------------- */
  traits: [
    { id: 'speed',  name: '快手',     emoji: '⚡', desc: '出餐效率 +10%' },
    { id: 'tongue', name: '味觉天才', emoji: '👅', desc: '菜品质量 +0.15' },
    { id: 'social', name: '社牛',     emoji: '😄', desc: '客单价 +3%' },
    { id: 'steady', name: '老黄牛',   emoji: '🐂', desc: '门店士气更稳' },
    { id: 'hype',   name: '自带流量', emoji: '📣', desc: '该店营销效果 +20%' },
    { id: 'cheap',  name: '要价低',   emoji: '💰', desc: '薪资 -20%' },
    { id: 'star',   name: '明星脸',   emoji: '🌟', desc: '知名度涨得快，但容易被挖' },
  ],

  /* ---------------- 命名池 ---------------- */
  surnames: ['王','李','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗'],
  givens: ['伟','芳','娜','敏','静','磊','军','洋','勇','艳','杰','涛','明','超','霞','平','辉','鹏','华','健','俊','婷','雪','帆','浩','宇','峰','丹','蕊','泽'],

  /* ---------------- 季节 / 节日（月 → 菜系标签倍率） ---------------- */
  season: {
    spicy: { 1: 1.10, 11: 1.15, 12: 1.20, 6: 0.92, 7: 0.88, 8: 0.90 },
    sweet: { 6: 1.20, 7: 1.25, 8: 1.20, 12: 0.95 },
    sea:   { 8: 1.12, 1: 0.95 },
    fast:  { 7: 1.05, 1: 1.05 },
  },
  holiday: { 1: 1.18, 2: 1.05, 5: 1.08, 10: 1.12, 12: 1.06 },
  holidayName: { 1: '春节旺季', 2: '元宵', 5: '五一', 10: '国庆黄金周', 12: '年末聚餐' },

  /* ---------------- 竞争对手 ---------------- */
  rivals: [
    { id: 'rv_kz', name: '快栈快餐',   emoji: '🏪', strategy: 'volume',  strength: 80,  rep: 2.9, aggr: 0.55,
      desc: '低价走量，哪里人多去哪里' },
    { id: 'rv_dx', name: '顶鲜食府',   emoji: '🦐', strategy: 'premium', strength: 120, rep: 4.1, aggr: 0.35,
      desc: '高端路线，店少价高口碑硬' },
    { id: 'rv_wb', name: '味霸连锁',   emoji: '🌶️', strategy: 'expand',  strength: 100, rep: 3.2, aggr: 0.80,
      desc: '激进扩张狂魔，见缝插针开店' },
    { id: 'rv_wh', name: '网红食验室', emoji: '📸', strategy: 'hype',    strength: 70,  rep: 4.0, aggr: 0.60,
      desc: '营销轰炸机，评分忽高忽低' },
  ],

  /* ---------------- 随机事件 ----------------
   * target: global / city(玩家有店的城市) / store(随机直营店)
   * choices: 有则进 pending 队列等玩家拍板；无则立即生效
   * fx(g, ctx, choice) 返回日志文本（空串则不记）
   * ------------------------------------------------ */
  events: [
    { id: 'ev_festival', icon: '🎪', name: '城市美食节', weight: 10, target: 'city',
      text: c => `${c}要办美食节，主委会给商家留了展位。`,
      choices: [
        { label: '花 3 万拿下黄金展位', fx: (g, ctx) => { g.addMod('demand_city', ctx.cityId, 1.5, 1, '美食节'); g.spendCash(30000); return `${ctx.cityName}美食节开幕，全城吃货出动！`; } },
        { label: '不凑热闹', fx: () => '' },
      ] },
    { id: 'ev_kol', icon: '📷', name: '网红探店', weight: 12, target: 'store',
      text: s => `一位百万粉丝的探店博主推门进了「${s.name}」，镜头已经架好。`,
      fx: (g, ctx) => {
        if (g.rnd() < 0.68) { g.bumpStoreRep(ctx.store, 0.30); g.state.fame += 5; return `博主吃得很满意，视频爆了！「${ctx.store.name}」口碑 +0.3，知名度 +5`; }
        g.bumpStoreRep(ctx.store, -0.25); return `博主吐槽上菜慢还咸，视频小火了一把……「${ctx.store.name}」口碑 -0.25`; } },
    { id: 'ev_inspect', icon: '🚨', name: '食安抽检', weight: 8, target: 'store',
      text: s => `市场监管突击检查「${s.name}」的后厨。`,
      fx: (g, ctx) => {
        const st = ctx.store, hy = st.equipment.hygiene || 0;
        const sup = g.supplier(); const qcLv = g.state.upgrades.u_qc || 0;
        const p = 0.25 + (2 - hy) * 0.12 + (sup.id === 's_cheap' ? 0.22 : 0) - qcLv * 0.08;
        if (g.rnd() > Math.max(0.05, p)) { g.bumpStoreRep(st, 0.15); return `检查顺利通过，还被挂了「放心后厨」红榜，「${st.name}」口碑 +0.15`; }
        g.setPending({ kind: 'event', id: 'ev_inspect_c', storeId: st.id, name: st.name, icon: '🚨' });
        return `后厨被查出问题（过期食材），责令整改！`; } },
    { id: 'ev_inspect_c', icon: '🚨', name: '整改风波', weight: 0, special: true,
      text: ctx => `「${ctx.name}」被查出后厨问题，怎么处理？`,
      choices: [
        { label: '公开道歉+全面消杀（-4 万）', fx: (g, ctx) => { g.spendCash(40000); g.bumpStoreRep(g.storeById(ctx.storeId), -0.10); return `态度诚恳，风波很快平息，口碑只掉了 0.1`; } },
        { label: '低调冷处理', fx: (g, ctx) => { if (g.rnd() < 0.5) { g.bumpStoreRep(g.storeById(ctx.storeId), -0.55); g.addMod('demand', null, 0.92, 2, '食安风波'); return `被记者盯上了，上了本地新闻……品牌口碑 -0.55，客流下滑`; } return `蒙混过关，没掀起风浪`; } },
      ] },
    { id: 'ev_rent', icon: '🏠', name: '房东涨租', weight: 8, target: 'city',
      text: c => `${c}的房东笑眯眯地说：隔壁奶茶店出了双倍价，你看怎么表示一下？`,
      choices: [
        { label: '认了，续约（该城租金 +15% 半年）', fx: (g, ctx) => { g.addMod('rent_city', ctx.cityId, 1.15, 6, '涨租'); return `认栽续约，${ctx.cityName}租金涨 15%（6 个月）`; } },
        { label: '拎两条好烟去谈（-2 万）', fx: (g, ctx) => { g.spendCash(20000); return `谈下来了，租金没涨，烟钱照付`; } },
      ] },
    { id: 'ev_foodup', icon: '📈', name: '食材涨价', weight: 10, target: 'global',
      text: () => `上游养殖场减产，肉类批发价全线走高。`,
      fx: g => { g.addMod('food_cost', null, 1.15, 3, '食材涨价'); return `食材成本 +15%，持续 3 个月`; } },
    { id: 'ev_fooddown', icon: '📉', name: '丰收降价', weight: 8, target: 'global',
      text: () => `今年蔬菜大丰收，批发价便宜了一截。`,
      fx: g => { g.addMod('food_cost', null, 0.90, 2, '食材降价'); return `食材成本 -10%，持续 2 个月`; } },
    { id: 'ev_raise', icon: '😤', name: '员工要加薪', weight: 9, target: 'store',
      text: s => `「${s.name}」的员工联名递了加薪申请，说再不涨就走人。`,
      choices: [
        { label: '全员加薪 5%（士气 +15）', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); st.salaryBuff = (st.salaryBuff || 1) + 0.05; st.morale = Math.min(100, st.morale + 15); return `加薪后干劲十足，「${st.name}」士气大涨`; } },
        { label: '画大饼（士气 -12）', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); st.morale = Math.max(10, st.morale - 12); return `饼没烙熟，员工心里凉了半截`; } },
      ] },
    { id: 'ev_poach_chef', icon: '🎣', name: '大厨被盯上', weight: 8, target: 'store', cond: g => !g.state.upgrades.u_star,
      text: s => `顶鲜食府盯上了「${s.name}」的主厨，开出了双倍薪水。`,
      choices: [
        { label: '加薪 20% 留人', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); const c = st.staff.find(x => x.role === 'chef'); if (c) c.salary = Math.round(c.salary * 1.2); return `加薪留人，大厨感恩戴德`; } },
        { label: '人各有志', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); const i = st.staff.findIndex(x => x.role === 'chef'); if (i >= 0) st.staff.splice(i, 1); return `大厨跳槽了，「${st.name}」后厨一时捉襟见肘`; } },
      ] },
    { id: 'ev_jobfair', icon: '🧑‍💼', name: '餐饮人才招聘会', weight: 7, target: 'global',
      text: () => `本地办了场大型餐饮人才招聘会，各路好手云集。`,
      fx: g => { g.refreshMarket(6, 1); return `本月招聘市场扩容，还来了一位好手`; } },
    { id: 'ev_rain', icon: '🌧️', name: '连日暴雨', weight: 8, target: 'global',
      text: () => `雨下了一整个月，街上行人寥寥。`,
      fx: g => { g.addMod('demand', null, 0.85, 1, '暴雨'); g.addMod('delivery', null, 1.3, 1, '暴雨外卖热'); return `堂食客流 -15%，外卖订单暴涨`; } },
    { id: 'ev_concert', icon: '🎤', name: '巨星演唱会', weight: 8, target: 'city',
      text: c => `顶流歌手空降${c}，体育场周边一票难求。`,
      fx: (g, ctx) => { g.addMod('demand_city', ctx.cityId, 1.6, 1, '演唱会'); return `${ctx.cityName}客流暴涨！`; } },
    { id: 'ev_break', icon: '🔧', name: '设备故障', weight: 9, target: 'store', cond: g => true,
      text: s => `「${s.name}」的灶台罢工了，哗哗冒黑烟。`,
      choices: [
        { label: '连夜抢修（-1.5 万）', fx: (g, ctx) => { g.spendCash(15000); return `师傅连夜修好，第二天照常开火`; } },
        { label: '凑合用着', fx: (g, ctx) => { g.addMod('demand_store', ctx.storeId, 0.75, 1, '设备带病'); return `出餐慢了一截，这月客流受影响`; } },
      ] },
    { id: 'ev_toilet', icon: '🚽', name: '差评上热搜', weight: 6, target: 'store',
      text: s => `有食客把「${s.name}」卫生间的照片发上了热搜。`,
      choices: [
        { label: '立刻改造（-3 万，口碑回血）', fx: (g, ctx) => { g.spendCash(30000); g.bumpStoreRep(g.storeById(ctx.storeId), 0.15); return `改造视频反手一波营销，口碑 +0.15`; } },
        { label: '删评拉黑', fx: (g, ctx) => { g.bumpStoreRep(g.storeById(ctx.storeId), -0.30); return `网友骂声更大了，口碑 -0.30`; } },
      ] },
    { id: 'ev_war', icon: '⚔️', name: '对手价格战', weight: 10, target: 'city',
      text: c => `${c}里对手贴出「全场五折」海报，你家门口排队的人少了一半。`,
      choices: [
        { label: '跟！充值送券大促（-4 万）', fx: (g, ctx) => { g.spendCash(40000); return `贴身肉搏，客人都留住了`; } },
        { label: '不跟，拼品质', fx: (g, ctx) => { g.addMod('demand_city', ctx.cityId, 0.80, 2, '价格战'); g.bumpStoreRep(g.state.stores.find(s => s.cityId === ctx.cityId), 0.08); return `${ctx.cityName}客流 -20%（2 个月），但口碑微涨`; } },
      ] },
    { id: 'ev_headhunt', icon: '🕵️', name: '店长被挖角', weight: 7, target: 'store', cond: g => g.state.stores.some(s => s.staff.some(x => x.role === 'manager' && x.stars >= 3)),
      text: s => `猎头联系了「${s.name}」的店长，对方开的价很诱人。`,
      choices: [
        { label: '加薪 25% 留住', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); const m = st.staff.find(x => x.role === 'manager'); if (m) m.salary = Math.round(m.salary * 1.25); return `店长留下了`; } },
        { label: '放行', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); const i = st.staff.findIndex(x => x.role === 'manager'); if (i >= 0) st.staff.splice(i, 1); st.morale = Math.max(10, st.morale - 8); return `店长离职，店里群龙无首`; } },
      ] },
    { id: 'ev_fund', icon: '🤵', name: '资本递来橄榄枝', weight: 5, target: 'global', cond: g => g.state.stores.length >= 3,
      text: () => `一位投资人约你喝茶：投 50 万，占两成干股，月月分红。`,
      choices: [
        { label: '签！（+50 万现金，24 个月每月分红 1.5 万）', fx: g => { g.gainCash(500000); g.state.mods.push({ type: 'dividend', mul: 15000, months: 24, name: '投资人分红' }); return `钱到账，从此每月要孝敬投资人 1.5 万`; } },
        { label: '我的店我说了算', fx: () => '' },
      ] },
    { id: 'ev_fr_req', icon: '🤝', name: '加盟申请', weight: 7, target: 'global', cond: g => !!g.state.upgrades.u_fc && g.state.brandRep >= 3.5 && g.countFranchise() < g.frCap(),
      text: () => `一位开了十年餐馆的老板想挂你的招牌，愿意自掏腰包装修。`,
      choices: [
        { label: '批准加盟（白得一家加盟店）', fx: g => { g.grantFranchise(); return `又一家加盟店挂牌营业！`; } },
        { label: '婉拒', fx: () => '' },
      ] },
    { id: 'ev_tv', icon: '📺', name: '卫视美食节目邀约', weight: 5, target: 'global', cond: g => g.state.brandRep >= 3.8,
      text: () => `省卫视美食栏目想给你的品牌做一期专访。`,
      choices: [
        { label: '上！（-8 万，知名度 +15，全店需求 +8% 两月）', fx: g => { g.spendCash(80000); g.state.fame += 15; g.addMod('demand', null, 1.08, 2, '电视专访'); return `节目播出后品牌名声大噪！`; } },
        { label: '太贵，不了', fx: () => '' },
      ] },
    { id: 'ev_burn', icon: '🩹', name: '后厨烫伤', weight: 8, target: 'store',
      text: s => `「${s.name}」的小工端锅时被烫伤了手臂。`,
      choices: [
        { label: '垫付医药费（-1 万）', fx: (g, ctx) => { g.spendCash(10000); const st = g.storeById(ctx.storeId); st.morale = Math.min(100, st.morale + 5); return `老板大气，全店暖心`; } },
        { label: '让他自己走工伤', fx: (g, ctx) => { const st = g.storeById(ctx.storeId); st.morale = Math.max(10, st.morale - 10); return `人心散了，队伍不好带`; } },
      ] },
    { id: 'ev_blackout', icon: '🔌', name: '片区停电', weight: 6, target: 'store',
      text: s => `片区电路检修，「${s.name}」停了一周电。`,
      fx: (g, ctx) => { g.addMod('demand_store', ctx.storeId, 0.75, 1, '停电'); return `停业一周，本月客流 -25%`; } },
    { id: 'ev_hair', icon: '🍜', name: '碗里有异物', weight: 9, target: 'store',
      text: s => `有客人称在「${s.name}」的碗里吃出了异物，正在店里嚷嚷。`,
      choices: [
        { label: '免单+赔偿（-5000）', fx: (g, ctx) => { g.spendCash(5000); g.bumpStoreRep(g.storeById(ctx.storeId), 0.05); return `处理得体，围观群众纷纷点赞`; } },
        { label: '质疑碰瓷', fx: (g, ctx) => { if (g.rnd() < 0.5) { g.bumpStoreRep(g.storeById(ctx.storeId), -0.40); return `监控视频流出，真是后厨的问题……口碑 -0.40`; } return `确实是碰瓷，店里硬气了一回`; } },
      ] },
    { id: 'ev_rank', icon: '🏅', name: '城市必吃榜', weight: 6, target: 'city', cond: g => g.state.stores.some(s => s.rep >= 3.8),
      text: c => `${c}发布年度必吃榜，你的店有希望上榜。`,
      fx: (g, ctx) => { g.addMod('demand_city', ctx.cityId, 1.2, 3, '必吃榜'); g.state.fame += 5; return `上榜！${ctx.cityName}客流 +20%（3 个月），知名度 +5`; } },
    { id: 'ev_rival_close', icon: '🪦', name: '对手关店', weight: 7, target: 'global', cond: g => g.state.rivals.some(r => r.alive && r.stores.length > 0 && r.strength < 60),
      text: () => `商圈里一家对手的门店贴出了转让告示。`,
      fx: g => { const r = g.state.rivals.find(x => x.alive && x.stores.length > 0 && x.strength < 60); r.stores.pop(); r.strength = Math.max(10, r.strength - 5); return `${r.name}关了一家店，地盘空出来了`; } },
    { id: 'ev_member', icon: '🎫', name: '会员日', weight: 8, target: 'global', cond: g => !!g.state.upgrades.u_app,
      text: () => `会员 APP 迎来每月会员日，老客回流。`,
      fx: g => { g.addMod('demand', null, 1.10, 1, '会员日'); g.state.fame += 2; return `会员日全店客流 +10%，知名度 +2`; } },
    { id: 'ev_rival_ad', icon: '📢', name: '对手广告轰炸', weight: 8, target: 'global',
      text: () => `对手的品牌广告铺满了电梯和公交站。`,
      fx: g => { g.state.fame = Math.max(0, g.state.fame - 3); return `对手声量大涨，你的知名度 -3`; } },
    { id: 'ev_influencer_hire', icon: '🕺', name: '店里来了活宝', weight: 6, target: 'store',
      text: s => `「${s.name}」新来的服务员特别会来事儿，客人被他逗得直乐。`,
      fx: (g, ctx) => { g.bumpStoreRep(ctx.store, 0.12); g.state.fame += 2; return `客人拍视频传播，「${ctx.store.name}」小小火了一把`; } },
  ],

  /* ---------------- 成就 ---------------- */
  achievements: [
    { id: 'a_first',    name: '开张大吉',     desc: '开出第一家店',           test: s => s.stores.length >= 1 },
    { id: 'a_profit',   name: '第一桶金',     desc: '单月净利破 10 万',        test: s => s.history.some(h => h.profit >= 100000) },
    { id: 'a_five',     name: '小有规模',     desc: '拥有 5 家门店',           test: s => s.stores.length >= 5 },
    { id: 'a_national', name: '走出本地',     desc: '进军国内市场',           test: s => s.stores.some(x => g_cityTier(x.cityId) === 2) },
    { id: 'a_ten',      name: '连锁大亨',     desc: '拥有 10 家门店',          test: s => s.stores.length >= 10 },
    { id: 'a_rep45',    name: '金字招牌',     desc: '品牌评分达到 4.5',        test: s => s.brandRep >= 4.5 },
    { id: 'a_overseas', name: '扬帆出海',     desc: '开出首家海外店',          test: s => s.stores.some(x => g_cityTier(x.cityId) === 3) },
    { id: 'a_buy',      name: '大鱼吃小鱼',   desc: '收购一家竞争对手',        test: s => s.flags.acquired >= 1 },
    { id: 'a_star5',    name: '食神附体',     desc: '单店评分达到 5.0',        test: s => s.stores.some(x => x.rep >= 5) },
    { id: 'a_rd10',     name: '菜研达人',     desc: '研发 10 道菜',            test: s => s.research.done.length >= 10 },
    { id: 'a_ck',       name: '工业脊梁',     desc: '建成中央厨房',            test: s => (s.upgrades.u_ck || 0) >= 1 },
    { id: 'a_fr10',     name: '万店之基',     desc: '加盟店达到 8 家',         test: s => s.stores.filter(x => x.mode === 'fr').length >= 8 },
    { id: 'a_twenty',   name: '餐饮帝国',     desc: '拥有 20 家门店',          test: s => s.stores.length >= 20 },
    { id: 'a_debt',     name: '无债一身轻',   desc: '还清全部贷款',            test: s => s.flags.hadLoan && s.loan <= 0 },
    { id: 'a_ipo',      name: '上市敲钟',     desc: '公司挂牌上市',            test: s => s.flags.ipo },
    { id: 'a_100m',     name: '身家过亿',     desc: '总资产突破 1 亿',         test: s => g_assets() >= 100000000 },
  ],
};

/* 成就测试需要的小工具：g_assets 由 engine 注入（浏览器共享全局 / node 走 global.G） */
var g_cityTier = id => { const c = DATA.cities.find(x => x.id === id); return c ? c.tier : 0; };
var g_assets = () => (typeof G !== 'undefined' && G.assets) ? G.assets() : 0;

/* node 支持 */
if (typeof module !== 'undefined' && module.exports) module.exports = { DATA };
