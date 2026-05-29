const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

const hideLoading = () => {
  wx.hideLoading()
}

const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 2000
  })
}

const formatDate = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCurrentTime = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const MEAL_NAMES = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snacks: '加餐'
}

const getMealName = mealType => MEAL_NAMES[mealType] || mealType

const compressImage = (imagePath, quality = 70) => {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: imagePath,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: () => resolve(imagePath) // 压缩失败时返回原图
    })
  })
}

module.exports = {
  formatTime,
  formatDate,
  getCurrentTime,
  getMealName,
  compressImage,
  showLoading,
  hideLoading,
  showToast
}