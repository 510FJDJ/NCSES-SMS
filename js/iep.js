/* ==========================================================================
   IEP 管理專用腳本（Vanilla JS）
   - iepBasicInfo.html：完成狀態頁籤（全部／已完成／未完成）
     三頁籤共用同一面板，僅篩選列表列，故不走 js/tabs.js（該控制器
     以 aria-controls 對應多面板顯隱），改於此依 CLAUDE.md 第 8 節
     實作 roving tabindex 與方向鍵切換
   - iepBasicInfo_form.html：底部操作列（暫存草稿／儲存並送出審核／
     產生並匯出IEP報表）點擊後顯示回饋 Modal
   後端：實際查詢、暫存、送審與報表產出由後端接手，前端僅示意流程。
   ========================================================================== */
(function () {
  'use strict';

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  // 新增列固定插入表格最上方後，重新編排「序號」欄顯示順序（不影響各欄位 id/name）
  function renumberSeqCells(tbody) {
    qsa('tr', tbody).forEach(function (tr, index) {
      var seqCell = qs('td[data-label="序號"] .cell-value', tr);
      if (seqCell) { seqCell.textContent = index + 1; }
    });
  }

  // 表格至少須保留一筆資料：僅剩最後一列時，停用該列的刪除按鈕
  function syncRowDeleteButtonsState(tbody) {
    if (!tbody) { return; }
    var onlyOneLeft = qsa('tr', tbody).length <= 1;
    qsa('.iep-eval-delete-btn', tbody).forEach(function (btn) {
      btn.disabled = onlyOneLeft;
    });
  }

  /* ------------------------------------------------------------------
     回饋 Modal：帶入標題與訊息後顯示，3 秒倒數自動關閉
     （與 js/dataModal.js 的 showFeedback 同版型；IEP 頁不載入該檔）
  ------------------------------------------------------------------ */
  var feedbackTimer = null;

  function showFeedback(title, message, icon) {
    var modalEl = document.getElementById('feedbackModal');
    if (!modalEl || !window.bootstrap) { return; }

    qs('.feedback-title', modalEl).textContent = title;
    qs('.feedback-desc', modalEl).textContent = message;

    var iconEl = qs('.feedback-icon i', modalEl);
    if (iconEl) { iconEl.className = 'bi ' + (icon || 'bi-file-earmark-check'); }

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

  /* ------------------------------------------------------------------
     刪除確認 Modal：列表刪除按鈕點擊後彈出，待使用者按下「確定刪除」
     才會實際執行傳入的刪除動作；取消或關閉則不執行
  ------------------------------------------------------------------ */
  var deleteConfirmPendingAction = null;

  function showDeleteConfirm(message, onConfirm) {
    var modalEl = document.getElementById('deleteConfirmModal');
    if (!modalEl || !window.bootstrap) { return; }

    var descEl = document.getElementById('deleteConfirmModalDesc');
    if (descEl && message) { descEl.textContent = message; }

    deleteConfirmPendingAction = onConfirm;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function initDeleteConfirmModal() {
    var modalEl = document.getElementById('deleteConfirmModal');
    var confirmBtn = document.getElementById('deleteConfirmModalConfirmBtn');
    if (!modalEl || !confirmBtn) { return; }

    confirmBtn.addEventListener('click', function () {
      var action = deleteConfirmPendingAction;
      deleteConfirmPendingAction = null;
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      if (typeof action === 'function') { action(); }
    });

    // 使用者以 Esc 或點擊背景關閉時，視為取消，不執行刪除
    modalEl.addEventListener('hidden.bs.modal', function () {
      deleteConfirmPendingAction = null;
    });
  }

  /* ------------------------------------------------------------------
     完成狀態頁籤（列表頁）：依 data-iep-filter 篩選列表列
     - all：全部列；done：已完成；undone：未完成＋未開單(新轉入生)
     - 總筆數依頁籤的 data-iep-count 示意切換（後端：由查詢結果帶入）
  ------------------------------------------------------------------ */
  function initIepStatusTabs() {
    var tablist = document.getElementById('iepStatusTabs');
    if (!tablist) { return; }

    var tabs = qsa('[role="tab"]', tablist);
    if (!tabs.length) { return; }

    var panel = document.getElementById('panel-iepStudents');
    var totalEl = document.getElementById('iepTotalCount');
    var rows = qsa('#iepStudentRows tr');

    function activateTab(target, moveFocus) {
      tabs.forEach(function (tab) {
        var selected = tab === target;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle('is-active', selected);
      });

      // 面板名稱跟隨當前頁籤，供螢幕閱讀器辨識目前檢視的清單
      if (panel) { panel.setAttribute('aria-labelledby', target.id); }

      var filter = target.dataset.iepFilter;
      rows.forEach(function (row) {
        var status = row.dataset.iepStatus;
        var show = filter === 'all' ||
          (filter === 'done' ? status === 'done' : status !== 'done');
        row.classList.toggle('is-filtered-out', !show);
      });

      if (totalEl && target.dataset.iepCount) {
        totalEl.textContent = '總筆數：' + target.dataset.iepCount;
      }

      if (moveFocus) { target.focus(); }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tab, false);
      });
    });

    // ← / → 循環切換（即時啟用），Home / End 跳至頭尾
    tablist.addEventListener('keydown', function (e) {
      var currentIndex = tabs.indexOf(document.activeElement);
      if (currentIndex === -1) { return; }

      var nextIndex = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        activateTab(tabs[nextIndex], true);
      }
    });
  }

  /* ------------------------------------------------------------------
     底部操作列（明細頁）：三顆操作按鈕的回饋示意
  ------------------------------------------------------------------ */
  function initIepActionBar() {
    var draftBtn = document.getElementById('iepDraftBtn');
    var submitBtn = document.getElementById('iepSubmitBtn');
    var exportBtn = document.getElementById('iepExportBtn');

    if (draftBtn) {
      draftBtn.addEventListener('click', function () {
        showFeedback('草稿已暫存', '本次填寫內容已暫存，尚未送出審核；您可隨時回來繼續編輯。', 'bi-floppy');
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        showFeedback('儲存並送出審核成功', '此份 IEP 已儲存並送出審核，審核結果將另行通知。', 'bi-send-check');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「IEP 個別化教育計畫報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  /* ------------------------------------------------------------------
     完成狀態頁籤（教育目標資料管理列表頁）：依 data-iep-filter 篩選列表列
     - all／done／undone／evalmissing 四者與列狀態一對一對應（不同於
       initIepStatusTabs 的「未完成」需合併未開單列，此頁四種狀態互斥）
  ------------------------------------------------------------------ */
  function initEduGoalStatusTabs() {
    var tablist = document.getElementById('eduGoalStatusTabs');
    if (!tablist) { return; }

    var tabs = qsa('[role="tab"]', tablist);
    if (!tabs.length) { return; }

    var panel = document.getElementById('panel-eduGoalStudents');
    var totalEl = document.getElementById('eduGoalTotalCount');
    var rows = qsa('#eduGoalStudentRows tr');

    function activateTab(target, moveFocus) {
      tabs.forEach(function (tab) {
        var selected = tab === target;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle('is-active', selected);
      });

      if (panel) { panel.setAttribute('aria-labelledby', target.id); }

      var filter = target.dataset.iepFilter;
      rows.forEach(function (row) {
        var show = filter === 'all' || row.dataset.iepStatus === filter;
        row.classList.toggle('is-filtered-out', !show);
      });

      if (totalEl && target.dataset.iepCount) {
        totalEl.textContent = '總筆數：' + target.dataset.iepCount;
      }

      if (moveFocus) { target.focus(); }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tab, false);
      });
    });

    tablist.addEventListener('keydown', function (e) {
      var currentIndex = tabs.indexOf(document.activeElement);
      if (currentIndex === -1) { return; }

      var nextIndex = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        activateTab(tabs[nextIndex], true);
      }
    });
  }

  /* ------------------------------------------------------------------
     教育目標管理明細頁（iepEduGoal_form.html）
     - 快速引用詞句：選單值寫入對應文字框並同步字數統計
     - 頁籤鎖定：階段二需先完成階段一必填欄位並儲存才會解鎖
     - 評量明細表：新增／刪除列
     - 底部操作列：草稿／送出／匯出回饋
  ------------------------------------------------------------------ */
  function initEduGoalQuickRef() {
    qsa('[data-quickref-select]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var select = document.getElementById(btn.dataset.quickrefSelect);
        var target = document.getElementById(btn.dataset.quickrefTarget);
        if (!select || !target || !select.value) { return; }

        target.value = select.value;
        if (window.syncTextareaCounter) { window.syncTextareaCounter(target); }
        target.focus();
      });
    });
  }

  function initEduGoalStepLock() {
    var tablist = document.getElementById('eduGoalStepTabs');
    var step2Tab = document.getElementById('tab-eduStep2');
    var submitBtn = document.getElementById('eduGoalSubmitBtn');
    var presentLevel = document.getElementById('presentLevel');
    var syearTarget = document.getElementById('syearTarget');

    if (!tablist || !step2Tab || !submitBtn || !presentLevel || !syearTarget) { return; }

    function updateSubmitLabel() {
      var onStep2 = step2Tab.getAttribute('aria-selected') === 'true';
      submitBtn.innerHTML = onStep2
        ? '<i class="bi bi-check-lg" aria-hidden="true"></i>儲存並正式送出'
        : '<i class="bi bi-check-lg" aria-hidden="true"></i>儲存並進入評量明細';
    }

    tablist.addEventListener('tabs:activate', updateSubmitLabel);

    submitBtn.addEventListener('click', function () {
      var onStep2 = step2Tab.getAttribute('aria-selected') === 'true';

      if (onStep2) {
        showFeedback('儲存並正式送出成功', '本學期教育目標與評量明細已儲存並正式送出。', 'bi-send-check');
        return;
      }

      if (!presentLevel.checkValidity()) { presentLevel.reportValidity(); return; }
      if (!syearTarget.checkValidity()) { syearTarget.reportValidity(); return; }

      step2Tab.disabled = false;
      step2Tab.removeAttribute('data-edu-locked');
      var lockIcon = qs('.iep-tab-lock', step2Tab);
      if (lockIcon) { lockIcon.remove(); }

      showFeedback('儲存成功', '能力現況與學年目標已儲存，已為您開啟「學期目標與評量明細表」頁籤。', 'bi-unlock');
      step2Tab.click();
    });
  }

  function viewActionsMarkup() {
    return '' +
      '<button type="button" class="btn btn-primary iep-eval-edit-btn"><i class="bi bi-pencil" aria-hidden="true"></i>編輯</button>' +
      '<button type="button" class="btn btn-outline-danger iep-eval-delete-btn"><i class="bi bi-trash" aria-hidden="true"></i>刪除</button>';
  }

  function editActionsMarkup() {
    return '' +
      '<button type="button" class="btn btn-success iep-eval-save-btn"><i class="bi bi-check-lg" aria-hidden="true"></i>儲存</button>' +
      '<button type="button" class="btn iep-eval-cancel-btn"><i class="bi bi-x-lg" aria-hidden="true"></i>取消</button>';
  }

  function buildEvalRowMarkup(n) {
    return '' +
      '<td data-label="勾選"><span class="cell-value"><input class="form-check-input" type="checkbox" data-check-row aria-label="選取第' + n + '筆評量紀錄"></span></td>' +
      '<td data-label="序號"><span class="cell-value">' + n + '</span></td>' +
      '<td data-label="教學日期區間">' +
        '<span class="cell-value cell-value--start">' +
          '<div class="date-range date-range--stack">' +
            '<div class="date-range-item">' +
              '<input type="date" class="form-control" id="evalStart' + n + '" name="evalStart' + n + '" title="教學開始日期" aria-label="教學開始日期">' +
            '</div>' +
            '<span class="date-range-sep" aria-hidden="true">~</span>' +
            '<div class="date-range-item">' +
              '<input type="date" class="form-control" id="evalEnd' + n + '" name="evalEnd' + n + '" title="教學結束日期" aria-label="教學結束日期">' +
            '</div>' +
          '</div>' +
        '</span>' +
      '</td>' +
      '<td data-label="學期目標">' +
        '<span class="cell-value cell-value--start">' +
          '<label class="sr-only" for="evalTarget' + n + '">學期目標</label>' +
          '<textarea class="form-control" id="evalTarget' + n + '" name="evalTarget' + n + '" rows="2" title="學期目標" aria-label="學期目標"></textarea>' +
        '</span>' +
      '</td>' +
      '<td data-label="評量項目設定">' +
        '<span class="cell-value cell-value--start">' +
          '<div class="iep-eval-item-fields">' +
            '<input type="date" class="form-control" id="evalDate' + n + '" name="evalDate' + n + '" title="評量日期" aria-label="評量日期">' +
            '<label class="sr-only" for="evalMethod' + n + '">評量方式</label>' +
            '<select class="form-select" id="evalMethod' + n + '" name="evalMethod' + n + '" title="評量方式">' +
              '<option value="" selected>請選擇方式</option>' +
              '<option value="1">1. 觀察</option>' +
              '<option value="2">2. 口頭</option>' +
              '<option value="3">3. 指認</option>' +
              '<option value="4">4. 實作</option>' +
              '<option value="5">5. 書寫</option>' +
            '</select>' +
            '<label class="sr-only" for="evalCriteria' + n + '">評量標準</label>' +
            '<select class="form-select" id="evalCriteria' + n + '" name="evalCriteria' + n + '" title="評量標準">' +
              '<option value="" selected>請選擇標準</option>' +
              '<option value="A">A 能獨立完成</option>' +
              '<option value="B">B 能在直接口語提示下完成</option>' +
              '<option value="C">C 能在間接口語提示下完成</option>' +
              '<option value="D">D 能在手勢提示下完成</option>' +
            '</select>' +
          '</div>' +
        '</span>' +
      '</td>' +
      '<td data-label="評量結果">' +
        '<span class="cell-value">' +
          '<fieldset class="iep-eval-result">' +
            '<legend class="sr-only">第' + n + '筆評量結果</legend>' +
            '<div class="form-check">' +
              '<input class="form-check-input" type="radio" name="evalResult' + n + '" id="evalResultPass' + n + '" value="pass">' +
              '<label class="form-check-label" for="evalResultPass' + n + '">＋已通過</label>' +
            '</div>' +
            '<div class="form-check">' +
              '<input class="form-check-input" type="radio" name="evalResult' + n + '" id="evalResultFail' + n + '" value="fail">' +
              '<label class="form-check-label" for="evalResultFail' + n + '">－未通過</label>' +
            '</div>' +
          '</fieldset>' +
        '</span>' +
      '</td>' +
      '<td data-label="教學決定">' +
        '<span class="cell-value">' +
          '<div class="iep-eval-item">' +
            '<label class="sr-only" for="evalDecision' + n + '">教學決定</label>' +
            '<select class="form-select" id="evalDecision' + n + '" name="evalDecision' + n + '">' +
              '<option value="" selected>請選擇</option>' +
              '<option value="P">P 通過</option>' +
              '<option value="C">C 繼續</option>' +
              '<option value="G">G 重新評估</option>' +
            '</select>' +
          '</div>' +
        '</span>' +
      '</td>' +
      '<td data-label="功能">' +
        '<span class="cell-value">' +
          '<div class="iep-eval-row-actions">' + editActionsMarkup() + '</div>' +
        '</span>' +
      '</td>';
  }

  function initEduGoalEvalRows() {
    var tbody = document.getElementById('evalRows');
    var addBtn = document.getElementById('btnAddEvalRow');
    var deleteBtn = document.getElementById('btnDeleteEvalRow');
    if (!tbody || !addBtn || !deleteBtn) { return; }

    syncRowDeleteButtonsState(tbody);

    addBtn.addEventListener('click', function () {
      var nextIndex = qsa('tr', tbody).length + 1;
      var tr = document.createElement('tr');
      tr.dataset.newRow = 'true';
      tr.innerHTML = buildEvalRowMarkup(nextIndex);
      tbody.insertBefore(tr, tbody.firstChild);
      renumberSeqCells(tbody);
      syncRowDeleteButtonsState(tbody);
    });

    deleteBtn.addEventListener('click', function () {
      var checked = qsa('[data-check-row]:checked', tbody);
      if (!checked.length) { return; }

      var totalRows = qsa('tr', tbody).length;
      if (checked.length >= totalRows) {
        showFeedback('無法刪除', '評量明細表至少須保留一筆資料，請取消勾選部分項目後再試一次。', 'bi-exclamation-triangle');
        return;
      }

      showDeleteConfirm('確定要刪除已勾選的 ' + checked.length + ' 筆評量紀錄嗎？此操作無法復原。', function () {
        checked.forEach(function (checkbox) {
          checkbox.closest('tr').remove();
        });
        syncRowDeleteButtonsState(tbody);
      });
    });
  }

  function initEduGoalEvalRowActions() {
    var tbody = document.getElementById('evalRows');
    if (!tbody) { return; }
    var rowSnapshots = new WeakMap();

    function fieldsOf(tr) {
      return qsa('input, select, textarea', tr).filter(function (el) {
        return !el.hasAttribute('data-check-row');
      });
    }

    function setLocked(tr, locked) {
      fieldsOf(tr).forEach(function (el) { el.disabled = locked; });
    }

    tbody.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.iep-eval-edit-btn');
      var deleteBtn = e.target.closest('.iep-eval-delete-btn');
      var saveBtn = e.target.closest('.iep-eval-save-btn');
      var cancelBtn = e.target.closest('.iep-eval-cancel-btn');

      if (editBtn) {
        var editTr = editBtn.closest('tr');
        rowSnapshots.set(editTr, editTr.innerHTML);
        setLocked(editTr, false);
        qs('.iep-eval-row-actions', editTr).innerHTML = editActionsMarkup();
        return;
      }

      if (deleteBtn) {
        if (deleteBtn.disabled) { return; }
        var deleteTr = deleteBtn.closest('tr');
        showDeleteConfirm('確定要刪除這筆評量紀錄嗎？此操作無法復原。', function () {
          deleteTr.remove();
          syncRowDeleteButtonsState(tbody);
        });
        return;
      }

      if (saveBtn) {
        var saveTr = saveBtn.closest('tr');
        setLocked(saveTr, true);
        saveTr.removeAttribute('data-new-row');
        qs('.iep-eval-row-actions', saveTr).innerHTML = viewActionsMarkup();
        rowSnapshots.delete(saveTr);
        return;
      }

      if (cancelBtn) {
        var cancelTr = cancelBtn.closest('tr');
        if (cancelTr.dataset.newRow === 'true') {
          cancelTr.remove();
          syncRowDeleteButtonsState(tbody);
        } else if (rowSnapshots.has(cancelTr)) {
          cancelTr.innerHTML = rowSnapshots.get(cancelTr);
          rowSnapshots.delete(cancelTr);
        }
        return;
      }
    });
  }

  function initEduGoalActionBar() {
    var draftBtn = document.getElementById('eduGoalDraftBtn');
    var exportBtn = document.getElementById('eduGoalExportBtn');

    if (draftBtn) {
      draftBtn.addEventListener('click', function () {
        showFeedback('草稿已暫存', '本次填寫內容已暫存，尚未正式送出；您可隨時回來繼續編輯。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「IEP 學年與學期教育目標報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  var BEHAVIOR_FUNCTION_STUDENTS_BY_CLASS = {
    '1': [{ value: '1', label: '陽OO' }, { value: '2', label: '王OO' }],
    '2': [{ value: '3', label: '洪OO' }, { value: '4', label: '張OO' }],
    '3': [{ value: '5', label: '徐OO' }],
    '4': [
      { value: '6', label: '胡OO' },
      { value: '7', label: '蔡OO' },
      { value: '8', label: '劉OO' },
      { value: '9', label: '林OO' },
      { value: '10', label: '陳OO' }
    ]
  };

  function initBehaviorFunctionStudentSelect() {
    var classSelect = document.getElementById('behaviorClass');
    var studentSelect = document.getElementById('studentName');
    if (!classSelect || !studentSelect) { return; }

    classSelect.addEventListener('change', function () {
      var students = BEHAVIOR_FUNCTION_STUDENTS_BY_CLASS[classSelect.value];
      studentSelect.innerHTML = '';

      if (!students) {
        studentSelect.appendChild(new Option('請先選擇班級', ''));
        studentSelect.disabled = true;
        return;
      }

      studentSelect.appendChild(new Option('請選擇', ''));
      students.forEach(function (student) {
        studentSelect.appendChild(new Option(student.label, student.value));
      });
      studentSelect.disabled = false;
    });
  }

  function initBehaviorFunctionActionBar() {
    var saveBtn = document.getElementById('behaviorFunctionSaveBtn');
    var exportBtn = document.getElementById('behaviorFunctionExportBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存修改後的IEP行為功能介入方案內容。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「IEP行為功能介入方案報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  function initBehaviorChecklistActionBar() {
    var saveBtn = document.getElementById('behaviorChecklistSaveBtn');
    var exportBtn = document.getElementById('behaviorChecklistExportBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存修改後的行為與策略對照勾選表內容。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「行為與策略對照勾選表報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  function initReinforcerSurveyActionBar() {
    var clearBtn = document.getElementById('reinforcerSurveyClearBtn');
    var saveBtn = document.getElementById('reinforcerSurveySaveBtn');
    var exportBtn = document.getElementById('reinforcerSurveyExportBtn');

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        qsa('.iep-reinforcer-table [data-check-row]:checked').forEach(function (checkbox) {
          var row = checkbox.closest('tr');
          qsa('input[type="radio"]:checked', row).forEach(function (radio) {
            radio.checked = false;
          });
        });
        showFeedback('已清除調查結果', '已清除勾選列的增強物偏好調查結果，請重新評估後再次儲存。', 'bi-eraser');
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存修改後的增強物調查表內容。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「增強物調查表報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  /* ------------------------------------------------------------------
     IEP會議記錄明細頁（iepMeetingRecord_form.html）
     - 會議記錄照片佐證：拖曳／點擊上傳、縮圖新增、放大檢視 Modal、刪除
     - 底部操作列：儲存／匯出／下載回饋
  ------------------------------------------------------------------ */
  function initMeetingPhotoUpload() {
    var dropzone = document.getElementById('meetingPhotoDropzone');
    var input = document.getElementById('meetingPhotoInput');
    var grid = document.getElementById('meetingPhotoGrid');
    if (!dropzone || !input || !grid) { return; }

    var previewModalEl = document.getElementById('photoPreviewModal');
    var previewTitle = document.getElementById('photoPreviewModalTitle');
    var previewImg = document.getElementById('photoPreviewImg');
    var previewPlaceholder = document.getElementById('photoPreviewPlaceholder');

    function addPhoto(file) {
      if (!/^image\/(jpeg|png)$/.test(file.type)) {
        showFeedback('檔案格式不支援', '「' + file.name + '」非 JPG 或 PNG 格式，請重新選擇。', 'bi-exclamation-triangle');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showFeedback('檔案超過大小限制', '「' + file.name + '」超過單張 10MB 上限，請重新選擇。', 'bi-exclamation-triangle');
        return;
      }

      var url = URL.createObjectURL(file);
      var li = document.createElement('li');
      li.className = 'iep-photo-item';
      li.innerHTML =
        '<div class="iep-photo-thumb">' +
          '<img src="' + url + '" alt="' + file.name + '">' +
          '<div class="iep-photo-overlay">' +
            '<button type="button" class="iep-photo-action iep-photo-action--zoom" aria-label="放大檢視 ' + file.name + '"><i class="bi bi-zoom-in" aria-hidden="true"></i></button>' +
            '<button type="button" class="iep-photo-action iep-photo-action--delete" aria-label="刪除 ' + file.name + '"><i class="bi bi-trash3" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
        '<p class="iep-photo-name">' + file.name + '</p>';
      grid.appendChild(li);
    }

    input.addEventListener('change', function () {
      Array.prototype.slice.call(input.files).forEach(addPhoto);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (evtName) {
      dropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(function (evtName) {
      dropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files) { return; }
      Array.prototype.slice.call(files).forEach(addPhoto);
    });

    grid.addEventListener('click', function (e) {
      var zoomBtn = e.target.closest('.iep-photo-action--zoom');
      var deleteBtn = e.target.closest('.iep-photo-action--delete');

      if (zoomBtn) {
        var item = zoomBtn.closest('.iep-photo-item');
        var img = item && qs('img', item);
        var name = item && qs('.iep-photo-name', item).textContent;

        if (previewModalEl && window.bootstrap) {
          if (previewTitle) { previewTitle.textContent = name || '照片預覽'; }
          if (img && previewImg) {
            previewImg.src = img.src;
            previewImg.alt = name || '';
            previewImg.hidden = false;
            if (previewPlaceholder) { previewPlaceholder.hidden = true; }
          } else {
            if (previewImg) { previewImg.hidden = true; }
            if (previewPlaceholder) { previewPlaceholder.hidden = false; }
          }
          bootstrap.Modal.getOrCreateInstance(previewModalEl).show();
        }
        return;
      }

      if (deleteBtn) {
        var li = deleteBtn.closest('.iep-photo-item');
        var img2 = li && qs('img', li);
        if (img2 && img2.src.indexOf('blob:') === 0) { URL.revokeObjectURL(img2.src); }
        if (li) { li.remove(); }
      }
    });
  }

  function initMeetingRecordActionBar() {
    var saveBtn = document.getElementById('meetingRecordSaveBtn');
    var exportBtn = document.getElementById('meetingRecordExportBtn');
    var signSheetBtn = document.getElementById('meetingRecordSignSheetBtn');
    var rehabBtn = document.getElementById('meetingRecordRehabBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存本次IEP會議記錄內容。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「IEP會議記錄報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }

    if (signSheetBtn) {
      signSheetBtn.addEventListener('click', function () {
        showFeedback('下載成功', '「會議簽到表暨同意書」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }

    if (rehabBtn) {
      rehabBtn.addEventListener('click', function () {
        showFeedback('下載成功', '「學生復健項目執行分級表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  /* ------------------------------------------------------------------
     IEP學生輔導記錄表明細頁（iepCounselingRecord_form.html）
     - 日常輔導紀錄明細表：新增／編輯／儲存／取消／刪除列（比照
       initEduGoalEvalRows／initEduGoalEvalRowActions 的解鎖模式，
       惟本表無勾選全選欄，故不含批次刪除）
     - 輔導記錄照片佐證：沿用 initMeetingPhotoUpload()（DOM id 相同）
     - 底部操作列：儲存所有變更／下載學期輔導紀錄表回饋
  ------------------------------------------------------------------ */
  function buildCounselingRowMarkup(n) {
    return '' +
      '<td data-label="序號"><span class="cell-value">' + n + '</span></td>' +
      '<td data-label="紀錄日期">' +
        '<span class="cell-value">' +
          '<label class="sr-only" for="counselDate' + n + '">紀錄日期</label>' +
          '<input type="date" class="form-control" id="counselDate' + n + '" name="counselDate' + n + '" title="紀錄日期" aria-label="紀錄日期">' +
        '</span>' +
      '</td>' +
      '<td data-label="輔導對象">' +
        '<span class="cell-value cell-value--start">' +
          '<fieldset class="iep-counsel-checks">' +
            '<legend class="sr-only">第' + n + '筆輔導對象</legend>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselTarget' + n + '" id="counselTargetStudent' + n + '" value="student"><label class="form-check-label" for="counselTargetStudent' + n + '">學生</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselTarget' + n + '" id="counselTargetParent' + n + '" value="parent"><label class="form-check-label" for="counselTargetParent' + n + '">家長</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselTarget' + n + '" id="counselTargetOther' + n + '" value="other"><label class="form-check-label" for="counselTargetOther' + n + '">其他</label></div>' +
          '</fieldset>' +
        '</span>' +
      '</td>' +
      '<td data-label="輔導方式">' +
        '<span class="cell-value cell-value--start">' +
          '<fieldset class="iep-counsel-checks">' +
            '<legend class="sr-only">第' + n + '筆輔導方式</legend>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselMethod' + n + '" id="counselMethodTalk' + n + '" value="talk"><label class="form-check-label" for="counselMethodTalk' + n + '">晤談</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselMethod' + n + '" id="counselMethodPhone' + n + '" value="phone"><label class="form-check-label" for="counselMethodPhone' + n + '">電話</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselMethod' + n + '" id="counselMethodVisit' + n + '" value="visit"><label class="form-check-label" for="counselMethodVisit' + n + '">家訪</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselMethod' + n + '" id="counselMethodNote' + n + '" value="note"><label class="form-check-label" for="counselMethodNote' + n + '">聯絡簿</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselMethod' + n + '" id="counselMethodApp' + n + '" value="app"><label class="form-check-label" for="counselMethodApp' + n + '">通訊軟體</label></div>' +
          '</fieldset>' +
        '</span>' +
      '</td>' +
      '<td data-label="狀況描述">' +
        '<span class="cell-value cell-value--start">' +
          '<label class="sr-only" for="counselDesc' + n + '">狀況描述</label>' +
          '<textarea class="form-control" id="counselDesc' + n + '" name="counselDesc' + n + '" rows="3" placeholder="請輸入描述"></textarea>' +
        '</span>' +
      '</td>' +
      '<td data-label="處理方式">' +
        '<span class="cell-value cell-value--start">' +
          '<fieldset class="iep-counsel-checks">' +
            '<legend class="sr-only">第' + n + '筆處理方式</legend>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselProcess' + n + '" id="counselProcessLife' + n + '" value="life"><label class="form-check-label" for="counselProcessLife' + n + '">融入生活教育</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselProcess' + n + '" id="counselProcessParent' + n + '" value="parent"><label class="form-check-label" for="counselProcessParent' + n + '">與家長討論後共同執行策略</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselProcess' + n + '" id="counselProcessCourse' + n + '" value="course"><label class="form-check-label" for="counselProcessCourse' + n + '">融入相關課程</label></div>' +
            '<div class="iep-counsel-process-note">' +
              '<span aria-hidden="true">如：</span>' +
              '<label class="sr-only" for="counselProcessNote' + n + '">融入相關課程說明</label>' +
              '<input type="text" class="form-control" id="counselProcessNote' + n + '" name="counselProcessNote' + n + '" placeholder="請輸入">' +
            '</div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselProcess' + n + '" id="counselProcessBehavior' + n + '" value="behavior"><label class="form-check-label" for="counselProcessBehavior' + n + '">行為功能介入</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselProcess' + n + '" id="counselProcessOther' + n + '" value="other"><label class="form-check-label" for="counselProcessOther' + n + '">其他</label></div>' +
          '</fieldset>' +
        '</span>' +
      '</td>' +
      '<td data-label="追蹤">' +
        '<span class="cell-value cell-value--start">' +
          '<fieldset class="iep-counsel-checks">' +
            '<legend class="sr-only">第' + n + '筆追蹤</legend>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselFollow' + n + '" id="counselFollowObserve' + n + '" value="observe"><label class="form-check-label" for="counselFollowObserve' + n + '">持續觀察</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselFollow' + n + '" id="counselFollowChange' + n + '" value="change"><label class="form-check-label" for="counselFollowChange' + n + '">策略更改</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" name="counselFollow' + n + '" id="counselFollowStable' + n + '" value="stable"><label class="form-check-label" for="counselFollowStable' + n + '">狀態穩定</label></div>' +
          '</fieldset>' +
        '</span>' +
      '</td>' +
      '<td data-label="相關參與人員">' +
        '<span class="cell-value cell-value--start">' +
          '<label class="sr-only" for="counselParticipants' + n + '">相關參與人員</label>' +
          '<textarea class="form-control" id="counselParticipants' + n + '" name="counselParticipants' + n + '" rows="3" placeholder="請輸入人員名稱"></textarea>' +
        '</span>' +
      '</td>' +
      '<td data-label="功能">' +
        '<span class="cell-value">' +
          '<div class="iep-eval-row-actions">' + editActionsMarkup() + '</div>' +
        '</span>' +
      '</td>';
  }

  function initCounselingRows() {
    var tbody = document.getElementById('counselRows');
    var addBtn = document.getElementById('btnAddCounselRow');
    if (!tbody || !addBtn) { return; }

    syncRowDeleteButtonsState(tbody);

    addBtn.addEventListener('click', function () {
      var nextIndex = qsa('tr', tbody).length + 1;
      var tr = document.createElement('tr');
      tr.dataset.newRow = 'true';
      tr.innerHTML = buildCounselingRowMarkup(nextIndex);
      tbody.insertBefore(tr, tbody.firstChild);
      renumberSeqCells(tbody);
      syncRowDeleteButtonsState(tbody);
    });
  }

  function initCounselingRowActions() {
    var tbody = document.getElementById('counselRows');
    if (!tbody) { return; }
    var rowSnapshots = new WeakMap();

    function fieldsOf(tr) {
      return qsa('input, select, textarea', tr);
    }

    function setLocked(tr, locked) {
      fieldsOf(tr).forEach(function (el) { el.disabled = locked; });
    }

    tbody.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.iep-eval-edit-btn');
      var deleteBtn = e.target.closest('.iep-eval-delete-btn');
      var saveBtn = e.target.closest('.iep-eval-save-btn');
      var cancelBtn = e.target.closest('.iep-eval-cancel-btn');

      if (editBtn) {
        var editTr = editBtn.closest('tr');
        rowSnapshots.set(editTr, editTr.innerHTML);
        setLocked(editTr, false);
        qs('.iep-eval-row-actions', editTr).innerHTML = editActionsMarkup();
        return;
      }

      if (deleteBtn) {
        if (deleteBtn.disabled) { return; }
        var deleteTr = deleteBtn.closest('tr');
        showDeleteConfirm('確定要刪除這筆輔導紀錄嗎？此操作無法復原。', function () {
          deleteTr.remove();
          syncRowDeleteButtonsState(tbody);
        });
        return;
      }

      if (saveBtn) {
        var saveTr = saveBtn.closest('tr');
        setLocked(saveTr, true);
        saveTr.removeAttribute('data-new-row');
        qs('.iep-eval-row-actions', saveTr).innerHTML = viewActionsMarkup();
        rowSnapshots.delete(saveTr);
        return;
      }

      if (cancelBtn) {
        var cancelTr = cancelBtn.closest('tr');
        if (cancelTr.dataset.newRow === 'true') {
          cancelTr.remove();
          syncRowDeleteButtonsState(tbody);
        } else if (rowSnapshots.has(cancelTr)) {
          cancelTr.innerHTML = rowSnapshots.get(cancelTr);
          rowSnapshots.delete(cancelTr);
        }
        return;
      }
    });
  }

  function initCounselingActionBar() {
    var saveAllBtn = document.getElementById('counselingSaveAllBtn');
    var downloadBtn = document.getElementById('counselingDownloadBtn');

    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存本次IEP學生輔導記錄表內容。', 'bi-floppy');
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        showFeedback('下載成功', '「學期輔導紀錄表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  /* ------------------------------------------------------------------
     IEP轉銜會議記錄明細頁（iepTransferMeeting_form.html）
     - 底部操作列：儲存修改資料／下載轉銜報告書回饋
  ------------------------------------------------------------------ */
  function initTransferMeetingActionBar() {
    var saveBtn = document.getElementById('transferMeetingSaveBtn');
    var exportBtn = document.getElementById('transferMeetingExportBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存修改後的IEP轉銜會議記錄內容。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('報表產生成功', '「IEP轉銜報告書」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  /* ------------------------------------------------------------------
     IEP檢討會議明細頁（iepReviewMeeting_form.html）
     - 行為功能方案：下拉選單依選項切換對應區塊內容
     - 底部操作列：儲存／匯出回饋
  ------------------------------------------------------------------ */
  function initReviewMeetingBehaviorPlan() {
    var select = document.getElementById('behaviorFunctionPlan');
    var wrap = document.getElementById('behaviorFunctionPlanContentWrap');
    if (!select || !wrap) { return; }

    var contents = qsa('[data-plan-content]', wrap);

    function updateContent() {
      contents.forEach(function (content) {
        content.hidden = content.dataset.planContent !== select.value;
      });
    }

    select.addEventListener('change', updateContent);
    updateContent();
  }

  function initReviewMeetingActionBar() {
    var saveBtn = document.getElementById('reviewMeetingSaveBtn');
    var exportBtn = document.getElementById('reviewMeetingExportBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('儲存成功', '已儲存修改後的IEP檢討會議內容。', 'bi-floppy');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        showFeedback('IEP 報表產生成功', '「IEP檢討會議報表」已開始下載，請至瀏覽器下載紀錄查看。', 'bi-download');
      });
    }
  }

  /* ------------------------------------------------------------------
     教育目標範本詳情與指派頁（iepEduGoalTemplateShare_form.html）
     - 套用範本至對象 Offcanvas：穿梭清單（搬移邏輯與 js/dataModal.js 的
       setupTransfer 同版型；IEP 頁不載入該檔，故於此另行實作一份）、
       套用項目勾選檢核、確定套用後帶出教師/科目/學生明細的手動關閉回饋
     - 另存個人副本：顯示手動關閉回饋，導引前往個人範本編輯頁
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

    return { panels: panels, updatePanel: updatePanel };
  }

  function initEduGoalTemplateApply() {
    var offcanvasEl = document.getElementById('applyTemplateOffcanvas');
    var resultModalEl = document.getElementById('applyTemplateResultModal');
    var confirmBtn = document.getElementById('btnConfirmApplyTemplate');
    if (!offcanvasEl || !confirmBtn) { return; }

    var transfer = setupTransfer(offcanvasEl);

    var subjectSelect = document.getElementById('applySubject');
    var itemChecks = qsa('input[name="applyItems[]"]', offcanvasEl);
    var teacherEl = document.getElementById('templateTeacherName');

    // 修課科目連動：每位學生 li 上的 data-subject-assigned 標記其已修課的科目代碼，
    // 切換科目時依此屬性將學生搬移至「修課學生」或「尚未編班學生」面板，
    // 並重置勾選與搜尋篩選狀態（避免殘留上一科目的選取／過濾結果）
    if (subjectSelect) {
      subjectSelect.addEventListener('change', function () {
        var subjectVal = subjectSelect.value;
        if (!subjectVal) { return; }

        qsa('.transfer-list > li', offcanvasEl).forEach(function (li) {
          qs('input', li).checked = false;
          li.hidden = false;
          var subjects = (li.dataset.subjectAssigned || '').split(',');
          var targetPanel = subjects.indexOf(subjectVal) > -1 ? transfer.panels.assigned : transfer.panels.unassigned;
          qs('.transfer-list', targetPanel).appendChild(li);
        });

        qsa('[data-transfer-search]', offcanvasEl).forEach(function (input) { input.value = ''; });
        transfer.updatePanel(transfer.panels.assigned);
        transfer.updatePanel(transfer.panels.unassigned);
      });
    }

    confirmBtn.addEventListener('click', function () {
      if (subjectSelect && !subjectSelect.checkValidity()) { subjectSelect.reportValidity(); return; }
      if (itemChecks.length && !itemChecks.some(function (c) { return c.checked; })) {
        showFeedback('請至少勾選一項套用內容', '請於「套用此範本項目」至少勾選一項後再確定套用。', 'bi-exclamation-triangle');
        return;
      }

      var subjectLabel = subjectSelect && subjectSelect.selectedIndex > -1
        ? subjectSelect.options[subjectSelect.selectedIndex].textContent
        : '';
      var assignedStudents = qsa('[data-transfer-panel="assigned"] .transfer-list li', offcanvasEl);
      var classNames = assignedStudents.reduce(function (list, li) {
        var className = li.dataset.class;
        if (className && list.indexOf(className) === -1) { list.push(className); }
        return list;
      }, []);

      var descEl = document.getElementById('applyResultDesc');
      if (descEl) {
        descEl.textContent = '您已將本範本套用至教師 ' + (teacherEl ? teacherEl.textContent : '') +
          ' 的「' + subjectLabel + '」科目，套用班級：' + classNames.join('、') +
          '（共 ' + classNames.length + ' 班，合計 ' + assignedStudents.length + ' 位學生）。';
      }

      if (window.bootstrap) {
        var offInstance = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
        offcanvasEl.addEventListener('hidden.bs.offcanvas', function onHidden() {
          offcanvasEl.removeEventListener('hidden.bs.offcanvas', onHidden);
          if (resultModalEl) { bootstrap.Modal.getOrCreateInstance(resultModalEl).show(); }
        });
        offInstance.hide();
      }
    });
  }

  function initEduGoalTemplateSaveCopy() {
    var saveCopyBtn = document.getElementById('eduGoalTemplateSaveCopyBtn');
    var modalEl = document.getElementById('saveCopyModal');
    if (!saveCopyBtn || !modalEl) { return; }

    saveCopyBtn.addEventListener('click', function () {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    });
  }

  /* ------------------------------------------------------------------
     教育目標範本管理及套用（個人範本）列表頁：刪除範本（立即移除列＋回饋）
  ------------------------------------------------------------------ */
  function initEduGoalTemplatePersonalListActions() {
    var tbody = document.getElementById('templatePersonalRows');
    if (!tbody) { return; }

    tbody.addEventListener('click', function (e) {
      var deleteBtn = e.target.closest('.iep-template-delete-btn');
      if (!deleteBtn) { return; }

      var row = deleteBtn.closest('tr');
      var nameCell = row && qs('[data-label="範本名稱"] .cell-value', row);
      var name = nameCell ? nameCell.textContent.trim() : '此範本';
      if (row) { row.remove(); }
      showFeedback('範本已刪除', '已刪除「' + name + '」範本。', 'bi-trash');
    });
  }

  /* ------------------------------------------------------------------
     個人教育目標範本編輯頁（iepEduGoalTemplatePersonal_form.html）
     底部操作列：暫存草稿／儲存範本回饋
  ------------------------------------------------------------------ */
  function initEduGoalTemplatePersonalActionBar() {
    var draftBtn = document.getElementById('templateDraftBtn');
    var saveBtn = document.getElementById('templateSaveBtn');

    if (draftBtn) {
      draftBtn.addEventListener('click', function () {
        showFeedback('草稿已暫存', '本次範本編輯內容已暫存，尚未正式儲存；您可隨時回來繼續編輯。', 'bi-floppy');
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        showFeedback('範本儲存成功', '此教育目標範本已儲存，可至個人範本列表中重複套用。', 'bi-check-circle');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFeedbackModal();
    initDeleteConfirmModal();
    initIepStatusTabs();
    initIepActionBar();
    initEduGoalStatusTabs();
    initEduGoalQuickRef();
    initEduGoalStepLock();
    initEduGoalEvalRows();
    initEduGoalEvalRowActions();
    initEduGoalActionBar();
    initBehaviorFunctionStudentSelect();
    initBehaviorFunctionActionBar();
    initBehaviorChecklistActionBar();
    initReinforcerSurveyActionBar();
    initReviewMeetingBehaviorPlan();
    initReviewMeetingActionBar();
    initMeetingPhotoUpload();
    initMeetingRecordActionBar();
    initCounselingRows();
    initCounselingRowActions();
    initCounselingActionBar();
    initTransferMeetingActionBar();
    initEduGoalTemplateApply();
    initEduGoalTemplateSaveCopy();
    initEduGoalTemplatePersonalListActions();
    initEduGoalTemplatePersonalActionBar();
  });
})();
