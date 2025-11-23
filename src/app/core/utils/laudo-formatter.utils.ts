export class LaudoFormatter {

    /**
     * Converte Markdown (texto da IA) para o Array de Objetos exigido no JSON Final.
     * Regras aplicadas:
     * 1. Separa Títulos (##, ###) de parágrafos.
     * 2. Identifica Listas (*, -) e remove os marcadores.
     * 3. Mantém o negrito (**) dentro do texto.
     */
    static formatarTextoEstruturado(textoMarkdown: string | null): any[] {
      if (!textoMarkdown) return [];
  
      const linhas = textoMarkdown.split('\n');
      const estrutura: any[] = [];
  
      linhas.forEach(linha => {
        const textoLimpo = linha.trim();
  
        if (!textoLimpo) {
          // Regra: Linha em branco vira parágrafo vazio para manter espaçamento visual
          estrutura.push({ tipo: "paragrafo", texto: "" });
          return;
        }
  
        // Regra: Títulos H2 (##)
        if (textoLimpo.startsWith('## ')) {
          estrutura.push({
            tipo: "h2",
            texto: textoLimpo.replace(/^##\s+/, '').trim()
          });
        }
        // Regra: Títulos H3 (###)
        else if (textoLimpo.startsWith('### ')) {
          estrutura.push({
            tipo: "h3",
            texto: textoLimpo.replace(/^###\s+/, '').trim()
          });
        }
        // Regra: Listas (* ou -)
        else if (textoLimpo.match(/^[\*\-]\s/)) {
          estrutura.push({
            tipo: "lista",
            texto: textoLimpo.replace(/^[\*\-]\s+/, '').trim() // Remove o marcador, mantém o texto
          });
        }
        // Padrão: Parágrafo comum
        else {
          estrutura.push({
            tipo: "paragrafo",
            texto: textoLimpo
          });
        }
      });
  
      return estrutura;
    }
  
    /**
     * Helper inteligente para preencher ( ) Sim (x) Não baseado no texto da IA.
     */
    static verificarStatus(textoAnalise: string, termosPositivos: string[]): string {
      if (!textoAnalise) return "( ) Sim (x) Não";
      const textoLower = textoAnalise.toLowerCase();
      
      // Verifica se algum termo (ex: "incapacidade total") existe no texto
      const encontrou = termosPositivos.some(termo => textoLower.includes(termo.toLowerCase()));
      
      return encontrou ? "(x) Sim ( ) Não" : "( ) Sim (x) Não";
    }
  
    /**
     * Monta o objeto final
     */
    static gerarJsonFinal(dadosBrutos: any): any {
      const p = dadosBrutos.identificacaoProcesso || {};
      const dp = dadosBrutos.dadosPericiando || {};
      const hl = dadosBrutos.historicoLaboral || {};
      const dm = dadosBrutos.dadosMedicos || {};
      const analise = dadosBrutos.analiseIA || "";
      const quesitos = dadosBrutos.respostasQuesitos || {};
  
      // Lógica para detecção automática de Sim/Não baseada na conclusão da IA
      const temIncapacidade = this.verificarStatus(analise, ["Incapacidade Total", "Incapacidade Permanente", "Inapta", "Incapaz"]);
      const temImpedimento = this.verificarStatus(analise, ["Impedimento de Longo Prazo", "Obstrução"]);
  
      return {
        identificacaoProcesso: {
          PROCESSO_NUM: p.PROCESSO_NUM || "",
          JUIZO: p.JUIZO || "",
          NOME_PERICIANDO: p.NOME_PERICIANDO || "",
          DATA_EXAME: p.DATA_EXAME || ""
        },
        dadosPericiando: {
          DATA_NASCIMENTO: dp.DATA_NASCIMENTO || "", // Dica: Se precisar formatar idade aqui, pode adicionar lógica
          SEXO: dp.SEXO || "",
          ESTADO_CIVIL: dp.ESTADO_CIVIL || "",
          ESCOLARIDADE: dp.ESCOLARIDADE || ""
        },
        diagnosticoImpedimento: {
          IMPEDIMENTO_ATUAL: temImpedimento,
          IMPEDIMENTO_PRETERITO: "( ) Sim (x) Não"
        },
        diagnosticoIncapacidade: {
          INCAPACIDADE_ATUAL: temIncapacidade,
          INCAPACIDADE_PRETERITA: "( ) Sim (x) Não"
        },
        historicoLaboral: {
          FUNCAO_HABITUAL_ATUAL: {
            descricao: hl.FUNCAO_HABITUAL_ATUAL?.descricao || "",
            vinculo: hl.FUNCAO_HABITUAL_ATUAL?.vinculo || "",
            periodo: hl.FUNCAO_HABITUAL_ATUAL?.periodo || ""
          },
          TEMPO_TOTAL_ATIVIDADE: hl.TEMPO_TOTAL_ATIVIDADE || "",
          DATA_AFASTAMENTO_DECLARADA: hl.DATA_AFASTAMENTO_DECLARADA || "",
          
          // Aplica a formatação estruturada
          HISTORICO_OCUPACIONAL_COMPLETO: this.formatarTextoEstruturado(hl.HISTORICO_OCUPACIONAL_COMPLETO),
          
          EXPERIENCIAS_LABORAIS_ANTERIORES: hl.EXPERIENCIAS_LABORAIS_ANTERIORES || [],
          
          PROFISSIOGRAFIA: {
            atividade_analisada: hl.PROFISSIOGRAFIA?.atividade_analisada || "",
            tarefas_executadas: Array.isArray(hl.PROFISSIOGRAFIA?.tarefas_executadas) 
              ? hl.PROFISSIOGRAFIA?.tarefas_executadas.join('\n') // Garante que vira string se for array
              : hl.PROFISSIOGRAFIA?.tarefas_executadas || "",
            postura_corporal: hl.PROFISSIOGRAFIA?.postura_corporal || "",
            movimentos_repetitivos: hl.PROFISSIOGRAFIA?.movimentos_repetitivos || "",
            carga_fisica: hl.PROFISSIOGRAFIA?.carga_fisica || "",
            ambiente_trabalho: hl.PROFISSIOGRAFIA?.ambiente_trabalho || "",
            exigencias_fisicas: hl.PROFISSIOGRAFIA?.exigencias_fisicas || "",
            equipamentos_utilizados: hl.PROFISSIOGRAFIA?.equipamentos_utilizados || "",
            SUMARIO_PROFISSIOGRAFICO: this.formatarTextoEstruturado(hl.PROFISSIOGRAFIA?.SUMARIO_PROFISSIOGRAFICO)
          }
        },
        dadosMedicos: {
          HISTORIA_CLINICA: this.formatarTextoEstruturado(dm.HISTORIA_CLINICA),
          EXAMES: this.formatarTextoEstruturado(dm.EXAMES),
          EXAME_CLINICO: this.formatarTextoEstruturado(dm.EXAME_CLINICO)
        },
        respostasQuesitos: {
          // Mapeie todos os quesitos necessários aqui
          RESPOSTA_QUESITO_1: quesitos.RESPOSTA_QUESITO_1 || "",
          RESPOSTA_QUESITO_2: quesitos.RESPOSTA_QUESITO_2 || "",
          RESPOSTA_QUESITO_3: quesitos.RESPOSTA_QUESITO_3 || "",
          RESPOSTA_QUESITO_4: quesitos.RESPOSTA_QUESITO_4 || "",
          RESPOSTA_QUESITO_5: quesitos.RESPOSTA_QUESITO_5 || "",
          RESPOSTA_QUESITO_6: quesitos.RESPOSTA_QUESITO_6 || "",
          RESPOSTA_QUESITO_7: quesitos.RESPOSTA_QUESITO_7 || "",
          RESPOSTA_QUESITO_8: quesitos.RESPOSTA_QUESITO_8 || "",
          RESPOSTA_QUESITO_9: quesitos.RESPOSTA_QUESITO_9 || "",
          RESPOSTA_QUESITO_10: quesitos.RESPOSTA_QUESITO_10 || "",
          RESPOSTA_QUESITO_11: quesitos.RESPOSTA_QUESITO_11 || "",
          RESPOSTA_QUESITO_12: quesitos.RESPOSTA_QUESITO_12 || "",
          // Quesitos que exigem formatação especial (array de objetos)
          RESPOSTA_QUESITO_13: this.formatarTextoEstruturado(quesitos.RESPOSTA_QUESITO_13),
          RESPOSTA_QUESITO_14: quesitos.RESPOSTA_QUESITO_14 || "",
          RESPOSTA_QUESITO_15: quesitos.RESPOSTA_QUESITO_15 || "",
          RESPOSTA_QUESITO_16: this.formatarTextoEstruturado(quesitos.RESPOSTA_QUESITO_16),
          RESPOSTA_QUESITO_17: quesitos.RESPOSTA_QUESITO_17 || "",
          RESPOSTA_QUESITO_18: quesitos.RESPOSTA_QUESITO_18 || "",
          RESPOSTA_QUESITO_19: quesitos.RESPOSTA_QUESITO_19 || "",
          RESPOSTA_QUESITO_20: quesitos.RESPOSTA_QUESITO_20 || "",
          RESPOSTA_QUESITO_21: quesitos.RESPOSTA_QUESITO_21 || "",
          RESPOSTA_QUESITO_22: this.formatarTextoEstruturado(quesitos.RESPOSTA_QUESITO_22),
          RESPOSTA_QUESITO_23: quesitos.RESPOSTA_QUESITO_23 || "",
          RESPOSTA_QUESITO_24: quesitos.RESPOSTA_QUESITO_24 || "",
          RESPOSTA_QUESITO_25: quesitos.RESPOSTA_QUESITO_25 || "",
          RESPOSTA_QUESITO_26: quesitos.RESPOSTA_QUESITO_26 || "",
          RESPOSTA_QUESITO_27: quesitos.RESPOSTA_QUESITO_27 || ""
        },
        dadosLaudo: {
          DIA_LAUDO: new Date().getDate().toString().padStart(2, '0'),
          MES_LAUDO: new Date().toLocaleString('pt-BR', { month: 'long' }),
          ANO_LAUDO: new Date().getFullYear().toString()
        }
      };
    }
  }