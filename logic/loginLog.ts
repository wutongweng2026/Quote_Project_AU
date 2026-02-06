import { state } from '../state';
import { renderApp } from '../ui';
import { GoogleGenAI } from '@google/genai';

const $ = (selector: string) => document.querySelector(selector);

async function generateLogSummary() {
    const summaryContainer = $('#log-summary-content') as HTMLDivElement;
    const summaryLoading = $('#log-summary-loading') as HTMLDivElement;
    if (!summaryContainer || !summaryLoading) return;

    summaryLoading.style.display = 'block';
    summaryContainer.style.display = 'none';

    try {
        if (state.loginLogs.length === 0) {
            summaryContainer.innerHTML = '<p>没有登录记录可供分析。</p>';
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        const logEntries = state.loginLogs.map(log => 
            `- 用户: ${log.user_name || '未知'}, 时间: ${new Date(log.login_at).toLocaleString('zh-CN')}`
        ).join('\n');

        const prompt = `
            你是一名安全审计员。请分析以下产品报价系统的登录日志，并提供一份简短的摘要报告。
            报告应包括：
            1.  总体登录活动概述（例如，总登录次数，最活跃的用户）。
            2.  识别任何潜在的异常模式（例如，非工作时间的登录，同一用户的快速连续登录）。
            3.  基于日志的安全评估和建议（如果有的话）。

            日志数据:
            ${logEntries}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        
        let summaryHtml = (response.text ?? '')
            .replace(/###\s*(.*)/g, '<h3>$1</h3>')
            .replace(/##\s*(.*)/g, '<h3>$1</h3>')
            .replace(/\*\*\s*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*\s(?!<ul>)(.*)/g, '<li>$1</li>');

        summaryHtml = summaryHtml.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>').replace(/\n/g, '<br>');

        summaryContainer.innerHTML = summaryHtml;

    } catch (error) {
        console.error('Error generating log summary:', error);
        summaryContainer.innerHTML = '<p style="color: red;">生成日志摘要时出错。</p>';
    } finally {
        summaryLoading.style.display = 'none';
        summaryContainer.style.display = 'block';
    }
}


export function attachLoginLogListeners() {
    $('#back-to-quote-btn')?.addEventListener('click', () => { state.view = 'quote'; renderApp(); });
    generateLogSummary();
}
