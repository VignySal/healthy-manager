// 阿里云API配置
const API_KEY = 'sk-a46921c7343b4a60af36ed720bd6e51c';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const { compressImage } = require('./util');
const { log, error: logError } = require('./logger');
const { API_RETRY_MAX, API_RETRY_BASE_DELAY, RECOGNITION_CACHE_TTL, MODEL_CONFIG } = require('./constants');

// 带指数退避的请求重试封装
const requestWithRetry = (options, maxRetries = API_RETRY_MAX, baseDelay = API_RETRY_BASE_DELAY) => {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const doRequest = () => {
      attempt++;
      wx.request({
        ...options,
        success: (response) => {
          if (response.statusCode === 200) {
            resolve(response);
          } else if ((response.statusCode >= 500 || response.statusCode === 429) && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            setTimeout(doRequest, delay);
          } else {
            resolve(response);
          }
        },
        fail: (err) => {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            setTimeout(doRequest, delay);
          } else {
            reject(err);
          }
        }
      });
    };

    doRequest();
  });
};

// 食材识别缓存（图片hash → 结果）
const recognitionCache = {};

// 简单hash函数，用于图片缓存key
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 2000); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
};

// 使用阿里云多模态API进行单张图片食材识别
// 压缩并读取图片为base64
const prepareImageBase64 = (imagePath) => {
  return compressImage(imagePath, 70).then((compressedPath) => {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: compressedPath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
  });
};

