/* ==========================================================================
   報表相依性設定（集中管理）
   定義各報表與結算模組的相依關係，供各頁面／header 導覽共用同一套狀態判斷邏輯。
   後端：SETTLEMENT_MODULES_BASE 為前端示意用資料，正式串接後應改為呼叫後端 API
   取得各結算模組的 last_settled_at／last_data_updated_at，其餘邏輯不變。
   ========================================================================== */
(function (window) {
  'use strict';

  // 報表 -> 依賴的結算模組清單（無依賴則一律視為「可下載」）
  var REPORT_DEPENDENCIES = {
    studentBasicForm: [],
    studentRoll: ['deyu_score', 'xueke_score'],
    studentBasicExport: [],
    studentAttendanceRoll: [],
    studentAttendanceReport: ['deyu_score'],
    rewardPunishmentReport: ['deyu_score'],
    // 各式報表列印 > 成績單（reportScoreSheet.html）
    // conductRollAll＝全校學生操行成績清冊（原：操行成績單A表＝全校正式存查用）
    // conductRollClass＝各班操行成績清冊（原：操行成績單B表＝各班獎學金比對用）
    // 若實際定義與上述對應不同，請調整這裡的註解與 key 對應，其餘判斷邏輯不需更動
    conductRollAll: ['deyu_score'],
    conductRollClass: ['deyu_score'],
    studentScoreSheet: ['xueke_score'],
    // 各式報表列印 > 新生/畢(結)業生報表（reportGraduateData.html）：不依賴結算模組，
    // 「無資料」狀態改由查詢條件（學年度示意選項）觸發，詳見 js/dataModal.js 的 initReportGraduateData()
    '畢(結)業名冊_PDF': [],
    '畢(結)業名冊_Excel': [],
    '新生(畢業)報局用表': [],
    // 各式報表列印 > 代(兼)課相關報表 > 教師代(兼)課時數統計表（reportSubstituteHours.html）：
    // 不依賴結算模組，「無資料」狀態改由日期區間反轉（結束日期早於起始日期）觸發
    substituteHoursReport: []
  };

  var SETTLEMENT_MODULES_META = {
    deyu_score: { label: '德育成績', settlePage: 'moralScoreCalc.html' },
    xueke_score: { label: '學科成績', settlePage: 'scoreCalc.html' }
  };

  // 模擬初始資料：deyu_score 已結算且資料未再更新；xueke_score 結算後來源資料又變動（示範「需重算」）
  var SETTLEMENT_MODULES_BASE = {
    deyu_score: { lastSettledAt: '2026-06-18T10:00:00', lastDataUpdatedAt: '2026-06-18T09:00:00' },
    xueke_score: { lastSettledAt: '2026-06-10T09:00:00', lastDataUpdatedAt: '2026-06-19T15:30:00' }
  };

  var STORAGE_KEY = 'ncses_settlementState';

  function readOverrides() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeOverrides(overrides) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch (e) {
      /* localStorage 不可用時（如無痕模式限制）靜默忽略，狀態退回預設資料 */
    }
  }

  function getModuleState(moduleKey) {
    var base = SETTLEMENT_MODULES_BASE[moduleKey];
    if (!base) { return null; }
    var overrides = readOverrides();
    var override = overrides[moduleKey];
    return {
      lastSettledAt: (override && override.lastSettledAt) || base.lastSettledAt,
      lastDataUpdatedAt: base.lastDataUpdatedAt
    };
  }

  // 標記某結算模組「剛完成結算」：寫入目前時間，使其晚於 lastDataUpdatedAt
  function markModuleSettled(moduleKey) {
    if (!SETTLEMENT_MODULES_BASE[moduleKey]) { return; }
    var overrides = readOverrides();
    overrides[moduleKey] = { lastSettledAt: new Date().toISOString() };
    writeOverrides(overrides);
  }

  var STATUS = {
    AVAILABLE: 'available',
    PENDING: 'pending',
    RECALC: 'recalc',
    NO_DATA: 'nodata'
  };

  var STATUS_META = {
    available: { label: '可下載', badgeClass: 'report-status--available', icon: 'bi-check-circle-fill', defaultTooltip: '無需額外動作' },
    pending: { label: '待結算', badgeClass: 'report-status--pending', icon: 'bi-hourglass-split', defaultTooltip: '需先完成結算' },
    recalc: { label: '需重算', badgeClass: 'report-status--recalc', icon: 'bi-exclamation-triangle-fill', defaultTooltip: '來源資料已更新，請重新結算' },
    nodata: { label: '無資料', badgeClass: 'report-status--nodata', icon: 'bi-slash-circle', defaultTooltip: '尚未匯入學生名冊' }
  };

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function buildResult(status, blockingModuleKey) {
    var meta = STATUS_META[status];
    var tooltip = meta.defaultTooltip;
    var settlePage = null;
    var settleLabel = null;

    if (blockingModuleKey) {
      var moduleMeta = SETTLEMENT_MODULES_META[blockingModuleKey];
      var moduleState = getModuleState(blockingModuleKey);
      settlePage = moduleMeta.settlePage;
      settleLabel = '前往結算';

      if (status === STATUS.PENDING) {
        tooltip = '需先至「' + moduleMeta.label + '」頁面完成結算';
      } else if (status === STATUS.RECALC) {
        tooltip = moduleMeta.label + '已於 ' + formatDate(moduleState.lastDataUpdatedAt) + ' 更新，請重新結算後下載';
      }
    }

    return {
      status: status,
      label: meta.label,
      icon: meta.icon,
      badgeClass: meta.badgeClass,
      tooltip: tooltip,
      settlePage: settlePage,
      settleLabel: settleLabel
    };
  }

  // options.hasNoMatchingData：由呼叫端依查詢結果判斷是否為「無資料」
  function getReportStatus(reportKey, options) {
    var opts = options || {};
    var deps = REPORT_DEPENDENCIES[reportKey] || [];

    if (opts.hasNoMatchingData) {
      return buildResult(STATUS.NO_DATA, null);
    }

    if (!deps.length) {
      return buildResult(STATUS.AVAILABLE, null);
    }

    var recalcModule = null;
    for (var i = 0; i < deps.length; i++) {
      var moduleKey = deps[i];
      var state = getModuleState(moduleKey);
      if (!state || !state.lastSettledAt) {
        return buildResult(STATUS.PENDING, moduleKey);
      }
      if (state.lastDataUpdatedAt && state.lastSettledAt < state.lastDataUpdatedAt) {
        recalcModule = moduleKey;
      }
    }

    if (recalcModule) {
      return buildResult(STATUS.RECALC, recalcModule);
    }

    return buildResult(STATUS.AVAILABLE, null);
  }

  window.ReportDependency = {
    STATUS: STATUS,
    REPORT_DEPENDENCIES: REPORT_DEPENDENCIES,
    getReportStatus: getReportStatus,
    markModuleSettled: markModuleSettled
  };
})(window);
