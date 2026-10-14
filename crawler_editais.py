import argparse
import json
import os
import re
import sys
import tempfile
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field
from supabase import Client, create_client


# ============================================================
# CONFIGURAÇÃO DE AMBIENTE
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

ESTRATEGIA_URL = os.getenv(
    "ESTRATEGIA_URL",
    "https://concursos.estrategia.com/portal/concursos-abertos/",
)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "1"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "35"))
PDF_TIMEOUT = int(os.getenv("PDF_TIMEOUT", "90"))
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "2"))

HEADERS_PADRAO = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Erro: Defina SUPABASE_URL e SUPABASE_SERVICE_KEY nos Secrets do GitHub.")

if not GEMINI_API_KEY:
    raise RuntimeError("Erro: Defina GEMINI_API_KEY nos Secrets do GitHub.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
gemini = genai.Client(api_key=GEMINI_API_KEY)

TEM_CURL_CFFI = False
try:
    from curl_cffi import requests as _http_chrome
    sessao = _http_chrome.Session(impersonate="chrome124")
    TEM_CURL_CFFI = True
    print("🌐 Sessão com curl_cffi ativa (anti-bloqueio 403 habilitado).")
except ImportError:
    sessao = requests.Session()
    sessao.headers.update(HEADERS_PADRAO)
    print("⚠️ Usando biblioteca requests padrão.")


# ============================================================
# SCHEMA DE CONTEÚDO PROGRAMÁTICO (GEMINI)
# ============================================================

class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome: str = Field(description="Nome formal da matéria (ex: Língua Portuguesa, Direito Constitucional).")
    peso: float | None = Field(default=1.0)
    topicos: list[str] = Field(default_factory=list, description="Lista detalhada dos tópicos e subtópicos da matéria.")


class MateriasLista(BaseModel):
    model_config = ConfigDict(extra="ignore")
    materias: list[Materia] = Field(default_factory=list)


# ============================================================
# TRATAMENTO E NORMALIZAÇÃO DE DADOS
# ============================================================

def normalizar_texto(texto: str | None) -> str:
    if not texto:
        return ""
    texto = texto.replace("\xa0", " ")
    return re.sub(r"\s+", " ", texto).strip()


def parse_json_resposta(texto: str):
    texto = (texto or "").strip()
    if texto.startswith("```"):
        texto = re.sub(r"^```(?:json)?\s*", "", texto, flags=re.IGNORECASE)
        texto = re.sub(r"\s*```$", "", texto)
    return json.loads(texto)


def limpar_vagas(valor) -> int:
    if not valor:
        return 0
    match = re.search(r"\d+", str(valor).replace(".", ""))
    return int(match.group(0)) if match else 0


def limpar_salario(valor) -> float:
    if not valor:
        return 0.0
    texto = str(valor)
    valores = re.findall(r"R\$\s*([\d\.,]+)", texto)
    if not valores:
        valores = re.findall(r"[\d\.,]+", texto)[:1]

    for item in valores:
        try:
            return float(item.replace(".", "").replace(",", "."))
        except (ValueError, TypeError):
            continue
    return 0.0


def normalizar_data(texto: str | None) -> str | None:
    if not texto:
        return None

    texto = texto.lower().strip()
    match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", texto)
    if match:
        return match.group(0)

    meses = {
        "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03",
        "abril": "04", "maio": "05", "junho": "06", "julho": "07",
        "agosto": "08", "setembro": "09", "outubro": "10",
        "novembro": "11", "dezembro": "12",
    }

    match = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", texto)
    if match:
        dia, mes, ano = match.groups()
        return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"

    match = re.search(r"\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b", texto)
    if match:
        dia, mes_texto, ano = match.groups()
        mes = meses.get(mes_texto)
        if mes:
            return f"{ano}-{mes}-{dia.zfill(2)}"

    return None


def identificar_esfera(orgao: str) -> str:
    texto = normalizar_texto(orgao).lower()
    if any(t in texto for t in ("prefeitura", "câmara municipal", "camara municipal", "guarda municipal", "municipal")):
        return "Municipal"
    if any(t in texto for t in ("estadual", "polícia militar", "policia civil", "sefaz", "governo do estado", "tjr", "sp", "al", "mg")):
        return "Estadual"
    return "Federal"


# ============================================================
# EXTRAÇÃO VIA HTML PURO (SEM CUSTO DE API)
# ============================================================

def extrair_dados_html(soup: BeautifulSoup, url: str) -> dict:
    texto_completo = soup.get_text("\n", strip=True)

    # 1. Órgão extraído pelo título da página
    titulo_tag = soup.select_one("h1.entry-title, h1.elementor-heading-title, h1")
    titulo_raw = normalizar_texto(titulo_tag.get_text() if titulo_tag else "")
    
    orgao_match = re.search(r"Concurso\s+([^:\–\-]+)", titulo_raw, re.IGNORECASE)
    orgao = orgao_match.group(1).strip() if orgao_match else (titulo_raw[:60] or "Órgão Público")

    banca = None
    vagas = None
    salario = None
    escolaridade = None
    data_prova = None
    cargos_extraidos = []

    # 2. Busca linhas-chave na notícia (Ficha técnica padrão do Estratégia)
    for linha in texto_completo.split("\n"):
        linha_norm = normalizar_texto(linha)
        linha_low = linha_norm.lower()

        if not banca and ("banca:" in linha_low or "banca organizadora:" in linha_low):
            banca = re.split(r"banca(?:\s+organizadora)?\s*:\s*", linha_norm, flags=re.IGNORECASE)[-1].strip()

        if not vagas and ("vagas:" in linha_low or "vagas imediatas:" in linha_low):
            vagas = limpar_vagas(linha_norm)

        if not salario and ("salário inicial:" in linha_low or "remuneração:" in linha_low or "salário:" in linha_low):
            salario = limpar_salario(linha_norm)

        if not escolaridade and "escolaridade:" in linha_low:
            escolaridade = re.split(r"escolaridade\s*:\s*", linha_norm, flags=re.IGNORECASE)[-1].strip()

        if not data_prova and ("data da prova:" in linha_low or "provas em:" in linha_low or "data de prova:" in linha_low):
            data_raw = re.split(r"(?:data da prova|provas em|data de prova)\s*:\s*", linha_norm, flags=re.IGNORECASE)[-1].strip()
            data_prova = normalizar_data(data_raw)

    # 3. Extração dos cargos se houver tabela no artigo
    for table in soup.find_all("table"):
        headers = [normalizar_texto(th.get_text()).lower() for th in table.find_all(["th", "td"])]
        if any("cargo" in h or "especialidade" in h or "área" in h for h in headers[:5]):
            for row in table.find_all("tr")[1:]:
                cols = [normalizar_texto(td.get_text()) for td in row.find_all("td")]
                if cols and len(cols) >= 2:
                    nome_c = cols[0]
                    if nome_c.lower() not in ("total", "cargos", "área", "área de conhecimento"):
                        cargos_extraidos.append(nome_c)

    # Fallback caso não haja tabela
    if not cargos_extraidos:
        cargo_match = re.search(r"Cargo:\s*([^.\n]+)", texto_completo, re.IGNORECASE)
        if cargo_match:
            cargos_extraidos.append(normalizar_texto(cargo_match.group(1)))
        else:
            cargos_extraidos.append("Geral")

    return {
        "orgao": orgao,
        "banca": banca or "A definir",
        "esfera": identificar_esfera(orgao),
        "vagas": vagas or 0,
        "salario": salario or 0.0,
        "escolaridade": escolaridade or "Ensino Superior",
        "data_prova": data_prova,
        "cargos": list(dict.fromkeys(cargos_extraidos)),
    }


# ============================================================
# CHAMADA ÚNICA AO GEMINI PARA MATÉRIAS
# ============================================================

def extrair_materias_com_ia(pdf_path: str, texto_noticia: str) -> list[dict]:
    prompt = """
Você é um extrator de conteúdo programático de concurso público.
Identifique no edital (ou no texto) todas as DISCIPLINAS cobradas e seus tópicos.
Retorne um JSON estrito conforme o schema:
- 'nome': Nome da matéria
- 'peso': Peso (padrão 1.0)
- 'topicos': Lista de tópicos específicos da matéria
Se não houver matérias explicitadas, retorne {"materias": []}.
"""
    arquivo_gemini = None
    try:
        if pdf_path and os.path.exists(pdf_path):
            arquivo_gemini = gemini.files.upload(
                file=pdf_path,
                config={"mime_type": "application/pdf"},
            )
            for _ in range(40):
                if getattr(arquivo_gemini.state, "name", str(arquivo_gemini.state)) == "ACTIVE":
                    break
                time.sleep(2)
                arquivo_gemini = gemini.files.get(name=arquivo_gemini.name)

        contents = [arquivo_gemini, prompt] if arquivo_gemini else [texto_noticia[:20000], prompt]

        resposta = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=MateriasLista,
                max_output_tokens=32768,
            ),
        )
        dados = parse_json_resposta(resposta.text)
        materias_parseadas = MateriasLista.model_validate(dados).materias

        resultado = []
        for m in materias_parseadas:
            if m.nome.strip():
                resultado.append({
                    "nome": m.nome.strip(),
                    "peso": m.peso or 1.0,
                    "topicos": [t.strip() for t in m.topicos if t and t.strip()],
                })
        return resultado

    except Exception as exc:
        print(f"⚠️ Aviso na extração de matérias: {str(exc)[:120]}")
        return []
    finally:
        if arquivo_gemini:
            try:
                gemini.files.delete(name=arquivo_gemini.name)
            except Exception:
                pass


