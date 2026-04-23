# 📸 冰箱清空大师 - 微信小程序

基于图像识别的剩菜变身计划，让剩菜变成美味佳肴！

## 核心功能

- **📷 拍照上传**：支持拍照或从相册选择食材照片
- **🔍 智能识别**：自动识别照片中的食材（当前为模拟数据）
- **📝 菜谱生成**：根据识别出的食材生成3道家常菜谱
- **🛒 购物清单**：显示缺失的调料和食材，支持一键购买（模拟）
- **👨‍🍳 详细步骤**：每道菜都有详细的烹饪步骤和预计时间

## 项目结构

```
test1/
├── app.js                 # 小程序入口文件
├── app.json              # 小程序配置文件
├── app.wxss              # 全局样式文件
├── sitemap.json          # 站点地图配置
├── pages/                # 页面目录
│   ├── index/           # 首页（拍照上传）
│   ├── recognize/       # 识别结果页
│   └── recipes/         # 菜谱展示页
└── utils/               # 工具函数
    ├── util.js          # 通用工具函数
    └── api.js           # API调用（含模拟数据）
```

## 如何使用

### 1. 在微信开发者工具中打开

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开微信开发者工具，选择"导入项目"
3. 选择 `h:\Project\Trae\Test1\test1` 目录
4. 填写 AppID（如果没有，可以选择"测试号"）
5. 点击"导入"即可

### 2. 测试流程

1. **首页**：点击上传区域，选择一张图片或拍照
2. **识别页**：系统会模拟识别出食材，你可以手动添加或删除
3. **菜谱页**：点击"生成菜谱"，查看推荐的菜谱详情

## 技术实现说明

### 当前版本（已接入阿里云API）

- **食材识别**：已接入阿里云多模态大模型（qwen3.5-plus）
- **菜谱生成**：已接入阿里云千问大模型（qwen-plus）
- **API配置**：已配置API Key和Base URL
- **界面完全实现**：交互流畅，响应式设计

### 阿里云API配置

项目已内置阿里云API配置：

- **API Key**：sk-a46921c7343b4a60af36ed720bd6e51c
- **Base URL**：https://dashscope.aliyuncs.com/compatible-mode/v1
- **食材识别模型**：qwen3.5-plus（多模态）
- **菜谱生成模型**：qwen-plus

### 升级到真实图像识别API

如需接入真实的图像识别服务，可修改 `utils/api.js` 中的 `recognizeIngredients` 函数：

```javascript
// 接入百度AI开放平台（图像识别）
const recognizeIngredients = (imagePath) => {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: imagePath,
      encoding: 'base64',
      success(res) {
        wx.request({
          url: 'https://aip.baidubce.com/rest/2.0/image-classify/v1/ingredient',
          method: 'POST',
          header: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          data: {
            image: res.data,
            access_token: 'YOUR_ACCESS_TOKEN'
          },
          success(response) {
            const ingredients = response.data.result.map(item => item.name)
            resolve({ success: true, ingredients })
          },
          fail: reject
        })
      },
      fail: reject
    })
  })
}
```

### API调用说明

1. **菜谱生成**：使用阿里云千问大模型生成3道家常菜谱
2. **格式解析**：自动解析AI返回的菜谱格式
3. **错误处理**：包含完整的错误处理和默认菜谱 fallback
4. **性能优化**：合理设置API参数，确保响应速度

## 页面说明

### pages/index（首页）
- 拍照/上传食材照片
- 预览和删除图片
- 显示使用提示

### pages/recognize（识别页）
- 显示识别出的食材
- 支持手动添加/删除食材
- 提供常用食材快速添加

### pages/recipes（菜谱页）
- 展示3道推荐菜谱
- 显示所需食材（区分已有/缺失）
- 详细烹饪步骤
- 一键购买缺食材（模拟）

## 特色功能

- ✅ 精美的UI设计，绿色主题
- ✅ 流畅的交互动画
- ✅ 响应式布局，适配各种屏幕
- ✅ 完善的错误处理和用户提示
- ✅ 易于扩展的代码结构

## 注意事项

1. 当前使用的是模拟数据，每次识别会随机返回预设的食材组合
2. 如需使用真实API，需要申请相应的服务并配置API密钥
3. 小程序正式发布需要经过微信审核

## 开发者信息

这是一个适合作为课程大作业的项目，展示了完整的小程序开发流程和AI应用的基本架构。
