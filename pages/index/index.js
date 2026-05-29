const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/util')
const { recognizeIngredients } = require('../../utils/api')
const { log } = require('../../utils/logger')

Page({
  data: {
    selectedImages: [],
    isLoading: false
  },

  onLoad() {
    log('首页加载')
  },

  chooseImage() {
    const that = this
    const remaining = 6 - this.data.selectedImages.length
    if (remaining <= 0) {
      showToast('最多选择6张图片')
      return
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const newPaths = res.tempFiles.map(f => f.tempFilePath)
        const selectedImages = [...that.data.selectedImages, ...newPaths]
        that.setData({ selectedImages })
        app.globalData.selectedImages = selectedImages
        app.globalData.selectedImage = selectedImages[0] || null
      },
      fail(err) {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          console.error('选择图片失败', err)
          showToast('选择图片失败')
        }
      }
    })
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index
    const selectedImages = [...this.data.selectedImages]
    selectedImages.splice(idx, 1)
    this.setData({ selectedImages })
    app.globalData.selectedImages = selectedImages
    app.globalData.selectedImage = selectedImages[0] || null
  },

  startRecognize() {
    if (this.data.selectedImages.length === 0) {
      showToast('请先选择图片')
      return
    }

    app.globalData.manualMode = false

    const count = this.data.selectedImages.length
    this.setData({ isLoading: true })
    showLoading(`正在识别${count}张图片...`)

    recognizeIngredients(this.data.selectedImages).then(res => {
      hideLoading()
      this.setData({ isLoading: false })
      if (res.success) {
        app.globalData.recognizedIngredients = res.ingredients
        wx.navigateTo({
          url: '/pages/recognize/recognize'
        })
      } else {
        showToast('所有图片均识别失败，请重试')
      }
    }).catch(err => {
      hideLoading()
      this.setData({ isLoading: false })
      console.error('识别出错', err)
      app.globalData.recognizedIngredients = []
      wx.navigateTo({
        url: '/pages/recognize/recognize'
      })
    })
  },

  manualAddIngredients() {
    app.globalData.recognizedIngredients = []
    app.globalData.selectedImages = []
    app.globalData.selectedImage = null
    app.globalData.manualMode = true
    wx.navigateTo({
      url: '/pages/recognize/recognize'
    })
  },

})