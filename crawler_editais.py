import os
import json
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import google.generativeai as genai

# 1. Credenciais do ambiente
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_KEY]):
    raise ValueError("Chaves secretas não configuradas no ambiente.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# 2. Esquema rígido aceite pelo Gabarita PRO
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
    """Envia o PDF descarregado para o Gemini e retorna a estrutura JSON de disciplinas."""
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
    Você é o extrator oficial de editais do Gabarita PRO.
    Analise o documento e extraia o CONTEÚDO PROGRAMÁTICO para o cargo: '{cargo}':
    1. Verifique a tabela de provas para definir os pesos reais de cada disciplina (ou 1.0 se não especificado).
    2. Liste todos os tópicos e subtópicos preservando a numeração oficial.
    3. Retorne exclusivamente a lista padronizada de matérias em formato JSON.
    """

    resposta = model.generate_content([pdf_file, prompt])
    return json.loads(resposta.text)

def buscar_edital_pci():
    """Varre a listagem de concursos nacionais do PCI Concursos."""
    url_nacional = "https://www.pciconcursos.com.br/concursos/nacional"
    print(f"A verificar: {url_nacional}")

    res = requests.get(url_nacional, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        print(f"Erro ao aceder ao PCI Concursos: Status {res.status_code}")
        return

    soup = BeautifulSoup(res.text, "html.parser")
    
    links_concursos = []
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/concurso/" in href or "/noticias/" in href:
            texto = link.get_text(strip=True)
            if texto and len(texto) > 10:
                links_concursos.append({"titulo": texto, "url": href})

    print(f"Concursos encontrados na listagem: {len(links_concursos)}")

    for item in links_concursos:
        titulo_busca = item["titulo"]
        
        # 1. Evita duplicados na base do Supabase
        check = supabase.table("editais").select("id").ilike("titulo", f"%{titulo_busca[:20]}%").execute()
        if check.data and len(check.data) > 0:
            print(f"Já registado no Supabase: {titulo_busca[:35]}... (A ignorar)")
            continue

        print(f"\nA analisar concurso: {titulo_busca}")
        print(f"A aceder à página: {item['url']}")

        try:
            res_detalhe = requests.get(item["url"], headers=HEADERS, timeout=30)
            soup_detalhe = BeautifulSoup(res_detalhe.text, "html.parser")
        except Exception as e:
            print(f"Erro ao abrir página do certame: {e}")
            continue

        # 2. Localiza um link válido direto para o PDF (ignorando scripts javascript)
        pdf_url = None
        for a_tag in soup_detalhe.find_all("a", href=True):
            link_href = a_tag["href"].strip()
            texto_link = a_tag.get_text(strip=True).lower()
            
            # Descarta links inválidos
            if "javascript:" in link_href.lower() or link_href == "#":
                continue
                
            if ".pdf" in link_href.lower() or "edital" in texto_link:
                pdf_url = link_href
                break

        if not pdf_url:
            print("Nenhum link direto para ficheiro PDF localizado nesta publicação. A avançar...")
            continue

        if not pdf_url.startswith("http"):
            if not pdf_url.startswith("/"):
                pdf_url = "/" + pdf_url
            pdf_url = f"https://www.pciconcursos.com.br{pdf_url}"

        print(f"Link do PDF localizado: {pdf_url}")
        
        # 3. Descarrega o ficheiro PDF
        temp_pdf = "temp_edital.pdf"
        print("A descarregar o ficheiro do edital...")
        try:
            res_pdf = requests.get(pdf_url, headers=HEADERS, timeout=60)
            if res_pdf.status_code != 200 or len(res_pdf.content) < 1000:
                print("O ficheiro retornado não é um PDF válido. A avançar...")
                continue
                
            with open(temp_pdf, "wb") as f:
                f.write(res_pdf.content)
        except Exception as e:
            print(f"Falha no descarregamento do PDF: {e}")
            continue

        # 4. Envia para o Gemini
        try:
            cargo_padrao = "Geral"
            materias = extrair_edital_com_gemini(temp_pdf, cargo_padrao)
            print(f"Sucesso na IA! {len(materias)} disciplinas estruturadas.")

            # 5. Guarda na tabela editais do Supabase
            payload = {
                "titulo": titulo_busca,
                "orgao": titulo_busca.split("-")[0].strip() if "-" in titulo_busca else titulo_busca,
                "cargo": cargo_padrao,
                "banca": "Consultar Edital",
                "esfera": "Federal",
                "status": "Publicado",
                "materias": materias
            }

            supabase.table("editais").insert(payload).execute()
            print(f"Sucesso total! '{titulo_busca}' gravado com sucesso no Supabase.")
            
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)
                
            # Interrompe no primeiro para testar de ponta a ponta com segurança
            break

        except Exception as e:
            print(f"Erro no processamento Gemini/Supabase: {e}")
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)

if __name__ == "__main__":
    print("Início da verificação de editais...")
    buscar_edital_pci()
    print("Verificação concluída.")
