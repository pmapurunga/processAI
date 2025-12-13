import os
import json
import re
import io
import asyncio
import functions_framework
import firebase_admin
from firebase_admin import firestore, storage
from google.cloud import storage as gcs
import google.generativeai as genai
import fitz  # PyMuPDF
import requests
from google.cloud import tasks_v2
from datetime import datetime, timedelta, timezone

import google.cloud.logging

# Inicialização Firebase e GCS
firebase_admin.initialize_app()
db = firestore.client()
storage_client = gcs.Client()

# Inicialização Logging
logging_client = google.cloud.logging.Client()
logging_client.setup_logging()
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuração Cloud Tasks
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "processai-468612") # Fallback ou env
QUEUE_REGION = "us-central1"
QUEUE_NAME = "process-queue"
tasks_client = tasks_v2.CloudTasksClient()

# Configuração Gemini
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))

@functions_framework.http
def process_analysis_api(request):
    """Entrypoint único para a Cloud Function (HTTP)."""
    
    # CORS setup (Simplificado)
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    path = request.path
    
    if path == '/api/upload-url':
        return handle_upload_url(request, headers)
    elif path == '/api/processar':
        return handle_processar(request, headers)
    elif path == '/api/importar-drive':
        return handle_importar_drive(request, headers)
    elif path == '/api/worker/processar-pdf':
        return handle_worker_processar(request)
    else:
        return ('Not Found', 404, headers)

def enqueue_process_task(payload):
    """Enfileira a tarefa no Cloud Tasks."""
    parent = tasks_client.queue_path(PROJECT_ID, QUEUE_REGION, QUEUE_NAME)
    
    # URL interna do próprio serviço (precisa estar deployado)
    # Se não tiver SERVICE_URL, tentar descobrir ou usar o hardcoded temporariamente
    service_url = os.environ.get("SERVICE_URL") 
    if not service_url:
        # Fallback para construção manual se soubermos o padrão ou pegando do request se fosse possível
        # Para Cloud Run, geralmente passamos SERVICE_URL nas variaveis de ambiente
        raise ValueError("SERVICE_URL env var is missing")

    url = f"{service_url.rstrip('/')}/api/worker/processar-pdf"
    
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": url,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(payload).encode(),
            # O Cloud Tasks adiciona automaticamente OIDC token se configurado, 
            # mas para chamadas internas open (se for allow-unauthenticated) ok.
            # Se o serviço for privado, precisa de oidc_token.
            # Vamos assumir public por enquanto ou que a service account tem permissão.
        }
    }

    response = tasks_client.create_task(request={"parent": parent, "task": task})
    logger.info(f"Task created: {response.name}")
    return response.name

def handle_worker_processar(request):
    """Worker que executará a tarefa pesada."""
    try:
        data = request.get_json()
        logger.info(f"Worker received task: {data}")
        
        job_id = data.get('jobId')
        file_path = data.get('filePath')
        
        if not job_id or not file_path:
            logger.error("Invalid worker payload")
            return ('Invalid Payload', 400)
            
        # Executa a lógica pesada
        processar_pdf(job_id, file_path)
        
        return ('OK', 200)
    except Exception as e:
        logger.exception("Worker failed")
        return (f'Error: {e}', 500)

def handle_upload_url(request, headers):
    """Gera Signed URL para upload direto."""
    try:
        data = request.get_json()
        filename = data.get('name')
        content_type = data.get('type')
        
        bucket_name = os.environ.get("BUCKET_NAME") # Configurar env var
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(f"uploads/{filename}")
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=900, # 15 min
            method="PUT",
            content_type=content_type
        )
        
        # Gerar JobId (usando auto-id do firestore para facilitar)
        job_ref = db.collection('analises_processos').document()
        
        return (json.dumps({'uploadUrl': url, 'jobId': job_ref.id}), 200, headers)
    except Exception as e:
        return (json.dumps({'error': str(e)}), 500, headers)

