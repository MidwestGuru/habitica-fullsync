
const { Plugin, Notice, Setting } = require('obsidian');
const crypto = require('crypto');

// --- Habitica API Client ---
class HabiticaApiClient {
  constructor(apiUser, apiToken) {
    this.apiUser = apiUser;
    this.apiToken = apiToken;
    this.baseUrl = 'https://habitica.com/api/v3';
    this.headers = {
      'x-api-user': apiUser,
      'x-api-key': apiToken,
      'x-client': 'habitica-fullsync-js',
      'Content-Type': 'application/json'
    };
  }

  async rateLimitedFetch(url, options = {}, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const resetHeader = res.headers.get('X-RateLimit-Reset');
        const reset = Number.isFinite(parseInt(resetHeader)) ? parseInt(resetHeader) : Math.ceil(delay / 1000);
        await new Promise(r => setTimeout(r, reset * 1000));
        delay *= 2;
        continue;
      }
      return res;
    }
    throw new Error('Max retries reached for ' + url);
  }

  async fetchUserTasks() {
    const res = await this.rateLimitedFetch(`${this.baseUrl}/tasks/user`, { headers: this.headers });
    return (await res.json()).data;
  }

  async fetchTags() {
    const res = await this.rateLimitedFetch(`${this.baseUrl}/tags`, { headers: this.headers });
    return (await res.json()).data;
  }

  async fetchGroupTasks(groupId) {
    const res = await this.rateLimitedFetch(`${this.baseUrl}/tasks/group/${groupId}`, { headers: this.headers });
    return (await res.json()).data;
  }

  async createTask(text) {
    const res = await this.rateLimitedFetch(`${this.baseUrl}/tasks/user`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ text, type: 'todo', notes: 'Created from Obsidian' })
    });
    return (await res.json()).data;
  }

  async scoreTask(id, direction) {
    return await this.rateLimitedFetch(`${this.baseUrl}/tasks/${id}/score/${direction}`, {
      method: 'POST',
      headers: this.headers
    });
  }
}

// --- Vault Handler ---
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class VaultHandler {
  constructor(app) {
    this.app = app;
  }

  async getRecentCompletedTasks(cutoffDate) {
    const completedTasks = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (file.stat.mtime < cutoffDate.getTime()) continue;
      const content = await this.app.vault.read(file);
      for (const line of content.split('\n')) {
        if (!line.startsWith('- [x]')) continue;
        if (line.includes('%%scored%%')) continue;
        const completionMatch = line.match(/\[completion:: (\d{4}-\d{2}-\d{2})\]/);
        if (!completionMatch) continue;
        const completionDate = new Date(completionMatch[1]);
        if (completionDate >= cutoffDate) {
          completedTasks.push({ line, file });
        }
      }
    }
    return completedTasks;
  }

  async updateLine(file, newLine) {
    const content = await this.app.vault.read(file);
    const updated = content.replace(new RegExp(`^${escapeRegExp(newLine.split(' [id::')[0])}.*$`, 'm'), newLine);
    await this.app.vault.modify(file, updated);
  }

  async ensureFolder(folderPath) {
    if (!folderPath) return;
    const folderExists = await this.app.vault.adapter.exists(folderPath);
    if (!folderExists) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  async writeFile(filePath, content) {
    await this.app.vault.adapter.write(filePath, content);
  }
}

// --- Sync Manager ---
class SyncManager {
  constructor(apiClient, vaultHandler, settings, noticeFn) {
    this.apiClient = apiClient;
    this.vaultHandler = vaultHandler;
    this.settings = settings;
    this.noticeFn = noticeFn;
  }

  async sync() {
    const { groupId, outputFolder, disableScoring, disableCreating } = this.settings;
    const TODAY = new Date().toLocaleDateString('en-CA');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 4);

    try {
      const tasks = await this.apiClient.fetchUserTasks();
      const tags = await this.apiClient.fetchTags();
      const tagLookup = Object.fromEntries(tags.map(tag => [tag.id, tag.name]));
      let groupTasks = [];
      if (groupId) {
        try {
          groupTasks = await this.apiClient.fetchGroupTasks(groupId);
        } catch (err) {
          console.error('Failed to fetch group tasks:', err);
        }
      }
      const allTasks = [...tasks, ...groupTasks];

      // Track scored task IDs
      const scoredIds = new Set();

      // Score completed tasks (only if scoring is enabled)
      if (!disableScoring) {
        const completedTasks = await this.vaultHandler.getRecentCompletedTasks(cutoffDate);
        for (const task of completedTasks) {
          const match = task.line.match(/\[id:: ([^\]]+)\]/);
          if (match) {
            const id = match[1];
            const habiticaTask = allTasks.find(t => t.id === id);
            if (!habiticaTask || habiticaTask.completed) continue;
            let direction = 'up';
            if (habiticaTask.type === 'habit') {
              direction = habiticaTask.up ? 'up' : habiticaTask.down ? 'down' : 'up';
            }
            await this.apiClient.scoreTask(id, direction);
            scoredIds.add(id);
            await this.vaultHandler.updateLine(task.file, task.line + ' %%scored%%');
          } else if (!disableCreating) {
            // Only create new tasks if allowed
            const text = task.line.replace(/^- \[x\]\s*/, '').split(' [')[0];
            try {
              const newTask = await this.apiClient.createTask(text);
              await this.apiClient.scoreTask(newTask.id, 'up');
              scoredIds.add(newTask.id);
              const newLine = task.line + ` [id:: ${newTask.id}] %%scored%%`;
              await this.vaultHandler.updateLine(task.file, newLine);
            } catch (err) {
              console.error('Failed to create and score new task:', err);
            }
          }
        }
      }

