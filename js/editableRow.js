(function () {
    'use strict';

    function qs(selector, scope) {
        return (scope || document).querySelector(selector);
    }

    function qsa(selector, scope) {
        return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    }

    function optionText(select) {
        var opt = select.options[select.selectedIndex];
        return opt ? opt.textContent : '';
    }

    // 序號欄一律依 DOM 順序重新編號，確保新增列插入最上方後仍維持連續序號
    function renumberSeqCells(tbody) {
        if (!tbody) return;
        qsa('tr', tbody).forEach(function (tr, index) {
            var seqCell = qs('td[data-label="序號"] .cell-value', tr);
            if (seqCell) seqCell.textContent = index + 1;
        });
    }

    function setRowMode(row, mode) {
        row.dataset.mode = mode;
        var editBtn = qs('.btn-edit', row);
        var saveBtn = qs('.btn-row-save', row);
        var cancelBtn = qs('.btn-row-cancel', row);
        var isEditing = mode !== 'view';

        if (editBtn) editBtn.hidden = isEditing;
        if (saveBtn) saveBtn.hidden = !isEditing;
        if (cancelBtn) cancelBtn.hidden = !isEditing;
    }

    // 一列可同時標記多個 data-editable-field 欄位，全部一併進入/離開編輯模式
    function getEditableCells(row) {
        return qsa('[data-editable-field]', row);
    }

    // 下拉類型欄位：既有列的儲存格內須內嵌 <template data-field-template> 存放選項 markup，
    // 進入編輯時複製出 <select> 並依目前文字自動選取對應選項（template 內容為 inert DOM，
    // 不會被 cell.querySelector 誤抓成「目前生效中的欄位」）。
    function enterFieldEdit(cell) {
        var valueSpan = qs('.cell-value', cell);
        var originalText = valueSpan ? valueSpan.textContent.trim() : (cell.dataset.originalText || '');
        cell.dataset.originalText = originalText;

        var fieldType = cell.dataset.fieldType || 'text';
        var field;

        if (fieldType === 'select') {
            var template = qs('template[data-field-template]', cell);
            field = template.content.firstElementChild.cloneNode(true);
            qsa('option', field).forEach(function (opt) {
                opt.selected = opt.textContent.trim() === originalText;
            });
        } else {
            field = document.createElement('input');
            field.type = fieldType === 'number' ? 'number' : 'text';
            field.className = 'form-control';
            field.value = originalText;
        }

        if (valueSpan) {
            valueSpan.replaceWith(field);
        } else {
            cell.appendChild(field);
        }

        return field;
    }

    function exitFieldEdit(cell, text) {
        var field = qs('input, select', cell);
        var span = document.createElement('span');
        span.className = 'cell-value';
        span.textContent = text;

        if (field) {
            field.replaceWith(span);
        } else {
            cell.appendChild(span);
        }

        cell.dataset.originalText = text;
    }

    // 既有列點擊「編輯」：所有 data-editable-field 標記的欄位一併變成輸入框／下拉選單
    function enterEdit(row) {
        var cells = getEditableCells(row);
        if (!cells.length) return;

        var firstField = null;
        cells.forEach(function (cell, index) {
            var field = enterFieldEdit(cell);
            if (index === 0) firstField = field;
        });

        if (firstField) firstField.focus();
        setRowMode(row, 'edit-existing');
    }

    function cancelEdit(row) {
        var cells = getEditableCells(row);
        if (!cells.length) return;

        cells.forEach(function (cell) {
            exitFieldEdit(cell, cell.dataset.originalText || '');
        });

        setRowMode(row, 'view');
    }

    function saveEdit(row) {
        var cells = getEditableCells(row);
        if (!cells.length) return;

        cells.forEach(function (cell) {
            var field = qs('input, select', cell);
            var text = field ? (field.tagName === 'SELECT' ? optionText(field) : field.value) : (cell.dataset.originalText || '');
            exitFieldEdit(cell, text);
        });

        setRowMode(row, 'view');
    }

    // 新增列：所有 data-field 欄位皆須通過必填檢查後才整列轉為一般顯示列
    function commitNewRow(row) {
        var fields = qsa('[data-field]', row);
        var isValid = true;

        fields.forEach(function (field) {
            field.classList.remove('is-invalid');
            if (field.hasAttribute('required') && !field.value) {
                field.classList.add('is-invalid');
                isValid = false;
            }
        });

        if (!isValid) return;

        fields.forEach(function (field) {
            var cell = field.closest('td');
            var isSelect = field.tagName === 'SELECT';
            var text = isSelect ? optionText(field) : field.value;
            var isEditableField = field.hasAttribute('data-editable-field');
            var fieldType = field.dataset.fieldType || (isSelect ? 'select' : (field.type === 'number' ? 'number' : 'text'));

            // 下拉類型欄位需在改存為一般顯示列前，先把原始 <select> 存成 template，
            // 供之後再次點擊「編輯」時複製還原（見 enterFieldEdit）
            var selectTemplate = isEditableField && isSelect ? field.cloneNode(true) : null;

            cell.innerHTML = '';
            var span = document.createElement('span');
            span.className = 'cell-value';
            span.textContent = text;
            cell.appendChild(span);

            if (isEditableField) {
                cell.setAttribute('data-editable-field', '');
                cell.dataset.fieldType = fieldType;
                cell.dataset.originalText = text;

                if (selectTemplate) {
                    var tpl = document.createElement('template');
                    tpl.setAttribute('data-field-template', '');
                    tpl.content.appendChild(selectTemplate);
                    cell.appendChild(tpl);
                }
            }
        });

        row.removeAttribute('data-row-new');
        setRowMode(row, 'view');
    }

    function bindRow(row) {
        var editBtn = qs('.btn-edit', row);
        var saveBtn = qs('.btn-row-save', row);
        var cancelBtn = qs('.btn-row-cancel', row);

        if (editBtn) {
            editBtn.addEventListener('click', function () {
                enterEdit(row);
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                if (row.hasAttribute('data-row-new')) {
                    commitNewRow(row);
                } else {
                    saveEdit(row);
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                if (row.hasAttribute('data-row-new')) {
                    var tbody = row.parentElement;
                    row.remove();
                    renumberSeqCells(tbody);
                } else {
                    cancelEdit(row);
                }
            });
        }

        setRowMode(row, row.hasAttribute('data-row-new') ? 'edit-new' : 'view');

        if (!row.hasAttribute('data-row-new')) {
            getEditableCells(row).forEach(function (cell) {
                var valueSpan = qs('.cell-value', cell);
                cell.dataset.originalText = valueSpan ? valueSpan.textContent.trim() : '';
            });
        }
    }

    function initAddRowButtons() {
        qsa('[data-add-row]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var template = document.getElementById(btn.dataset.addRow);
                var tbody = document.getElementById(btn.dataset.targetBody);
                if (!template || !tbody) return;

                var fragment = template.content.cloneNode(true);
                var row = fragment.querySelector('tr');
                tbody.insertBefore(row, tbody.firstChild);

                bindRow(row);
                renumberSeqCells(tbody);

                var firstField = qs('input, select', row);
                if (firstField) firstField.focus();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        qsa('tbody tr').forEach(bindRow);
        initAddRowButtons();
    });
})();
