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
# CONFIGURAÇÃO
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

ESTRATEGIA_URL = os.getenv(
    "ESTRATEGIA_URL",
    "https://concursos.estrategia.com/portal/concursos-abertos/",
)

# Modelos oficiais e válidos da API Gemini
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-1.5-flash")

MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "0"))  # 0 = sem limite
REPROCESS_LIMIT = int(os.getenv("REPROCESS_LIMIT", "0"))  # 0 = todos

REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "45"))
PDF_TIMEOUT = int(os.getenv("PDF_TIMEOUT", "120"))
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "2"))

HEADERS_PADRAO = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY.")

if not GEMINI_API_KEY:
    raise RuntimeError("Defina GEMINI_API_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
gemini = genai.Client(api_key=GEMINI_API_KEY)

# Configura sessão com curl_cffi para contornar o bloqueio antibot (403)
TEM_CURL_CFFI = False
try:
    from curl_cffi import requests as _http_chrome
    sessao = _http_chrome.Session(impersonate="chrome124")
    TEM_CURL_CFFI = True
    print("🌐 Usando curl_cffi (impersonando Chrome 124 com sucesso).")
except ImportError:
    sessao = requests.Session()
    sessao.headers.update(HEADERS_PADRAO)
    print("⚠️ curl_cffi não instalado; usando requests comum.")


# ============================================================
# MODELOS DE RESPOSTA DO GEMINI
# ============================================================

class Cargo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome_cargo: str = Field(description="Nome exato da carreira, cargo ou especialidade.")
    vagas: int | None = Field(
        default=None,
        description="Total de vagas numéricas (ampla + cotas + PcD) do cargo. 0 se apenas CR; null se não informado.",
    )
    salario: float | None = Field(
        default=None,
        description="Remuneração bruta inicial em reais (somente números, ex: 6500.50); null se não informado.",
    )
    escolaridade: str | None = Field(
        default=None,
        description="Escolaridade exigida (Fundamental, Médio, Técnico ou Superior); null se não informado.",
    )


class Concurso(BaseModel):
    model_config = ConfigDict(extra="ignore")

    orgao: str = Field(description="Nome do órgão, prefeitura ou instituição responsável.")
    banca: str | None = Field(default=None, description="Nome da banca examinadora realizadora.")
    esfera: str | None = Field(default=None, description="Federal, Estadual ou Municipal.")
    data_prova: str | None = Field(default=None, description="Data da prova objetiva no formato YYYY-MM-DD.")
    cargos: list[Cargo] = Field(default_factory=list, description="Lista com TODOS os cargos e especialidades identificados.")


class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome: str = Field(description="Nome da disciplina (ex: Língua Portuguesa, Direito Constitucional).")
    peso: float | None = Field(default=1.0, description="Peso da matéria caso informado no edital.")
    topicos: list[str] = Field(default_factory=list, description="Lista textual com os tópicos/assuntos programáticos.")


class MateriasResposta(BaseModel):
    model_config = ConfigDict(extra="ignore")

    materias: list[Materia] = Field(default_factory=list)


# ============================================================
# UTILITÁRIOS
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
    if valor is None or isinstance(valor, bool):
        return 0
    try:
        return int(valor)
    except (ValueError, TypeError):
        numeros = re.findall(r"\d+", str(valor).replace(".", ""))
        return int(numeros[0]) if numeros else 0


def limpar_salario(valor) -> float:
    if valor is None:
        return 0.0
    if isinstance(valor, (int, float)):
        return float(valor)

    texto = str(valor)
    valores = re.findall(r"R\$\s*([\d\.,]+)", texto)
    if not valores:
        valores = re.findall(r"[\d\.,]+", texto)[:1]

    salarios = []
    for item in valores:
        try:
            salarios.append(float(item.replace(".", "").replace(",", ".")))
        except (ValueError, TypeError):
            continue
    return max(salarios) if salarios else 0.0


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


def esfera_fallback(orgao: str) -> str:
    texto = normalizar_texto(orgao).lower()

    if any(t in texto for t in (
        "prefeitura", "câmara municipal", "camara municipal",
        "guarda municipal", "municipal", "daae", "saae",
    )):
        return "Municipal"

    if any(t in texto for t in (
        "estadual", "polícia militar", "policia militar",
        "polícia civil", "policia civil", "corpo de bombeiros",
        "bombeiros", "secretaria de estado", "governo do estado", "tjr",
        "pcerj", "pcsp", "pmesp", "pmmg",
    )):
        return "Estadual"

    return "Federal"


# ============================================================
# GEMINI
# ============================================================

def chamar_gemini(contents, schema, tentativas: int = 5):
    ultimo_erro = None
    modelos = [GEMINI_MODEL, GEMINI_MODEL] + [GEMINI_FALLBACK_MODEL] * 3

    for tentativa in range(tentativas):
        modelo = modelos[tentativa]
        try:
            resposta = gemini.models.generate_content(
                model=modelo,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                    response_schema=schema,
                    max_output_tokens=65536,
                ),
            )
            return parse_json_resposta(resposta.text)
        except Exception as exc:
            ultimo_erro = exc
            if tentativa < tentativas - 1:
                espera = min(10 * (tentativa + 1), 40)
                print(f"⚠️ Gemini ({modelo}) erro: {str(exc)[:100]}; aguardando {espera}s...")
                time.sleep(espera)

    raise ultimo_erro