// 识别一组图片（1~2张），单次API调用
const recognizeImageGroup = (imagePaths) => {
  const promises = imagePaths.map(p => prepareImageBase64(p));
  return Promise.all(promises).then(base64List => {
    // 检查缓存（仅单张时）
    if (base64List.length === 1) {
      const cacheKey = simpleHash(base64List[0]);
      const cached = recognitionCache[cacheKey];
      if (cached && (Date.now() - cached.time < RECOGNITION_CACHE_TTL)) {
        log('命中食材识别缓存');
        return cached.ingredients;
      }
    }

    const imageContents = base64List.map(b64 => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${b64}` }
    }));

    const promptText = base64List.length > 1
      ? '请分别识别这两张图片中的所有食材，将所有食材合并后返回，只返回食材名称列表，不要有其他文字。格式：["食材1", "食材2", "食材3"]'
      : '请识别图片中的所有食材，只返回食材名称列表，不要有其他文字。格式：["食材1", "食材2", "食材3"]';

    return requestWithRetry({
      url: `${BASE_URL}/chat/completions`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: {
        model: MODEL_CONFIG.ingredientRecognition.model,
        enable_thinking: false,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的食材识别助手，能够从图片中识别出所有的食材名称。'
          },
          {
            role: 'user',
            content: [
              ...imageContents,
              { type: 'text', text: promptText }
            ]
          }
        ],
        max_tokens: MODEL_CONFIG.ingredientRecognition.maxTokens,
        temperature: MODEL_CONFIG.ingredientRecognition.temperature
      }
    }).then((response) => {
      if (response.statusCode === 200 && response.data && response.data.choices) {
        const content = response.data.choices[0].message.content;
        let ingredients;
        try {
          ingredients = JSON.parse(content);
        } catch (error) {
          ingredients = extractIngredientsFromText(content);
        }
        // 单张时写入缓存
        if (base64List.length === 1) {
          const cacheKey = simpleHash(base64List[0]);
          recognitionCache[cacheKey] = { ingredients, time: Date.now() };
        }
        return ingredients;
      }
      return [];
    }).catch(() => []);
  }).catch(() => []);
};

// 批量识别食材：每2张图片一组并行调用API，取并集
const recognizeIngredients = (imagePaths) => {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  const groupSize = 2;
  const groups = [];
  for (let i = 0; i < paths.length; i += groupSize) {
    groups.push(paths.slice(i, i + groupSize));
  }

  log(`开始批量识别${paths.length}张图片，分为${groups.length}组并行请求`);

  const tasks = groups.map((group, i) =>
    recognizeImageGroup(group).then(ings => {
      log(`第${i + 1}组识别完成（${group.length}张），识别到${ings.length}种食材`);
      return ings;
    }).catch(err => {
      logError(`第${i + 1}组识别失败:`, err);
      return [];
    })
  );

  return Promise.all(tasks).then(results => {
    const allIngredients = results.flat();
    const uniqueIngredients = [...new Set(allIngredients)];
    log(`批量识别完成，共${uniqueIngredients.length}种食材:`, uniqueIngredients);
    return { success: uniqueIngredients.length > 0, ingredients: uniqueIngredients };
  });
};

// 从文本中提取食材名称
const extractIngredientsFromText = (text) => {
  try {
    // 尝试匹配中文食材名称
    const ingredientPattern = /[一-龥]+/g;
    const matches = text.match(ingredientPattern) || [];

    // 过滤掉常见的非食材词汇
    const commonNonIngredients = ['图片', '食材', '识别', '中的', '所有', '请', '返回', '列表', '不要', '其他', '文字', '格式', '如下'];
    const ingredients = matches.filter(item => {
      return item.length > 1 && !commonNonIngredients.includes(item);
    });

    // 去重
    return [...new Set(ingredients)];
  } catch (error) {
    logError('提取食材失败:', error);
    // 返回默认食材
    return ['西红柿', '鸡蛋', '青椒'];
  }
};

// 根据用户饮食偏好构建约束提示词
// overrideSpicy: { spicyLevel, spicyLevelName } 可选，用于覆盖默认辣度设置
const buildDietaryPrompt = (overrideSpicy = null) => {
  try {
    const prefs = wx.getStorageSync('dietaryPreferences');
    if (!prefs && !overrideSpicy) return '';

    const parts = [];

    if (prefs && prefs.restrictions && prefs.restrictions.length > 0) {
      parts.push(`用户忌口食物：${prefs.restrictions.join('、')}。请确保所有菜谱不使用这些食材。`);
    }

    // 使用覆盖的辣度设置（如果提供），否则使用默认设置
    const spicyLevel = overrideSpicy ? overrideSpicy.spicyLevel : (prefs && prefs.spicyLevel);
    const spicyLevelName = overrideSpicy ? overrideSpicy.spicyLevelName : (prefs && prefs.spicyLevelName);

    if (spicyLevel === 0) {
      parts.push('用户不吃辣，所有菜谱请避免使用辣椒、花椒等辛辣调料。');
    } else if (spicyLevelName === '任意') {
      parts.push('用户对辣度没有特殊要求，可以推荐任意辣度的菜品，包括不辣、微辣、中辣、特辣等各种口味。');
    } else if (spicyLevelName) {
      parts.push(`用户偏好辣度：${spicyLevelName}。`);
    }

    if (prefs && prefs.tastePreferences && prefs.tastePreferences.length > 0) {
      parts.push(`用户口味偏好：${prefs.tastePreferences.join('、')}。`);
    }

    if (prefs && prefs.seasonings && prefs.seasonings.length > 0) {
      parts.push(`用户家中已有调料：${prefs.seasonings.join('、')}。请优先使用这些已有的调料来设计菜谱，在食材清单中标注这些调料时注明"已有"。如果菜谱需要用户已选调料之外的其他调料，也可以加入，但请尽量减少额外调料的种类。`);
    }

    if (prefs && prefs.kitchenware && prefs.kitchenware.length > 0) {
      parts.push(`【硬性约束】用户家中仅有以下厨具：${prefs.kitchenware.join('、')}。请确保所有推荐的菜谱只能使用这些厨具来完成烹饪。如果某道菜需要用到用户没有的厨具（如烤箱、空气炸锅等），则不要推荐该菜品。每道菜的steps中也应体现所用厨具。`);
    }

    if (prefs && prefs.notes && prefs.notes.trim()) {
      parts.push(`用户备注：${prefs.notes}`);
    }

    if (parts.length === 0) return '';
    return '\n【用户饮食偏好约束】\n' + parts.join('\n') + '\n';
  } catch (e) {
    return '';
  }
};

// 使用阿里云API生成菜谱
// spicyOverride: { spicyLevel, spicyLevelName, recipeCount, cookingMode, personCount } 可选
const generateRecipes = (ingredients, cookingStyle = 'standard', cookingTime = 0, spicyOverride = null) => {
  const recipeCount = (spicyOverride && spicyOverride.recipeCount) ? spicyOverride.recipeCount : 3;
  const cookingMode = (spicyOverride && spicyOverride.cookingMode) ? spicyOverride.cookingMode : 'recommend';
  const personCount = (spicyOverride && spicyOverride.personCount) ? spicyOverride.personCount : 4;
  return new Promise((resolve, reject) => {
    // 根据不同风格生成不同的prompt
    let stylePrompt = '';
    let styleDescription = '';

    switch (cookingStyle) {
      case 'diet':
        stylePrompt = '请采用减脂风格：低油低盐、高蛋白、少糖少淀粉，注重营养搭配和健康烹饪方式（如蒸、煮、少油炒）。';
        styleDescription = '减脂健康';
        break;
      case 'kids':
        stylePrompt = '请采用儿童友好风格：口味清淡、色彩丰富、营养均衡、避免辛辣刺激，注重食材的软嫩口感和可爱造型。';
        styleDescription = '儿童营养';
        break;
      default:
        stylePrompt = '请采用标准家常菜风格：口味适中、做法简单、适合家庭日常烹饪。';
        styleDescription = '标准家常';
    }

    // 时间约束
    let timePrompt = '';
    if (cookingTime > 0) {
      timePrompt = `【硬性要求】用户只有${cookingTime}分钟的做饭时间。所有推荐菜谱的cookTime不得超过${cookingTime}分钟，超过此时间的菜一律不要推荐。`;
    }

    let prompt = '';
    if (cookingMode === 'banquet') {
      // 根据人数确定菜品数量和分类
      let banquetRequirement = '';
      if (personCount === 3) {
        banquetRequirement = `菜单要求：
1. 必须包含以下分类的菜品，共计3-4道菜：
   - 主菜（1道）：硬菜，体现宴请规格
   - 炒菜（1-2道）：家常热菜
   - 凉菜（0-1道）：开胃冷盘
   - 汤品（0-1道）：营养均衡的汤
2. 菜品搭配要合理，口味丰富，有荤有素`;
      } else if (personCount === 4) {
        banquetRequirement = `菜单要求：
1. 必须包含以下分类的菜品，共计4-5道菜：
   - 主菜（1道）：硬菜，体现宴请规格
   - 炒菜（2道）：家常热菜
   - 凉菜（0-1道）：开胃冷盘
   - 汤品（1道）：营养均衡的汤
2. 菜品搭配要合理，口味丰富，有荤有素`;
      } else if (personCount === 5) {
        banquetRequirement = `菜单要求：
1. 必须包含以下分类的菜品，共计5-6道菜：
   - 主菜（1-2道）：硬菜，体现宴请规格
   - 炒菜（2道）：家常热菜
   - 凉菜（1道）：开胃冷盘
   - 汤品（1道）：营养均衡的汤
2. 菜品搭配要合理，口味丰富，有荤有素`;
      } else {
        // 6人
        banquetRequirement = `菜单要求：
1. 必须包含以下分类的菜品，共计6-8道菜：
   - 主菜（2道）：硬菜，体现宴请规格
   - 炒菜（2-3道）：家常热菜
   - 凉菜（1-2道）：开胃冷盘
   - 汤品（1道）：营养均衡的汤
2. 菜品搭配要合理，口味丰富，有荤有素`;
      }

      prompt = `你是一个专业的宴会厨师。请根据用户提供的食材：${ingredients.join('、')}，为${personCount}人设计一套完整的聚餐菜单。

${stylePrompt}

${timePrompt}

${buildDietaryPrompt(spicyOverride)}

${banquetRequirement}

3. 尽量使用用户提供的食材，可以适量添加其他常见食材

请严格遵守以下规则：
1. 仅输出标准的 JSON 格式数据，不要包含 markdown 标记（如 \`\`\`json），不要包含任何解释性文字。
2. 返回的数据必须是包含${personCount === 3 ? '3-4' : personCount === 4 ? '4-5' : personCount === 5 ? '5-6' : '6-8'}个元素的对象数组。
3. 每个对象必须包含以下字段：
   - "name": 菜名 (字符串)
   - "category": 菜品分类 (字符串，必须是以下之一："主菜"、"炒菜"、"凉菜"、"汤品")
   - "difficulty": 难度 (字符串，如：简单/中等/困难)
   - "cookTime": 烹饪时间 (字符串，如：15分钟，必须真实反映实际烹饪耗时)
   - "calories": 大概的卡路里含量 (字符串，如：约300)
   - "ingredients": 所需所有食材列表 (数组)，每个食材必须包含数量，格式为"食材名*数量"，例如 ["土豆*2个", "青椒*1个", "盐*少许", "食用油*适量"]
   - "steps": 烹饪步骤 (字符串数组，例如 ["1. 热锅凉油", "2. 下入食材..."])
`;
    } else {
      prompt = `你是一个专业的厨师。请根据用户提供的食材：${ingredients.join('、')}，严格推荐 ${recipeCount} 道家常菜。必须返回恰好${recipeCount}道菜，不能多也不能少。

${stylePrompt}

${timePrompt}

${buildDietaryPrompt(spicyOverride)}

重要说明：你可以使用部分食材来生成菜谱，不需要使用所有食材。

请严格遵守以下规则：
1. 仅输出标准的 JSON 格式数据，不要包含 markdown 标记（如 \`\`\`json），不要包含任何解释性文字。
2. 返回的数据必须是一个包含恰好${recipeCount}个元素的对象数组。
3. 每个对象必须包含以下字段：
   - "name": 菜名 (字符串)
   - "difficulty": 难度 (字符串，如：简单/中等/困难)
   - "cookTime": 烹饪时间 (字符串，如：15分钟，必须真实反映实际烹饪耗时)
   - "calories": 大概的卡路里含量 (字符串，如：约300)
   - "ingredients": 所需所有食材列表 (数组)，每个食材必须包含数量，格式为"食材名*数量"，例如 ["土豆*2个", "青椒*1个", "盐*少许", "食用油*适量"]
   - "steps": 烹饪步骤 (字符串数组，例如 ["1. 热锅凉油", "2. 下入食材..."])
`;
    }

    log('开始调用阿里云API生成菜谱');
    log('食材列表:', ingredients);
    log('Prompt:', prompt);

    requestWithRetry({
      url: `${BASE_URL}/chat/completions`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: {
        model: MODEL_CONFIG.recipeGeneration.model,
        enable_thinking: false,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的菜谱生成助手，能够根据食材生成详细的家常菜谱。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: cookingMode === 'banquet' ? (personCount <= 4 ? 6000 : 8000) : MODEL_CONFIG.recipeGeneration.maxTokens,
        temperature: MODEL_CONFIG.recipeGeneration.temperature
      }
    }).then((response) => {
      log('API调用成功，状态码:', response.statusCode);

      if (response.statusCode === 200 && response.data && response.data.choices) {
        const content = response.data.choices[0].message.content;
        log('AI返回内容:', content);

        try {
          const recipes = parseRecipes(content, ingredients);
          resolve({ success: true, recipes });
        } catch (parseErr) {
          logError('解析菜谱失败:', parseErr);
          resolve({ success: false, recipes: [] });
        }
      } else {
        logError('API调用失败，返回数据:', response);
        resolve({ success: false, recipes: [] });
      }
    }).catch((err) => {
      logError('API请求失败:', err);
      resolve({ success: false, recipes: [] });
    });
  });
};

