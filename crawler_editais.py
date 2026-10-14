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

# Confirme que este nome existe na sua conta (veja a lista no AI Studio).
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
# Modelo reserva, usado quando o principal está sobrecarregado (erro 503).
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")

MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "0"))  # 0 = sem limite
REPROCESS_LIMIT = int(os.getenv("REPROCESS_LIMIT", "0"))  # 0 = todos

REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "45"))
PDF_TIMEOUT = int(os.getenv("PDF_TIMEOUT", "120"))
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "2"))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY.")

if not GEMINI_API_KEY:
    raise RuntimeError("Defina GEMINI_API_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
gemini = genai.Client(api_key=GEMINI_API_KEY)

# Sessão que imita um navegador Chrome de verdade (assinatura TLS incluída)
# e guarda cookies entre as páginas. Se a biblioteca curl_cffi não estiver
# instalada, usa o requests comum.
try:
    from curl_cffi import requests as _http_chrome

    sessao = _http_chrome.Session(impersonate="chrome")
    print("🌐 Usando curl_cffi (imitando Chrome).")
except ImportError:
    sessao = requests.Session()
    sessao.headers.update(HEADERS)
    print("⚠️ curl_cffi não instalado; usando requests comum.")


# ============================================================
# MODELOS DE RESPOSTA DO GEMINI
# (campos Optional: o modelo pode devolver null sem quebrar a validação)
# ============================================================

class Cargo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome_cargo: str = Field(description="Nome exato do cargo.")
    vagas: int | None = Field(
        default=None,
        description="Vagas (ampla + PcD + cotas) do cargo; null se não informado.",
    )
    salario: float | None = Field(
        default=None,
        description="Remuneração inicial em reais (número); null se não informado.",
    )
    escolaridade: str | None = Field(
        default=None,
        description="Escolaridade exigida; null se não informado.",
    )


class Concurso(BaseModel):
    model_config = ConfigDict(extra="ignore")

    orgao: str
    banca: str | None = None
    esfera: str | None = None
    data_prova: str | None = None
    cargos: list[Cargo] = Field(default_factory=list)


class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome: str
    peso: float | None = 1
    topicos: list[str] = Field(default_factory=list)


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

    # Já está em YYYY-MM-DD (formato pedido ao Gemini)
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
        "guarda municipal", "municipal",
    )):
        return "Municipal"

    if any(t in texto for t in (
        "estadual", "polícia militar", "policia militar",
        "polícia civil", "policia civil", "corpo de bombeiros",
        "bombeiros", "secretaria de estado", "governo do estado",
    )):
        return "Estadual"

    return "Federal"


# ============================================================
# GEMINI
# ============================================================

def chamar_gemini(contents, schema, tentativas: int = 6):
    """Retry (limite de taxa, 503, JSON truncado), com modelo reserva."""
    ultimo_erro = None
    # 2 tentativas no modelo principal, depois alterna para o reserva.
    modelos = [GEMINI_MODEL, GEMINI_MODEL] + [GEMINI_FALLBACK_MODEL] * 4

    for tentativa in range(tentativas):
        modelo = modelos[tentativa]
        try:
            resposta = gemini.models.generate_content(
                model=modelo,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_schema=schema,
                    # Editais grandes geram JSON longo; sem isso a resposta
                    # pode vir cortada e o JSON quebra.
                    max_output_tokens=65536,
                ),
            )
            return parse_json_resposta(resposta.text)
        except Exception as exc:
            ultimo_erro = exc
            if tentativa < tentativas - 1:
                espera = min(15 * (tentativa + 1), 60)
                print(f"⚠️ Gemini ({modelo}) falhou: {str(exc)[:120]}; "
                      f"nova tentativa em {espera}s")
                time.sleep(espera)

    raise ultimo_erro


def enviar_pdf_gemini(pdf_path: str):
    """Faz upload e ESPERA o arquivo ficar ACTIVE (PDFs grandes demoram)."""
    arquivo = gemini.files.upload(
        file=pdf_path,
        config={"mime_type": "application/pdf"},
    )

    for _ in range(60):
        estado = getattr(arquivo.state, "name", str(arquivo.state))
        if arquivo.state is None or estado == "ACTIVE":
            return arquivo
        if estado == "FAILED":
            raise RuntimeError("Gemini falhou ao processar o PDF.")
        time.sleep(2)
        arquivo = gemini.files.get(name=arquivo.name)

    raise TimeoutError("PDF não ficou ACTIVE no Gemini a tempo.")


