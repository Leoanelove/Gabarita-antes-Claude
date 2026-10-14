import os
import re
import json
import time
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

# Schema estruturado para a extração do resumo do concurso pelo Gemini
concurso_detalhes_schema = {
    "type": "object",
    "properties": {
        "orgao": {"type": "string"},
        "banca": {"type": "string"},
        "esfera": {"type": "string", "enum": ["Federal", "Estadual", "Municipal"]},
        "data_prova": {"type": "string", "description": "Formato YYYY-MM-DD ou null"},
        "cargos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nome_cargo": {"type": "string"},
                    "vagas": {"type": "integer"},
                    "salario": {"type": "number"},
                    "escolaridade": {"type": "string"}
                },
                "required": ["nome_cargo", "vagas", "salario"]
            }
        }
    },
    "required": ["orgao", "banca", "esfera", "cargos"]
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

def analisar_artigo_com_gemini(texto_artigo: str):
    """Lê o artigo completo e extrai todos os cargos, salários individuais e datas."""
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": concurso_detalhes_schema,
            "temperature": 0.1,
        }
    )

    prompt = f"""
    Analise o texto deste artigo sobre o concurso e extraia os dados estruturados:
    1. Nome do Órgão oficial e Banca organizadora.
    2. Esfera (Federal, Estadual ou Municipal).
    3. Data da Prova no formato YYYY-MM-DD (se indicada no texto).
    4. Lista INDIVIDUALIZADA de todos os cargos citados (ex: Soldado, Oficial, Agente, Escrivão, Delegado),
       com as suas respetivas vagas imediatas (número inteiro) e remuneração/salário inicial (número float).
    
    TEXTO DO ARTIGO:
    {texto_artigo[:15000]}
    """
    
    resposta = model.generate_content(prompt)
    return json.loads(resposta.text)

def extrair_materias_cargo(pdf_path: str, cargo: str):
    """Envia o PDF ao Gemini e extrai a grade exata daquele cargo específico."""
    print(f"   -> Extraindo conteúdo programático do PDF para o cargo: '{cargo}'...")
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
    Analise o documento do edital e extraia o CONTEÚDO PROGRAMÁTICO (disciplinas e tópicos)
    especificamente para o cargo: '{cargo}'.
    - Se o nome do cargo contiver 'Soldado' ou 'Oficial', busque os blocos correspondentes no anexo de conteúdo programático.
    - Preserve os pesos de cada disciplina (ou 1.0 se padrão).
    - Extraia todos os tópicos detalhados.
    """
    
    resposta = model.generate_content([pdf_file, prompt])
    return json.loads(resposta.text)

def processar_concurso(url_noticia: str):
    print(f"\n==========================================")
    print(f"Acessando: {url_noticia}")
    res = requests.get(url_noticia, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        return 0

    soup = BeautifulSoup(res.text, "html.parser")
    
    # Localiza o link do PDF
    pdf_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        txt = a.get_text(strip=True).lower()
        if (".pdf" in href.lower() or "edital" in txt) and "cloudfront.net" in href:
            pdf_url = href
            break

    # Limpa tags desnecessárias para enviar texto limpo à IA
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    texto_artigo = soup.get_text(" ", strip=True)

    print("-> Enviando dados da notícia para estruturação dos cargos via Gemini...")
    dados = analisar_artigo_com_gemini(texto_artigo)
    
    orgao = dados.get("orgao", "Órgão Público")
    banca = dados.get("banca", "A definir")
    esfera = dados.get("esfera", "Estadual")
    data_prova = dados.get("data_prova")
    cargos_encontrados = dados.get("cargos", [])

    if not cargos_encontrados:
        print(f"Nenhum cargo estruturado encontrado para {orgao}.")
        return 0

    print(f"Identificados {len(cargos_encontrados)} cargos para {orgao}: {[c['nome_cargo'] for c in cargos_encontrados]}")

    # Faz o download do PDF se disponível
    temp_pdf = "temp_edital.pdf"
    tem_pdf = False
    if pdf_url:
        print(f"-> A descarregar PDF do Edital: {pdf_url}")
        try:
            res_pdf = requests.get(pdf_url, headers=HEADERS, timeout=60)
            if res_pdf.status_code == 200 and len(res_pdf.content) > 5000:
                with open(temp_pdf, "wb") as f:
                    f.write(res_pdf.content)
                tem_pdf = True
        except Exception as e:
            print(f"Erro ao descarregar PDF: {e}")

    inseridos = 0
    for c in cargos_encontrados:
        nome_cargo = c.get("nome_cargo", "Geral")
        vagas = int(c.get("vagas", 1))
        salario = float(c.get("salario", 0.0))
        escolaridade = c.get("escolaridade", "Superior / Médio")

        # Verifica duplicidade por Órgão + Cargo
        check = supabase.table("editais")\
            .select("id")\
            .ilike("orgao", f"%{orgao[:15]}%")\
            .ilike("cargo", f"%{nome_cargo[:15]}%")\
            .execute()
            
        if check.data and len(check.data) > 0:
            print(f"Cargo '{nome_cargo}' já registado. Ignorando...")
            continue

        materias = []
        if tem_pdf:
            try:
                materias = extrair_materias_cargo(temp_pdf, nome_cargo)
            except Exception as e:
                print(f"Falha ao extrair matérias para '{nome_cargo}': {e}")

        payload = {
            "titulo": f"{orgao} - 2026 - {nome_cargo}",
            "orgao": orgao[:255],
            "banca": banca[:100],
            "vagas": vagas,
            "salario_maximo": salario,
            "escolaridade": escolaridade[:100],
            "link_origem": url_noticia,
            "cargo": nome_cargo[:255],
            "esfera": esfera,
            "status": "Edital Publicado",
            "data_prova": data_prova,
            "observacoes": f"Edital: {pdf_url}" if pdf_url else "Ver notícia de origem",
            "materias": materias
        }

        try:
            supabase.table("editais").insert(payload).execute()
            print(f"   ✓ Inserido com sucesso: {orgao} -> Cargo: {nome_cargo} | Vagas: {vagas} | Salário: R$ {salario} | Matérias: {len(materias)}")
            inseridos += 1
        except Exception as e:
            print(f"Erro ao gravar no Supabase: {e}")

    if tem_pdf and os.path.exists(temp_pdf):
        os.remove(temp_pdf)

    return inseridos

def iniciar():
    url_base = "https://concursos.estrategia.com/portal/concursos-abertos/"
    print(f"1. A analisar listagem geral: {url_base}")
    res = requests.get(url_base, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        return

    soup = BeautifulSoup(res.text, "html.parser")
    links_concursos = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/portal/concurso-" in href and href not in links_concursos:
            links_concursos.append(href)

    print(f"Total de editais disponíveis para avaliação: {len(links_concursos)}")
    
    total_novos = 0
    # Processa até 2 notícias completas por execução para gerir o tempo do GitHub Actions
    for link in links_concursos:
        if total_novos >= 2:
            break
        
        slug = link.rstrip("/").split("/")[-1].replace("concurso-", "").replace("-", " ")
        # Ignora se já estiver parcialmente registado
        check = supabase.table("editais").select("id").ilike("orgao", f"%{slug[:12]}%").execute()
        if check.data and len(check.data) > 0:
            continue

        inseridos = processar_concurso(link)
        if inseridos > 0:
            total_novos += 1
            time.sleep(3)

    print(f"\nRonda finalizada. Total de concursos estruturados inseridos: {total_novos}")

if __name__ == "__main__":
    iniciar()
