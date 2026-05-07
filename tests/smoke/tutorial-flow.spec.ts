import { expect, test } from '@playwright/test'

const completionText = '教程完成：你已经完成了一个真实交互流程。'

test.describe('Vue demo tutorial smoke flow', () => {
  test('completes real interactions and restores tutorial state after refresh', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()

    const bubble = page.locator('.tutorial-bubble')
    const statePanel = page.locator('.state-panel')

    await page.getByRole('button', { name: '开始教程' }).click()
    await expect(bubble).toContainText('打开设置')
    await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()

    await page.locator('[data-guide="open-settings"]').click()
    await expect(page.locator('[data-guide="username"]')).toBeVisible()
    await expect(bubble).toContainText('输入用户名')
    await expect(statePanel).toContainText('enter-username')

    await page.locator('[data-guide="username"]').fill('smoke-user')
    await expect(bubble).toContainText('打开通知')
    await expect(statePanel).toContainText('enable-notifications')

    await page.reload()
    await expect(page.locator('[data-guide="username"]')).toHaveValue('smoke-user')
    await expect(bubble).toContainText('打开通知')
    await expect(statePanel).toContainText('enable-notifications')

    await page.getByRole('switch').click()
    await expect(bubble).toContainText('选择主题')
    await expect(statePanel).toContainText('choose-theme')

    await page.locator('[data-guide="theme"]').selectOption('contrast')
    await expect(bubble).toContainText('保存设置')
    await expect(statePanel).toContainText('save-settings')

    await page.locator('[data-guide="save"]').click()
    await expect(bubble).toContainText('教程完成')
    await expect(page.locator('.completion-message')).toContainText(completionText)
    await expect(statePanel).toContainText('success')

    await page.reload()
    await expect(bubble).toContainText('教程完成')
    await expect(page.locator('.completion-message')).toContainText(completionText)
  })
})