def enviar_pdf_gemini(pdf_path: str):
    arquivo = gemini.files.upload(
        file=pdf_path,
        config={"mime_type": "application/pdf"},
    )

    for _ in range(60):
        estado = getattr(arquivo.state, "name", str(arquivo.state))
        if arquivo.state is None or estado == "ACTIVE":
            return arquivo
        if estado == "FAILED":
            raise RuntimeError("Gemini falhou ao indexar o PDF.")
        time.sleep(2)
        arquivo = gemini.files.get(name=arquivo.name)

    raise TimeoutError("Tempo excedido aguardando ativação do PDF no Gemini.")


def analisar_edital(texto_artigo: str, arquivo_gemini=None) -> Concurso | None:
    prompt = f"""
Você é um especialista em análise de editais de concursos públicos no Brasil.
Fontes: o EDITAL em PDF (se anexado) e o texto da notícia abaixo.

Extraia as seguintes informações obrigatórias:
1. 'orgao': Nome oficial do órgão.
2. 'banca': Nome da instituição organizadora (ex: Cebraspe, FGV, FCC, Vunesp, etc.).
3. 'esfera': Federal, Estadual ou Municipal.
4. 'data_prova': Data da prova objetiva no formato YYYY-MM-DD (se inexistente, null).
5. 'cargos': Liste CADA um dos cargos e especialidades como um elemento separado.
   - Para cada cargo:
     - 'nome_cargo': Denominação exata do cargo/função.
     - 'vagas': Total de vagas imediatas + PcD + cotas (0 se for apenas CR).
     - 'salario': Vencimento inicial (apenas número decimal, ex: 5410.20).
     - 'escolaridade': Fundamental, Médio, Técnico ou Superior.
   - IMPORTANTE: Não agrupe múltiplos cargos em uma linha só.
   - Não use o total geral de vagas do concurso no cargo se houver divisão por área.

TEXTO DA NOTÍCIA:
{texto_artigo[:25000]}
"""

    contents = [arquivo_gemini, prompt] if arquivo_gemini else prompt

    try:
        dados = chamar_gemini(contents, Concurso)
        return Concurso.model_validate(dados)
    except Exception as exc:
        print(f"⚠️ Falha ao analisar concurso com Gemini: {exc}")
        return None


