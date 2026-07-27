/* ==========================================================================
   資料維護 Modal 共用腳本（Vanilla JS）
   科目基本資料／編班作業／班級座號維護／指定修課學生／教師代課管理 共用：
   - 新增/編輯模式標題切換
   - 回饋 Modal（成功訊息＋3 秒倒數自動關閉；另有手動關閉版）
   - 穿梭清單（勾選搬移、全選、搜尋、筆數同步）
   - 座號清除
   - 調代(兼)課：代課日期同步、星期天數顯隱、全天節次、事由字數統計
   後端：實際送出與資料回填由後端接手，submit 一律 preventDefault 示意。
   ========================================================================== */
(function () {
  'use strict';

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /* ------------------------------------------------------------------
     回饋 Modal：帶入標題與訊息後顯示，3 秒倒數自動關閉
     訊息區塊具 role="status"，螢幕閱讀器會自動朗讀
  ------------------------------------------------------------------ */
  var feedbackTimer = null;

  // options：{ icon, variant } 皆為選填，未帶入時維持預設藍色圖示（向下相容既有呼叫）
  function showFeedback(title, message, options) {
    var modalEl = document.getElementById('feedbackModal');
    if (!modalEl || !window.bootstrap) { return; }

    qs('.feedback-title', modalEl).textContent = title;
    qs('.feedback-desc', modalEl).textContent = message;

    var opts = options || {};
    var iconWrap = qs('.feedback-icon', modalEl);
    var iconEl = qs('.feedback-icon i', modalEl);
    if (iconWrap) { iconWrap.classList.toggle('feedback-icon--danger', opts.variant === 'danger'); }
    if (iconEl) { iconEl.className = 'bi ' + (opts.icon || 'bi-file-earmark-check'); }

    var countEl = qs('.feedback-countdown-num', modalEl);
    var seconds = 3;
    countEl.textContent = seconds;

    var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    window.clearInterval(feedbackTimer);
    feedbackTimer = window.setInterval(function () {
      seconds -= 1;
      if (seconds <= 0) {
        window.clearInterval(feedbackTimer);
        modal.hide();
        return;
      }
      countEl.textContent = seconds;
    }, 1000);
  }

  function initFeedbackModal() {
    var modalEl = document.getElementById('feedbackModal');
    if (!modalEl) { return; }
    // 使用者提前以 Esc 或點擊背景關閉時，停止倒數
    modalEl.addEventListener('hidden.bs.modal', function () {
      window.clearInterval(feedbackTimer);
    });
  }

  // 結算完成後，若網址帶有 ?returnTo=，待回饋 Modal 關閉後自動導回原報表頁籤並刷新其狀態
  function redirectAfterFeedback() {
    var returnTo = new URLSearchParams(window.location.search).get('returnTo');
    if (!returnTo) { return; }
    var modalEl = document.getElementById('feedbackModal');
    if (!modalEl) { return; }
    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      window.location.href = returnTo;
    });
  }

  // 先關閉表單 Modal，待關閉動畫結束後再顯示回饋 Modal
  function hideThenFeedback(modalEl, title, message, options) {
    var instance = bootstrap.Modal.getInstance(modalEl);
    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      showFeedback(title, message, options);
    });
    if (instance) { instance.hide(); }
  }

  /* ------------------------------------------------------------------
     科目 Modal：新增/編輯共用
     觸發按鈕以 data-modal-mode="add|edit" 與 data-record-name /
     data-record-code 傳入模式與示意資料（後端：編輯時由後端回填欄位）
  ------------------------------------------------------------------ */
  function initSubjectModal() {
    var modalEl = document.getElementById('subjectModal');
    if (!modalEl) { return; }

    var titleText = qs('.data-modal-title-text', modalEl);
    var descEl = qs('.data-modal-desc', modalEl);
    var submitBtn = qs('.data-modal-submit', modalEl);
    var form = qs('form', modalEl);
    var nameInput = qs('#subName', modalEl);
    var codeInput = qs('#subCode', modalEl);

    var mode = 'add';
    var recordName = '';

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      mode = (trigger && trigger.dataset.modalMode === 'edit') ? 'edit' : 'add';
      recordName = (trigger && trigger.dataset.recordName) || '';

      form.reset();

      if (mode === 'edit') {
        titleText.textContent = '檢視/修改科目資料';
        descEl.textContent = '檢視或修改科目資料明細。';
        submitBtn.textContent = '確定更新';
        // 後端：編輯模式由後端回填全部欄位，以下僅前端示意
        if (nameInput && recordName) { nameInput.value = recordName; }
        if (codeInput && trigger && trigger.dataset.recordCode) {
          codeInput.value = trigger.dataset.recordCode;
        }
      } else {
        titleText.textContent = '新增科目資料';
        descEl.textContent = '請填寫科目資料明細。';
        submitBtn.textContent = '確定新增';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      var name = (nameInput && nameInput.value.trim()) || recordName || '科目';
      if (mode === 'edit') {
        hideThenFeedback(modalEl, '資料更新成功', '你已更新你的“' + name + '-科目資料”');
      } else {
        hideThenFeedback(modalEl, '資料新增成功', '你已送出你的“' + name + '-科目資料”');
      }
    });
  }

  /* ------------------------------------------------------------------
     穿梭清單（編班 Modal）：兩面板勾選搬移、全選、搜尋、筆數同步
  ------------------------------------------------------------------ */
  function setupTransfer(root) {
    var panels = {};
    qsa('[data-transfer-panel]', root).forEach(function (panel) {
      panels[panel.dataset.transferPanel] = panel;
    });
    if (!panels.assigned || !panels.unassigned) { return; }

    function items(panel) {
      return qsa('.transfer-list > li', panel);
    }

    function updatePanel(panel) {
      var all = items(panel);
      var visible = all.filter(function (li) { return !li.hidden; });
      var visibleChecked = visible.filter(function (li) { return qs('input', li).checked; });

      var countBadge = qs('[data-transfer-count]', panel);
      if (countBadge) { countBadge.textContent = all.length; }

      qs('[data-transfer-selected]', panel).textContent =
        all.filter(function (li) { return qs('input', li).checked; }).length;

      var checkAll = qs('[data-transfer-checkall]', panel);
      checkAll.checked = visible.length > 0 && visibleChecked.length === visible.length;
      checkAll.indeterminate = visibleChecked.length > 0 && visibleChecked.length < visible.length;
    }

    // 搬移項目（onlyChecked=true 僅搬勾選項；搜尋過濾中隱藏的項目不搬移）
    function move(from, to, onlyChecked) {
      var toList = qs('.transfer-list', to);
      items(from).forEach(function (li) {
        var input = qs('input', li);
        if (li.hidden) { return; }
        if (onlyChecked && !input.checked) { return; }
        input.checked = false;
        toList.appendChild(li);
      });
      updatePanel(from);
      updatePanel(to);
    }

    Object.keys(panels).forEach(function (key) {
      var panel = panels[key];

      qs('[data-transfer-checkall]', panel).addEventListener('change', function () {
        var checked = this.checked;
        items(panel).forEach(function (li) {
          if (!li.hidden) { qs('input', li).checked = checked; }
        });
        updatePanel(panel);
      });

      qs('.transfer-list', panel).addEventListener('change', function () {
        updatePanel(panel);
      });

      var search = qs('[data-transfer-search]', panel);
      if (search) {
        search.addEventListener('input', function () {
          var keyword = search.value.trim().toLowerCase();
          items(panel).forEach(function (li) {
            li.hidden = keyword !== '' && li.textContent.toLowerCase().indexOf(keyword) === -1;
          });
          updatePanel(panel);
        });
      }
    });

    qsa('[data-transfer-action]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.transferAction;
        if (action === 'remove') { move(panels.assigned, panels.unassigned, true); }
        if (action === 'add') { move(panels.unassigned, panels.assigned, true); }
        if (action === 'remove-all') { move(panels.assigned, panels.unassigned, false); }
        if (action === 'add-all') { move(panels.unassigned, panels.assigned, false); }
      });
    });

    updatePanel(panels.assigned);
    updatePanel(panels.unassigned);
  }

  /* ------------------------------------------------------------------
     編班 Modal：帶入班級名稱、穿梭清單、更新回饋
  ------------------------------------------------------------------ */
  function initPlacementModal() {
    var modalEl = document.getElementById('placementModal');
    if (!modalEl) { return; }

    var form = qs('form', modalEl);
    var recordName = '';

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      recordName = (trigger && trigger.dataset.recordName) || '';
      var classNameEl = qs('#placementClassName', modalEl);
      if (classNameEl && trigger && trigger.dataset.className) {
        classNameEl.textContent = trigger.dataset.className;
      }
    });

    setupTransfer(modalEl);

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + (recordName || '班級') + '-編班資料”');
    });
  }

  /* ------------------------------------------------------------------
     座號 Modal：帶入班級名稱、全選同步、清除座號、更新回饋
  ------------------------------------------------------------------ */
  function initSeatModal() {
    var modalEl = document.getElementById('seatModal');
    if (!modalEl) { return; }

    var form = qs('form', modalEl);
    // 全選與各列勾選雙向同步已由 main.js 的 initCheckAllGroups() 統一處理
    // （[data-check-all] / [data-check-row]），此處僅需取得勾選列供清除功能使用
    var rowChecks = qsa('[data-check-row]', modalEl);
    var recordName = '';

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      recordName = (trigger && trigger.dataset.className) || '';
      var classNameEl = qs('#seatClassName', modalEl);
      if (classNameEl && recordName) { classNameEl.textContent = recordName; }
    });

    // 清除座號：有勾選僅清除勾選列，未勾選則全部清除
    var clearBtn = qs('#seatClearBtn', modalEl);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var checkedRows = rowChecks.filter(function (input) { return input.checked; });
        var targets = checkedRows.length ? checkedRows : rowChecks;
        targets.forEach(function (input) {
          var row = input.closest('tr');
          var seatInput = row ? qs('.seat-input', row) : null;
          if (seatInput) { seatInput.value = ''; }
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + (recordName || '班級') + '-學生座號”');
    });
  }

  /* ------------------------------------------------------------------
     教師可授課科目 Modal：帶入教師代碼/姓名、穿梭清單（複用 setupTransfer）、
     更新回饋。data-bs-backdrop="static" 已於 HTML 端設定，避免點擊外部誤觸關閉
  ------------------------------------------------------------------ */
  function initTeacherSubjectModal() {
    var modalEl = document.getElementById('teacherSubjectModal');
    if (!modalEl) { return; }

    var titleText = qs('.data-modal-title-text', modalEl);
    var descEl = qs('.data-modal-desc', modalEl);
    var submitBtn = qs('.data-modal-submit', modalEl);
    var form = qs('form', modalEl);
    var codeInput = qs('#teacherSubjectCode', modalEl);
    var nameInput = qs('#teacherSubjectName', modalEl);

    var mode = 'add';
    var recordName = '';

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      mode = (trigger && trigger.dataset.modalMode === 'edit') ? 'edit' : 'add';
      recordName = (trigger && trigger.dataset.recordName) || '';

      form.reset();

      if (mode === 'edit') {
        titleText.textContent = '編輯教師教授科目資料';
        descEl.textContent = '檢視或修改教授科目資料明細。';
        submitBtn.textContent = '確定更新';
        // 後端：編輯模式由後端回填教師代碼/姓名與已選科目，以下僅前端示意
        if (codeInput && trigger && trigger.dataset.recordCode) { codeInput.value = trigger.dataset.recordCode; }
        if (nameInput && recordName) { nameInput.value = recordName; }
      } else {
        titleText.textContent = '新增教師教授科目資料';
        descEl.textContent = '請填寫教師代碼/姓名並選擇可授課科目。';
        submitBtn.textContent = '確定新增';
      }
    });

    setupTransfer(modalEl);

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      var name = (nameInput && nameInput.value.trim()) || recordName || '教師';
      if (mode === 'edit') {
        hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + name + '-可授課科目資料”');
      } else {
        hideThenFeedback(modalEl, '資料新增成功', '你已送出“' + name + '-可授課科目資料”');
      }
    });
  }

  /* ------------------------------------------------------------------
     手動關閉版回饋 Modal：先關閉表單 Modal，再顯示（不倒數）
     教師代課管理「新增成功」使用：訊息含檢驗提示，由使用者自行關閉
  ------------------------------------------------------------------ */
  function hideThenManualFeedback(modalEl) {
    var manualEl = document.getElementById('feedbackManualModal');
    if (!manualEl || !window.bootstrap) { return; }

    var instance = bootstrap.Modal.getInstance(modalEl);
    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      bootstrap.Modal.getOrCreateInstance(manualEl).show();
    });
    if (instance) { instance.hide(); }
  }

  /* ------------------------------------------------------------------
     指定修課學生 Modal：帶入課程代碼/名稱、穿梭清單、更新回饋
  ------------------------------------------------------------------ */
  function initCourseStudentModal() {
    var modalEl = document.getElementById('courseStudentModal');
    if (!modalEl) { return; }

    var form = qs('form', modalEl);
    var recordName = '';

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      recordName = (trigger && trigger.dataset.courseName) || '';

      // 後端：課程代碼/名稱由後端帶入，以下僅前端示意
      var codeEl = qs('#courseStudentCode', modalEl);
      var nameEl = qs('#courseStudentName', modalEl);
      if (codeEl && trigger && trigger.dataset.courseCode) {
        codeEl.textContent = trigger.dataset.courseCode;
      }
      if (nameEl && recordName) {
        nameEl.textContent = recordName;
      }
    });

    setupTransfer(modalEl);

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + (recordName || '課程') + '-修課學生”');
    });
  }

  /* ------------------------------------------------------------------
     調代(兼)課 Modal（教師代課管理）：新增/編輯共用
     - 代課日期：選擇開始日期後，結束日期自動同步為同一天
     - 星期天數：單日請假自動隱藏，跨日請假才顯示
     - 全天：勾選後節次自動帶入第一節～第七節
     - 事由：即時字數統計（上限 200 字）
  ------------------------------------------------------------------ */
  function initSubstituteModal() {
    var modalEl = document.getElementById('substituteModal');
    if (!modalEl) { return; }

    var titleText = qs('.data-modal-title-text', modalEl);
    var descEl = qs('.data-modal-desc', modalEl);
    var submitBtn = qs('.data-modal-submit', modalEl);
    var form = qs('form', modalEl);

    var dateStart = qs('#substDateStart', modalEl);
    var dateEnd = qs('#substDateEnd', modalEl);
    var weekdayGroup = qs('#substWeekdayGroup', modalEl);
    var allDayCheck = qs('#substAllDay', modalEl);
    var periodStart = qs('#substPeriodStart', modalEl);
    var periodEnd = qs('#substPeriodEnd', modalEl);
    var reasonInput = qs('#substReason', modalEl);

    var mode = 'add';
    var recordName = '';

    // 星期天數：兩日期皆有值且不同天才顯示
    function updateWeekdayVisibility() {
      var isRange = dateStart.value && dateEnd.value && dateStart.value !== dateEnd.value;
      weekdayGroup.hidden = !isRange;
      if (!isRange) {
        qsa('input[type="checkbox"]', weekdayGroup).forEach(function (input) {
          input.checked = false;
        });
      }
    }

    dateStart.addEventListener('change', function () {
      // 使用者選擇開始日期後，結束日期同步為同一天（可再自行改為跨日）
      dateEnd.value = dateStart.value;
      updateWeekdayVisibility();
    });
    dateEnd.addEventListener('change', updateWeekdayVisibility);

    // 全天：節次自動帶入第一節～第七節並鎖定
    allDayCheck.addEventListener('change', function () {
      if (allDayCheck.checked) {
        periodStart.value = '1';
        periodEnd.value = '7';
      }
      periodStart.disabled = allDayCheck.checked;
      periodEnd.disabled = allDayCheck.checked;
    });

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      mode = (trigger && trigger.dataset.modalMode === 'edit') ? 'edit' : 'add';
      recordName = (trigger && trigger.dataset.recordName) || '';

      form.reset();
      periodStart.disabled = false;
      periodEnd.disabled = false;

      if (mode === 'edit') {
        titleText.textContent = '編輯調代(兼)課管理';
        descEl.textContent = '檢視或修改此筆調代(兼)課基本資料與節次。';
        submitBtn.textContent = '確定更新';
        // 後端：編輯模式由後端回填全部欄位，以下僅前端示意（跨日展示星期天數）
        dateStart.value = '2025-06-30';
        dateEnd.value = '2025-07-04';
        qs('#substWd1', modalEl).checked = true;
        qs('#substWd5', modalEl).checked = true;
        reasonInput.value = '因公出差，惠請協助安排調代課事宜';
      } else {
        titleText.textContent = '新增調代(兼)課管理';
        descEl.textContent = '新增此筆調代(兼)課基本資料與節次。';
        submitBtn.textContent = '確定新增';
      }

      updateWeekdayVisibility();
      window.syncTextareaCounter(reasonInput);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      if (mode === 'edit') {
        hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + (recordName || '調代課紀錄') + '-調代(兼)課管理”');
      } else {
        // 新增成功：顯示含檢驗提示的手動關閉版回饋
        hideThenManualFeedback(modalEl);
      }
    });
  }

  /* ------------------------------------------------------------------
     學生出缺勤 Modal（學務管理）：新增/編輯/衝突修正共用
     - data-modal-mode="add|edit|conflict" 由觸發按鈕帶入
     - 代課日期同步、星期天數顯隱、全天節次、事由字數統計：邏輯同調代(兼)課 Modal
     - conflict 模式：顯示衝突警示框與衝突原因，並提供「儲存並修正」/「解除衝突」雙動作
  ------------------------------------------------------------------ */
  function initAttendanceModal() {
    var modalEl = document.getElementById('attendanceModal');
    if (!modalEl) { return; }

    var titleText = qs('.data-modal-title-text', modalEl);
    var descEl = qs('.data-modal-desc', modalEl);
    var submitBtn = qs('.data-modal-submit', modalEl);
    var form = qs('form', modalEl);
    var infoBar = qs('.substitute-info-bar', modalEl);
    var conflictBox = qs('.attendance-conflict-alert', modalEl);
    var conflictReasonText = qs('.attendance-conflict-alert-text', modalEl);
    var unlockBtn = qs('#attUnlockBtn', modalEl);

    var dateStart = qs('#attDateStart', modalEl);
    var dateEnd = qs('#attDateEnd', modalEl);
    var weekdayGroup = qs('#attWeekdayGroup', modalEl);
    var allDayCheck = qs('#attAllDay', modalEl);
    var periodStart = qs('#attPeriodStart', modalEl);
    var periodEnd = qs('#attPeriodEnd', modalEl);
    var reasonInput = qs('#attReason', modalEl);

    var mode = 'add';
    var recordName = '';

    // 星期天數：兩日期皆有值且不同天才顯示
    function updateWeekdayVisibility() {
      var isRange = dateStart.value && dateEnd.value && dateStart.value !== dateEnd.value;
      weekdayGroup.hidden = !isRange;
      if (!isRange) {
        qsa('input[type="checkbox"]', weekdayGroup).forEach(function (input) {
          input.checked = false;
        });
      }
    }

    dateStart.addEventListener('change', function () {
      dateEnd.value = dateStart.value;
      updateWeekdayVisibility();
    });
    dateEnd.addEventListener('change', updateWeekdayVisibility);

    allDayCheck.addEventListener('change', function () {
      if (allDayCheck.checked) {
        periodStart.value = '1';
        periodEnd.value = '7';
      }
      periodStart.disabled = allDayCheck.checked;
      periodEnd.disabled = allDayCheck.checked;
    });

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      mode = (trigger && trigger.dataset.modalMode) || 'add';
      recordName = (trigger && trigger.dataset.recordName) || '';

      form.reset();
      periodStart.disabled = false;
      periodEnd.disabled = false;
      if (infoBar) { infoBar.hidden = mode === 'add'; }
      if (conflictBox) { conflictBox.hidden = mode !== 'conflict'; }
      if (unlockBtn) { unlockBtn.hidden = mode !== 'conflict'; }

      if (mode === 'conflict') {
        titleText.textContent = '修正衝突資料';
        descEl.textContent = '此筆資料與其他紀錄衝突，請確認欄位後儲存修正，或直接強制解除衝突標記。';
        submitBtn.textContent = '儲存並修正';
        // 後端：編輯模式由後端回填全部欄位，以下僅前端示意
        if (conflictReasonText) {
          conflictReasonText.textContent = (trigger && trigger.dataset.conflictReason) || '此筆紀錄與其他出缺勤資料衝突。';
        }
        dateStart.value = '2025-06-30';
        dateEnd.value = '2025-06-30';
        reasonInput.value = '因公出差，惠請協助確認出缺勤紀錄';
      } else if (mode === 'edit') {
        titleText.textContent = '編輯學生出缺勤紀錄';
        descEl.textContent = '檢視或修改此筆學生出缺勤資料明細。';
        submitBtn.textContent = '確定更新';
        dateStart.value = '2025-06-30';
        dateEnd.value = '2025-06-30';
        reasonInput.value = '因病於當日請假一節';
      } else {
        titleText.textContent = '新增學生出缺勤紀錄';
        descEl.textContent = '請填寫學生出缺勤資料明細。';
        submitBtn.textContent = '確定新增';
      }

      updateWeekdayVisibility();
      window.syncTextareaCounter(reasonInput);
    });

    // 解除衝突：不檢核表單內容，直接強制解除衝突標記（紅色回饋圖示）
    if (unlockBtn) {
      unlockBtn.addEventListener('click', function () {
        hideThenFeedback(
          modalEl,
          '衝突標記已強制解除',
          '你已強制解除“' + (recordName || '此筆出缺勤紀錄') + '”的衝突標記，請留意後續資料正確性。',
          { icon: 'bi-unlock-fill', variant: 'danger' }
        );
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      if (mode === 'conflict') {
        hideThenFeedback(modalEl, '資料已成功修正', '你已修正“' + (recordName || '此筆出缺勤紀錄') + '”並解除衝突標記。');
      } else if (mode === 'edit') {
        hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + (recordName || '學生出缺勤') + '”紀錄');
      } else {
        hideThenFeedback(modalEl, '資料新增成功', '你已送出“' + (recordName || '學生出缺勤') + '”紀錄');
      }
    });
  }

  /* ------------------------------------------------------------------
     學生出缺勤列表：「檢視衝突」篩選切換與「解除衝突」批次動作
     - 檢視衝突：切換 aria-pressed，僅顯示 data-conflict="true" 的資料列並顯示衝突原因欄
     - 解除衝突：有勾選則僅處理勾選的衝突列，否則處理全部衝突列
  ------------------------------------------------------------------ */
  function initAttendanceListView() {
    var wrap = document.querySelector('[data-attendance-table]');
    if (!wrap) { return; }

    var viewBtn = document.getElementById('attConflictViewBtn');
    var clearBtn = document.getElementById('attConflictClearBtn');
    var totalEl = document.querySelector('[data-attendance-total]');
    var rows = qsa('tbody tr', wrap);
    var conflictRows = rows.filter(function (row) { return row.dataset.conflict === 'true'; });

    function updateTotal() {
      if (!totalEl) { return; }
      totalEl.textContent = '';
      if (wrap.classList.contains('is-conflict-view')) {
        totalEl.appendChild(document.createTextNode('總筆數：' + conflictRows.length));
        var note = document.createElement('span');
        note.className = 'data-total-conflict-note';
        note.textContent = '（僅顯示衝突資料）';
        totalEl.appendChild(note);
      } else {
        totalEl.appendChild(document.createTextNode('總筆數：' + rows.length));
      }
    }

    if (viewBtn) {
      viewBtn.addEventListener('click', function () {
        var isActive = wrap.classList.toggle('is-conflict-view');
        viewBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        rows.forEach(function (row) {
          row.hidden = isActive && row.dataset.conflict !== 'true';
        });
        updateTotal();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var checkedConflictRows = conflictRows.filter(function (row) {
          var check = qs('[data-check-row]', row);
          return check && check.checked;
        });
        var targets = checkedConflictRows.length ? checkedConflictRows : conflictRows;
        if (!targets.length) { return; }
        // 後端：實際解除衝突由後端接手，以下僅前端示意
        showFeedback(
          '衝突標記已強制解除',
          '已強制解除 ' + targets.length + ' 筆出缺勤紀錄的衝突標記，請留意後續資料正確性。',
          { icon: 'bi-unlock-fill', variant: 'danger' }
        );
      });
    }

    updateTotal();
  }

  /* ------------------------------------------------------------------
     初始化
  ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     德育成績加減分輸入（學務管理）：編輯學生德育成績 Modal
     - 靜態背景（data-bs-backdrop="static"）：避免點擊外部誤觸而遺失已輸入成績
     - 全選勾選、清除勾選列成績資料、送出前逐列驗證加減分範圍
  ------------------------------------------------------------------ */
  function initMoralScoreModal() {
    var modalEl = document.getElementById('moralScoreModal');
    if (!modalEl) { return; }

    var form = qs('form', modalEl);
    var classInfoText = qs('.moral-class-info', modalEl);
    var teacherInfoText = qs('.moral-teacher-info', modalEl);
    // 全選與各列勾選雙向同步已由 main.js 的 initCheckAllGroups() 統一處理
    var rows = qsa('tbody tr', modalEl);
    var clearBtn = qs('#moralClearBtn', modalEl);

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      if (classInfoText) {
        classInfoText.textContent = '班級資訊：' + ((trigger && trigger.dataset.className) || '101 (國小低年級)');
      }
      if (teacherInfoText) {
        teacherInfoText.textContent = '授課老師：' + ((trigger && trigger.dataset.teacherName) || '1006 (李oo)');
      }
    });

    function clampInputs() {
      var valid = true;
      rows.forEach(function (row) {
        [
          { el: qs('.moral-input-de', row), min: -7, max: 7 },
          { el: qs('.moral-input-qun', row), min: -10, max: 10 }
        ].forEach(function (field) {
          if (!field.el || field.el.value === '') {
            if (field.el) { field.el.classList.remove('is-invalid'); }
            return;
          }
          var num = Number(field.el.value);
          var isValid = !isNaN(num) && num >= field.min && num <= field.max && Number.isInteger(num);
          field.el.classList.toggle('is-invalid', !isValid);
          if (!isValid) { valid = false; }
        });
      });
      return valid;
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var checkedRows = rows.filter(function (row) {
          var check = qs('[data-check-row]', row);
          return check && check.checked;
        });
        if (!checkedRows.length) { return; }
        checkedRows.forEach(function (row) {
          [qs('.moral-input-de', row), qs('.moral-input-qun', row), qs('.moral-input-comment', row)].forEach(function (input) {
            if (input) {
              input.value = '';
              input.classList.remove('is-invalid');
            }
          });
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!clampInputs()) { return; }
      hideThenFeedback(modalEl, '德育成績更新成功', '你已更新“' + ((classInfoText && classInfoText.textContent.replace('班級資訊：', '')) || '此班級') + '”之德育、群育加減分與評語紀錄。');
    });
  }

  /* ------------------------------------------------------------------
     成績輸入（成績管理）：編輯學生成績 Modal
     - 靜態背景（data-bs-backdrop="static"）：避免點擊外部誤觸而遺失已輸入成績
     - 全選勾選、清除勾選列成績資料、送出前逐列驗證成績範圍
  ------------------------------------------------------------------ */
  function initScoreModal() {
    var modalEl = document.getElementById('scoreModal');
    if (!modalEl) { return; }

    var form = qs('form', modalEl);
    var classInfoText = qs('.moral-class-info', modalEl);
    var teacherInfoText = qs('.moral-teacher-info', modalEl);
    // 全選與各列勾選雙向同步已由 main.js 的 initCheckAllGroups() 統一處理
    var rows = qsa('tbody tr', modalEl);
    var clearBtn = qs('#scoreClearBtn', modalEl);

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      if (classInfoText) {
        classInfoText.textContent = '班級資訊：' + ((trigger && trigger.dataset.className) || '101 (國小低年級)');
      }
      if (teacherInfoText) {
        teacherInfoText.textContent = '授課老師：' + ((trigger && trigger.dataset.teacherName) || '1006 (李oo)');
      }
    });

    function clampInputs() {
      var valid = true;
      rows.forEach(function (row) {
        var input = qs('.score-input', row);
        if (!input || input.value === '') {
          if (input) { input.classList.remove('is-invalid'); }
          return;
        }
        var num = Number(input.value);
        var isValid = !isNaN(num) && num >= 0 && num <= 100 && Number.isInteger(num);
        input.classList.toggle('is-invalid', !isValid);
        if (!isValid) { valid = false; }
      });
      return valid;
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var checkedRows = rows.filter(function (row) {
          var check = qs('[data-check-row]', row);
          return check && check.checked;
        });
        if (!checkedRows.length) { return; }
        checkedRows.forEach(function (row) {
          var input = qs('.score-input', row);
          if (input) {
            input.value = '';
            input.classList.remove('is-invalid');
          }
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!clampInputs()) { return; }
      hideThenFeedback(modalEl, '成績更新成功', '你已更新“' + ((classInfoText && classInfoText.textContent.replace('班級資訊：', '')) || '此班級') + '”之平時、學期分數。');
    });
  }

  /* ------------------------------------------------------------------
     德育成績計算作業（學務管理）：4 步驟結算動畫、報表區塊解鎖、報表下載
     - 尊重「減少動態效果」設定：略過 GIF 動畫，改用靜態圖示並縮短流程時間
     - 「開始結算」按鈕與學期別選單全程可見；下方狀態區在
       待命／進度／完成 三種狀態間切換
     - 需檢查學科結算狀態的報表（data-report-check="roster"）
       改顯示手動關閉版錯誤提示，導引使用者前往學科結算
  ------------------------------------------------------------------ */
  function initMoralCalc() {
    var startBtn = document.getElementById('calcStartBtn');
    var progress = document.getElementById('calcProgress');
    if (!startBtn || !progress) { return; }

    var progressText = document.getElementById('calcProgressText');
    var progressBarFill = document.getElementById('calcProgressBarFill');
    var progressPercent = document.getElementById('calcProgressPercent');
    var statusIdle = document.getElementById('calcStatusIdle');
    var statusComplete = document.getElementById('calcStatusComplete');
    var steps = qsa('.calc-step', progress);
    var lockOverlay = document.getElementById('calcReportLock');
    var reportContent = document.getElementById('calcReportContent');
    var timestampEl = document.getElementById('calcReportTimestamp');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setProgressPercent(percent) {
      if (progressBarFill) {
        progressBarFill.style.width = percent + '%';
        progressBarFill.setAttribute('aria-valuenow', String(percent));
      }
      if (progressPercent) { progressPercent.textContent = percent + '%'; }
    }

    function setStepState(index, state) {
      var step = steps[index];
      if (!step) { return; }
      step.classList.remove('calc-step--active', 'calc-step--done');
      var icon = qs('.calc-step-icon', step);
      var stateText = qs('.calc-step-state', step);
      if (state === 'active') {
        step.classList.add('calc-step--active');
        icon.innerHTML = reduceMotion ? '<i class="bi bi-arrow-repeat"></i>' : '<img src="img/gif/hourglass.gif" alt="">';
        if (stateText) { stateText.textContent = '處理中'; }
      } else if (state === 'done') {
        step.classList.add('calc-step--done');
        icon.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
        if (stateText) { stateText.textContent = '已完成'; }
      } else {
        icon.innerHTML = '<i class="bi bi-circle"></i>';
        if (stateText) { stateText.textContent = '等待中'; }
      }
    }

    function finishCalc() {
      if (lockOverlay) { lockOverlay.hidden = true; }
      if (reportContent) {
        reportContent.classList.remove('is-locked');
        reportContent.removeAttribute('aria-hidden');
      }
      if (timestampEl) { timestampEl.textContent = '上次結算時間：2025-06-30 14:20'; }
      startBtn.disabled = false;
      progress.hidden = true;
      if (statusComplete) { statusComplete.hidden = false; }
      if (window.ReportDependency) { window.ReportDependency.markModuleSettled('deyu_score'); }
      showFeedback('德育成績結算完成', '本學期學生操行成績已結算完成，您可至下方報表區下載相關報表。');
      redirectAfterFeedback();
    }

    startBtn.addEventListener('click', function () {
      startBtn.disabled = true;
      if (statusIdle) { statusIdle.hidden = true; }
      if (statusComplete) { statusComplete.hidden = true; }
      progress.hidden = false;
      setProgressPercent(0);
      steps.forEach(function (step, i) { setStepState(i, 'pending'); });
      if (progressText) { progressText.textContent = '正在為您結算德育成績，請稍候...'; }

      var stepDuration = reduceMotion ? 80 : 1100;
      var i = 0;

      function runStep() {
        if (i > 0) { setStepState(i - 1, 'done'); }
        if (i >= steps.length) {
          setProgressPercent(100);
          if (progressText) { progressText.textContent = '結算完成！'; }
          finishCalc();
          return;
        }
        setStepState(i, 'active');
        setProgressPercent(Math.round((i / steps.length) * 100));
        i += 1;
        window.setTimeout(runStep, stepDuration);
      }
      runStep();
    });

    // 名冊類報表：查詢方式切換（部別班級區間 ⇄ 學號），與學科下載方式同一套卡片式互動
    var rosterModeRadios = qsa('input[name="rosterFilterMode"]');
    var rosterClassOption = document.getElementById('rosterModeClassOption');
    var rosterStudentOption = document.getElementById('rosterModeStudentOption');
    if (rosterModeRadios.length && rosterClassOption && rosterStudentOption) {
      function applyRosterMode(isStudentMode) {
        rosterClassOption.classList.toggle('is-inactive', isStudentMode);
        rosterStudentOption.classList.toggle('is-inactive', !isStudentMode);
        qsa('select, input[type="text"]', rosterClassOption).forEach(function (el) { el.disabled = isStudentMode; });
        qsa('select, input[type="text"]', rosterStudentOption).forEach(function (el) { el.disabled = !isStudentMode; });
      }
      rosterModeRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          applyRosterMode(radio.value === 'student' && radio.checked);
        });
      });
      applyRosterMode(false);
    }

    qsa('.report-download-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.reportCheck === 'roster') {
          var manualEl = document.getElementById('feedbackManualModal');
          if (manualEl && window.bootstrap) { bootstrap.Modal.getOrCreateInstance(manualEl).show(); }
          return;
        }
        showFeedback('報表下載成功', '「' + (btn.dataset.reportName || '報表') + '」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     學科成績結算與報表中心（成績管理）：綠色 CTA 一鍵結算、4 步驟進度、
     報表下載區解鎖與下載方式切換
     - 與德育結算（initMoralCalc）同流程，差異：
       CTA 標題隨狀態改寫、資料狀態列（異動警示 ⇄ 已是最新）、
       下載方式雙欄選項以停用/淡化切換（不隱藏）
     - 「學生學籍表下載」（data-report-check="moral"）示意操行端尚未
       結算的錯誤情境，顯示手動關閉版提示並導引前往操行結算
  ------------------------------------------------------------------ */
  function initScoreCalc() {
    var startBtn = document.getElementById('scoreCalcStartBtn');
    var progress = document.getElementById('scoreCalcProgress');
    if (!startBtn || !progress) { return; }

    var ctaMain = document.getElementById('scoreCtaMain');
    var progressText = document.getElementById('scoreCalcProgressText');
    var progressBarFill = document.getElementById('scoreCalcProgressBarFill');
    var progressPercent = document.getElementById('scoreCalcProgressPercent');
    var statusIdle = document.getElementById('scoreCalcStatusIdle');
    var statusComplete = document.getElementById('scoreCalcStatusComplete');
    var steps = qsa('.calc-step', progress);
    var lockOverlay = document.getElementById('scoreReportLock');
    var reportContent = document.getElementById('scoreReportContent');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setProgressPercent(percent) {
      if (progressBarFill) {
        progressBarFill.style.width = percent + '%';
        progressBarFill.setAttribute('aria-valuenow', String(percent));
      }
      if (progressPercent) { progressPercent.textContent = percent + '%'; }
    }

    function setStepState(index, state) {
      var step = steps[index];
      if (!step) { return; }
      step.classList.remove('calc-step--active', 'calc-step--done');
      var icon = qs('.calc-step-icon', step);
      var stateText = qs('.calc-step-state', step);
      if (state === 'active') {
        step.classList.add('calc-step--active');
        icon.innerHTML = reduceMotion ? '<i class="bi bi-arrow-repeat"></i>' : '<img src="img/gif/hourglass.gif" alt="">';
        if (stateText) { stateText.textContent = '處理中'; }
      } else if (state === 'done') {
        step.classList.add('calc-step--done');
        icon.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
        if (stateText) { stateText.textContent = '已完成'; }
      } else {
        icon.innerHTML = '<i class="bi bi-circle"></i>';
        if (stateText) { stateText.textContent = '等待中'; }
      }
    }

    function setCtaTitle(text) {
      if (ctaMain) {
        ctaMain.innerHTML = '<i class="bi bi-hand-index-thumb" aria-hidden="true"></i>' + text;
      }
    }

    function finishCalc() {
      if (lockOverlay) { lockOverlay.hidden = true; }
      if (reportContent) {
        reportContent.classList.remove('is-locked');
        reportContent.removeAttribute('aria-hidden');
      }
      startBtn.disabled = false;
      setCtaTitle('學科成績 結算完成');
      progress.hidden = true;
      if (statusComplete) { statusComplete.hidden = false; }
      if (window.ReportDependency) { window.ReportDependency.markModuleSettled('xueke_score'); }
      showFeedback('學科成績結算完成', '本學期學科成績已結算完成，您可至下方報表下載區下載相關報表。');
      redirectAfterFeedback();
    }

    startBtn.addEventListener('click', function () {
      startBtn.disabled = true;
      setCtaTitle('開始執行 學科成績結算');
      if (statusIdle) { statusIdle.hidden = true; }
      if (statusComplete) { statusComplete.hidden = true; }
      progress.hidden = false;
      setProgressPercent(0);
      steps.forEach(function (step, i) { setStepState(i, 'pending'); });
      if (progressText) { progressText.textContent = '系統自動結算中，請稍候...'; }

      var stepDuration = reduceMotion ? 80 : 1100;
      var i = 0;

      function runStep() {
        if (i > 0) { setStepState(i - 1, 'done'); }
        if (i >= steps.length) {
          setProgressPercent(100);
          if (progressText) { progressText.textContent = '結算完成！'; }
          finishCalc();
          return;
        }
        setStepState(i, 'active');
        setProgressPercent(Math.round((i / steps.length) * 100));
        i += 1;
        window.setTimeout(runStep, stepDuration);
      }
      runStep();
    });

    // 下載方式切換（依部別/班級區間 ⇄ 指定學號）：停用未選取方式的欄位
    var modeRadios = qsa('input[name="scoreDownloadMode"]');
    var classOption = document.getElementById('scoreModeClassOption');
    var studentOption = document.getElementById('scoreModeStudentOption');
    if (modeRadios.length && classOption && studentOption) {
      function applyMode(isStudentMode) {
        classOption.classList.toggle('is-inactive', isStudentMode);
        studentOption.classList.toggle('is-inactive', !isStudentMode);
        qsa('select, input[type="text"]', classOption).forEach(function (el) { el.disabled = isStudentMode; });
        qsa('select, input[type="text"]', studentOption).forEach(function (el) { el.disabled = !isStudentMode; });
      }
      modeRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          applyMode(radio.value === 'student' && radio.checked);
        });
      });
      applyMode(false);
    }

    qsa('.score-download-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.reportCheck === 'moral') {
          var manualEl = document.getElementById('feedbackManualModal');
          if (manualEl && window.bootstrap) { bootstrap.Modal.getOrCreateInstance(manualEl).show(); }
          return;
        }
        showFeedback('報表下載成功', '「' + (btn.dataset.reportName || '報表') + '」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     缺曠獎懲配分設定（學務管理）：4 部別頁籤共用單一表單，儲存後顯示回饋
  ------------------------------------------------------------------ */
  function initScoreSettingsForm() {
    var form = document.getElementById('scoreSettingsForm');
    if (!form) { return; }

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出與驗證由後端接手
      showFeedback('配分設定儲存成功', '你已更新各部別缺曠獎懲配分設定。');
    });
  }

  /* ------------------------------------------------------------------
     學籍資料報表列印（各式報表列印 > 學籍資料）：3 頁籤共用
     - 頁籤標題／麵包屑隨目前啟用頁籤動態更新（監聽 tabs.js 的 tabs:activate 事件，
       並於初始化時手動同步一次，避免錯過 tabs.js 自身初始化時觸發的首次事件）
     - 學籍表查詢方式切換（部別班級區間 ⇄ 學號查詢）
     - 學籍表狀態徽章／說明／前往結算連結：統一透過 window.ReportDependency 判斷
     - 下載按鈕：狀態非「可下載」時，顯示手動關閉版提示並導引前往對應結算頁面
       （帶入 returnTo 參數，結算完成後可自動導回本頁對應頁籤）
  ------------------------------------------------------------------ */
  function initReportRollData() {
    var titleEl = document.getElementById('rollReportTitle');
    var breadcrumbEl = document.getElementById('rollReportBreadcrumbCurrent');
    if (!titleEl) { return; }

    var tabs = qsa('.tabs-nav[role="tablist"] [role="tab"]');

    function syncTitle(tab) {
      if (!tab) { return; }
      var label = tab.dataset.pageTitle || tab.textContent.trim();
      titleEl.textContent = label;
      if (breadcrumbEl) { breadcrumbEl.textContent = label; }
      document.title = label + ' - 國立彰化特殊教育學校 雲端校務管理系統';
    }

    document.addEventListener('tabs:activate', function (e) {
      if (tabs.indexOf(e.target) === -1) { return; }
      syncTitle(e.target);
    });

    // 手動同步一次：涵蓋 tabs.js 於自身 DOMContentLoaded 中已先行觸發、本頁尚未掛上監聽的初始狀態
    syncTitle(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);

    // 學籍表：查詢方式切換（依部別班級區間 ⇄ 依學號查詢）
    var rollModeRadios = qsa('input[name="rollFilterMode"]');
    var rollClassOption = document.getElementById('rollModeClassOption');
    var rollStudentOption = document.getElementById('rollModeStudentOption');
    var rollStudentQueryBtn = document.getElementById('rollStudentQueryBtn');
    var rollStudentId = document.getElementById('rollStudentId');
    var rollHasNoData = false; // 示意用：查詢學號 0000 模擬「無資料」狀態

    if (rollModeRadios.length && rollClassOption && rollStudentOption) {
      function applyRollMode(isStudentMode) {
        rollClassOption.classList.toggle('is-inactive', isStudentMode);
        rollStudentOption.classList.toggle('is-inactive', !isStudentMode);
        qsa('select, input[type="text"]', rollClassOption).forEach(function (el) { el.disabled = isStudentMode; });
        qsa('select, input[type="text"]', rollStudentOption).forEach(function (el) { el.disabled = !isStudentMode; });
        if (rollStudentQueryBtn) { rollStudentQueryBtn.disabled = !isStudentMode; }
        if (!isStudentMode) {
          rollHasNoData = false;
          renderRollStatus();
        }
      }
      rollModeRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          applyRollMode(radio.value === 'student' && radio.checked);
        });
      });
      applyRollMode(false);
    }

    if (rollStudentQueryBtn) {
      rollStudentQueryBtn.addEventListener('click', function () {
        var id = (rollStudentId && rollStudentId.value.trim()) || '';
        rollHasNoData = id === '0000';
        renderRollStatus();
      });
    }

    // 學籍表狀態徽章／說明／前往結算連結
    function renderRollStatus() {
      if (!window.ReportDependency) { return; }
      var badge = document.getElementById('rollStatusBadge');
      var desc = document.getElementById('rollStatusDesc');
      var action = document.getElementById('rollStatusAction');
      var result = window.ReportDependency.getReportStatus('studentRoll', { hasNoMatchingData: rollHasNoData });

      if (badge) {
        badge.className = 'report-status-badge ' + result.badgeClass;
        badge.innerHTML = '<i class="bi ' + result.icon + '" aria-hidden="true"></i>' + result.label;
      }
      if (desc) { desc.textContent = result.tooltip; }
      if (action) {
        if (result.settlePage) {
          action.hidden = false;
          action.textContent = result.settleLabel;
          action.href = result.settlePage + '?returnTo=' + encodeURIComponent('reportRollData.html#tab-roll');
        } else {
          action.hidden = true;
        }
      }
    }
    renderRollStatus();

    // 下載按鈕：依 data-report-key 取得目前狀態，非可下載時顯示手動關閉版提示
    qsa('.report-download-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reportKey;
        var status = (window.ReportDependency && key)
          ? window.ReportDependency.getReportStatus(key, key === 'studentRoll' ? { hasNoMatchingData: rollHasNoData } : undefined)
          : null;

        if (status && status.status !== window.ReportDependency.STATUS.AVAILABLE) {
          var manualEl = document.getElementById('feedbackManualModal');
          if (!manualEl || !window.bootstrap) { return; }
          var manualTitle = qs('#feedbackManualModalTitle', manualEl);
          var manualDesc = qs('#feedbackManualModalDesc', manualEl);
          var manualAction = qs('#feedbackManualModalAction', manualEl);
          if (manualTitle) { manualTitle.textContent = status.status === 'nodata' ? '尚無資料可產出' : '目前無法下載'; }
          if (manualDesc) { manualDesc.textContent = status.tooltip; }
          if (manualAction) {
            if (status.settlePage) {
              manualAction.hidden = false;
              manualAction.textContent = status.settleLabel;
              manualAction.href = status.settlePage + '?returnTo=' + encodeURIComponent('reportRollData.html#tab-roll');
            } else {
              manualAction.hidden = true;
            }
          }
          bootstrap.Modal.getOrCreateInstance(manualEl).show();
          return;
        }

        showFeedback('報表下載成功', '「' + (btn.dataset.reportName || '報表') + '」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     學務報表列印（各式報表列印 > 學務報表）：2 頁籤共用
     - 頁籤標題／麵包屑隨目前啟用頁籤動態更新，作法同 initReportRollData()
     - 兩頁籤（學生出缺勤 / 獎懲紀錄統計表）皆依賴德育成績結算，
       狀態徽章／說明／前往結算連結統一透過 window.ReportDependency 判斷
     - 下載按鈕：狀態非「可下載」時，顯示手動關閉版提示並導引前往德育結算頁面
       （帶入 returnTo 參數，結算完成後可自動導回本頁對應頁籤）
  ------------------------------------------------------------------ */
  function initReportAffairsData() {
    var titleEl = document.getElementById('affairsReportTitle');
    var breadcrumbEl = document.getElementById('affairsReportBreadcrumbCurrent');
    if (!titleEl) { return; }

    var tabs = qsa('.tabs-nav[role="tablist"] [role="tab"]');

    function syncTitle(tab) {
      if (!tab) { return; }
      var label = tab.dataset.pageTitle || tab.textContent.trim();
      titleEl.textContent = label;
      if (breadcrumbEl) { breadcrumbEl.textContent = label; }
      document.title = label + ' - 國立彰化特殊教育學校 雲端校務管理系統';
    }

    document.addEventListener('tabs:activate', function (e) {
      if (tabs.indexOf(e.target) === -1) { return; }
      syncTitle(e.target);
    });

    // 手動同步一次：涵蓋 tabs.js 於自身 DOMContentLoaded 中已先行觸發、本頁尚未掛上監聽的初始狀態
    syncTitle(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);

    // 兩頁籤狀態徽章／說明／前往結算連結（皆依賴德育成績結算）
    function renderStatus(reportKey, badgeId, descId, actionId, tabHash) {
      if (!window.ReportDependency) { return; }
      var badge = document.getElementById(badgeId);
      var desc = document.getElementById(descId);
      var action = document.getElementById(actionId);
      var result = window.ReportDependency.getReportStatus(reportKey);

      if (badge) {
        badge.className = 'report-status-badge ' + result.badgeClass;
        badge.innerHTML = '<i class="bi ' + result.icon + '" aria-hidden="true"></i>' + result.label;
      }
      if (desc) { desc.textContent = result.tooltip; }
      if (action) {
        if (result.settlePage) {
          action.hidden = false;
          action.textContent = result.settleLabel;
          action.href = result.settlePage + '?returnTo=' + encodeURIComponent('reportAffairsData.html#' + tabHash);
        } else {
          action.hidden = true;
        }
      }
    }
    renderStatus('studentAttendanceReport', 'attStatusBadge', 'attStatusDesc', 'attStatusAction', 'tab-attendance');
    renderStatus('rewardPunishmentReport', 'rewardStatusBadge', 'rewardStatusDesc', 'rewardStatusAction', 'tab-reward');

    // 下載按鈕：依 data-report-key 取得目前狀態，非可下載時顯示手動關閉版提示
    qsa('.report-download-btn', document).forEach(function (btn) {
      if (!btn.closest('#panel-attendance') && !btn.closest('#panel-reward')) { return; }
      btn.addEventListener('click', function () {
        var key = btn.dataset.reportKey;
        var status = (window.ReportDependency && key) ? window.ReportDependency.getReportStatus(key) : null;
        var tabHash = btn.closest('#panel-attendance') ? 'tab-attendance' : 'tab-reward';

        if (status && status.status !== window.ReportDependency.STATUS.AVAILABLE) {
          var manualEl = document.getElementById('feedbackManualModal');
          if (!manualEl || !window.bootstrap) { return; }
          var manualTitle = qs('#feedbackManualModalTitle', manualEl);
          var manualDesc = qs('#feedbackManualModalDesc', manualEl);
          var manualAction = qs('#feedbackManualModalAction', manualEl);
          if (manualTitle) { manualTitle.textContent = status.status === 'nodata' ? '尚無資料可產出' : '目前無法下載'; }
          if (manualDesc) { manualDesc.textContent = status.tooltip; }
          if (manualAction) {
            if (status.settlePage) {
              manualAction.hidden = false;
              manualAction.textContent = status.settleLabel;
              manualAction.href = status.settlePage + '?returnTo=' + encodeURIComponent('reportAffairsData.html#' + tabHash);
            } else {
              manualAction.hidden = true;
            }
          }
          bootstrap.Modal.getOrCreateInstance(manualEl).show();
          return;
        }

        showFeedback('報表下載成功', '「' + (btn.dataset.reportName || '報表') + '」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     成績單類報表列印（各式報表列印 > 成績單，reportScoreSheet.html）：
     單一篩選面板＋3 顆下載按鈕（不分頁籤，麵包屑／標題同步邏輯見頁面內
     inline script，此處只處理篩選互動與下載狀態）
     - 查詢方式切換（依部別班級區間 ⇄ 依學號查詢），邏輯同 initReportRollData()
     - 3 顆下載按鈕各自狀態徽章：統一透過 window.ReportDependency 判斷，
       三者共用同一組篩選條件（含「無資料」模擬），僅 reportKey 不同
     - 下載按鈕：狀態非「可下載」時，顯示手動關閉版提示並導引前往對應結算頁面
  ------------------------------------------------------------------ */
  function initReportScoreSheet() {
    var panelEl = document.getElementById('scoreSheetFilterPanel');
    if (!panelEl) { return; }

    // 查詢方式切換（依部別班級區間 ⇄ 依學號查詢）
    var modeRadios = qsa('input[name="scoreSheetFilterMode"]');
    var classOption = document.getElementById('scoreSheetModeClassOption');
    var studentOption = document.getElementById('scoreSheetModeStudentOption');
    var studentQueryBtn = document.getElementById('scoreSheetStudentQueryBtn');
    var studentIdInput = document.getElementById('scoreSheetStudentId');
    var hasNoMatchingData = false; // 示意用：查詢學號 0000 模擬「無資料」狀態

    // 3 顆下載按鈕各自狀態徽章／說明／前往結算連結
    // 須在下方 applyMode(false) 同步觸發 renderAllStatus() 之前宣告，避免 REPORT_KEYS 尚未賦值就被讀取
    var REPORT_KEYS = ['conductRollAll', 'conductRollClass', 'studentScoreSheet'];

    function renderStatus(key) {
      if (!window.ReportDependency) { return; }
      var badge = document.getElementById(key + 'Badge');
      var desc = document.getElementById(key + 'Desc');
      var action = document.getElementById(key + 'Action');
      var result = window.ReportDependency.getReportStatus(key, { hasNoMatchingData: hasNoMatchingData });

      if (badge) {
        badge.className = 'report-status-badge ' + result.badgeClass;
        badge.innerHTML = '<i class="bi ' + result.icon + '" aria-hidden="true"></i>' + result.label;
      }
      if (desc) { desc.textContent = result.tooltip; }
      if (action) {
        if (result.settlePage) {
          action.hidden = false;
          action.textContent = result.settleLabel;
          action.href = result.settlePage + '?returnTo=' + encodeURIComponent('reportScoreSheet.html#' + key);
        } else {
          action.hidden = true;
        }
      }
    }

    function renderAllStatus() {
      REPORT_KEYS.forEach(renderStatus);
    }

    if (modeRadios.length && classOption && studentOption) {
      function applyMode(isStudentMode) {
        classOption.classList.toggle('is-inactive', isStudentMode);
        studentOption.classList.toggle('is-inactive', !isStudentMode);
        qsa('select, input[type="text"]', classOption).forEach(function (el) { el.disabled = isStudentMode; });
        qsa('select, input[type="text"]', studentOption).forEach(function (el) { el.disabled = !isStudentMode; });
        if (studentQueryBtn) { studentQueryBtn.disabled = !isStudentMode; }
        if (!isStudentMode) {
          hasNoMatchingData = false;
          renderAllStatus();
        }
      }
      modeRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          applyMode(radio.value === 'student' && radio.checked);
        });
      });
      applyMode(false);
    }

    if (studentQueryBtn) {
      studentQueryBtn.addEventListener('click', function () {
        var id = (studentIdInput && studentIdInput.value.trim()) || '';
        hasNoMatchingData = id === '0000';
        renderAllStatus();
      });
    }

    renderAllStatus();

    // 下載按鈕：依 data-report-key 取得目前狀態，非可下載時顯示手動關閉版提示
    qsa('.report-download-btn', panelEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reportKey;
        var status = (window.ReportDependency && key)
          ? window.ReportDependency.getReportStatus(key, { hasNoMatchingData: hasNoMatchingData })
          : null;

        if (status && status.status !== window.ReportDependency.STATUS.AVAILABLE) {
          var manualEl = document.getElementById('feedbackManualModal');
          if (!manualEl || !window.bootstrap) { return; }
          var manualTitle = qs('#feedbackManualModalTitle', manualEl);
          var manualDesc = qs('#feedbackManualModalDesc', manualEl);
          var manualAction = qs('#feedbackManualModalAction', manualEl);
          if (manualTitle) { manualTitle.textContent = status.status === 'nodata' ? '尚無資料可產出' : '目前無法下載'; }
          if (manualDesc) { manualDesc.textContent = status.tooltip; }
          if (manualAction) {
            if (status.settlePage) {
              manualAction.hidden = false;
              manualAction.textContent = status.settleLabel;
              manualAction.href = status.settlePage + '?returnTo=' + encodeURIComponent('reportScoreSheet.html#' + key);
            } else {
              manualAction.hidden = true;
            }
          }
          bootstrap.Modal.getOrCreateInstance(manualEl).show();
          return;
        }

        showFeedback('報表下載成功', '「' + (btn.dataset.reportName || '報表') + '」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     新生/畢(結)業生報表列印（各式報表列印 > 新生/畢(結)業生報表，
     reportGraduateData.html）：2 頁籤共用
     - 頁籤標題／麵包屑隨目前啟用頁籤動態更新，作法同 initReportRollData()
     - 兩頁籤皆不依賴結算模組（REPORT_DEPENDENCIES 對應 key 皆為空陣列），
       「無資料」狀態改由查詢條件模擬：學年度選單選到示意用的舊學年度
       （112學年度）時觸發，兩頁籤各自獨立判斷
     - 頁籤一「畢(結)業名冊」PDF／Excel 兩顆下載按鈕共用同一組查詢條件，
       但各自獨立的狀態徽章（分屬不同 reportKey）
     - 下載按鈕：狀態非「可下載」時，顯示手動關閉版提示（無依賴結算模組，
       恆不顯示「前往結算」捷徑）
  ------------------------------------------------------------------ */
  function initReportGraduateData() {
    var titleEl = document.getElementById('gradReportTitle');
    var breadcrumbEl = document.getElementById('gradReportBreadcrumbCurrent');
    if (!titleEl) { return; }

    var tabs = qsa('.tabs-nav[role="tablist"] [role="tab"]');

    function syncTitle(tab) {
      if (!tab) { return; }
      var label = tab.dataset.pageTitle || tab.textContent.trim();
      titleEl.textContent = label;
      if (breadcrumbEl) { breadcrumbEl.textContent = label; }
      document.title = label + ' - 國立彰化特殊教育學校 雲端校務管理系統';
    }

    document.addEventListener('tabs:activate', function (e) {
      if (tabs.indexOf(e.target) === -1) { return; }
      syncTitle(e.target);
    });

    // 手動同步一次：涵蓋 tabs.js 於自身 DOMContentLoaded 中已先行觸發、本頁尚未掛上監聽的初始狀態
    syncTitle(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);

    function renderStatus(reportKey, badgeId, descId, actionId, hasNoMatchingData) {
      if (!window.ReportDependency) { return; }
      var badge = document.getElementById(badgeId);
      var desc = document.getElementById(descId);
      var action = document.getElementById(actionId);
      var result = window.ReportDependency.getReportStatus(reportKey, { hasNoMatchingData: hasNoMatchingData });

      if (badge) {
        badge.className = 'report-status-badge ' + result.badgeClass;
        badge.innerHTML = '<i class="bi ' + result.icon + '" aria-hidden="true"></i>' + result.label;
      }
      if (desc) { desc.textContent = result.tooltip; }
      if (action) { action.hidden = !result.settlePage; }
    }

    // 頁籤一：畢(結)業名冊（學年度選到 112學年度＝示意用「查無資料」）
    var rollYearSelect = document.getElementById('gradRollYear');
    var rollHasNoData = false;

    function renderRollStatus() {
      renderStatus('畢(結)業名冊_PDF', 'gradRollPdfBadge', 'gradRollPdfDesc', 'gradRollPdfAction', rollHasNoData);
      renderStatus('畢(結)業名冊_Excel', 'gradRollExcelBadge', 'gradRollExcelDesc', 'gradRollExcelAction', rollHasNoData);
    }

    if (rollYearSelect) {
      rollYearSelect.addEventListener('change', function () {
        rollHasNoData = rollYearSelect.value === '3';
        renderRollStatus();
      });
    }
    renderRollStatus();

    // 頁籤二：新生(畢業)報局用表（邏輯同上，獨立一組學年度示意判斷）
    var formYearSelect = document.getElementById('gradFormYear');
    var formHasNoData = false;

    function renderFormStatus() {
      renderStatus('新生(畢業)報局用表', 'gradFormStatusBadge', 'gradFormStatusDesc', 'gradFormStatusAction', formHasNoData);
    }

    if (formYearSelect) {
      formYearSelect.addEventListener('change', function () {
        formHasNoData = formYearSelect.value === '3';
        renderFormStatus();
      });
    }
    renderFormStatus();

    // 下載按鈕：依 data-report-key 取得目前狀態，非可下載時顯示手動關閉版提示
    qsa('.report-download-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reportKey;
        var hasNoData = btn.closest('#panel-roster') ? rollHasNoData : formHasNoData;
        var status = (window.ReportDependency && key)
          ? window.ReportDependency.getReportStatus(key, { hasNoMatchingData: hasNoData })
          : null;

        if (status && status.status !== window.ReportDependency.STATUS.AVAILABLE) {
          var manualEl = document.getElementById('feedbackManualModal');
          if (!manualEl || !window.bootstrap) { return; }
          var manualTitle = qs('#feedbackManualModalTitle', manualEl);
          var manualDesc = qs('#feedbackManualModalDesc', manualEl);
          var manualAction = qs('#feedbackManualModalAction', manualEl);
          if (manualTitle) { manualTitle.textContent = status.status === 'nodata' ? '尚無資料可產出' : '目前無法下載'; }
          if (manualDesc) { manualDesc.textContent = status.tooltip; }
          if (manualAction) { manualAction.hidden = !status.settlePage; }
          bootstrap.Modal.getOrCreateInstance(manualEl).show();
          return;
        }

        showFeedback('報表下載成功', '「' + (btn.dataset.reportName || '報表') + '」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     各式報表列印 > 代(兼)課相關報表 > 教師代(兼)課時數統計表（reportSubstituteHours.html）
     - 單一篩選面板、單一下載按鈕，不分頁籤，不依賴德育/學科結算模組
     - 「查無資料」示意：結束日期早於起始日期時觸發
  ------------------------------------------------------------------ */
  function initReportSubstituteHours() {
    var panelEl = document.getElementById('subHoursFilterPanel');
    if (!panelEl) { return; }

    var dateStart = document.getElementById('subHoursDateStart');
    var dateEnd = document.getElementById('subHoursDateEnd');
    var hasNoMatchingData = false;

    function renderStatus() {
      if (!window.ReportDependency) { return; }
      var badge = document.getElementById('subHoursStatusBadge');
      var desc = document.getElementById('subHoursStatusDesc');
      var action = document.getElementById('subHoursStatusAction');
      var result = window.ReportDependency.getReportStatus('substituteHoursReport', { hasNoMatchingData: hasNoMatchingData });

      if (badge) {
        badge.className = 'report-status-badge ' + result.badgeClass;
        badge.innerHTML = '<i class="bi ' + result.icon + '" aria-hidden="true"></i>' + result.label;
      }
      if (desc) { desc.textContent = result.tooltip; }
      if (action) { action.hidden = !result.settlePage; }
    }

    function checkDateRange() {
      hasNoMatchingData = !!(dateStart && dateEnd && dateStart.value && dateEnd.value && dateEnd.value < dateStart.value);
      renderStatus();
    }

    if (dateStart) { dateStart.addEventListener('change', checkDateRange); }
    if (dateEnd) { dateEnd.addEventListener('change', checkDateRange); }
    renderStatus();

    qsa('.report-download-btn', panelEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reportKey;
        var status = (window.ReportDependency && key)
          ? window.ReportDependency.getReportStatus(key, { hasNoMatchingData: hasNoMatchingData })
          : null;

        if (status && status.status !== window.ReportDependency.STATUS.AVAILABLE) {
          var manualEl = document.getElementById('feedbackManualModal');
          if (!manualEl || !window.bootstrap) { return; }
          var manualTitle = qs('#feedbackManualModalTitle', manualEl);
          var manualDesc = qs('#feedbackManualModalDesc', manualEl);
          var manualAction = qs('#feedbackManualModalAction', manualEl);
          if (manualTitle) { manualTitle.textContent = status.status === 'nodata' ? '尚無資料可產出' : '目前無法下載'; }
          if (manualDesc) { manualDesc.textContent = status.tooltip; }
          if (manualAction) { manualAction.hidden = !status.settlePage; }
          bootstrap.Modal.getOrCreateInstance(manualEl).show();
          return;
        }

        var checkedType = panelEl.querySelector('input[name="subHoursReportType"]:checked');
        var typeLabel = checkedType ? qs('label[for="' + checkedType.id + '"]', panelEl) : null;
        var reportName = typeLabel ? typeLabel.textContent.trim() : '教師代(兼)課時數統計表';
        showFeedback('報表下載成功', '「' + reportName + '(Excel)」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    });
  }

  /* ------------------------------------------------------------------
     各式報表列印 > 代(兼)課相關報表 > 代(兼)課通知單（reportSubstituteNotice.html）
     - 教師選擇區沿用 classPlacement.html 的穿梭清單元件（setupTransfer()）
     - 右欄「尚未選擇教師」依部別＋日期區間連動過濾：於 setupTransfer() 掛好
       關鍵字搜尋監聽之後，另外掛上自己的 change/input 監聽，同時考量
       關鍵字＋部別＋日期三項條件，避免與 setupTransfer() 內建的搜尋邏輯互相覆蓋
     - 不依賴德育/學科結算模組，「查無資料」僅在已指定日期區間、且左右兩欄
       （已選擇＋尚未選擇）皆無符合部別＋日期條件之教師時顯示，
       不因使用者手動移動教師（全選添加等操作）而觸發
  ------------------------------------------------------------------ */
  function initReportSubstituteNotice() {
    var formEl = document.getElementById('substNoticeFilterForm');
    if (!formEl) { return; }

    setupTransfer(formEl);

    var dateStart = document.getElementById('substNoticeDateStart');
    var dateEnd = document.getElementById('substNoticeDateEnd');
    var deptSelect = document.getElementById('substNoticeDept');
    var unassignedPanel = qs('[data-transfer-panel="unassigned"]', formEl);
    var emptyMsg = document.getElementById('substNoticeEmptyMsg');

    function updateUnassignedMeta() {
      var all = qsa('.transfer-list > li', unassignedPanel);
      var visible = all.filter(function (li) { return !li.hidden; });
      var visibleChecked = visible.filter(function (li) { return qs('input', li).checked; });

      var countBadge = qs('[data-transfer-count]', unassignedPanel);
      if (countBadge) { countBadge.textContent = all.length; }

      var selectedBadge = qs('[data-transfer-selected]', unassignedPanel);
      if (selectedBadge) {
        selectedBadge.textContent = all.filter(function (li) { return qs('input', li).checked; }).length;
      }

      var checkAll = qs('[data-transfer-checkall]', unassignedPanel);
      if (checkAll) {
        checkAll.checked = visible.length > 0 && visibleChecked.length === visible.length;
        checkAll.indeterminate = visibleChecked.length > 0 && visibleChecked.length < visible.length;
      }
    }

    // 判斷目前部別＋日期區間條件下，是否有任何教師（不論目前在哪一欄）符合，
    // 用來決定「查無資料」，不受使用者移動教師的操作影響
    function hasAnyMatchingRecord() {
      var deptVal = deptSelect ? deptSelect.value : '';
      var start = dateStart ? dateStart.value : '';
      var end = dateEnd ? dateEnd.value : '';

      return qsa('.transfer-list > li', formEl).some(function (li) {
        if (deptVal && li.dataset.dept !== deptVal) { return false; }
        var dates = (li.dataset.dates || '').split(',').filter(Boolean);
        return dates.some(function (d) { return (!start || d >= start) && (!end || d <= end); });
      });
    }

    function toggleEmptyMessage() {
      if (!emptyMsg) { return; }
      var start = dateStart ? dateStart.value : '';
      var end = dateEnd ? dateEnd.value : '';
      emptyMsg.hidden = (!start && !end) || hasAnyMatchingRecord();
    }

    function applyUnassignedFilter() {
      var deptVal = deptSelect ? deptSelect.value : '';
      var start = dateStart ? dateStart.value : '';
      var end = dateEnd ? dateEnd.value : '';
      var search = qs('[data-transfer-search]', unassignedPanel);
      var keyword = search ? search.value.trim().toLowerCase() : '';

      qsa('.transfer-list > li', unassignedPanel).forEach(function (li) {
        var matchesKeyword = keyword === '' || li.textContent.toLowerCase().indexOf(keyword) !== -1;
        var matchesDept = !deptVal || li.dataset.dept === deptVal;
        var dates = (li.dataset.dates || '').split(',').filter(Boolean);
        var matchesDate = dates.some(function (d) { return (!start || d >= start) && (!end || d <= end); });
        li.hidden = !(matchesKeyword && matchesDept && matchesDate);
      });

      updateUnassignedMeta();
      toggleEmptyMessage();
    }

    if (dateStart) { dateStart.addEventListener('change', applyUnassignedFilter); }
    if (dateEnd) { dateEnd.addEventListener('change', applyUnassignedFilter); }
    if (deptSelect) { deptSelect.addEventListener('change', applyUnassignedFilter); }
    applyUnassignedFilter();

    // 下載按鈕：左欄需至少一位已選擇教師，否則顯示手動關閉版提示
    var downloadBtn = document.getElementById('substNoticeDownloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var assignedPanel = qs('[data-transfer-panel="assigned"]', formEl);
        var assignedCount = qsa('.transfer-list > li', assignedPanel).length;

        if (assignedCount === 0) {
          var manualEl = document.getElementById('feedbackManualModal');
          if (!manualEl || !window.bootstrap) { return; }
          var manualTitle = qs('#feedbackManualModalTitle', manualEl);
          var manualDesc = qs('#feedbackManualModalDesc', manualEl);
          var manualAction = qs('#feedbackManualModalAction', manualEl);
          if (manualTitle) { manualTitle.textContent = '尚未選擇教師'; }
          if (manualDesc) { manualDesc.textContent = '請先於「尚未選擇教師」清單中，選擇至少一位需開立通知單的代(兼)課教師。'; }
          if (manualAction) { manualAction.hidden = true; }
          bootstrap.Modal.getOrCreateInstance(manualEl).show();
          return;
        }

        showFeedback('報表下載成功', '「代(兼)課通知單」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    }
  }

  /* ------------------------------------------------------------------
     IEP管理 > 學生/班級/教師課表（iepTimetable.html）
     - 頁籤二「學生課表」查詢方式切換（依部別班級區間 ⇄ 依學號查詢），沿用
       reportRollData.html 的 applyRollMode() 模式
     - 頁籤三「教師課表」教師選擇區沿用 reportSubstituteNotice.html 的穿梭清單元件
       （setupTransfer()），並依部別連動過濾「可選擇教師」清單
     - 三個頁籤的課表下載皆不依賴結算模組，恆為「可下載」狀態；僅教師課表於
       尚未選擇任何教師時，顯示手動關閉版提示
  ------------------------------------------------------------------ */
  function initIepTimetable() {
    var classTableBtn = document.querySelector('#panel-classTable .report-download-btn');
    if (!classTableBtn) { return; }

    // 頁籤一：班級課表下載
    classTableBtn.addEventListener('click', function () {
      showFeedback('報表下載成功', '「班級課表」已開始下載，請至瀏覽器下載紀錄查看。');
    });

    // 頁籤二：查詢方式切換（依部別班級區間 ⇄ 依學號查詢）
    var studentModeRadios = qsa('input[name="studentFilterMode"]');
    var studentClassOption = document.getElementById('studentModeClassOption');
    var studentStudentOption = document.getElementById('studentModeStudentOption');

    if (studentModeRadios.length && studentClassOption && studentStudentOption) {
      function applyStudentMode(isStudentMode) {
        studentClassOption.classList.toggle('is-inactive', isStudentMode);
        studentStudentOption.classList.toggle('is-inactive', !isStudentMode);
        qsa('select, input[type="text"]', studentClassOption).forEach(function (el) { el.disabled = isStudentMode; });
        qsa('select, input[type="text"]', studentStudentOption).forEach(function (el) { el.disabled = !isStudentMode; });
      }
      studentModeRadios.forEach(function (radio) {
        radio.addEventListener('change', function () {
          applyStudentMode(radio.value === 'student' && radio.checked);
        });
      });
      applyStudentMode(false);
    }

    var studentTableBtn = document.querySelector('#panel-studentTable .report-download-btn');
    if (studentTableBtn) {
      studentTableBtn.addEventListener('click', function () {
        showFeedback('報表下載成功', '「學生課表」已開始下載，請至瀏覽器下載紀錄查看。');
      });
    }

    // 頁籤三：教師課表，穿梭清單依部別連動過濾「可選擇教師」
    var teacherFormEl = document.getElementById('teacherTableFilterForm');
    if (teacherFormEl) {
      setupTransfer(teacherFormEl);

      var teacherDeptSelect = document.getElementById('teacherTableDept');
      var teacherUnassignedPanel = qs('[data-transfer-panel="unassigned"]', teacherFormEl);
      var teacherEmptyMsg = document.getElementById('teacherTableEmptyMsg');

      function updateTeacherUnassignedMeta() {
        var all = qsa('.transfer-list > li', teacherUnassignedPanel);
        var visible = all.filter(function (li) { return !li.hidden; });
        var visibleChecked = visible.filter(function (li) { return qs('input', li).checked; });

        var countBadge = qs('[data-transfer-count]', teacherUnassignedPanel);
        if (countBadge) { countBadge.textContent = all.length; }

        var selectedBadge = qs('[data-transfer-selected]', teacherUnassignedPanel);
        if (selectedBadge) {
          selectedBadge.textContent = all.filter(function (li) { return qs('input', li).checked; }).length;
        }

        var checkAll = qs('[data-transfer-checkall]', teacherUnassignedPanel);
        if (checkAll) {
          checkAll.checked = visible.length > 0 && visibleChecked.length === visible.length;
          checkAll.indeterminate = visibleChecked.length > 0 && visibleChecked.length < visible.length;
        }
      }

      function applyTeacherUnassignedFilter() {
        var deptVal = teacherDeptSelect ? teacherDeptSelect.value : '';
        var search = qs('[data-transfer-search]', teacherUnassignedPanel);
        var keyword = search ? search.value.trim().toLowerCase() : '';

        var anyVisible = false;
        qsa('.transfer-list > li', teacherUnassignedPanel).forEach(function (li) {
          var matchesKeyword = keyword === '' || li.textContent.toLowerCase().indexOf(keyword) !== -1;
          var matchesDept = !deptVal || li.dataset.dept === deptVal;
          li.hidden = !(matchesKeyword && matchesDept);
          if (!li.hidden) { anyVisible = true; }
        });

        updateTeacherUnassignedMeta();
        if (teacherEmptyMsg) { teacherEmptyMsg.hidden = !deptVal || anyVisible; }
      }

      if (teacherDeptSelect) { teacherDeptSelect.addEventListener('change', applyTeacherUnassignedFilter); }
      applyTeacherUnassignedFilter();

      var teacherDownloadBtn = document.getElementById('teacherTableDownloadBtn');
      if (teacherDownloadBtn) {
        teacherDownloadBtn.addEventListener('click', function () {
          var assignedPanel = qs('[data-transfer-panel="assigned"]', teacherFormEl);
          var assignedCount = qsa('.transfer-list > li', assignedPanel).length;

          if (assignedCount === 0) {
            var manualEl = document.getElementById('feedbackManualModal');
            if (!manualEl || !window.bootstrap) { return; }
            var manualTitle = qs('#feedbackManualModalTitle', manualEl);
            var manualDesc = qs('#feedbackManualModalDesc', manualEl);
            var manualAction = qs('#feedbackManualModalAction', manualEl);
            if (manualTitle) { manualTitle.textContent = '尚未選擇教師'; }
            if (manualDesc) { manualDesc.textContent = '請先於「可選擇教師」清單中，選擇至少一位教師。'; }
            if (manualAction) { manualAction.hidden = true; }
            bootstrap.Modal.getOrCreateInstance(manualEl).show();
            return;
          }

          showFeedback('報表下載成功', '「教師課表」已開始下載，請至瀏覽器下載紀錄查看。');
        });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFeedbackModal();
    initSubjectModal();
    initPlacementModal();
    initSeatModal();
    initCourseStudentModal();
    initTeacherSubjectModal();
    initSubstituteModal();
    initAttendanceModal();
    initAttendanceListView();
    initMoralScoreModal();
    initScoreModal();
    initMoralCalc();
    initScoreCalc();
    initScoreSettingsForm();
    initReportRollData();
    initReportAffairsData();
    initReportScoreSheet();
    initReportGraduateData();
    initReportSubstituteHours();
    initReportSubstituteNotice();
    initIepTimetable();
  });
})();
