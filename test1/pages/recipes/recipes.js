const app = getApp()
const { showToast } = require('../../utils/util')
const { parseCalorieText } = require('../../utils/api')

Page({
  data: {
    recipes: [],
    ingredients: [],
    ingredientsText: '',
    expandedIndex: -1,
    selectedMeals: {} // 存储每个菜谱选择的餐次，格式：{0: 'breakfast', 1: 'lunch'}
  },

  onLoad() {
    const recipes = app.globalData.recipes || []
    const ingredients = app.globalData.finalIngredients || []
    this.setData({
      recipes,
      ingredients,
      ingredientsText: ingredients.join('、')
    })
  },

  toggleRecipe(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      expandedIndex: this.data.expandedIndex === index ? -1 : index
    })
  },

  buyIngredients(e) {
    const missing = e.currentTarget.dataset.missing
    showToast(`模拟购买：${missing.join('、')}`)
  },

  // 选择餐次
  selectMeal(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const meal = e.currentTarget.dataset.meal;

    // 更新selectedMeals对象
    const selectedMeals = { ...this.data.selectedMeals };
    if (selectedMeals[index] === meal) {
      // 如果已经选中，则取消选择
      delete selectedMeals[index];
    } else {
      selectedMeals[index] = meal;
    }

    this.setData({
      selectedMeals
    });
  },

  // 保存到饮食概览
  saveToDietOverview(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const meal = this.data.selectedMeals[index];
    const recipe = this.data.recipes[index];

    if (!recipe || !meal) {
      showToast('请先选择餐次');
      return;
    }

    // 解析卡路里文本
    const originalCalories = recipe.calories || '约300';
    const parsedCalories = parseCalorieText(originalCalories);
    console.log(`菜谱卡路里解析: "${originalCalories}" → ${parsedCalories}`);

    // 获取当前日期和时间
    const dateStr = this.formatDate(new Date());
    const timeStr = this.getCurrentTime();

    // 构建食物记录（图片为空字符串）
    const foodRecord = {
      id: Date.now(),
      name: recipe.name,
      calories: parsedCalories,     // 个人摄入量（由于shareCount=1，等于总卡路里）
      inputCalories: parsedCalories, // 总卡路里
      originalCalories: originalCalories,
      shareCount: 1, // 默认一个人吃
      image: '', // 图片空着
      time: timeStr,
      date: dateStr
    };

    // 保存到本地存储
    const storageKey = `daily_food_${dateStr}`;
    const dailyData = wx.getStorageSync(storageKey) || { meals: {} };

    if (!dailyData.meals[meal]) {
      dailyData.meals[meal] = [];
    }

    dailyData.meals[meal].push(foodRecord);
    wx.setStorageSync(storageKey, dailyData);

    showToast(`已添加到${this.getMealName(meal)}`);

    // 清除当前菜谱的选择状态
    const selectedMeals = { ...this.data.selectedMeals };
    delete selectedMeals[index];
    this.setData({ selectedMeals });
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
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

  startOver() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  }
})