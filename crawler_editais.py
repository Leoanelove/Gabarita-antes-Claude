import argparse
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path
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

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# 0 = sem limite
MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "0"))

# Quantidade máxima de registros antigos a reprocessar por execução.
# 0 = todos.
REPROCESS_LIMIT = int(os.getenv("REPROCESS_LIMIT", "0"))

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
    raise RuntimeError(
        "Defina SUPABASE_URL e SUPABASE_SERVICE_KEY."
    )

if not GEMINI_API_KEY:
    raise RuntimeError("Defina GEMINI_API_KEY.")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)

gemini = genai.Client(api_key=GEMINI_API_KEY)


# ============================================================
# MODELOS DE RESPOSTA DO GEMINI
# ============================================================

class Cargo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome_cargo: str = Field(description="Nome exato do cargo.")
    vagas: int = Field(
        default=0,
        description="Número de vagas do cargo; use 0 se não informado.",
    )
    salario: float = Field(
        default=0,
        description="Remuneração em reais; use 0 se não informado.",
    )
    escolaridade: str = Field(
        default="",
        description="Escolaridade exigida; use texto vazio se não informado.",
    )


class Concurso(BaseModel):
    model_config = ConfigDict(extra="ignore")

    orgao: str
    banca: str = ""
    esfera: str = ""
    data_prova: str = ""
    cargos: list[Cargo] = Field(default_factory=list)


class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome: str
    peso: float = 1
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
        texto = re.sub(
            r"^```(?:json)?\s*",
            "",
            texto,
            flags=re.IGNORECASE,
        )
        texto = re.sub(r"\s*```$", "", texto)

    return json.loads(texto)


def limpar_vagas(valor) -> int:
    if valor is None:
        return 0
    if isinstance(valor, bool):
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
        numeros = re.findall(r"[\d\.,]+", texto)
        valores = numeros[:1]

    salarios = []
    for item in valores:
        try:
            salarios.append(
                float(item.replace(".", "").replace(",", "."))
            )
        except (ValueError, TypeError):
            continue

    return max(salarios) if salarios else 0.0


def normalizar_data(texto: str | None) -> str | None:
    if not texto:
        return None

    texto = texto.lower()

    meses = {
        "janeiro": "01",
        "fevereiro": "02",
        "março": "03",
        "marco": "03",
        "abril": "04",
        "maio": "05",
        "junho": "06",
        "julho": "07",
        "agosto": "08",
        "setembro": "09",
        "outubro": "10",
        "novembro": "11",
        "dezembro": "12",
    }

    match = re.search(
        r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b",
        texto,
    )
    if match:
        dia, mes, ano = match.groups()
        return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"

    match = re.search(
        r"\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b",
        texto,
    )
    if match:
        dia, mes_texto, ano = match.groups()
        mes = meses.get(mes_texto)
        if mes:
            return f"{ano}-{mes}-{dia.zfill(2)}"

    return None


def esfera_fallback(orgao: str) -> str:
    texto = normalizar_texto(orgao).lower()

    if any(
        termo in texto
        for termo in (
            "prefeitura",
            "câmara municipal",
            "camara municipal",
            "guarda municipal",
            "municipal",
        )
    ):
        return "Municipal"

    if any(
        termo in texto
        for termo in (
            "estadual",
            "polícia militar",
            "policia militar",
            "polícia civil",
            "policia civil",
            "corpo de bombeiros",
            "bombeiros",
            "secretaria de estado",
            "governo do estado",
        )
    ):
        return "Estadual"

    # Siglas conhecidas não são suficientes para afirmar a esfera.
    # Se a IA não informou, preferimos "Federal" como fallback.
    return "Federal"


# ============================================================
# GEMINI
# ============================================================

def gerar_conteudo_estruturado(
    prompt: str,
    schema,
    contents,
):
    resposta = gemini.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents if contents is not None else prompt,
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
            response_schema=schema,
        ),
    )
    return parse_json_resposta(resposta.text)


