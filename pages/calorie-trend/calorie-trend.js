const { formatDate } = require('../../utils/util');
const { DAILY_CALORIE_GOAL } = require('../../utils/constants');

const MEAL_CONFIG = [
  { key: 'breakfast', name: '早餐', color: '#FF6B35' },
  { key: 'lunch', name: '午餐', color: '#4CAF50' },
  { key: 'dinner', name: '晚餐', color: '#2196F3' },
  { key: 'snacks', name: '加餐', color: '#9C27B0' },
  { key: 'total', name: '总计', color: '#E91E63' }
];

Page({
  data: {
    dates: [],
    mealCalories: {},
    dailyGoal: DAILY_CALORIE_GOAL,
    maxCalorie: 0,
    avgCalorie: 0,
    chartReady: false,
    dayRange: 7,
    rangeOptions: [
      { label: '近7天', value: 7 },
      { label: '近15天', value: 15 },
      { label: '近30天', value: 30 }
    ],
    showDropdown: false,
    mealToggles: [
      { key: 'breakfast', name: '早餐', color: '#FF6B35', enabled: false },
      { key: 'lunch', name: '午餐', color: '#4CAF50', enabled: false },
      { key: 'dinner', name: '晚餐', color: '#2196F3', enabled: false },
      { key: 'snacks', name: '加餐', color: '#9C27B0', enabled: false },
      { key: 'total', name: '总计', color: '#E91E63', enabled: true }
    ]
  },

  onLoad() {
    const prefs = wx.getStorageSync('dietaryPreferences') || {};
    if (prefs.dailyCalorieGoal) {
      this.setData({ dailyGoal: prefs.dailyCalorieGoal });
    }
    this.collectData();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.collectData();
  },

  onReady() {
    setTimeout(() => {
      if (this.data.chartReady) {
        this.drawChart();
      }
    }, 200);
  },

  collectData() {
    const dates = [];
    const mealCalories = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
      total: []
    };
    const today = new Date();
    const dayRange = this.data.dayRange;

    for (let i = dayRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const stored = wx.getStorageSync(`daily_food_${dateStr}`) || {};
      const meals = stored.meals || {};

      let dayTotal = 0;
      ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(key => {
        let cal = 0;
        if (Array.isArray(meals[key])) {
          meals[key].forEach(item => { cal += parseInt(item.calories) || 0; });
        }
        mealCalories[key].push(cal);
        dayTotal += cal;
      });
      mealCalories.total.push(dayTotal);

      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${month}/${day}`);
    }

    // 计算 Y 轴最大值：取所有已启用餐类中的最大值
    const enabledKeys = this.data.mealToggles.filter(m => m.enabled).map(m => m.key);
    let maxCal = this.data.dailyGoal;
    enabledKeys.forEach(key => {
      if (mealCalories[key] && mealCalories[key].length) {
        maxCal = Math.max(maxCal, ...mealCalories[key]);
      }
    });

    const totalSum = mealCalories.total.reduce((a, b) => a + b, 0);
    const avgCal = Math.round(totalSum / dayRange);

    this.setData({
      dates,
      mealCalories,
      maxCalorie: maxCal,
      avgCalorie: avgCal,
      chartReady: true
    }, () => {
      this.drawChart();
    });
  },

  drawChart() {
    const query = wx.createSelectorQuery();
    query.select('#calorieChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        const width = res[0].width;
        const height = res[0].height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this._draw(ctx, width, height);
      });
  },

  _draw(ctx, w, h) {
    const { dates, mealCalories, dailyGoal, maxCalorie, mealToggles } = this.data;
    const padding = { top: 30, right: 24, bottom: 50, left: 56 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const yMax = Math.ceil((maxCalorie * 1.2) / 100) * 100 || 2000;
    const ySteps = 5;
    const yStepVal = yMax / ySteps;

    const xPos = (i) => padding.left + (chartW / (dates.length - 1)) * i;
    const yPos = (val) => padding.top + chartH - (val / yMax) * chartH;

    // ---- Y 轴网格线与标签 ----
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round(yStepVal * i);
      const y = yPos(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(val), padding.left - 8, y);
    }

    // ---- 目标值参考线 ----
    const goalY = yPos(dailyGoal);
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, goalY);
    ctx.lineTo(w - padding.right, goalY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#FF9800';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`目标 ${dailyGoal}`, w - padding.right + 4, goalY);

    // ---- X 轴日期标签 ----
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let labelStep = 1;
    if (dates.length > 20) labelStep = 5;
    else if (dates.length > 14) labelStep = 3;
    else if (dates.length > 10) labelStep = 2;

    for (let i = 0; i < dates.length; i++) {
      if (i % labelStep === 0 || i === dates.length - 1) {
        ctx.fillText(dates[i], xPos(i), h - padding.bottom + 12);
      }
    }

    // ---- 绘制各餐折线 ----
    const enabledMeals = mealToggles.filter(m => m.enabled);
    const totalEnabled = mealToggles.find(m => m.key === 'total').enabled;
    const lineWidth = enabledMeals.length > 2 ? 2 : 2.5;

    enabledMeals.forEach(meal => {
      const data = mealCalories[meal.key];
      if (!data || data.length === 0) return;

      // 总计开启时：总计 alpha=1，其余 0.5；总计关闭时：其余 alpha=1
      if (totalEnabled) {
        ctx.globalAlpha = meal.key === 'total' ? 1 : 0.5;
      }

      ctx.strokeStyle = meal.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = xPos(i);
        const y = yPos(data[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (totalEnabled) ctx.globalAlpha = 1;
    });

    // ---- 数据点 ----
    const pointRadius = dates.length > 14 ? 2.5 : dates.length > 10 ? 3 : 4;

    enabledMeals.forEach(meal => {
      const data = mealCalories[meal.key];
      if (!data || data.length === 0) return;

      if (totalEnabled) {
        ctx.globalAlpha = meal.key === 'total' ? 1 : 0.5;
      }

      for (let i = 0; i < data.length; i++) {
        if (data[i] === 0 && meal.key !== 'total') continue;
        const x = xPos(i);
        const y = yPos(data[i]);

        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = meal.color;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      if (totalEnabled) ctx.globalAlpha = 1;
    });

    // ---- 右上角图例 ----
    const legendX = w - padding.right - 4;
    let legendY = padding.top + 4;
    const legendItemH = 18;
    const legendBoxW = 14;

    MEAL_CONFIG.forEach(meal => {
      const enabled = mealToggles.find(m => m.key === meal.key).enabled;
      ctx.fillStyle = enabled ? meal.color : '#ccc';
      ctx.fillRect(legendX - legendBoxW, legendY + 2, legendBoxW, 10);

      ctx.fillStyle = enabled ? '#333' : '#ccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(meal.name, legendX - legendBoxW - 6, legendY + 1);

      legendY += legendItemH;
    });
  },

  toggleDropdown() {
    this.setData({ showDropdown: !this.data.showDropdown });
  },

  selectRange(e) {
    const value = Number(e.currentTarget.dataset.value);
    if (value === this.data.dayRange) {
      this.setData({ showDropdown: false });
      return;
    }
    this.setData({ dayRange: value, showDropdown: false }, () => {
      this.collectData();
    });
  },

  toggleMeal(e) {
    const key = e.currentTarget.dataset.key;
    const mealToggles = this.data.mealToggles.map(m => {
      if (m.key === key) return { ...m, enabled: !m.enabled };
      return m;
    });
    this.setData({ mealToggles }, () => {
      // 重新计算 Y 轴范围
      const enabledKeys = mealToggles.filter(m => m.enabled).map(m => m.key);
      let maxCal = this.data.dailyGoal;
      enabledKeys.forEach(k => {
        const arr = this.data.mealCalories[k];
        if (arr && arr.length) maxCal = Math.max(maxCal, ...arr);
      });
      this.setData({ maxCalorie: maxCal }, () => {
        this.drawChart();
      });
    });
  }
});