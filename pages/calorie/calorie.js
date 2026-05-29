const app = getApp();
const { recognizeCalorie, parseCalorieText } = require('../../utils/api');
const { formatDate, getCurrentTime, getMealName } = require('../../utils/util');
const { log, error: logError } = require('../../utils/logger');
const { saveDietRecord, addToSyncQueue } = require('../../utils/cloud');

Page({
  data: {
    selectedImage: '',
    calorieResult: null,
    selectedMeal: '',
    selectedDate: '',
    isLoading: false
  },

  onLoad(options) {
    log('卡路里识别页面加载');
    // 优先使用 globalData 传递的日期（从饮食概览页进入），其次 URL 参数，最后默认今天
    if (app.globalData.pendingCalorieDate) {
      this.setData({ selectedDate: app.globalData.pendingCalorieDate });
      app.globalData.pendingCalorieDate = null;
    } else if (options.date) {
      this.setData({ selectedDate: decodeURIComponent(options.date) });
    } else {
      this.setData({ selectedDate: formatDate(new Date()) });
    }
  },

  onShow() {
    log('卡路里识别页面显示');
  },

  chooseImage() {
    log('开始选择图片...');
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        log('选择图片成功');
        this.setData({
          selectedImage: res.tempFilePaths[0],
          calorieResult: null
        });
      },
      fail: (err) => {
        logError('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  removeImage() {
    this.setData({
      selectedImage: '',
      calorieResult: null
    });
  },

  analyzeCalorie() {
    if (!this.data.selectedImage) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true })
    wx.showLoading({
      title: '分析中...'
    });

    recognizeCalorie(this.data.selectedImage).then(res => {
      wx.hideLoading();
      this.setData({ isLoading: false })

      if (res.success) {
        this.setData({
          calorieResult: res.data,
          selectedMeal: ''
        });

        wx.showToast({
          title: '分析完成',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '分析失败，请重试',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isLoading: false })
      console.error('卡路里识别失败:', err);
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'none'
      });
    });
  },

  // 选择餐次
  selectMeal(e) {
    const mealType = e.currentTarget.dataset.meal;
    this.setData({
      selectedMeal: mealType
    });
  },

  // 保存到饮食记录
  saveToDiary() {
    if (!this.data.selectedMeal) {
      wx.showToast({
        title: '请选择餐次',
        icon: 'none'
      });
      return;
    }

    if (!this.data.calorieResult) {
      wx.showToast({
        title: '暂无识别结果',
        icon: 'none'
      });
      return;
    }

    // 使用用户选择的日期（默认今天，若从饮食概览进入则为概览页当前日期）
    const dateStr = this.data.selectedDate || formatDate(new Date());

    // 解析卡路里文本
    const originalCalories = this.data.calorieResult.calories || '0';
    const parsedCalories = parseCalorieText(originalCalories);
    log(`卡路里解析: "${originalCalories}" → ${parsedCalories}`);

    // 构建食物记录
    const foodRecord = {
      id: Date.now(),
      name: this.data.calorieResult.foodName,
      calories: parsedCalories,
      inputCalories: parsedCalories,
      originalCalories: originalCalories,
      shareCount: 1,
      image: this.data.selectedImage,
      time: getCurrentTime(),
      date: dateStr
    };

    // 保存到本地存储
    const storageKey = `daily_food_${dateStr}`;
    const dailyData = wx.getStorageSync(storageKey) || { meals: {} };

    if (!dailyData.meals[this.data.selectedMeal]) {
      dailyData.meals[this.data.selectedMeal] = [];
    }

    dailyData.meals[this.data.selectedMeal].push(foodRecord);
    wx.setStorageSync(storageKey, dailyData);
    app.globalData.dietVersion++;

    // 同步到云端
    if (app.globalData.cloudReady && app.globalData.openid && app.globalData.isNetworkConnected) {
      let total = 0;
      Object.values(dailyData.meals || {}).forEach(meal => {
        meal.forEach(item => { total += parseInt(item.calories) || 0; });
      });
      saveDietRecord(dateStr, dailyData.meals || {}, total).catch(() => {
        addToSyncQueue(dateStr);
      });
    }

    // 通知饮食概览页面：有今天的新数据
    app.globalData.pendingDietDate = dateStr;

    wx.showToast({
      title: '已添加到' + getMealName(this.data.selectedMeal),
      icon: 'success'
    });

    // 仅重置餐次选择，保留识别结果以便继续操作
    this.setData({
      selectedMeal: ''
    });
  },

  saveToMyRecipes() {
    const result = this.data.calorieResult;
    if (!result) {
      wx.showToast({ title: '暂无识别结果', icon: 'none' });
      return;
    }

    const myRecipes = wx.getStorageSync('my_recipes') || [];
    const exists = myRecipes.find(r => r.name === result.foodName);
    if (exists) {
      wx.showToast({ title: '该食物已在收藏中', icon: 'none' });
      return;
    }

    const savedItem = {
      id: Date.now(),
      name: result.foodName,
      type: 'food',
      calories: result.calories || '0',
      nutrition: result.nutrition || '',
      suggestion: result.suggestion || '',
      ingredients: [],
      steps: [],
      image: this.data.selectedImage || '',
      savedAt: formatDate(new Date())
    };

    myRecipes.push(savedItem);
    wx.setStorageSync('my_recipes', myRecipes);
    app.globalData.myRecipesVersion = (app.globalData.myRecipesVersion || 0) + 1;
    wx.showToast({ title: '已添加到我的食谱', icon: 'success' });
  },

  viewDailyOverview() {
    // 设置待查看日期为今天（calorie 页始终保存到当天）
    app.globalData.pendingDietDate = this.data.selectedDate || formatDate(new Date());
    wx.switchTab({
      url: '/pages/diet-overview/diet-overview'
    });
  },

  bindDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
  }
});