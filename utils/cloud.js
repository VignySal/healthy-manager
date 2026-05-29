/**
 * 腾讯云开发（CloudBase/TCB）操作模块
 * 提供云初始化、饮食数据 CRUD、同步队列管理
 */

const CLOUD_ENV_ID = 'cloud1-d4gplno2v8a70d862'  // 替换为你的云开发环境 ID，如 'cloud1-xxxx'

let cloudInitialized = false
let userOpenid = null

/**
 * 初始化云开发环境
 * 在 app.js onLaunch 中调用
 */
const initCloud = () => {
  return new Promise((resolve) => {
    if (cloudInitialized) {
      resolve({ openid: userOpenid })
      return
    }

    if (!wx.cloud) {
      console.warn('[cloud] wx.cloud 不可用，跳过云初始化')
      resolve({ openid: null })
      return
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
      cloudInitialized = true
    } catch (e) {
      console.error('[cloud] 初始化失败:', e)
      resolve({ openid: null })
      return
    }

    // 通过云函数获取 openid
    wx.cloud.callFunction({
      name: 'getOpenid',
      success: (res) => {
        if (res.result && res.result.openid) {
          userOpenid = res.result.openid
          const app = getApp()
          if (app && app.globalData) {
            app.globalData.openid = userOpenid
            app.globalData.cloudReady = true
          }
        }
        resolve({ openid: userOpenid })
      },
      fail: (err) => {
        console.warn('[cloud] 获取 openid 失败:', err)
        const app = getApp()
        if (app && app.globalData) {
          app.globalData.cloudReady = true
        }
        resolve({ openid: null })
      }
    })
  })
}

/**
 * 获取当前用户的 openid
 */
const getOpenid = () => userOpenid

/**
 * 检查云环境是否就绪
 */
const isCloudReady = () => cloudInitialized && userOpenid

/**
 * 保存或更新某天的饮食记录到云端
 * 先查询是否存在该日期的记录，存在则更新，不存在则新增
 */
const saveDietRecord = (date, meals, totalCalories) => {
  return new Promise((resolve, reject) => {
    if (!isCloudReady()) {
      reject(new Error('云环境未就绪'))
      return
    }

    const db = wx.cloud.database()
    const _ = db.command

    db.collection('diet_records').where({
      date: date,
      _openid: userOpenid
    }).get({
      success: (res) => {
        if (res.data && res.data.length > 0) {
          // 更新已有记录
          const docId = res.data[0]._id
          db.collection('diet_records').doc(docId).update({
            data: {
              meals: meals,
              totalCalories: totalCalories,
              updatedAt: db.serverDate()
            },
            success: (res) => resolve(res),
            fail: (err) => reject(err)
          })
        } else {
          // 新增记录
          db.collection('diet_records').add({
            data: {
              date: date,
              meals: meals,
              totalCalories: totalCalories,
              updatedAt: db.serverDate()
            },
            success: (res) => resolve(res),
            fail: (err) => reject(err)
          })
        }
      },
      fail: (err) => reject(err)
    })
  })
}

/**
 * 从云端加载某天的饮食记录
 */
const loadDietRecord = (date) => {
  return new Promise((resolve, reject) => {
    if (!isCloudReady()) {
      reject(new Error('云环境未就绪'))
      return
    }

    const db = wx.cloud.database()
    db.collection('diet_records').where({
      date: date,
      _openid: userOpenid
    }).get({
      success: (res) => {
        if (res.data && res.data.length > 0) {
          resolve(res.data[0])
        } else {
          resolve(null)
        }
      },
      fail: (err) => reject(err)
    })
  })
}

/**
 * 批量加载日期范围内的饮食记录（供日历视图使用）
 */
const loadDietRecordsByRange = (startDate, endDate) => {
  return new Promise((resolve, reject) => {
    if (!isCloudReady()) {
      reject(new Error('云环境未就绪'))
      return
    }

    const db = wx.cloud.database()
    db.collection('diet_records').where({
      date: db.command.gte(startDate).and(db.command.lte(endDate)),
      _openid: userOpenid
    }).orderBy('date', 'asc').get({
      success: (res) => resolve(res.data || []),
      fail: (err) => reject(err)
    })
  })
}

/**
 * 将日期加入待同步队列（网络失败时使用）
 */
const addToSyncQueue = (date) => {
  try {
    const queue = wx.getStorageSync('pending_sync_queue') || []
    // 避免重复加入同一日期
    if (!queue.find(item => item.date === date)) {
      queue.push({ op: 'save', date: date, timestamp: Date.now() })
      wx.setStorageSync('pending_sync_queue', queue)
    }
  } catch (e) {
    console.warn('[cloud] 添加同步队列失败:', e)
  }
}

/**
 * 处理待同步队列，网络恢复时调用
 */
const processSyncQueue = () => {
  try {
    const queue = wx.getStorageSync('pending_sync_queue') || []
    if (queue.length === 0) return

    const app = getApp()
    if (!app.globalData.isNetworkConnected || !isCloudReady()) return

    const pendingDates = [...new Set(queue.map(item => item.date))]

    pendingDates.forEach(date => {
      const dailyData = wx.getStorageSync(`daily_food_${date}`) || { meals: {} }
      let total = 0
      Object.values(dailyData.meals || {}).forEach(meal => {
        if (Array.isArray(meal)) {
          meal.forEach(item => { total += parseInt(item.calories) || 0 })
        }
      })

      saveDietRecord(date, dailyData.meals || {}, total).then(() => {
        // 同步成功，从队列中移除该日期
        const newQueue = (wx.getStorageSync('pending_sync_queue') || [])
          .filter(item => item.date !== date)
        wx.setStorageSync('pending_sync_queue', newQueue)
      }).catch(() => {
        // 保持队列中的失败项，下次再试
      })
    })
  } catch (e) {
    console.warn('[cloud] 处理同步队列失败:', e)
  }
}

module.exports = {
  initCloud,
  getOpenid,
  saveDietRecord,
  loadDietRecord,
  loadDietRecordsByRange,
  addToSyncQueue,
  processSyncQueue,
  isCloudReady
}
