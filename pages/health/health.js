const app = getApp()
const { log } = require('../../utils/logger')
const { DAILY_CALORIE_GOAL, HALF_CALORIE_GOAL } = require('../../utils/constants')
const { loadDietRecordsByRange, addToSyncQueue } = require('../../utils/cloud')

Page({
  data: {
    currentYear: 0,
    currentMonth: 0,
    todayStr: '',
    calendarData: [],
    dailyGoal: DAILY_CALORIE_GOAL,
    halfGoal: HALF_CALORIE_GOAL
  },

  onLoad() {
    log('健康分析页面加载');
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      todayStr: this.formatDate(now)
    });
    this.generateCalendar();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.generateCalendar();
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getDayCalories(dateStr) {
    const dailyData = wx.getStorageSync(`daily_food_${dateStr}`);
    if (!dailyData || !dailyData.meals) return 0;
    let total = 0;
    Object.values(dailyData.meals).forEach(meal => {
      meal.forEach(item => {
        total += parseInt(item.calories) || 0;
      });
    });
    return total;
  },

  generateCalendar() {
    const { currentYear, currentMonth } = this.data;
    const cacheKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const cache = app.globalData.monthlyCache;

    if (cache && cache.key === cacheKey && cache.version === app.globalData.dietVersion) {
      this.setData({ calendarData: cache.data });
      return;
    }

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendarData = [];
    let week = [];
    let cellId = 0;

    for (let i = 0; i < startDayOfWeek; i++) {
      week.push({ day: null, date: '', calories: 0, hasData: false, cellKey: `empty-${cellId++}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth - 1, day);
      const dateStr = this.formatDate(date);
      const calories = this.getDayCalories(dateStr);
      week.push({
        day,
        date: dateStr,
        calories,
        hasData: calories > 0,
        cellKey: dateStr
      });
      if (week.length === 7) {
        calendarData.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ day: null, date: '', calories: 0, hasData: false, cellKey: `empty-${cellId++}` });
      }
      calendarData.push(week);
    }

    app.globalData.monthlyCache = {
      key: cacheKey,
      version: app.globalData.dietVersion,
      data: calendarData
    };

    this.setData({ calendarData });

    // 云端同步：若云端就绪，批量加载当月数据并更新日历
    if (app.globalData.cloudReady && app.globalData.openid && app.globalData.isNetworkConnected) {
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      loadDietRecordsByRange(startDate, endDate).then(records => {
        if (!records || records.length === 0) return;

        // 构建云端数据映射
        const cloudMap = {};
        records.forEach(r => {
          cloudMap[r.date] = r.totalCalories || 0;
          // 同时更新本地存储
          wx.setStorageSync(`daily_food_${r.date}`, { meals: r.meals });
        });

        // 更新日历数据
        const updatedCalendar = calendarData.map(w => w.map(cell => {
          if (!cell.date || !cloudMap[cell.date]) return cell;
          return { ...cell, calories: cloudMap[cell.date], hasData: cloudMap[cell.date] > 0 };
        }));

        this.setData({ calendarData: updatedCalendar });
        app.globalData.monthlyCache = {
          key: cacheKey,
          version: app.globalData.dietVersion,
          data: updatedCalendar
        };
      }).catch(err => {
        console.log('[cloud] 日历云端加载失败:', err.message);
      });
    }
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      this.setData({ currentYear: currentYear - 1, currentMonth: 12 });
    } else {
      this.setData({ currentMonth: currentMonth - 1 });
    }
    this.generateCalendar();
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      this.setData({ currentYear: currentYear + 1, currentMonth: 1 });
    } else {
      this.setData({ currentMonth: currentMonth + 1 });
    }
    this.generateCalendar();
  },

  onDayTap(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    app.globalData.pendingDietDate = date;
    wx.switchTab({
      url: '/pages/diet-overview/diet-overview'
    });
  },

  goToFridgeScan() {
    wx.navigateTo({
      url: '/pages/index/index'
    });
  },

  goToManualSelect() {
    app.globalData.recognizedIngredients = [];
    app.globalData.selectedImage = null;
    app.globalData.selectedImages = [];
    app.globalData.manualMode = true;
    wx.navigateTo({
      url: '/pages/recognize/recognize'
    });
  },

  goToCalorieScanner() {
    wx.navigateTo({
      url: '/pages/calorie/calorie'
    });
  }
});