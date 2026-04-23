const app = getApp()

Page({
  data: {
  },

  onLoad() {
    console.log('健康分析页面加载');
  },

  goToFridgeScan() {
    wx.navigateTo({
      url: '/pages/index/index'
    });
  },

  goToManualSelect() {
    app.globalData.recognizedIngredients = [];
    app.globalData.selectedImage = null;
    wx.navigateTo({
      url: '/pages/recognize/recognize'
    });
  },

  goToCalorieScanner() {
    wx.navigateTo({
      url: '/pages/calorie/calorie'
    });
  },

  goToDietOverview() {
    wx.navigateTo({
      url: '/pages/diet-overview/diet-overview'
    });
  }
});