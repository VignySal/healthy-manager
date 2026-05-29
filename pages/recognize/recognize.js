const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/util')
const { generateRecipes } = require('../../utils/api')

Page({
  data: {
    selectedImage: '',
    selectedImages: [],
    ingredients: [],
    newIngredient: '',
    cookingStyle: 'standard',
    cookingTime: '',
    customTime: '',
    recipeCount: 3,
    cookingMode: 'recommend', // 'recommend' 或 'banquet'
    personCount: 4, // 聚餐人数，默认4人
    spicyLevels: ['不吃辣', '微辣', '中辣', '特辣', '任意'],
    spicyIndex: 0,
    spicyLocked: false,
    commonIngredients: []
  },

  onLoad() {
    // 读取默认辣度偏好
    const prefs = wx.getStorageSync('dietaryPreferences') || {};
    const spicyIndex = prefs.spicyLevel !== undefined ? prefs.spicyLevel : 0;

    // 读取常用食材（从饮食偏好），如果未设置则使用默认值
    const defaultCommonIngredients = ['牛肉', '羊肉', '猪肉', '鸡肉', '白菜', '土豆', '西红柿', '鸡蛋', '豆腐', '青椒', '胡萝卜', '洋葱'];
    const commonIngredients = (prefs.commonIngredients && prefs.commonIngredients.length > 0)
      ? prefs.commonIngredients
      : defaultCommonIngredients;

    const isManual = app.globalData.manualMode === true;

    this.setData({
      selectedImage: isManual ? '' : (app.globalData.selectedImage || ''),
      selectedImages: isManual ? [] : (app.globalData.selectedImages || []),
      ingredients: [...app.globalData.recognizedIngredients],
      spicyIndex,
      commonIngredients
    })
  },

  onShow() {
    if (app.globalData.manualMode === true) {
      this.setData({
        selectedImage: '',
        selectedImages: [],
        ingredients: [...app.globalData.recognizedIngredients]
      });
      app.globalData.manualMode = false;
    }
  },

  selectSpicy(e) {
    if (this.data.spicyLocked) return;
    this.setData({ spicyIndex: e.currentTarget.dataset.index })
  },

  selectRecipeCount(e) {
    const count = parseInt(e.currentTarget.dataset.count)
    this.setData({ recipeCount: count })
  },

  selectCookingMode(e) {
    const mode = e.currentTarget.dataset.mode
    // 如果已选择时间，禁止选择聚餐模式
    if (mode === 'banquet' && this.data.cookingTime) {
      showToast('聚餐模式需要大量时间提前准备，请先取消时间限制')
      return
    }
    this.setData({ cookingMode: mode })
  },

  selectPersonCount(e) {
    const count = parseInt(e.currentTarget.dataset.count)
    this.setData({ personCount: count })
  },

  removeIngredient(e) {
    const index = e.currentTarget.dataset.index
    const ingredients = [...this.data.ingredients]
    ingredients.splice(index, 1)
    this.setData({ ingredients })
  },

  onInputChange(e) {
    this.setData({
      newIngredient: e.detail.value
    })
  },

  addIngredient() {
    const input = this.data.newIngredient.trim()
    if (!input) {
      showToast('请输入食材名称')
      return
    }
    // 按逗号、顿号、空格拆分，过滤空值和重复
    const items = input.split(/[,，、.。\s]+/).map(s => s.trim()).filter(s => s)
    const ingredients = [...this.data.ingredients]
    let added = 0
    items.forEach(item => {
      if (!ingredients.includes(item)) {
        ingredients.push(item)
        added++
      }
    })
    if (added === 0) {
      showToast('该食材已存在')
      return
    }
    this.setData({
      ingredients,
      newIngredient: ''
    })
  },

  addCommonIngredient(e) {
    const ingredient = e.currentTarget.dataset.ingredient
    if (this.data.ingredients.includes(ingredient)) {
      showToast('该食材已存在')
      return
    }
    const ingredients = [...this.data.ingredients, ingredient]
    this.setData({ ingredients })
  },

  selectStyle(e) {
    const style = e.currentTarget.dataset.style
    const lockSpicy = (style === 'diet' || style === 'kids')
    this.setData({
      cookingStyle: style,
      spicyLocked: lockSpicy,
      spicyIndex: lockSpicy ? 0 : this.data.spicyIndex
    })
  },

  selectTime(e) {
    const time = e.currentTarget.dataset.time
    if (this.data.cookingTime === time) {
      // 取消时间选择
      this.setData({ cookingTime: '', customTime: '' })
    } else {
      // 选择新时间，如果是聚餐模式则切换为推荐模式
      const data = { cookingTime: time }
      if (this.data.cookingMode === 'banquet') {
        data.cookingMode = 'recommend'
      }
      this.setData(data)
    }
  },

  onCustomTimeInput(e) {
    this.setData({ customTime: e.detail.value })
  },

  noop() {},

  generateRecipes() {
    if (this.data.ingredients.length === 0) {
      showToast('请至少添加一种食材')
      return
    }

    showLoading('正在生成菜谱...')

    // 计算实际烹饪时间
    let cookingTime = 0;
    if (this.data.cookingTime === 'custom' && this.data.customTime) {
      cookingTime = parseInt(this.data.customTime) || 0;
    } else if (this.data.cookingTime) {
      cookingTime = parseInt(this.data.cookingTime);
    }

    // 传递辣度信息
    const spicyLevel = this.data.spicyIndex;
    const spicyLevelName = this.data.spicyLevels[spicyLevel];
    const recipeCount = this.data.recipeCount;
    const cookingMode = this.data.cookingMode;

    // 设置全局模式，供 recipes 页面读取
    app.globalData.cookingMode = cookingMode;
    app.globalData.personCount = this.data.personCount;

    generateRecipes(this.data.ingredients, this.data.cookingStyle, cookingTime, { spicyLevel, spicyLevelName, recipeCount, cookingMode, personCount: this.data.personCount }).then(res => {
      hideLoading()
      if (res.success) {
        app.globalData.recipes = res.recipes
        app.globalData.finalIngredients = this.data.ingredients
        wx.navigateTo({
          url: '/pages/recipes/recipes'
        })
      } else {
        showToast('生成菜谱失败，请重试')
      }
    }).catch(err => {
      hideLoading()
      console.error('生成菜谱出错', err)
      showToast('生成菜谱出错，请重试')
    })
  },

  goBack() {
    wx.navigateBack()
  }
})