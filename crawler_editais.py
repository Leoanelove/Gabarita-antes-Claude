import json
import os
import re
import sys
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field
from supabase import Client, create_client

# ============================================================
# FUNÇÃO ANTI-FORMATAÇÃO MARKDOWN (EVITA ERRO DE COPIAR/COLAR)
# ============================================================

def limpar_url(u: str) -> str:
    if not u:
        return ""
    u = u.strip()
    # Se o editor colou no formato [texto](url), extrai apenas a url limpa
    m = re.match(r"^\[.*?\]\((https?://[^\)]+)\)(.*)$", u)
    if m:
        return m.group(1) + m.group(2)
    u = re.sub(r"\[https?://[^\]]+\]\((https?://[^\)]+)\)", r"\1", u)
    return u.strip("[]()")


# ============================================================
# CONFIGURAÇÃO DE AMBIENTE
# ============================================================

SUPABASE_URL = limpar_url(os.getenv("SUPABASE_URL", ""))
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

PROTO = "https" + "://"
DOMINIO_QC = PROTO + "www.qconcursos.com"
JINA_PREFIX = PROTO + "r.jina.ai/"

QCONCURSOS_ABERTOS_URL = limpar_url(
    os.getenv(
        "QCONCURSOS_ABERTOS_URL",
        DOMINIO_QC + "/questoes-de-concursos/concursos?by_situation%5B%5D=3",
    )
)

_modelo_env = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL = "gemini-2.5-flash" if "3.8" in _modelo_env else _modelo_env

MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "1"))
MAX_CARGOS_POR_CONCURSO = int(os.getenv("MAX_CARGOS_POR_CONCURSO", "25"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "45"))
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "2"))

HEADERS_PADRAO = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
# SCHEMAS PYDANTIC PARA EXTRAÇÃO ESTRUTURADA (GEMINI)
# ============================================================

class CargoResumo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome_cargo: str = Field(description="Nome limpo do cargo (ex: Guarda Civil Municipal, Analista Judiciário).")
    escolaridade: str = Field(default="Ensino Superior", description="Ex: Ensino Médio, Ensino Superior, Ensino Fundamental.")
    vagas: int = Field(default=0, description="Quantidade de vagas imediatas para este cargo (0 se CR ou não informado).")
    salario: float = Field(default=0.0, description="Valor numérico do salário/remuneração em reais (ex: 3500.50).")
    url_curso_cargo: str | None = Field(default=None, description="URL ou caminho que aponta para /cursos/... referente a este cargo.")


class DadosConcursoQConcursos(BaseModel):
    model_config = ConfigDict(extra="ignore")
    orgao: str = Field(description="Nome oficial do órgão (ex: Prefeitura de Sobral - CE).")
    banca: str = Field(description="Nome da banca organizadora (ex: Cebraspe, FGV, Consulplan).")
    data_prova: str | None = Field(default=None, description="Data da prova no formato YYYY-MM-DD, se houver.")
    url_edital_pdf: str | None = Field(default=None, description="URL do arquivo PDF do edital, se presente.")
    cargos: list[CargoResumo] = Field(default_factory=list, description="Lista de todos os cargos listados nesta página do concurso.")


class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome: str = Field(description="Nome formal da matéria/disciplina (ex: Língua Portuguesa, Direito Constitucional).")
    peso: float | None = Field(default=1.0)
    topicos: list[str] = Field(default_factory=list, description="Lista detalhada dos tópicos e subtópicos cobrados nesta matéria.")


class MateriasLista(BaseModel):
    model_config = ConfigDict(extra="ignore")
    materias: list[Materia] = Field(default_factory=list)
    vagas_confirmadas: int | None = Field(default=None, description="Número de vagas caso apareça nesta página do cargo.")
    salario_confirmado: float | None = Field(default=None, description="Salário numérico caso apareça nesta página do cargo.")
    escolaridade_confirmada: str | None = Field(default=None, description="Escolaridade caso apareça nesta página do cargo.")
    data_prova_confirmada: str | None = Field(default=None, description="Data da prova no formato YYYY-MM-DD caso apareça nesta página.")


# ============================================================
# FUNÇÕES UTILITÁRIAS E NORMALIZAÇÃO
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


def identificar_esfera(orgao: str) -> str:
    texto = normalizar_texto(orgao).lower()
    if any(t in texto for t in ("prefeitura", "câmara municipal", "camara municipal", "guarda municipal", "municipal", "saae", "iprev")):
        return "Municipal"
    if any(t in texto for t in ("estadual", "polícia militar", "policia civil", "sefaz", "governo do estado", "tj ", "tjsp", "tjrj", "tjmg", "pc ", "pm ", "detran")):
        return "Estadual"
    return "Federal"


