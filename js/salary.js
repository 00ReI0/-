/**
 * Shift Master - Salary Calculator
 * 22:00前後の時間分割ロジックおよび給与自動計算クラス
 */

class SalaryCalculator {
  /**
   * "HH:MM" 形式の時刻文字列をその日の 0:00 からの経過分数（分）に変換
   * 24時以降の表記（25:00等）にも対応
   */
  static timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }

  /**
   * 分数を "X時間Y分" または "X.Xh" にフォーマット
   */
  static formatMinutes(totalMinutes, format = 'text') {
    if (!totalMinutes || totalMinutes <= 0) return format === 'text' ? '0分' : '0.0h';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (format === 'decimal') {
      return (totalMinutes / 60).toFixed(1) + 'h';
    }
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  }

  /**
   * 単一シフトの労働時間を通常時間帯（5:00〜22:00）と深夜時間帯（22:00〜翌5:00）に分割して計算
   *
   * @param {string} startTime - 開始時刻 "HH:MM" (例: "17:00")
   * @param {string} endTime - 終了時刻 "HH:MM" (例: "23:30" や "02:00")
   * @param {number} breakMinutes - 休憩時間（分）
   * @param {number} baseRate - 通常時給（デフォルト: 1300円）
   * @param {number} lateRate - 深夜時給（デフォルト: 1625円）
   * @returns {Object} 詳細な計算結果
   */
  static calculateShift({
    startTime,
    endTime,
    breakMinutes = 0,
    baseRate = 1300,
    lateRate = 1625
  }) {
    if (!startTime || !endTime) {
      return {
        totalMinutes: 0,
        normalMinutes: 0,
        lateMinutes: 0,
        breakMinutes: 0,
        normalSalary: 0,
        lateSalary: 0,
        totalSalary: 0,
        isOvernight: false,
        valid: false
      };
    }

    let start = this.timeToMinutes(startTime);
    let end = this.timeToMinutes(endTime);

    // 終了時刻が開始時刻以下の場合、翌日扱い（+24時間 = +1440分）
    let isOvernight = false;
    if (end <= start) {
      end += 1440;
      isOvernight = true;
    }

    const rawTotalMinutes = Math.max(0, end - start);
    if (rawTotalMinutes <= 0) {
      return {
        totalMinutes: 0,
        normalMinutes: 0,
        lateMinutes: 0,
        breakMinutes: 0,
        normalSalary: 0,
        lateSalary: 0,
        totalSalary: 0,
        isOvernight,
        valid: false
      };
    }

    // 分単位で走査して通常時間と深夜時間に正確に分類
    // 通常時間帯: 05:00 (300分) 〜 22:00 (1320分)
    // 深夜時間帯: 22:00 (1320分) 〜 翌05:00 (1740分 / 300分)
    let rawNormalMins = 0;
    let rawLateMins = 0;

    for (let m = start; m < end; m++) {
      const minuteOfDay = m % 1440;
      // 22:00 (1320分) 以降 または 05:00 (300分) 未満は深夜時間
      if (minuteOfDay >= 1320 || minuteOfDay < 300) {
        rawLateMins++;
      } else {
        rawNormalMins++;
      }
    }

    // 休憩時間の控除（按分処理）
    let finalNormalMins = rawNormalMins;
    let finalLateMins = rawLateMins;
    const breakMins = Math.min(breakMinutes, rawTotalMinutes);

    if (breakMins > 0) {
      if (rawNormalMins > 0 && rawLateMins > 0) {
        // 通常と深夜の時間比率に合わせて休憩時間を按分控除
        const normalRatio = rawNormalMins / rawTotalMinutes;
        const normalBreak = Math.round(breakMins * normalRatio);
        const lateBreak = breakMins - normalBreak;
        finalNormalMins = Math.max(0, rawNormalMins - normalBreak);
        finalLateMins = Math.max(0, rawLateMins - lateBreak);
      } else if (rawNormalMins > 0) {
        finalNormalMins = Math.max(0, rawNormalMins - breakMins);
      } else {
        finalLateMins = Math.max(0, rawLateMins - breakMins);
      }
    }

    const totalMinutes = finalNormalMins + finalLateMins;

    // 給与計算（分単位の時給換算、端数は四捨五入）
    const normalSalary = Math.round((finalNormalMins / 60) * baseRate);
    const lateSalary = Math.round((finalLateMins / 60) * lateRate);
    const totalSalary = normalSalary + lateSalary;

    return {
      totalMinutes,
      normalMinutes: finalNormalMins,
      lateMinutes: finalLateMins,
      breakMinutes: breakMins,
      baseRate,
      lateRate,
      normalSalary,
      lateSalary,
      totalSalary,
      isOvernight,
      valid: true
    };
  }

  /**
   * 月間全体の確定シフト集計
   *
   * @param {Object} confirmedShifts - 確定シフトの辞書 { "YYYY-MM-DD": shiftData, ... }
   * @param {string} yearMonth - 集計対象年月 "YYYY-MM"
   * @param {Object} settings - 設定オブジェクト（時給等）
   * @returns {Object} 月間給与サマリー
   */
  static calculateMonthlySummary(confirmedShifts, yearMonth, settings = {}) {
    const defaultBaseRate = settings.baseRate || 1300;
    const defaultLateRate = settings.lateRate || 1625;

    let workDaysCount = 0;
    let totalMinutes = 0;
    let normalMinutes = 0;
    let lateMinutes = 0;
    let normalSalary = 0;
    let lateSalary = 0;
    let totalSalary = 0;
    const dayBreakdowns = [];

    const dateKeys = Object.keys(confirmedShifts)
      .filter(dateStr => dateStr.startsWith(yearMonth))
      .sort();

    dateKeys.forEach(dateStr => {
      const shift = confirmedShifts[dateStr];
      if (!shift || !shift.start || !shift.end || shift.type === '休み') {
        return;
      }

      const baseRate = shift.baseRate || defaultBaseRate;
      const lateRate = shift.lateRate || defaultLateRate;

      const result = this.calculateShift({
        startTime: shift.start,
        endTime: shift.end,
        breakMinutes: shift.breakMins || 0,
        baseRate,
        lateRate
      });

      if (result.valid && result.totalMinutes > 0) {
        workDaysCount++;
        totalMinutes += result.totalMinutes;
        normalMinutes += result.normalMinutes;
        lateMinutes += result.lateMinutes;
        normalSalary += result.normalSalary;
        lateSalary += result.lateSalary;
        totalSalary += result.totalSalary;

        dayBreakdowns.push({
          date: dateStr,
          type: shift.type,
          start: shift.start,
          end: shift.end,
          breakMins: shift.breakMins || 0,
          ...result
        });
      }
    });

    return {
      yearMonth,
      workDaysCount,
      totalMinutes,
      normalMinutes,
      lateMinutes,
      normalSalary,
      lateSalary,
      totalSalary,
      dayBreakdowns,
      // フォーマット済み文字列
      formattedTotalTime: this.formatMinutes(totalMinutes, 'text'),
      formattedDecimalHours: (totalMinutes / 60).toFixed(1) + 'h',
      formattedNormalTime: this.formatMinutes(normalMinutes, 'text'),
      formattedLateTime: this.formatMinutes(lateMinutes, 'text')
    };
  }
}

// グローバル参照
window.SalaryCalculator = SalaryCalculator;
