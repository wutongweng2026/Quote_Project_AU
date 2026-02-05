
import { supabase, state } from './state';
import { renderApp, showModal } from './ui';
import { addEventListeners } from './logic';
import { seedDataObject } from './seedData';
import type { DbProfile, Prices, DbQuoteItem } from './types';

const CACHE_KEY = 'qqs_price_data_cache_v1';

async function seedDatabaseIfNeeded() {
    try {
        const { count, error: countError } = await supabase
            .from('quote_items')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error("Error checking for existing data:", countError);
            return;
        }

        if (count !== null && count > 0) {
            return;
        }

        console.log("Database appears to be empty. Seeding initial data...");

        const itemsToInsert = Object.entries(seedDataObject.prices)
            .flatMap(([category, models]) =>
                Object.entries(models).map(([model, price]) => ({
                    category,
                    model,
                    price,
                    is_priority: false
                }))
            );

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert);
        if (itemsError) console.error("Error seeding quote_items:", itemsError);

        const discountsToInsert = seedDataObject.tieredDiscounts;
        const { error: discountsError } = await supabase.from('quote_discounts').insert(discountsToInsert);
        if (discountsError) console.error("Error seeding quote_discounts:", discountsError);
    } catch (error) {
        console.error("An unexpected error occurred during the seeding process:", error);
    }
}


async function loadAllData(): Promise<boolean> {
    try {
        state.appStatus = 'loading';
        renderApp();

        // 1. 获取远程更新时间
        const { data: metaData, error: metaError } = await supabase
            .from('quote_meta')
            .select('value')
            .eq('key', 'last_prices_updated')
            .maybeSingle();
        
        const remoteTimestamp = metaData?.value as string | null;

        // 2. 检查本地缓存
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr && remoteTimestamp) {
            try {
                const cache = JSON.parse(cachedStr);
                if (cache.timestamp === remoteTimestamp) {
                    console.log('⚡ Using local price data cache...');
                    state.priceData.items = cache.items;
                    state.priceData.prices = cache.prices;
                    state.priceData.tieredDiscounts = cache.discounts;
                    state.priceData.markupPoints = cache.markups;
                    state.lastUpdated = cache.timestamp;
                    state.appStatus = 'ready';
                    return true;
                }
            } catch (e) {
                console.warn('Cache validation failed, clearing cache.');
                localStorage.removeItem(CACHE_KEY);
            }
        }

        // 3. 从数据库抓取
        console.log('🌐 Fetching fresh data from database...');
        const [
            { data: itemsData, error: itemsError },
            { data: discountsData, error: discountsError },
            { data: markupsData, error: markupsError }
        ] = await Promise.all([
            supabase.from('quote_items').select('*'),
            supabase.from('quote_discounts').select('*'),
            supabase.from('quote_markups').select('*')
        ]);

        if (itemsError) throw itemsError;
        if (discountsError) throw discountsError;
        if (markupsError) throw markupsError;

        const pricesMap = (itemsData || []).reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = {};
            acc[item.category][item.model] = item.price;
            return acc;
        }, {} as Prices);

        state.priceData.items = (itemsData as DbQuoteItem[]) || [];
        state.priceData.prices = pricesMap;
        state.priceData.tieredDiscounts = discountsData || [];
        state.priceData.markupPoints = markupsData || [];
        state.lastUpdated = remoteTimestamp;

        if (state.priceData.markupPoints.length > 0 && state.markupPoints === 0) {
            state.markupPoints = state.priceData.markupPoints[0].id;
        }

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                items: state.priceData.items,
                prices: state.priceData.prices,
                discounts: state.priceData.tieredDiscounts,
                markups: state.priceData.markupPoints,
                timestamp: remoteTimestamp
            }));
        } catch (e) {}

        state.appStatus = 'ready';
        return true;
    } catch (error: any) {
        console.error("LoadAllData Error:", error);
        state.appStatus = 'error';
        state.errorMessage = `数据加载失败: ${error.message || '未知错误'}`;
        return false;
    }
}

supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        // 关键点：立即进入加载状态，不要让用户在登录页面等待
        if (state.view === 'login' || state.appStatus !== 'loading') {
            state.appStatus = 'loading';
            renderApp();
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, is_approved')
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error("Profile load error:", error);
            state.currentUser = null;
            state.appStatus = 'ready';
            state.view = 'login';
            renderApp();
            return;
        }

        if (profile) {
            if (!profile.is_approved && profile.role !== 'admin') {
                state.appStatus = 'ready';
                showModal({
                    title: '账户待审批',
                    message: '您的账户正在等待管理员批准。',
                    onConfirm: async () => {
                        state.showCustomModal = false;
                        await supabase.auth.signOut();
                    }
                });
                return;
            }
            
            const loadedSuccessfully = await loadAllData(); 

            if (loadedSuccessfully) {
                state.currentUser = { ...profile, auth: session.user };
                if (profile.role === 'admin') {
                    const { data: allProfiles } = await supabase.from('profiles').select('*');
                    state.profiles = allProfiles || [profile];
                    if (state.priceData.items.length === 0) {
                        await seedDatabaseIfNeeded();
                        await loadAllData();
                    }
                } else {
                    state.profiles = [profile];
                }
                state.view = 'quote';
                
                supabase.from('login_logs').insert({
                    user_id: profile.id,
                    user_name: profile.full_name
                }).then(({ error: logError }) => {
                    if (logError) console.error("Login logging failed:", logError);
                });
            }
        }
    } else {
        state.appStatus = 'ready';
        state.currentUser = null;
        state.profiles = [];
        state.view = 'login';
    }
    renderApp();
});


(async () => {
    addEventListeners();
    renderApp(); // 初始渲染登录框
    supabase.auth.getSession();
})();
