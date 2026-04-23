Page({
  data: {
  },

  onLoad() {
    console.log('健康分析页面加载');
  },

  goToFridgeMaster() {
    wx.navigateTo({
      url: '/pages/index/index'
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