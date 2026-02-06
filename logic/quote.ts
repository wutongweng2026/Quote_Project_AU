import { state, supabase, getInitialSelection } from '../state';
import { renderApp, showModal, updateTotalsUI } from '../ui';
import { calculateTotals } from '../calculations';

declare var XLSX: any;
const $ = (selector: string) => document.querySelector(selector);

function handleSmartRecommendation() {
    const input = ($('#matcher-input') as HTMLTextAreaElement | HTMLInputElement).value;
    if (!input || !input.trim()) {
        showModal({ title: '请输入需求', message: '请在文本框中输入预算（如“8000元”）或特定配置需求（如“4060显卡”）。' });
        return;
    }

    const userInput = input.toLowerCase();
    let budget = 0;
    const budgetMatch = userInput.match(/(?:预算|价格|价位|左右|^|\s)(\d+(?:\.\d+)?)\s*(?:元|块|w|k|万|千)?/);
    if (budgetMatch) {
        let num = parseFloat(budgetMatch[1]);
        if (userInput.includes('w') || userInput.includes('万')) num *= 10000;
        else if (userInput.includes('k') || userInput.includes('千')) num *= 1000;
        if (num > 1000) budget = num;
    }

    const candidates: Record<string, { model: string, price: number }[]> = {};
    const allCategories = [...new Set(state.priceData.items.map(i => i.category))];
    
    allCategories.forEach(catName => {
        const items = state.priceData.items.filter(i => i.category === catName);
        const userMatches = items.filter(i => i.model.toLowerCase().split(/[\s/+\-,]/).some(token => token && userInput.includes(token)));
        
        if (userMatches.length > 0) {
            candidates[catName] = userMatches.map(i => ({ model: i.model, price: i.price }));
        } else {
            const priorityItems = items.filter(i => i.is_priority);
            candidates[catName] = (priorityItems.length > 0 ? priorityItems : items).map(i => ({ model: i.model, price: i.price }));
        }
    });

    let bestCombo: Record<string, string> | null = null;
    let minDiff = budget > 0 ? Infinity : -Infinity;

    const combinations = (
        candidates['主机'] || [{model: '', price: 0}]).flatMap(h => 
        (candidates['内存'] || [{model: '', price: 0}]).flatMap(r => 
        (candidates['硬盘'] || [{model: '', price: 0}]).flatMap(d1 => 
        (candidates['显卡'] || [{model: '', price: 0}]).flatMap(g => 
        (candidates['电源'] || [{model: '', price: 0}]).flatMap(p => 
        (candidates['显示器'] || [{model: '', price: 0}]).map(m => {
            const combo = { '主机': h.model, '内存': r.model, '硬盘1': d1.model, '显卡': g.model, '电源': p.model, '显示器': m.model };
            const price = h.price + r.price + d1.price + g.price + p.price + m.price;
            return { combo, price };
        })
    )))));

    for (const { combo, price } of combinations) {
        if (budget > 0) {
            if (price <= budget && (budget - price) < minDiff) {
                minDiff = budget - price;
                bestCombo = combo;
            }
        } else {
            if (price > minDiff) {
                minDiff = price;
                bestCombo = combo;
            }
        }
    }

    if (bestCombo) {
        Object.keys(bestCombo).forEach(cat => { if (state.selection[cat]) state.selection[cat].model = bestCombo[cat]; });
        state.selectedDiscountId = 'none'; state.showFinalQuote = true; renderApp();
    } else {
        showModal({ title: '无法匹配', message: '未找到符合条件的配置组合，请尝试调整预算或描述。' });
    }
}

function handleExportExcel() {
    const totals = calculateTotals();
    const configParts = [...Object.values(state.selection), ...state.customItems]
        .filter(({ model, quantity }) => model && quantity > 0).map(({ model }) => model);
    if (configParts.length === 0) return showModal({ title: '无法导出', message: '请先选择至少一个配件再导出报价单。' });

    const mainframeModel = state.selection['主机']?.model || '';
    const modelCode = mainframeModel.split(' ')[0] || '自定义主机';
    const aoa = [
        ['型号', '配置', '数量', '单价', '总价', '备注'],
        [modelCode, configParts.join(' | '), 1, totals.finalPrice, totals.finalPrice, '含13%增值税发票'],
        [null, '总计', null, null, totals.finalPrice, null], [], [], [], [],
        [null, null, null, '北京龙盛天地科技有限公司报价表'],
        [null, null, null, '地址: 北京市海淀区清河路164号1号院'],
        [null, null, null, '电话: 010-51654433-8013 传真: 010-82627270'],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 60 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 25 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '报价单');
    XLSX.writeFile(workbook, '龙盛科技报价单.xlsx');
}

export function attachQuoteToolListeners() {
    $('#logout-btn')?.addEventListener('click', () => supabase.auth.signOut());
    $('#user-management-btn')?.addEventListener('click', () => { state.view = 'userManagement'; renderApp(); });
    $('#login-log-btn')?.addEventListener('click', async () => {
        state.view = 'loginLog';
        const { data } = await supabase.from('login_logs').select('*').order('login_at', { ascending: false }).limit(100);
        state.loginLogs = data || []; renderApp();
    });
    $('#app-view-toggle-btn')?.addEventListener('click', () => { state.view = 'admin'; renderApp(); });
    $('#reset-btn')?.addEventListener('click', () => {
        state.selection = getInitialSelection(); state.customItems = []; state.specialDiscount = 0;
        state.markupPoints = state.priceData.markupPoints[0]?.id || 0;
        state.showFinalQuote = false; state.selectedDiscountId = 'none'; renderApp();
    });
    $('#match-config-btn')?.addEventListener('click', handleSmartRecommendation);
    $('#generate-quote-btn')?.addEventListener('click', handleExportExcel);
    $('#calc-quote-btn')?.addEventListener('click', () => { state.showFinalQuote = true; renderApp(); });
    $('#special-discount-input')?.addEventListener('input', (e) => { state.specialDiscount = Math.max(0, Number((e.target as HTMLInputElement).value)); updateTotalsUI(); });
    $('.data-table')?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const row = target.closest('tr');
        if (!row || !target.classList.contains('quantity-input')) return;
        const quantity = Math.max(0, parseInt(target.value, 10) || 0);
        const category = row.dataset.category;
        if (category && state.selection[category]) { state.selection[category].quantity = quantity; updateTotalsUI(); }
    });
    $('.data-table')?.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const row = target.closest('tr');
        if (!row || !target.classList.contains('model-select')) return;
        const category = row.dataset.category;
        if (category && state.selection[category]) { state.selection[category].model = target.value; updateTotalsUI(); }
    });
    $('#discount-select, #markup-points-select')?.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (target.id === 'discount-select') state.selectedDiscountId = target.value === 'none' ? 'none' : parseInt(target.value, 10);
        else state.markupPoints = Number(target.value);
        updateTotalsUI();
    });
}
