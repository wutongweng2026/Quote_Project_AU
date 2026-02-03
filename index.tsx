
// --- DATA (Embedded) & CONFIG ---
const CONFIG_ROWS = ['主机', '内存', '硬盘', '硬盘2', '显卡', '电源', '显示器'];

const priceData = {
  "settings": { "margin": 1.2 },
  "prices": {
    "内存": { "8G DDR5 5600": 750, "16G DDR5 5600": 1650 },
    "硬盘": { "512G SSD": 600, "1T SSD": 1100, "2T SATA": 800 },
    "硬盘2": { "512G SSD": 600, "1T SSD": 1100, "2T SATA": 800 }, // Same as 硬盘
    "显卡": { "T400 4G": 900, "T1000 4G": 2200, "T1000 8G": 2900, "RTX5060 8G": 2700, "RTX4060 8G": 2750, "RTX5060ti 8G": 3200, "RTX5060ti 16G": 5000, "RX6600LE 8G": 1800, "RTX3060": 2300 },
    "显示器": { "21.5-TE22-19": 360, "23.8-T24A-20": 530, "来酷27寸B2737": 460, "慧天V24 23.8": 350 },
    "电源": { "300W": 0, "500W": 200 },
    "主机": { "TSK-C3 I5-13400": 2800, "TSK-C3 I5-14400": 3100, "TSK-C3 I5-14500": 3200, "TSK-C3 I7-13700": 4550, "TSK-C3 I7-14700": 5450, "TSK-C3 I9-14900": 5550, "TSK-C4 Ultra5-235": 3300, "TSK-C4 Ultra7-265": 4550 }
  },
  "discounts": [{ "label": "无折扣 (1.0)", "rate": 1.0 }, { "label": "批量折扣 (0.99)", "rate": 0.99 }]
};

// --- STATE MANAGEMENT ---
const getInitialSelection = () => ({
    '主机': { model: '', quantity: 1 },
    '内存': { model: '', quantity: 1 },
    '硬盘': { model: '', quantity: 1 },
    '硬盘2': { model: '', quantity: 0 },
    '显卡': { model: '', quantity: 1 },
    '电源': { model: '', quantity: 1 },
    '显示器': { model: '', quantity: 1 }
});

const getInitialNewCustomItem = () => ({ category: '', model: '', quantity: 1 });

const state = {
    priceData: priceData,
    isLoggedIn: false,
    view: 'quote', // 'quote' or 'admin'
    selection: getInitialSelection(),
    customItems: [],
    newCustomItem: getInitialNewCustomItem(),
    specialDiscount: 0,
    discountRate: 1.0,
};

// --- DOM SELECTORS ---
const $ = (selector) => document.querySelector(selector);
const appContainer = $('#app');

// --- RENDER FUNCTIONS ---
function render() {
    let html = '';
    if (state.view === 'quote') {
        html = renderQuoteTool();
    } else if (state.view === 'admin') {
        html = renderAdminPanel();
    }
    appContainer.innerHTML = html;
    addEventListeners();
}