// 从AI返回内容中提取JSON字符串
const extractJSON = (content) => {
  // 1. 去掉markdown代码块包裹
  let text = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'\'').trim();

  // 2. 尝试直接解析
  try { JSON.parse(text); return text; } catch(e) {}

  // 3. 提取第一个 [ ... ] 或 { ... } JSON结构
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { JSON.parse(arrMatch[0]); return arrMatch[0]; } catch(e) {}
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { JSON.parse(objMatch[0]); return objMatch[0]; } catch(e) {}
  }

  // 4. 逐步截断尾部垃圾字符重试
  for (let len = text.length; len > 10; len -= 10) {
    const sub = text.substring(0, len);
    try { JSON.parse(sub); return sub; } catch(e) {}
  }

  return null;
};

// 解析AI生成的菜谱
const parseRecipes = (content, userIngredients) => {
  log('开始解析菜谱，原始内容长度:', content.length);

  const jsonStr = extractJSON(content);
  if (!jsonStr) {
    logError('无法从AI返回内容中提取有效JSON');
    throw new Error('解析失败');
  }

  const parsedContent = JSON.parse(jsonStr);
  const recipesArray = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

  const parseIngredient = (ing) => {
    const parts = ing.split('*');
    return { name: parts[0].trim(), qty: parts[1] ? parts[1].trim() : '', full: ing };
  };

  const processedRecipes = recipesArray.map(recipe => {
    const ingredients = (recipe.ingredients || []).map(parseIngredient);
    const missingIngredients = ingredients.filter(ing => {
      return !userIngredients.some(userIng => ing.name.includes(userIng) || userIng.includes(ing.name));
    });
    const result = {
      name: recipe.name || '未知菜谱',
      ingredients,
      missingIngredients,
      difficulty: recipe.difficulty || '简单',
      cookTime: recipe.cookTime || '',
      calories: recipe.calories || '约300',
      steps: recipe.steps || []
    };
    if (recipe.category) {
      result.category = recipe.category;
    }
    return result;
  });

  log('菜谱解析成功，共', processedRecipes.length, '道:', processedRecipes.map(r => r.name).join('、'));
  return processedRecipes;
};

