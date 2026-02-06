import { state, supabase } from '../state';

const $ = (selector: string) => document.querySelector(selector);

export function attachLoginListeners() {
    $('#login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = e.target as HTMLFormElement;
        const username = (target.elements.namedItem('username') as HTMLInputElement).value;
        const password = (target.elements.namedItem('password') as HTMLInputElement).value;
        const loginButton = target.querySelector('.auth-button') as HTMLButtonElement;
        const errorDiv = $('#login-error') as HTMLDivElement;

        loginButton.disabled = true; loginButton.innerHTML = `<span class="spinner"></span> 正在登录`; errorDiv.style.display = 'none';

        try {
            const { data: email, error: rpcError } = await supabase.rpc('get_email_by_username', { p_username: username });
            if (rpcError || !email) throw new Error('用户名或密码错误。');
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;
        } catch (err: any) {
            errorDiv.textContent = '用户名或密码错误。'; errorDiv.style.display = 'block';
            loginButton.disabled = false; loginButton.innerHTML = '登录';
        }
    });
}