# ============================================================
# DOWNLOADS E CONEXÕES HTTP
# ============================================================

def baixar_pagina(url: str):
    if TEM_CURL_CFFI:
        resp = sessao.get(url, headers=HEADERS_PADRAO, timeout=REQUEST_TIMEOUT, impersonate="chrome124")
    else:
        resp = sessao.get(url, headers=HEADERS_PADRAO, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp


def obter_link_pdf(soup: BeautifulSoup, url_base: str) -> str | None:
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        texto = a.get_text(" ", strip=True).lower()
        href_l = href.lower()

        if any(ignorar in href_l for ignorar in ("termos-de-uso", "privacidade", "contrato", "manual")):
            continue

        if ".pdf" in href_l and ("edital" in href_l or "edital" in texto):
            return urljoin(url_base, href)
    return None


def baixar_pdf(pdf_url: str) -> str | None:
    try:
        if TEM_CURL_CFFI:
            resp = sessao.get(pdf_url, headers=HEADERS_PADRAO, timeout=PDF_TIMEOUT, impersonate="chrome124", allow_redirects=True)
        else:
            resp = sessao.get(pdf_url, timeout=PDF_TIMEOUT, allow_redirects=True)

        resp.raise_for_status()
        if not resp.content[:1024].lstrip().startswith(b"%PDF"):
            return None

        arq = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        arq.write(resp.content)
        arq.close()
        print(f"✓ PDF baixado ({len(resp.content)/1024:.1f} KB)")
        return arq.name
    except Exception as exc:
        print(f"⚠️ Erro ao descarregar PDF: {exc}")
        return None


# ============================================================
# PERSISTÊNCIA NO SUPABASE
# ============================================================

def salvar_no_banco(payload: dict, materias: list[dict]):
    orgao = payload["orgao"]
    cargo = payload["cargo"]

    try:
        resp = (
            supabase.table("editais")
            .select("id, materias")
            .ilike("orgao", f"%{orgao[:50]}%")
            .ilike("cargo", f"%{cargo[:50]}%")
            .limit(1)
            .execute()
        )

        if resp.data:
            edital_id = resp.data[0]["id"]
            update_data = {k: v for k, v in payload.items() if v not in (None, "", 0)}
            if materias:
                update_data["materias"] = materias
            supabase.table("editais").update(update_data).eq("id", edital_id).execute()
            print(f"🔄 Atualizado no Supabase: {orgao} -> {cargo}")
        else:
            supabase.table("editais").insert({**payload, "materias": materias}).execute()
            print(f"🆕 Inserido no Supabase: {orgao} -> {cargo} ({len(materias)} matérias)")

    except Exception as exc:
        print(f"❌ Erro ao persistir no Supabase: {exc}")


# ============================================================
# EXECUÇÃO DO CONCURSO
# ============================================================

def processar_concurso(url_noticia: str):
    print("\n" + "=" * 80)
    print(f"🌐 Processando: {url_noticia}")
    print("=" * 80)

    try:
        resp = baixar_pagina(url_noticia)
    except Exception as exc:
        print(f"❌ Falha ao carregar notícia: {exc}")
        return

    soup = BeautifulSoup(resp.text, "html.parser")
    
    dados = extrair_dados_html(soup, url_noticia)
    print(f"✓ Órgão: {dados['orgao']}")
    print(f"✓ Banca: {dados['banca']} | Vagas: {dados['vagas']} | Salário: R$ {dados['salario']} | Prova: {dados['data_prova']}")
    print(f"✓ Cargos: {dados['cargos']}")

    pdf_url = obter_link_pdf(soup, url_noticia)
    pdf_path = baixar_pdf(pdf_url) if pdf_url else None

    texto_artigo = normalizar_texto(soup.get_text(" ", strip=True))
    materias = extrair_materias_com_ia(pdf_path, texto_artigo)
    print(f"✓ Conteúdo Programático: {len(materias)} matérias identificadas.")

    for cargo_nome in dados["cargos"]:
        payload = {
            "titulo": f"{dados['orgao']} - {cargo_nome}",
            "orgao": dados["orgao"][:255],
            "banca": dados["banca"][:100],
            "vagas": dados["vagas"],
            "salario_maximo": dados["salario"],
            "escolaridade": dados["escolaridade"][:100],
            "link_origem": url_noticia,
            "cargo": cargo_nome[:255],
            "esfera": dados["esfera"][:50],
            "status": "Edital Publicado",
            "data_prova": dados["data_prova"],
            "observacoes": f"Edital: {pdf_url}" if pdf_url else "Ver notícia",
        }
        salvar_no_banco(payload, materias)

    if pdf_path and os.path.exists(pdf_path):
        try:
            os.remove(pdf_path)
        except OSError:
            pass


def listar_links() -> list[str]:
    resp = baixar_pagina(ESTRATEGIA_URL)
    soup = BeautifulSoup(resp.text, "html.parser")
    links = set()

    for a in soup.find_all("a", href=True):
        href = urljoin(ESTRATEGIA_URL, a["href"]).split("#")[0].split("?")[0].rstrip("/")
        if any(p in href for p in ("/portal/concurso-", "/portal/edital-")) and not any(ignorar in href for ignorar in ("concursos-abertos-", "noticias-")):
            links.add(href + "/")

    return sorted(links)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="crawl")
    args = parser.parse_args()

    links = listar_links()
    print(f"📋 Editais encontrados na listagem: {len(links)}")

    for link in links[:MAX_CONCURSOS]:
        processar_concurso(link)
        time.sleep(SLEEP_SECONDS)

    print("\n🏁 Execução concluída.")


if __name__ == "__main__":
    sys.exit(main())
