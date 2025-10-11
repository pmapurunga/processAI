from flask import Flask, request
from google.cloud import storage

app = Flask(__name__)

@app.route("/", methods=["POST"])
def iniciar_analise_storage():
    """
    Função acionada por um evento do Cloud Storage via Eventarc,
    processando um payload de CloudEvent direto.
    """
    # O payload do CloudEvent é o corpo JSON da requisição
    data = request.get_json()

    if not data or "bucket" not in data or "name" not in data:
        print("Payload inválido ou ausente de dados de bucket/name.")
        # Retorna 2xx para que o Eventarc não tente reenviar a mensagem.
        return ("Payload inválido ou ausente de dados de bucket/name.", 200)

    bucket_name = data.get("bucket")
    file_name = data.get("name")

    # Ignora arquivos de gatilho para evitar loops infinitos.
    if file_name.endswith("_INICIAR.txt"):
        print(f"Arquivo de gatilho '{file_name}' ignorado.")
        return ("OK", 200)

    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.get_blob(file_name)

        if not blob or not blob.metadata:
            print(f"Arquivo '{file_name}' não encontrado ou sem metadados.")
            return ("Arquivo não encontrado ou sem metadados.", 200)

        metadata = blob.metadata
        prompt_id = metadata.get("promptId")
        process_id = metadata.get("processId")

        if not prompt_id or not process_id:
            print(f"Metadados 'promptId' ou 'processId' ausentes em '{file_name}'.")
            return ("Metadados ausentes.", 200)

        # Cria o arquivo de gatilho "_INICIAR.txt" no mesmo diretório.
        directory = "/".join(file_name.split("/")[:-1])
        trigger_file_path = f"{directory}/_INICIAR.txt"
        trigger_blob = bucket.blob(trigger_file_path)
        trigger_blob.upload_from_string(prompt_id)

        print(f"Análise iniciada para o processo '{process_id}' com o prompt '{prompt_id}'.")
        return ("OK", 200)

    except Exception as e:
        print(f"Ocorreu um erro inesperado: {e}")
        # Retorna um erro 500, o que pode fazer com que o Eventarc tente reenviar.
        return ("Erro interno no servidor.", 500)

if __name__ == "__main__":
    # O Gunicorn usará esta instância 'app', esta parte é para desenvolvimento local.
    app.run(host="0.0.0.0", port=8080)