def analisar_artigo(texto_artigo: str) -> Concurso | None:
    prompt = f"""
Analise uma página de concurso público do Estratégia.

Extraia SOMENTE informações realmente presentes no texto.

Regras:
- Extraia TODOS os cargos explicitamente identificados.
- Não transforme o total geral de vagas em vagas de cada cargo.
- Se vagas individuais não estiverem claras, use null.
- Não invente salário, escolaridade ou data.
- A data deve ser YYYY-MM-DD quando for possível identificá-la.
- Esfera deve ser Federal, Estadual ou Municipal quando puder ser inferida
  com segurança pelo órgão; caso contrário, use null.
- Preserve os nomes dos cargos.

TEXTO DA PÁGINA:
{texto_artigo[:50000]}
"""

    try:
        dados = gerar_conteudo_estruturado(
            prompt=prompt,
            schema=Concurso,
            contents=prompt,
        )
        return Concurso.model_validate(dados)
    except Exception as exc:
        print(f"⚠️ Falha ao analisar artigo com Gemini: {exc}")
        return None


def extrair_materias_cargo(
    pdf_path: str,
    cargo: str,
    arquivo_gemini=None,
) -> list[dict]:
    """
    Lê o PDF oficial e extrai apenas o conteúdo programático do cargo.
    O arquivo é enviado uma única vez por PDF e reutilizado para os cargos.
    """

    print(f"🧠 Extraindo conteúdo programático: {cargo}")

    try:
        if arquivo_gemini is None:
            arquivo_gemini = gemini.files.upload(
                file=pdf_path,
                config={"mime_type": "application/pdf"},
            )

        prompt = f"""
Analise integralmente o edital PDF anexado.

TAREFA:
Extraia o conteúdo programático EXCLUSIVAMENTE para o cargo:
"{cargo}"

Procure a seção intitulada:
- ANEXO II - CONTEÚDOS PROGRAMÁTICOS
ou
- CONTEÚDOS PROGRAMÁTICOS
ou equivalente.

REGRAS CRÍTICAS:
1. Não misture o conteúdo de outros cargos.
2. Não resuma os tópicos.
3. Preserve a redação do edital tanto quanto possível.
4. Cada disciplina deve ser um objeto separado.
5. Cada item, subitem ou tópico programático deve ser um elemento separado
   em "topicos".
6. Inclua conteúdos gerais e específicos que pertençam ao cargo.
7. Não inclua salário, vagas, inscrições, cronograma, atribuições ou etapas.
8. Se a disciplina tiver itens numerados, mantenha cada item.
9. Não invente conteúdo.
10. Se o edital não tiver conteúdo programático identificável para esse cargo,
    retorne [].

FORMATO DA RESPOSTA:
{{
  "materias": [
    {{
      "nome": "NOME DA DISCIPLINA",
      "peso": 1,
      "topicos": [
        "Tópico 1",
        "Tópico 2"
      ]
    }}
  ]
}}
"""

        dados = gerar_conteudo_estruturado(
            prompt=prompt,
            schema=MateriasResposta,
            contents=[arquivo_gemini, prompt],
        )

        resposta_modelo = MateriasResposta.model_validate(dados)
        materias = [
            item.model_dump()
            for item in resposta_modelo.materias
        ]

        materias = [
            {
                "nome": item["nome"].strip(),
                "peso": item.get("peso", 1),
                "topicos": [
                    str(t).strip()
                    for t in item.get("topicos", [])
                    if str(t).strip()
                ],
            }
            for item in materias
            if item.get("nome", "").strip()
        ]

        print(
            f"✓ {len(materias)} matérias extraídas para '{cargo}'"
        )
        return materias

    except Exception as exc:
        print(
            f"❌ Erro extraindo matérias de '{cargo}': {exc}"
        )
        return []


# ============================================================
# HTTP / PDF
# ============================================================

def baixar_pagina(url: str) -> requests.Response:
    resposta = requests.get(
        url,
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT,
    )
    resposta.raise_for_status()
    return resposta


