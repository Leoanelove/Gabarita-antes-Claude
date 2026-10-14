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
    raise ValueError("Chaves secretas faltando nas variáveis de ambiente.")

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

def extrair_conteudo_gemini(pdf_path: str, cargo: str):
    print(f"-> Enviando PDF do edital para o Gemini (analisando cargo: {cargo})...")
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
    Analise o documento do edital e extraia o CONTEÚDO PROGRAMÁTICO (disciplinas e tópicos) para o cargo: '{cargo}'.
    1. Identifique os pesos reais das disciplinas no quadro de provas (ou 1.0 se não especificado).
    2. Extraia todos os tópicos e subtópicos preservando a numeração oficial.
    3. Responda estritamente com o array JSON de disciplinas.
    """

    resposta = model.generate_content([pdf_file, prompt])
    return json.loads(resposta.text)

def limpar_vagas(texto: str) -> int:
    nums = re.findall(r'\d+', texto.replace('.', ''))
    return int(nums[0]) if nums else 1

def limpar_salario(texto: str) -> float:
    # Captura o maior salário caso venha em faixa (ex: R$ 5.667,92 a R$ 13.560,00)
    valores = re.findall(r'R\$\s*([\d\.,]+)', texto)
    if valores:
        salarios = []
        for v in valores:
            try:
                salarios.append(float(v.replace('.', '').replace(',', '.')))
            except ValueError:
                continue
        if salarios:
            return max(salarios)
    return 0.0

def normalizar_data(texto: str):
    match = re.search(r'(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?', texto)
    if not match:
        # Busca datas escritas por extenso (ex: 7 de março de 2027)
        meses = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
            'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
            'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        }
        match_ext = re.search(r'(\d{1,2})\s+de\s+([a-zA-Zç]+)\s+de\s+(\d{4})', texto.lower())
        if match_ext:
            d, m_txt, a = match_ext.groups()
            m = meses.get(m_txt, '01')
            return f"{a}-{m}-{d.zfill(2)}"
        return None

    dia = match.group(1).zfill(2)
    mes = match.group(2).zfill(2)
    ano = match.group(3) or "2026"
    if len(ano) == 2:
        ano = f"20{ano}"
    return f"{ano}-{mes}-{dia}"

def inferir_esfera(orgao: str) -> str:
    org = orgao.lower()
    if any(k in org for k in ['prefeitura', 'câmara', 'guarda municipal', 'municipal']):
        return 'Municipal'
    if any(k in org for k in ['pc', 'pm', 'polícia civil', 'polícia militar', 'sefaz', 'tj', 'estadual']):
        return 'Estadual'
    return 'Federal'

def processar_noticia_concurso(url_noticia: str):
    print(f"\nAcessando página detalhada: {url_noticia}")
    res = requests.get(url_noticia, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        return None

    soup = BeautifulSoup(res.text, "html.parser")
    texto_total = soup.get_text(" ", strip=True)

    # Identifica o link do PDF do edital
    pdf_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        txt = a.get_text(strip=True).lower()
        if ".pdf" in href.lower() or "edital" in txt:
            if "cloudfront.net" in href or ".pdf" in href:
                pdf_url = href
                break

    # Extrações básicas da notícia
    banca = "A definir"
    if "Banca:" in texto_total:
        banca = texto_total.split("Banca:")[-1].split("Vagas:")[0].split("\n")[0].strip()

    vagas = 1
    if "Vagas:" in texto_total:
        vagas = limpar_vagas(texto_total.split("Vagas:")[-1].split("Salário")[0])

    salario = 0.0
    if "Salários:" in texto_total or "Salário:" in texto_total:
        bloco_sal = texto_total.split("Salário")[-1].split("Edital")[0]
        salario = limpar_salario(bloco_sal)

    data_prova = None
    if "Data da prova:" in texto_total:
        bloco_dt = texto_total.split("Data da prova:")[-1].split("\n")[0][:40]
        data_prova = normalizar_data(bloco_dt)

    return {
        "banca": banca[:80],
        "vagas": vagas,
        "salario": salario,
        "data_prova": data_prova,
        "pdf_url": pdf_url
    }

def executar_varredura():
    url_base = "https://concursos.estrategia.com/portal/concursos-abertos/"
    print(f"1. Acessando portal de editais abertos: {url_base}")
    
    res = requests.get(url_base, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        print(f"Erro ao acessar {url_base}: {res.status_code}")
        return

    soup = BeautifulSoup(res.text, "html.parser")
    
    # Coleta links de notícias dos concursos
    concursos_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/portal/concurso-" in href and href not in concursos_links:
            # Ex: https://concursos.estrategia.com/portal/concurso-pc-pe/
            concursos_links.append(href)

    print(f"Total de concursos identificados para verificar: {len(concursos_links)}")

    editais_inseridos = 0
    # Processa até 3 editais novos por rodada para não estourar o limite de tempo do GitHub Actions
    for link_noticia in concursos_links:
        if editais_inseridos >= 3:
            print("Limite da rodada atingido (3 novos editais). Encerrando.")
            break

        # Extrai o nome do concurso pelo slug da URL
        slug_nome = link_noticia.rstrip("/").split("/")[-1].replace("concurso-", "")
        orgao = slug_nome.replace("-", " ").upper()

        # Checa se já existe no Supabase
        check = supabase.table("editais").select("id").ilike("orgao", f"%{orgao[:15]}%").execute()
        if check.data and len(check.data) > 0:
            continue

        print(f"\n==========================================")
        print(f"Processando novo concurso: {orgao}")
        
        dados = processar_noticia_concurso(link_noticia)
        if not dados:
            continue

        materias = []
        temp_pdf = "temp_edital.pdf"

        # Se encontrou o link direto do PDF, baixa e extrai o conteúdo programático
        if dados["pdf_url"]:
            print(f"Baixando PDF oficial: {dados['pdf_url']}")
            try:
                res_pdf = requests.get(dados["pdf_url"], headers=HEADERS, timeout=60)
                if res_pdf.status_code == 200 and len(res_pdf.content) > 5000:
                    with open(temp_pdf, "wb") as f:
                        f.write(res_pdf.content)
                    
                    # Extrai o conteúdo programático usando Gemini
                    materias = extrair_conteudo_gemini(temp_pdf, cargo="Geral")
            except Exception as e:
                print(f"Não foi possível processar o PDF com Gemini: {e}")
            finally:
                if os.path.exists(temp_pdf):
                    os.remove(temp_pdf)

        payload = {
            "titulo": f"Concurso {orgao} - 2026",
            "orgao": orgao[:120],
            "banca": dados["banca"],
            "vagas": dados["vagas"],
            "salario_maximo": dados["salario"],
            "escolaridade": "Superior / Médio",
            "link_origem": link_noticia,
            "cargo": "Geral",
            "esfera": inferir_esfera(orgao),
            "status": "Edital Publicado",
            "data_prova": dados["data_prova"],
            "observacoes": f"Importado automaticamente do Estratégia. Edital: {dados['pdf_url'] or 'Ver notícia'}",
            "materias": materias
        }

        try:
            supabase.table("editais").insert(payload).execute()
            print(f"SUCESSO: '{orgao}' inserido com {len(materias)} matérias!")
            editais_inseridos += 1
            time.sleep(2)
        except Exception as e:
            print(f"Erro ao salvar no Supabase: {e}")

if __name__ == "__main__":
    executar_varredura()