// 使用阿里云多模态API进行卡路里识别
const recognizeCalorie = (imagePath) => {
  return new Promise((resolve, reject) => {
    // 读取图片文件并压缩
    wx.compressImage({
      src: imagePath,
      quality: 70,
      success: (compressRes) => {
        wx.getFileSystemManager().readFile({
          filePath: compressRes.tempFilePath,
          encoding: 'base64',
          success: (res) => {
            const base64Image = res.data;
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;

            // 调用阿里云多模态API（带重试）
            requestWithRetry({
              url: `${BASE_URL}/chat/completions`,
              method: 'POST',
              header: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
              },
              data: {
                model: MODEL_CONFIG.calorieRecognition.primary.model,
                enable_thinking: false,
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的营养分析师，能够从食物图片中识别食物并分析其卡路里和营养成分。'
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: {
                          url: imageUrl
                        }
                      },
                      {
                        type: 'text',
                        text: '请识别图片中的食物，分析其卡路里含量和主要营养成分，并给出健康建议。' + buildDietaryPrompt() + '请返回JSON格式：{"foodName": "食物名称", "calories": "卡路里含量", "nutrition": "营养成分", "suggestion": "健康建议"}'
                      }
                    ]
                  }
                ],
                max_tokens: MODEL_CONFIG.calorieRecognition.primary.maxTokens,
                temperature: MODEL_CONFIG.calorieRecognition.primary.temperature
              }
            }).then((response) => {
              log('卡路里API调用成功，状态码:', response.statusCode);

              if (response.statusCode === 200 && response.data && response.data.choices) {
                const content = response.data.choices[0].message.content;
                try {
                  const calorieData = JSON.parse(content);
                  // 规范化 nutrition：AI 可能返回对象而非字符串
                  if (calorieData.nutrition && typeof calorieData.nutrition === 'object') {
                    calorieData.nutrition = Object.entries(calorieData.nutrition)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ');
                  }
                  resolve({ success: true, data: calorieData });
                } catch (parseError) {
                  logError('解析卡路里数据失败:', parseError);
                  resolve({
                    success: true,
                    data: {
                      foodName: '未知食物',
                      calories: '无法解析',
                      nutrition: '无法分析',
                      suggestion: '请拍摄更清晰的照片'
                    }
                  });
                }
              } else {
                reject(new Error('API调用失败'));
              }
            }).catch((err) => {
              reject(err);
            });
          },
          fail: (err) => {
            reject(err);
          }
        });
      },
      fail: (err) => {
        // 压缩失败时使用原图
        wx.getFileSystemManager().readFile({
          filePath: imagePath,
          encoding: 'base64',
          success: (res) => {
            const base64Image = res.data;
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;

            // 调用阿里云多模态API（带重试，降级模型）
            requestWithRetry({
              url: `${BASE_URL}/chat/completions`,
              method: 'POST',
              header: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
              },
              data: {
                model: MODEL_CONFIG.calorieRecognition.fallback.model,
                enable_thinking: false,
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业的营养分析师，能够从食物图片中识别食物并分析其卡路里和营养成分。'
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: {
                          url: imageUrl
                        }
                      },
                      {
                        type: 'text',
                        text: '请识别图片中的食物，分析其卡路里含量和主要营养成分，并给出健康建议。' + buildDietaryPrompt() + '请返回JSON格式：{"foodName": "食物名称", "calories": "卡路里含量", "nutrition": "营养成分", "suggestion": "健康建议"}'
                      }
                    ]
                  }
                ],
                max_tokens: MODEL_CONFIG.calorieRecognition.fallback.maxTokens,
                temperature: MODEL_CONFIG.calorieRecognition.fallback.temperature
              }
            }).then((response) => {
              if (response.statusCode === 200 && response.data && response.data.choices) {
                const content = response.data.choices[0].message.content;
                try {
                  const calorieData = JSON.parse(content);
                  // 规范化 nutrition：AI 可能返回对象而非字符串
                  if (calorieData.nutrition && typeof calorieData.nutrition === 'object') {
                    calorieData.nutrition = Object.entries(calorieData.nutrition)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ');
                  }
                  resolve({ success: true, data: calorieData });
                } catch (error) {
                  resolve({
                    success: true,
                    data: {
                      foodName: '未知食物',
                      calories: '约100卡路里',
                      nutrition: '无法分析',
                      suggestion: '请拍摄更清晰的照片'
                    }
                  });
                }
              } else {
                reject(new Error('API调用失败'));
              }
            }).catch((err) => {
              reject(err);
            });
          },
          fail: (err) => {
            reject(err);
          }
        });
      }
    });
  });
};

// 解析卡路里文本，提取数值范围的中心值
// 例如："约280-350k/份（约300g）" → 315
const parseCalorieText = (calorieText) => {
  if (!calorieText || typeof calorieText !== 'string') {
    return 0;
  }

  log('开始解析卡路里文本:', calorieText);

  // 尝试匹配数字范围模式：如 "280-350", "280~350", "280至350"
  const rangeMatch = calorieText.match(/(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1]);
    const end = parseFloat(rangeMatch[2]);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      const center = Math.round((start + end) / 2);
      log(`解析到范围 ${start}-${end}, 中心值: ${center}`);
      return center;
    }
  }

  // 尝试匹配单个数字：如 "约300卡路里"
  const singleMatch = calorieText.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    if (!isNaN(value)) {
      log(`解析到单个数值: ${value}`);
      return value;
    }
  }

  log('无法解析卡路里文本，返回默认值0');
  return 0; // 默认值
};

module.exports = {
  recognizeIngredients,
  generateRecipes,
  recognizeCalorie,
  parseCalorieText
};
