import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { environment } from '../../../environments/environment';

// Atualizamos a interface para aceitar os novos parâmetros poderosos
export interface GenAIPayload {
  model: string;            
  systemInstruction: string; 
  userContent: string;       
  temperature?: number;
  // Novos parâmetros para o Gemini 2.5
  responseMimeType?: string; // Ex: 'application/json'
  responseSchema?: any;      // Esquema estrito do JSON
}

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  private readonly API_KEY = environment.geminiApiKey;
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!this.API_KEY) {
      console.error('ERRO CRÍTICO: API Key do Gemini não encontrada.');
    }
    this.genAI = new GoogleGenerativeAI(this.API_KEY || '');
  }

  generateLaudoAnalysis(payload: GenAIPayload): Observable<{ responseText: string }> {
    
    const model = this.genAI.getGenerativeModel({
      model: payload.model || 'gemini-1.5-pro', // Ou 'gemini-2.5-pro'
      systemInstruction: payload.systemInstruction,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
      ]
    });

    // Configuração de Geração Aprimorada
    const generationConfig: any = {
      temperature: payload.temperature ?? 0.4,
      topK: 40, // Padrão bom para equilíbrio
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    // Se o payload pedir JSON Nativo (Recurso crucial do Gemini Pro)
    if (payload.responseMimeType) {
      generationConfig.responseMimeType = payload.responseMimeType;
    }

    // Se houver um esquema definido (Schema)
    if (payload.responseSchema) {
      generationConfig.responseSchema = payload.responseSchema;
    }

    const aiPromise = async () => {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: payload.userContent }] }],
          generationConfig,
        });

        const response = await result.response;
        const text = response.text();
        
        return { responseText: text };
      } catch (error: any) {
        console.error('Erro local no Gemini SDK:', error);
        throw new Error('Falha ao gerar texto com Gemini: ' + (error.message || error));
      }
    };

    return from(aiPromise()); 
  }
}