const app = getApp()
const { showToast, formatDate, getCurrentTime, getMealName } = require('../../utils/util')
const { parseCalorieText } = require('../../utils/api')
const { log } = require('../../utils/logger')
const { saveDietRecord, addToSyncQueue } = require('../../utils/cloud')

Page({
  data: {
    recipes: [],
    ingredients: [],
    ingredientsText: '',
    expandedIndex: -1,
    selectedMeals: {}, // 存储每个菜谱选择的餐次，格式：{0: 'breakfast', 1: 'lunch'}
    cookingMode: 'recommend', // 'recommend' 或 'banquet'
    personCount: 4, // 聚餐人数
    categorizedRecipes: [] // 聚餐模式下按分类整理的菜谱
  },

  onLoad() {
    const recipes = app.globalData.recipes || []
    const ingredients = app.globalData.finalIngredients || []
    const cookingMode = app.globalData.cookingMode || 'recommend'
    const personCount = app.globalData.personCount || 4

    // 为每个菜谱添加全局索引
    recipes.forEach((recipe, index) => {
      recipe.globalIndex = index
    })

    const data = {
      recipes,
      ingredients,
      ingredientsText: ingredients.join('、'),
      cookingMode,
      personCount
    }

    // 聚餐模式下，按分类整理菜谱
    if (cookingMode === 'banquet') {
      const categoryOrder = ['主菜', '炒菜', '凉菜', '汤品']
      const categoryMap = {}
      recipes.forEach(recipe => {
        const cat = recipe.category || '其他'
        if (!categoryMap[cat]) {
          categoryMap[cat] = []
        }
        categoryMap[cat].push(recipe)
      })
      const categorizedRecipes = categoryOrder
        .filter(cat => categoryMap[cat])
        .map(cat => ({ category: cat, recipes: categoryMap[cat] }))
      data.categorizedRecipes = categorizedRecipes
    }

    this.setData(data)
  },

  toggleRecipe(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      expandedIndex: this.data.expandedIndex === index ? -1 : index
    })
  },

  buyIngredients(e) {
    const missing = e.currentTarget.dataset.missing
    showToast(`模拟购买：${missing.map(i => i.full).join('、')}`)
  },

  // 选择餐次
  selectMeal(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const meal = e.currentTarget.dataset.meal;

    const selectedMeals = { ...this.data.selectedMeals };
    if (selectedMeals[index] === meal) {
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

    if (!meal) {
      showToast('请选择餐次');
      return;
    }

    if (!recipe) return;

    const originalCalories = recipe.calories || '约300';
    const parsedCalories = parseCalorieText(originalCalories);
    log(`菜谱卡路里解析: "${originalCalories}" → ${parsedCalories}`);

    const dateStr = formatDate(new Date());
    const timeStr = getCurrentTime();

    const foodRecord = {
      id: Date.now(),
      name: recipe.name,
      calories: parsedCalories,
      inputCalories: parsedCalories,
      originalCalories: originalCalories,
      shareCount: 1,
      image: '',
      time: timeStr,
      date: dateStr
    };

    const storageKey = `daily_food_${dateStr}`;
    const dailyData = wx.getStorageSync(storageKey) || { meals: {} };

    if (!dailyData.meals[meal]) {
      dailyData.meals[meal] = [];
    }

    dailyData.meals[meal].push(foodRecord);
    wx.setStorageSync(storageKey, dailyData);
    app.globalData.dietVersion++;
    app.globalData.pendingDietDate = dateStr;

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

    showToast(`已添加到${getMealName(meal)}`);

    const selectedMeals = { ...this.data.selectedMeals };
    delete selectedMeals[index];
    this.setData({ selectedMeals });
  },

  saveToMyRecipes(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const recipe = this.data.recipes[index];
    if (!recipe) return;

    const myRecipes = wx.getStorageSync('my_recipes') || [];
    const exists = myRecipes.find(r => r.name === recipe.name);
    if (exists) {
      showToast('该菜谱已在收藏中');
      return;
    }

    const savedItem = {
      id: Date.now(),
      name: recipe.name,
      type: 'recipe',
      calories: recipe.calories || '约300',
      ingredients: (recipe.ingredients || []).map(i => i.full),
      steps: recipe.steps || [],
      cookTime: recipe.cookTime || '',
      difficulty: recipe.difficulty || '',
      image: '',
      savedAt: formatDate(new Date())
    };

    myRecipes.push(savedItem);
    wx.setStorageSync('my_recipes', myRecipes);
    app.globalData.myRecipesVersion = (app.globalData.myRecipesVersion || 0) + 1;
    showToast('已添加到我的食谱');
  },

  startOver() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  }
})