import { supabase, state } from './state';
import { renderApp, showModal } from './ui';
import { addEventListeners } from './logic';
import type { DbProfile, Prices } from './types';

async function loadAllData(): Promise<boolean> {
    try {
        const { data: itemsData, error: itemsError } = await supabase.from('quote_items').select('*');
        if (itemsError) throw itemsError;

        const { data: discountsData, error: discountsError } = await supabase.from('quote_discounts').select('*');
        if (discountsError) throw discountsError;

        const { data: markupsData, error: markupsError } = await supabase.from('quote_markups').select('*');
        if (markupsError) throw markupsError;

        state.priceData.prices = (itemsData || []).reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = {};
            acc[item.category][item.model] = item.price;
            return acc;
        }, {} as Prices);

        state.priceData.tieredDiscounts = discountsData || [];
        state.priceData.markupPoints = markupsData || [];
        
        if (state.priceData.markupPoints.length > 0 && state.markupPoints === 0) {
            state.markupPoints = state.priceData.markupPoints[0].id;
        }

        state.appStatus = 'ready';
        return true;
    } catch (error: any) {
        state.appStatus = 'error';
        state.errorMessage = `
            <h3 style="color: #b91c1c; margin-top:0;">无法加载应用数据</h3>
            <p>登录成功，但无法获取报价所需的核心数据。这通常是由于数据库权限问题导致的。</p>
            <h4>解决方案：</h4>
            <p>请确保已为 <strong>登录用户</strong> 开启了读取 <code>quote_items</code>, <code>quote_discounts</code>, 和 <code>quote_markups</code> 这三个表的权限。</p>
            <p style="margin-top: 1rem;">原始错误: ${error.message}</p>`;
        state.currentUser = null;
        return false;
    }
}

supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, is_approved')
            .eq('id', session.user.id)
            .single();

        if (error) {
            state.currentUser = null;
            state.appStatus = 'error';
            state.errorMessage = `无法获取您的用户资料: ${error.message}. 这可能是数据库权限问题。请确保您为 'profiles' 表启用了RLS，并设置了允许用户读取自己的数据。`;
            renderApp();
            return;
        }

        if (profile) {
            if (!profile.is_approved && profile.role !== 'admin') {
                showModal({
                    title: '账户待审批',
                    message: '您的账户正在等待管理员批准，请稍后再试。',
                    onConfirm: async () => { await supabase.auth.signOut(); }
                });
                return;
            }

            state.appStatus = 'loading';
            renderApp();

            const loadedSuccessfully = await loadAllData(); 

            if (loadedSuccessfully) {
                state.currentUser = { ...profile, auth: session.user };
                if (profile.role === 'admin') {
                    const { data: allProfiles, error: profilesError } = await supabase.from('profiles').select('*');
                    state.profiles = profilesError ? [profile] : (allProfiles || []);
                } else {
                    state.profiles = [profile];
                }
                state.view = 'quote';
            }
        } else {
            showModal({
                title: '登录错误',
                message: '您的账户存在，但未能找到对应的用户资料。请联系管理员。',
                onConfirm: async () => { await supabase.auth.signOut(); }
            });
            return;
        }
    } else {
        state.appStatus = 'ready';
        state.currentUser = null;
        state.profiles = [];
        state.view = 'login';
    }
    
    renderApp();
});

addEventListeners();
