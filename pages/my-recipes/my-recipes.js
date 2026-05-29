const app = getApp();

const SORT_LABELS = {
  'time-desc': '最新优先',
  'time-asc': '最早优先',
  'name': '按名称',
  'calories': '按卡路里',
  'manual': '手动排序'
};

Page({
  data: {
    myRecipes: [],
    filteredRecipes: [],
    expandedId: -1,
    sortType: 'time-desc',
    sortLabel: '最新优先',
    sortMode: false,
    dragItemId: -1,
    dragTranslateY: 0,
    dragStyle: '',
    // 排序弹窗
    showSortDialog: false,
    // 编辑弹窗
    showEditDialog: false,
    editingId: -1,
    editName: '',
    editImage: '',
    editCalories: '',
    editNutrition: undefined,
    editCookTime: undefined,
    editDifficulty: undefined,
    editSuggestion: undefined
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const myRecipes = wx.getStorageSync('my_recipes') || [];
    this.setData({ myRecipes, expandedId: -1 });
    this.applySort();
  },

  applySort() {
    let list = [...this.data.myRecipes];
    const { sortType } = this.data;

    if (sortType === 'time-desc') {
      list.sort((a, b) => b.id - a.id);
    } else if (sortType === 'time-asc') {
      list.sort((a, b) => a.id - b.id);
    } else if (sortType === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    } else if (sortType === 'calories') {
      list.sort((a, b) => (parseInt(b.calories) || 0) - (parseInt(a.calories) || 0));
    } else if (sortType === 'manual') {
      const order = wx.getStorageSync('recipe_manual_order') || [];
      if (order.length > 0) {
        const orderMap = {};
        order.forEach((id, i) => { orderMap[id] = i; });
        list.sort((a, b) => {
          const ai = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
          const bi = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
          return ai - bi;
        });
      }
    }

    this.setData({ filteredRecipes: list });
  },

  // 排序弹窗
  showSortOptions() {
    this.setData({ showSortDialog: true });
  },
  closeSortDialog() {
    this.setData({ showSortDialog: false });
  },
  setSort(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'manual') {
      this.enterSortMode();
    }
    this.setData({
      sortType: type,
      sortLabel: SORT_LABELS[type] || type,
      showSortDialog: false,
      expandedId: -1
    }, () => {
      if (type !== 'manual') {
        this.setData({ sortMode: false });
      }
      this.applySort();
    });
  },

  // 手动排序模式
  enterSortMode() {
    if (this.data.sortType !== 'manual') {
      this._prevSortType = this.data.sortType;
      this._prevSortLabel = this.data.sortLabel;
      this.setData({ sortType: 'manual', sortLabel: '手动排序' });
    }
    this.setData({ sortMode: true, expandedId: -1 }, () => {
      this.applySort();
    });
  },

  saveSortOrder() {
    const { filteredRecipes } = this.data;
    const order = filteredRecipes.map(r => r.id);
    wx.setStorageSync('recipe_manual_order', order);
    const prevType = this._prevSortType || 'time-desc';
    const prevLabel = this._prevSortLabel || '最新优先';
    this._prevSortType = null;
    this._prevSortLabel = null;
    this.setData({
      sortMode: false,
      sortType: prevType,
      sortLabel: prevLabel
    }, () => {
      this.applySort();
    });
    wx.showToast({ title: '排序已保存', icon: 'success' });
  },

  // 拖动排序
  onDragStart(e) {
    if (!this.data.sortMode) return;
    const id = e.currentTarget.dataset.id;
    const touch = e.touches[0];
    const idx = this.data.filteredRecipes.findIndex(r => r.id === id);
    this._dragStartY = touch.clientY;
    this._dragStartIndex = idx;
    this._dragItemId = id;
    this.setData({ dragItemId: id, dragTranslateY: 0, dragStyle: '' });
  },

  onDragMove(e) {
    if (this._dragItemId == null) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - this._dragStartY;
    this.setData({
      dragTranslateY: deltaY,
      dragStyle: 'transform:translateY(' + deltaY + 'px);z-index:100;opacity:0.92;'
    });
  },

  onDragEnd() {
    if (this._dragItemId == null) return;
    const { dragTranslateY, filteredRecipes } = this.data;
    const itemHeight = 90;
    const offset = Math.round(dragTranslateY / itemHeight);
    const newIndex = Math.max(0, Math.min(this._dragStartIndex + offset, filteredRecipes.length - 1));

    if (newIndex !== this._dragStartIndex) {
      const list = [...filteredRecipes];
      const [moved] = list.splice(this._dragStartIndex, 1);
      list.splice(newIndex, 0, moved);
      this.setData({ filteredRecipes: list });
    }

    this._dragItemId = null;
    this._dragStartY = null;
    this.setData({ dragItemId: -1, dragTranslateY: 0, dragStyle: '' });
  },

  toggleDetail(e) {
    if (this.data.sortMode) return;
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedId: this.data.expandedId === id ? -1 : id
    });
  },

  deleteRecipe(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个收藏吗？',
      success: (res) => {
        if (res.confirm) {
          let myRecipes = wx.getStorageSync('my_recipes') || [];
          myRecipes = myRecipes.filter(r => r.id !== id);
          wx.setStorageSync('my_recipes', myRecipes);
          // clean manual order
          let order = wx.getStorageSync('recipe_manual_order') || [];
          order = order.filter(oid => oid !== id);
          wx.setStorageSync('recipe_manual_order', order);
          app.globalData.myRecipesVersion = (app.globalData.myRecipesVersion || 0) + 1;
          this.setData({ myRecipes, expandedId: -1 });
          this.applySort();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  openEditDialog(e) {
    const id = e.currentTarget.dataset.id;
    const recipe = this.data.myRecipes.find(r => r.id === id);
    if (!recipe) return;

    this.setData({
      showEditDialog: true,
      editingId: id,
      editName: recipe.name || '',
      editImage: recipe.image || '',
      editCalories: recipe.calories || '',
      editNutrition: recipe.nutrition,
      editCookTime: recipe.cookTime,
      editDifficulty: recipe.difficulty,
      editSuggestion: recipe.suggestion
    });
  },

  closeEditDialog() {
    this.setData({ showEditDialog: false, editingId: -1 });
  },

  onEditName(e) { this.setData({ editName: e.detail.value }); },
  onEditCalories(e) { this.setData({ editCalories: e.detail.value }); },
  onEditNutrition(e) { this.setData({ editNutrition: e.detail.value }); },
  onEditCookTime(e) { this.setData({ editCookTime: e.detail.value }); },
  onEditDifficulty(e) { this.setData({ editDifficulty: e.detail.value }); },
  onEditSuggestion(e) { this.setData({ editSuggestion: e.detail.value }); },

  changePhoto() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        that.setData({ editImage: res.tempFiles[0].tempFilePath });
      }
    });
  },

  saveEdit() {
    const { editingId, editName, editImage, editCalories, editNutrition, editCookTime, editDifficulty, editSuggestion } = this.data;
    if (!editName.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }

    let myRecipes = wx.getStorageSync('my_recipes') || [];
    const idx = myRecipes.findIndex(r => r.id === editingId);
    if (idx === -1) return;

    myRecipes[idx] = {
      ...myRecipes[idx],
      name: editName.trim(),
      image: editImage,
      calories: editCalories,
      nutrition: editNutrition !== undefined ? editNutrition : myRecipes[idx].nutrition,
      cookTime: editCookTime !== undefined ? editCookTime : myRecipes[idx].cookTime,
      difficulty: editDifficulty !== undefined ? editDifficulty : myRecipes[idx].difficulty,
      suggestion: editSuggestion !== undefined ? editSuggestion : myRecipes[idx].suggestion
    };

    wx.setStorageSync('my_recipes', myRecipes);
    app.globalData.myRecipesVersion = (app.globalData.myRecipesVersion || 0) + 1;
    this.setData({ myRecipes, showEditDialog: false, editingId: -1 });
    this.applySort();
    wx.showToast({ title: '保存成功', icon: 'success' });
  }
});
