export const DAILY_CALORIE_GOAL = 1800
export const HALF_CALORIE_GOAL = 900
export const RECIPE_COUNT = 3

export const API_RETRY_MAX = 3
export const API_RETRY_BASE_DELAY = 1000

export const IMAGE_COMPRESS_QUALITY = 70
export const RECOGNITION_CACHE_TTL = 24 * 60 * 60 * 1000

interface ModelParams {
  model: string
  maxTokens: number
  temperature: number
}

interface CalorieModelConfig {
  primary: ModelParams
  fallback: ModelParams
}

interface ModelConfigMap {
  ingredientRecognition: ModelParams
  recipeGeneration: ModelParams
  calorieRecognition: CalorieModelConfig
}

export const MODEL_CONFIG: ModelConfigMap = {
  ingredientRecognition: {
    model: 'qwen3.5-plus',
    maxTokens: 500,
    temperature: 0.3
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
      temperature: 0.3
    },
    fallback: {
      model: 'qwen3.5-plus',
      maxTokens: 1000,
      temperature: 0.1
    }
  }
}