def analisar_edital(texto_artigo: str, arquivo_gemini=None) -> Concurso | None:
    """
    Extrai órgão, banca, esfera, data da prova e TODOS os cargos
    (com vagas, salário e escolaridade). Quando há PDF, ele é a fonte
    principal, pois é onde ficam salários e tabelas de vagas.
    """

    prompt = f"""
Você analisa um concurso público brasileiro. Fontes: o EDITAL em PDF
(quando anexado) e o texto da página de notícia abaixo.

Extraia SOMENTE informações realmente presentes nas fontes.

REGRAS:
- Liste TODOS os cargos do concurso, um item por cargo. Se o cargo tiver
  especialidades/áreas/códigos distintos (ex.: "Analista - Engenharia
  Civil"), liste cada um separadamente.
- Para cada cargo, procure no edital a tabela de cargos/vagas/remuneração:
  vagas (some ampla concorrência + PcD + cotas, se separadas), salário
  inicial (apenas o número, ex.: 8500.50) e escolaridade.
- Não use o total geral de vagas como vagas de cada cargo.
- Se um dado não existir para o cargo, use null. Não invente.
- data_prova: data da prova objetiva em YYYY-MM-DD. Se houver mais de
  uma data ou ainda não estiver definida, use a prova objetiva ou null.
- esfera: Federal, Estadual ou Municipal, se for possível inferir pelo
  órgão; senão null.
- Preserve os nomes dos cargos como no edital.

TEXTO DA PÁGINA:
{texto_artigo[:30000]}
"""

    contents = [arquivo_gemini, prompt] if arquivo_gemini else prompt

    try:
        dados = chamar_gemini(contents, Concurso)
        return Concurso.model_validate(dados)
    except Exception as exc:
        print(f"⚠️ Falha ao analisar edital com Gemini: {exc}")
        return None