def encontrar_pdf(soup: BeautifulSoup, url_base: str) -> str | None:
    candidatos = []

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href:
            continue

        texto = normalizar_texto(
            a.get_text(" ", strip=True)
        ).lower()

        url = urljoin(url_base, href)
        href_lower = href.lower()

        pontuacao = 0

        if ".pdf" in href_lower:
            pontuacao += 20

        if "edital" in texto:
            pontuacao += 15

        if "edital" in href_lower:
            pontuacao += 10

        if any(
            termo in texto
            for termo in (
                "edital publicado",
                "edital de abertura",
                "edital nº",
                "edital n°",
            )
        ):
            pontuacao += 8

        # Evita priorizar documentos secundários.
        if any(
            termo in texto
            for termo in (
                "resultado",
                "homologação",
                "homologacao",
                "convocação",
                "convocacao",
                "gabarito",
            )
        ):
            pontuacao -= 10

        if pontuacao > 0:
            candidatos.append((pontuacao, url))

    if not candidatos:
        return None

    candidatos.sort(key=lambda item: item[0], reverse=True)

    return candidatos[0][1]


def baixar_pdf(pdf_url: str) -> str | None:
    try:
        resposta = requests.get(
            pdf_url,
            headers=HEADERS,
            timeout=PDF_TIMEOUT,
        )
        resposta.raise_for_status()

        if len(resposta.content) < 5000:
            raise ValueError("Arquivo muito pequeno para ser um edital PDF.")

        content_type = resposta.headers.get("Content-Type", "").lower()

        if (
            "pdf" not in content_type
            and not pdf_url.lower().split("?")[0].endswith(".pdf")
        ):
            # Alguns servidores entregam application/octet-stream.
            # Não falhamos só por isso.
            print(
                f"⚠️ Content-Type inesperado no PDF: {content_type}"
            )

        arquivo = tempfile.NamedTemporaryFile(
            suffix=".pdf",
            delete=False,
        )
        arquivo.write(resposta.content)
        arquivo.close()

        print(
            f"✓ PDF baixado: {len(resposta.content) / 1024:.1f} KB"
        )
        return arquivo.name

    except Exception as exc:
        print(f"❌ Erro ao baixar PDF: {exc}")
        return None


# ============================================================
# SUPABASE
# ============================================================

def materias_validas(materias) -> bool:
    return isinstance(materias, list) and len(materias) > 0


def buscar_edital_existente(orgao: str, cargo: str):
    try:
        resposta = (
            supabase.table("editais")
            .select("id,orgao,cargo,materias")
            .ilike("orgao", f"%{orgao[:80]}%")
            .ilike("cargo", f"%{cargo[:80]}%")
            .limit(10)
            .execute()
        )

        # Tenta primeiro uma comparação normalizada para evitar colisões.
        alvo = normalizar_texto(cargo).casefold()

        for item in resposta.data or []:
            atual = normalizar_texto(
                item.get("cargo")
            ).casefold()

            if atual == alvo:
                return item

        return (resposta.data or [None])[0]

    except Exception as exc:
        print(f"⚠️ Erro consultando Supabase: {exc}")
        return None


def salvar_ou_atualizar(
    payload: dict,
    orgao: str,
    cargo: str,
    materias: list[dict],
) -> str:
    existente = buscar_edital_existente(
        orgao,
        cargo,
    )

    if existente:
        edital_id = existente["id"]
        antigas = existente.get("materias")

        # Nunca apaga conteúdo bom por causa de uma falha transitória.
        if not materias_validas(materias):
            if materias_validas(antigas):
                print(
                    f"↪ {cargo}: já possui {len(antigas)} matérias; "
                    "não sobrescrevendo."
                )
                return "mantido"

            print(
                f"⚠️ {cargo}: registro existe, mas ainda sem matérias."
            )
            return "sem_conteudo"

        update_payload = dict(payload)
        update_payload["materias"] = materias

        (
            supabase.table("editais")
            .update(update_payload)
            .eq("id", edital_id)
            .execute()
        )

        print(
            f"🔄 Atualizado: {orgao} -> {cargo} "
            f"({len(materias)} matérias)"
        )
        return "atualizado"

    if not materias_validas(materias):
        print(
            f"⚠️ Novo registro {cargo} sem matérias; "
            "será salvo para posterior reprocessamento."
        )

    (
        supabase.table("editais")
        .insert({
            **payload,
            "materias": materias,
        })
        .execute()
    )

    print(
        f"🆕 Inserido: {orgao} -> {cargo} "
        f"({len(materias)} matérias)"
    )
    return "inserido"