def extrair_materias_cargo(cargo: str, arquivo_gemini) -> list[dict]:
    print(f"🧠 Extraindo conteúdo programático: {cargo}")

    prompt = f"""
Analise o edital em PDF anexado.

TAREFA:
Extraia a grade de conteúdo programático para o cargo específico:
"{cargo}"

REGRAS:
1. Busque no Anexo de Conteúdo Programático do edital.
2. Agrupe tanto os conteúdos de Conhecimentos Básicos/Gerais quanto os Conhecimentos Específicos que se aplicam a este cargo.
3. Não resuma: preserve os tópicos como redigidos no edital.
4. Cada disciplina é um objeto em 'materias'.
5. Cada assunto/ponto da disciplina é um item na lista 'topicos'.
6. Se não houver disciplinas identificadas para esse cargo, retorne {{"materias": []}}.
"""

    try:
        dados = chamar_gemini([arquivo_gemini, prompt], MateriasResposta)
        resposta = MateriasResposta.model_validate(dados)

        materias = []
        for item in resposta.materias:
            nome = item.nome.strip()
            if not nome:
                continue
            topicos = [t.strip() for t in item.topicos if t and t.strip()]
            materias.append({
                "nome": nome,
                "peso": item.peso if item.peso is not None else 1.0,
                "topicos": topicos,
            })

        print(f"✓ {len(materias)} matérias obtidas para '{cargo}'")
        return materias

    except Exception as exc:
        print(f"❌ Erro ao extrair disciplinas de '{cargo}': {exc}")
        return []


# ============================================================
# HTTP / DOWNLOAD DE PÁGINAS E PDF
# ============================================================

def baixar_pagina(url: str):
    if TEM_CURL_CFFI:
        resposta = sessao.get(
            url,
            headers=HEADERS_PADRAO,
            timeout=REQUEST_TIMEOUT,
            impersonate="chrome124",
        )
    else:
        resposta = sessao.get(url, headers=HEADERS_PADRAO, timeout=REQUEST_TIMEOUT)

    resposta.raise_for_status()
    return resposta


def encontrar_pdfs(soup: BeautifulSoup, url_base: str) -> list[str]:
    candidatos = {}

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith(("#", "mailto:", "javascript:")):
            continue

        texto = normalizar_texto(a.get_text(" ", strip=True)).lower()
        url = urljoin(url_base, href)
        href_lower = href.lower()

        pontuacao = 0
        if ".pdf" in href_lower:
            pontuacao += 30
        if any(t in texto for t in ("edital de abertura", "edital publicado", "íntegra do edital", "baixe o edital")):
            pontuacao += 25
        elif "edital" in texto:
            pontuacao += 15
        if "edital" in href_lower:
            pontuacao += 10

        if any(t in texto for t in ("resultado", "gabarito", "homologação", "convocação", "recurso", "cronograma")):
            pontuacao -= 20

        if pontuacao > 0:
            candidatos[url] = max(pontuacao, candidatos.get(url, 0))

    ordenados = sorted(candidatos.items(), key=lambda i: i[1], reverse=True)
    return [url for url, _ in ordenados]


def baixar_pdf(pdf_url: str) -> str | None:
    try:
        if TEM_CURL_CFFI:
            resposta = sessao.get(
                pdf_url,
                headers=HEADERS_PADRAO,
                timeout=PDF_TIMEOUT,
                impersonate="chrome124",
                allow_redirects=True,
            )
        else:
            resposta = sessao.get(pdf_url, timeout=PDF_TIMEOUT, allow_redirects=True)

        resposta.raise_for_status()

        conteudo = resposta.content
        if not conteudo[:1024].lstrip().startswith(b"%PDF"):
            return None

        if len(conteudo) < 5000:
            return None

        arquivo = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        arquivo.write(conteudo)
        arquivo.close()

        print(f"✓ PDF baixado ({len(conteudo) / 1024:.1f} KB): {pdf_url[:80]}")
        return arquivo.name

    except Exception as exc:
        print(f"⚠️ Erro ao baixar PDF ({pdf_url[:60]}): {exc}")
        return None


