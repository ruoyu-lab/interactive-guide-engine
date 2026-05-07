import { expect, type Page, test } from '@playwright/test'

const completionText = '教程完成：你已经完成了一个真实交互流程。'

test.describe('Vue demo tutorial smoke flow', () => {
  async function startUsernameStep(page: Page) {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()

    await page.getByRole('button', { name: '开始教程' }).click()
    await page.locator('[data-guide="open-settings"]').click()
    await expect(page.locator('.tutorial-bubble')).toContainText('输入用户名')
  }

  test('completes real interactions and restores tutorial state after refresh', async ({ page }) => {
    const bubble = page.locator('.tutorial-bubble')
    const statePanel = page.locator('.state-panel')

    await startUsernameStep(page)
    await expect(page.locator('[data-guide="username"]')).toBeVisible()
    await expect(statePanel).toContainText('enter-username')

    await page.locator('[data-guide="username"]').fill('wrong-user')
    await expect(bubble).toContainText('输入用户名')
    await expect(statePanel).toContainText('enter-username')

    await page.locator('[data-guide="username"]').fill('guide-user')
    await expect(bubble).toContainText('打开通知')
    await expect(statePanel).toContainText('enable-notifications')

    await page.reload()
    await expect(page.locator('[data-guide="username"]')).toHaveValue('guide-user')
    await expect(bubble).toContainText('打开通知')
    await expect(statePanel).toContainText('enable-notifications')

    await page.getByRole('switch').click()
    await expect(bubble).toContainText('选择主题')
    await expect(statePanel).toContainText('choose-theme')

    await page.locator('[data-guide="theme"]').selectOption('contrast')
    await expect(bubble).toContainText('拖放卡片')
    await expect(statePanel).toContainText('place-card')

    await page.locator('[data-guide="drag-card"]').dragTo(page.locator('[data-guide="drop-zone"]'))
    await expect(page.locator('[data-guide="drop-zone"]')).toContainText('已放置')
    await expect(statePanel).toContainText('dragPlaced')
    await expect(statePanel).toContainText('true')
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

  test('skips the username step when the input loses focus', async ({ page }) => {
    const bubble = page.locator('.tutorial-bubble')
    const statePanel = page.locator('.state-panel')

    await startUsernameStep(page)
    await page.locator('[data-guide="username"]').fill('wrong-user')
    await expect(bubble).toContainText('输入用户名')

    await page.locator('[data-guide="theme"]').focus()
    await expect(bubble).toContainText('打开通知')
    await expect(statePanel).toContainText('enable-notifications')
  })
})
