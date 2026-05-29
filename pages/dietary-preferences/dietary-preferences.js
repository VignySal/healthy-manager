const { log } = require('../../utils/logger');

Page({
  data: {
    restrictions: [
      { name: '海鲜', custom: false },
      { name: '花生', custom: false },
      { name: '牛奶', custom: false },
      { name: '鸡蛋', custom: false }
    ],
    newRestriction: '',
    editingRestrictions: false,
    editingRestrictionIndex: -1,
    spicyLevels: ['不吃辣', '微辣', '中辣', '特辣', '任意'],
    spicyIndex: 0,
    tastePreferences: [
      { name: '清淡' },
      { name: '酸甜' },
      { name: '咸香' },
      { name: '麻辣' },
      { name: '酸辣' }
    ],
    seasonings: [
      { name: '食用油', selected: true, custom: false },
      { name: '盐', selected: true, custom: false },
      { name: '酱油', selected: true, custom: false },
      { name: '香油', selected: true, custom: false },
      { name: '醋', selected: true, custom: false },
      { name: '鸡精', selected: true, custom: false },
      { name: '糖', selected: true, custom: false },
      { name: '葱', selected: true, custom: false },
      { name: '姜', selected: true, custom: false },
      { name: '蒜', selected: true, custom: false },
      { name: '料酒', custom: false },
      { name: '蚝油', custom: false },
      { name: '生抽', custom: false },
      { name: '老抽', custom: false },
      { name: '胡椒粉', custom: false },
      { name: '淀粉', custom: false }
    ],
    newSeasoning: '',
    editingSeasonings: false,
    editingSeasoningIndex: -1,
    kitchenware: [
      { name: '炒锅', selected: true },
      { name: '汤锅', selected: true },
      { name: '蒸锅' },
      { name: '电饭煲' },
      { name: '空气炸锅' },
      { name: '烤箱' },
      { name: '微波炉' },
      { name: '压力锅' },
      { name: '平底锅' },
      { name: '破壁机' }
    ],
    newKitchenware: '',
    editingKitchenware: false,
    editingKitchenwareIndex: -1,
    commonIngredients: [
      { name: '牛肉' },
      { name: '羊肉' },
      { name: '猪肉' },
      { name: '鸡肉' },
      { name: '白菜' },
      { name: '土豆' },
      { name: '西红柿' },
      { name: '鸡蛋' },
      { name: '豆腐' },
      { name: '青椒' },
      { name: '胡萝卜' },
      { name: '洋葱' }
    ],
    newCommonIngredient: '',
    editingCommonIngredients: false,
    editingCommonIngredientIndex: -1,
    notes: '',
    dailyCalorieGoal: 1800
  },

  onLoad() {
    const prefs = wx.getStorageSync('dietaryPreferences');
    if (!prefs) return;

    if (prefs.restrictions) {
      const defaultNames = this.data.restrictions.map(r => r.name);
      const customRestrictions = prefs.restrictions
        .filter(name => !defaultNames.includes(name))
        .map(name => ({ name, selected: true, custom: true }));
      const restrictions = this.data.restrictions.map(r => ({
        ...r,
        selected: prefs.restrictions.includes(r.name)
      }));
      this.setData({ restrictions: [...restrictions, ...customRestrictions] });
    }

    if (prefs.spicyLevel !== undefined) {
      this.setData({ spicyIndex: prefs.spicyLevel });
    }

    if (prefs.tastePreferences) {
      const tastePreferences = this.data.tastePreferences.map(t => ({
        ...t,
        selected: prefs.tastePreferences.includes(t.name)
      }));
      this.setData({ tastePreferences });
    }

    if (prefs.notes) {
      this.setData({ notes: prefs.notes });
    }

    if (prefs.dailyCalorieGoal !== undefined) {
      this.setData({ dailyCalorieGoal: prefs.dailyCalorieGoal });
    }

    if (prefs.seasonings && prefs.seasonings.length > 0) {
      const defaultNames = this.data.seasonings.map(s => s.name);
      const customSeasonings = prefs.seasonings
        .filter(name => !defaultNames.includes(name))
        .map(name => ({ name, selected: true, custom: true }));
      const seasonings = this.data.seasonings.map(s => ({
        ...s,
        selected: prefs.seasonings.includes(s.name)
      }));
      this.setData({ seasonings: [...seasonings, ...customSeasonings] });
    }

    if (prefs.kitchenware && prefs.kitchenware.length > 0) {
      const defaultNames = this.data.kitchenware.map(k => k.name);
      const customKitchenware = prefs.kitchenware
        .filter(name => !defaultNames.includes(name))
        .map(name => ({ name, selected: true, custom: true }));
      const kitchenware = this.data.kitchenware.map(k => ({
        ...k,
        selected: prefs.kitchenware.includes(k.name)
      }));
      this.setData({ kitchenware: [...kitchenware, ...customKitchenware] });
    }

    if (prefs.commonIngredients && prefs.commonIngredients.length > 0) {
      const defaultNames = this.data.commonIngredients.map(c => c.name);
      const customIngredients = prefs.commonIngredients
        .filter(name => !defaultNames.includes(name))
        .map(name => ({ name, custom: true }));
      const commonIngredients = this.data.commonIngredients.map(c => ({
        ...c,
        selected: prefs.commonIngredients.includes(c.name)
      }));
      this.setData({ commonIngredients: [...commonIngredients, ...customIngredients] });
    }
  },

  onUnload() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._doSave();
    }
  },

  _doSave() {
    const restrictions = this.data.restrictions
      .filter(r => r.selected)
      .map(r => r.name);
    const tastePreferences = this.data.tastePreferences
      .filter(t => t.selected)
      .map(t => t.name);

    const seasonings = this.data.seasonings
      .filter(s => s.selected)
      .map(s => s.name);

    const kitchenware = this.data.kitchenware
      .filter(k => k.selected)
      .map(k => k.name);

    const commonIngredients = this.data.commonIngredients
      .map(c => c.name);

    const prefs = {
      restrictions,
      spicyLevel: this.data.spicyIndex,
      spicyLevelName: this.data.spicyLevels[this.data.spicyIndex],
      tastePreferences,
      seasonings,
      kitchenware,
      commonIngredients,
      notes: this.data.notes,
      dailyCalorieGoal: this.data.dailyCalorieGoal
    };

    wx.setStorageSync('dietaryPreferences', prefs);
    log('饮食偏好已自动保存:', prefs);
  },

  _autoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._doSave();
    }, 500);
  },

  toggleRestriction(e) {
    const idx = e.currentTarget.dataset.index;
    if (this.data.editingRestrictions) {
      this._startEditRestriction(idx);
      return;
    }
    this.setData({ [`restrictions[${idx}].selected`]: !this.data.restrictions[idx].selected });
    this._autoSave();
  },

  onRestrictionInput(e) {
    this.setData({ newRestriction: e.detail.value });
  },

  _startEditRestriction(idx) {
    this.setData({
      newRestriction: this.data.restrictions[idx].name,
      editingRestrictionIndex: idx
    });
  },

  addRestriction() {
    const name = this.data.newRestriction.trim();
    if (!name) {
      wx.showToast({ title: '请输入忌口食物', icon: 'none' });
      return;
    }
    const editIdx = this.data.editingRestrictionIndex;
    if (editIdx >= 0) {
      if (this.data.restrictions.some((r, i) => i !== editIdx && r.name === name)) {
        wx.showToast({ title: '该忌口已存在', icon: 'none' });
        return;
      }
      this.setData({
        [`restrictions[${editIdx}].name`]: name,
        newRestriction: '',
        editingRestrictionIndex: -1
      });
    } else {
      if (this.data.restrictions.some(r => r.name === name)) {
        wx.showToast({ title: '该忌口已存在', icon: 'none' });
        return;
      }
      const restrictions = [...this.data.restrictions, { name, selected: true, custom: true }];
      this.setData({ restrictions, newRestriction: '' });
    }
    this._autoSave();
  },

  cancelEditRestriction() {
    this.setData({ newRestriction: '', editingRestrictionIndex: -1 });
  },

  removeRestriction(e) {
    const idx = e.currentTarget.dataset.index;
    const restrictions = [...this.data.restrictions];
    if (this.data.editingRestrictions || restrictions[idx].custom) {
      if (idx === this.data.editingRestrictionIndex) {
        this.setData({ newRestriction: '', editingRestrictionIndex: -1 });
      }
      restrictions.splice(idx, 1);
      this.setData({ restrictions });
      this._autoSave();
    }
  },

  toggleEditRestrictions() {
    this.setData({
      editingRestrictions: !this.data.editingRestrictions,
      newRestriction: '',
      editingRestrictionIndex: -1
    });
  },

  selectSpicy(e) {
    this.setData({ spicyIndex: e.currentTarget.dataset.index });
    this._autoSave();
  },

  toggleTaste(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`tastePreferences[${idx}].selected`]: !this.data.tastePreferences[idx].selected });
    this._autoSave();
  },

  toggleSeasoning(e) {
    const idx = e.currentTarget.dataset.index;
    if (this.data.editingSeasonings) {
      this._startEditSeasoning(idx);
      return;
    }
    this.setData({ [`seasonings[${idx}].selected`]: !this.data.seasonings[idx].selected });
    this._autoSave();
  },

  onSeasoningInput(e) {
    this.setData({ newSeasoning: e.detail.value });
  },

  _startEditSeasoning(idx) {
    this.setData({
      newSeasoning: this.data.seasonings[idx].name,
      editingSeasoningIndex: idx
    });
  },

  addSeasoning() {
    const name = this.data.newSeasoning.trim();
    if (!name) {
      wx.showToast({ title: '请输入调料名称', icon: 'none' });
      return;
    }
    const editIdx = this.data.editingSeasoningIndex;
    if (editIdx >= 0) {
      if (this.data.seasonings.some((s, i) => i !== editIdx && s.name === name)) {
        wx.showToast({ title: '该调料已存在', icon: 'none' });
        return;
      }
      this.setData({
        [`seasonings[${editIdx}].name`]: name,
        newSeasoning: '',
        editingSeasoningIndex: -1
      });
    } else {
      if (this.data.seasonings.some(s => s.name === name)) {
        wx.showToast({ title: '该调料已存在', icon: 'none' });
        return;
      }
      const seasonings = [...this.data.seasonings, { name, selected: true, custom: true }];
      this.setData({ seasonings, newSeasoning: '' });
    }
    this._autoSave();
  },

  cancelEditSeasoning() {
    this.setData({ newSeasoning: '', editingSeasoningIndex: -1 });
  },

  removeSeasoning(e) {
    const idx = e.currentTarget.dataset.index;
    const seasonings = [...this.data.seasonings];
    if (this.data.editingSeasonings || seasonings[idx].custom) {
      if (idx === this.data.editingSeasoningIndex) {
        this.setData({ newSeasoning: '', editingSeasoningIndex: -1 });
      }
      seasonings.splice(idx, 1);
      this.setData({ seasonings });
      this._autoSave();
    }
  },

  toggleEditSeasonings() {
    this.setData({
      editingSeasonings: !this.data.editingSeasonings,
      newSeasoning: '',
      editingSeasoningIndex: -1
    });
  },

  toggleKitchenware(e) {
    const idx = e.currentTarget.dataset.index;
    if (this.data.editingKitchenware) {
      this._startEditKitchenware(idx);
      return;
    }
    this.setData({ [`kitchenware[${idx}].selected`]: !this.data.kitchenware[idx].selected });
    this._autoSave();
  },

  onKitchenwareInput(e) {
    this.setData({ newKitchenware: e.detail.value });
  },

  _startEditKitchenware(idx) {
    this.setData({
      newKitchenware: this.data.kitchenware[idx].name,
      editingKitchenwareIndex: idx
    });
  },

  addKitchenware() {
    const name = this.data.newKitchenware.trim();
    if (!name) {
      wx.showToast({ title: '请输入厨具名称', icon: 'none' });
      return;
    }
    const editIdx = this.data.editingKitchenwareIndex;
    if (editIdx >= 0) {
      if (this.data.kitchenware.some((k, i) => i !== editIdx && k.name === name)) {
        wx.showToast({ title: '该厨具已存在', icon: 'none' });
        return;
      }
      this.setData({
        [`kitchenware[${editIdx}].name`]: name,
        newKitchenware: '',
        editingKitchenwareIndex: -1
      });
    } else {
      if (this.data.kitchenware.some(k => k.name === name)) {
        wx.showToast({ title: '该厨具已存在', icon: 'none' });
        return;
      }
      const kitchenware = [...this.data.kitchenware, { name, selected: true, custom: true }];
      this.setData({ kitchenware, newKitchenware: '' });
    }
    this._autoSave();
  },

  cancelEditKitchenware() {
    this.setData({ newKitchenware: '', editingKitchenwareIndex: -1 });
  },

  removeKitchenware(e) {
    const idx = e.currentTarget.dataset.index;
    const kitchenware = [...this.data.kitchenware];
    if (this.data.editingKitchenware || kitchenware[idx].custom) {
      if (idx === this.data.editingKitchenwareIndex) {
        this.setData({ newKitchenware: '', editingKitchenwareIndex: -1 });
      }
      kitchenware.splice(idx, 1);
      this.setData({ kitchenware });
      this._autoSave();
    }
  },

  toggleEditKitchenware() {
    this.setData({
      editingKitchenware: !this.data.editingKitchenware,
      newKitchenware: '',
      editingKitchenwareIndex: -1
    });
  },

  startEditCommonIngredient(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({
      newCommonIngredient: this.data.commonIngredients[idx].name,
      editingCommonIngredientIndex: idx
    });
  },

  onCommonIngredientInput(e) {
    this.setData({ newCommonIngredient: e.detail.value });
  },

  addCommonIngredient() {
    const name = this.data.newCommonIngredient.trim();
    if (!name) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' });
      return;
    }
    const editIdx = this.data.editingCommonIngredientIndex;
    if (editIdx >= 0) {
      if (this.data.commonIngredients.some((c, i) => i !== editIdx && c.name === name)) {
        wx.showToast({ title: '该食材已存在', icon: 'none' });
        return;
      }
      this.setData({
        [`commonIngredients[${editIdx}].name`]: name,
        newCommonIngredient: '',
        editingCommonIngredientIndex: -1
      });
    } else {
      if (this.data.commonIngredients.some(c => c.name === name)) {
        wx.showToast({ title: '该食材已存在', icon: 'none' });
        return;
      }
      const commonIngredients = [...this.data.commonIngredients, { name, custom: true }];
      this.setData({ commonIngredients, newCommonIngredient: '' });
    }
    this._autoSave();
  },

  cancelEditCommonIngredient() {
    this.setData({ newCommonIngredient: '', editingCommonIngredientIndex: -1 });
  },

  removeCommonIngredient(e) {
    const idx = e.currentTarget.dataset.index;
    const commonIngredients = [...this.data.commonIngredients];
    if (idx === this.data.editingCommonIngredientIndex) {
      this.setData({ newCommonIngredient: '', editingCommonIngredientIndex: -1 });
    }
    commonIngredients.splice(idx, 1);
    this.setData({ commonIngredients });
    this._autoSave();
  },

  toggleEditCommonIngredients() {
    this.setData({
      editingCommonIngredients: !this.data.editingCommonIngredients,
      newCommonIngredient: '',
      editingCommonIngredientIndex: -1
    });
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
    this._autoSave();
  },

  onCalorieGoalInput(e) {
    const value = e.detail.value;
    if (/^\d*$/.test(value)) {
      this.setData({ dailyCalorieGoal: value ? parseInt(value) : 0 });
      this._autoSave();
    }
  }
});