def obter_pdf(soup: BeautifulSoup, url_base: str):
    for pdf_url in encontrar_pdfs(soup, url_base)[:6]:
        print(f"📄 Testando link de PDF: {pdf_url}")
        pdf_path = baixar_pdf(pdf_url)
        if pdf_path:
            return pdf_url, pdf_path
    return None, None


# ============================================================
# BANCO DE DADOS (SUPABASE)
# ============================================================

def materias_validas(materias) -> bool:
    return isinstance(materias, list) and len(materias) > 0


def buscar_edital_existente(orgao: str, cargo: str):
    try:
        resposta = (
            supabase.table("editais")
            .select("id,orgao,cargo,materias")
            .ilike("orgao", f"%{orgao[:60]}%")
            .limit(500)
            .execute()
        )

        alvo_cargo = normalizar_texto(cargo).casefold()
        alvo_orgao = normalizar_texto(orgao).casefold()

        for item in resposta.data or []:
            cargo_banco = normalizar_texto(item.get("cargo")).casefold()
            orgao_banco = normalizar_texto(item.get("orgao")).casefold()

            if cargo_banco == alvo_cargo and (orgao_banco == alvo_orgao or alvo_orgao in orgao_banco):
                return item

        return None
    except Exception as exc:
        print(f"⚠️ Erro ao consultar Supabase: {exc}")
        return None


def salvar_ou_atualizar(payload: dict, orgao: str, cargo: str, materias: list[dict]) -> str:
    existente = buscar_edital_existente(orgao, cargo)

    if existente:
        edital_id = existente["id"]
        antigas = existente.get("materias")

        update_payload = {
            k: v for k, v in payload.items() if v not in (None, "", 0)
        }

        if materias_validas(materias):
            update_payload["materias"] = materias
        elif materias_validas(antigas):
            print(f"↪ {cargo}: preservando matérias cadastradas previamente.")

        supabase.table("editais").update(update_payload).eq("id", edital_id).execute()
        print(f"🔄 Atualizado: {orgao} -> {cargo}")
        return "atualizado"

    if not materias_validas(materias):
        print(f"⚠️ Inserindo '{cargo}' sem matérias (pendente de reprocessamento).")

    supabase.table("editais").insert({**payload, "materias": materias}).execute()
    print(f"🆕 Inserido: {orgao} -> {cargo} ({len(materias)} matérias)")
    return "inserido"


def listar_editais_para_reprocessar():
    resultados = []
    page_size = 1000
    inicio = 0

    while True:
        resposta = (
            supabase.table("editais")
            .select("id,orgao,cargo,materias,observacoes,link_origem")
            .range(inicio, inicio + page_size - 1)
            .execute()
        )
        pagina = resposta.data or []
        if not pagina:
            break

        for item in pagina:
            if not materias_validas(item.get("materias")):
                resultados.append(item)

        if len(pagina) < page_size:
            break
        inicio += page_size

    if REPROCESS_LIMIT > 0:
        resultados = resultados[:REPROCESS_LIMIT]

    return resultados


# ============================================================
# FLUXO DE EXECUÇÃO
# ============================================================

