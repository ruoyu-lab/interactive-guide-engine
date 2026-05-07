<template>
  <main class="app-shell">
    <section class="intro">
      <div>
        <p class="eyebrow">Universal Interactive Guide Engine</p>
        <h1>Interactive Guide Engine Demo</h1>
        <p class="intro-copy">
          一个等待用户完成真实操作后才自动推进的最小教程引擎 demo。
        </p>
      </div>

      <div class="top-actions">
        <button type="button" class="button primary" @click="startTutorial">开始教程</button>
        <button type="button" class="button secondary" @click="resetTutorial">重置教程</button>
      </div>
    </section>

    <section class="workspace">
      <div class="settings-card">
        <div class="card-header">
          <div>
            <h2>示例设置卡片</h2>
            <p>使用下方控件完成一次真实的设置流程。</p>
          </div>
          <button
            type="button"
            class="button secondary"
            data-guide="open-settings"
            @click="openSettings"
          >
            打开设置
          </button>
        </div>

        <div v-if="demoState.settingsOpen" class="settings-panel">
          <label class="field">
            <span>用户名</span>
            <input
              v-model.trim="demoState.username"
              data-guide="username"
              type="text"
              placeholder="输入 guide-user，或离开输入框"
            />
          </label>

          <label class="switch-row" data-guide="notifications">
            <span>
              <strong>通知开关</strong>
              <small>{{ demoState.notificationsEnabled ? '已开启' : '已关闭' }}</small>
            </span>
            <input v-model="demoState.notificationsEnabled" type="checkbox" role="switch" />
          </label>

          <label class="field">
            <span>主题</span>
            <select v-model="demoState.theme" data-guide="theme">
              <option value="default">默认主题</option>
              <option value="light">明亮主题</option>
              <option value="contrast">高对比主题</option>
              <option value="calm">舒缓主题</option>
            </select>
          </label>

          <div class="drag-workbench">
            <div>
              <h3>拖放任务</h3>
              <p>把操作卡片拖到投放区。</p>
            </div>

            <div class="drag-row">
              <div
                class="drag-card"
                :class="{ placed: demoState.dragPlaced }"
                data-guide="drag-card"
                draggable="true"
                @dragstart="handleDragStart"
              >
                操作卡片
              </div>

              <div
                class="drop-zone"
                :class="{ active: demoState.dragPlaced }"
                data-guide="drop-zone"
                @dragover.prevent
                @drop.prevent="handleDrop"
              >
                {{ demoState.dragPlaced ? '已放置' : '拖到这里' }}
              </div>
            </div>
          </div>

          <button type="button" class="button primary save-button" data-guide="save" @click="saveSettings">
            保存
          </button>
        </div>

        <p v-else class="empty-panel">设置面板尚未打开。</p>
      </div>

      <aside class="state-panel">
        <h2>当前 demo 状态</h2>
        <dl>
          <div>
            <dt>tutorialStatus</dt>
            <dd>{{ tutorialStatus }}</dd>
          </div>
          <div>
            <dt>currentStep</dt>
            <dd>{{ currentStepId }}</dd>
          </div>
          <div>
            <dt>settingsOpen</dt>
            <dd>{{ String(demoState.settingsOpen) }}</dd>
          </div>
          <div>
            <dt>username</dt>
            <dd>{{ demoState.username || '(empty)' }}</dd>
          </div>
          <div>
            <dt>notifications</dt>
            <dd>{{ demoState.notificationsEnabled ? 'enabled（已开启）' : 'disabled（已关闭）' }}</dd>
          </div>
          <div>
            <dt>theme</dt>
            <dd>{{ demoState.theme }}</dd>
          </div>
          <div>
            <dt>dragPlaced</dt>
            <dd>{{ String(demoState.dragPlaced) }}</dd>
          </div>
          <div>
            <dt>saveStatus</dt>
            <dd>{{ demoState.saveStatus }}</dd>
          </div>
        </dl>

        <p v-if="tutorialStatus === 'completed'" class="completion-message">
          教程完成：你已经完成了一个真实交互流程。
        </p>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { TutorialEngine, type TutorialSnapshot } from '@guide/engine'
import { createDomConditionHandlers } from '@guide/dom-adapter'
import { DomTutorialRenderer } from '@guide/dom-renderer'
import { createDemoTutorialSteps, type DemoTutorialContext } from './demo/tutorialSteps'

type DemoState = {
  settingsOpen: boolean
  username: string
  notificationsEnabled: boolean
  theme: string
  dragPlaced: boolean
  saveStatus: 'idle' | 'success'
}

const demoStateStorageKey = 'interactive-guide-demo-state'

const defaultDemoState = (): DemoState => ({
  settingsOpen: false,
  username: '',
  notificationsEnabled: false,
  theme: 'default',
  dragPlaced: false,
  saveStatus: 'idle',
})

const demoState = reactive<DemoState>(loadDemoState())
const snapshot = ref<TutorialSnapshot>()

let engine: TutorialEngine | undefined
let renderer: DomTutorialRenderer | undefined
let unsubscribeEngine: (() => void) | undefined

const tutorialStatus = computed(() => snapshot.value?.status ?? 'idle')
const currentStepId = computed(() => snapshot.value?.currentStep?.id ?? '(none)')

onMounted(() => {
  engine = new TutorialEngine({
    id: 'settings-demo',
    steps: createDemoTutorialSteps(),
    context: createTutorialContext(),
    conditionHandlers: createDomConditionHandlers(),
  })

  unsubscribeEngine = engine.onChange((nextSnapshot) => {
    snapshot.value = nextSnapshot
  })

  renderer = new DomTutorialRenderer(engine, {
    completedTitle: '教程完成',
    completedContent: '教程完成：你已经完成了一个真实交互流程。',
  })

  engine.updateContext(createTutorialContext())
})

onBeforeUnmount(() => {
  unsubscribeEngine?.()
  renderer?.destroy()
  engine?.destroy()
})

watch(
  demoState,
  () => {
    window.localStorage.setItem(demoStateStorageKey, JSON.stringify(demoState))
    engine?.updateContext(createTutorialContext())
  },
  { deep: true },
)

function startTutorial(): void {
  engine?.start()
}

function resetTutorial(): void {
  Object.assign(demoState, defaultDemoState())
  window.localStorage.removeItem(demoStateStorageKey)
  engine?.reset()
}

function openSettings(): void {
  demoState.settingsOpen = true
}

function saveSettings(): void {
  demoState.saveStatus = 'success'
}

function handleDragStart(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', 'demo-action-card')
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleDrop(): void {
  demoState.dragPlaced = true
}

function createTutorialContext(): DemoTutorialContext {
  return {
    notificationsEnabled: demoState.notificationsEnabled,
    theme: demoState.theme,
    dragPlaced: demoState.dragPlaced,
    saveStatus: demoState.saveStatus,
  }
}

function loadDemoState(): DemoState {
  const rawState = window.localStorage.getItem(demoStateStorageKey)
  if (!rawState) {
    return defaultDemoState()
  }

  return {
    ...defaultDemoState(),
    ...(JSON.parse(rawState) as Partial<DemoState>),
  }
}
</script>
