
export type Processo = Documento[];

export interface Documento {
  id: string;
  idDocumento: string;
  nomeArquivoOriginal: string;
  tipoDocumentoGeral: string;
  poloOrigemDocumento: 'Ativo' | 'Passivo' | 'Neutro' | 'Não Identificado' | 'Interno';
  dataAssinatura: string;
  status: 'Sucesso' | 'Falha';
  linkArquivoPDF: string;
  observacoes: string;
  erro?: string;
  dadosRelevantesParaLaudo: DadosRelevantesParaLaudo;
  historicoOcupacional: HistoricoOcupacional[];
  documentosMedicosAnexados: DocumentoMedicoAnexado[];
  quesitosApresentados: any[]; // Define a more specific type if the structure is known
  timestamp: Timestamp;
}

export interface DadosRelevantesParaLaudo {
  identificacaoDasPartes: string;
  Vara: string;
  Tribunal: string;
  ResumoGeralConteudoArquivo: string;
  historicoClinicoGeral: string | null;
}

export interface HistoricoOcupacional {
  tipoOcupacao: 'Atual' | 'Anterior' | null;
  ocupacao: string | null;
  periodoFuncao: string | null;
  descricaoFuncao: string | null;
  ambienteFisico: string | null;
  ambientePsicossocial: string | null;
  jornadaTrabalho: string | null;
  treinamentoEPIs: string | null;
}

export interface DocumentoMedicoAnexado {
  tipo: string;
  data: string | null;
  resumoConteudo: string;
  profissionalServico: string;
  paginaNoArquivo: string;
}

export interface Timestamp {
  type: string;
  seconds: number;
  nanoseconds: number;
}