def extrair_materias_cargo(cargo: str, arquivo_gemini) -> list[dict]:
    """Extrai o conteúdo programático de UM cargo a partir do PDF já enviado."""

    print(f"🧠 Extraindo conteúdo programático: {cargo}")

    prompt = f"""
Analise integralmente o edital PDF anexado.

TAREFA:
Extraia o conteúdo programático do cargo:
"{cargo}"

Procure a seção "CONTEÚDOS PROGRAMÁTICOS" (frequentemente um ANEXO) ou
equivalente.

REGRAS CRÍTICAS:
1. Não misture conteúdo de outros cargos.
2. Muitos editais agrupam cargos (ex.: "Cargos 01 a 05", "Nível Superior",
   "Conhecimentos Básicos" + "Conhecimentos Específicos por cargo"). Inclua
   tudo que se aplica a este cargo: as disciplinas comuns ao grupo dele E
   as específicas dele.
3. Não resuma. Preserve a redação do edital tanto quanto possível.
4. Cada disciplina é um objeto separado em "materias".
5. Cada item/subitem de cada disciplina é um elemento separado em "topicos".
6. Se a disciplina tiver itens numerados, mantenha cada item.
7. Não inclua salário, vagas, inscrições, cronograma, atribuições ou etapas.
8. Não invente conteúdo.
9. Se não houver conteúdo programático identificável para esse cargo,
   retorne {{"materias": []}}.
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
                "peso": item.peso if item.peso is not None else 1,
                "topicos": topicos,
            })

        print(f"✓ {len(materias)} matérias extraídas para '{cargo}'")
        return materias

    except Exception as exc:
        print(f"❌ Erro extraindo matérias de '{cargo}': {exc}")
        return []


# ============================================================
# HTTP / PDF
# ============================================================

def baixar_pagina(url: str) -> requests.Response:
    headers = {
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": ESTRATEGIA_URL,
    }
    resposta = sessao.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    resposta.raise_for_status()
    return resposta


def encontrar_pdfs(soup: BeautifulSoup, url_base: str) -> list[str]:
    """Retorna as URLs candidatas a edital, da mais provável à menos."""
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
            pontuacao += 20
        if "edital" in texto:
            pontuacao += 15
        if "edital" in href_lower:
            pontuacao += 10
        if any(t in texto for t in (
            "edital publicado", "edital de abertura", "edital nº", "edital n°",
        )):
            pontuacao += 8
        if any(t in texto for t in (
            "resultado", "homologação", "homologacao",
            "convocação", "convocacao", "gabarito", "retifica",
        )):
            pontuacao -= 10

        if pontuacao > 0:
            candidatos[url] = max(pontuacao, candidatos.get(url, 0))

    ordenados = sorted(candidatos.items(), key=lambda i: i[1], reverse=True)
    return [url for url, _ in ordenados]


def baixar_pdf(pdf_url: str) -> str | None:
    try:
        resposta = sessao.get(pdf_url, timeout=PDF_TIMEOUT)
        resposta.raise_for_status()

        # Valida o arquivo de verdade: PDF começa com "%PDF".
        # (Antes, uma página HTML grande era aceita como se fosse PDF.)
        if not resposta.content[:1024].lstrip().startswith(b"%PDF"):
            raise ValueError("O link não retornou um PDF válido.")

        if len(resposta.content) < 5000:
            raise ValueError("Arquivo muito pequeno para ser um edital.")

        arquivo = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        arquivo.write(resposta.content)
        arquivo.close()

        print(f"✓ PDF baixado: {len(resposta.content) / 1024:.1f} KB")
        return arquivo.name

    except Exception as exc:
        print(f"❌ Erro ao baixar PDF ({pdf_url}): {exc}")
        return None


def obter_pdf(soup: BeautifulSoup, url_base: str):
    """Tenta os candidatos em ordem até achar um PDF válido."""
    for pdf_url in encontrar_pdfs(soup, url_base)[:5]:
        print(f"📄 Tentando: {pdf_url}")
        pdf_path = baixar_pdf(pdf_url)
        if pdf_path:
            return pdf_url, pdf_path
    return None, None


# ============================================================
# SUPABASE
# ============================================================

def materias_validas(materias) -> bool:
    return isinstance(materias, list) and len(materias) > 0


def buscar_edital_existente(orgao: str, cargo: str):
    """
    Só retorna um registro se o cargo for IDÊNTICO (normalizado).
    Antes, o código devolvia o primeiro resultado parcial do ilike, e um
    cargo acabava sobrescrevendo outro — por isso vários cargos do mesmo
    concurso viravam uma linha só.
    """
    try:
        resposta = (
            supabase.table("editais")
            .select("id,orgao,cargo,materias")
            .ilike("orgao", f"%{orgao[:80]}%")
            .limit(500)
            .execute()
        )

        alvo = normalizar_texto(cargo).casefold()
        alvo_orgao = normalizar_texto(orgao).casefold()

        for item in resposta.data or []:
            mesmo_cargo = normalizar_texto(item.get("cargo")).casefold() == alvo
            mesmo_orgao = (
                normalizar_texto(item.get("orgao")).casefold() == alvo_orgao
            )
            if mesmo_cargo and mesmo_orgao:
                return item

        return None

    except Exception as exc:
        print(f"⚠️ Erro consultando Supabase: {exc}")
        return None


def salvar_ou_atualizar(payload: dict, orgao: str, cargo: str,
                        materias: list[dict]) -> str:
    existente = buscar_edital_existente(orgao, cargo)

    if existente:
        edital_id = existente["id"]
        antigas = existente.get("materias")

        # Não sobrescreve valores bons com vazios (0, "", None)
        update_payload = {
            k: v for k, v in payload.items() if v not in (None, "", 0)
        }

        if materias_validas(materias):
            update_payload["materias"] = materias
        elif materias_validas(antigas):
            print(f"↪ {cargo}: mantendo {len(antigas)} matérias existentes.")
        else:
            print(f"⚠️ {cargo}: registro existe, mas ainda sem matérias.")

        supabase.table("editais").update(update_payload).eq(
            "id", edital_id
        ).execute()

        print(f"🔄 Atualizado: {orgao} -> {cargo}")
        return "atualizado"

    if not materias_validas(materias):
        print(f"⚠️ Novo registro '{cargo}' sem matérias (reprocessar depois).")

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
# PROCESSAMENTO DE UM CONCURSO
# ============================================================

def processar_concurso(url_noticia: str) -> int:
    print("\n" + "=" * 80)
    print(f"🌐 {url_noticia}")
    print("=" * 80)

    try:
        resposta = baixar_pagina(url_noticia)
    except Exception as exc:
        print(f"❌ Falha ao acessar notícia: {exc}")
        return 0

    soup = BeautifulSoup(resposta.text, "html.parser")

    soup_texto = BeautifulSoup(resposta.text, "html.parser")
    for tag in soup_texto(["script", "style", "nav", "footer", "noscript"]):
        tag.decompose()
    texto_artigo = normalizar_texto(soup_texto.get_text(" ", strip=True))

    pdf_url, pdf_path = obter_pdf(soup, url_noticia)
    if not pdf_path:
        print("⚠️ PDF do edital não encontrado/baixado.")

    arquivo_gemini = None
    alterados = 0

    try:
        if pdf_path:
            try:
                arquivo_gemini = enviar_pdf_gemini(pdf_path)
                print("✓ PDF enviado ao Gemini.")
            except Exception as exc:
                print(f"❌ Falha no upload do PDF ao Gemini: {exc}")

        # 1ª tentativa: PDF + notícia. Fallback: só a notícia.
        dados = analisar_edital(texto_artigo, arquivo_gemini)
        if (not dados or not dados.cargos) and arquivo_gemini:
            dados = analisar_edital(texto_artigo, None)

        if not dados or not dados.cargos:
            print("❌ Não foi possível identificar os cargos.")
            return 0

        print(f"✓ {len(dados.cargos)} cargos identificados.")

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
                print(f"❌ Erro salvando '{nome_cargo}': {exc}")

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


# ============================================================
# REPROCESSAMENTO DOS REGISTROS ANTIGOS
# ============================================================

def extrair_pdf_da_observacao(observacoes: str | None) -> str | None:
    if not observacoes:
        return None
    match = re.search(
        r"https?://\S+?\.pdf(?:\?\S*)?", observacoes, flags=re.IGNORECASE
    )
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
            print(f"⚠️ Não foi possível recuperar PDF pela página: {exc}")

    return None, None


def reprocessar_materias():
    registros = listar_editais_para_reprocessar()
    print(f"♻️ Registros sem conteúdo programático: {len(registros)}")

    # Agrupa por concurso (link_origem) para enviar cada PDF só uma vez.
    grupos: dict[str, list[dict]] = {}
    for item in registros:
        chave = item.get("link_origem") or f"id-{item['id']}"
        grupos.setdefault(chave, []).append(item)

    sucesso = 0

    for itens in grupos.values():
        pdf_url, pdf_path = descobrir_pdf_do_registro(itens[0])
        if not pdf_path:
            print("❌ PDF não encontrado para este grupo.")
            continue

        arquivo_gemini = None
        try:
            arquivo_gemini = enviar_pdf_gemini(pdf_path)

            for item in itens:
                cargo = normalizar_texto(item.get("cargo"))
                print(f"♻️ ID={item['id']} | {item.get('orgao')} -> {cargo}")

                materias = extrair_materias_cargo(cargo, arquivo_gemini)
                if not materias:
                    print("⚠️ Sem matérias; registro NÃO alterado.")
                    continue

                supabase.table("editais").update({
                    "materias": materias,
                    "observacoes": f"Edital: {pdf_url}",
                }).eq("id", item["id"]).execute()

                print(f"✅ ID={item['id']} atualizado ({len(materias)} matérias).")
                sucesso += 1
                time.sleep(SLEEP_SECONDS)

        except Exception as exc:
            print(f"❌ Erro no reprocessamento: {exc}")
        finally:
            if arquivo_gemini:
                try:
                    gemini.files.delete(name=arquivo_gemini.name)
                except Exception:
                    pass
            try:
                os.remove(pdf_path)
            except OSError:
                pass

    print(f"\n🏁 Reprocessamento concluído: {sucesso}/{len(registros)} atualizados.")


# ============================================================
# CRAWLER PRINCIPAL
# ============================================================

def listar_links_concursos() -> list[str]:
    resposta = baixar_pagina(ESTRATEGIA_URL)
    soup = BeautifulSoup(resposta.text, "html.parser")

    links = set()
    for a in soup.find_all("a", href=True):
        href = urljoin(ESTRATEGIA_URL, a["href"])
        if "/portal/concurso-" in href:
            # Mantém a barra final, como o site usa na listagem.
            links.add(href.split("#")[0].rstrip("/") + "/")

    return sorted(links)


def crawler_novos():
    try:
        links = listar_links_concursos()
    except Exception as exc:
        print(f"❌ Erro na listagem de concursos: {exc}")
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
            print(f"❌ Erro inesperado em {link}: {exc}")
        time.sleep(SLEEP_SECONDS)

    print(
        f"\n🏁 Rodada concluída. Concursos visitados: {processados}. "
        f"Registros inseridos/atualizados: {alterados}."
    )
    return 0


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Crawler de editais do Estratégia + conteúdo programático."
    )
    parser.add_argument(
        "--mode",
        choices=("crawl", "reprocessar-materias"),
        default="crawl",
        help=(
            "crawl = busca concursos novos; "
            "reprocessar-materias = corrige registros sem conteúdo programático."
        ),
    )
    args = parser.parse_args()

    if args.mode == "reprocessar-materias":
        reprocessar_materias()
        return 0

    return crawler_novos()


if __name__ == "__main__":
    sys.exit(main())
