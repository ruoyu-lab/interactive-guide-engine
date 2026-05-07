import type { TutorialContext, TutorialStep } from '@guide/engine'

export type DemoTutorialContext = TutorialContext & {
  notificationsEnabled: boolean
  theme: string
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
      content: '在用户名输入框里输入任意非空内容。',
      target: '[data-guide="username"]',
      placement: 'right',
      waitFor: { type: 'input', target: '[data-guide="username"]', value: /\S+/ },
    },
    {
      id: 'enable-notifications',
      title: '打开通知',
      content: '打开通知开关。引擎会通过外部状态检查确认这一步是否完成。',
      target: '[data-guide="notifications"]',
      placement: 'right',
      waitFor: {
        type: 'state',
        check: (context: TutorialContext) => Boolean((context as DemoTutorialContext).notificationsEnabled),
      },
    },
    {
      id: 'choose-theme',
      title: '选择主题',
      content: '将主题从默认值切换到任意其他选项。',
      target: '[data-guide="theme"]',
      placement: 'right',
      waitFor: {
        type: 'state',
        check: (context: TutorialContext) => (context as DemoTutorialContext).theme !== 'default',
      },
    },
    {
      id: 'save-settings',
      title: '保存设置',
      content: '点击保存按钮，等待保存状态变成 success。',
      target: '[data-guide="save"]',
      placement: 'top',
      waitFor: {
        type: 'state',
        check: (context: TutorialContext) => (context as DemoTutorialContext).saveStatus === 'success',
      },
    },
  ]
}
