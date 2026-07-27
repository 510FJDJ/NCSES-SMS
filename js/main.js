/* ==========================================================================
   國立彰化特殊教育學校 雲端校務管理系統 — 全站共用腳本（Vanilla JS）
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     共用 Layout 載入：頁面以 <div id="header" data-layout="layout/xxx.html">
     宣告插槽，載入完成後發出 layout:loaded 事件供後續腳本掛載。
  ------------------------------------------------------------------ */
  function loadLayouts() {
    var slots = document.querySelectorAll('[data-layout]');
    slots.forEach(function (slot) {
      fetch(slot.dataset.layout)
        .then(function (res) {
          if (!res.ok) { throw new Error('HTTP ' + res.status); }
          return res.text();
        })
        .then(function (html) {
          slot.innerHTML = html;
          slot.dispatchEvent(new CustomEvent('layout:loaded', { bubbles: true }));
        })
        .catch(function (err) {
          console.error('Layout 載入失敗：', slot.dataset.layout, err);
        });
    });
  }

  /* ------------------------------------------------------------------
     回到頂部：純 JS 座標計算平滑滾動，並尊重減少動態效果設定
  ------------------------------------------------------------------ */
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function smoothScrollTo(targetY, duration) {
    if (prefersReducedMotion.matches) {
      window.scrollTo(0, targetY);
      return;
    }
    var startY = window.pageYOffset;
    var diff = targetY - startY;
    var startTime = null;

    function step(timestamp) {
      if (startTime === null) { startTime = timestamp; }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      window.scrollTo(0, startY + diff * eased);
      if (progress < 1) { window.requestAnimationFrame(step); }
    }
    window.requestAnimationFrame(step);
  }

  function initScrollTop() {
    var btn = document.querySelector('.scroll-top-btn');
    if (!btn) { return; }

    function toggleVisibility() {
      btn.classList.toggle('is-visible', window.pageYOffset > 300);
    }
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    btn.addEventListener('click', function () {
      smoothScrollTo(0, 500);
    });
  }

  /* ------------------------------------------------------------------
     密碼顯示切換（事件委派，支援動態注入的表單）
  ------------------------------------------------------------------ */
  function initPasswordToggle() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.toggle-password');
      if (!btn) { return; }
      var input = document.getElementById(btn.dataset.target);
      if (!input) { return; }

      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
      var icon = btn.querySelector('i');
      if (icon) { icon.className = show ? 'bi bi-eye' : 'bi bi-eye-slash'; }
    });
  }

  /* ------------------------------------------------------------------
     圖形驗證碼（前端示意版）
     後端：正式驗證碼圖片與語音檔由後端產生，替換 drawCaptcha 與
           speakCaptcha 即可，HTML 結構與按鈕事件不需更動。
  ------------------------------------------------------------------ */
  var captchaCode = '';

  function drawCaptcha() {
    var img = document.getElementById('captchaImage');
    if (!img) { return; }

    captchaCode = String(Math.floor(1000 + Math.random() * 9000));

    var canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 48;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 干擾線
    for (var i = 0; i < 4; i++) {
      ctx.strokeStyle = 'rgba(2, 101, 148, ' + (0.2 + Math.random() * 0.2) + ')';
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // 數字（隨機微旋轉）
    ctx.font = 'italic 700 28px Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#026594';
    for (var j = 0; j < captchaCode.length; j++) {
      var x = 16 + j * 26;
      var y = 24 + (Math.random() * 8 - 4);
      var angle = Math.random() * 0.4 - 0.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(captchaCode[j], 0, 0);
      ctx.restore();
    }

    img.src = canvas.toDataURL('image/png');
  }

  function speakCaptcha() {
    if (!('speechSynthesis' in window) || !captchaCode) { return; }
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(captchaCode.split('').join('，'));
    utterance.lang = 'zh-TW';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }

  function initCaptcha() {
    var img = document.getElementById('captchaImage');
    if (!img) { return; }

    drawCaptcha();

    var refreshBtn = document.getElementById('captchaRefresh');
    var speakBtn = document.getElementById('captchaSpeak');
    if (refreshBtn) { refreshBtn.addEventListener('click', drawCaptcha); }
    if (speakBtn) { speakBtn.addEventListener('click', speakCaptcha); }
  }

  function initGuestMenuAnimation() {
    var toggleBtn = document.querySelector('.navbar-menu-btn[data-bs-target="#guestMenu"]');
    var menu = document.getElementById('guestMenu');
    if (!toggleBtn || !menu) { return; }

    var icon = toggleBtn.querySelector('i');

    function updateToggleState(isOpen) {
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (icon) {
        icon.className = isOpen ? 'bi bi-x-lg' : 'bi bi-list';
      }
    }

    menu.addEventListener('shown.bs.offcanvas', function () {
      updateToggleState(true);
    });

    menu.addEventListener('hidden.bs.offcanvas', function () {
      updateToggleState(false);
    });

    updateToggleState(menu.classList.contains('show'));
  }

  /* ------------------------------------------------------------------
     桌面二級導覽：第二層飛出選單自動換邊
     右側空間不足時改往左飛出（滑鼠移入與鍵盤聚焦時各量測一次）
  ------------------------------------------------------------------ */
  function initAdminNavSubmenus() {
    var submenus = document.querySelectorAll('.admin-nav .dropdown-submenu');
    submenus.forEach(function (item) {
      if (item.dataset.flipBound) { return; }
      item.dataset.flipBound = 'true';

      var sub = item.querySelector('.dropdown-menu--sub');
      if (!sub) { return; }

      function updateDirection() {
        // 先還原預設向右，再量測是否超出視窗右緣
        sub.classList.remove('dropdown-menu--sub-flip');
        var rect = sub.getBoundingClientRect();
        if (rect.right > document.documentElement.clientWidth) {
          sub.classList.add('dropdown-menu--sub-flip');
        }
      }

      item.addEventListener('mouseenter', updateDirection);
      item.addEventListener('focusin', updateDirection);
    });
  }

  /* ------------------------------------------------------------------
     桌面二級導覽：滾動固定置頂
     往下滾：固定於視窗頂端；往上滾：暫時收合讓使用者看清內容；
     回到頁面頂端：還原一般排版，完整露出整個 header
  ------------------------------------------------------------------ */
  function initAdminNavSticky() {
    var nav = document.querySelector('.header-admin-nav');
    if (!nav || nav.dataset.stickyBound) { return; }
    nav.dataset.stickyBound = 'true';

    var header = nav.closest('.header-admin');
    var lastY = window.pageYOffset;

    function onScroll() {
      var y = window.pageYOffset;

      if (y <= header.offsetHeight) {
        nav.classList.remove('is-fixed', 'is-hidden');
        header.style.paddingBottom = '';
      } else if (y > lastY) {
        if (!nav.classList.contains('is-fixed')) {
          // 補償脫離文流的高度，避免內容跳動
          header.style.paddingBottom = nav.offsetHeight + 'px';
          nav.classList.add('is-fixed');
        }
        nav.classList.remove('is-hidden');
      } else if (y < lastY && nav.classList.contains('is-fixed')) {
        nav.classList.add('is-hidden');
      }

      lastY = y;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------
     全選 checkbox 與各列 checkbox 雙向同步：全站統一用 [data-check-all] /
     [data-check-row] 兩個屬性標記角色，作用範圍自動鎖定在最近的 <table>，
     因此同一頁（含 Modal 內表格）可以同時存在多組全選而互不干擾，
     不需要再為每個表格各自命名 id/class 或另寫一份綁定邏輯。
     後端：勾選結果由各列 input 的 value/name 提交，此處僅處理 UI 狀態
  ------------------------------------------------------------------ */
  function initCheckAllGroups() {
    var checkAlls = document.querySelectorAll('[data-check-all]');
    checkAlls.forEach(function (checkAll) {
      var scope = checkAll.closest('table') || document;

      function getRowChecks() {
        return Array.prototype.slice.call(scope.querySelectorAll('[data-check-row]'));
      }

      function syncCheckAllState() {
        var rowChecks = getRowChecks();
        var checkedCount = rowChecks.filter(function (input) { return input.checked; }).length;
        checkAll.checked = checkedCount === rowChecks.length && rowChecks.length > 0;
        checkAll.indeterminate = checkedCount > 0 && checkedCount < rowChecks.length;
      }

      checkAll.addEventListener('change', function () {
        getRowChecks().forEach(function (input) { input.checked = checkAll.checked; });
      });

      // 用事件代理監聽 scope，動態新增的列不需另外綁定即可被偵測到
      scope.addEventListener('change', function (e) {
        if (e.target.matches && e.target.matches('[data-check-row]')) {
          syncCheckAllState();
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     學籍表單：學生照片縮圖預覽
     後端：檔案上傳由後端接手，此處僅做選擇後的本地預覽
  ------------------------------------------------------------------ */
  function initPhotoPreview() {
    var input = document.getElementById('studentPhoto');
    var preview = document.getElementById('photoPreview');
    if (!input || !preview) { return; }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file || !file.type.match(/^image\//)) {
        preview.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i>';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        preview.innerHTML = '';
        var img = document.createElement('img');
        img.src = e.target.result;
        img.alt = '';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------
     學籍表單：通訊地址「同上」勾選時帶入戶籍地址並鎖定欄位
  ------------------------------------------------------------------ */
  function initSameAddress() {
    var sameCheck = document.getElementById('sameAddress');
    var household = document.getElementById('householdAddress');
    var mailZip = document.getElementById('mailZip');
    var mailAddress = document.getElementById('mailAddress');
    if (!sameCheck || !household || !mailZip || !mailAddress) { return; }

    sameCheck.addEventListener('change', function () {
      if (sameCheck.checked) {
        mailAddress.value = household.value;
        mailZip.readOnly = true;
        mailAddress.readOnly = true;
      } else {
        mailZip.readOnly = false;
        mailAddress.readOnly = false;
      }
    });

    // 勾選狀態下，戶籍地址更動時同步通訊地址
    household.addEventListener('input', function () {
      if (sameCheck.checked) { mailAddress.value = household.value; }
    });
  }

  /* ------------------------------------------------------------------
     下拉多選選單：勾選後將選取項目回填至按鈕文字
     後端：勾選結果由各 checkbox 的 name[]/value 提交，此處僅處理 UI 顯示。
     搭配按鈕上的 data-bs-auto-close="outside"，點選選單內部不會收合。
  ------------------------------------------------------------------ */
  function initMultiSelectDropdowns() {
    var dropdowns = document.querySelectorAll('.multi-select-dropdown');
    dropdowns.forEach(function (dropdown) {
      var btn = dropdown.querySelector('[data-bs-toggle="dropdown"]');
      var checks = dropdown.querySelectorAll('.form-check-input');
      if (!btn || !checks.length) { return; }

      var placeholder = btn.textContent.trim();

      function updateButtonText() {
        var selected = [];
        checks.forEach(function (input) {
          if (!input.checked) { return; }
          var label = dropdown.querySelector('label[for="' + input.id + '"]');
          selected.push(label ? label.textContent.trim() : input.value);
        });

        if (selected.length) {
          btn.textContent = selected.join('、');
          btn.classList.remove('text-muted');
        } else {
          btn.textContent = placeholder;
          btn.classList.add('text-muted');
        }
      }

      checks.forEach(function (input) {
        input.addEventListener('change', updateButtonText);
      });

      // 編輯模式：後端預先勾選的項目於載入時直接回填
      updateButtonText();
    });
  }

  /* ------------------------------------------------------------------
     下拉搜尋選單（通用元件）：凡標記 [data-dropdown-search] 皆自動掛載，
     供全站任何頁面的「下拉內含篩選輸入框」單選欄位共用（例如查詢工具列的
     教師代碼/姓名篩選），不需要為個別頁面各自另寫一份邏輯。
     結構：.dropdown-search > 切換按鈕 + .dropdown-menu（內含
     [data-dropdown-search-input] 搜尋框、.dropdown-search-item 選項列表、
     [data-dropdown-search-empty] 查無結果訊息）+ [data-dropdown-search-value] 隱藏欄位
     後端：實際送出由 [data-dropdown-search-value] 隱藏欄位的 value 帶出，此處僅處理 UI 篩選與顯示
  ------------------------------------------------------------------ */
  function initSearchableDropdowns() {
    var dropdowns = document.querySelectorAll('[data-dropdown-search]');
    dropdowns.forEach(function (dropdown) {
      var toggleBtn = dropdown.querySelector('[data-bs-toggle="dropdown"]');
      var searchInput = dropdown.querySelector('[data-dropdown-search-input]');
      var valueInput = dropdown.querySelector('[data-dropdown-search-value]');
      var items = Array.prototype.slice.call(dropdown.querySelectorAll('.dropdown-search-item'));
      var emptyMsg = dropdown.querySelector('[data-dropdown-search-empty]');
      if (!toggleBtn || !searchInput || !items.length) { return; }

      function filterItems() {
        var keyword = searchInput.value.trim().toLowerCase();
        var visibleCount = 0;
        items.forEach(function (item) {
          var li = item.closest('li') || item;
          var matches = keyword === '' || item.textContent.toLowerCase().indexOf(keyword) !== -1;
          li.hidden = !matches;
          if (matches) { visibleCount += 1; }
        });
        if (emptyMsg) { emptyMsg.hidden = visibleCount > 0; }
      }

      function selectItem(item) {
        toggleBtn.textContent = item.textContent.trim();
        toggleBtn.classList.remove('text-muted');
        items.forEach(function (i) { i.classList.toggle('active', i === item); });
        if (valueInput) {
          valueInput.value = item.dataset.value || item.textContent.trim();
          valueInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var instance = window.bootstrap && bootstrap.Dropdown.getInstance(toggleBtn);
        if (instance) { instance.hide(); }
        toggleBtn.focus();
      }

      searchInput.addEventListener('input', filterItems);
      items.forEach(function (item) {
        item.addEventListener('click', function () { selectItem(item); });
      });

      // 下拉開啟時重置搜尋框並將焦點交給搜尋框，方便鍵盤使用者直接輸入篩選
      dropdown.addEventListener('shown.bs.dropdown', function () {
        searchInput.value = '';
        filterItems();
        searchInput.focus();
      });

      filterItems();
    });
  }

  /* ------------------------------------------------------------------
     Textarea 字數統計：凡標記 .textarea-counter-wrap 的 textarea 皆自動掛載。
     syncTextareaCounter 掛到 window，供其他頁面在程式回填 value 後手動同步。
  ------------------------------------------------------------------ */
  function syncTextareaCounter(textarea) {
    if (!textarea) { return; }
    var wrap = textarea.closest('.textarea-counter-wrap');
    if (!wrap) { return; }
    var counter = wrap.querySelector('.textarea-counter');
    if (!counter) { return; }
    var max = textarea.getAttribute('maxlength');
    counter.textContent = textarea.value.length + (max ? ' / ' + max : '');
  }
  window.syncTextareaCounter = syncTextareaCounter;

  function initTextareaCounters() {
    var textareas = document.querySelectorAll('.textarea-counter-wrap textarea');
    textareas.forEach(function (textarea) {
      syncTextareaCounter(textarea);
      textarea.addEventListener('input', function () {
        syncTextareaCounter(textarea);
      });
    });
  }

  /* ------------------------------------------------------------------
     各式報表列印 > 學籍資料：header 導覽精簡版狀態徽章
     - 目標連結由 layout/header_AdminLogged.html 以 [data-report-key] 標記
       （桌機下拉選單／手機 accordion 共用同一套屬性，故不需分別處理）
     - 相依判斷共用 js/report-dependency-config.js；該檔案不一定隨每個頁面
       載入，故在此視需要動態插入 <script> 後再渲染
     - 「前往結算」捷徑帶入 returnTo 參數，結算頁完成後可自動導回原連結
  ------------------------------------------------------------------ */
  function initReportNavBadges() {
    var links = document.querySelectorAll('a[data-report-key]');
    if (!links.length) { return; }

    function renderBadge(link) {
      var result = window.ReportDependency.getReportStatus(link.dataset.reportKey);

      link.classList.add('dropdown-item-report');

      var textEl = link.querySelector('.dropdown-item-report-text');
      if (!textEl) {
        var label = link.textContent.trim();
        link.textContent = '';
        textEl = document.createElement('span');
        textEl.className = 'dropdown-item-report-text';
        textEl.textContent = label;
        link.appendChild(textEl);
      }

      var badgeWrap = link.querySelector('.dropdown-item-report-badge-wrap');
      if (!badgeWrap) {
        badgeWrap = document.createElement('span');
        badgeWrap.className = 'dropdown-item-report-badge-wrap';
        link.appendChild(badgeWrap);
      }
      badgeWrap.innerHTML = '';

      var badge = document.createElement('span');
      badge.className = 'report-nav-badge ' + result.badgeClass;
      badge.title = result.tooltip;
      badge.innerHTML = '<i class="bi ' + result.icon + '" aria-hidden="true"></i>' + result.label;
      badgeWrap.appendChild(badge);

      if (result.settlePage) {
        var goToSettlePage = function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = result.settlePage + '?returnTo=' + encodeURIComponent(link.getAttribute('href'));
        };

        badge.classList.add('report-nav-badge--actionable');
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        badge.setAttribute('aria-label', result.label + '，' + result.settleLabel + '：' + result.tooltip);
        badge.addEventListener('click', goToSettlePage);
        badge.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            goToSettlePage(e);
          }
        });

        var actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'report-nav-action';
        actionBtn.title = result.settleLabel;
        actionBtn.setAttribute('aria-label', result.settleLabel + '：' + result.tooltip);
        actionBtn.innerHTML = '<i class="bi bi-arrow-right" aria-hidden="true"></i>';
        actionBtn.addEventListener('click', goToSettlePage);
        badgeWrap.appendChild(actionBtn);
      }
    }

    function renderAll() {
      links.forEach(renderBadge);
    }

    if (window.ReportDependency) {
      renderAll();
      return;
    }

    var script = document.createElement('script');
    script.src = 'js/report-dependency-config.js';
    script.onload = renderAll;
    document.head.appendChild(script);
  }

  /* ------------------------------------------------------------------
     初始化
  ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    loadLayouts();
    initScrollTop();
    initPasswordToggle();
    initCaptcha();
    initGuestMenuAnimation();
    initCheckAllGroups();
    initPhotoPreview();
    initSameAddress();
    initMultiSelectDropdowns();
    initSearchableDropdowns();
    initTextareaCounters();
  });

  document.addEventListener('layout:loaded', function () {
    initGuestMenuAnimation();
    initAdminNavSubmenus();
    initAdminNavSticky();
    initReportNavBadges();
  });
})();
