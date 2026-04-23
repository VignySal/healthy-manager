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
const generateRecipes = (ingredients, cookingStyle = 'standard') => {
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

    const prompt = `
    <|no_think|>
你是一个专业的厨师。请根据用户提供的食材：${ingredients.join('、')}，推荐 3 道家常菜。

${stylePrompt}

重要说明：你可以使用部分食材来生成菜谱，不需要使用所有食材。

请严格遵守以下规则：
1. 仅输出标准的 JSON 格式数据，不要包含 markdown 标记（如 \`\`\`json），不要包含任何解释性文字。
2. 返回的数据必须是一个对象数组。
3. 每个对象必须包含以下字段：
   - "name": 菜名 (字符串)
   - "difficulty": 难度 (字符串，如：简单/中等/困难)
   - "cookTime": 烹饪时间 (字符串，如：15分钟)
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
        model: 'qwen3.5-plus',
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
        max_tokens: 3000,
        temperature: 0.7
        // 移除response_format，让模型自由返回格式
      },
      success: (response) => {
        console.log('API调用成功，状态码:', response.statusCode);
        console.log('API返回数据:', response.data);

        if (response.statusCode === 200 && response.data && response.data.choices) {
          const content = response.data.choices[0].message.content;
          console.log('AI返回内容:', content);

          // 直接使用备用解析方法，因为模型可能返回非JSON格式
          console.log('使用备用解析方法');
          const fallbackRecipes = parseRecipes(content, ingredients);
          console.log('备用解析结果:', fallbackRecipes);

          resolve({
            success: true,
            recipes: fallbackRecipes
          });
        } else {
          console.error('API调用失败，返回数据:', response);
          // 当API调用失败时，返回默认菜谱
          const defaultRecipes = getDefaultRecipes(ingredients);
          console.log('API调用失败，返回默认菜谱:', defaultRecipes);
          resolve({
            success: true,
            recipes: defaultRecipes
          });
        }
      },
      fail: (err) => {
        console.error('API请求失败:', err);
        // 当网络请求失败时，返回默认菜谱
        const defaultRecipes = getDefaultRecipes(ingredients);
        console.log('网络请求失败，返回默认菜谱:', defaultRecipes);
        resolve({
          success: true,
          recipes: defaultRecipes
        });
      }
    });
  });
};

// 解析AI生成的菜谱（备用方法）
const parseRecipes = (content, userIngredients) => {
  try {
    // 首先尝试解析JSON格式
    try {
      console.log('尝试解析JSON格式');
      const parsedContent = JSON.parse(content);
      const recipesArray = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

      // 处理解析后的菜谱数据
      const processedRecipes = recipesArray.map(recipe => {
        // 确保所有必要字段存在
        const processedRecipe = {
          name: recipe.name || '未知菜谱',
          ingredients: recipe.ingredients || [],
          missingIngredients: recipe.ingredients ? recipe.ingredients.filter(ing => !userIngredients.includes(ing)) : [],
          difficulty: recipe.difficulty || '简单',
          cookTime: recipe.cookTime || '30分钟',
          calories: recipe.calories || '约300',
          steps: recipe.steps || []
        };
        return processedRecipe;
      });

      console.log('JSON解析成功，处理后的菜谱:', processedRecipes);
      return processedRecipes;
    } catch (jsonError) {
      console.log('JSON解析失败，尝试文本解析:', jsonError);
      // JSON解析失败，尝试文本解析
      const recipes = [];
      const recipeTexts = content.split('\n\n');

      let currentRecipe = null;
      recipeTexts.forEach(text => {
        text = text.trim();
        if (!text) return;

        // 尝试匹配JSON格式的字段
        if (text.includes('"name"') || text.includes("'name'")) {
          if (currentRecipe) {
            recipes.push(currentRecipe);
          }
          // 提取菜名
          const nameMatch = text.match(/"name"\s*:\s*["']([^"']+)["']/);
          currentRecipe = {
            name: nameMatch ? nameMatch[1] : '未知菜谱',
            ingredients: [],
            missingIngredients: [],
            difficulty: '简单',
            cookTime: '30分钟',
            calories: '约300',
            steps: []
          };
        } else if (text.includes('"difficulty"') || text.includes("'difficulty'")) {
          if (currentRecipe) {
            const difficultyMatch = text.match(/"difficulty"\s*:\s*["']([^"']+)["']/);
            if (difficultyMatch) {
              currentRecipe.difficulty = difficultyMatch[1];
            }
          }
        } else if (text.includes('"cookTime"') || text.includes("'cookTime'")) {
          if (currentRecipe) {
            const cookTimeMatch = text.match(/"cookTime"\s*:\s*["']([^"']+)["']/);
            if (cookTimeMatch) {
              currentRecipe.cookTime = cookTimeMatch[1];
            }
          }
        } else if (text.includes('"calories"') || text.includes("'calories'")) {
          if (currentRecipe) {
            const caloriesMatch = text.match(/"calories"\s*:\s*["']([^"']+)["']/);
            if (caloriesMatch) {
              currentRecipe.calories = caloriesMatch[1];
            }
          }
        } else if (text.includes('"ingredients"') || text.includes("'ingredients'")) {
          if (currentRecipe) {
            // 提取食材数组
            const ingredientsMatch = text.match(/"ingredients"\s*:\s*\[(.*?)\]/s);
            if (ingredientsMatch) {
              const ingredientsText = ingredientsMatch[1];
              const ingredientList = ingredientsText.split(/[,，]/).map(item =>
                item.replace(/["']/g, '').trim()
              ).filter(item => item);
              currentRecipe.ingredients = ingredientList;
              currentRecipe.missingIngredients = ingredientList.filter(ing => !userIngredients.includes(ing));
            }
          }
        } else if (text.includes('"steps"') || text.includes("'steps'")) {
          if (currentRecipe) {
            // 提取步骤数组
            const stepsMatch = text.match(/"steps"\s*:\s*\[(.*?)\]/s);
            if (stepsMatch) {
              const stepsText = stepsMatch[1];
              const stepList = stepsText.split(/[,，]/).map(item =>
                item.replace(/["']/g, '').trim()
              ).filter(item => item);
              currentRecipe.steps = stepList;
            }
          }
        } else if (text.includes('菜名：') || text.includes('菜谱：')) {
          if (currentRecipe) {
            recipes.push(currentRecipe);
          }
          currentRecipe = {
            name: text.replace('菜名：', '').replace('菜谱：', '').trim(),
            ingredients: [],
            missingIngredients: [],
            difficulty: '简单',
            cookTime: '30分钟',
            calories: '约300',
            steps: []
          };
        } else if (text.includes('所需食材：') || text.includes('食材：')) {
          if (currentRecipe) {
            const ingredientsText = text.replace('所需食材：', '').replace('食材：', '').trim();
            const ingredientList = ingredientsText.split(/[,，、]/).map(item => item.trim()).filter(item => item);
            currentRecipe.ingredients = ingredientList;
            currentRecipe.missingIngredients = ingredientList.filter(ing => !userIngredients.includes(ing));
          }
        } else if (text.includes('难度：')) {
          if (currentRecipe) {
            currentRecipe.difficulty = text.replace('难度：', '').trim();
          }
        } else if (text.includes('烹饪时间：') || text.includes('时间：')) {
          if (currentRecipe) {
            currentRecipe.cookTime = text.replace('烹饪时间：', '').replace('时间：', '').trim();
          }
        } else if (text.includes('卡路里：') || text.includes('热量：')) {
          if (currentRecipe) {
            currentRecipe.calories = text.replace('卡路里：', '').replace('热量：', '').trim();
          }
        } else if (text.includes('步骤：')) {
          if (currentRecipe) {
            const stepsText = text.replace('步骤：', '').trim();
            const stepList = stepsText.split(/[,，]/).map(step => step.trim()).filter(step => step);
            currentRecipe.steps = stepList;
          }
        } else if (currentRecipe && text.match(/^\d+\./)) {
          // 步骤格式：1. xxx
          currentRecipe.steps.push(text.trim());
        }
      });

      if (currentRecipe) {
        recipes.push(currentRecipe);
      }

      // 如果解析失败，返回默认菜谱
      if (recipes.length === 0) {
        console.log('文本解析失败，返回默认菜谱');
        return [
          {
            name: '番茄炒鸡蛋',
            ingredients: [...userIngredients, '葱', '姜', '蒜', '盐', '糖'],
            missingIngredients: ['葱', '姜', '蒜', '盐', '糖'],
            difficulty: '简单',
            cookTime: '15分钟',
            calories: '约250',
            steps: [
              '1. 西红柿洗净切块，鸡蛋打散加少许盐',
              '2. 锅中放油，油热后倒入蛋液，炒熟盛出',
              '3. 锅中再加少许油，放入西红柿翻炒',
              '4. 加入适量糖和盐调味',
              '5. 倒入炒好的鸡蛋翻炒均匀',
              '6. 撒上葱花即可出锅'
            ]
          },
          {
            name: '清炒时蔬',
            ingredients: [...userIngredients, '蒜', '盐', '油'],
            missingIngredients: ['蒜', '盐', '油'],
            difficulty: '简单',
            cookTime: '10分钟',
            calories: '约150',
            steps: [
              '1. 蔬菜洗净切好',
              '2. 锅中放油，爆香蒜末',
              '3. 放入蔬菜翻炒',
              '4. 加入盐调味',
              '5. 翻炒均匀后出锅'
            ]
          },
          {
            name: '食材汤',
            ingredients: [...userIngredients, '盐', '香油'],
            missingIngredients: ['盐', '香油'],
            difficulty: '简单',
            cookTime: '20分钟',
            calories: '约200',
            steps: [
              '1. 食材洗净切好',
              '2. 锅中加水烧开',
              '3. 放入食材煮10分钟',
              '4. 加入盐调味',
              '5. 出锅前淋上香油'
            ]
          }
        ];
      }

      console.log('文本解析成功，菜谱:', recipes);
      return recipes;
    }
  } catch (error) {
    console.error('解析菜谱失败:', error);
    // 返回默认菜谱
    return [
      {
        name: '简易炒菜',
        ingredients: [...userIngredients, '盐', '油'],
        missingIngredients: ['盐', '油'],
        difficulty: '简单',
        cookTime: '15分钟',
        calories: '约200',
        steps: [
          '1. 食材洗净切好',
          '2. 锅中放油加热',
          '3. 放入食材翻炒',
          '4. 加入盐调味',
          '5. 炒熟后出锅'
        ]
      }
    ];
  }
};

// 获取默认菜谱
const getDefaultRecipes = (ingredients) => {
  return [
    {
      name: '番茄炒鸡蛋',
      ingredients: [...ingredients, '葱', '姜', '蒜', '盐', '糖'],
      missingIngredients: ['葱', '姜', '蒜', '盐', '糖'],
      difficulty: '简单',
      cookTime: '15分钟',
      calories: '约250',
      steps: [
        '1. 西红柿洗净切块，鸡蛋打散加少许盐',
        '2. 锅中放油，油热后倒入蛋液，炒熟盛出',
        '3. 锅中再加少许油，放入西红柿翻炒',
        '4. 加入适量糖和盐调味',
        '5. 倒入炒好的鸡蛋翻炒均匀',
        '6. 撒上葱花即可出锅'
      ]
    },
    {
      name: '清炒时蔬',
      ingredients: [...ingredients, '蒜', '盐', '油'],
      missingIngredients: ['蒜', '盐', '油'],
      difficulty: '简单',
      cookTime: '10分钟',
      calories: '约150',
      steps: [
        '1. 蔬菜洗净切好',
        '2. 锅中放油，爆香蒜末',
        '3. 放入蔬菜翻炒',
        '4. 加入盐调味',
        '5. 翻炒均匀后出锅'
      ]
    },
    {
      name: '食材汤',
      ingredients: [...ingredients, '盐', '香油'],
      missingIngredients: ['盐', '香油'],
      difficulty: '简单',
      cookTime: '20分钟',
      calories: '约200',
      steps: [
        '1. 食材洗净切好',
        '2. 锅中加水烧开',
        '3. 放入食材煮10分钟',
        '4. 加入盐调味',
        '5. 出锅前淋上香油'
      ]
    }
  ];
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