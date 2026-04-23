const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/util')
const { generateRecipes } = require('../../utils/api')

Page({
  data: {
    selectedImage: '',
    ingredients: [],
    newIngredient: '',
    cookingStyle: 'standard',
    cookingTime: '',
    customTime: '',
    commonIngredients: ['葱', '姜', '蒜', '盐', '糖', '生抽', '老抽', '料酒', '醋', '香油']
  },

  onLoad() {
    this.setData({
      selectedImage: app.globalData.selectedImage || '',
      ingredients: [...app.globalData.recognizedIngredients]
    })
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
    this.setData({ cookingStyle: style })
  },

  selectTime(e) {
    const time = e.currentTarget.dataset.time
    if (this.data.cookingTime === time) {
      this.setData({ cookingTime: '', customTime: '' })
    } else {
      this.setData({ cookingTime: time })
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

    generateRecipes(this.data.ingredients, this.data.cookingStyle, cookingTime).then(res => {
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