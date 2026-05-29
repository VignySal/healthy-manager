const app = getApp();
const { formatDate } = require('../../utils/util');
const { DAILY_CALORIE_GOAL } = require('../../utils/constants');
const { saveDietRecord, loadDietRecord, addToSyncQueue } = require('../../utils/cloud');

const MEAL_TYPES = [
  { key: 'breakfast', title: '早餐', icon: '\u{1F305}' },
  { key: 'lunch', title: '午餐', icon: '\u{2600}\u{FE0F}' },
  { key: 'dinner', title: '晚餐', icon: '\u{1F319}' },
  { key: 'snacks', title: '加餐', icon: '\u{1F370}' }
];

Page({
  data: {
    currentDate: '',
    dailyGoal: DAILY_CALORIE_GOAL,
    totalCalories: 0,
    meals: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: []
    },
    mealTypes: MEAL_TYPES,
    hasNoRecords: true,
    selectedImage: '',
    progressPercentage: 0,
    progressStatus: '',

    // 编辑弹窗相关数据
    showEditDialog: false,
    editingFood: null,
    editingMealType: '',
    editingIndex: -1,
    editName: '',
    editCalories: '',
    editShareCount: '1',
    editTime: ''
  },

  onLoad(options) {
    const today = new Date();
    // 优先使用日历页传来的 pendingDietDate（switchTab 无法携带 query 参数）
    const dateStr = app.globalData.pendingDietDate || options.date || formatDate(today);
    if (app.globalData.pendingDietDate) {
      app.globalData.pendingDietDate = null;
    }
    this.setData({
      currentDate: dateStr,
      selectedImage: options.image || ''
    });
    this.loadDailyData(dateStr);
  },

  onReady() {
    this.drawProgressRing();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    const today = formatDate(new Date());
    if (app.globalData.pendingDietDate) {
      const date = app.globalData.pendingDietDate;
      app.globalData.pendingDietDate = null;
      // 若 onLoad 已处理过同一日期则跳过，避免重复加载
      if (date !== this.data.currentDate) {
        this.setData({ currentDate: date });
        this.loadDailyData(date);
      }
    } else if (this.data.currentDate && this.data.currentDate !== today) {
      // 从其他 tab 切回且不是今天：保持用户之前查看的日期
      this.loadDailyData(this.data.currentDate);
    } else {
      // 首次加载或已是今天：加载今天数据
      this.setData({ currentDate: today });
      this.loadDailyData(today);
    }
  },

  bindDateChange(e) {
    const selectedDate = e.detail.value;
    console.log('[bindDateChange] 切换到日期:', selectedDate);
    this.setData({ currentDate: selectedDate });
    this.loadDailyData(selectedDate);
  },

  goToPrevDay() {
    const date = new Date(this.data.currentDate);
    date.setDate(date.getDate() - 1);
    const dateStr = formatDate(date);
    this.setData({ currentDate: dateStr });
    this.loadDailyData(dateStr);
  },

  goToNextDay() {
    const date = new Date(this.data.currentDate);
    date.setDate(date.getDate() + 1);
    const dateStr = formatDate(date);
    this.setData({ currentDate: dateStr });
    this.loadDailyData(dateStr);
  },

  // 加载每日饮食数据
  loadDailyData(date) {
    console.log('[loadDailyData] 加载日期:', date);
    const stored = wx.getStorageSync(`daily_food_${date}`) || {};

    // 读取用户设置的每日卡路里目标
    const prefs = wx.getStorageSync('dietaryPreferences') || {};
    const dailyGoal = prefs.dailyCalorieGoal || DAILY_CALORIE_GOAL;

    // 确保 4 个餐次始终存在（storage 里可能只存了部分餐次）
    const meals = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
      ...(stored.meals || {})
    };

    const dailyData = { meals };

    // 处理食物记录，确保数据格式统一
    let needSave = false;
    Object.values(dailyData.meals).forEach(meal => {
      meal.forEach(item => {
        if (item.shareCount === undefined) {
          item.shareCount = 1;
          needSave = true;
        }

        if (item.inputCalories === undefined) {
          const shareCount = item.shareCount || 1;
          const totalCalories = parseInt(item.calories) || 0;
          const personalCalories = Math.round(totalCalories / shareCount);

          item.inputCalories = totalCalories;
          item.calories = personalCalories;
          needSave = true;
        }
      });
    });

    if (needSave) {
      wx.setStorageSync(`daily_food_${date}`, dailyData);
      app.globalData.dietVersion++;
    }

    // 计算总卡路里
    let totalCalories = 0;
    Object.values(dailyData.meals).forEach(meal => {
      meal.forEach(item => {
        totalCalories += parseInt(item.calories) || 0;
      });
    });

    const hasNoRecords = !meals.breakfast.length && !meals.lunch.length && !meals.dinner.length && !meals.snacks.length;

    this.setData({
      meals: meals,
      totalCalories: totalCalories,
      hasNoRecords: hasNoRecords,
      dailyGoal: dailyGoal
    });
    this.drawProgressRing();
    this.updateProgressPercentage();

    // 云端同步：若本地无数据且云端就绪，尝试从云端加载
    if (app.globalData.cloudReady && app.globalData.openid && app.globalData.isNetworkConnected) {
      if (hasNoRecords) {
        loadDietRecord(date).then(cloudData => {
          if (cloudData && cloudData.meals) {
            wx.setStorageSync(`daily_food_${date}`, { meals: cloudData.meals });
            app.globalData.dietVersion++;
            this.loadDailyData(date);
          }
        }).catch(err => {
          console.log('[cloud] 云端加载失败，使用本地数据:', err.message);
        });
      } else {
        // 本地有数据，静默同步到云端
        saveDietRecord(date, meals, totalCalories).catch(() => {
          addToSyncQueue(date);
        });
      }
    }
  },

  getProgressPercentage() {
    const percentage = (this.data.totalCalories / this.data.dailyGoal) * 100;
    return Math.round(percentage);
  },

  // 计算并更新进度百分比到 data
  updateProgressPercentage() {
    const totalCalories = this.data.totalCalories || 0;
    const dailyGoal = this.data.dailyGoal || DAILY_CALORIE_GOAL || 2000;
    const percentage = dailyGoal > 0 ? (totalCalories / dailyGoal) * 100 : 0;
    const progressPercentage = Math.round(percentage);
    let progressStatus = '';
    if (progressPercentage < 50) {
      progressStatus = '继续加油！';
    } else if (progressPercentage < 80) {
      progressStatus = '摄入良好';
    } else if (progressPercentage <= 100) {
      progressStatus = '接近目标';
    } else if (progressPercentage <= 120) {
      progressStatus = '已超标';
    } else {
      progressStatus = '严重超标';
    }
    console.log('[updateProgressPercentage]', { totalCalories, dailyGoal, progressPercentage, progressStatus });
    this.setData({ progressPercentage, progressStatus });
  },

  // Canvas 2D 绘制环形进度条：12点钟方向逆时针填充
  // 绿色 0-100% → 橙色 100%-120% → 红色 120%+
  drawProgressRing(retryCount) {
    if (retryCount === undefined) retryCount = 0;
    const query = wx.createSelectorQuery();
    query.select('#progressCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) {
        if (retryCount < 5) {
          setTimeout(() => this.drawProgressRing(retryCount + 1), 100);
        }
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const displayWidth = res[0].width;

      canvas.width = displayWidth * dpr;
      canvas.height = displayWidth * dpr;
      ctx.scale(dpr, dpr);

      const center = displayWidth / 2;
      const radius = center - 12;
      const lineWidth = 14;
      const rawPercent = (this.data.totalCalories / this.data.dailyGoal) * 100;

      ctx.clearRect(0, 0, displayWidth, displayWidth);

      // 背景圆环
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (rawPercent === 0) return;

      const segments = [
        { pct: Math.min(rawPercent, 100), color: '#4CAF50' },
        { pct: rawPercent > 100 ? Math.min(rawPercent, 120) - 100 : 0, color: '#FF9800' },
        { pct: rawPercent > 120 ? rawPercent - 120 : 0, color: '#F44336' }
      ];

      let currentAngle = -Math.PI / 2; // 12点钟

      segments.forEach(seg => {
        if (seg.pct <= 0) return;
        const sweep = (seg.pct / 100) * Math.PI * 2;
        const endAngle = currentAngle - sweep;

        ctx.beginPath();
        ctx.arc(center, center, radius, currentAngle, endAngle, true);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        currentAngle = endAngle;
      });
    });
  },

  deleteRecord(e) {
    const { mealType, index } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条饮食记录吗？',
      success: (res) => {
        if (res.confirm) {
          const updatedMeals = { ...this.data.meals };
          const deletedItem = updatedMeals[mealType][index];
          updatedMeals[mealType].splice(index, 1);

          const storageKey = `daily_food_${this.data.currentDate}`;
          const existingData = wx.getStorageSync(storageKey) || { meals: {} };
          existingData.meals = updatedMeals;
          wx.setStorageSync(storageKey, existingData);
          app.globalData.dietVersion++;

          // 同步到云端
          if (app.globalData.cloudReady && app.globalData.openid && app.globalData.isNetworkConnected) {
            const newTotal = this.data.totalCalories - parseInt(deletedItem.calories);
            saveDietRecord(this.data.currentDate, updatedMeals, newTotal).catch(() => {
              addToSyncQueue(this.data.currentDate);
            });
          }

          const hasNoRecords = !updatedMeals.breakfast.length && !updatedMeals.lunch.length && !updatedMeals.dinner.length && !updatedMeals.snacks.length;

          this.setData({
            meals: updatedMeals,
            totalCalories: this.data.totalCalories - parseInt(deletedItem.calories),
            hasNoRecords: hasNoRecords
          });
          this.drawProgressRing();
          this.updateProgressPercentage();

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  goToCalorie() {
    // 通过 globalData 传递选定日期，作为 URL 参数的可靠后备
    app.globalData.pendingCalorieDate = this.data.currentDate;
    wx.navigateTo({
      url: '/pages/calorie/calorie?date=' + encodeURIComponent(this.data.currentDate)
    });
  },

  viewFoodDetail(e) {
    const { food, mealType, index } = e.currentTarget.dataset;

    const shareCount = food.shareCount || 1;
    let totalCalories;
    if (food.inputCalories !== undefined) {
      totalCalories = food.inputCalories;
    } else {
      totalCalories = food.calories * shareCount;
    }

    this.setData({
      showEditDialog: true,
      editingFood: food,
      editingMealType: mealType,
      editingIndex: parseInt(index),
      editName: food.name,
      editCalories: totalCalories.toString(),
      editShareCount: shareCount.toString(),
      editTime: food.time || ''
    });
  },

  closeEditDialog() {
    this.setData({
      showEditDialog: false,
      editingFood: null,
      editingMealType: '',
      editingIndex: -1,
      editName: '',
      editCalories: '',
      editShareCount: '1',
      editTime: ''
    });
  },

  onCaloriesInput(e) {
    const value = e.detail.value;
    if (/^\d*$/.test(value)) {
      this.setData({ editCalories: value });
    }
  },

  onShareCountInput(e) {
    const value = e.detail.value;
    if (/^[1-9]\d*$/.test(value) || value === '') {
      this.setData({ editShareCount: value });
    }
  },

  onNameInput(e) {
    this.setData({ editName: e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ editTime: e.detail.value });
  },

  saveFoodEdit() {
    const { editingMealType, editingIndex, editCalories, editShareCount } = this.data;

    if (!editCalories || parseInt(editCalories) <= 0) {
      wx.showToast({ title: '请输入有效的卡路里值', icon: 'none' });
      return;
    }

    if (!editShareCount || parseInt(editShareCount) < 1) {
      wx.showToast({ title: '请输入有效的分享人数', icon: 'none' });
      return;
    }

    const foodTotalCalories = parseInt(editCalories);
    const shareCount = parseInt(editShareCount);
    const personalCalories = Math.round(foodTotalCalories / shareCount);

    const storageKey = `daily_food_${this.data.currentDate}`;
    const dailyData = wx.getStorageSync(storageKey) || { meals: {} };

    const mealArray = dailyData.meals[editingMealType];
    if (mealArray && mealArray[editingIndex]) {
      const updatedFood = {
        ...mealArray[editingIndex],
        name: this.data.editName || mealArray[editingIndex].name,
        calories: personalCalories,
        inputCalories: foodTotalCalories,
        shareCount: shareCount,
        time: this.data.editTime || mealArray[editingIndex].time
      };

      mealArray[editingIndex] = updatedFood;
      wx.setStorageSync(storageKey, dailyData);
      app.globalData.dietVersion++;

      const updatedMeals = { ...this.data.meals };
      updatedMeals[editingMealType][editingIndex] = updatedFood;

      // 同步到云端
      if (app.globalData.cloudReady && app.globalData.openid && app.globalData.isNetworkConnected) {
        saveDietRecord(this.data.currentDate, updatedMeals, totalCalories).catch(() => {
          addToSyncQueue(this.data.currentDate);
        });
      }

      let totalCalories = 0;
      Object.values(updatedMeals).forEach(meal => {
        meal.forEach(item => {
          totalCalories += parseInt(item.calories) || 0;
        });
      });

      this.setData({
        meals: updatedMeals,
        totalCalories: totalCalories
      });
      this.drawProgressRing();
      this.updateProgressPercentage();

      wx.showToast({ title: '保存成功', icon: 'success' });
      this.closeEditDialog();
    }
  }
});