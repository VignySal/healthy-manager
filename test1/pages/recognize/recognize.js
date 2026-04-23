const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/util')
const { generateRecipes } = require('../../utils/api')

Page({
  data: {
    selectedImage: '',
    ingredients: [],
    newIngredient: '',
    cookingStyle: 'standard',
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
    const newIngredient = this.data.newIngredient.trim()
    if (!newIngredient) {
      showToast('请输入食材名称')
      return
    }
    if (this.data.ingredients.includes(newIngredient)) {
      showToast('该食材已存在')
      return
    }
    const ingredients = [...this.data.ingredients, newIngredient]
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

  generateRecipes() {
    if (this.data.ingredients.length === 0) {
      showToast('请至少添加一种食材')
      return
    }

    showLoading('正在生成菜谱...')
    
    generateRecipes(this.data.ingredients, this.data.cookingStyle).then(res => {
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