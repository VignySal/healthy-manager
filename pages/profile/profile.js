const app = getApp();
const { log, error: logError } = require('../../utils/logger');
const { initCloud } = require('../../utils/cloud');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    loginCode: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  onLoad() {
    const loggedIn = wx.getStorageSync('userLoggedIn');
    const userInfo = wx.getStorageSync('userInfo');
    if (loggedIn && userInfo) {
      this.setData({ isLoggedIn: true, userInfo });
      app.globalData.userInfo = userInfo;
    }
  },

  goToMyRecipes() {
    wx.navigateTo({
      url: '/pages/my-recipes/my-recipes'
    });
  },

  goToDietaryPreferences() {
    wx.navigateTo({
      url: '/pages/dietary-preferences/dietary-preferences'
    });
  },

  handleLogin() {
    wx.showLoading({ title: '登录中...' });

    wx.login({
      success: (res) => {
        if (res.code) {
          log('微信登录成功，code:', res.code);
          this.setData({ loginCode: res.code });

          wx.getUserProfile({
            desc: '用于完善个人资料',
            success: (profileRes) => {
              wx.hideLoading();
              const userInfo = profileRes.userInfo;
              wx.setStorageSync('userLoggedIn', true);
              wx.setStorageSync('userInfo', userInfo);
              app.globalData.userInfo = userInfo;
              this.setData({ isLoggedIn: true, userInfo });
              wx.showToast({ title: '登录成功', icon: 'success' });
              // 初始化云环境
              if (!app.globalData.cloudReady) {
                initCloud().then(({ openid }) => {
                  app.globalData.cloudReady = true;
                  if (openid) app.globalData.openid = openid;
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              logError('获取用户信息失败:', err);
              wx.setStorageSync('userLoggedIn', true);
              this.setData({ isLoggedIn: true });
              wx.showToast({ title: '登录成功', icon: 'success' });
              // 初始化云环境
              if (!app.globalData.cloudReady) {
                initCloud().then(({ openid }) => {
                  app.globalData.cloudReady = true;
                  if (openid) app.globalData.openid = openid;
                });
              }
            }
          });
        } else {
          wx.hideLoading();
          logError('微信登录失败: 未获取到code');
          wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        logError('微信登录失败:', err);
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      }
    });
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userLoggedIn');
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            loginCode: ''
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  }
});
