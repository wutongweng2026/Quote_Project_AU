
import { state } from './state';
import { calculateTotals, getFinalConfigText } from './calculations';
import type { CustomItem, CustomModalState, AppState } from './types';
import { CONFIG_ROWS } from './config';

const appContainer = document.querySelector('#app')!;
const $ = (selector: string) => document.querySelector(selector);

export function renderApp() {
    let html = '';
    if (state.appStatus === 'loading') {
        html = `
            <div class="app-status-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 500px;">
                <div class="loading-spinner"></div>
                <h2 style="margin-top: 1.5rem; color: var(--secondary-text-color);">正在加载数据，请稍候...</h2>
            </div>`;
    } else if (state.appStatus === 'error') {
        html = `<div class="app-status-container"><h2>出现错误</h2><div class="error-details">${state.errorMessage}</div><button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">重试</button></div>`;
    } else if (state.view === 'login') {
        html = renderLoginView();
    } else if (!state.currentUser) {
        html = renderLoginView();
    } else if (state.view === 'quote') {
        html = renderQuoteTool();
    } else if (state.view === 'admin') {
        html = renderAdminPanel();
    } else if (state.view === 'userManagement') {
        html = renderUserManagementPanel();
    } else if (state.view === 'loginLog') {
        html = renderLoginLogPanel();
    }

    if (state.showCustomModal) {
        html += renderCustomModal();
    }
    appContainer.innerHTML = html;
}

function renderLoginView() {
    return `
        <div class="auth-container">
            <div class="auth-box">
                <h1>产品报价系统登录</h1>
                <div id="login-error" class="auth-error" style="display: none;"></div>
                <form id="login-form">
                    <div class="auth-input-group">
                        <label for="username">用户名</label>
                        <input type="text" id="username" name="username" required autocomplete="username">
                    </div>
                    <div class="auth-input-group">
                        <label for="password">密码</label>
                        <input type="password" id="password" name="password" required autocomplete="current-password">
                    </div>
                    <button type="submit" class="auth-button">登录</button>
                </form>
            </div>
        </div>
    `;
}

// ... 其余渲染函数保持不变 ...
function renderCustomModal() {
    const { title, message, confirmText, cancelText, showCancel, isDanger, inputType, errorMessage } = state.customModal;
    return `
        <div class="modal-overlay">
            <div class="modal-content">
                <h2>${title}</h2>
                <div style="margin-bottom: 1.5rem;">${message}</div>
                <div class="modal-buttons">
                    ${showCancel ? `<button id="custom-modal-cancel-btn">${cancelText}</button>` : ''}
                    <button class="${isDanger ? 'danger' : ''}" id="custom-modal-confirm-btn">${confirmText}</button>
                </div>
            </div>
        </div>
    `;
}

function renderQuoteTool() {
    const totals = calculateTotals();
    const lastUpdated = state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : '从未更新';
    return `
        <div class="quoteContainer">
            <header class="quoteHeader">
                <h1>产品报价系统 v2.1</h1>
                <div class="header-actions">
                    <span style="font-size: 0.8rem; color: #666;">更新: ${lastUpdated}</span>
                    <button id="app-view-toggle-btn">后台</button>
                    <button id="logout-btn">退出</button>
                </div>
            </header>
            <main class="quoteBody">
                <table class="config-table">
                    <thead><tr><th>分类</th><th>规格型号</th><th>数量</th><th>操作</th></tr></thead>
                    <tbody>${CONFIG_ROWS.map(cat => renderConfigRow(cat)).join('')}</tbody>
                </table>
                <div class="final-config-section">
                    <label>最终配置预览:</label>
                    <textarea readonly>${getFinalConfigText()}</textarea>
                </div>
            </main>
            <footer class="quoteFooter">
                <div style="visibility: ${state.showFinalQuote ? 'visible' : 'hidden'}">
                    <span>预估总价:</span> <strong>¥ ${totals.finalPrice.toFixed(2)}</strong>
                </div>
                <div class="footer-buttons">
                    <button id="reset-btn">重置</button>
                    <button id="calc-quote-btn" style="background: var(--primary-color);">生成报价</button>
                </div>
            </footer>
        </div>
    `;
}

function renderConfigRow(category: string) {
    const sel = state.selection[category] || { model: '', quantity: 1 };
    const models = state.priceData.prices[category] || {};
    return `
        <tr data-category="${category}">
            <td>${category}</td>
            <td>
                <select class="model-select">
                    <option value="">-- 请选择 --</option>
                    ${Object.keys(models).map(m => `<option value="${m}" ${sel.model === m ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" class="quantity-input" value="${sel.quantity}" min="0"></td>
            <td>-</td>
        </tr>
    `;
}

function renderAdminPanel() { return `<div class="adminContainer"><header class="adminHeader"><h2>管理后台</h2><button id="back-to-quote-btn">返回</button></header><div class="admin-content">数据管理面板</div></div>`; }
function renderUserManagementPanel() { return `<div>用户管理</div>`; }
function renderLoginLogPanel() { return `<div>日志管理</div>`; }

export function showModal(options: Partial<CustomModalState>) {
    state.customModal = { title: '提示', message: '', onConfirm: () => { state.showCustomModal = false; renderApp(); }, confirmText: '确定', cancelText: '取消', showCancel: false, isDanger: false, ...options };
    state.showCustomModal = true;
    renderApp();
}

export function updateTotalsUI() {
    const totals = calculateTotals();
    const el = document.querySelector('.quoteFooter strong');
    if (el) el.textContent = `¥ ${totals.finalPrice.toFixed(2)}`;
}

export function setSyncStatus(status: AppState['syncStatus']) {
    console.log("Sync Status:", status);
}

export function renderAdminDataTableBody() { return ''; }