# ============================================================
# DOWNLOAD COM FALLBACK ANTI-BLOQUEIO (CURL_CFFI -> JINA READER)
# ============================================================

def baixar_conteudo_pagina(url: str) -> tuple[str, BeautifulSoup | None]:
    url_limpa = limpar_url(url)

    # 1. Tentativa direta via curl_cffi
    try:
        if TEM_CURL_CFFI:
            resp = sessao.get(url_limpa, headers=HEADERS_PADRAO, timeout=REQUEST_TIMEOUT, impersonate="chrome124")
        else:
            resp = sessao.get(url_limpa, headers=HEADERS_PADRAO, timeout=REQUEST_TIMEOUT)

        if resp.status_code == 200 and "Just a moment..." not in resp.text and len(resp.text) > 1500:
            soup = BeautifulSoup(resp.text, "html.parser")
            return resp.text, soup
        print(f"⚠️ Status {resp.status_code} direto em {url_limpa}. Buscando via Jina Reader...")
    except Exception as exc:
        print(f"⚠️ Acesso direto falhou ({exc}). Buscando via Jina Reader...")

    # 2. Fallback via Jina Reader (Modo Markdown completo com links no final)
    jina_url = JINA_PREFIX + url_limpa
    headers_jina = {
        "User-Agent": HEADERS_PADRAO["User-Agent"],
        "Accept": "text/plain, text/markdown, */*",
        "X-With-Links-Summary": "true",
    }
    resp_jina = requests.get(jina_url, headers=headers_jina, timeout=REQUEST_TIMEOUT + 20)
    resp_jina.raise_for_status()
    texto_jina = resp_jina.text
    return texto_jina, None


# ============================================================
# NÍVEL 1: LISTAR CONCURSOS ABERTOS NO QCONCURSOS
# ============================================================

def listar_concursos_abertos() -> list[str]:
    print(f"🔎 Buscando lista de concursos abertos em: {QCONCURSOS_ABERTOS_URL}")
    bruto, soup = baixar_conteudo_pagina(QCONCURSOS_ABERTOS_URL)
    links = []

    slugs_ignorar = {"concursos", "abertos", "previstos", "federais", "estaduais", "municipais", "busca"}

    # Se veio HTML pelo acesso direto
    if soup:
        for a in soup.find_all("a", href=True):
            href = limpar_url(a["href"])
            url_completa = urljoin(DOMINIO_QC, href).split("#")[0].split("?")[0].rstrip("/")
            if "/questoes-de-concursos/concursos/" in url_completa:
                slug = url_completa.split("/questoes-de-concursos/concursos/")[-1].lower()
                if slug and "/" not in slug and slug not in slugs_ignorar:
                    if url_completa not in links:
                        links.append(url_completa)

    # Extração via Regex (funciona tanto para HTML quanto para o Markdown do Jina Reader)
    padrao_concurso = r"(?:/questoes-de-concursos/concursos/)([a-zA-Z0-9\-_]+)"
    for slug in re.findall(padrao_concurso, bruto):
        slug_low = slug.lower().strip("/")
        if slug_low and slug_low not in slugs_ignorar and len(slug_low) > 4:
            url_c = f"{DOMINIO_QC}/questoes-de-concursos/concursos/{slug_low}"
            if url_c not in links:
                links.append(url_c)

    return links


# ============================================================
# NÍVEL 2: EXTRAIR METADADOS DO CONCURSO + LISTA DE CARGOS (/cursos/...)
# ============================================================

