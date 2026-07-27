(function () {
    'use strict';

    function qs(selector, scope) {
        return (scope || document).querySelector(selector);
    }

    function qsa(selector, scope) {
        return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    }

    var grid = qs('#permissionGrid');
    if (!grid) return;

    var searchInput = qs('#permissionSearch');
    var cancelBtn = qs('#permissionCancelBtn');
    var saveBtn = qs('#permissionSaveBtn');
    var statsCheckedEl = qs('#permissionStatsChecked');
    var statsTotalEl = qs('#permissionStatsTotal');
    var saveModalEl = qs('#permissionSaveModal');

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // 由下往上重新計算：子分類 -> 模組 -> 全頁統計，確保三態勾選狀態一致
    function recomputeSubgroup(subgroupEl) {
        var items = qsa('[data-permission-item]', subgroupEl);
        var checkedCount = items.filter(function (cb) { return cb.checked; }).length;
        var total = items.length;
        var toggle = qs('[data-subgroup-toggle]', subgroupEl);
        if (toggle) {
            toggle.checked = total > 0 && checkedCount === total;
            toggle.indeterminate = checkedCount > 0 && checkedCount < total;
        }
        var countEl = qs('[data-subgroup-count]', subgroupEl);
        if (countEl) countEl.textContent = '(' + checkedCount + '/' + total + ')';
        return { checked: checkedCount, total: total };
    }

    function recomputeModule(cardEl) {
        var topList = qs(':scope > .permission-list', cardEl);
        var topItems = topList ? qsa('[data-permission-item]', topList) : [];
        var totalChecked = topItems.filter(function (cb) { return cb.checked; }).length;
        var totalCount = topItems.length;

        qsa(':scope > .permission-subgroup', cardEl).forEach(function (subgroupEl) {
            var result = recomputeSubgroup(subgroupEl);
            totalChecked += result.checked;
            totalCount += result.total;
        });

        var moduleToggle = qs('[data-module-toggle]', cardEl);
        if (moduleToggle) {
            moduleToggle.checked = totalCount > 0 && totalChecked === totalCount;
            moduleToggle.indeterminate = totalChecked > 0 && totalChecked < totalCount;
        }
        var moduleCountEl = qs('[data-module-count]', cardEl);
        if (moduleCountEl) moduleCountEl.textContent = totalChecked + '/' + totalCount;

        return { checked: totalChecked, total: totalCount };
    }

    function recomputeStats() {
        var grandChecked = 0;
        var grandTotal = 0;
        qsa('[data-permission-card]', grid).forEach(function (cardEl) {
            var result = recomputeModule(cardEl);
            grandChecked += result.checked;
            grandTotal += result.total;
        });
        if (statsCheckedEl) statsCheckedEl.textContent = grandChecked;
        if (statsTotalEl) statsTotalEl.textContent = grandTotal;
    }

    grid.addEventListener('change', function (e) {
        var target = e.target;

        if (target.matches('[data-permission-item]')) {
            recomputeStats();
            return;
        }

        if (target.matches('[data-subgroup-toggle]')) {
            var subgroupEl = target.closest('[data-permission-subgroup]');
            qsa('[data-permission-item]', subgroupEl).forEach(function (cb) { cb.checked = target.checked; });
            recomputeStats();
            return;
        }

        if (target.matches('[data-module-toggle]')) {
            var cardEl = target.closest('[data-permission-card]');
            qsa('[data-permission-item]', cardEl).forEach(function (cb) { cb.checked = target.checked; });
            recomputeStats();
        }
    });

    // ------------------------------------------------------------------
    // 搜尋功能項目：自動定位並標示符合項目，其餘卡片淡化
    // ------------------------------------------------------------------
    function applySearch(rawQuery) {
        var query = rawQuery.trim().toLowerCase();
        var firstMatch = null;

        qsa('[data-permission-card]', grid).forEach(function (cardEl) {
            var cardHasMatch = false;

            qsa('.permission-item', cardEl).forEach(function (itemEl) {
                var labelEl = qs('label', itemEl);
                var text = labelEl ? labelEl.textContent.toLowerCase() : '';
                var isMatch = query.length > 0 && text.indexOf(query) !== -1;

                itemEl.classList.toggle('permission-item--highlight', isMatch);
                if (isMatch) {
                    cardHasMatch = true;
                    if (!firstMatch) firstMatch = itemEl;
                }
            });

            cardEl.classList.toggle('permission-card--faded', query.length > 0 && !cardHasMatch);
        });

        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            applySearch(searchInput.value);
        });
    }

    // ------------------------------------------------------------------
    // 取消／存檔：存檔時鎖定目前勾選狀態為還原基準，取消則還原至上次存檔狀態
    // 後端：實際存檔應改為呼叫後端 API，此處以 localStorage 快照示意還原基準
    // ------------------------------------------------------------------
    function captureSnapshot() {
        var snapshot = {};
        qsa('[data-permission-item]', grid).forEach(function (cb) { snapshot[cb.id] = cb.checked; });
        return snapshot;
    }

    var savedSnapshot = captureSnapshot();

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            qsa('[data-permission-item]', grid).forEach(function (cb) {
                if (Object.prototype.hasOwnProperty.call(savedSnapshot, cb.id)) {
                    cb.checked = savedSnapshot[cb.id];
                }
            });
            recomputeStats();
            if (searchInput) {
                searchInput.value = '';
                applySearch('');
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            savedSnapshot = captureSnapshot();

            if (saveModalEl && typeof bootstrap !== 'undefined') {
                var modal = bootstrap.Modal.getOrCreateInstance(saveModalEl);
                modal.show();
                setTimeout(function () { modal.hide(); }, 1500);
            }
        });
    }

    recomputeStats();
})();
