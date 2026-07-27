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

    // 與 js/semesterDataTransfer.js 共用同一把 key，讓兩頁的啟用狀態能互相同步
    // 後端：實際狀態應以後端資料為準，此處 localStorage 僅為前端示意用的跨頁同步機制
    var SEMESTER_ACTIVATION_KEY = 'ncsesSemesterActivated_114-1';

    // ------------------------------------------------------------------
    // 頁籤二：勾選確認框連動「正式開啟新學期」按鈕的啟用/停用狀態；
    // 點擊後顯示不自動關閉的 Modal，「取消」或「前往資料轉移管理」皆代表
    // 使用者已確認啟用（此為不可逆動作，取消僅代表不強制導向下一頁）
    // ------------------------------------------------------------------
    var confirmCheck = qs('#semesterConfirmCheck');
    var activateBtn = qs('#semesterActivateBtn');
    var activateSuccessModalEl = qs('#semesterActivateSuccessModal');
    var hintText = qs('.semester-hint-text');

    var isActivated = false;

    function applyActivatedState() {
        if (isActivated) return;
        isActivated = true;

        localStorage.setItem(SEMESTER_ACTIVATION_KEY, '1');

        if (confirmCheck) {
            confirmCheck.checked = true;
            confirmCheck.disabled = true;
        }
        if (activateBtn) {
            activateBtn.disabled = true;
            activateBtn.innerHTML = '114 學年度 第 1 學期 已啟用<i class="bi bi-check-lg" aria-hidden="true"></i>';
        }
        if (hintText) hintText.innerHTML = '<strong>114 學年度 第 1 學期</strong> 已啟用，請至「學期資料轉移管理」依序執行各項資料轉移作業。';
    }

    if (confirmCheck && activateBtn) {
        confirmCheck.addEventListener('change', function () {
            activateBtn.disabled = !confirmCheck.checked;
        });

        activateBtn.addEventListener('click', function () {
            if (activateBtn.disabled || isActivated) return;
            if (activateSuccessModalEl && typeof bootstrap !== 'undefined') {
                bootstrap.Modal.getOrCreateInstance(activateSuccessModalEl).show();
            }
        });
    }

    if (activateSuccessModalEl) {
        var activateCancelBtn = qs('.btn-cancel', activateSuccessModalEl);
        var activateGoBtn = qs('.btn-primary', activateSuccessModalEl);
        if (activateCancelBtn) activateCancelBtn.addEventListener('click', applyActivatedState);
        if (activateGoBtn) activateGoBtn.addEventListener('click', applyActivatedState);
    }

    // 若已透過「學期資料轉移管理」頁完成啟用，回到本頁時自動同步狀態
    if (!isActivated && localStorage.getItem(SEMESTER_ACTIVATION_KEY) === '1') {
        applyActivatedState();
    }

    // ------------------------------------------------------------------
    // 頁籤一：學期日期防呆驗證
    // 結束日期必須大於開始日期，且區間不得超過 180 天
    // ------------------------------------------------------------------
    var MAX_SEMESTER_DAYS = 180;

    var startInput = qs('#semesterStartDate');
    var endInput = qs('#semesterEndDate');
    var deadlineInput = qs('#semesterScoreDeadline');
    var semesterForm = qs('#semesterForm');

    function setError(input, message) {
        input.classList.add('is-invalid');
        var errorEl = qs('#' + input.id + 'Error');
        if (errorEl) errorEl.textContent = message;
    }

    function clearError(input) {
        input.classList.remove('is-invalid');
    }

    function daysBetween(startStr, endStr) {
        var start = new Date(startStr);
        var end = new Date(endStr);
        return Math.round((end - start) / (1000 * 60 * 60 * 24));
    }

    // 僅檢查開始/結束日期的先後順序與區間上限，不涉及必填檢查（供即時回饋使用）
    function checkDateRange() {
        if (!startInput.value || !endInput.value) return true;

        var diff = daysBetween(startInput.value, endInput.value);

        if (diff <= 0) {
            setError(endInput, '學期結束日期必須晚於學期開始日期。');
            return false;
        }

        if (diff > MAX_SEMESTER_DAYS) {
            setError(endInput, '學期區間不得超過 180 天（約 6 個月）。');
            return false;
        }

        clearError(endInput);
        return true;
    }

    if (endInput) {
        endInput.addEventListener('change', function () {
            clearError(endInput);
            checkDateRange();
        });
    }

    if (startInput) {
        startInput.addEventListener('change', function () {
            clearError(startInput);
            clearError(endInput);
        });
    }

    // 送出前完整驗證：必填欄位 + 日期先後關係 + 區間上限
    function validateDates() {
        var isValid = true;
        var requiredInputs = [startInput, endInput, deadlineInput];

        requiredInputs.forEach(function (input) {
            clearError(input);
            if (!input.value) {
                setError(input, '此欄位為必填，請選擇日期。');
                isValid = false;
            }
        });

        if (isValid && !checkDateRange()) {
            isValid = false;
        }

        return isValid;
    }

    if (semesterForm) {
        semesterForm.addEventListener('submit', function (event) {
            event.preventDefault();

            if (!validateDates()) return;

            // 後端：實際儲存邏輯由後端接手，此處僅示意前端驗證通過後的回饋
            showFeedback('儲存成功', '學期設定已更新完成。');
        });
    }
})();
