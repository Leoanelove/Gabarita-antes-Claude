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

if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("Chaves secretas faltando nas variáveis de ambiente.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configura o Gemini se a chave existir
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def obter_modelo_gemini():
    """Tenta instanciar o modelo com os identificadores compatíveis."""
    nomes_modelos = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro"]
    for nome in nomes_modelos:
        try:
            return genai.GenerativeModel(model_name=nome)
        except Exception:
            continue
    return None

def analisar_artigo_com_gemini(texto_artigo: str):
    """Extrai os dados estruturados do concurso usando IA com fallback para regex."""
    if not GEMINI_KEY:
        return None

    prompt = f"""
    Analise o texto deste artigo sobre concurso público e responda EXCLUSIVAMENTE com um JSON no seguinte formato:
    {{
      "orgao": "Nome oficial do órgão",
      "banca": "Banca organizadora",
      "esfera": "Federal ou Estadual ou Municipal",
      "data_prova": "YYYY-MM-DD ou null",
      "cargos": [
        {{
          "nome_cargo": "Nome do cargo",
          "vagas": 10,
          "salario": 5000.0,
          "escolaridade": "Superior ou Médio"
        }}
      ]
    }}

    TEXTO:
    {texto_artigo[:12000]}
    """

    for nome_modelo in ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"]:
        try:
            model = genai.GenerativeModel(
                model_name=nome_modelo,
                generation_config={"temperature": 0.1}
            )
            resp = model.generate_content(prompt)
            texto_limpo = resp.text.strip()
            # Remove blocos markdown caso o modelo retorne ```json ... ```
            if texto_limpo.startswith("```"):
                texto_limpo = re.sub(r"^```(?:json)?\s*", "", texto_limpo)
                texto_limpo = re.sub(r"\s*```$", "", texto_limpo)
            return json.loads(texto_limpo)
        except Exception as e:
            print(f"Tentativa com {nome_modelo} falhou: {e}")
            continue

    return None

def limpar_vagas(texto: str) -> int:
    nums = re.findall(r'\d+', texto.replace('.', ''))
    return int(nums[0]) if nums else 1

def limpar_salario(texto: str) -> float:
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
    if any(k in org for k in ['pc', 'pm', 'polícia civil', 'polícia militar', 'sefaz', 'tj', 'estadual', 'pe']):
        return 'Estadual'
    return 'Federal'

def extrair_materias_cargo(pdf_path: str, cargo: str):
    """Envia o PDF ao Gemini para extrair matérias, com proteção contra erros."""
    if not GEMINI_KEY:
        return []

    try:
        pdf_file = genai.upload_file(pdf_path, mime_type="application/pdf")
        for nome_modelo in ["gemini-1.5-flash-latest", "gemini-1.5-flash"]:
            try:
                model = genai.GenerativeModel(model_name=nome_modelo)
                prompt = f"""
                Analise o edital e extraia o conteúdo programático do cargo '{cargo}'.
                Responda estritamente com um array JSON:
                [
                  {{
                    "nome": "NOME DA DISCIPLINA",
                    "peso": 1,
                    "topicos": ["Topico 1", "Topico 2"]
                  }}
                ]
                """
                resp = model.generate_content([pdf_file, prompt])
                txt = resp.text.strip()
                if txt.startswith("```"):
                    txt = re.sub(r"^```(?:json)?\s*", "", txt)
                    txt = re.sub(r"\s*```$", "", txt)
                return json.loads(txt)
            except Exception:
                continue
    except Exception as e:
        print(f"Erro ao processar PDF via IA: {e}")
    return []

def processar_concurso(url_noticia: str):
    print(f"\nAcessando: {url_noticia}")
    res = requests.get(url_noticia, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        return 0

    soup = BeautifulSoup(res.text, "html.parser")
    
    # Busca link do PDF
    pdf_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        txt = a.get_text(strip=True).lower()
        if (".pdf" in href.lower() or "edital" in txt) and "cloudfront.net" in href:
            pdf_url = href
            break

    # Limpa tags desnecessárias
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    texto_artigo = soup.get_text(" ", strip=True)

    # 1. Tenta extrair com Gemini
    dados = analisar_artigo_com_gemini(texto_artigo)

    # 2. Se a IA falhar ou retornar vazio, faz extração heurística direta do HTML
    if not dados or not dados.get("cargos"):
        print("-> Usando fallback de extração direta do texto da página...")
        slug_raw = url_noticia.rstrip("/").split("/")[-1].replace("concurso-", "")
        orgao_nome = slug_raw.replace("-", " ").upper()

        banca = "A definir"
        if "Banca:" in texto_artigo:
            banca = texto_artigo.split("Banca:")[-1].split("Vagas:")[0].split("\n")[0].strip()

        vagas = 1
        if "Vagas:" in texto_artigo:
            vagas = limpar_vagas(texto_artigo.split("Vagas:")[-1].split("Salário")[0])

        salario = 0.0
        if "Salário" in texto_artigo:
            salario = limpar_salario(texto_artigo.split("Salário")[-1].split("Edital")[0])

        data_prova = None
        if "Data da prova:" in texto_artigo:
            data_prova = normalizar_data(texto_artigo.split("Data da prova:")[-1][:50])

        # Se for PM PE ou concurso policial, extrai cargos comuns
        cargos_extraidos = []
        if "soldado" in texto_artigo.lower():
            cargos_extraidos.append({"nome_cargo": "Soldado", "vagas": vagas, "salario": salario, "escolaridade": "Médio"})
        if "oficial" in texto_artigo.lower():
            cargos_extraidos.append({"nome_cargo": "Oficial", "vagas": 45, "salario": salario, "escolaridade": "Superior"})
        
        if not cargos_extraidos:
            cargos_extraidos.append({"nome_cargo": "Geral", "vagas": vagas, "salario": salario, "escolaridade": "Superior / Médio"})

        dados = {
            "orgao": orgao_nome,
            "banca": banca,
            "esfera": inferir_esfera(orgao_nome),
            "data_prova": data_prova,
            "cargos": cargos_extraidos
        }

    orgao = dados.get("orgao", "Órgão Público")
    banca = dados.get("banca", "A definir")
    esfera = dados.get("esfera", "Estadual")
    data_prova = dados.get("data_prova")
    cargos = dados.get("cargos", [])

    # Baixa PDF se disponível
    temp_pdf = "temp_edital.pdf"
    tem_pdf = False
    if pdf_url:
        try:
            r_pdf = requests.get(pdf_url, headers=HEADERS, timeout=60)
            if r_pdf.status_code == 200 and len(r_pdf.content) > 5000:
                with open(temp_pdf, "wb") as f:
                    f.write(r_pdf.content)
                tem_pdf = True
        except Exception as e:
            print(f"Erro ao baixar PDF: {e}")

    inseridos = 0
    for c in cargos:
        nome_cargo = c.get("nome_cargo", "Geral")
        vagas = int(c.get("vagas", 1))
        salario = float(c.get("salario", 0.0))
        escolaridade = c.get("escolaridade", "Superior / Médio")

        # Checa duplicidade
        check = supabase.table("editais")\
            .select("id")\
            .ilike("orgao", f"%{orgao[:15]}%")\
            .ilike("cargo", f"%{nome_cargo[:15]}%")\
            .execute()

        if check.data and len(check.data) > 0:
            print(f"Cargo '{nome_cargo}' já existe no Supabase. Pulando...")
            continue

        materias = []
        if tem_pdf:
            materias = extrair_materias_cargo(temp_pdf, nome_cargo)

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
            "observacoes": f"Edital: {pdf_url}" if pdf_url else "Ver notícia",
            "materias": materias
        }

        try:
            supabase.table("editais").insert(payload).execute()
            print(f"✓ Inserido: {orgao} -> {nome_cargo} | Vagas: {vagas} | R$ {salario}")
            inseridos += 1
        except Exception as e:
            print(f"Erro ao inserir no Supabase: {e}")

    if tem_pdf and os.path.exists(temp_pdf):
        os.remove(temp_pdf)

    return inseridos

def iniciar():
    url_base = "https://concursos.estrategia.com/portal/concursos-abertos/"
    print(f"Listando editais abertos em: {url_base}")
    res = requests.get(url_base, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        print(f"Erro ao acessar listagem: {res.status_code}")
        return

    soup = BeautifulSoup(res.text, "html.parser")
    links_concursos = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/portal/concurso-" in href and href not in links_concursos:
            links_concursos.append(href)

    print(f"Total de certames encontrados: {len(links_concursos)}")
    processados = 0
    for link in links_concursos:
        if processados >= 2:
            break
        
        slug = link.rstrip("/").split("/")[-1].replace("concurso-", "").replace("-", " ")
        check = supabase.table("editais").select("id").ilike("orgao", f"%{slug[:12]}%").execute()
        if check.data and len(check.data) > 0:
            continue

        qtd = processar_concurso(link)
        if qtd > 0:
            processados += 1
            time.sleep(2)

    print(f"Fim da rodada. Total de novos certames adicionados: {processados}")

if __name__ == "__main__":
    iniciar()
