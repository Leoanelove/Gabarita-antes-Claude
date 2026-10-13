import os
import json
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import google.generativeai as genai

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_KEY]):
    raise ValueError("Chaves secretas em falta nas variáveis de ambiente.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

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

def extrair_edital_com_gemini(pdf_path: str, cargo: str):
    print("A enviar o PDF para a API do Gemini...")
    pdf_file = genai.upload_file(pdf_path, mime_type="application/pdf")

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": materias_schema,
            "temperature": 0.1,
        }
    )

    prompt = f"""
    Analise o documento do edital e extraia o CONTEÚDO PROGRAMÁTICO para o cargo: '{cargo}'.
    1. Identifique os pesos reais das disciplinas no quadro de provas (ou 1.0 se não especificado).
    2. Extraia todos os tópicos e subtópicos preservando a numeração oficial.
    3. Responda estritamente com o array JSON de disciplinas.
    """

    resposta = model.generate_content([pdf_file, prompt])
    return json.loads(resposta.text)

def buscar_edital_pci():
    url_nacional = "https://www.pciconcursos.com.br/concursos/nacional"
    print(f"A analisar listagem: {url_nacional}")

    res = requests.get(url_nacional, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        print(f"Falha de acesso ao PCI Concursos: Status {res.status_code}")
        return

    soup = BeautifulSoup(res.text, "html.parser")
    
    links_concursos = []
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/concurso/" in href or "/noticias/" in href:
            texto = link.get_text(strip=True)
            if texto and len(texto) > 12:
                links_concursos.append({"titulo": texto, "url": href})

    print(f"Total de concursos identificados: {len(links_concursos)}")
    editais_processados = 0

    for item in links_concursos:
        titulo = item["titulo"]

        # Verifica se já existe na base para não duplicar
        check = supabase.table("editais").select("id").ilike("titulo", f"%{titulo[:25]}%").execute()
        if check.data and len(check.data) > 0:
            continue

        print(f"\nA verificar certame: {titulo}")
        link_pagina = item["url"]
        if not link_pagina.startswith("http"):
            link_pagina = f"https://www.pciconcursos.com.br{link_pagina}"

        try:
            res_detalhe = requests.get(link_pagina, headers=HEADERS, timeout=30)
            soup_detalhe = BeautifulSoup(res_detalhe.text, "html.parser")
        except Exception as e:
            print(f"Erro ao abrir página do certame: {e}")
            continue

        pdf_url = None
        for a_tag in soup_detalhe.find_all("a", href=True):
            h = a_tag["href"].strip()
            texto_tag = a_tag.get_text(strip=True).lower()

            if "javascript:" in h.lower() or h == "#":
                continue

            if ".pdf" in h.lower() or "edital de abertura" in texto_tag or "íntegra do edital" in texto_tag:
                pdf_url = h
                break

        if not pdf_url:
            # Continua para o próximo da lista sem parar o robô
            continue

        if not pdf_url.startswith("http"):
            if not pdf_url.startswith("/"):
                pdf_url = "/" + pdf_url
            pdf_url = f"https://www.pciconcursos.com.br{pdf_url}"

        print(f"PDF encontrado: {pdf_url}")
        temp_pdf = "temp_edital.pdf"

        try:
            res_pdf = requests.get(pdf_url, headers=HEADERS, timeout=60)
            if res_pdf.status_code != 200 or len(res_pdf.content) < 5000:
                print("Ficheiro inválido ou corrompido. A passar ao seguinte...")
                continue

            with open(temp_pdf, "wb") as f:
                f.write(res_pdf.content)
        except Exception as e:
            print(f"Erro ao descarregar PDF: {e}")
            continue

        try:
            cargo_alvo = "Geral"
            materias = extrair_edital_com_gemini(temp_pdf, cargo_alvo)

            payload = {
                "titulo": titulo,
                "orgao": titulo.split("-")[0].strip() if "-" in titulo else titulo,
                "cargo": cargo_alvo,
                "banca": "Consultar Edital",
                "esfera": "Federal",
                "status": "Publicado",
                "materias": materias
            }

            supabase.table("editais").insert(payload).execute()
            print(f"\nSUCESSO: '{titulo}' gravado no Supabase com {len(materias)} matérias!")
            editais_processados += 1

            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)

            # Para após gravar 1 edital novo com sucesso
            break

        except Exception as e:
            print(f"Erro na extração ou gravação: {e}")
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)

    if editais_processados == 0:
        print("Nenhum edital com PDF direto pendente de inserção nesta ronda.")

if __name__ == "__main__":
    print("Início da varredura...")
    buscar_edital_pci()
    print("Fim do processo.")
