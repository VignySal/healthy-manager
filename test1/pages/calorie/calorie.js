const app = getApp();
const { recognizeCalorie, parseCalorieText } = require('../../utils/api');

Page({
  data: {
    selectedImage: '',
    calorieResult: null,
    selectedMeal: '' // 选中的餐次：breakfast, lunch, dinner, snacks
  },

  onLoad() {
    console.log('卡路里识别页面加载');
    console.log('当前页面数据:', this.data);
  },

  onShow() {
    console.log('卡路里识别页面显示');
    console.log('selectedImage状态:', this.data.selectedImage);
  },

  chooseImage() {
    console.log('开始选择图片...');
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        console.log('选择图片成功:', res);
        console.log('临时文件路径:', res.tempFilePaths);
        console.log('选择的图片:', res.tempFilePaths[0]);
        
        this.setData({
          selectedImage: res.tempFilePaths[0],
          calorieResult: null
        }, () => {
          console.log('setData成功，当前selectedImage:', this.data.selectedImage);
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
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

    wx.showLoading({
      title: '分析中...'
    });

    // 调用阿里云API进行卡路里识别
    recognizeCalorie(this.data.selectedImage).then(res => {
      wx.hideLoading();

      if (res.success) {
        this.setData({
          calorieResult: res.data,
          selectedMeal: '' // 重置餐次选择
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
    if (!this.data.selectedMeal || !this.data.calorieResult) {
      wx.showToast({
        title: '请先选择餐次',
        icon: 'none'
      });
      return;
    }

    // 获取当前日期
    const today = new Date();
    const dateStr = this.formatDate(today);

    // 解析卡路里文本
    const originalCalories = this.data.calorieResult.calories || '0';
    const parsedCalories = parseCalorieText(originalCalories);
    console.log(`卡路里解析: "${originalCalories}" → ${parsedCalories}`);

    // 构建食物记录
    // parsedCalories是总卡路里，shareCount=1，所以个人摄入量=总卡路里
    const foodRecord = {
      id: Date.now(),
      name: this.data.calorieResult.foodName,
      calories: parsedCalories,           // 个人摄入量（由于shareCount=1，等于总卡路里）
      inputCalories: parsedCalories,      // 总卡路里
      originalCalories: originalCalories, // 保存原始文本用于显示
      shareCount: 1, // 默认一个人吃
      image: this.data.selectedImage,
      time: this.getCurrentTime(),
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

    wx.showToast({
      title: '已添加到' + this.getMealName(this.data.selectedMeal),
      icon: 'success'
    });

    // 重置选择
    this.setData({
      selectedMeal: '',
      selectedImage: '',
      calorieResult: null
    });
  },

  // 查看每日概览
  viewDailyOverview() {
    wx.navigateTo({
      url: '/pages/diet-overview/diet-overview'
    });
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取餐次名称
  getMealName(mealType) {
    const names = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐',
      snacks: '加餐'
    };
    return names[mealType] || mealType;
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
});