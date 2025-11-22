import { Injectable, inject } from '@angular/core'; // Adicionado 'inject'
import { Observable, from } from 'rxjs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { environment } from '../../../environments/environment';
import { FirestoreService } from './firestore.service'; // 1. Importação do Serviço

// Atualizamos a interface para aceitar os novos parâmetros de rastreamento
export interface GenAIPayload {
  model: string;            
  systemInstruction: string; 
  userContent: string;       
  temperature?: number;
  responseMimeType?: string; 
  responseSchema?: any;      
  
  // --- NOVOS CAMPOS PARA RASTREAMENTO ---
  processId?: string;       // ID do processo (quem pagou a conta?)
  actionContext?: string;   // Contexto (ex: 'analise_laudo', 'quesito_q1')
}

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  private readonly API_KEY = environment.geminiApiKey;
  private genAI: GoogleGenerativeAI;

  // 2. Injeção do FirestoreService
  private firestoreService = inject(FirestoreService);

  constructor() {
    if (!this.API_KEY) {
      console.error('ERRO CRÍTICO: API Key do Gemini não encontrada.');
    }
    this.genAI = new GoogleGenerativeAI(this.API_KEY || '');
  }

  generateLaudoAnalysis(payload: GenAIPayload): Observable<{ responseText: string }> {
    
    // Capturamos o nome do modelo para salvar no log depois
    const modelName = payload.model || 'gemini-1.5-pro';

    const model = this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: payload.systemInstruction,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
      ]
    });

    const generationConfig: any = {
      temperature: payload.temperature ?? 0.4,
      topK: 40, 
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    if (payload.responseMimeType) {
      generationConfig.responseMimeType = payload.responseMimeType;
    }

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
        
        // 3. LÓGICA DE LOG DE TOKENS
        // Verificamos se temos os metadados E o ID do processo
        if (response.usageMetadata && payload.processId) {
            
          console.log(`[IA Tokens] In: ${response.usageMetadata.promptTokenCount} | Out: ${response.usageMetadata.candidatesTokenCount}`);

          // Chamamos o log sem 'await' para não atrasar a resposta visual para o usuário
          this.firestoreService.logTokenUsage({
            processId: payload.processId,
            inputTokens: response.usageMetadata.promptTokenCount,
            outputTokens: response.usageMetadata.candidatesTokenCount,
            model: modelName,
            actionContext: payload.actionContext || 'geral_sem_contexto'
          }).catch(err => console.error('Erro silencioso ao salvar logs de token:', err));
        }

        return { responseText: text };
      } catch (error: any) {
        console.error('Erro local no Gemini SDK:', error);
        throw new Error('Falha ao gerar texto com Gemini: ' + (error.message || error));
      }
    };

    return from(aiPromise()); 
  }
}