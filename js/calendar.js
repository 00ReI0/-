/**
 * Shift Master - Calendar Component
 * 月表示カレンダーGUI & 複数日一括仮登録対応
 */

class ShiftCalendar {
  constructor({
    containerId,
    mode = 'wish', // 'wish' (希望シフト) または 'confirmed' (確定シフト)
    storage,
    onDateClick,
    onBatchSelectChange
  }) {
    this.container = document.getElementById(containerId);
    this.mode = mode; // 'wish' or 'confirmed'
    this.storage = storage;
    this.onDateClick = onDateClick;
    this.onBatchSelectChange = onBatchSelectChange;

    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth() + 1; // 1-12

    // 複数日選択モード（希望シフトのみ）
    this.isMultiSelectMode = false;
    this.selectedDates = new Set();
  }

  getYearMonthString() {
    return `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}`;
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear--;
    }
    this.selectedDates.clear();
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear++;
    }
    this.selectedDates.clear();
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  goToday() {
    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth() + 1;
    this.selectedDates.clear();
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  setMultiSelectMode(enable) {
    this.isMultiSelectMode = enable;
    if (!enable) {
      this.selectedDates.clear();
    }
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  toggleDateSelection(dateStr) {
    if (this.selectedDates.has(dateStr)) {
      this.selectedDates.delete(dateStr);
    } else {
      this.selectedDates.add(dateStr);
    }
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  selectAllWeekdays() {
    const ym = this.getYearMonthString();
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${ym}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(this.currentYear, this.currentMonth - 1, day).getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        this.selectedDates.add(dStr);
      }
    }
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  selectAllWeekends() {
    const ym = this.getYearMonthString();
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${ym}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(this.currentYear, this.currentMonth - 1, day).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        this.selectedDates.add(dStr);
      }
    }
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  clearSelection() {
    this.selectedDates.clear();
    this.render();
    if (this.onBatchSelectChange) this.onBatchSelectChange(Array.from(this.selectedDates));
  }

  render() {
    if (!this.container) return;

    const ymStr = this.getYearMonthString();
    const shifts = this.mode === 'wish' 
      ? this.storage.getWishes() 
      : this.storage.getConfirmed();

    const firstDayIndex = new Date(this.currentYear, this.currentMonth - 1, 1).getDay(); // 0(日) - 6(土)
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const prevMonthDays = new Date(this.currentYear, this.currentMonth - 1, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    // 和モダン・ヘッダー部分
    const monthNamesJa = ['睦月', '如月', '弥生', '卯月', '皐月', '水無月', '文月', '葉月', '長月', '神無月', '霜月', '師走'];
    const jaMonthName = monthNamesJa[this.currentMonth - 1];

    let html = `
      <div class="calendar-header-bar">
        <div class="calendar-title-wrap">
          <span class="calendar-main-title">${this.currentYear}年 <strong class="month-num">${this.currentMonth}</strong>月</span>
          <span class="calendar-sub-title">${jaMonthName}</span>
        </div>
        <div class="calendar-nav-btns">
          <button type="button" class="btn-icon" data-cal-action="prev" title="前月">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button type="button" class="btn-today" data-cal-action="today">今月</button>
          <button type="button" class="btn-icon" data-cal-action="next" title="翌月">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        </div>
      </div>
    `;

    // 複数日選択中ヘッダー（希望シフトの複数選択時）
    if (this.mode === 'wish' && this.isMultiSelectMode) {
      html += `
        <div class="batch-select-bar">
          <div class="batch-info">
            <span class="badge-select-count">✓ <strong>${this.selectedDates.size}</strong> 日選択中</span>
          </div>
          <div class="batch-quick-btns">
            <button type="button" class="chip-btn" data-batch-action="weekdays">平日</button>
            <button type="button" class="chip-btn" data-batch-action="weekends">土日</button>
            <button type="button" class="chip-btn" data-batch-action="clear">解除</button>
          </div>
        </div>
      `;
    }

    // 曜日ヘッダー
    const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
    html += '<div class="calendar-week-header">';
    dayHeaders.forEach((d, i) => {
      const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
      html += `<div class="week-cell ${cls}">${d}</div>`;
    });
    html += '</div>';

    // カレンダーグリッド
    html += '<div class="calendar-grid">';

    // 前月の日付埋め
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      html += `<div class="cal-cell other-month"><span class="day-number">${d}</span></div>`;
    }

    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${ymStr}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(this.currentYear, this.currentMonth - 1, day).getDay();
      const isToday = dateStr === todayStr;
      const isSelected = this.selectedDates.has(dateStr);
      const shift = shifts[dateStr];

      let cellClasses = ['cal-cell'];
      if (dayOfWeek === 0) cellClasses.push('sun');
      if (dayOfWeek === 6) cellClasses.push('sat');
      if (isToday) cellClasses.push('is-today');
      if (isSelected) cellClasses.push('is-selected');
      if (shift) cellClasses.push('has-shift');

      // シフトバッジの生成
      let badgeHtml = '';
      if (shift) {
        if (shift.type === '休み') {
          badgeHtml = `<div class="shift-chip chip-off">休み</div>`;
        } else if (shift.start && shift.end) {
          // タイプ別クラス
          let typeClass = 'chip-custom';
          if (shift.type === '早番') typeClass = 'chip-early';
          else if (shift.type === '遅番') typeClass = 'chip-late';
          else if (shift.type === 'ラスト') typeClass = 'chip-last';

          // 希望シフトモードでは【絶対に給与を表示しない】（仕様制約）
          // 確定シフトモードでは時間を表示し、給与サマリーはタブ下部にまとめる
          badgeHtml = `
            <div class="shift-chip ${typeClass}">
              <span class="chip-type-tag">${shift.type || '出勤'}</span>
              <span class="chip-time">${shift.start} - ${shift.end}</span>
            </div>
          `;
        }
      }

      html += `
        <div class="${cellClasses.join(' ')}" data-date="${dateStr}">
          <div class="cell-top">
            <span class="day-number">${day}</span>
            ${isSelected ? '<span class="selected-check">✓</span>' : ''}
          </div>
          <div class="cell-body">
            ${badgeHtml}
          </div>
        </div>
      `;
    }

    // 翌月の日付埋め（7の倍数になるように）
    const totalCells = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      html += `<div class="cal-cell other-month"><span class="day-number">${day}</span></div>`;
    }

    html += '</div>'; // .calendar-grid

    this.container.innerHTML = html;
    this.attachEvents();
  }

  attachEvents() {
    // ナビゲーション
    const prevBtn = this.container.querySelector('[data-cal-action="prev"]');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevMonth());

    const nextBtn = this.container.querySelector('[data-cal-action="next"]');
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextMonth());

    const todayBtn = this.container.querySelector('[data-cal-action="today"]');
    if (todayBtn) todayBtn.addEventListener('click', () => this.goToday());

    // 複数日クイック選択
    const btnWeekdays = this.container.querySelector('[data-batch-action="weekdays"]');
    if (btnWeekdays) btnWeekdays.addEventListener('click', () => this.selectAllWeekdays());

    const btnWeekends = this.container.querySelector('[data-batch-action="weekends"]');
    if (btnWeekends) btnWeekends.addEventListener('click', () => this.selectAllWeekends());

    const btnClear = this.container.querySelector('[data-batch-action="clear"]');
    if (btnClear) btnClear.addEventListener('click', () => this.clearSelection());

    // 日付セルクリック
    const cells = this.container.querySelectorAll('.cal-cell[data-date]');
    cells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        const dateStr = cell.getAttribute('data-date');
        if (this.mode === 'wish' && this.isMultiSelectMode) {
          this.toggleDateSelection(dateStr);
        } else {
          if (this.onDateClick) {
            this.onDateClick(dateStr);
          }
        }
      });
    });
  }
}

window.ShiftCalendar = ShiftCalendar;