def extrair_cargos_e_dados_do_concurso(url_concurso: str) -> DadosConcursoQConcursos | None:
    bruto, soup = baixar_conteudo_pagina(url_concurso)

    links_cursos_encontrados = []
    links_pdf_encontrados = []

    if soup:
        for a in soup.find_all("a", href=True):
            href = urljoin(DOMINIO_QC, limpar_url(a["href"]))
            texto_link = normalizar_texto(a.get_text(" ", strip=True))
            if "/cursos/" in href:
                links_cursos_encontrados.append(f"{texto_link} -> {href}")
            elif ".pdf" in href.lower():
                links_pdf_encontrados.append(href)

        for tag in soup(["script", "style", "noscript", "svg", "footer", "nav"]):
            tag.decompose()
        texto_pagina = soup.get_text("\n", strip=True)
    else:
        # Quando vem pelo Jina Reader em Markdown, captura todos os links /cursos/... e .pdf via Regex
        for slug_curso in set(re.findall(r"/cursos/[a-zA-Z0-9\-_]+", bruto)):
            links_cursos_encontrados.append(f"{DOMINIO_QC}{slug_curso}")
        for pdf_match in set(re.findall(r"https?://[^\s\)\"']+\.pdf", bruto, flags=re.IGNORECASE)):
            links_pdf_encontrados.append(pdf_match)
        texto_pagina = bruto

    prompt = f"""
Analise o conteúdo da página deste concurso aberto no Qconcursos ({url_concurso}).
Extraia:
1. 'orgao': Nome limpo do órgão (ex: Prefeitura de Sobral - CE).
2. 'banca': Nome da banca organizadora.
3. 'data_prova': Data da prova no formato YYYY-MM-DD (se informada).
4. 'url_edital_pdf': Link do PDF do edital (se houver).
5. 'cargos': TODOS os cargos listados para este concurso. Para cada cargo, associe o 'url_curso_cargo' correspondente (link que contém /cursos/...), 'escolaridade', 'vagas' (inteiro) e 'salario' (float em R$).

Links de cargos (/cursos/) detectados na página:
{chr(10).join(links_cursos_encontrados[:80])}

Links de PDF detectados:
{chr(10).join(links_pdf_encontrados[:10])}

Texto completo da página do concurso:
{texto_pagina[:40000]}
"""
    try:
        resposta = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=DadosConcursoQConcursos,
                max_output_tokens=16384,
            ),
        )
        dados = parse_json_resposta(resposta.text)
        return DadosConcursoQConcursos.model_validate(dados)
    except Exception as exc:
        print(f"❌ Erro ao estruturar dados do concurso ({url_concurso}): {exc}")
        return None


# ============================================================
# NÍVEL 3: EXTRAIR EDITAL VERTICALIZADO DA PÁGINA DO CARGO (/cursos/...)
# ============================================================

def extrair_edital_verticalizado_do_cargo(url_curso: str, nome_cargo: str) -> MateriasLista:
    url_curso_limpa = limpar_url(url_curso)
    print(f"   📘 Extraindo edital verticalizado do cargo [{nome_cargo}]: {url_curso_limpa}")
    try:
        bruto, soup = baixar_conteudo_pagina(url_curso_limpa)
        if soup:
            for tag in soup(["script", "style", "noscript", "svg", "footer", "nav"]):
                tag.decompose()
            texto_cargo = soup.get_text("\n", strip=True)
        else:
            texto_cargo = bruto
    except Exception as exc:
        print(f"   ⚠️ Falha ao abrir página do cargo {url_curso_limpa}: {exc}")
        return MateriasLista(materias=[])

    prompt = f"""
Você está lendo a página do cargo '{nome_cargo}' no Qconcursos ({url_curso_limpa}), onde consta o EDITAL VERTICALIZADO (conteúdo programático dividido por matérias e tópicos).

Instruções:
1. Extraia TODAS as matérias/disciplinas cobradas para este cargo (ex: Língua Portuguesa, Raciocínio Lógico, Conhecimentos Específicos, etc.).
2. Dentro de cada matéria, liste todos os seus tópicos/assuntos separadamente no array 'topicos'.
3. Ignore menus do site, propagandas de planos ou depoimentos de alunos. Foque 100% no conteúdo programático do edital e nos dados do cargo (vagas, salário, escolaridade, data da prova) se aparecerem na página.

Conteúdo da página do cargo:
{texto_cargo[:50000]}
"""
    try:
        resposta = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=MateriasLista,
                max_output_tokens=32768,
            ),
        )
        dados = parse_json_resposta(resposta.text)
        return MateriasLista.model_validate(dados)
    except Exception as exc:
        print(f"   ⚠️ Erro na IA ao extrair matérias do cargo {nome_cargo}: {exc}")
        return MateriasLista(materias=[])


# ============================================================
# PERSISTÊNCIA NO SUPABASE (UMA LINHA POR CARGO)
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
            update_data = {k: v for k, v in payload.items() if v not in (None, "", 0, 0.0)}
            if materias:
                update_data["materias"] = materias
            supabase.table("editais").update(update_data).eq("id", edital_id).execute()
            print(f"   🔄 Atualizado no Supabase: {orgao} -> {cargo} ({len(materias)} matérias)")
        else:
            supabase.table("editais").insert({**payload, "materias": materias}).execute()
            print(f"   🆕 Inserido no Supabase: {orgao} -> {cargo} ({len(materias)} matérias)")

    except Exception as exc:
        print(f"   ❌ Erro ao persistir no Supabase ({orgao} - {cargo}): {exc}")


