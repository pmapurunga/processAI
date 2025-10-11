import os
import functions_framework
import traceback
from google.cloud import storage
from flask import Flask, request, jsonify
from flask_cors import CORS
import pathlib
from google.cloud import firestore
import google.cloud.logging
import logging
from datetime import datetime
import pytz

# --- SETUP ---
# Configura o logging para enviar logs para o Google Cloud Logging
log_client = google.cloud.logging.Client()
log_client.setup_logging()

# --- CONFIGURAÇÕES ---
NOME_BUCKET_GCS = os.environ.get("GCS_BUCKET_NAME", 'processai-468612.appspot.com')
project_id = os.environ.get('GCP_PROJECT', 'processai-468612')

# --- INICIALIZAÇÃO DE CLIENTES ---
storage_client = storage.Client(project=project_id)
db = firestore.Client(project=project_id)

# --- INICIALIZAÇÃO DO FLASK E CORS ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "allow_headers": ["Content-Type", "Authorization"]}})

@app.route('/', methods=['POST'])
def handle_request():
    """
    Ponto de entrada principal que lida com a requisição POST.
    Lida com dois cenários:
    1. Re-análise de um arquivo único para um processo existente (recebe 'caminhoArquivo').
    2. Nova análise de uma pasta inteira para um novo processo (recebe 'driveUrl').
    """
    try:
        request_data = request.get_json()
        if not request_data:
            return jsonify({"error": {"message": "Payload JSON inválido.", "status": "INVALID_ARGUMENT"}}), 400
        
        # **CORREÇÃO: Extrai o payload de dentro do objeto 'data' aninhado.**
        data = request_data.get('data')
        if not data:
             return jsonify({"error": {"message": "O payload deve estar aninhado dentro de um objeto 'data'.", "status": "INVALID_ARGUMENT"}}), 400

        # --- Cenário 1: Re-análise de um arquivo único (Funcionalidade existente) ---
        caminho_arquivo = data.get('caminhoArquivo')
        process_id_existing = data.get('processId')
        prompt_id = data.get('promptId')

        if caminho_arquivo and process_id_existing and prompt_id:
            logging.info(f"Iniciando análise de arquivo único para o processo: {process_id_existing}")
            bucket = storage_client.bucket(NOME_BUCKET_GCS)
            
            blob_arquivo = bucket.blob(caminho_arquivo)
            if not blob_arquivo.exists():
                return jsonify({"error": {"message": f"Arquivo '{caminho_arquivo}' não encontrado no Storage.", "status": "NOT_FOUND"}}), 404

            caminho_arquivo_path = pathlib.Path(caminho_arquivo)
            diretorio_pai = caminho_arquivo_path.parent
            
            caminho_trigger = diretorio_pai.joinpath("_INICIAR.txt").as_posix()
            trigger_blob = bucket.blob(caminho_trigger)
            trigger_blob.upload_from_string(prompt_id)

            return jsonify({
                "data": {
                    "message": "Análise de arquivo único iniciada com sucesso!",
                    "processId": process_id_existing,
                    "triggeredFile": caminho_trigger
                }
            }), 200

        # --- Cenário 2: Nova análise a partir de uma pasta (Nova funcionalidade) ---
        drive_url = data.get('driveUrl')
        # O prompt_id é pego de fora do if para ser usado em ambos os cenários
        if drive_url and prompt_id:
            logging.info(f"Iniciando análise de nova pasta: {drive_url}")
            
            sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
            current_time_sp = datetime.now(sao_paulo_tz)

            new_process_ref = db.collection('processes').document()
            process_id_new = new_process_ref.id

            new_process_ref.set({
                'description': f'Análise da pasta {drive_url}',
                'createdAt': current_time_sp.isoformat(),
                'status': 'in_progress',
                'driveUrl': drive_url 
            })
            logging.info(f"Novo processo criado no Firestore com ID: {process_id_new}")

            bucket = storage_client.bucket(NOME_BUCKET_GCS)
            
            blobs = list(bucket.list_blobs(prefix=drive_url))

            triggered_files = []
            file_count = 0
            for blob in blobs:
                if blob.name.lower().endswith('.pdf') and not blob.name.endswith('/'):
                    file_count += 1
                    caminho_arquivo_path = pathlib.Path(blob.name)
                    diretorio_pai = caminho_arquivo_path.parent
                    
                    caminho_trigger = diretorio_pai.joinpath("_INICIAR.txt").as_posix()
                    trigger_blob = bucket.blob(caminho_trigger)
                    
                    trigger_content = f"processId:{process_id_new}\npromptId:{prompt_id}"
                    trigger_blob.upload_from_string(trigger_content)
                    triggered_files.append(caminho_trigger)
            
            if file_count == 0:
                 db.collection('processes').document(process_id_new).delete()
                 logging.warning(f"Nenhum arquivo PDF encontrado em '{drive_url}'. Processo {process_id_new} foi removido.")
                 return jsonify({"error": {"message": f"Nenhum arquivo PDF encontrado no caminho: '{drive_url}'.", "status": "NOT_FOUND"}}), 404

            logging.info(f"Análise iniciada para {file_count} arquivos no processo {process_id_new}")

            return jsonify({
                "data": {
                    "message": f"Análise iniciada para {file_count} arquivos.",
                    "processId": process_id_new,
                    "triggeredFiles": triggered_files
                }
            }), 200

        # --- Se nenhum cenário for atendido, é um erro ---
        return jsonify({
            "error": {
                "message": "Requisição inválida. Forneça ('caminhoArquivo', 'processId', 'promptId') ou ('driveUrl', 'promptId') dentro do objeto 'data'.",
                "status": "INVALID_ARGUMENT"
            }
        }), 400
        
    except Exception as e:
        logging.error(f"Ocorreu um erro interno: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": {"message": f"Erro Interno do Servidor: {str(e)}", "status": "INTERNAL"}}), 500


@functions_framework.http
def iniciar_analise_http(request):
    """
    Ponto de entrada da Cloud Function que delega para o app Flask.
    """
    ctx = app.request_context(request.environ)
    ctx.push()
    try:
        return app.full_dispatch_request()
    finally:
        ctx.pop()
