const { log } = require('./utils/logger')
const { initCloud, processSyncQueue } = require('./utils/cloud')

App({
  globalData: {
    userInfo: null,
    recognizedIngredients: [],
    selectedImage: null,
    isNetworkConnected: true,
    dietVersion: 0,
    monthlyCache: null,
    openid: null,
    cloudReady: false
  },
  onLaunch() {
    log('冰箱清空大师启动')

    // 初始化云开发
    initCloud().then(({ openid }) => {
      this.globalData.cloudReady = true
      if (openid) {
        this.globalData.openid = openid
      }
    }).catch(err => {
      console.error('[cloud] 初始化失败:', err)
    })

    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      const wasDisconnected = !this.globalData.isNetworkConnected
      this.globalData.isNetworkConnected = res.isConnected

      if (wasDisconnected && res.isConnected) {
        wx.showToast({
          title: '网络已恢复',
          icon: 'success',
          duration: 2000
        })
        // 网络恢复后，处理待同步队列
        if (this.globalData.cloudReady && this.globalData.openid) {
          processSyncQueue()
        }
      } else if (!res.isConnected) {
        wx.showToast({
          title: '网络已断开',
          icon: 'none',
          duration: 3000
        })
      }
    })

    // 获取初始网络状态
    wx.getNetworkType({
      success: (res) => {
        this.globalData.isNetworkConnected = res.networkType !== 'none'
      }
    })
  }
})
