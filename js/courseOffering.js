/* ==========================================================================
   開課作業資料頁腳本（Vanilla JS）courseOffering_form.html 專用：
   - 授課教師動態列（新增/刪除、人數統計）
   - 授課節次設定（已選節次與各星期節數即時統計）
   - 課程卡/特殊安排 Modal：帶入時段標題
   - 特殊安排處理方式：取消此次新增時隱藏班級名稱設定
   - 回饋 Modal（成功訊息＋3 秒倒數自動關閉）
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
  ------------------------------------------------------------------ */
  var feedbackTimer = null;

  function showFeedback(title, message) {
    var modalEl = document.getElementById('feedbackModal');
    if (!modalEl || !window.bootstrap) { return; }

    qs('.feedback-title', modalEl).textContent = title;
    qs('.feedback-desc', modalEl).textContent = message;

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

  // 先關閉表單 Modal，待關閉動畫結束後再顯示回饋 Modal
  function hideThenFeedback(modalEl, title, message) {
    var instance = bootstrap.Modal.getInstance(modalEl);
    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      showFeedback(title, message);
    });
    if (instance) { instance.hide(); }
  }

  /* ------------------------------------------------------------------
     授課教師動態列：新增/刪除、人數統計
     後端：教師選項為動態產生，以下清單僅前端示意
  ------------------------------------------------------------------ */
  var TEACHER_OPTIONS = [
    { value: '', text: '選擇教師' },
    { value: '1', text: '黃富勝' },
    { value: '2', text: '鍾子敏' },
    { value: '3', text: '徐學強' },
    { value: '4', text: '王小明' }
  ];

  function initTeacherList() {
    var list = document.getElementById('teacherList');
    var addBtn = document.getElementById('teacherAddBtn');
    var countEl = document.getElementById('teacherCount');
    if (!list || !addBtn || !countEl) { return; }

    var nextIndex = qsa('.teacher-row', list).length + 1;

    function updateCount() {
      countEl.textContent = qsa('.teacher-row', list).length;
    }

    function buildRow(index) {
      var li = document.createElement('li');
      li.className = 'teacher-row';

      var options = TEACHER_OPTIONS.map(function (opt) {
        return '<option value="' + opt.value + '">' + opt.text + '</option>';
      }).join('');

      li.innerHTML =
        '<div class="teacher-row-name">' +
        '  <label class="sr-only" for="teacherName' + index + '">教師姓名</label>' +
        '  <select class="form-select" id="teacherName' + index + '" name="teacherName[]">' + options + '</select>' +
        '</div>' +
        '<fieldset class="teacher-nature">' +
        '  <legend class="sr-only">授課性質</legend>' +
        '  <div class="form-check">' +
        '    <input class="form-check-input" type="radio" name="teacherNature' + index + '" id="teacherNature' + index + 'a" value="main" checked>' +
        '    <label class="form-check-label" for="teacherNature' + index + 'a">正課</label>' +
        '  </div>' +
        '  <div class="form-check">' +
        '    <input class="form-check-input" type="radio" name="teacherNature' + index + '" id="teacherNature' + index + 'b" value="part">' +
        '    <label class="form-check-label" for="teacherNature' + index + 'b">兼課</label>' +
        '  </div>' +
        '</fieldset>' +
        '<button type="button" class="btn teacher-remove" aria-label="刪除此教師">' +
        '  <i class="bi bi-trash3" aria-hidden="true"></i>' +
        '</button>';

      return li;
    }

    addBtn.addEventListener('click', function () {
      list.appendChild(buildRow(nextIndex));
      nextIndex += 1;
      updateCount();
    });

    // 刪除（事件代理：涵蓋動態新增的列）
    list.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('.teacher-remove');
      if (!removeBtn) { return; }
      var row = removeBtn.closest('.teacher-row');
      if (row) {
        row.remove();
        updateCount();
      }
    });

    updateCount();
  }

  /* ------------------------------------------------------------------
     授課節次設定：已選節次與各星期節數即時統計
  ------------------------------------------------------------------ */
  function initSlotSummary() {
    var checks = qsa('.slot-check');
    var totalEl = document.getElementById('slotTotal');
    var daysEl = document.getElementById('slotDays');
    if (!checks.length || !totalEl || !daysEl) { return; }

    var DAY_ORDER = ['星期一', '星期二', '星期三', '星期四', '星期五'];

    function update() {
      var checked = checks.filter(function (input) { return input.checked; });
      totalEl.textContent = checked.length;

      var byDay = {};
      checked.forEach(function (input) {
        var day = input.dataset.day;
        byDay[day] = (byDay[day] || 0) + 1;
      });

      var parts = DAY_ORDER.filter(function (day) { return byDay[day]; })
        .map(function (day) { return day + '：' + byDay[day] + ' 節'; });

      daysEl.textContent = parts.length ? parts.join('｜') : '尚未選擇節次';
    }

    checks.forEach(function (input) {
      input.addEventListener('change', update);
    });

    update();
  }

  /* ------------------------------------------------------------------
     課程卡/特殊安排 Modal：帶入觸發按鈕的時段標題
  ------------------------------------------------------------------ */
  function initSlotTitleModal(modalId) {
    var modalEl = document.getElementById(modalId);
    if (!modalEl) { return; }

    modalEl.addEventListener('show.bs.modal', function (e) {
      var trigger = e.relatedTarget;
      var titleText = qs('.data-modal-title-text', modalEl);
      if (titleText && trigger && trigger.dataset.slotTitle) {
        titleText.textContent = trigger.dataset.slotTitle;
      }
    });
  }

  /* ------------------------------------------------------------------
     特殊安排 Modal：處理方式切換與更新回饋
  ------------------------------------------------------------------ */
  function initSpecialModal() {
    var modalEl = document.getElementById('specialModal');
    if (!modalEl) { return; }

    var form = qs('form', modalEl);
    var classBox = document.getElementById('processClassBox');
    var radios = qsa('input[name="processType"]', modalEl);

    // 取消此次新增：隱藏班級名稱設定
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (classBox) {
          classBox.hidden = (radio.value === 'cancel' && radio.checked);
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      var slotTitle = qs('.data-modal-title-text', modalEl).textContent;
      hideThenFeedback(modalEl, '資料更新成功', '你已更新“' + slotTitle + '-特殊安排”');
    });
  }

  /* ------------------------------------------------------------------
     課表預覽月份切換：上/下個月按鈕更新標籤並重新渲染示意課表
     後端：課表內容為動態產生，以下三組月份資料僅前端示意
  ------------------------------------------------------------------ */
  var PERIOD_NAMES = ['一', '二', '三', '四', '五', '六', '七'];
  var DAY_NAMES = ['一', '二', '三', '四', '五'];

  /* ------------------------------------------------------------------
     課程名稱 → 色相對照：同課程名稱同色、不同課程名稱不同色
     後端：科目代碼（如 1002、2003-1）不影響顏色，一律以課程「名稱」比對；
     課程種類多達上百種，以下依後端 sjid 下拉選單的課程名稱建立順序表，
     色相以黃金角（137.508°）等分演算法自動展開，避免相鄰色相過於接近。
     若未來後端新增此表未收錄的課程名稱，getCourseHue() 會自動以名稱雜湊
     算出一個色相，不需要手動維護對照表。
  ------------------------------------------------------------------ */
  var COURSE_NAME_ORDER = [
    '語文', '健康與體育', '健康與體育-健康', '健康與體育-體育', '數學', '生活',
    '生活-社會', '生活-自然科學', '生活-藝術', '生活-綜合活動', '社會', '藝術與人文',
    '自然與生活科技', '綜合活動', '特殊需求', '特殊需求-生活管理', '特殊需求-社會技巧',
    '特殊需求-溝通訓練', '特殊需求-學習策略', '特殊需求-功能性動作訓練', '課後照顧',
    '藝術', '自然科學', '科技', '特殊需求-職業教育', '班會', '社團活動', '自然', '體育', '健康與護理', '服務導論', '環境服務概論Ⅰ',
    '環境服務概論Ⅱ', '衛生與安全導論', '衛生與安全概論', '環境服務實務Ⅰ', '環境服務實務Ⅱ',
    '事務機器與電腦應用Ⅰ', '事務機器與電腦應用Ⅱ', '清潔專業實務Ⅰ', '清潔專業實務Ⅱ',
    '門市服務實務Ⅰ', '門市服務實務Ⅱ', '生命服務概論Ⅰ', '生命服務概論Ⅱ',
    '生命服務衛生與安全概論Ⅰ', '生命服務衛生與安全概論Ⅱ', '生命服務實務Ⅰ', '生命服務實務Ⅱ',
    '生命教育Ⅰ', '賣場物品整理實習', '汽車美容實務Ⅰ', '汽車美容實務Ⅱ', '園藝管理實務Ⅰ',
    '園藝管理實務Ⅱ', '藝術與科技Ⅰ', '藝術與科技', '藝術與科技Ⅱ', '綜合活動與科技',
    '事務機器與電腦應用概論', '基礎清潔實務', '基礎清潔實作', '職場清潔實作', '顧客服務實務',
    '顧客服務實作', '生活用品整理實作', '家電使用與維護實作', '家事處理實作', '食材處理實作',
    '飲料調製實作', '餐旅服務概論', '車輛美容實務', '社會技巧', '團體活動時間', '彈性學習時間',
    '家庭教育', '基礎速食實作', '健康體適能', '家務環保生活實作', '衣物管理實作', '衣物清潔實作',
    '觀光餐旅業導論', '健康促進與管理', '餐旅會話', '農產栽培實務', '門市專業實習Ⅰ',
    '門市專業實習Ⅱ', '門市顧客服務概論', '門市專業實習Ⅲ', '門市專業實習Ⅳ', '家庭生活管理概論',
    '餐飲服務實作', '物品整理實作', '社區與交通安全', '輪板運動', '客房整理實作', '家事技能實作',
    '餐飲產品管理實習', '餐飲衛生清潔實習', '家庭生活管理實作', '居家管理實作', '餐旅服務技術實習',
    '餐旅課務實習', '家事處理安全實作', '衣物管理實務', '餐飲客務實作', '專題實作', '餐旅客務實習',
    '班級活動', '家庭生活管理實務', '客房清潔實作', '客房清潔與維護實作', '客房服務實作',
    '客房整理實習', '客房服務實習', '倉儲實作', '倉儲清潔實習', '配送實作', '臺東農特產概論',
    '臺東農特產料理實作', '臺東農產種植實務', '旅館環境清潔實作', '貨品包裝實作', '商品整理實作',
    '休閒與生活', '直排輪', '自行車', '地板滾球'
  ];

  var COURSE_NAME_HUE_INDEX = {};
  COURSE_NAME_ORDER.forEach(function (name, index) {
    COURSE_NAME_HUE_INDEX[name] = index;
  });

  var GOLDEN_ANGLE = 137.508;

  function hashCourseName(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
    }
    return hash;
  }

  function getCourseHue(name) {
    var index = Object.prototype.hasOwnProperty.call(COURSE_NAME_HUE_INDEX, name)
      ? COURSE_NAME_HUE_INDEX[name]
      : COURSE_NAME_ORDER.length + hashCourseName(name);
    return Math.round((index * GOLDEN_ANGLE) % 360);
  }

  // 每格：day(1-5)、period(1-7)、subject、teacher、special(是否開特殊安排 Modal)
  var TIMETABLE_DEMO_SETS = [
    [
      { day: 1, period: 1, subject: '語文', teacher: '王小明' },
      { day: 4, period: 1, subject: '社會', teacher: '徐學強' },
      { day: 5, period: 1, subject: '體育', teacher: '黃富勝+王冠純' },
      { day: 1, period: 2, subject: '特殊 黃富勝+鍾子敏', teacher: '社會 鍾OO', special: true },
      { day: 3, period: 2, subject: '特殊 黃富勝+鍾子敏', teacher: '生活 鍾OO', special: true },
      { day: 5, period: 2, subject: '自然', teacher: '楊可量' },
      { day: 3, period: 3, subject: '自然', teacher: '張老師' },
      { day: 4, period: 4, subject: '社會', teacher: '王小明' },
      { day: 5, period: 5, subject: '藝術', teacher: '李小華' }
    ],
    [
      { day: 2, period: 1, subject: '數學', teacher: '鍾子敏' },
      { day: 1, period: 2, subject: '語文', teacher: '王小明' },
      { day: 4, period: 2, subject: '自然', teacher: '楊可量' },
      { day: 3, period: 3, subject: '特殊 黃富勝+鍾子敏', teacher: '生活 鍾OO', special: true },
      { day: 5, period: 3, subject: '體育', teacher: '黃富勝+王冠純' },
      { day: 2, period: 4, subject: '藝術', teacher: '李小華' },
      { day: 1, period: 5, subject: '社會', teacher: '徐學強' },
      { day: 3, period: 6, subject: '生活', teacher: '張老師' }
    ],
    [
      { day: 3, period: 1, subject: '體育', teacher: '黃富勝' },
      { day: 2, period: 2, subject: '特殊 黃富勝+鍾子敏', teacher: '社會 鍾OO', special: true },
      { day: 5, period: 2, subject: '數學', teacher: '鍾子敏' },
      { day: 1, period: 3, subject: '藝術', teacher: '李小華' },
      { day: 5, period: 4, subject: '自然', teacher: '張老師' },
      { day: 2, period: 5, subject: '語文', teacher: '王小明' },
      { day: 4, period: 5, subject: '社會', teacher: '徐學強' },
      { day: 5, period: 7, subject: '自然', teacher: '楊可量' }
    ]
  ];

  function initTimetableMonth() {
    var label = document.getElementById('timetableMonthLabel');
    var prevBtn = document.getElementById('timetableMonthPrev');
    var nextBtn = document.getElementById('timetableMonthNext');
    var tbody = document.getElementById('timetablePreviewBody');
    if (!label || !prevBtn || !nextBtn || !tbody) { return; }

    // 起始年月與 HTML 靜態示意一致（2026年6月 對應第 0 組示意資料）
    var year = 2026;
    var month = 6;

    function buildSlotCell(slot) {
      var title = '星期' + DAY_NAMES[slot.day - 1] + ' 第' + PERIOD_NAMES[slot.period - 1] + '節';
      var target = slot.special ? '#specialModal' : '#courseInfoModal';
      var classAttr = slot.special ? 'timetable-slot timetable-slot--special' : 'timetable-slot';
      var styleAttr = slot.special ? '' : ' style="--slot-hue:' + getCourseHue(slot.subject) + '"';
      return (
        '<button type="button" class="' + classAttr + '"' + styleAttr +
        ' data-bs-toggle="modal" data-bs-target="' + target + '" data-slot-title="' + title + '">' +
        '<span class="timetable-slot-subject">' + slot.subject + '</span>' +
        '<span class="timetable-slot-teacher">' + slot.teacher + '</span>' +
        '</button>'
      );
    }

    function render() {
      label.textContent = year + '年' + month + '月';

      // 以年月推導示意資料組，讓每個月份都有對應課表可看
      var slots = TIMETABLE_DEMO_SETS[(year * 12 + month) % TIMETABLE_DEMO_SETS.length];
      var map = {};
      slots.forEach(function (slot) {
        map[slot.day + '-' + slot.period] = slot;
      });

      var rows = '';
      for (var period = 1; period <= 7; period += 1) {
        rows += '<tr><th scope="row">' + period + '</th>';
        for (var day = 1; day <= 5; day += 1) {
          var slot = map[day + '-' + period];
          rows += slot
            ? '<td>' + buildSlotCell(slot) + '</td>'
            : '<td><span aria-hidden="true">-</span><span class="sr-only">未排課</span></td>';
        }
        rows += '</tr>';
      }
      tbody.innerHTML = rows;
    }

    function shiftMonth(offset) {
      month += offset;
      if (month > 12) { month = 1; year += 1; }
      if (month < 1) { month = 12; year -= 1; }
      render();
    }

    prevBtn.addEventListener('click', function () { shiftMonth(-1); });
    nextBtn.addEventListener('click', function () { shiftMonth(1); });
  }

  /* ------------------------------------------------------------------
     開課作業主表單：儲存回饋
  ------------------------------------------------------------------ */
  function initCourseForm() {
    var form = qs('.course-form');
    if (!form) { return; }

    form.addEventListener('submit', function (e) {
      e.preventDefault(); // 後端：實際送出由後端接手
      showFeedback('資料儲存成功', '你已儲存“開課作業資料”');
    });
  }

  /* ------------------------------------------------------------------
     初始化
  ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    initFeedbackModal();
    initTeacherList();
    initSlotSummary();
    initSlotTitleModal('courseInfoModal');
    initSlotTitleModal('specialModal');
    initSpecialModal();
    initTimetableMonth();
    initCourseForm();
  });
})();
