// 阿里云API配置
const API_KEY = 'sk-a46921c7343b4a60af36ed720bd6e51c';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 使用阿里云多模态API进行食材识别
const recognizeIngredients = (imagePath) => {
  return new Promise((resolve, reject) => {
    // 读取图片文件
    wx.getFileSystemManager().readFile({
      filePath: imagePath,
      encoding: 'base64',
      success: (res) => {
        const base64Image = res.data;
        const imageUrl = `data:image/jpeg;base64,${base64Image}`;

        // 调用阿里云多模态API
        wx.request({
          url: `${BASE_URL}/chat/completions`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          data: {
            model: 'qwen3.5-plus',
            messages: [
              {
                role: 'system',
                content: '你是一个专业的食材识别助手，能够从图片中识别出所有的食材名称。'
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
                    text: '请识别图片中的所有食材，只返回食材名称列表，不要有其他文字。格式：["食材1", "食材2", "食材3"]'
                  },
                  {
                    type: 'text',
                    text: '/no_think' // 将指令单独作为一个文本块，确保模型最后处理它
                  }
                ]
              }
            ],
            max_tokens: 500,
            temperature: 0.3
          },
          success: (response) => {
            if (response.statusCode === 200 && response.data && response.data.choices) {
              const content = response.data.choices[0].message.content;
              try {
                // 解析返回的食材列表
                const ingredients = JSON.parse(content);
                resolve({
                  success: true,
                  ingredients: ingredients
                });
              } catch (error) {
                // 如果解析失败，尝试提取食材名称
                const extractedIngredients = extractIngredientsFromText(content);
                resolve({
                  success: true,
                  ingredients: extractedIngredients
                });
              }
            } else {
              reject(new Error('API调用失败'));
            }
          },
          fail: (err) => {
            reject(err);
          }
        });
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

// 从文本中提取食材名称
const extractIngredientsFromText = (text) => {
  try {
    // 尝试匹配中文食材名称
    const ingredientPattern = /[\u4e00-\u9fa5]+/g;
    const matches = text.match(ingredientPattern) || [];

    // 过滤掉常见的非食材词汇
    const commonNonIngredients = ['图片', '食材', '识别', '中的', '所有', '请', '返回', '列表', '不要', '其他', '文字', '格式', '如下'];
    const ingredients = matches.filter(item => {
      return item.length > 1 && !commonNonIngredients.includes(item);
    });

    // 去重
    return [...new Set(ingredients)];
  } catch (error) {
    console.error('提取食材失败:', error);
    // 返回默认食材
    return ['西红柿', '鸡蛋', '青椒'];
  }
};

// 使用阿里云API生成菜谱
const generateRecipes = (ingredients, cookingStyle = 'standard', cookingTime = 0) => {
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

    const prompt = `
<|no_think|>
你是一个专业的厨师。请根据用户提供的食材：${ingredients.join('、')}，严格推荐 3 道家常菜。必须返回恰好3道菜，不能多也不能少。

${stylePrompt}

${timePrompt}

重要说明：你可以使用部分食材来生成菜谱，不需要使用所有食材。

请严格遵守以下规则：
1. 仅输出标准的 JSON 格式数据，不要包含 markdown 标记（如 \`\`\`json），不要包含任何解释性文字。
2. 返回的数据必须是一个包含恰好3个元素的对象数组。
3. 每个对象必须包含以下字段：
   - "name": 菜名 (字符串)
   - "difficulty": 难度 (字符串，如：简单/中等/困难)
   - "cookTime": 烹饪时间 (字符串，如：15分钟，必须真实反映实际烹饪耗时)
   - "calories": 大概的卡路里含量 (字符串，如：约300)
   - "ingredients": 所需所有食材列表 (数组)
   - "steps": 烹饪步骤 (字符串数组，例如 ["1. 热锅凉油", "2. 下入食材..."])
`;

    console.log('开始调用阿里云API生成菜谱');
    console.log('食材列表:', ingredients);
    console.log('Prompt:', prompt);

    wx.request({
      url: `${BASE_URL}/chat/completions`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: {
        model: 'qwen3.6-flash',
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
        max_tokens: 4000,
        temperature: 0.7
        // 移除response_format，让模型自由返回格式
      },
      success: (response) => {
        console.log('API调用成功，状态码:', response.statusCode);
        console.log('API返回数据:', response.data);

        if (response.statusCode === 200 && response.data && response.data.choices) {
          const content = response.data.choices[0].message.content;
          console.log('AI返回内容:', content);

          try {
            const recipes = parseRecipes(content, ingredients);
            resolve({ success: true, recipes });
          } catch (parseErr) {
            console.error('解析菜谱失败:', parseErr);
            resolve({ success: false, recipes: [] });
          }
        } else {
          console.error('API调用失败，返回数据:', response);
          resolve({ success: false, recipes: [] });
        }
      },
      fail: (err) => {
        console.error('API请求失败:', err);
        resolve({ success: false, recipes: [] });
      }
    });
  });
};

// 从AI返回内容中提取JSON字符串
const extractJSON = (content) => {
  // 1. 去掉markdown代码块包裹
  let text = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();

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
  console.log('开始解析菜谱，原始内容长度:', content.length);

  const jsonStr = extractJSON(content);
  if (!jsonStr) {
    console.error('无法从AI返回内容中提取有效JSON');
    throw new Error('解析失败');
  }

  const parsedContent = JSON.parse(jsonStr);
  const recipesArray = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

  const processedRecipes = recipesArray.map(recipe => ({
    name: recipe.name || '未知菜谱',
    ingredients: recipe.ingredients || [],
    missingIngredients: (recipe.ingredients || []).filter(ing => !userIngredients.includes(ing)),
    difficulty: recipe.difficulty || '简单',
    cookTime: recipe.cookTime || '',
    calories: recipe.calories || '约300',
    steps: recipe.steps || []
  }));

  console.log('菜谱解析成功，共', processedRecipes.length, '道:', processedRecipes.map(r => r.name).join('、'));
  return processedRecipes;
};

// 使用阿里云多模态API进行卡路里识别
const recognizeCalorie = (imagePath) => {
  return new Promise((resolve, reject) => {
    // 读取图片文件并压缩
    wx.compressImage({
      src: imagePath,
      quality: 70, // 压缩质量
      success: (compressRes) => {
        wx.getFileSystemManager().readFile({
          filePath: compressRes.tempFilePath,
          encoding: 'base64',
          success: (res) => {
            const base64Image = res.data;
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;
            
            // 调用阿里云多模态API
            wx.request({
              url: `${BASE_URL}/chat/completions`,
              method: 'POST',
              header: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
              },
              data: {
                model: 'qwen3-vl-plus',
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
                        text: '请识别图片中的食物，分析其卡路里含量和主要营养成分，并给出健康建议。请返回JSON格式：{"foodName": "食物名称", "calories": "卡路里含量", "nutrition": "营养成分", "suggestion": "健康建议"}'
                      },
                      {
                        type: 'text',
                        text: '/no_think'
                      }
                    ]
                  }
                ],
                max_tokens: 1000,
                temperature: 0.3
              },
              success: (response) => {
                console.log('卡路里API调用成功，状态码:', response.statusCode);
                console.log('API返回数据:', response.data);
                
                if (response.statusCode === 200 && response.data && response.data.choices) {
                  const content = response.data.choices[0].message.content;
                  console.log('AI返回内容:', content);
                  
                  try {
                    // 解析返回的卡路里信息
                    const calorieData = JSON.parse(content);
                    resolve({
                      success: true,
                      data: calorieData
                    });
                  } catch (error) {
                    console.error('解析卡路里数据失败:', error);
                    // 如果解析失败，返回默认数据
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
              },
              fail: (err) => {
                reject(err);
              }
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
            
            // 调用阿里云多模态API
            wx.request({
              url: `${BASE_URL}/chat/completions`,
              method: 'POST',
              header: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
              },
              data: {
                model: 'qwen3.5-plus',
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
                        text: '请识别图片中的食物，分析其卡路里含量和主要营养成分，并给出健康建议。请返回JSON格式：{"foodName": "食物名称", "calories": "卡路里含量", "nutrition": "营养成分", "suggestion": "健康建议"}'
                      }
                    ]
                  }
                ],
                max_tokens: 1000,
                temperature: 0.1
              },
              success: (response) => {
                if (response.statusCode === 200 && response.data && response.data.choices) {
                  const content = response.data.choices[0].message.content;
                  try {
                    const calorieData = JSON.parse(content);
                    resolve({
                      success: true,
                      data: calorieData
                    });
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
              },
              fail: (err) => {
                reject(err);
              }
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

  console.log('开始解析卡路里文本:', calorieText);

  // 尝试匹配数字范围模式：如 "280-350", "280~350", "280至350"
  const rangeMatch = calorieText.match(/(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1]);
    const end = parseFloat(rangeMatch[2]);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      const center = Math.round((start + end) / 2);
      console.log(`解析到范围 ${start}-${end}, 中心值: ${center}`);
      return center;
    }
  }

  // 尝试匹配单个数字：如 "约300卡路里"
  const singleMatch = calorieText.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    if (!isNaN(value)) {
      console.log(`解析到单个数值: ${value}`);
      return value;
    }
  }

  console.log('无法解析卡路里文本，返回默认值100');
  return 0; // 默认值
};

module.exports = {
  recognizeIngredients,
  generateRecipes,
  recognizeCalorie,
  parseCalorieText
};