def processar_concurso(url_noticia: str) -> int:
    print("\n" + "=" * 80)
    print(f"🌐 Processando: {url_noticia}")
    print("=" * 80)

    try:
        resposta = baixar_pagina(url_noticia)
    except Exception as exc:
        print(f"❌ Falha ao acessar notícia ({url_noticia}): {exc}")
        return 0

    soup = BeautifulSoup(resposta.text, "html.parser")

    soup_texto = BeautifulSoup(resposta.text, "html.parser")
    for tag in soup_texto(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    texto_artigo = normalizar_texto(soup_texto.get_text(" ", strip=True))

    pdf_url, pdf_path = obter_pdf(soup, url_noticia)
    arquivo_gemini = None
    alterados = 0

    try:
        if pdf_path:
            try:
                arquivo_gemini = enviar_pdf_gemini(pdf_path)
                print("✓ PDF enviado e ativado no Gemini.")
            except Exception as exc:
                print(f"❌ Falha ao enviar PDF para o Gemini: {exc}")

        dados = analisar_edital(texto_artigo, arquivo_gemini)
        if (not dados or not dados.cargos) and arquivo_gemini:
            print("⚠️ Re-tentando análise apenas com o texto da notícia...")
            dados = analisar_edital(texto_artigo, None)

        if not dados or not dados.cargos:
            print("❌ Nenhum cargo identificado.")
            return 0

        print(f"✓ {len(dados.cargos)} cargos estruturados pelo Gemini.")

        orgao = normalizar_texto(dados.orgao) or "Órgão Público"
        banca = normalizar_texto(dados.banca) or "A definir"
        esfera = normalizar_texto(dados.esfera) or esfera_fallback(orgao)
        data_prova = normalizar_data(dados.data_prova)

        vistos = set()

        for cargo in dados.cargos:
            nome_cargo = normalizar_texto(cargo.nome_cargo)
            if not nome_cargo or nome_cargo.casefold() in vistos:
                continue
            vistos.add(nome_cargo.casefold())

            materias = []
            if arquivo_gemini:
                materias = extrair_materias_cargo(nome_cargo, arquivo_gemini)

            payload = {
                "titulo": f"{orgao} - {nome_cargo}",
                "orgao": orgao[:255],
                "banca": banca[:100],
                "vagas": limpar_vagas(cargo.vagas),
                "salario_maximo": limpar_salario(cargo.salario),
                "escolaridade": normalizar_texto(cargo.escolaridade)[:100],
                "link_origem": url_noticia,
                "cargo": nome_cargo[:255],
                "esfera": esfera[:50],
                "status": "Edital Publicado",
                "data_prova": data_prova,
                "observacoes": f"Edital: {pdf_url}" if pdf_url else "Ver notícia",
            }

            try:
                status = salvar_ou_atualizar(payload, orgao, nome_cargo, materias)
                if status in ("inserido", "atualizado"):
                    alterados += 1
            except Exception as exc:
                print(f"❌ Erro ao salvar cargo '{nome_cargo}': {exc}")

            time.sleep(SLEEP_SECONDS)

    finally:
        if arquivo_gemini:
            try:
                gemini.files.delete(name=arquivo_gemini.name)
            except Exception:
                pass
        if pdf_path and os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except OSError:
                pass

    return alterados


def extrair_pdf_da_observacao(observacoes: str | None) -> str | None:
    if not observacoes:
        return None
    match = re.search(r"https?://\S+?\.pdf(?:\?\S*)?", observacoes, flags=re.IGNORECASE)
    return match.group(0).rstrip(").,;") if match else None


def descobrir_pdf_do_registro(item: dict):
    pdf_url = extrair_pdf_da_observacao(item.get("observacoes"))
    if pdf_url:
        path = baixar_pdf(pdf_url)
        if path:
            return pdf_url, path

    link_origem = item.get("link_origem")
    if link_origem:
        try:
            soup = BeautifulSoup(baixar_pagina(link_origem).text, "html.parser")
            return obter_pdf(soup, link_origem)
        except Exception as exc:
            print(f"⚠️ Erro ao buscar PDF pela página original: {exc}")

    return None, None


def reprocessar_materias():
    registros = listar_editais_para_reprocessar()
    print(f"♻️ Total de registros pendentes de matérias: {len(registros)}")

    grupos: dict[str, list[dict]] = {}
    for item in registros:
        chave = item.get("link_origem") or f"id-{item['id']}"
        grupos.setdefault(chave, []).append(item)

    sucesso = 0

    for itens in grupos.values():
        pdf_url, pdf_path = descobrir_pdf_do_registro(itens[0])
        if not pdf_path:
            print(f"❌ PDF inacessível para o órgão: {itens[0].get('orgao')}")
            continue

        arquivo_gemini = None
        try:
            arquivo_gemini = enviar_pdf_gemini(pdf_path)

            for item in itens:
                cargo = normalizar_texto(item.get("cargo"))
                print(f"♻️ Processando ID {item['id']}: {item.get('orgao')} -> {cargo}")

                materias = extrair_materias_cargo(cargo, arquivo_gemini)
                if not materias:
                    print("⚠️ Disciplinas não identificadas no edital.")
                    continue

                supabase.table("editais").update({
                    "materias": materias,
                    "observacoes": f"Edital: {pdf_url}" if pdf_url else item.get("observacoes"),
                }).eq("id", item["id"]).execute()

                print(f"✅ ID {item['id']} atualizado com {len(materias)} matérias.")
                sucesso += 1
                time.sleep(SLEEP_SECONDS)

        except Exception as exc:
            print(f"❌ Erro durante o reprocessamento do grupo: {exc}")
        finally:
            if arquivo_gemini:
                try:
                    gemini.files.delete(name=arquivo_gemini.name)
                except Exception:
                    pass
            if pdf_path and os.path.exists(pdf_path):
                try:
                    os.remove(pdf_path)
                except OSError:
                    pass

    print(f"\n🏁 Reprocessamento concluído: {sucesso}/{len(registros)} registros finalizados.")


def listar_links_concursos() -> list[str]:
    resposta = baixar_pagina(ESTRATEGIA_URL)
    soup = BeautifulSoup(resposta.text, "html.parser")

    links = set()
    url_base_limpa = ESTRATEGIA_URL.split("?")[0].rstrip("/")

    # Estratégia 1: Padrões de links de editais abertos
    for a in soup.find_all("a", href=True):
        href = urljoin(ESTRATEGIA_URL, a["href"]).strip()
        href_limpa = href.split("#")[0].split("?")[0].rstrip("/")

        if href_limpa == url_base_limpa:
            continue

        if any(p in href_limpa for p in [
            "/portal/concurso-",
            "/portal/concursos-",
            "/portal/concurso/",
            "/portal/edital-",
        ]):
            links.add(href_limpa + "/")

    # Estratégia 2: Fallback selecionando títulos de artigos da página
    if not links:
        seletores = [
            "article a[href]",
            ".entry-title a[href]",
            ".elementor-post__title a[href]",
            ".wp-block-post-title a[href]",
        ]
        for seletor in seletores:
            for el in soup.select(seletor):
                link = urljoin(ESTRATEGIA_URL, el["href"]).strip()
                link_limpo = link.split("#")[0].split("?")[0].rstrip("/")
                if "/portal/" in link_limpo and link_limpo != url_base_limpa:
                    links.add(link_limpo + "/")

    return sorted(links)


def crawler_novos():
    try:
        links = listar_links_concursos()
    except Exception as exc:
        print(f"❌ Falha ao obter listagem de concursos: {exc}")
        return 1

    print(f"📋 Concursos encontrados na listagem: {len(links)}")

    processados = 0
    alterados = 0

    for link in links:
        if MAX_CONCURSOS > 0 and processados >= MAX_CONCURSOS:
            break
        try:
            alterados += processar_concurso(link)
            processados += 1
        except Exception as exc:
            print(f"❌ Erro ao processar concurso ({link}): {exc}")
        time.sleep(SLEEP_SECONDS)

    print(
        f"\n🏁 Varredura concluída. Artigos processados: {processados}. "
        f"Cargos inseridos/atualizados: {alterados}."
    )
    return 0


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Robô de Editais - Gabarita PRO"
    )
    parser.add_argument(
        "--mode",
        choices=("crawl", "reprocessar-materias"),
        default="crawl",
        help="crawl = novos concursos; reprocessar-materias = atualiza pendentes",
    )
    args = parser.parse_args()

    if args.mode == "reprocessar-materias":
        reprocessar_materias()
        return 0

    return crawler_novos()


if __name__ == "__main__":
    sys.exit(main())
