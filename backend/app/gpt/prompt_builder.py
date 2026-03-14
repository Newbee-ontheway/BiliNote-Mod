from app.gpt.prompt import BASE_PROMPT

note_formats = [
    {'label': '目录', 'value': 'toc'},
    {'label': '原片跳转', 'value': 'link'},
    {'label': '原片截图', 'value': 'screenshot'},
    {'label': 'AI总结', 'value': 'summary'}
]

note_styles = [
    {'label': '精简', 'value': 'minimal'},
    {'label': '详细', 'value': 'detailed'},
    {'label': '深度分析', 'value': 'deep_analysis'},
    {'label': '教程', 'value': 'tutorial'},
    {'label': '学术', 'value': 'academic'},
    {'label': '小红书', 'value': 'xiaohongshu'},
    {'label': '生活向', 'value': 'life_journal'},
    {'label': '任务导向', 'value': 'task_oriented'},
    {'label': '商业风格', 'value': 'business'},
    {'label': '会议纪要', 'value': 'meeting_minutes'}
]


# 生成 BASE_PROMPT 函数
def generate_base_prompt(title, segment_text, tags, _format=None, style=None, extras=None, summary_level=None):
    # 生成 Base Prompt 开头部分
    prompt = BASE_PROMPT.format(
        video_title=title,
        segment_text=segment_text,
        tags=tags
    )

    # 添加用户选择的格式
    if _format:
        prompt += "\n" + "\n".join([get_format_function(f) for f in _format])

    # 根据用户选择的笔记风格添加描述
    if style:
        prompt += "\n" + get_style_format(style)

    # 添加额外内容
    if extras:
        prompt += f"\n{extras}"
    return prompt


# 获取格式函数
def get_format_function(format_type):
    format_map = {
        'toc': get_toc_format,
        'link': get_link_format,
        'screenshot': get_screenshot_format,
        'summary': get_summary_format
    }
    return format_map.get(format_type, lambda: '')()


