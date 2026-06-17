export const workflowSteps = [
  {
    id: 'book',
    index: '01',
    title: '全书规划',
    note: '先定这本书的长期信息'
  },
  {
    id: 'chapter',
    index: '02',
    title: '单章设置',
    note: '再定这一章到底要写什么'
  },
  {
    id: 'generate',
    index: '03',
    title: '正文生成',
    note: '最后推进正文、导出和反馈'
  }
];

export const mockWorkbenchState = {
  currentBook: {
    title: '血月残卷',
    platform: '番茄小说',
    genre: '东方玄幻',
    template: '强冲突成长流'
  },
  bookPlanning: {
    characterSummary:
      '殷寂川是命不久矣的禁血之子，卓清晏是他唯一愿意护住的人，牧云昭则代表会不断逼近的旧势力与真相追索。',
    outlineSummary:
      '前段围绕逃亡与觉醒，中段进入势力交锋与血脉真相，后段推进血月源头和命运反杀，卷与卷之间由代价升级来驱动。'
  },
  chapterPlan: {
    chapterNumber: 9,
    chapterTitle: '荒原血祭',
    mainStoryline: '血月之力暴露线',
    chapterMission: '逼主角在救人与自保之间做出代价型选择',
    emotionTarget: '压抑中带决绝',
    outlineSummary:
      '荒原伏击先压出危险，再让主角被迫动用禁力反杀，最后把行踪暴露和结尾钩子一起留下。',
    appearingRoles: ['殷寂川', '卓清晏', '容渡', '追猎者小队']
  },
  generation: {
    generatedExcerpt:
      '正文结果区未来会从右侧独立出来，和工作台形成更明确的上下结构，不再让左侧信息挤到像沙丁鱼罐头。',
    feedbackSummary: '这一章将决定血月之力是否正式进入明线。'
  }
};