      // Prepare output
      const filterActive = (list, type) =>
        list.filter(t => t.type === type && !t.completed && !scoredIds.has(t.id));

      const dailiesPersonal = filterActive(tasks, 'daily');
      const todosPersonal = filterActive(tasks, 'todo');
      const rewardsPersonal = filterActive(tasks, 'reward');
      const habitsPersonal = filterActive(tasks, 'habit');
      const dailiesGroup = filterActive(groupTasks, 'daily');
      const todosGroup = filterActive(groupTasks, 'todo');
      const rewardsGroup = filterActive(groupTasks, 'reward');
      const habitsGroup = filterActive(groupTasks, 'habit');

      const output = [`## Habitica Sync - ${TODAY}`, `**Summary:** ${allTasks.length} tasks synced.`];

      const writeSection = (title, personal, group) => {
        output.push(`### ${title}`);
        output.push('#### Personal Tasks');
        output.push(...formatTasks(personal));
        output.push('');
        output.push('#### Group Tasks');
        output.push(...formatTasks(group));
        output.push('');
      };

      const formatTasks = (taskList) => {
        if (!taskList.length) return ['_No tasks found._'];
        return taskList.map(task => formatTaskLine(task));
      };

      const formatTaskLine = (task) => {
        const status = task.completed ? 'x' : ' ';
        const tags = task.tags.map(id => `#${tagLookup[id] || 'unknown'}`);
        if (task.type === 'daily') tags.push('#daily');
        if (task.type === 'habit') tags.push('#habit');
        if (task.type === 'reward') tags.push('#reward');
        const priorityMap = { 2: 'high', 1.5: 'medium', 1: 'low', 0.1: 'lowest' };
        const priority = priorityMap[task.priority] || 'Unknown';
        const notesPart = task.notes
          ? ` (${task.notes.replace(/(\r\n|\n|\r)/g, '; ').trim()})`
          : '';
        let line = `- [${status}] ${task.text}${notesPart} ${tags.join(' ')} [id:: ${task.id}] [priority:: ${priority}]`;
        if (task.type === 'todo' && task.date) {
          line += ` [due:: ${new Date(task.date).toLocaleDateString('en-CA')}]`;
        }
        if (task.type === 'daily') {
          const dueDate = getNextDailyDueDate(task);
          if (dueDate) line += ` [due:: ${dueDate}]`;
        }
        if (task.completed && task.type !== 'habit') {
          line += ` [completion:: ${TODAY}]`;
        }
        return line;
      };

      const getNextDailyDueDate = (task) => {
        try {
          const start = new Date(task.startDate);
          const today = new Date();
          const freq = task.frequency;
          const everyX = task.everyX || 1;
          let baseDate = start > today ? new Date(start) : new Date(today);
          if (freq === 'daily') {
            while (baseDate < start) {
              baseDate.setDate(baseDate.getDate() + everyX);
            }
            return baseDate.toLocaleDateString('en-CA');
          }
          if (freq === 'weekly' && task.repeat) {
            const repeatDays = task.repeat;
            const weekdayKeys = ['su', 'm', 't', 'w', 'th', 'f', 's'];
            for (let i = 0; i < 30; i++) {
              const check = new Date(baseDate);
              check.setDate(baseDate.getDate() + i);
              const key = weekdayKeys[check.getDay()];
              if (repeatDays[key] && check >= start) {
                return check.toLocaleDateString('en-CA');
              }
            }
          }
          return null;
        } catch (err) {
          console.error('Error calculating daily due date:', err);
          return null;
        }
      };

      writeSection('Dailies', dailiesPersonal, dailiesGroup);
      writeSection('To-Dos', todosPersonal, todosGroup);
      writeSection('Rewards', rewardsPersonal, rewardsGroup);
      writeSection('Habits', habitsPersonal, habitsGroup);

