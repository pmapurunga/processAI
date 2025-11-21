import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Importação do ambiente
import { environment } from '../../../environments/environment';

// Interface do Payload para a IA
export interface GenAIPayload {
  model: string;            
  systemInstruction: string; 
  userContent: string;       
  temperature?: number;      
}

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  // --- CONFIGURAÇÃO DO GEMINI (CLIENT-SIDE) ---
  private readonly API_KEY = environment.geminiApiKey;
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Inicializa o SDK
    if (!this.API_KEY) {
      console.error('ERRO CRÍTICO: API Key do Gemini não encontrada em environment.ts');
    }
    this.genAI = new GoogleGenerativeAI(this.API_KEY || '');
  }

  // Método: Gera a análise textual usando IA (Gemini)
  generateLaudoAnalysis(payload: GenAIPayload): Observable<{ responseText: string }> {
    
    const model = this.genAI.getGenerativeModel({
      model: payload.model || 'gemini-1.5-pro',
      systemInstruction: payload.systemInstruction,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        }
      ]
    });

    const generationConfig = {
      temperature: payload.temperature ?? 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 8192,
    };

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