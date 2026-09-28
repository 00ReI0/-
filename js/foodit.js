/**
 * Shift Master - FoodIT Integration Module
 * FoodIT ASP モバイルシフト申請連携 & Direct HTTP POST & URL生成
 */

class FoodITService {
  constructor(storage) {
    this.storage = storage;
  }

  getCredentials() {
    const settings = this.storage.getSettings();
    const kgcd = (settings.storeCode || '').trim();
    const employeeId = (settings.employeeId || '').trim();
    // Param = 店舗番号|社員番号 (例: 02006|5155517)
    const param = `${kgcd}|${employeeId}`;
    return { kgcd, employeeId, param };
  }

  /**
   * エンドポイントURL生成
   */
  getLoginUrl() {
    const { kgcd } = this.getCredentials();
    return `https://secure1.foodit.jp/CRG/mobile/login_8.asp?Kgcd=${encodeURIComponent(kgcd)}`;
  }

  getMenuUrl() {
    const { kgcd, param } = this.getCredentials();
    return `https://secure1.foodit.jp/CRG/mobile/menu_8.asp?kgcd=${encodeURIComponent(kgcd)}&Param=${encodeURIComponent(param)}`;
  }

  getCalendarUrl() {
    const { kgcd, param } = this.getCredentials();
    return `https://secure1.foodit.jp/CRG/mobile/shift_8.asp?Flg=0&Kgcd=${encodeURIComponent(kgcd)}&Param=${encodeURIComponent(param)}`;
  }

  /**
   * シフト申請用 URL 生成
   * @param {string} dateStr - "YYYY-MM-DD"
   */
  getShiftAppliUrl(dateStr) {
    const { kgcd, param } = this.getCredentials();
    // YYYYMMDD 形式に変換
    const ymd = dateStr.replace(/-/g, '');
    return `https://secure1.foodit.jp/CRG/mobile/shiftAppli_8.asp?ShiftYmd=${ymd}&Kgcd=${encodeURIComponent(kgcd)}&Param=${encodeURIComponent(param)}&SagyoCd=01`;
  }

  /**
   * 指定月の希望シフト一覧をFoodIT申請データとして抽出
   */
  getWishesForMonth(yearMonth) {
    const wishes = this.storage.getWishes();
    const result = [];
    Object.keys(wishes)
      .filter(k => k.startsWith(yearMonth))
      .sort()
      .forEach(dateStr => {
        const item = wishes[dateStr];
        result.push({
          dateStr,
          ymd: dateStr.replace(/-/g, ''),
          ...item
        });
      });
    return result;
  }

  /**
   * シフト申請の Direct POST 送信
   * ※ ブラウザのCORS制限を回避するため、Fetch(no-cors) と Form POST の両方に対応
   */
  async submitSingleShift(dateStr, shiftData) {
    const { kgcd, param } = this.getCredentials();
    const url = this.getShiftAppliUrl(dateStr);

    const postData = {
      Kgcd: kgcd,
      Param: param,
      ShiftYmd: dateStr.replace(/-/g, ''),
      SagyoCd: '01',
      StartTime: shiftData.start || '',
      EndTime: shiftData.end || '',
      Type: shiftData.type || '',
      Comment: shiftData.note || ''
    };

    try {
      // 1. Fetch API による送信試行 (no-cors)
      const formBody = Object.keys(postData)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(postData[key]))
        .join('&');

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody,
        mode: 'no-cors'
      });

      return { success: true, method: 'fetch', url };
    } catch (err) {
      console.warn('Direct fetch error, falling back to form submission', err);
      // 2. ブラウザフォーム経由の送信
      this.submitViaHiddenForm(url, postData);
      return { success: true, method: 'form', url };
    }
  }

  /**
   * 隠しFORMを生成して新規タブでFoodITにDirect POST送信
   * これによりCORS制限を100%回避し、FoodITの申請ページに直接データが渡ります
   */
  submitViaHiddenForm(actionUrl, dataObj) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    form.target = '_blank';
    form.style.display = 'none';

    Object.entries(dataObj).forEach(([key, val]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = val;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
      if (document.body.contains(form)) {
        document.body.removeChild(form);
      }
    }, 1000);
  }

  /**
   * 希望シフトのテキストサマリー（LINEやメモ共有、確認用）
   */
  generateTextSummary(yearMonth) {
    const list = this.getWishesForMonth(yearMonth);
    const { kgcd, param } = this.getCredentials();
    const ymParts = yearMonth.split('-');
    const title = `【希望シフト提出】${ymParts[0]}年${parseInt(ymParts[1], 10)}月分`;
    const header = `店舗番号: ${kgcd} / Param: ${param}\n----------------------------`;
    
    if (list.length === 0) {
      return `${title}\n${header}\n登録された希望シフトはありません。`;
    }

    const lines = list.map(item => {
      const d = item.dateStr.split('-');
      const dayNum = parseInt(d[2], 10);
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(item.dateStr).getDay()];
      if (item.type === '休み' || !item.start) {
        return `${dayNum}日(${dayOfWeek}): 休み`;
      }
      return `${dayNum}日(${dayOfWeek}): ${item.start}〜${item.end} (${item.type})${item.note ? ' [' + item.note + ']' : ''}`;
    });

    return `${title}\n${header}\n` + lines.join('\n');
  }
}

window.FoodITService = FoodITService;