# 风格描述的处理
def get_style_format(style):
    style_map = {
        'minimal': """1. **精简信息**:
- 仅保留视频的核心观点和关键结论
- 每个要点用一到两句话概括
- 去除所有次要信息、过渡内容和重复表述
- 适合快速回顾，总字数控制在原文 20% 以内""",

        'detailed': """2. **详细记录**:
- **跟随视频原有结构和顺序**，不要自行重新组织章节
- 对视频中出现的**专业术语和核心概念**，必须展开解释其定义、原理和意义，而不是仅仅提及名称
- 保留视频中的**所有示例、数据、论证过程和推导步骤**，不要省略
- 对比性内容使用 Markdown 表格呈现
- 关键公式用 LaTeX 完整记录并解释各符号含义
- 讲解者的重要观点和个人见解要标注出来
- **不限字数，以信息完整和概念清晰为最高优先级**""",

        'deep_analysis': """3. **深度分析**: 请生成全面、详细的深度分析笔记：
- 按内容逻辑分章节（`##` 标题），每章节详细展开。
- 保留所有关键事实、数据、示例、论证过程和结论。
- 在笔记末尾，用 Mermaid 语法生成一张思维导图，概括整体知识结构：
  ```mermaid
  mindmap
    root((主题))
      分支1
        要点A
        要点B
      分支2
        要点C
  ```
- 如果内容涉及流程或步骤，额外生成一张 Mermaid 流程图。
- 如果内容涉及对比，使用 Markdown 表格呈现。
- 总字数不限，以信息完整为优先。""",

        'tutorial': """4. **教程笔记**:
- **按视频教学顺序逐步记录**，保持原有教学节奏和逻辑链
- 每个步骤要完整记录：做什么、怎么做、为什么这么做
- 核心概念必须解释**"是什么"（定义）**和**"为什么"（原理/动机）**，不能只说结论
- 代码、命令、操作步骤、配置参数要**完整记录**，不要用省略号或"等等"
- 标注讲解者提到的**常见错误、踩坑点和注意事项**（用 `> ⚠️ 注意：` 格式）
- 如果有前置知识要求，在开头注明
- 适合边看边学的场景，**不限字数，以步骤完整为优先**""",

        'academic': """5. **学术风格**:
- 使用学术论文的结构：摘要 → 背景介绍 → 核心内容 → 方法/论证 → 结论
- 术语首次出现时给出**英文原文和中文释义**
- 保留所有数据、公式和引用来源
- 使用严谨客观的学术语言，避免口语化表达
- 关键论点要区分"事实陈述"和"观点/推测"
- 适当补充学科背景知识帮助理解""",

        'xiaohongshu': """6. **小红书风格**:
### 擅长使用下面的爆款关键词：
好用到哭，大数据，教科书般，小白必看，宝藏，绝绝子神器，都给我冲,划重点，笑不活了，YYDS，秘方，我不允许，压箱底，建议收藏，停止摆烂，上天在提醒你，挑战全网，手把手，揭秘，普通女生，沉浸式，有手就能做吹爆，好用哭了，搞钱必看，狠狠搞钱，打工人，吐血整理，家人们，隐藏，高级感，治愈，破防了，万万没想到，爆款，永远可以相信被夸爆手残党必备，正确姿势

### 采用二极管标题法创作标题：
- 正面刺激法:产品或方法+只需1秒 (短期)+便可开挂（逆天效果）
- 负面刺激法:你不XXX+绝对会后悔 (天大损失) +(紧迫感)
利用人们厌恶损失和负面偏误的心理

### 写作技巧
1. 使用惊叹号、省略号等标点符号增强表达力，营造紧迫感和惊喜感。
2. **使用emoji表情符号，来增加文字的活力**
3. 采用具有挑战性和悬念的表述，引发读者好奇心，例如"暴涨词汇量"、"拒绝焦虑"等
4. 利用正面刺激和负面刺激，诱发读者的本能需求和基本驱动力
5. 融入热点话题和实用工具，提高文章的实用性和时效性
6. 描述具体的成果和效果，强调标题中的关键词，使其更具吸引力
7. 使用吸引人的标题""",

        'life_journal': """7. **生活向**:
- 用温暖、真诚的第一人称语气记录
- 捕捉视频中的情感共鸣点和人生感悟
- 保留打动人心的金句和故事细节
- 适当加入个人反思和联想
- 使用轻松可读的段落格式""",

        'task_oriented': """8. **任务导向**:
- 提炼所有可执行的**行动项**（Action Items），用清单格式列出
- 每个任务标注：目标、具体步骤、预期结果
- 区分"立即行动"和"后续跟进"
- 提炼关键决策点和判断依据
- 适合从视频中提取待办事项""",

        'business': """9. **商业风格**:
- 使用商业报告格式：Executive Summary → 核心发现 → 详细分析 → 建议/行动项
- 数据和指标用表格或列表清晰呈现
- 标注商业机会、风险点和竞争分析
- 语言正式精炼，避免冗余
- 适合向管理层或客户汇报""",

        'meeting_minutes': """10. **会议纪要**:
- 记录所有**决议事项**和**行动项**（标注负责人和截止日期，如视频中有提及）
- 按议题分类记录讨论要点
- 区分"已达成共识"、"待讨论"和"分歧点"
- 保留关键数据和承诺
- 在末尾列出完整的 Action Items 清单""",
    }
    return style_map.get(style, '')


# 格式化输出内容
def get_toc_format():
    return '''
    9. **目录**: 自动生成一个基于 `##` 级标题的目录。不需要插入原片跳转
    '''


def get_link_format():
    return '''
    10. **原片跳转**: 为每个主要章节添加时间戳，使用格式 `*Content-[mm:ss]`。
    重要：**始终**在章节标题前加上 `*Content` 前缀，例如：`AI 的发展史 *Content-[01:23]`。一定是标题在前 插入标记在后
    '''


def get_screenshot_format():
    return '''
11. **原片截图**:你收到的截图一般是一个网格，网格的每张图片就是一个时间点，左上角会包含时间mm:ss的格式，请你结合我发你的图片插入截图提示，请你帮助用户更好的理解视频内容，请你认真的分析每个图片和对应的转写文案，插入最合适的内容来备注用户理解，请一定按照这个格式 返回否则系统无法解析：
- 格式：`*Screenshot-[mm:ss]`

    '''


def get_summary_format():
    return '''
    12. **AI总结**: 在笔记末尾加入简短的AI生成总结,并且二级标题 就是 AI 总结 例如 ## AI 总结。
    '''
