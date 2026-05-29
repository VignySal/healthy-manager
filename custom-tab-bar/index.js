Component({
  data: {
    selected: 0,
    tabs: [
      { pagePath: '/pages/health/health', text: '首页', icon: '🏠' },
      { pagePath: '/pages/diet-overview/diet-overview', text: '饮食概览', icon: '📊' },
      { pagePath: '/pages/calorie-trend/calorie-trend', text: '摄入趋势', icon: '📈' },
      { pagePath: '/pages/profile/profile', text: '个人中心', icon: '👤' }
    ]
  },

  lifetimes: {
    attached() {
      this.syncByRoute();
    }
  },

  pageLifetimes: {
    show() {
      this.syncByRoute();
    }
  },

  methods: {
    syncByRoute() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;
      const route = pages[pages.length - 1].route;
      const index = this.data.tabs.findIndex(tab => tab.pagePath === `/${route}`);
      if (index >= 0 && index !== this.data.selected) {
        this.setData({ selected: index });
      }
    },

    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      const idx = Number(index);
      if (this.data.selected === idx) return;
      this.setData({ selected: idx });
      wx.switchTab({
        url: path,
        fail: (err) => {
          console.error('switchTab 失败:', err);
          this.syncByRoute();
        }
      });
    }
  }
});