# ============================================================
# FLUXO PRINCIPAL DE PROCESSAMENTO DO CONCURSO
# ============================================================

def processar_concurso_qconcursos(url_concurso: str):
    url_concurso = limpar_url(url_concurso)
    print("\n" + "=" * 80)
    print(f"🏛️ Processando Concurso Aberto: {url_concurso}")
    print("=" * 80)

    dados_concurso = extrair_cargos_e_dados_do_concurso(url_concurso)
    if not dados_concurso:
        print("⚠️ Não foi possível extrair os dados básicos deste concurso.")
        return

    if "definir" in (dados_concurso.banca or "").lower():
        print(f"⏭️ Ignorando {dados_concurso.orgao}: Banca consta como '{dados_concurso.banca}'.")
        return

    print(f"✓ Órgão: {dados_concurso.orgao} | Banca: {dados_concurso.banca} | Prova: {dados_concurso.data_prova}")
    print(f"✓ Total de cargos identificados no edital: {len(dados_concurso.cargos)}")

    if not dados_concurso.cargos:
        print("⚠️ Nenhum cargo listado na página deste concurso.")
        return

    for idx, cargo_obj in enumerate(dados_concurso.cargos[:MAX_CARGOS_POR_CONCURSO], start=1):
        nome_cargo = normalizar_texto(cargo_obj.nome_cargo)
        if not nome_cargo:
            continue

        print(f"\n➡️ [{idx}/{len(dados_concurso.cargos)}] Cargo: {nome_cargo}")

        materias_formatadas = []
        vagas_final = cargo_obj.vagas or 0
        salario_final = cargo_obj.salario or 0.0
        escolaridade_final = cargo_obj.escolaridade or "Ensino Superior"
        data_prova_final = dados_concurso.data_prova
        link_origem_final = url_concurso

        if cargo_obj.url_curso_cargo:
            url_curso_completa = urljoin(DOMINIO_QC, limpar_url(cargo_obj.url_curso_cargo))
            link_origem_final = url_curso_completa
            detalhes_cargo = extrair_edital_verticalizado_do_cargo(url_curso_completa, nome_cargo)

            for m in detalhes_cargo.materias:
                if m.nome and m.nome.strip():
                    materias_formatadas.append({
                        "nome": m.nome.strip(),
                        "peso": m.peso or 1.0,
                        "topicos": [t.strip() for t in m.topicos if t and t.strip()],
                    })

            if not vagas_final and detalhes_cargo.vagas_confirmadas:
                vagas_final = detalhes_cargo.vagas_confirmadas
            if not salario_final and detalhes_cargo.salario_confirmado:
                salario_final = detalhes_cargo.salario_confirmado
            if detalhes_cargo.escolaridade_confirmada:
                escolaridade_final = detalhes_cargo.escolaridade_confirmada
            if not data_prova_final and detalhes_cargo.data_prova_confirmada:
                data_prova_final = detalhes_cargo.data_prova_confirmada

            time.sleep(1.5)

        url_pdf_limpa = limpar_url(dados_concurso.url_edital_pdf or "")

        payload = {
            "titulo": f"{dados_concurso.orgao} - {nome_cargo}"[:255],
            "orgao": dados_concurso.orgao[:255],
            "banca": (dados_concurso.banca or "Definida no Edital")[:100],
            "vagas": vagas_final,
            "salario_maximo": salario_final,
            "escolaridade": escolaridade_final[:100],
            "link_origem": link_origem_final,
            "cargo": nome_cargo[:255],
            "esfera": identificar_esfera(dados_concurso.orgao)[:50],
            "status": "Edital Publicado",
            "data_prova": data_prova_final,
            "observacoes": (
                f"Edital PDF: {url_pdf_limpa}"
                if url_pdf_limpa
                else f"Fonte Qconcursos: {url_concurso}"
            ),
        }

        salvar_no_banco(payload, materias_formatadas)


def main():
    links_concursos = listar_concursos_abertos()
    print(f"📋 Concursos ABERTOS encontrados no Qconcursos: {len(links_concursos)}")

    if not links_concursos:
        print("❌ Nenhum link de concurso aberto foi retornado. Verifique os logs acima.")
        return 1

    for link in links_concursos[:MAX_CONCURSOS]:
        processar_concurso_qconcursos(link)
        time.sleep(SLEEP_SECONDS)

    print("\n🏁 Execução concluída com sucesso!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
