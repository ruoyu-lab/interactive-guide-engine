import type { TutorialContext, TutorialStep } from '@guide/engine'

export type DemoTutorialContext = TutorialContext & {
  notificationsEnabled: boolean
  theme: string
  dragPlaced: boolean
  saveStatus: string
}

export function createDemoTutorialSteps(): Array<TutorialStep<DemoTutorialContext>> {
  return [
    {
      id: 'open-settings',
      title: '打开设置',
      content: '点击“打开设置”按钮，进入示例设置流程。',
      target: '[data-guide="open-settings"]',
      placement: 'bottom',
      effects: [
        { type: 'pulse', target: '[data-guide="open-settings"]' },
        { type: 'cursorClick', target: '[data-guide="open-settings"]' },
      ],
      waitFor: { type: 'click', target: '[data-guide="open-settings"]' },
    },
    {
      id: 'enter-username',
      title: '输入用户名',
      content: '动画会在输入框内演示 guide-user，但不修改真实值、不触发 input；输入正确内容或离开输入框后进入下一步。',
      target: '[data-guide="username"]',
      placement: 'right',
      effects: [
        { type: 'cursorClick', target: '[data-guide="username"]' },
        {
          type: 'typeText',
          target: '[data-guide="username"]',
          text: 'guide-user',
          mode: 'ghost',
        },
      ],
      waitFor: {
        type: 'anyOf',
        conditions: [
          { type: 'input', target: '[data-guide="username"]', value: 'guide-user' },
          { type: 'blur', target: '[data-guide="username"]' },
        ],
      },
    },
    {
      id: 'enable-notifications',
      title: '打开通知',
      content: '打开通知开关。DOM adapter 会读取控件变更并确认这一步。',
      target: '[data-guide="notifications"]',
      placement: 'right',
      effects: [
        { type: 'pulse', target: '[data-guide="notifications"]' },
        { type: 'cursorClick', target: '[data-guide="notifications"] input' },
      ],
      waitFor: { type: 'change', target: '[data-guide="notifications"] input', value: true },
    },
    {
      id: 'choose-theme',
      title: '选择主题',
      content: '将主题从默认值切换到任意其他选项。',
      target: '[data-guide="theme"]',
      placement: 'right',
      effects: [
        { type: 'pulse', target: '[data-guide="theme"]' },
        { type: 'cursorClick', target: '[data-guide="theme"]' },
      ],
      waitFor: { type: 'change', target: '[data-guide="theme"]', value: /^(?!default$).+/ },
    },
    {
      id: 'place-card',
      title: '拖放卡片',
      content: '把操作卡片拖到投放区。DOM adapter 会监听 dragstart 和 drop。',
      target: '[data-guide="drop-zone"]',
      placement: 'top',
      effects: [
        { type: 'pulse', target: '[data-guide="drag-card"]' },
        {
          type: 'cursorDrag',
          source: '[data-guide="drag-card"]',
          target: '[data-guide="drop-zone"]',
        },
        { type: 'pulse', target: '[data-guide="drop-zone"]' },
      ],
      waitFor: {
        type: 'drag',
        source: '[data-guide="drag-card"]',
        target: '[data-guide="drop-zone"]',
      },
    },
    {
      id: 'save-settings',
      title: '保存设置',
      content: '点击保存按钮，等待保存状态变成 success。',
      target: '[data-guide="save"]',
      placement: 'top',
      effects: [
        { type: 'pulse', target: '[data-guide="save"]' },
        { type: 'cursorClick', target: '[data-guide="save"]' },
      ],
      waitFor: {
        type: 'allOf',
        conditions: [
          { type: 'click', target: '[data-guide="save"]' },
          {
            type: 'state',
            check: (context: TutorialContext) => (context as DemoTutorialContext).saveStatus === 'success',
          },
        ],
      },
    },
  ]
}
