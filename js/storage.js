/**
 * Shift Master - Storage & Settings Module
 * 完全オフライン対応のLocalStorage / データ永続化・Param自動生成管理
 */

const STORAGE_KEYS = {
  WISHES: 'shiftmaster_wishes_v1',
  CONFIRMED: 'shiftmaster_confirmed_v1',
  SETTINGS: 'shiftmaster_settings_v1'
};

const DEFAULT_SETTINGS = {
  storeCode: '02006',        // 店舗番号
  employeeId: '5155517',      // 社員番号
  param: '02006|5155517',     // 自動生成: 店舗番号|社員番号
  baseRate: 1300,             // 通常時給 (10:00〜22:00)
  lateRate: 1625,             // 深夜時給 (22:00〜29:00 / 25%割増)
  templates: {
    early: { name: '早番', start: '10:00', end: '15:00', breakMins: 0, color: '#0284c7' },
    late: { name: '遅番', start: '17:00', end: '22:00', breakMins: 0, color: '#f59e0b' },
    last: { name: 'ラスト', start: '18:00', end: '23:30', breakMins: 0, color: '#8b5cf6' },
    off: { name: '休み', start: '', end: '', breakMins: 0, color: '#94a3b8' }
  }
};

class ShiftStorage {
  constructor() {
    this.listeners = [];
  }

  // 変更通知リスナー登録
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('Listener error:', err);
      }
    });
  }

  // 設定の取得
  getSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!saved) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(saved);
      // 新しいフィールドがあればマージ
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        templates: { ...DEFAULT_SETTINGS.templates, ...(parsed.templates || {}) }
      };
    } catch (e) {
      console.warn('Failed to load settings, using default', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  // 設定の保存（Param を自動生成）
  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };

    // 店舗番号と社員番号から Param を自動生成（仕様: Param=店舗番号|社員番号）
    const store = (updated.storeCode || '').trim();
    const emp = (updated.employeeId || '').trim();
    updated.param = `${store}|${emp}`;

    // 時給の数値化
    updated.baseRate = parseInt(updated.baseRate, 10) || 1300;
    // 深夜時給の自動追従（指定がなければ25%増し）
    if (!newSettings.lateRate) {
      updated.lateRate = Math.round(updated.baseRate * 1.25);
    } else {
      updated.lateRate = parseInt(updated.lateRate, 10) || Math.round(updated.baseRate * 1.25);
    }

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.notify('settings_changed', updated);
    return updated;
  }

  // --- 希望シフト管理 ---

  getWishes() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WISHES);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Failed to load wishes', e);
      return {};
    }
  }

  getWish(dateStr) {
    const wishes = this.getWishes();
    return wishes[dateStr] || null;
  }

  saveWish(dateStr, shiftData) {
    const wishes = this.getWishes();
    if (!shiftData) {
      delete wishes[dateStr];
    } else {
      wishes[dateStr] = {
        date: dateStr,
        type: shiftData.type || 'カスタム',
        start: shiftData.start || '',
        end: shiftData.end || '',
        breakMins: parseInt(shiftData.breakMins, 10) || 0,
        note: shiftData.note || '',
        updatedAt: new Date().toISOString()
      };
    }
    localStorage.setItem(STORAGE_KEYS.WISHES, JSON.stringify(wishes));
    this.notify('wishes_changed', wishes);
  }

  // 複数日の一括希望シフト登録
  saveWishesBatch(dates, shiftData) {
    const wishes = this.getWishes();
    dates.forEach(dateStr => {
      if (!shiftData) {
        delete wishes[dateStr];
      } else {
        wishes[dateStr] = {
          date: dateStr,
          type: shiftData.type || 'カスタム',
          start: shiftData.start || '',
          end: shiftData.end || '',
          breakMins: parseInt(shiftData.breakMins, 10) || 0,
          note: shiftData.note || '',
          updatedAt: new Date().toISOString()
        };
      }
    });
    localStorage.setItem(STORAGE_KEYS.WISHES, JSON.stringify(wishes));
    this.notify('wishes_changed', wishes);
  }

  deleteWish(dateStr) {
    this.saveWish(dateStr, null);
  }

  // --- 確定シフト管理 ---

  getConfirmed() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIRMED);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Failed to load confirmed', e);
      return {};
    }
  }

  getConfirmedShift(dateStr) {
    const confirmed = this.getConfirmed();
    return confirmed[dateStr] || null;
  }

  saveConfirmedShift(dateStr, shiftData) {
    const confirmed = this.getConfirmed();
    const settings = this.getSettings();

    if (!shiftData) {
      delete confirmed[dateStr];
    } else {
      confirmed[dateStr] = {
        date: dateStr,
        type: shiftData.type || '確定勤務',
        start: shiftData.start || '',
        end: shiftData.end || '',
        breakMins: parseInt(shiftData.breakMins, 10) || 0,
        baseRate: parseInt(shiftData.baseRate, 10) || settings.baseRate,
        lateRate: parseInt(shiftData.lateRate, 10) || settings.lateRate,
        note: shiftData.note || '',
        updatedAt: new Date().toISOString()
      };
    }
    localStorage.setItem(STORAGE_KEYS.CONFIRMED, JSON.stringify(confirmed));
    this.notify('confirmed_changed', confirmed);
  }

  deleteConfirmedShift(dateStr) {
    this.saveConfirmedShift(dateStr, null);
  }

  // 希望シフトから確定シフトへ一括コピー（対象月または全件）
  copyWishesToConfirmed(targetYearMonth = null) {
    const wishes = this.getWishes();
    const confirmed = this.getConfirmed();
    const settings = this.getSettings();
    let count = 0;

    Object.entries(wishes).forEach(([dateStr, wish]) => {
      // 休みシフトはスキップ、または日付条件チェック
      if (wish.type === '休み' || !wish.start || !wish.end) return;
      if (targetYearMonth && !dateStr.startsWith(targetYearMonth)) return;

      confirmed[dateStr] = {
        date: dateStr,
        type: wish.type,
        start: wish.start,
        end: wish.end,
        breakMins: wish.breakMins || 0,
        baseRate: settings.baseRate,
        lateRate: settings.lateRate,
        note: wish.note || '',
        updatedAt: new Date().toISOString()
      };
      count++;
    });

    localStorage.setItem(STORAGE_KEYS.CONFIRMED, JSON.stringify(confirmed));
    this.notify('confirmed_changed', confirmed);
    return count;
  }

  // --- バックアップ & 復元 ---

  exportData() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      wishes: this.getWishes(),
      confirmed: this.getConfirmed()
    }, null, 2);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      if (data.wishes) localStorage.setItem(STORAGE_KEYS.WISHES, JSON.stringify(data.wishes));
      if (data.confirmed) localStorage.setItem(STORAGE_KEYS.CONFIRMED, JSON.stringify(data.confirmed));
      this.notify('data_imported', data);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  clearAll() {
    localStorage.removeItem(STORAGE_KEYS.WISHES);
    localStorage.removeItem(STORAGE_KEYS.CONFIRMED);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    this.notify('data_cleared', null);
  }
}

// グローバルインスタンス
window.shiftStorage = new ShiftStorage();
