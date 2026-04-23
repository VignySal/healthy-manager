const app = getApp();

Page({
  data: {
    currentDate: '', // 当前选中的日期，格式 YYYY-MM-DD
    dailyGoal: 1800, // 每日卡路里目标
    totalCalories: 0, // 已摄入总卡路里
    meals: {
      breakfast: [], // 早餐
      lunch: [],     // 午餐
      dinner: [],    // 晚餐
      snacks: []     // 加餐
    },
    selectedImage: '', // 从卡路里识别页面传递过来的图片

    // 编辑弹窗相关数据
    showEditDialog: false,
    editingFood: null,
    editingMealType: '',
    editingIndex: -1,
    editCalories: '',
    editShareCount: '1'
  },

  onLoad(options) {
    // 初始化当前日期
    const today = new Date();
    const dateStr = this.formatDate(today);
    this.setData({
      currentDate: dateStr,
      selectedImage: options.image || ''
    });

    // 加载选定日期的饮食数据
    this.loadDailyData(dateStr);
  },

  onShow() {
    // 每次页面显示时重新加载数据
    this.loadDailyData(this.data.currentDate);
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 日期选择
  bindDateChange(e) {
    const selectedDate = e.detail.value;
    this.setData({
      currentDate: selectedDate
    });
    this.loadDailyData(selectedDate);
  },

  // 加载每日饮食数据
  loadDailyData(date) {
    // 从本地存储获取数据
    const dailyData = wx.getStorageSync(`daily_food_${date}`) || {
      meals: {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
      }
    };

    // 处理食物记录，确保数据格式统一
    let needSave = false; // 标记是否需要重新保存数据
    Object.values(dailyData.meals).forEach(meal => {
      meal.forEach(item => {
        // 确保有shareCount字段
        if (item.shareCount === undefined) {
          item.shareCount = 1; // 默认一个人吃
          needSave = true;
        }

        // 处理inputCalories字段
        if (item.inputCalories === undefined) {
          // 旧数据：假设calories是总卡路里
          // 计算个人摄入量 = 总卡路里 ÷ 分享人数
          const shareCount = item.shareCount || 1;
          const totalCalories = parseInt(item.calories) || 0;
          const personalCalories = Math.round(totalCalories / shareCount);

          item.inputCalories = totalCalories; // 保存总卡路里
          item.calories = personalCalories;   // 更新为个人摄入量
          needSave = true;
        }
      });
    });

    // 如果需要更新数据格式，重新保存
    if (needSave) {
      wx.setStorageSync(`daily_food_${date}`, dailyData);
    }

    // 计算总卡路里（个人摄入量之和）
    let totalCalories = 0;
    Object.values(dailyData.meals).forEach(meal => {
      meal.forEach(item => {
        totalCalories += parseInt(item.calories) || 0;
      });
    });

    this.setData({
      meals: dailyData.meals,
      totalCalories: totalCalories
    });
  },

  // 计算进度百分比
  getProgressPercentage() {
    const percentage = (this.data.totalCalories / this.data.dailyGoal) * 100;
    return Math.min(percentage, 100); // 最大100%
  },

  // 获取进度条颜色
  getProgressColor() {
    const percentage = this.getProgressPercentage();
    if (percentage < 50) return '#4CAF50'; // 绿色
    if (percentage < 80) return '#FFC107'; // 黄色
    return '#388E3C'; // 深绿色
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

  // 添加到饮食记录
  addToMeal(e) {
    const { mealType, foodData } = e.currentTarget.dataset;
    const newRecord = {
      id: Date.now(),
      name: foodData.name,
      calories: parseInt(foodData.calories) || 0,  // 个人摄入量
      inputCalories: parseInt(foodData.calories) || 0, // 总卡路里
      shareCount: 1, // 默认一个人吃
      image: this.data.selectedImage,
      time: this.getCurrentTime(),
      date: this.data.currentDate
    };

    // 更新数据
    const updatedMeals = { ...this.data.meals };
    updatedMeals[mealType].push(newRecord);

    // 保存到本地存储
    const storageKey = `daily_food_${this.data.currentDate}`;
    const existingData = wx.getStorageSync(storageKey) || { meals: {} };
    existingData.meals = updatedMeals;
    wx.setStorageSync(storageKey, existingData);

    // 更新页面数据
    this.setData({
      meals: updatedMeals,
      totalCalories: this.data.totalCalories + parseInt(foodData.calories)
    });

    wx.showToast({
      title: '已添加到' + this.getMealName(mealType),
      icon: 'success'
    });
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 删除饮食记录
  deleteRecord(e) {
    const { mealType, index } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条饮食记录吗？',
      success: (res) => {
        if (res.confirm) {
          // 从数组中删除
          const updatedMeals = { ...this.data.meals };
          const deletedItem = updatedMeals[mealType][index];
          updatedMeals[mealType].splice(index, 1);

          // 保存到本地存储
          const storageKey = `daily_food_${this.data.currentDate}`;
          const existingData = wx.getStorageSync(storageKey) || { meals: {} };
          existingData.meals = updatedMeals;
          wx.setStorageSync(storageKey, existingData);

          // 更新页面数据
          this.setData({
            meals: updatedMeals,
            totalCalories: this.data.totalCalories - parseInt(deletedItem.calories)
          });

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 跳转到卡路里识别页面
  goToCalorie() {
    wx.navigateTo({
      url: '/pages/calorie/calorie'
    });
  },

  // 查看食物详情（编辑弹窗）
  viewFoodDetail(e) {
    const { food, mealType, index } = e.currentTarget.dataset;

    // 计算总卡路里用于编辑
    // 如果存在inputCalories字段，则使用它（用户输入的总卡路里）
    // 否则计算：个人摄入量 × 分享人数
    const shareCount = food.shareCount || 1;
    let totalCalories;
    if (food.inputCalories !== undefined) {
      totalCalories = food.inputCalories; // 已保存的总卡路里
    } else {
      // 旧数据：calories可能是总卡路里或个人摄入量
      // 假设calories是个人摄入量，乘以分享人数得到总卡路里
      totalCalories = food.calories * shareCount;
    }

    this.setData({
      showEditDialog: true,
      editingFood: food,
      editingMealType: mealType,
      editingIndex: parseInt(index),
      editCalories: totalCalories.toString(),
      editShareCount: shareCount.toString()
    });
  },

  // 关闭编辑弹窗
  closeEditDialog() {
    this.setData({
      showEditDialog: false,
      editingFood: null,
      editingMealType: '',
      editingIndex: -1,
      editCalories: '',
      editShareCount: '1'
    });
  },

  // 卡路里输入处理
  onCaloriesInput(e) {
    const value = e.detail.value;
    // 只允许数字
    if (/^\d*$/.test(value)) {
      this.setData({
        editCalories: value
      });
    }
  },

  // 分享人数输入处理
  onShareCountInput(e) {
    const value = e.detail.value;
    // 只允许正整数
    if (/^[1-9]\d*$/.test(value) || value === '') {
      this.setData({
        editShareCount: value
      });
    }
  },

  // 保存食物编辑
  saveFoodEdit() {
    const { editingMealType, editingIndex, editCalories, editShareCount } = this.data;

    // 验证输入
    if (!editCalories || parseInt(editCalories) <= 0) {
      wx.showToast({
        title: '请输入有效的卡路里值',
        icon: 'none'
      });
      return;
    }

    if (!editShareCount || parseInt(editShareCount) < 1) {
      wx.showToast({
        title: '请输入有效的分享人数',
        icon: 'none'
      });
      return;
    }

    // 计算个人摄入量：总卡路里 ÷ 分享人数
    const foodTotalCalories = parseInt(editCalories);
    const shareCount = parseInt(editShareCount);
    const personalCalories = Math.round(foodTotalCalories / shareCount);

    // 获取当前日期数据
    const storageKey = `daily_food_${this.data.currentDate}`;
    const dailyData = wx.getStorageSync(storageKey) || { meals: {} };

    // 更新食物记录
    const mealArray = dailyData.meals[editingMealType];
    if (mealArray && mealArray[editingIndex]) {
      const updatedFood = {
        ...mealArray[editingIndex],
        calories: personalCalories,           // 存储个人摄入量
        inputCalories: foodTotalCalories,         // 存储用户输入的总卡路里
        shareCount: shareCount
      };

      mealArray[editingIndex] = updatedFood;

      // 保存到本地存储
      wx.setStorageSync(storageKey, dailyData);

      // 更新页面数据
      const updatedMeals = { ...this.data.meals };
      updatedMeals[editingMealType][editingIndex] = updatedFood;

      // 重新计算总卡路里
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

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      this.closeEditDialog();
    }
  }
});