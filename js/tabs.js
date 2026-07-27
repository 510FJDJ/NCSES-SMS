/* ==========================================================================
   無障礙頁籤（WAI-ARIA Tabs）共用控制器
   規則見 CLAUDE.md 第 8 節：
   - 僅選中頁籤可被 Tab 鍵聚焦（roving tabindex）
   - ← / → 方向鍵循環切換焦點，切換時內容面板立即更新（即時啟用）
   - Home / End 跳至第一 / 最後一個頁籤
   後端：頁籤內容為前端切換顯示，實際資料查詢由各頁籤內表單自行送出。
   ========================================================================== */
(function () {
  'use strict';

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function activateTab(tabs, panels, target, moveFocus) {
    // 已鎖定（disabled）的頁籤不得因方向鍵切換而被強制啟用
    if (target.disabled) { return; }

    tabs.forEach(function (tab) {
      var selected = tab === target;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-active', selected);

      var panel = panels[tab.getAttribute('aria-controls')];
      if (panel) { panel.hidden = !selected; }
    });
    if (moveFocus) { target.focus(); }
    target.dispatchEvent(new CustomEvent('tabs:activate', { bubbles: true }));
  }

  function initTabGroup(tablist) {
    if (tablist.dataset.tabsBound) { return; }
    tablist.dataset.tabsBound = 'true';

    var tabs = qsa('[role="tab"]', tablist);
    if (!tabs.length) { return; }

    var panels = {};
    tabs.forEach(function (tab) {
      var panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) { panels[tab.getAttribute('aria-controls')] = panel; }
    });

    // 初始同步：以標記為 aria-selected="true" 的頁籤為準，確保面板顯隱與 tabindex 一致
    var current = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    activateTab(tabs, panels, current, false);

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tabs, panels, tab, false);
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
        activateTab(tabs, panels, tabs[nextIndex], true);
      }
    });
  }

  // root 可指定局部範圍（供動態插入內容後重新初始化），預設整份文件
  function initAccessibleTabs(root) {
    qsa('[role="tablist"]', root || document).forEach(initTabGroup);
  }

  window.initAccessibleTabs = initAccessibleTabs;

  document.addEventListener('DOMContentLoaded', function () {
    initAccessibleTabs();
  });
})();
