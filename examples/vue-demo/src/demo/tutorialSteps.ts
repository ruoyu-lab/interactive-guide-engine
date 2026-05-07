import type { TutorialContext, TutorialStep } from '@guide/engine'

export type DemoTutorialContext = TutorialContext & {
  notificationsEnabled: boolean
  theme: string
  dragPlaced: boolean
  saveStatus: string
}

export function createDemoTutorialSteps(): TutorialStep[] {
  return [
    {
      id: 'open-settings',
      title: '打开设置',
      content: '点击“打开设置”按钮，进入示例设置流程。',
      target: '[data-guide="open-settings"]',
      placement: 'bottom',
      waitFor: { type: 'click', target: '[data-guide="open-settings"]' },
    },
    {
      id: 'enter-username',
      title: '输入用户名',
      content: '输入 guide-user 会进入下一步；如果离开输入框，也会跳过这个输入步骤。',
      target: '[data-guide="username"]',
      placement: 'right',
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
      waitFor: { type: 'change', target: '[data-guide="notifications"] input', value: true },
    },
    {
      id: 'choose-theme',
      title: '选择主题',
      content: '将主题从默认值切换到任意其他选项。',
      target: '[data-guide="theme"]',
      placement: 'right',
      waitFor: { type: 'change', target: '[data-guide="theme"]', value: /^(?!default$).+/ },
    },
    {
      id: 'place-card',
      title: '拖放卡片',
      content: '把操作卡片拖到投放区。DOM adapter 会监听 dragstart 和 drop。',
      target: '[data-guide="drop-zone"]',
      placement: 'top',
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