def listar_editais_para_reprocessar():
    """
    Busca registros em páginas para evitar depender de um limite único.
    O filtro de 'materias vazias' é feito no Python para funcionar tanto
    com NULL quanto com [] e outras variações de JSONB.
    """

    resultados = []
    page_size = 1000
    inicio = 0

    while True:
        resposta = (
            supabase.table("editais")
            .select(
                "id,orgao,cargo,materias,observacoes,link_origem"
            )
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
    for tag in soup_texto(
        ["script", "style", "nav", "footer", "noscript"]
    ):
        tag.decompose()

    texto_artigo = normalizar_texto(
        soup_texto.get_text(" ", strip=True)
    )

    pdf_url = encontrar_pdf(
        soup,
        url_noticia,
    )

    if pdf_url:
        print(f"📄 PDF: {pdf_url}")
    else:
        print("⚠️ PDF do edital não encontrado.")

    dados = analisar_artigo(texto_artigo)

    if not dados or not dados.cargos:
        print("❌ Não foi possível identificar os cargos.")
        return 0

    orgao = normalizar_texto(dados.orgao) or "Órgão Público"
    banca = normalizar_texto(dados.banca) or "A definir"
    esfera = normalizar_texto(dados.esfera) or esfera_fallback(orgao)
    data_prova = normalizar_data(dados.data_prova)

    pdf_path = baixar_pdf(pdf_url) if pdf_url else None
    arquivo_gemini = None

    if pdf_path:
        try:
            # Upload UMA vez. O mesmo PDF é reutilizado para todos os cargos.
            arquivo_gemini = gemini.files.upload(
                file=pdf_path,
                config={"mime_type": "application/pdf"},
            )
            print("✓ PDF enviado ao Gemini.")
        except Exception as exc:
            print(f"❌ Falha no upload do PDF ao Gemini: {exc}")
            arquivo_gemini = None

    alterados = 0

    try:
        for cargo in dados.cargos:
            nome_cargo = normalizar_texto(cargo.nome_cargo)
            if not nome_cargo:
                continue

            vagas = limpar_vagas(cargo.vagas)
            salario = limpar_salario(cargo.salario)
            escolaridade = normalizar_texto(cargo.escolaridade)

            materias = []

            if pdf_path and arquivo_gemini:
                materias = extrair_materias_cargo(
                    pdf_path=pdf_path,
                    cargo=nome_cargo,
                    arquivo_gemini=arquivo_gemini,
                )

            payload = {
                "titulo": f"{orgao} - {nome_cargo}",
                "orgao": orgao[:255],
                "banca": banca[:100],
                "vagas": vagas,
                "salario_maximo": salario,
                "escolaridade": escolaridade[:100],
                "link_origem": url_noticia,
                "cargo": nome_cargo[:255],
                "esfera": esfera[:50],
                "status": "Edital Publicado",
                "data_prova": data_prova,
                "observacoes": (
                    f"Edital: {pdf_url}"
                    if pdf_url
                    else "Ver notícia"
                ),
            }

            try:
                status = salvar_ou_atualizar(
                    payload=payload,
                    orgao=orgao,
                    cargo=nome_cargo,
                    materias=materias,
                )

                if status in ("inserido", "atualizado"):
                    alterados += 1

            except Exception as exc:
                print(
                    f"❌ Erro salvando '{nome_cargo}': {exc}"
                )

            time.sleep(0.5)

    finally:
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
        r"https?://\S+?\.pdf(?:\?\S*)?",
        observacoes,
        flags=re.IGNORECASE,
    )

    return match.group(0).rstrip(").,;") if match else None


