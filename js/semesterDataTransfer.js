(function () {
    'use strict';

    function qs(selector, scope) {
        return (scope || document).querySelector(selector);
    }

    var feedbackModalEl = qs('#feedbackModal');
    var feedbackCountdownTimer = null;

    function showFeedback(title, message) {
        if (!feedbackModalEl || typeof bootstrap === 'undefined') return;

        qs('.feedback-title', feedbackModalEl).textContent = title;
        qs('.feedback-desc', feedbackModalEl).textContent = message;

        var countdownNum = qs('.feedback-countdown-num', feedbackModalEl);
        var seconds = 3;
        countdownNum.textContent = seconds;

        var modal = bootstrap.Modal.getOrCreateInstance(feedbackModalEl);
        modal.show();

        clearInterval(feedbackCountdownTimer);
        feedbackCountdownTimer = setInterval(function () {
            seconds -= 1;
            countdownNum.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(feedbackCountdownTimer);
                modal.hide();
            }
        }, 1000);
    }

    // 與 js/semesterSetup.js 共用同一把 key，讓「學年度與學期設置」與本頁的啟用狀態能互相同步
    // 後端：實際狀態應以後端資料為準，此處 localStorage 僅為前端示意用的跨頁同步機制
    var SEMESTER_ACTIVATION_KEY = 'ncsesSemesterActivated_114-1';

    // ------------------------------------------------------------------
    // 左側：勾選確認框連動「立即啟用」按鈕；點擊即直接啟用（不跳窗二次確認，
    // 確認流程已在「學年度與學期設置」頁完成），並即時解鎖右側四項任務
    // ------------------------------------------------------------------
    var confirmCheck = qs('#transferConfirmCheck');
    var activateBox = qs('#transferActivateBox');
    var activateText = qs('#transferActivateText');
    var notActivatedNotice = qs('#transferNotActivatedNotice');

    var lockedItems = ['#transferCard1Btn', '#transferCard2Btn', '#transferCard3Btn', '#transferCard4Btn'].map(function (selector) {
        return qs(selector);
    });

    var isActivated = false;

    function applyActivatedState() {
        if (isActivated) return;
        isActivated = true;

        localStorage.setItem(SEMESTER_ACTIVATION_KEY, '1');

        if (notActivatedNotice) {
            notActivatedNotice.classList.add('transfer-page-notice--done');
            var noticeIcon = qs('.bi', notActivatedNotice);
            if (noticeIcon) noticeIcon.className = 'bi bi-check-circle-fill';
            var noticeTitle = qs('.transfer-page-notice-title', notActivatedNotice);
            if (noticeTitle) noticeTitle.textContent = '114 學年度 第 1 學期 已啟用';
            var noticeBody = qs('.transfer-page-notice-text p:last-child', notActivatedNotice);
            if (noticeBody) noticeBody.textContent = '請依序執行右方各項資料轉移作業，以確保資料正確性與一致性。';
        }

        if (confirmCheck) {
            confirmCheck.checked = true;
            confirmCheck.disabled = true;
        }
        if (activateBox) {
            activateBox.disabled = true;
            activateBox.setAttribute('aria-label', '114 學年度 第 1 學期 已啟用');
            var activateIcon = qs('.bi', activateBox);
            if (activateIcon) activateIcon.className = 'bi bi-check-lg';
            activateBox.classList.add('transfer-activate-box--done');
        }
        if (activateText) activateText.innerHTML = '新學年度已啟用：<strong>114 學年度 第 1 學期</strong>';

        lockedItems.forEach(function (btn) {
            if (!btn) return;
            btn.disabled = false;
            var lockIcon = qs('.bi-lock-fill', btn);
            if (lockIcon) {
                lockIcon.className = 'bi bi-arrow-right';
                lockIcon.removeAttribute('title');
            }
        });
    }

    function scrollToCards() {
        var target = qs('#transferCardsStart');
        if (!target) return;
        var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var top = target.getBoundingClientRect().top + window.pageYOffset - 24;
        window.scrollTo({ top: top, behavior: prefersReduced ? 'auto' : 'smooth' });
    }

    if (confirmCheck && activateBox) {
        confirmCheck.addEventListener('change', function () {
            activateBox.disabled = !confirmCheck.checked;
        });

        activateBox.addEventListener('click', function () {
            if (activateBox.disabled || isActivated) return;
            applyActivatedState();
            showFeedback('新學年度已啟用', '系統已正式前進至 114 學年度 第 1 學期，您現在可以開始執行右側各項資料轉移作業。');
            scrollToCards();
        });
    }

    // 若已透過「學年度與學期設置」頁完成啟用，回到本頁時自動同步狀態（不捲動、不彈窗）
    if (!isActivated && localStorage.getItem(SEMESTER_ACTIVATION_KEY) === '1') {
        applyActivatedState();
    }

    function markBadgeDone(badge) {
        if (!badge) return;
        badge.classList.remove('report-status--pending');
        badge.classList.add('report-status--available');
        var badgeIcon = qs('.bi', badge);
        if (badgeIcon) badgeIcon.className = 'bi bi-check-circle-fill';
        var badgeText = badge.lastChild;
        if (badgeText && badgeText.nodeType === Node.TEXT_NODE) {
            badgeText.textContent = '已完成';
        }
    }

    // 課程轉移方式 radio value → 顯示用文字，供卡片 3 完成後於說明文字中標註實際採用的複製方式
    var COURSE_MODE_LABELS = {
        subjectOnly: '僅科目名稱',
        subjectTeacher: '科目＋課表與老師',
        subjectTeacherStudent: '科目＋課表與老師＋原班學生'
    };

    function getCourseModeLabel() {
        var checked = qs('input[name="transferCourseMode"]:checked');
        return checked ? COURSE_MODE_LABELS[checked.value] : '';
    }

    // ------------------------------------------------------------------
    // 右側：四項執行按鈕 — 點擊後顯示進度條動畫，完成後按鈕隱藏、
    // 徽章轉為綠色「已完成」，並將說明文字置換為完成後敘述
    // ------------------------------------------------------------------
    var transferActions = [
        { btnId: '#transferCard1Btn', badgeId: '#transferCard1Badge', descId: '#transferCard1Desc', progressId: '#transferCard1Progress', completedDesc: '已完成全校學生年級集體升級與新學年班級初始化，無須重複操作。', title: '編班資料轉移完成', message: '已完成全校學生年級集體升級與新學年班級初始化。' },
        { btnId: '#transferCard2Btn', badgeId: '#transferCard2Badge', descId: '#transferCard2Desc', progressId: '#transferCard2Progress', completedDesc: '本學期代課費用設定初始化完成，無須重複操作。', title: '代課費用轉移完成', message: '已完成本學期代課費用設定資料轉移。' },
        {
            btnId: '#transferCard3Btn', badgeId: '#transferCard3Badge', descId: '#transferCard3Desc', progressId: '#transferCard3Progress',
            // 卡片 3 完成敘述需標註實際採用的複製方式，於點擊當下（動畫播放前）先取值，
            // 避免動畫播放期間使用者變更選取，導致敘述與實際結果不一致
            getCompletedDesc: function () {
                var label = getCourseModeLabel();
                return '已依所選複製方式，完成科目與課程資料轉移' + (label ? '（使用方式：' + label + '）' : '') + '，無須重複操作。';
            },
            title: '課程轉移完成', message: '已依所選複製方式，完成科目與課程資料轉移。'
        },
        { btnId: '#transferCard4Btn', badgeId: '#transferCard4Badge', descId: '#transferCard4Desc', progressId: '#transferCard4Progress', completedDesc: '已完成特教 IEP 基本資料平移，無須重複操作。', title: 'IEP資料平移完成', message: '已完成特教 IEP 基本資料平移。' }
    ];

    var PROGRESS_DURATION = 1200;

    transferActions.forEach(function (action) {
        var btn = qs(action.btnId);
        var badge = qs(action.badgeId);
        var descEl = qs(action.descId);
        var progressEl = qs(action.progressId);
        var progressFill = progressEl ? qs('.transfer-progress-fill', progressEl) : null;
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (btn.disabled) return;

            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');

            var completedDesc = action.getCompletedDesc ? action.getCompletedDesc() : action.completedDesc;

            var textEl = qs('.transfer-action-btn-text', btn);
            if (textEl) textEl.textContent = '資料轉移中…';

            if (progressEl && progressFill) {
                progressEl.hidden = false;
                progressFill.style.width = '0%';
                void progressFill.offsetWidth; // 強制 reflow，確保 transition 會重新觸發
                requestAnimationFrame(function () {
                    progressFill.style.width = '100%';
                });
            }

            var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            setTimeout(function () {
                btn.hidden = true;
                btn.removeAttribute('aria-busy');
                if (progressEl) progressEl.hidden = true;

                markBadgeDone(badge);

                if (descEl) {
                    descEl.textContent = completedDesc;
                    descEl.hidden = false;
                }

                var card = btn.closest('.transfer-card');
                if (card) {
                    var formParts = card.querySelectorAll('.transfer-semester-row, fieldset');
                    formParts.forEach(function (el) { el.hidden = true; });
                }

                showFeedback(action.title, action.message);
            }, prefersReduced ? 0 : PROGRESS_DURATION);
        });
    });
})();
