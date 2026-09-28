/**
 * Shift Master - Main Application Controller
 * タブ管理、カレンダー制御、モーダル、給与サマリー更新、PWA初期化
 */

document.addEventListener('DOMContentLoaded', () => {
  const storage = window.shiftStorage;
  const foodit = new FoodITService(storage);

  // --- 状態変数 ---
  let activeTab = 'wishes'; // 'wishes', 'confirmed', 'settings'
  let wishCalendar = null;
  let confirmedCalendar = null;
  let currentEditingDate = null;
  let currentEditingMode = 'wish'; // 'wish' or 'confirmed'

  // --- UI 要素の参照 ---
  const tabWishes = document.getElementById('tab-wishes');
  const tabConfirmed = document.getElementById('tab-confirmed');
  const tabSettings = document.getElementById('tab-settings');
  const navBtns = document.querySelectorAll('.bottom-nav-item');

  // モーダル要素
  const shiftModal = document.getElementById('shift-modal');
  const shiftModalTitle = document.getElementById('shift-modal-title');
  const shiftModalDate = document.getElementById('shift-modal-date');
  const shiftForm = document.getElementById('shift-form');
  const inputStartTime = document.getElementById('input-start-time');
  const inputEndTime = document.getElementById('input-end-time');
  const inputBreakMins = document.getElementById('input-break-mins');
  const inputShiftNote = document.getElementById('input-shift-note');
  const btnDeleteShift = document.getElementById('btn-delete-shift');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // 一括登録バー（希望シフト用）
  const batchActionBar = document.getElementById('batch-action-bar');
  const batchSelectedCount = document.getElementById('batch-selected-count');
  const toggleMultiSelect = document.getElementById('toggle-multi-select');

  // 給与サマリー要素
  const summaryMonthEl = document.getElementById('summary-month');
  const summaryTotalSalaryEl = document.getElementById('summary-total-salary');
  const summaryDaysEl = document.getElementById('summary-days');
  const summaryTotalHoursEl = document.getElementById('summary-total-hours');
  const summaryNormalHoursEl = document.getElementById('summary-normal-hours');
  const summaryNormalSalaryEl = document.getElementById('summary-normal-salary');
  const summaryLateHoursEl = document.getElementById('summary-late-hours');
  const summaryLateSalaryEl = document.getElementById('summary-late-salary');
  const confirmedListContainer = document.getElementById('confirmed-list-container');

  // 設定フォーム要素
  const inputStoreCode = document.getElementById('setting-store-code');
  const inputEmployeeId = document.getElementById('setting-employee-id');
  const previewParam = document.getElementById('preview-param');
  const inputBaseRate = document.getElementById('setting-base-rate');
  const inputLateRate = document.getElementById('setting-late-rate');
  const formSettings = document.getElementById('form-settings');

  // FoodIT モーダル要素
  const fooditModal = document.getElementById('foodit-modal');
  const btnOpenFoodit = document.getElementById('btn-open-foodit');
  const btnCloseFoodit = document.getElementById('btn-close-foodit');
  const fooditStoreDisplay = document.getElementById('foodit-store-display');
  const fooditParamDisplay = document.getElementById('foodit-param-display');
  const fooditCountDisplay = document.getElementById('foodit-count-display');
  const fooditSummaryText = document.getElementById('foodit-summary-text');
  const btnFooditPost = document.getElementById('btn-foodit-post');
  const btnFooditOpenWeb = document.getElementById('btn-foodit-open-web');
  const btnFooditCopy = document.getElementById('btn-foodit-copy');

  // --- トースト通知 ---
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }

  // --- タブ切り替え ---
  function switchTab(tabName) {
    activeTab = tabName;

    // タブの表示/非表示
    tabWishes.classList.toggle('active', tabName === 'wishes');
    tabConfirmed.classList.toggle('active', tabName === 'confirmed');
    tabSettings.classList.toggle('active', tabName === 'settings');

    // ナビゲーションのハイライト
    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // タブごとのレンダリング
    if (tabName === 'wishes') {
      if (wishCalendar) wishCalendar.render();
    } else if (tabName === 'confirmed') {
      if (confirmedCalendar) confirmedCalendar.render();
      updateSalarySummary();
    } else if (tabName === 'settings') {
      loadSettingsToUI();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // --- 希望シフトカレンダー初期化 ---
  wishCalendar = new ShiftCalendar({
    containerId: 'wish-calendar-container',
    mode: 'wish',
    storage,
    onDateClick: (dateStr) => {
      openShiftModal('wish', dateStr);
    },
    onBatchSelectChange: (selectedDates) => {
      if (selectedDates.length > 0) {
        batchActionBar.classList.add('show');
        batchSelectedCount.textContent = `${selectedDates.length}日選択中`;
      } else {
        batchActionBar.classList.remove('show');
      }
    }
  });
  wishCalendar.render();

  // 複数選択トグルスイッチ
  if (toggleMultiSelect) {
    toggleMultiSelect.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      wishCalendar.setMultiSelectMode(enabled);
      if (!enabled) {
        batchActionBar.classList.remove('show');
      }
    });
  }

  // 一括適用ボタン（早番、遅番、ラスト、休み）
  const batchEarlyBtn = document.getElementById('batch-apply-early');
  const batchLateBtn = document.getElementById('batch-apply-late');
  const batchLastBtn = document.getElementById('batch-apply-last');
  const batchOffBtn = document.getElementById('batch-apply-off');
  const batchCancelBtn = document.getElementById('batch-cancel');

  function applyBatchTemplate(typeKey) {
    const dates = Array.from(wishCalendar.selectedDates);
    if (dates.length === 0) {
      showToast('日付が選択されていません', 'warning');
      return;
    }
    const settings = storage.getSettings();
    const tpl = settings.templates[typeKey];

    if (typeKey === 'off') {
      storage.saveWishesBatch(dates, { type: '休み', start: '', end: '', breakMins: 0 });
    } else if (tpl) {
      storage.saveWishesBatch(dates, {
        type: tpl.name,
        start: tpl.start,
        end: tpl.end,
        breakMins: tpl.breakMins || 0
      });
    }

    showToast(`選択した${dates.length}日間に「${tpl ? tpl.name : 'シフト'}」を一括設定しました`, 'success');
    wishCalendar.clearSelection();
    batchActionBar.classList.remove('show');
  }

  if (batchEarlyBtn) batchEarlyBtn.addEventListener('click', () => applyBatchTemplate('early'));
  if (batchLateBtn) batchLateBtn.addEventListener('click', () => applyBatchTemplate('late'));
  if (batchLastBtn) batchLastBtn.addEventListener('click', () => applyBatchTemplate('last'));
  if (batchOffBtn) batchOffBtn.addEventListener('click', () => applyBatchTemplate('off'));
  if (batchCancelBtn) {
    batchCancelBtn.addEventListener('click', () => {
      wishCalendar.clearSelection();
      batchActionBar.classList.remove('show');
    });
  }

  // --- 確定シフトカレンダー & 給与計算初期化 ---
  confirmedCalendar = new ShiftCalendar({
    containerId: 'confirmed-calendar-container',
    mode: 'confirmed',
    storage,
    onDateClick: (dateStr) => {
      openShiftModal('confirmed', dateStr);
    }
  });
  confirmedCalendar.render();

  // 希望シフトから確定シフトへの一括コピー
  const btnCopyWishes = document.getElementById('btn-copy-wishes');
  if (btnCopyWishes) {
    btnCopyWishes.addEventListener('click', () => {
      const currentYM = confirmedCalendar.getYearMonthString();
      const count = storage.copyWishesToConfirmed(currentYM);
      if (count > 0) {
        showToast(`${count} 件の希望シフトを確定シフトへ反映しました！`, 'success');
      } else {
        showToast('反映対象の希望シフトがありませんでした', 'info');
      }
      confirmedCalendar.render();
      updateSalarySummary();
    });
  }

  // --- 給与サマリー更新ロジック ---
  function updateSalarySummary() {
    const currentYM = confirmedCalendar ? confirmedCalendar.getYearMonthString() : '2026-10';
    const ymParts = currentYM.split('-');
    const year = ymParts[0];
    const month = parseInt(ymParts[1], 10);
    if (summaryMonthEl) summaryMonthEl.textContent = `${year}年${month}月`;

    const confirmedShifts = storage.getConfirmed();
    const settings = storage.getSettings();
    const summary = SalaryCalculator.calculateMonthlySummary(confirmedShifts, currentYM, settings);

    if (summaryTotalSalaryEl) {
      summaryTotalSalaryEl.textContent = `¥${summary.totalSalary.toLocaleString()}`;
    }
    if (summaryDaysEl) {
      summaryDaysEl.textContent = `${summary.workDaysCount}日`;
    }
    if (summaryTotalHoursEl) {
      summaryTotalHoursEl.textContent = summary.formattedTotalTime;
    }
    if (summaryNormalHoursEl) {
      summaryNormalHoursEl.textContent = summary.formattedNormalTime;
    }
    if (summaryNormalSalaryEl) {
      summaryNormalSalaryEl.textContent = `¥${summary.normalSalary.toLocaleString()}`;
    }
    if (summaryLateHoursEl) {
      summaryLateHoursEl.textContent = summary.formattedLateTime;
    }
    if (summaryLateSalaryEl) {
      summaryLateSalaryEl.textContent = `¥${summary.lateSalary.toLocaleString()}`;
    }

    // 確定シフトの一覧リスト（日別内訳）を描画
    renderConfirmedList(summary.dayBreakdowns);
  }

  function renderConfirmedList(breakdowns) {
    if (!confirmedListContainer) return;
    if (!breakdowns || breakdowns.length === 0) {
      confirmedListContainer.innerHTML = `
        <div class="empty-state">
          <p>確定したシフトはまだ登録されていません。</p>
          <p class="empty-sub">「希望シフトからコピー」を押すか、カレンダーの日付をタップして確定シフトを登録してください。</p>
        </div>
      `;
      return;
    }

    let html = '<div class="confirmed-items-list">';
    breakdowns.forEach(item => {
      const parts = item.date.split('-');
      const day = parseInt(parts[2], 10);
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(item.date).getDay()];
      const isWeekend = dayOfWeek === '日' || dayOfWeek === '土';

      html += `
        <div class="confirmed-item-card" data-date="${item.date}">
          <div class="item-date-badge ${isWeekend ? 'weekend' : ''}">
            <span class="item-day">${day}</span>
            <span class="item-dow">${dayOfWeek}</span>
          </div>
          <div class="item-details">
            <div class="item-title-row">
              <span class="item-type-badge">${item.type}</span>
              <span class="item-time-range">${item.start} 〜 ${item.end}</span>
              ${item.breakMinutes > 0 ? `<span class="item-break">(休${item.breakMinutes}分)</span>` : ''}
            </div>
            <div class="item-salary-breakdown">
              <span>通常: ${SalaryCalculator.formatMinutes(item.normalMinutes)} (¥${item.normalSalary.toLocaleString()})</span>
              ${item.lateMinutes > 0 ? `<span class="late-tag">深夜: ${SalaryCalculator.formatMinutes(item.lateMinutes)} (¥${item.lateSalary.toLocaleString()})</span>` : ''}
            </div>
          </div>
          <div class="item-total-salary">
            <span class="salary-num">¥${item.totalSalary.toLocaleString()}</span>
          </div>
        </div>
      `;
    });
    html += '</div>';

    confirmedListContainer.innerHTML = html;

    // リスト内のカードクリックで編集モーダルを開く
    confirmedListContainer.querySelectorAll('.confirmed-item-card').forEach(card => {
      card.addEventListener('click', () => {
        openShiftModal('confirmed', card.getAttribute('data-date'));
      });
    });
  }

  // --- シフト登録・編集モーダル ---
  function openShiftModal(mode, dateStr) {
    currentEditingMode = mode;
    currentEditingDate = dateStr;

    const parts = dateStr.split('-');
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(dateStr).getDay()];

    const isWish = mode === 'wish';
    shiftModalTitle.textContent = isWish ? '希望シフト登録' : '確定シフト管理';
    shiftModalDate.textContent = `${year}年${month}月${day}日 (${dayOfWeek})`;

    // 既存データの読み込み
    const existing = isWish ? storage.getWish(dateStr) : storage.getConfirmedShift(dateStr);

    if (existing) {
      inputStartTime.value = existing.start || '';
      inputEndTime.value = existing.end || '';
      inputBreakMins.value = existing.breakMins || 0;
      inputShiftNote.value = existing.note || '';
      btnDeleteShift.style.display = 'block';
    } else {
      inputStartTime.value = '';
      inputEndTime.value = '';
      inputBreakMins.value = 0;
      inputShiftNote.value = '';
      btnDeleteShift.style.display = 'none';
    }

    // 確定シフトのみ、給与プレビュー領域を表示
    const modalSalaryPreview = document.getElementById('modal-salary-preview');
    if (modalSalaryPreview) {
      modalSalaryPreview.style.display = isWish ? 'none' : 'block';
      updateModalSalaryPreview();
    }

    shiftModal.classList.add('show');
  }

  function closeShiftModal() {
    shiftModal.classList.remove('show');
    currentEditingDate = null;
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeShiftModal);
  shiftModal.addEventListener('click', (e) => {
    if (e.target === shiftModal) closeShiftModal();
  });

  // モーダル内の定型テンプレートボタン
  const modalTemplateBtns = document.querySelectorAll('.modal-tpl-btn');
  modalTemplateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const typeKey = btn.dataset.tpl;
      const settings = storage.getSettings();
      if (typeKey === 'off') {
        inputStartTime.value = '';
        inputEndTime.value = '';
        inputBreakMins.value = 0;
        inputShiftNote.value = '休み希望';
      } else {
        const tpl = settings.templates[typeKey];
        if (tpl) {
          inputStartTime.value = tpl.start;
          inputEndTime.value = tpl.end;
          inputBreakMins.value = tpl.breakMins || 0;
        }
      }
      updateModalSalaryPreview();
    });
  });

  // 時間入力変更時に給与プレビュー更新（確定シフト時）
  [inputStartTime, inputEndTime, inputBreakMins].forEach(input => {
    input.addEventListener('input', updateModalSalaryPreview);
  });

  function updateModalSalaryPreview() {
    if (currentEditingMode !== 'confirmed') return;
    const previewEl = document.getElementById('modal-salary-preview-text');
    if (!previewEl) return;

    const start = inputStartTime.value;
    const end = inputEndTime.value;
    const breakM = parseInt(inputBreakMins.value, 10) || 0;

    if (!start || !end) {
      previewEl.textContent = '勤務時間を入力すると自動算出されます';
      return;
    }

    const settings = storage.getSettings();
    const result = SalaryCalculator.calculateShift({
      startTime: start,
      endTime: end,
      breakMinutes: breakM,
      baseRate: settings.baseRate,
      lateRate: settings.lateRate
    });

    if (result.valid) {
      previewEl.innerHTML = `
        <strong>合計概算: ¥${result.totalSalary.toLocaleString()}</strong> 
        (通常 ${SalaryCalculator.formatMinutes(result.normalMinutes)} ¥${result.normalSalary.toLocaleString()} / 深夜 ${SalaryCalculator.formatMinutes(result.lateMinutes)} ¥${result.lateSalary.toLocaleString()})
      `;
    } else {
      previewEl.textContent = '時間の指定を確認してください';
    }
  }

  // シフト保存
  shiftForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentEditingDate) return;

    const start = inputStartTime.value.trim();
    const end = inputEndTime.value.trim();
    const breakMins = parseInt(inputBreakMins.value, 10) || 0;
    const note = inputShiftNote.value.trim();

    // タイプの推測
    let type = 'カスタム';
    const settings = storage.getSettings();
    if (!start && !end) {
      type = '休み';
    } else if (start === settings.templates.early.start && end === settings.templates.early.end) {
      type = '早番';
    } else if (start === settings.templates.late.start && end === settings.templates.late.end) {
      type = '遅番';
    } else if (start === settings.templates.last.start && end === settings.templates.last.end) {
      type = 'ラスト';
    }

    const shiftData = { type, start, end, breakMins, note };

    if (currentEditingMode === 'wish') {
      storage.saveWish(currentEditingDate, shiftData);
      showToast('希望シフトを保存しました', 'success');
      wishCalendar.render();
    } else {
      storage.saveConfirmedShift(currentEditingDate, shiftData);
      showToast('確定シフトを保存しました', 'success');
      confirmedCalendar.render();
      updateSalarySummary();
    }

    closeShiftModal();
  });

  // シフト削除
  if (btnDeleteShift) {
    btnDeleteShift.addEventListener('click', () => {
      if (!currentEditingDate) return;
      if (confirm('このシフトを削除しますか？')) {
        if (currentEditingMode === 'wish') {
          storage.deleteWish(currentEditingDate);
          showToast('希望シフトを削除しました', 'info');
          wishCalendar.render();
        } else {
          storage.deleteConfirmedShift(currentEditingDate);
          showToast('確定シフトを削除しました', 'info');
          confirmedCalendar.render();
          updateSalarySummary();
        }
        closeShiftModal();
      }
    });
  }

  // --- 設定画面の処理 ---
  function loadSettingsToUI() {
    const s = storage.getSettings();
    inputStoreCode.value = s.storeCode || '';
    inputEmployeeId.value = s.employeeId || '';
    previewParam.textContent = `Param=${s.param || ''}`;
    inputBaseRate.value = s.baseRate || 1300;
    inputLateRate.value = s.lateRate || 1625;

    // テンプレート設定
    const tplEarlyStart = document.getElementById('tpl-early-start');
    const tplEarlyEnd = document.getElementById('tpl-early-end');
    const tplLateStart = document.getElementById('tpl-late-start');
    const tplLateEnd = document.getElementById('tpl-late-end');
    const tplLastStart = document.getElementById('tpl-last-start');
    const tplLastEnd = document.getElementById('tpl-last-end');

    if (tplEarlyStart) tplEarlyStart.value = s.templates.early.start;
    if (tplEarlyEnd) tplEarlyEnd.value = s.templates.early.end;
    if (tplLateStart) tplLateStart.value = s.templates.late.start;
    if (tplLateEnd) tplLateEnd.value = s.templates.late.end;
    if (tplLastStart) tplLastStart.value = s.templates.last.start;
    if (tplLastEnd) tplLastEnd.value = s.templates.last.end;
  }

  // 店舗番号・社員番号の入力リアルタイム反映
  function updateParamPreview() {
    const store = (inputStoreCode.value || '').trim();
    const emp = (inputEmployeeId.value || '').trim();
    previewParam.textContent = `Param=${store}|${emp}`;
  }
  inputStoreCode.addEventListener('input', updateParamPreview);
  inputEmployeeId.addEventListener('input', updateParamPreview);

  // 時給の連動（通常時給変更時に深夜時給25%自動計算）
  inputBaseRate.addEventListener('input', () => {
    const base = parseInt(inputBaseRate.value, 10) || 0;
    if (base > 0) {
      inputLateRate.value = Math.round(base * 1.25);
    }
  });

  // 設定保存
  formSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = storage.getSettings();

    const tplEarlyStart = document.getElementById('tpl-early-start');
    const tplEarlyEnd = document.getElementById('tpl-early-end');
    const tplLateStart = document.getElementById('tpl-late-start');
    const tplLateEnd = document.getElementById('tpl-late-end');
    const tplLastStart = document.getElementById('tpl-last-start');
    const tplLastEnd = document.getElementById('tpl-last-end');

    const newTemplates = {
      ...current.templates,
      early: { ...current.templates.early, start: tplEarlyStart.value, end: tplEarlyEnd.value },
      late: { ...current.templates.late, start: tplLateStart.value, end: tplLateEnd.value },
      last: { ...current.templates.last, start: tplLastStart.value, end: tplLastEnd.value }
    };

    const updated = storage.saveSettings({
      storeCode: inputStoreCode.value.trim(),
      employeeId: inputEmployeeId.value.trim(),
      baseRate: parseInt(inputBaseRate.value, 10),
      lateRate: parseInt(inputLateRate.value, 10),
      templates: newTemplates
    });

    previewParam.textContent = `Param=${updated.param}`;
    showToast('設定を保存しました（Param自動生成完了）', 'success');
  });

  // FoodIT クイックリンク
  const btnLinkLogin = document.getElementById('link-foodit-login');
  const btnLinkMenu = document.getElementById('link-foodit-menu');
  const btnLinkCalendar = document.getElementById('link-foodit-calendar');

  if (btnLinkLogin) btnLinkLogin.addEventListener('click', () => window.open(foodit.getLoginUrl(), '_blank'));
  if (btnLinkMenu) btnLinkMenu.addEventListener('click', () => window.open(foodit.getMenuUrl(), '_blank'));
  if (btnLinkCalendar) btnLinkCalendar.addEventListener('click', () => window.open(foodit.getCalendarUrl(), '_blank'));

  // データエクスポート
  const btnExportData = document.getElementById('btn-export-data');
  if (btnExportData) {
    btnExportData.addEventListener('click', () => {
      const dataStr = storage.exportData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shift_master_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('バックアップファイルをダウンロードしました', 'success');
    });
  }

  // データインポート
  const inputImportFile = document.getElementById('input-import-file');
  if (inputImportFile) {
    inputImportFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = storage.importData(event.target.result);
        if (res.success) {
          showToast('データを復元しました', 'success');
          wishCalendar.render();
          confirmedCalendar.render();
          loadSettingsToUI();
          updateSalarySummary();
        } else {
          showToast(`復元に失敗しました: ${res.error}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // --- FoodIT 申請連携モーダル ---
  if (btnOpenFoodit) {
    btnOpenFoodit.addEventListener('click', () => {
      const creds = foodit.getCredentials();
      const currentYM = wishCalendar.getYearMonthString();
      const list = foodit.getWishesForMonth(currentYM);

      fooditStoreDisplay.textContent = creds.kgcd || '未設定';
      fooditParamDisplay.textContent = creds.param || '未設定';
      fooditCountDisplay.textContent = `${list.length} 件`;

      const summaryText = foodit.generateTextSummary(currentYM);
      fooditSummaryText.value = summaryText;

      fooditModal.classList.add('show');
    });
  }

  if (btnCloseFoodit) {
    btnCloseFoodit.addEventListener('click', () => {
      fooditModal.classList.remove('show');
    });
  }
  fooditModal.addEventListener('click', (e) => {
    if (e.target === fooditModal) fooditModal.classList.remove('show');
  });

  // FoodIT 申請直接送信 (Direct HTTP POST)
  if (btnFooditPost) {
    btnFooditPost.addEventListener('click', async () => {
      const creds = foodit.getCredentials();
      if (!creds.kgcd || !creds.employeeId) {
        showToast('設定画面で店舗番号と社員番号を入力してください', 'warning');
        return;
      }

      const currentYM = wishCalendar.getYearMonthString();
      const list = foodit.getWishesForMonth(currentYM);
      if (list.length === 0) {
        showToast('送信対象の希望シフトがありません', 'info');
        return;
      }

      btnFooditPost.disabled = true;
      btnFooditPost.textContent = '送信中...';

      let successCount = 0;
      for (const item of list) {
        try {
          await foodit.submitSingleShift(item.dateStr, item);
          successCount++;
        } catch (err) {
          console.error('Submit error:', err);
        }
      }

      btnFooditPost.disabled = false;
      btnFooditPost.textContent = 'FoodITへDirect POST送信実行';
      showToast(`${successCount} 件のシフト申請リクエストを送信しました！`, 'success');
    });
  }

  // FoodIT シフト申請ページを直接開く
  if (btnFooditOpenWeb) {
    btnFooditOpenWeb.addEventListener('click', () => {
      window.open(foodit.getCalendarUrl(), '_blank');
    });
  }

  // クリップボードにコピー
  if (btnFooditCopy) {
    btnFooditCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(fooditSummaryText.value).then(() => {
        showToast('シフト希望内容をクリップボードにコピーしました！', 'success');
      }).catch(() => {
        fooditSummaryText.select();
        document.execCommand('copy');
        showToast('シフト希望内容をコピーしました！', 'success');
      });
    });
  }

  // --- ストレージ変更監視 ---
  storage.subscribe((event, data) => {
    if (event === 'wishes_changed') {
      if (wishCalendar) wishCalendar.render();
    } else if (event === 'confirmed_changed') {
      if (confirmedCalendar) confirmedCalendar.render();
      updateSalarySummary();
    } else if (event === 'settings_changed') {
      if (confirmedCalendar) confirmedCalendar.render();
      updateSalarySummary();
    }
  });

  // 初期ロード
  loadSettingsToUI();
  updateSalarySummary();

  // --- PWA Service Worker 登録 ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[SW] Service Worker registered with scope:', reg.scope))
        .catch(err => console.warn('[SW] Registration failed:', err));
    });
  }
});