def handle_processar(request, headers):
    """Gatilho para iniciar processamento após upload."""
    try:
        data = request.get_json()
        job_id = data.get('jobId')
        file_path = data.get('filePath') # gs://bucket/uploads/file.pdf
        
        # Iniciar processamento background (Simulado aqui com chamada async direta ou Cloud Tasks)
        # Em produção, idealmente usaria Cloud Tasks para evitar timeout HTTP imediato
        # Aqui vamos apenas registar e chamar a função interna de processamento
        
        # Criação inicial do doc
        db.collection('analises_processos').document(job_id).set({
            'status': 'ENFILEIRADO', # Status novo
            'progresso': 0,
            'data_criacao': firestore.SERVER_TIMESTAMP,
            'url_arquivo_original': file_path,
        }, merge=True)

        # Enfileirar Tarefa
        try:
            enqueue_process_task({'jobId': job_id, 'filePath': file_path})
            return (json.dumps({'message': 'Processamento enfileirado', 'jobId': job_id}), 200, headers)
        except Exception as e:
            logger.error(f"Failed to enqueue task: {e}")
            return (json.dumps({'error': f'Failed to enqueue: {e}'}), 500, headers)
    except Exception as e:
        return (json.dumps({'error': str(e)}), 500, headers)

def handle_importar_drive(request, headers):
    """Importa do Drive para GCS e inicia processamento."""
    try:
        data = request.get_json()
        file_id = data.get('fileId')
        oauth_token = data.get('oAuthToken')
        
        if not file_id or not oauth_token:
            logger.error(f"Missing fileId or token. Data: {data}")
            return (json.dumps({'error': 'Missing fileId or token'}), 400, headers)
            
        # 1. Obter metadados do arquivo (Nome)
        logger.info(f"Fetching metadata for file_id: {file_id}")
        meta_url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
        headers_drive = {'Authorization': f'Bearer {oauth_token}'}
        
        resp_meta = requests.get(meta_url, headers=headers_drive)
        if resp_meta.status_code != 200:
             logger.error(f"Drive API Error: {resp_meta.text}")
             return (json.dumps({'error': f'Drive API Error: {resp_meta.text}'}), 500, headers)
             
        filename = resp_meta.json().get('name', f'drive_{file_id}.pdf')
        logger.info(f"Filename resolved: {filename}")
        
        # 2. Baixar Conteúdo (alt=media)
        # Para arquivos Google Docs seria export, mas o picker filtro PDF, assumimos binário.
        download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
        
        # Stream download -> Upload GCS
        # Para evitar estourar memória na Cloud Function, fazemos stream.
        # Mas para simplificar aqui vamos carregar em memória (cuidado com arquivos > 500MB)
        # O ideal seria usar transfer manager ou stream chunked.
        
        # Download to memory to verify content
        logger.info("Downloading file content to memory...")
        resp_content = requests.get(download_url, headers=headers_drive)
        
        if resp_content.status_code != 200:
            logger.error(f"Failed to download file. Status: {resp_content.status_code}, Response: {resp_content.text}")
            return (json.dumps({'error': 'Failed to download file from Drive'}), 500, headers)
            
        file_content = resp_content.content
        file_size = len(file_content)
        logger.info(f"Downloaded {file_size} bytes from Drive.")
        
        if file_size == 0:
            logger.error("File downloaded from Drive is empty (0 bytes).")
            return (json.dumps({'error': 'File is empty'}), 400, headers)

        bucket_name = os.environ.get("BUCKET_NAME")
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(f"uploads/{filename}")
        
        # Upload from string/bytes
        logger.info(f"Uploading to GCS: gs://{bucket_name}/uploads/{filename}")
        blob.upload_from_string(file_content, content_type='application/pdf')
        logger.info("Upload to GCS completed.")
        
        # 3. Criar Job
        job_ref = db.collection('analises_processos').document()
        job_id = job_ref.id
        logger.info(f"Job created: {job_id}")
        
        # 4. Iniciar Processamento (Enfileirar)
        job_ref.set({
            'status': 'ENFILEIRADO',
            'progresso': 0,
            'data_criacao': firestore.SERVER_TIMESTAMP,
            'url_arquivo_original': f"gs://{bucket_name}/uploads/{filename}",
            'origem': 'GOOGLE_DRIVE'
        })
        
        try:
            enqueue_process_task({'jobId': job_id, 'filePath': f"gs://{bucket_name}/uploads/{filename}"})
            return (json.dumps({'message': 'Importação iniciada (Enfileirada)', 'jobId': job_id}), 200, headers)
        except Exception as e:
             logger.error(f"Failed to enqueue task drive: {e}")
             return (json.dumps({'error': f'Failed to enqueue: {e}'}), 500, headers)

    except Exception as e:
        logger.exception("Exception in handle_importar_drive")
        return (json.dumps({'error': str(e)}), 500, headers)


