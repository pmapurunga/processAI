// --- Interfaces para tipagem do JSON ---

export interface PoloAtivo {
  nome: string;
  cpf: string;
  dataNascimento: string;
  estadoCivil: string;
  escolaridade: string;
  enderecoResidencial: string;
  dadosPessoaisConsolidados: string;
}

export interface PoloPassivo {
  nome: string;
  cnpj: string;
  dadosGeraisConsolidados: string;
}

export interface HistoricoOcupacional {
  tipoOcupacao: string;
  empresa: string;
  ocupacao: string;
  descricaoFuncao: string;
  periodoFuncao: string;
  ambienteFisico: string;
  ambientePsicossocial: string;
  jornadaTrabalho: string;
  treinamentoEPIs: string;
  afastamentosECATs: string;
}

export interface DocumentoMedico {
  tipo: string;
  data: string;
  profissionalServico: string;
  resumoConteudo: string;
  paginaNoArquivo: string;
}

export interface Quesito {
  polo: string;
  textoQuesito: string;
  paginaNoArquivo: string;
}

export interface DocumentoConsolidado {
  idDocumento: string;
  nomeArquivoOriginal: string;
  tipoDocumentoGeral: string;
  periodoAnalisado: string;
  dadosRelevantesParaLaudo: {
    identificacaoDasPartes: {
      poloAtivo: PoloAtivo;
      poloPassivo: PoloPassivo;
    };
    Vara: string;
    Tribunal: string;
    ResumoGeralDoCaso: string;
    historicoClinicoGeralConsolidado: string;
    linhaDoTempoEventosRelevantes: string;
  };
  historicoOcupacionalConsolidado: HistoricoOcupacional[];
  documentosMedicosAnexados: DocumentoMedico[];
  quesitosApresentados: Quesito[];
  observacoes: string;
}
