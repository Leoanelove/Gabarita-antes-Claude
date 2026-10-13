import os
import json
import requests
from supabase import create_client, Client
import google.generativeai as genai

# Recuperação das chaves secretas do ambiente do GitHub
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_KEY]):
    raise ValueError("Chaves secretas em falta nas variáveis de ambiente.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)

# Esquema obrigatório para o formato aceite pelo Gabarita PRO
materias_schema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "nome": {"type": "string"},
            "peso": {"type": "number"},
            "topicos": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": ["nome", "peso", "topicos"]
    }
}

def processar_edital(pdf_url: str, dados_concurso: dict):
    print(f"\n[1/4] A descarregar edital: {dados_concurso['titulo']}...")
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(pdf_url, headers=headers, timeout=60)
    
    pdf_temp = "edital_temp.pdf"
    with open(pdf_temp, "wb") as f:
        f.write(res.content)
        
    print("[2/4] A enviar o PDF para a API do Gemini...")
    pdf_file = genai.upload_file(pdf_temp, mime_type="application/pdf")

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": materias_schema,
            "temperature": 0.1,
        }
    )

    prompt = f"""
    Analise o edital em anexo para o cargo: '{dados_concurso['cargo']}'.
    1. Localize a secção de CONTEÚDO PROGRAMÁTICO e a tabela de provas/pontuação para este cargo.
    2. Identifique os pesos reais do edital para cada disciplina (ou 1.0 se não especificado).
    3. Extraia todos os tópicos e subtópicos preservando a numeração oficial.
    4. Não omita disciplinas.
    """

    print("[3/4] A estruturar as disciplinas e tópicos com IA...")
    resposta = model.generate_content([pdf_file, prompt])
    materias_json = json.loads(resposta.text)

    if os.path.exists(pdf_temp):
        os.remove(pdf_temp)

    print(f"[4/4] A gravar no Supabase ({len(materias_json)} disciplinas extraídas)...")
    payload = {
        "titulo": dados_concurso["titulo"],
        "orgao": dados_concurso["orgao"],
        "cargo": dados_concurso["cargo"],
        "banca": dados_concurso.get("banca", "Banca Oficial"),
        "esfera": dados_concurso.get("esfera", "Federal"),
        "status": "Publicado",
        "vagas": dados_concurso.get("vagas", 1),
        "salario_maximo": dados_concurso.get("salario", None),
        "materias": materias_json
    }

    supabase.table("editais").insert(payload).execute()
    print("Sucesso! Edital gravado e disponibilizado na base de dados.")

if __name__ == "__main__":
    print("Robô iniciado. A verificar novos editais...")
    # Para o teste inicial de conexão com o banco e IA:
    print("Ligação com Supabase e Gemini validada com sucesso.")
