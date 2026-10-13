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

# 2. Esquema rígido aceito pelo Gabarita PRO
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
    """Envia o PDF baixado para o Gemini e retorna a estrutura JSON de disciplinas."""
    print("Enviando PDF para a API do Gemini...")
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
    Analise o documento e extraia o CONTEÚDO PROGRAMÁTICO para o cargo principal (ou '{cargo}'):
    1. Verifique a tabela de provas para definir os pesos reais de cada disciplina (ou 1.0 se não especificado).
    2. Liste todos os tópicos e subtópicos preservando a numeração oficial.
    3. Retorne exclusivamente a lista padronizada de matérias.
    """

    resposta = model.generate_content([pdf_file, prompt])
    return json.loads(resposta.text)

def buscar_edital_pci():
    """Varre a listagem de concursos nacionais do PCI Concursos."""
    url_nacional = "https://www.pciconcursos.com.br/concursos/nacional"
    print(f"Varrendo: {url_nacional}")

    res = requests.get(url_nacional, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        print(f"Erro ao acessar PCI Concursos: Status {res.status_code}")
        return

    soup = BeautifulSoup(res.text, "html.parser")
    
    # Cada concurso no PCI fica dentro de blocos identificados por classes 'na' ou links nas listas
    links_concursos = []
    for link in soup.find_all("a", href=True):
        href = link["href"]
        # Filtra apenas links de notícias/páginas de certames do PCI
        if "/concurso/" in href or "/noticias/" in href:
            texto = link.get_text(strip=True)
            if texto and len(texto) > 10:
                links_concursos.append({"titulo": texto, "url": href})

    print(f"Concursos encontrados na listagem: {len(links_concursos)}")

    for item in links_concursos:
        titulo_busca = item["titulo"]
        
        # 1. Verifica se já existe na tabela editais para não duplicar
        check = supabase.table("editais").select("id").ilike("titulo", f"%{titulo_busca[:20]}%").execute()
        if check.data and len(check.data) > 0:
            print(f"Já cadastrado no banco: {titulo_busca[:35]}... (Pulando)")
            continue

        print(f"\nAnalisando novo concurso: {titulo_busca}")
        print(f"Acessando página: {item['url']}")

        # 2. Entra na página interna do concurso no PCI para caçar o link do edital PDF
        res_detalhe = requests.get(item["url"], headers=HEADERS, timeout=30)
        soup_detalhe = BeautifulSoup(res_detalhe.text, "html.parser")

        pdf_url = None
        for a_tag in soup_detalhe.find_all("a", href=True):
            link_href = a_tag["href"]
            texto_link = a_tag.get_text(strip=True).lower()
            if ".pdf" in link_href.lower() or "edital" in texto_link:
                pdf_url = link_href
                break

        if not pdf_url:
            print("Link direto do edital em PDF não localizado nesta página. Indo para o próximo.")
            continue

        if not pdf_url.startswith("http"):
            pdf_url = f"https://www.pciconcursos.com.br{pdf_url}"

        print(f"PDF do Edital localizado: {pdf_url}")
        
        # 3. Baixa o arquivo PDF temporariamente
        temp_pdf = "temp_edital.pdf"
        print("Baixando arquivo...")
        res_pdf = requests.get(pdf_url, headers=HEADERS, timeout=60)
        with open(temp_pdf, "wb") as f:
            f.write(res_pdf.content)

        # 4. Envia para o Gemini
        try:
            cargo_padrao = "Geral / Analista"
            materias = extrair_edital_com_gemini(temp_pdf, cargo_padrao)
            print(f"IA processou com sucesso! {len(materias)} matérias estruturadas.")

            # 5. Salva na tabela editais do Supabase
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
            print(f"Sucesso! '{titulo_busca}' foi gravado no Supabase.")
            
            # Limpa o arquivo temporário
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)
                
            # Interrompe no 1º edital para nosso teste controlado
            break

        except Exception as e:
            print(f"Falha ao processar com IA/Supabase: {e}")
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)

if __name__ == "__main__":
    print("Iniciando varredura no PCI Concursos (Nacional)...")
    buscar_edital_pci()
    print("Processamento concluído.")