function renderQuoteTool() {
    const totals = calculateTotals();
    const finalConfigText = [
        ...Object.entries(state.selection)
            .filter(([_, { model, quantity }]) => model && quantity > 0)
            .map(([category, { model, quantity }]) => `${category}: ${model} * ${quantity}`),
        ...state.customItems
            .filter(item => item.model && item.quantity > 0)
            .map(item => `${item.category || '自定义'}: ${item.model} (成本: ${item.cost}) * ${item.quantity}`)
    ].join('\n');

    return `
        <div class="quoteContainer">
            <header class="quoteHeader">
                <h1>产品报价系统 <span>v1.01 -- 龙盛科技</span></h1>
                <button class="admin-button" id="admin-login-btn">${state.isLoggedIn ? '后台管理' : '后台登录'}</button>
            </header>

            <main class="quoteBody">
                 <div class="product-matcher-section">
                    <label for="matcher-input">产品匹配 (粘贴配置后点击按钮):</label>
                    <div class="matcher-input-group">
                        <input type="text" id="matcher-input" placeholder="例如: TSK-C3 I5-14500/8G DDR5 *2 / 512G SSD+2T SATA /RTX 5060 8G /500W">
                        <button id="match-config-btn">匹配配置</button>
                    </div>
                </div>

                <table class="config-table">
                    <colgroup>
                        <col style="width: 200px;">
                        <col>
                        <col style="width: 80px;">
                        <col style="width: 60px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="config-table-label-header">配置清单</th>
                            <th>规格型号</th>
                            <th>数量</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${CONFIG_ROWS.map(category => renderConfigRow(category)).join('')}
                        ${state.customItems.map(item => renderCustomRow(item)).join('')}
                        ${renderNewCustomItemRow()}
                    </tbody>
                </table>
                
                <div class="final-config-section">
                    <label>最终配置:</label>
                    <textarea class="final-config-display" readonly>${finalConfigText || '未选择配件'}</textarea>
                </div>

                <div class="controls-grid">
                    <div class="control-group">
                        <label for="discount-select">折扣选择:</label>
                        <select id="discount-select">
                            ${state.priceData.discounts.map(d => `<option value="${d.rate}" ${state.discountRate === d.rate ? 'selected' : ''}>${d.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="control-group">
                        <label for="special-discount-input">特别立减:</label>
                        <input type="number" id="special-discount-input" value="${state.specialDiscount}" placeholder="0" />
                    </div>
                </div>
            </main>

            <footer class="quoteFooter">
                <div class="footer-buttons">
                    <button class="reset-btn" id="reset-btn">重置</button>
                    <button class="generate-btn" id="generate-quote-btn">生成报价单</button>
                </div>
                <div class="final-price-display">
                    <span>最终价格</span>
                    <strong>¥ ${totals.finalPrice.toFixed(2)}</strong>
                </div>
            </footer>
        </div>
    `;
}

function renderConfigRow(category) {
    const models = state.priceData.prices[category] || {};
    const currentSelection = state.selection[category];
    return `
        <tr data-category="${category}">
            <td class="config-row-label">${category}</td>
            <td>
                <select class="model-select">
                    <option value="">-- 请选择 --</option>
                    ${Object.keys(models).map(model => `<option value="${model}" ${currentSelection.model === model ? 'selected' : ''}>${model}</option>`).join('')}
                </select>
            </td>
            <td>
                <input type="number" class="quantity-input" min="0" value="${currentSelection.quantity}" />
            </td>
            <td class="config-row-action">
                <button class="remove-item-btn">-</button>
            </td>
        </tr>
    `;
}

function renderCustomRow(item) {
    return `
        <tr data-custom-id="${item.id}">
            <td><input type="text" value="${item.category}" readonly /></td>
            <td><input type="text" value="${item.model}" readonly /></td>
            <td><input type="number" min="0" value="${item.quantity}" readonly /></td>
            <td class="config-row-action">
                <button class="remove-custom-item-btn">-</button>
            </td>
        </tr>
    `;
}

function renderNewCustomItemRow() {
    const item = state.newCustomItem;
    return `
        <tr id="new-custom-item-row">
            <td><input type="text" class="new-custom-category-input" placeholder="类别" value="${item.category}" /></td>
            <td><input type="text" class="new-custom-model-input" placeholder="型号,成本 (例: 静音风扇,80)" value="${item.model}" /></td>
            <td><input type="number" class="new-custom-quantity-input" min="1" value="${item.quantity}" /></td>
            <td class="config-row-action">
                <button id="add-new-custom-item-btn" style="background-color: var(--primary-color);">+</button>
            </td>
        </tr>
    `;
}

function renderAdminPanel() {
    // ... (admin panel code is unchanged)
    return `
    <div class="adminContainer">
         <header class="adminHeader">
            <h2>管理后台</h2>
            <button id="back-to-quote-btn" class="admin-button">返回报价</button>
        </header>
        <div class="admin-section">
            <h3>系统配置</h3>
            <div class="adminForm">
               <label>全局加价倍率:</label>
               <input type="number" step="0.01" value="${state.priceData.settings.margin}" data-path="settings.margin" />
            </div>
        </div>
        <div class="admin-section">
            <h3>产品价格管理 (示例)</h3>
            <div class="adminGrid">
                ${Object.entries(state.priceData.prices['主机']).map(([model, price]) => `
                    <div class="adminForm">
                        <label>${model}:</label>
                        <input type="number" value="${price}" data-path="prices.主机.${model}" />
                    </div>
                `).join('')}
            </div>
        </div>
        <button id="save-config-btn" class="generate-btn" style="width: 100%; padding: 0.8rem;">保存配置并下载</button>
    </div>
    `;
}

// --- LOGIC & EVENT HANDLERS ---
function calculateTotals() {
    const standardCost = Object.entries(state.selection).reduce((acc, [category, { model, quantity }]) => {
        if (model && quantity > 0) {
            const cost = state.priceData.prices[category]?.[model] ?? 0;
            return acc + (cost * quantity);
        }
        return acc;
    }, 0);

    const customCost = state.customItems.reduce((acc, item) => {
        return acc + (item.cost * item.quantity);
    }, 0);
    
    const costTotal = standardCost + customCost;
    const priceBeforeDiscount = costTotal * state.priceData.settings.margin;
    const finalPrice = priceBeforeDiscount * state.discountRate - state.specialDiscount;
    return { finalPrice: Math.max(0, finalPrice) };
}

function handleMatchConfig() {
    // ... (match config logic is unchanged)
    const input = ($('#matcher-input')).value;
    if (!input) return;

    const newSelection = getInitialSelection();
    let tempInput = input.toLowerCase();

    const allModels = Object.entries(priceData.prices)
        .flatMap(([category, models]) => 
            Object.keys(models).map(model => ({ model, category }))
        )
        .sort((a, b) => b.model.length - a.model.length);

    let hddCount = 0;
    const hddCategories = ['硬盘', '硬盘2'];

    for (const { model, category } of allModels) {
        const normalizedModel = model.toLowerCase().replace(/\s/g, '');
        if (tempInput.replace(/\s/g, '').includes(normalizedModel)) {
            let targetCategory = category;

            if (hddCategories.includes(category)) {
                targetCategory = hddCount < hddCategories.length ? hddCategories[hddCount] : null;
                if(targetCategory) hddCount++;
            }
            
            if (targetCategory && newSelection[targetCategory] && newSelection[targetCategory].model === '') {
                newSelection[targetCategory].model = model;
                
                const regex = new RegExp(`(${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${normalizedModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})[^/]*?[*x]\\s*(\\d+)`, 'i');
                const match = input.match(regex);
                if (match && match[2]) {
                    newSelection[targetCategory].quantity = parseInt(match[2], 10);
                }
                
                tempInput = tempInput.replace(model.toLowerCase(), '');
            }
        }
    }
    state.selection = newSelection;
    render();
}

function handleGenerateQuoteText() {
    // ... (generate quote text logic is unchanged)
    const totals = calculateTotals();
    const finalConfigText = [
        ...Object.entries(state.selection)
            .filter(([_, { model, quantity }]) => model && quantity > 0)
            .map(([category, { model, quantity }]) => `[${category}] ${model} * ${quantity}`),
        ...state.customItems
            .filter(item => item.model && item.quantity > 0)
            .map(item => `[${item.category || '自定义'}] ${item.model} * ${item.quantity}`)
    ].join('\n');
    
    let text = "✨ 产品报价清单 ✨\n";
    text += "--------------------------------\n";
    text += finalConfigText;
    text += "\n--------------------------------\n";
    if (state.discountRate < 1.0) {
        text += `折扣已应用: ${state.discountRate}\n`;
    }
    if (state.specialDiscount > 0) {
        text += `特别立减: - ¥ ${state.specialDiscount.toFixed(2)}\n`;
    }
    text += `\n最终报价: ¥ ${totals.finalPrice.toFixed(2)}\n`;
    navigator.clipboard.writeText(text);
    alert("报价单已复制到剪贴板！");
}

function addEventListeners() {
    appContainer.onclick = (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const row = target.closest('tr');

        if (target.id === 'admin-login-btn') {
            if (state.isLoggedIn) { state.view = 'admin'; } 
            else {
                const pass = prompt('请输入管理员密码:');
                if (pass === '1!2@') { state.isLoggedIn = true; state.view = 'admin'; } 
                else if (pass) { alert('密码错误！'); }
            }
            render();
        } else if (target.id === 'back-to-quote-btn') {
            state.view = 'quote'; render();
        } else if (target.id === 'reset-btn') {
            state.selection = getInitialSelection();
            state.customItems = [];
            state.newCustomItem = getInitialNewCustomItem();
            state.specialDiscount = 0;
            state.discountRate = 1.0;
            render();
        } else if (target.classList.contains('remove-item-btn') && row) {
            const category = row.dataset.category;
            if(category) state.selection[category] = getInitialSelection()[category];
            render();
        } else if (target.id === 'add-new-custom-item-btn') {
            const { category, model: modelInput, quantity } = state.newCustomItem;
            const parts = modelInput.split(/[,，]/);
            const model = parts[0].trim();
            const cost = parts.length > 1 ? parseFloat(parts[1]) : 0;

            if (category && model && cost > 0 && quantity > 0) {
                state.customItems.push({ id: Date.now(), category, model, cost, quantity });
                state.newCustomItem = getInitialNewCustomItem();
                render();
            } else {
                alert('请填写完整的类别，并确保型号/成本格式正确 (例: 静音风扇,80)。');
            }
        } else if (target.classList.contains('remove-custom-item-btn') && row) {
            const id = Number(row.dataset.customId);
            state.customItems = state.customItems.filter(item => item.id !== id);
            render();
        } else if (target.id === 'match-config-btn') {
            handleMatchConfig();
        } else if (target.id === 'generate-quote-btn') {
            handleGenerateQuoteText();
        }
    };

    appContainer.oninput = (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) {
            if (target.id === 'special-discount-input') {
                state.specialDiscount = Math.max(0, Number(target.value));
                render();
            } else if (target.closest('.admin-section')) {
                 const path = target.dataset.path.split('.');
                 let current = state.priceData;
                 path.slice(0, -1).forEach(key => current = current[key] || (current[key] = {}));
                 current[path[path.length - 1]] = isNaN(Number(target.value)) ? target.value : Number(target.value);
            }
            return;
        };

        if (row.dataset.category) {
            const category = row.dataset.category;
            if (target.classList.contains('quantity-input')) {
                state.selection[category].quantity = Math.max(0, parseInt(target.value, 10) || 0);
                render();
            }
        } else if (row.id === 'new-custom-item-row') {
            const { newCustomItem } = state;
            if (target.classList.contains('new-custom-category-input')) newCustomItem.category = target.value;
            if (target.classList.contains('new-custom-model-input')) newCustomItem.model = target.value;
            if (target.classList.contains('new-custom-quantity-input')) newCustomItem.quantity = parseInt(target.value, 10) || 1;
        } else if (row.dataset.customId) {
            // Make existing custom items non-editable after adding
            return;
        }
    };
    
    appContainer.onchange = (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (row && row.dataset.category) {
            const category = row.dataset.category;
            if (target.classList.contains('model-select')) {
                state.selection[category].model = target.value;
                render();
            }
        } else if (target.id === 'discount-select') {
            state.discountRate = Number(target.value);
            render();
        }
    }
}

// --- INITIALIZATION ---
render();