def reprocessar_registro(item: dict) -> bool:
    edital_id = item["id"]
    orgao = normalizar_texto(item.get("orgao"))
    cargo = normalizar_texto(item.get("cargo"))
    observacoes = item.get("observacoes")
    link_origem = item.get("link_origem")

    print("\n" + "-" * 80)
    print(
        f"♻️ Reprocessando ID={edital_id} | "
        f"{orgao} -> {cargo}"
    )

    pdf_url = extrair_pdf_da_observacao(observacoes)

    # Se o PDF não estiver salvo no registro, tenta encontrar novamente
    # na página de origem.
    if not pdf_url and link_origem:
        try:
            resposta = baixar_pagina(link_origem)
            soup = BeautifulSoup(resposta.text, "html.parser")
            pdf_url = encontrar_pdf(soup, link_origem)
        except Exception as exc:
            print(
                f"⚠️ Não foi possível recuperar PDF pela página: {exc}"
            )

    if not pdf_url:
        print("❌ PDF não encontrado para reprocessamento.")
        return False

    pdf_path = baixar_pdf(pdf_url)
    if not pdf_path:
        return False

    try:
        arquivo_gemini = gemini.files.upload(
            file=pdf_path,
            config={"mime_type": "application/pdf"},
        )

        materias = extrair_materias_cargo(
            pdf_path=pdf_path,
            cargo=cargo,
            arquivo_gemini=arquivo_gemini,
        )

        if not materias:
            print(
                "⚠️ Gemini não encontrou matérias. "
                "Registro NÃO será alterado."
            )
            return False

        (
            supabase.table("editais")
            .update({
                "materias": materias,
                "observacoes": f"Edital: {pdf_url}",
            })
            .eq("id", edital_id)
            .execute()
        )

        print(
            f"✅ ID={edital_id} atualizado com "
            f"{len(materias)} matérias."
        )
        return True

    except Exception as exc:
        print(
            f"❌ Erro no reprocessamento ID={edital_id}: {exc}"
        )
        return False

    finally:
        try:
            os.remove(pdf_path)
        except OSError:
            pass


def reprocessar_materias():
    registros = listar_editais_para_reprocessar()

    print(
        f"♻️ Registros sem conteúdo programático: "
        f"{len(registros)}"
    )

    sucesso = 0

    for item in registros:
        if reprocessar_registro(item):
            sucesso += 1
        time.sleep(SLEEP_SECONDS)

    print(
        f"\n🏁 Reprocessamento concluído: "
        f"{sucesso}/{len(registros)} atualizados."
    )


# ============================================================
# CRAWLER PRINCIPAL
# ============================================================

def listar_links_concursos() -> list[str]:
    resposta = baixar_pagina(ESTRATEGIA_URL)

    soup = BeautifulSoup(
        resposta.text,
        "html.parser",
    )

    links = set()

    for a in soup.find_all("a", href=True):
        href = urljoin(
            ESTRATEGIA_URL,
            a["href"],
        )

        if "/portal/concurso-" in href:
            links.add(href.rstrip("/"))

    return sorted(links)


def crawler_novos():
    try:
        links = listar_links_concursos()
    except Exception as exc:
        print(f"❌ Erro na listagem de concursos: {exc}")
        return 1

    print(
        f"📋 Concursos encontrados na listagem: {len(links)}"
    )

    processados = 0
    alterados = 0

    for link in links:
        if MAX_CONCURSOS > 0 and processados >= MAX_CONCURSOS:
            break

        try:
            qtd = processar_concurso(link)
            processados += 1
            alterados += qtd
        except Exception as exc:
            print(
                f"❌ Erro inesperado em {link}: {exc}"
            )

        time.sleep(SLEEP_SECONDS)

    print(
        f"\n🏁 Rodada concluída. "
        f"Concursos visitados: {processados}. "
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
            "reprocessar-materias = corrige registros existentes "
            "sem conteúdo programático."
        ),
    )

    args = parser.parse_args()

    if args.mode == "reprocessar-materias":
        reprocessar_materias()
        return 0

    return crawler_novos()


if __name__ == "__main__":
    sys.exit(main())