# --- LÓGICA CORE DE ANÁLISE ---

def processar_pdf(job_id, file_path_gs):
    """
    1. Baixar PDF
    2. Identificar Sumário (Gemini 1)
    3. Mapear Páginas (Regex)
    4. Recortar e Analisar (Gemini 2)
    5. Salvar Resultados
    """
    logger.info(f"Iniciando job {job_id} para {file_path_gs}")
    doc_ref = db.collection('analises_processos').document(job_id)
    
    try:
        # 1. Baixar PDF
        logger.info("Step 1: Downloading PDF from GCS")
        bucket_name = file_path_gs.split('/')[2]
        blob_name = '/'.join(file_path_gs.split('/')[3:])
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        pdf_bytes = blob.download_as_bytes()
        logger.info(f"PDF Downloaded from GCS. Size: {len(pdf_bytes)} bytes")
        
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        logger.info(f"PDF Opened with Fitz. Is Encrypted: {doc.is_encrypted}. Page Count: {len(doc)}")
        
        if len(doc) == 0:
             logger.error("PDF has 0 pages. Check if the file is corrupted or empty.")
             doc_ref.update({'status': 'ERRO', 'erro': 'O arquivo PDF parece estar vazio ou corrompido.'})
             return
        
        if doc.is_encrypted:
            logger.error("PDF is encrypted")
            doc_ref.update({'status': 'ERRO', 'erro': 'Arquivo protegido por senha'})
            return

        doc_ref.update({'progresso': 10})

        # 2. Identificar Sumário (Gemini Flash)
        # Pega 5 primeiras e 10 últimas
        logger.info(f"Step 2: Identifying Index. Total pages: {len(doc)}")
        pages_to_scan = list(range(min(5, len(doc))))
        if len(doc) > 10:
             pages_to_scan += list(range(len(doc)-10, len(doc)))
        
        extracted_text_images = []
        for p_num in pages_to_scan:
            page = doc[p_num]
            # Extrair texto ou imagem. Vamos de texto para economizar token, imagem se precisar
            text = page.get_text()
            extracted_text_images.append(f"--- PÁGINA {p_num} ---\n{text}")

        full_context = "\n".join(extracted_text_images)
        
        model_flash = genai.GenerativeModel('gemini-2.5-flash') 
        # Melhoria no Prompt para ser mais permissivo e explicativo
        prompt_sumario = """
        Você é um auditor jurídico experiente. Sua tarefa é identificar a tabela de índice ou lista de documentos neste PDF.
        Também tente encontrar o NÚMERO DO PROCESSO (formato NNNNNNN-DD.AAAA.J.TR.OOOO).

        Geralmente encontrada nas primeiras ou últimas páginas.
        Procure por:
        - Tabela com colunas 'Id', 'Documento', 'Data'.
        - Lista sequencial de peças processuais.
        - Cabeçalho ou linha contendo "Índice", "Sumário", "Peças".

        Se encontrar, extraia TODOS os documentos listados.
        Se a imagem/texto não tiver qualidade ou não for um índice, retorne lista vazia [].

        Saída Obrigatória (JSON):
        {
          "numero_processo": "string ou null",
          "documentos": [
             { "id_documento": "string ou null", "tipo_original": "string", "data": "string ou null" }
          ]
        }
        """
        
        response_sumario = model_flash.generate_content([prompt_sumario, full_context], generation_config={"response_mime_type": "application/json", "temperature": 0.2})
        logger.info(f"Raw Gemini response for Index: {response_sumario.text}")
        
        documentos_listados = []
        numero_processo = None
        
        try:
            data_sumario = json.loads(response_sumario.text)
            # Suporte a formatos antigos ou novos da resposta
            if isinstance(data_sumario, list):
                documentos_listados = data_sumario
            elif isinstance(data_sumario, dict):
                documentos_listados = data_sumario.get('documentos', [])
                numero_processo = data_sumario.get('numero_processo')
        except json.JSONDecodeError:
             logger.error(f"Failed to parse JSON from Gemini: {response_sumario.text}")

        logger.info(f"Process Number found: {numero_processo}")
        logger.info(f"Index found: {len(documentos_listados)} documents")
        
        # Se achou numero do processo, vamos usar como ID Pai, senao mantemos o job_id
        # Mas atenção: o frontend está ouvindo analises_processos/{job_id}, então se mudarmos o ID aqui,
        # o frontend vai perder o tracking em tempo real. 
        # SOLUÇÃO: Manter o documento pai com job_id, e salvar os resultados lá dentro.
        # OU: Atualizar o documento pai com o numero do processo em um campo.
        # O usuário pediu: "O valor de 'job_id' (na URL analises_processos/{job_id}/documentos_analisados) deve ser igual ao 'Número do Processo'".
        # Isso implica que devemos criar um novo documento pai ou subcoleção com o nome do processo?
        # Se eu mudar o path onde salvo os 'documentos_analisados', o frontend (que sabe o JobID) não vai achar.
        # O frontend recebe o jobId na resposta do upload.
        # Vou assumir que o usuário entende que se o path mudar, o frontend precisa saber.
        # MAS, talvez ele queira que o "job_id" original já FOSSE o numero do processo? Impossivel saber antes.
        # Vou gravar em analises_processos/{numero_processo}/documentos_analisados SE o numero_processo existir.
        # E vou atualizar o job original com um "pointer" ou status 'CONCLUIDO_COM_ID_NOVO'.
        
        parent_id = job_id
        if numero_processo:
            # Limpar formatação
            numero_processo_clean = re.sub(r'[^0-9]', '', numero_processo)
            if numero_processo_clean:
                # O usuário pediu para o ID ser igual ao Numero do Processo. 
                # Pode ser o formatado ou limpo. Vou usar o LIMPO para evitar caracteres especiais em URL.
                # Ou usar o formatado se ele preferir leitura. Vou usar o que vier, mas cuidado com "/".
                safe_proc_num = numero_processo.replace('/', '-').replace(' ', '')
                parent_id = safe_proc_num
                
                # ID do PAI real (Processo)
                parent_doc_ref = db.collection('analises_processos').document(parent_id)
                parent_snapshot = parent_doc_ref.get()

                # --- CONCURRENCY SAFEGUARD ---
                if parent_snapshot.exists:
                    parent_data = parent_snapshot.to_dict()
                    current_status = parent_data.get('status')
                    last_update = parent_data.get('data_criacao') # ou analisado_em
                    
                    # Se já está processando por OUTRO job (não este) e foi recente (< 10 min)
                    if current_status == 'PROCESSANDO' and parent_data.get('origem_job_id') != job_id:
                        # Verifica se é muito antigo (zumbi)
                        if last_update:
                            # Se for Timestamp do firestore, converte. Se for muito recente, aborta este.
                            # Simplificado: Se status é processando e tem origem diferente, assume duplicação.
                            logger.warning(f"Process {parent_id} is already being processed by job {parent_data.get('origem_job_id')}. Aborting redundancy.")
                            doc_ref.update({'status': 'REDUNDANTE_ABORTADO', 'info': f'Já sendo processado por {parent_data.get("origem_job_id")}'})
                            return

                # Se passou, assume a liderança
                parent_doc_ref.set({
                    'status': 'PROCESSANDO', 
                    'data_criacao': firestore.SERVER_TIMESTAMP,
                    'numero_processo': numero_processo,
                    'origem_job_id': job_id
                }, merge=True)
                
                logger.info(f"Redirecting output to Process ID: {parent_id}")

        if not documentos_listados:
             logger.warning("No index found in the supplied context. Context sample: " + full_context[:200])
             doc_ref.update({'status': 'ERRO', 'erro': 'Sumário não encontrado. Verifique se o PDF possui um índice nas 5 primeiras ou 10 últimas páginas.'})
             return

        doc_ref.update({'progresso': 30, 'numero_processo_detectado': numero_processo})

        # 3. Mapeamento Físico (Regex)
        logger.info("Step 3: Regex Mapping")
        mapa_paginas = {} # id -> [indices]
        
        regex_trf = re.compile(r"Num\.\s+(\d{9,})")
        regex_trt = re.compile(r"-\s+([a-f0-9]{7})\s*$")

        for i, page in enumerate(doc):
            text = page.get_text()
            
            # TRF Check
            match_trf = regex_trf.search(text)
            if match_trf:
                doc_id = match_trf.group(1)
                if doc_id not in mapa_paginas: mapa_paginas[doc_id] = []
                mapa_paginas[doc_id].append(i)
                continue
            
            # TRT Check
            match_trt = regex_trt.search(text)
            if match_trt:
                doc_id = match_trt.group(1)
                # Normalização: As vezes o índice do sumário usa parte do hash ou ele todo
                if doc_id not in mapa_paginas: mapa_paginas[doc_id] = []
                mapa_paginas[doc_id].append(i)

        doc_ref.update({'progresso': 50})
        
        # 4. Cruzamento e Análise Individual
        model_pro = genai.GenerativeModel('gemini-2.5-pro') 
        
        tasks_found = []
        
        # Iterar sobre o que achamos no sumário
        for item in documentos_listados:
            extracted_doc_id = item.get('id_documento') # ID extraído do Sumário
            
            # Tentar match exato ou parcial
            found_pages = mapa_paginas.get(extracted_doc_id)
            if not found_pages:
                # Tentar match parcial (hashing as vezes trunca)
                if extracted_doc_id:
                    for k in mapa_paginas.keys():
                        if extracted_doc_id in k or k in extracted_doc_id:
                            found_pages = mapa_paginas[k]
                            break
            
            if found_pages:
                tasks_found.append({
                    'meta': item,
                    'pages': found_pages
                })

        total_tasks = len(tasks_found)
        logger.info(f"Step 4: Processing {total_tasks} tasks (documents matched)")
        processed_count = 0
        
        # DEDUPLICAÇÃO: Buscar documentos já analisados neste processo
        existing_docs_ref = db.collection(f"analises_processos/{parent_id}/documentos_analisados")
        existing_docs = existing_docs_ref.select(['idDocumento', 'id_documento']).stream()
        
        already_processed_ids = set()
        for d in existing_docs:
            data = d.to_dict()
            if data.get('idDocumento'): already_processed_ids.add(str(data.get('idDocumento')))
            if data.get('id_documento'): already_processed_ids.add(str(data.get('id_documento')))
            
        logger.info(f"Deduplication: {len(already_processed_ids)} documents already processed for {parent_id}")

        # Usado para garantir doc_ids únicos no Firestore
        seen_doc_ids = {}

        for task in tasks_found:
            meta = task['meta']
            pages = task['pages']
            
            doc_id_candidate = meta.get('id_documento')
            
            # 1. Filtro de Duplicatas (Banco de dados)
            if doc_id_candidate and str(doc_id_candidate) in already_processed_ids:
                logger.info(f"Skipping task for {doc_id_candidate} - Already processed.")
                processed_count += 1 # Conta como processado para progresso
                continue

            # 2. Filtro de Duplicatas (Lista atual - Evitar processar o mesmo ID duas vezes neste loop)
            # Adiciona ao set para barrar repetições na mesma lista de tasks
            if doc_id_candidate:
                if str(doc_id_candidate) in already_processed_ids:
                     # Já pegou no if acima ou na iteração anterior
                     continue
                already_processed_ids.add(str(doc_id_candidate))
            
            # Recorte Virtual
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=min(pages), to_page=max(pages))
            pdf_bytes_chunk = new_doc.tobytes()
            
            # Prompt Mestre Definido pelo Usuário
            filename = file_path_gs.split('/')[-1]
            prompt_analise = f"""
CONTEXTO:
Nome do Arquivo sendo analisado: {filename}

# PERSONA E OBJETIVO MESTRE

Você é um Perito Médico, especialista em Medicina do Trabalho, altamente qualificado, trabalhando sob minha supervisão (Dr. Paulo Mapurunga). Sua missão é transformar um documento de processo da justiça federal em uma análise JSON estruturada, que servirá como base direta para a elaboração do meu laudo pericial. Siga rigorosamente a estrutura de saída.

# DIRETRIZ PRINCIPAL: ANÁLISE CONTEXTUAL

Não se limite a extrair dados isolados. Analise o documento no contexto de uma perícia médica. Busque por correlações, contradições e informações que ajudem a estabelecer ou afastar Incapacidade Laboral (Temporária/Permanente; Parcial/Total), ou Impedimento, no caso em questão.

# REGRAS DE PREENCHIMENTO E FILTRAGEM

  * **Dados Ausentes:** Se uma informação específica para um campo do JSON não for encontrada no documento, preencha o campo com o valor `null` ou com uma string vazia `""`. **Não omita a chave.**

  * **IMPORTANTE: O QUE **NÃO** É CONSIDERADO DOCUMENTO MÉDICO:**
    **NUNCA inclua** na lista "documentosMedicosAnexados" documentos que sejam apenas:
    - Certidões (Nascimento, Casamento, Óbito).
    - Documentos de Identificação Pessoal (RG, CPF, CNH, Carteira de Trabalho, Título de Eleitor).
    - Comprovantes de Residência (Contas de Água, Luz, Telefone, Internet).
    - Documentos Escolares (Atestados de Matrícula, Histórico Escolar, Frequência).
    - Documentos Financeiros/Administrativos (Recibos, Notas Fiscais, Carteiras de Sindicato/Clube/Associação).
    - Cartões de Vacina ou Cartões do SUS (EXCETO se contiverem anotações clínicas de diagnóstico importantes).
    - Procurações, Declarações de Pobreza ou Petições Advocatícias (exceto se a petição transcrever um laudo).

  * **CRUCIAL: O QUE É DOCUMENTO MÉDICO:**
    Procure ativamente por documentos **clínicos** emitidos por profissionais de saúde. Para CADA documento encontrado deste tipo:
      * Identifique o tipo específico (Atestado Médico, Relatório Médico, Laudo de Exame de Imagem/Laboratorial, Prontuário, Receita, Guia de Encaminhamento, Laudo Pericial Prévio - INSS ou Judicial, CAT, ASO).
      * Extraia a data exata.
      * Extraia o nome do Profissional e Instituição.
      * Resuma o conteúdo clínico (Diagnóstico, CID, Achados, Conclusão).
      * Indique a página.

# ESTRUTURA DE SAÍDA JSON OBRIGATÓRIA PARA CADA ARQUIVO

```json
{{
  "idDocumento": "[O ID extraído. Obrigatório]",
  "nomeArquivoOriginal": "[O nome completo do arquivo PDF fornecido]",
  "tipoDocumentoGeral": "[Classificação geral: 'Petição Inicial', 'ASO Admissional', 'ASO Demissional', 'Relatório Médico', 'Comunicação INSS', 'Contestação', 'PCMSO', 'CAT', 'Quesitos', 'Despacho Judicial', 'AET', 'LTCAT', etc.]",
  "dataAssinatura": "[Data em que o documento foi assinado/protocolado nos autos do processo]",
  "poloOrigemDocumento": "[Ativo, Passivo, Neutro, ou Não Identificado]",
  "dadosRelevantesParaLaudo": {{
    "identificacaoDasPartes": "[Extraia nomes completos, CPFs, Endereço Residencial, PIS/PASEP, CTPS, CNPJs, Estado Civil, Escolaridade, do Reclamante e da Reclamada mencionados NESTE documento, etc.]",
    "Vara": "[Veja em qual Vara da Justiça ou Orgão Julgador está ocorrendo o caso, por exemplo: ‘1a Vara Federal da SSJ de Feira de Santana-BA’]",
    "Tribunal": "[Veja qual tribunal está esse processo. Por exemplo: TRF1, TRT5, TJBA, etc...]",
    "ResumoGeralConteudoArquivo": "[Resumo Geral do conteúdo principal deste arquivo, focando em informações importantes do ponto de vista Pericial]",
    "historicoClinicoGeral": "[Comorbidades, cirurgias, internações, histórico familiar mencionados NESTE documento.]"
  }},
  "historicoOcupacional": [
    {{
      "tipoOcupacao": "[Atual ou Anterior]",
      "ocupacao": "[Nome da profissão]",
      "descricaoFuncao": "[Descrição de função, atividades, tarefas encontradas NESTE documento.]",
      "periodoFuncao": "[Período em que exerceu a função. Ex: 'dd/mm/aaaa a dd/mm/aaaa']",
      "ambienteFisico": "[Menções a ruído, calor, ergonomia, agentes químicos encontradas NESTE documento.]",
      "ambientePsicossocial": "[Menções a pressão, metas, assédio, relacionamento com liderança encontradas NESTE documento.]",
      "jornadaTrabalho": "[Informações sobre horário, turno, pausas, horas extras encontradas NESTE documento.]",
      "treinamentoEPIs": "[Menção a EPIs e treinamentos encontrada NESTE documento.]"
    }}
  ],
  "documentosMedicosAnexados": [
    {{
      "tipo": "[Tipo específico: 'Relatório Médico', 'Laudo de Exame', 'Atestado', 'Receita', 'ASO', 'CAT', 'Laudo INSS'. NUNCA INCLUIR DOCUMENTOS PESSOAIS, CERTIDÕES OU COMPROVANTES DE RESIDÊNCIA AQUI]",
      "data": "[dd/mm/aaaa]",
      "profissionalServico": "[Nome do médico/clínica/hospital]",
      "resumoConteudo": "[Resumo do CONTEÚDO DESTE DOCUMENTO MÉDICO (Diagnóstico, CID, Achados, Conclusões)]",
      "paginaNoArquivo": "[Número da página no PDF]"
    }}
  ],
  "quesitosApresentados": [
    {{
      "polo": "[Ativo, Passivo ou Neutro]",
      "textoQuesito": "[Veja se tem quesitos apresentados neste arquivo. Diga objetivamente que sim ou que não tem quesitos neste arquivo.]",
      "paginaNoArquivo": "[Número da página no PDF onde o quesito se encontra]"
    }}
  ],
  "observacoes": "[Qualquer informação relevante que não se encaixe acima, dificuldades encontradas ou a justificativa para usar o nome do arquivo como idDocumento.]"
}}
```

# INSTRUÇÃO FINAL DE FORMATAÇÃO
Sua resposta deve conter **APENAS** o código JSON válido, sem nenhum texto introdutório, comentários ou explicações. Sua resposta deve começar diretamente com `{{` e terminar com `}}`.
"""
            
            # Chamada Gemini (Sincrona no loop por simplicidade, ideal seria asyncio.gather)
            # Para upload do blob pro Gemini 1.5 Pro, precisamos usar File API se for grande, ou inline data se pequeno.
            # Vamos assumir inline data para recortes de processos (< 20MB)
            logger.info(f"Analyzing sub-document {meta.get('id_documento')} with Gemini 2.5 Pro")
            response_analise = model_pro.generate_content([
                prompt_analise,
                {"mime_type": "application/pdf", "data": pdf_bytes_chunk}
            ], generation_config={"response_mime_type": "application/json", "temperature": 0.0})
            
            try:
                dados_extraidos = json.loads(response_analise.text)
                
                # FLATTENING & MERGING
                # O usuário quer que o resultado do Gemini fique 'ao lado' dos metadados, e não aninhado.
                # Vamos combinar os metadados originais com o resultado do Gemini.
                
                final_doc = {}
                # Prioridade: Dados do Gemini > Metadados do Sumário
                final_doc.update(meta) # id_documento, tipo_original, data do sumário
                final_doc.update(dados_extraidos) # idDocumento, tipoDocumentoGeral, etc do Gemini
                
                # Ajustes finos
                final_doc['paginas_pdf'] = pages  # indices das paginas
                final_doc['analisado_em'] = firestore.SERVER_TIMESTAMP
                final_doc['status'] = 'Sucesso'
                
                # Garantir doc_id único para FIRESTORE KEY
                # O ID pode ser o `idDocumento` retornado pelo Gemini ou o ID do sumário.
                base_id = final_doc.get('idDocumento') or final_doc.get('id_documento') or 'doc_desconhecido'
                
                # Limpar caracteres inválidos para ID de documento firestore
                safe_id = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(base_id))
                
                count = seen_doc_ids.get(safe_id, 0)
                seen_doc_ids[safe_id] = count + 1
                
                doc_key = safe_id
                if count > 0:
                    doc_key = f"{safe_id}_{count}" # ex: 12345_1
                
                # Persistência
                # Usando parent_id (que pode ser o numero do processo)
                db.collection(f"analises_processos/{parent_id}/documentos_analisados").document(doc_key).set(final_doc)
                
                processed_count += 1
                progresso_atual = 50 + int((processed_count / total_tasks) * 50)
                doc_ref.update({'progresso': progresso_atual})
                
                # Se mudamos o pai, atualiza ele também para o frontend saber que está vivo (opcional, mas bom)
                if parent_id != job_id:
                     db.collection('analises_processos').document(parent_id).update({'progresso': progresso_atual})

            except Exception as e:
                logger.error(f"Error processing sub-doc task: {e}")
                # Logar erro mas continuar loop
        
        doc_ref.update({'status': 'CONCLUIDO', 'progresso': 100})
        if parent_id != job_id:
            db.collection('analises_processos').document(parent_id).update({'status': 'CONCLUIDO', 'progresso': 100})

        logger.info("Job completed successfully.")
        
        # --- TRIGGER CONSOLIDATION ---
        try:
            consolidation_url = "https://consolidar-processos-async-557034577173.us-central1.run.app/consolidar-batch"
            # Precisamos enviar o ID do PAI (que pode ser o numero do processo ou o jobId original)
            # parent_id foi definido na linha 370 ou 379
            payload = {"process_ids": [parent_id]}
            
            logger.info(f"Triggering consolidation for {parent_id}: {consolidation_url}")
            # Timeout curto pois o serviço retorna 202 imediatamente
            resp_cons = requests.post(consolidation_url, json=payload, timeout=10)
            
            if resp_cons.status_code == 202:
                logger.info(f"Consolidation triggered successfully for {parent_id}.")
            else:
                logger.warning(f"Consolidation trigger returned unexpected status: {resp_cons.status_code} - {resp_cons.text}")

        except Exception as e_cons:
            # Não falha o job principal se o trigger falhar
            logger.error(f"Failed to trigger consolidation for {parent_id}: {e_cons}")
        # -----------------------------
        
        # 5. Cleanup: Deletar arquivo original do Bucket
        try:
            logger.info(f"Cleanup: Deleting file {file_path_gs}")
            blob.delete()
            logger.info("Cleanup: File deleted successfully.")
        except Exception as e:
            logger.warning(f"Cleanup: Failed to delete file {file_path_gs}. Error: {e}")

        
    except Exception as e:
        logger.exception("Final processing exception")
        doc_ref.update({'status': 'ERRO', 'erro': str(e)})

