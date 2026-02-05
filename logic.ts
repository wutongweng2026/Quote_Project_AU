
import { state, supabase, getInitialSelection } from './state';
import { renderApp, showModal, updateTotalsUI, setSyncStatus, renderAdminDataTableBody } from './ui';
import { getFinalConfigText, calculateTotals } from './calculations';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js'; 
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

declare var XLSX: any;
const $ = (selector: string) => document.querySelector(selector);
const CACHE_KEY = 'qqs_price_data_cache_v1';

// --- HELPER FUNCTIONS ---

async function updateLastUpdatedTimestamp() {
    const newTimestamp = new Date().toISOString();
    const { error } = await supabase.from('quote_meta').upsert({ 
        key: 'last_prices_updated', 
        value: newTimestamp
    });
    if (error) {
        console.error("Failed to update timestamp:", error);
    } else {
        state.lastUpdated = newTimestamp; 
    }
}

// --- LOGIC FUNCTIONS ---

export function addEventListeners() {
    const appContainer = $('#app')!;

    appContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = e.target as HTMLFormElement;

        if (target.id === 'login-form') {
            const username = (target.elements.namedItem('username') as HTMLInputElement).value.trim();
            const password = (target.elements.namedItem('password') as HTMLInputElement).value;
            const loginButton = target.querySelector('.auth-button') as HTMLButtonElement;
            const errorDiv = $('#login-error') as HTMLDivElement;

            if (!username || !password) return;

            loginButton.disabled = true;
            loginButton.innerHTML = `<span class="spinner"></span> 正在验证...`;
            if (errorDiv) errorDiv.style.display = 'none';

            try {
                // 使用 RPC 获取邮箱，这是 Supabase 用户名登录的常用方案
                const { data: email, error: rpcError } = await supabase.rpc('get_email_by_username', { p_username: username });
                
                if (rpcError) {
                    console.error("RPC Error:", rpcError);
                    throw new Error('服务器验证失败，请联系管理员。');
                }
                
                if (!email) throw new Error('用户名或密码错误。');

                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                
                if (signInError) throw signInError;

                // 登录成功后，index.tsx 的 onAuthStateChange 会接管并切换 UI
                // 我们不需要在这里手动渲染，防止状态冲突
                loginButton.innerHTML = `<span class="spinner"></span> 正在进入系统...`;

            } catch (err: any) {
                console.error("Login Process Error:", err);
                if (errorDiv) {
                    errorDiv.textContent = err.message || '登录失败，请重试。';
                    errorDiv.style.display = 'block';
                }
                loginButton.disabled = false;
                loginButton.innerHTML = '登录';
            }
        } else if (target.id === 'quick-add-form') {
            const category = ($('#quick-add-category-input') as HTMLInputElement).value.trim();
            const model = ($('#quick-add-model') as HTMLInputElement).value.trim();
            const price = parseFloat(($('#quick-add-price') as HTMLInputElement).value);
            const button = target.querySelector('button') as HTMLButtonElement;
            if (!category || !model || isNaN(price)) {
                showModal({ title: '输入错误', message: '请填写所有字段并确保价格有效。' });
                return;
            }

            await withButtonLoading(button, async () => {
                 const { error } = await supabase.from('quote_items').upsert(
                    { category, model, price, is_priority: false }, { onConflict: 'category,model' }
                 );
                 if (error) throw error;
                 if (!state.priceData.prices[category]) state.priceData.prices[category] = {};
                 state.priceData.prices[category][model] = price;
                 
                 const { data: newItem } = await supabase.from('quote_items').select('*').match({category, model}).maybeSingle();
                 if (newItem) {
                     const existingIdx = state.priceData.items.findIndex(i => i.category === category && i.model === model);
                     if (existingIdx >= 0) state.priceData.items[existingIdx] = newItem;
                     else state.priceData.items.push(newItem);
                 }
                 
                 await updateLastUpdatedTimestamp();
                 renderApp();
                 target.reset();
                 ($('#quick-add-category-input') as HTMLInputElement).focus();
            });
        }
    });

    // ... 其余事件监听代码保持不变 ...
    appContainer.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (state.showCustomModal) {
            const confirmButton = target.closest('#custom-modal-confirm-btn');
            const cancelButton = target.closest('#custom-modal-cancel-btn');
            const overlay = target.matches('.modal-overlay');
            if (confirmButton) { state.customModal.onConfirm?.(); return; }
            if (cancelButton || (overlay && state.customModal.isDismissible !== false)) { state.showCustomModal = false; renderApp(); return; }
            if(target.closest('.modal-content')) return;
        }

        const button = target.closest('button');
        if (!button) {
             if (target.matches('.priority-checkbox')) {
                const checkbox = target as HTMLInputElement;
                const row = checkbox.closest('tr');
                const id = row?.dataset.id ? parseInt(row.dataset.id) : null;
                if (id) {
                    setSyncStatus('saving');
                    const isPriority = checkbox.checked;
                    const { error } = await supabase.from('quote_items').update({ is_priority: isPriority }).eq('id', id);
                    if (error) {
                        setSyncStatus('error');
                        checkbox.checked = !isPriority;
                        showModal({ title: '更新失败', message: error.message });
                    } else {
                        setSyncStatus('saved');
                        const item = state.priceData.items.find(i => i.id === id);
                        if (item) item.is_priority = isPriority;
                    }
                }
            }
            return;
        }

        if (button.id === 'logout-btn') {
            await supabase.auth.signOut();
        } else if (button.id === 'calc-quote-btn') {
            state.showFinalQuote = true;
            renderApp();
        } else if (button.id === 'reset-btn') {
            state.selection = getInitialSelection();
            state.customItems = [];
            state.showFinalQuote = false;
            renderApp();
        } else if (button.id === 'app-view-toggle-btn') {
            state.view = 'admin';
            renderApp();
        } else if (button.id === 'back-to-quote-btn') {
            state.view = 'quote';
            renderApp();
        } else if (button.id === 'user-management-btn') {
            state.view = 'userManagement';
            renderApp();
        } else if (button.id === 'login-log-btn') {
            state.view = 'loginLog';
            const { data } = await supabase.from('login_logs').select('*').order('login_at', { ascending: false }).limit(100);
            state.loginLogs = data || [];
            renderApp();
        } else if (button.id === 'generate-quote-btn') {
            handleExportExcel();
        } else if (button.id === 'match-config-btn') {
            handleSmartRecommendation();
        } else if (button.classList.contains('admin-save-item-btn')) {
            const row = button.closest('tr');
            if (!row) return;
            const { category, model } = row.dataset;
            const newPrice = parseFloat((row.querySelector('.price-input') as HTMLInputElement).value);
            await withButtonLoading(button, async () => {
                const { error } = await supabase.from('quote_items').update({ price: newPrice }).match({ category, model });
                if (error) throw error;
                if (state.priceData.prices[category!]) state.priceData.prices[category!][model!] = newPrice;
                const item = state.priceData.items.find(i => i.category === category && i.model === model);
                if (item) item.price = newPrice;
                await updateLastUpdatedTimestamp();
            });
        }
    });

    appContainer.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.id === 'special-discount-input') {
            state.specialDiscount = Math.max(0, Number(target.value));
            updateTotalsUI();
        }
    });

    appContainer.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const row = target.closest('tr');
        if (target.id === 'markup-points-select') {
            state.markupPoints = Number(target.value);
            updateTotalsUI();
        } else if (target.id === 'discount-select') {
            const val = target.value;
            state.selectedDiscountId = val === 'none' ? 'none' : parseInt(val, 10);
            updateTotalsUI();
        } else if (row?.dataset.category && target.classList.contains('model-select')) {
            state.selection[row.dataset.category].model = target.value;
            updateTotalsUI();
        }
    });
}

