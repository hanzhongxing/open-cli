// src/lib/aiHttp.ts

import { logger } from './logger.js';

export async function chatFetch(url:string,model:string,apikey:string,messages:any[],signal?: AbortSignal,timeout=60000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const combinedSignal = signal
    ? 
      (() => {
        const abortController = new AbortController();
        signal.addEventListener('abort', () => abortController.abort());
        controller.signal.addEventListener('abort', () => abortController.abort());
        return abortController.signal;
      })()
    : controller.signal;
    try{
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apikey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
                sceneId: 1,
                extra_body:{
                    'user':'open-cli',
                    'sceneId':1
                },
                temperature: 1.0,
            }),
            signal: combinedSignal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API 请求失败 (${response.status}): ${errorText}`);
        }
        return response;
    }finally{
        clearTimeout(timeoutId);
    }
}