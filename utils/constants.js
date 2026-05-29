// 每日卡路里目标（千卡）
const DAILY_CALORIE_GOAL = 1800

// 卡路里目标的一半（用于日历颜色分级）
const HALF_CALORIE_GOAL = 900

// AI 菜谱生成数量
const RECIPE_COUNT = 3

// API 请求配置
const API_RETRY_MAX = 3
const API_RETRY_BASE_DELAY = 1000

// 图片压缩质量
const IMAGE_COMPRESS_QUALITY = 70

// 食材识别缓存有效期（毫秒）
const RECOGNITION_CACHE_TTL = 24 * 60 * 60 * 1000

// 各模型参数
const MODEL_CONFIG = {
  ingredientRecognition: {
    model: 'qwen3.5-plus',
    maxTokens: 500,
    temperature: 0
  },
  recipeGeneration: {
    model: 'qwen3.6-flash',
    maxTokens: 4000,
    temperature: 0.7
  },
  calorieRecognition: {
    primary: {
      model: 'qwen3-vl-plus',
      maxTokens: 1000,
      temperature: 0
    },
    fallback: {
      model: 'qwen3.5-plus',
      maxTokens: 1000,
      temperature: 0
    }
  }
}

module.exports = {
  DAILY_CALORIE_GOAL,
  HALF_CALORIE_GOAL,
  RECIPE_COUNT,
  API_RETRY_MAX,
  API_RETRY_BASE_DELAY,
  IMAGE_COMPRESS_QUALITY,
  RECOGNITION_CACHE_TTL,
  MODEL_CONFIG
}
