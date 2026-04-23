const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/util')
const { recognizeIngredients } = require('../../utils/api')

Page({
  data: {
    selectedImage: ''
  },

  onLoad() {
    console.log('首页加载')
  },

  chooseImage() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath
        that.setData({
          selectedImage: tempFilePath
        })
        app.globalData.selectedImage = tempFilePath
      },
      fail(err) {
        console.error('选择图片失败', err)
        showToast('选择图片失败')
      }
    })
  },

  removeImage() {
    this.setData({
      selectedImage: ''
    })
    app.globalData.selectedImage = null
  },

  startRecognize() {
    if (!this.data.selectedImage) {
      showToast('请先选择图片')
      return
    }

    showLoading('正在识别中...')
    
    recognizeIngredients(this.data.selectedImage).then(res => {
      hideLoading()
      if (res.success) {
        app.globalData.recognizedIngredients = res.ingredients
        wx.navigateTo({
          url: '/pages/recognize/recognize'
        })
      } else {
        showToast('识别失败，请重试')
      }
    }).catch(err => {
      hideLoading()
      console.error('识别出错', err)
      // 识别出错时，仍然进入识别页面，但食材列表为空
      app.globalData.recognizedIngredients = []
      wx.navigateTo({
        url: '/pages/recognize/recognize'
      })
    })
  },

  manualAddIngredients() {
    // 手动添加食材，直接进入识别页面，食材列表为空
    app.globalData.recognizedIngredients = []
    wx.navigateTo({
      url: '/pages/recognize/recognize'
    })
  },

  // 跳转到饮食概览页面
  goToDietOverview() {
    wx.navigateTo({
      url: '/pages/diet-overview/diet-overview'
    })
  }
})