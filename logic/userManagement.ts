import { state, supabase } from '../state';
import { renderApp, showModal } from '../ui';
const $ = (selector: string) => document.querySelector(selector);

export function attachUserManagementListeners() {
    $('#back-to-quote-btn')?.addEventListener('click', () => { state.view = 'quote'; renderApp(); });

    const container = $('.app-layout');
    if (!container) return;

    container.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (!button) return;

        const row = target.closest('tr');
        const userId = row?.dataset.userId;

        if (button.id === 'add-new-user-btn') {
            showModal({
                title: '添加新用户',
                message: `
                    <div class="auth-input-group">
                        <label for="new-email">邮箱</label>
                        <input type="email" id="new-email" class="form-input" required>
                    </div>
                    <div class="auth-input-group">
                        <label for="new-password">密码</label>
                        <input type="password" id="new-password" class="form-input" required>
                    </div>
                     <div class="auth-input-group">
                        <label for="new-fullname">用户名</label>
                        <input type="text" id="new-fullname" class="form-input" required>
                    </div>
                    <div class="auth-input-group">
                        <label for="new-role">角色</label>
                        <select id="new-role" class="form-select">
                            <option value="sales">销售</option>
                            <option value="manager">后台管理</option>
                            <option value="admin">管理员</option>
                        </select>
                    </div>
                `,
                showCancel: true,
                confirmText: '创建',
                onConfirm: async () => {
                    const email = ($('#new-email') as HTMLInputElement).value;
                    const password = ($('#new-password') as HTMLInputElement).value;
                    const fullName = ($('#new-fullname') as HTMLInputElement).value;
                    const role = ($('#new-role') as HTMLSelectElement).value;

                    if (!email || !password || !fullName) {
                        state.customModal.errorMessage = "所有字段均为必填项。";
                        return renderApp();
                    }
                    
                    try {
                        const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
                            email, password, email_confirm: true,
                        });

                        if (createError) throw createError;
                        if (!user) throw new Error("未能创建用户。");

                        const { error: profileError } = await supabase.from('profiles').insert({
                            id: user.id, full_name: fullName, role, is_approved: true
                        });
                        
                        if (profileError) {
                            await supabase.auth.admin.deleteUser(user.id);
                            throw profileError;
                        }
                        
                        const { data: allProfiles } = await supabase.from('profiles').select('*');
                        state.profiles = allProfiles || [];
                        state.showCustomModal = false;
                        renderApp();
                    } catch (err: any) {
                        state.customModal.errorMessage = `创建失败: ${err.message}`;
                        renderApp();
                    }
                }
            });
        }

        if (!userId) return;

        if (button.classList.contains('approve-user-btn')) {
            const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
            if (error) return showModal({ title: '错误', message: `批准用户失败: ${error.message}` });
            const profile = state.profiles.find(p => p.id === userId);
            if (profile) profile.is_approved = true;
            renderApp();
        }

        if (button.classList.contains('permission-toggle-btn')) {
            const action = button.dataset.action;
            const newRole = action === 'grant' ? 'manager' : 'sales';
            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            if (error) return showModal({ title: '错误', message: `更新权限失败: ${error.message}` });
            const profile = state.profiles.find(p => p.id === userId);
            if (profile) profile.role = newRole as 'sales' | 'manager';
            renderApp();
        }

        if (button.classList.contains('delete-user-btn')) {
            showModal({
                title: '确认删除',
                message: `确定要永久删除此用户吗？此操作无法撤销。`,
                showCancel: true, isDanger: true, confirmText: '确认删除',
                onConfirm: async () => {
                    try {
                        const { error: adminError } = await supabase.auth.admin.deleteUser(userId);
                        if (adminError) throw adminError;
                        
                        state.profiles = state.profiles.filter(p => p.id !== userId);
                        state.showCustomModal = false;
                        renderApp();
                    } catch(err: any) {
                        showModal({title: "删除失败", message: err.message, isDanger: true});
                    }
                }
            });
        }
    });
}