async function withButtonLoading(button: HTMLButtonElement, action: () => Promise<any>) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>`;
    try {
        await action();
        button.innerHTML = '已保存 ✓';
        button.style.backgroundColor = '#16a34a';
    } catch (error: any) {
        button.innerHTML = '失败!';
        button.style.backgroundColor = '#ef4444';
        showModal({ title: '操作失败', message: error.message });
    } finally {
        setTimeout(() => {
            button.disabled = false;
            button.innerHTML = originalText;
            button.style.backgroundColor = '';
        }, 2000);
    }
}

function handleExportExcel() {
    const totals = calculateTotals();
    const configParts = [...Object.values(state.selection), ...state.customItems]
        .filter(({ model, quantity }) => model && quantity > 0).map(({ model }) => model);
    if (configParts.length === 0) {
        showModal({ title: '无法导出', message: '请先选择至少一个配件。' });
        return;
    }
    const configString = configParts.join(' | ');
    const aoa = [
        ['型号', '配置', '数量', '单价', '总价', '备注'],
        ['报价单', configString, 1, totals.finalPrice, totals.finalPrice, '含13%增值税'],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价');
    XLSX.writeFile(workbook, '报价单.xlsx');
}

function handleSmartRecommendation() {
    // 简化实现...
    showModal({ title: '提示', message: '智能推荐功能正在优化中。' });
}
