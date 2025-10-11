
// Interface para um documento na coleção 'status_processos'
// Usada para listar os processos de forma leve e eficiente.
export interface StatusProcesso {
  id: string; // Corresponde ao {id_do_processo}
  // Este documento pode conter outros metadados no futuro, mas por agora o ID é o essencial.
}

// Interface para um documento na subcoleção 'analises_processos/{id}/resultados_pdfs'
// Contém a análise detalhada de um único arquivo PDF.
export interface AnaliseProcesso {
  id: string; // Corresponde ao nome do arquivo, ex: 'peticao_inicial.pdf'
  idDocumento: string;
  nomeArquivoOriginal: string;
  tipoDocumentoGeral: string;
  poloOrigemDocumento: string;
  dadosRelevantesParaLaudo: {
    identificacaoDasPartes: string;
    Vara: string;
    ResumoGeralConteudoArquivo: string;
    historicoClinicoGeral: string;
  };
  historicoOcupacional: {
    ocupacaoAtual?: string;
    ocupacaoAnteriores?: string;
    descricaoFuncao: string;
    periodoFuncao?: string;
    ambienteFisico: string;
    ambientePsicossocial: string;
    jornadaTrabalho: string;
    treinamentoEPIs: string;
  }[];
  documentosMedicosAnexados: {
    tipo: string;
    data: string;
    profissionalServico: string;
    resumoConteudo: string;
    paginaNoArquivo: string;
  }[];
  quesitosApresentados: {
    polo: string;
    quesito: string;
    paginaNoArquivo: string;
  }[];
  observacoes: string;
}

// Interface para um documento na subcoleção 'status_processos/{id}/documentos'
// Contém o status de processamento de um único arquivo PDF.
export interface StatusDocumento {
  id: string; // Corresponde ao nome do arquivo, ex: 'peticao_inicial.pdf'
  status: 'Sucesso' | 'Falha';
  erro?: string;
  timestamp: any; 
}