      await this.vaultHandler.ensureFolder(outputFolder);
      const filePath = outputFolder ? `${outputFolder}/habitica-fullsync.md` : 'habitica-fullsync.md';
      await this.vaultHandler.writeFile(filePath, output.join('\n'));

      this.noticeFn(`✅ Habitica sync complete: ${filePath}`);
    } catch (err) {
      console.error('Habitica sync failed:', err);
      this.noticeFn('❌ Habitica sync failed. Check console for details.');
    }
  }
}

// --- Platform Detection ---
function isMobilePlatform() {
  return !!window?.isMobile || !!window?.cordova;
}

// --- Main Plugin ---
class HabiticaSyncFullPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.apiClient = new HabiticaApiClient(this.settings.apiUser, this.settings.apiToken);
    this.vaultHandler = new VaultHandler(this.app);
    this.syncManager = new SyncManager(
      this.apiClient,
      this.vaultHandler,
      this.settings,
      msg => new Notice(msg)
    );

    this.addCommand({
      id: 'sync-habitica',
      name: 'Sync Habitica Tasks',
      callback: () => this.syncHabitica()
    });

    this.addSettingTab(new HabiticaSyncSettingTab(this.app, this));

    // --- Auto Sync Platform Logic ---
    const platformSetting = this.settings.autoSyncPlatform || 'both';
    const isMobile = isMobilePlatform();

    let shouldAutoSync = false;
    if (platformSetting === 'both') shouldAutoSync = true;
    else if (platformSetting === 'desktop' && !isMobile) shouldAutoSync = true;
    else if (platformSetting === 'mobile' && isMobile) shouldAutoSync = true;

    if (this.settings.autoSync && shouldAutoSync) {
      this.syncHabitica();
      const intervalMs = this.settings.syncInterval * 60 * 1000;
      this.autoSyncInterval = setInterval(() => this.syncHabitica(), intervalMs);
    }
  }

  onunload() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({
      apiUser: '',
      apiToken: '',
      groupId: '',
      outputFolder: '',
      autoSync: false,
      autoSyncPlatform: 'both',
      syncInterval: 30, // default 30 minutes
      disableScoring: false, // new setting
      disableCreating: false, // new setting
      machineId: ''
    }, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async syncHabitica() {
    await this.syncManager.sync();
  }
}

class HabiticaSyncSettingTab extends require('obsidian').PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Habitica Sync Settings' });

    new Setting(containerEl)
      .setName('API User')
      .setDesc('Your Habitica API User ID')
      .addText(text => text
        .setPlaceholder('Enter API User')
        .setValue(this.plugin.settings.apiUser)
        .onChange(async (value) => {
          this.plugin.settings.apiUser = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('API Token')
      .setDesc('Your Habitica API Token (stored in plain text; do not share your vault)')
      .addText(text => text
        .setPlaceholder('Enter API Token')
        .setValue(this.plugin.settings.apiToken)
        .onChange(async (value) => {
          this.plugin.settings.apiToken = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Group ID')
      .setDesc('Your Habitica Group ID for shared tasks')
      .addText(text => text
        .setPlaceholder('Enter Group ID')
        .setValue(this.plugin.settings.groupId)
        .onChange(async (value) => {
          this.plugin.settings.groupId = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Output Folder')
      .setDesc('Folder where habitica-fullsync.md will be saved (leave blank for vault root)')
      .addText(text => text
        .setPlaceholder('e.g., Habitica')
        .setValue(this.plugin.settings.outputFolder)
        .onChange(async (value) => {
          this.plugin.settings.outputFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Automatic Sync')
      .setDesc('Enable automatic sync on load and every X minutes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto Sync Platform')
      .setDesc('Choose which devices should run auto sync')
      .addDropdown(dropdown => {
        dropdown
          .addOption('both', 'Both Desktop and Mobile')
          .addOption('desktop', 'Desktop Only')
          .addOption('mobile', 'Mobile Only')
          .setValue(this.plugin.settings.autoSyncPlatform || 'both')
          .onChange(async (value) => {
            this.plugin.settings.autoSyncPlatform = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Sync Interval (minutes)')
      .setDesc('How often to run auto-sync when enabled')
      .addText(text => text
        .setPlaceholder('e.g., 30')
        .setValue(String(this.plugin.settings.syncInterval))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.syncInterval = num;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Disable Scoring')
      .setDesc('Enable this to prevent scoring tasks in Habitica (read-only sync)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.disableScoring)
        .onChange(async (value) => {
          this.plugin.settings.disableScoring = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Disable Creating New Tasks')
      .setDesc('Enable this to prevent creating new tasks in Habitica from non-habitica tasks completed in Obsidian')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.disableCreating)
        .onChange(async (value) => {
          this.plugin.settings.disableCreating = value;
          await this.plugin.saveSettings();
        }));
  }
}

module.exports = HabiticaSyncFullPlugin;
