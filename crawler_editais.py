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

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_KEY.")

if not GEMINI_API_KEY:
    raise RuntimeError("Defina GEMINI_API_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
gemini = genai.Client(api_key=GEMINI_API_KEY)

# Usa curl_cffi para contornar proteções TLS/Cloudflare quando disponível
try:
    from curl_cffi import requests as _http_chrome

    sessao = _http_chrome.Session(impersonate="chrome")
    print("🌐 Usando curl_cffi (impersonando Chrome).")
except ImportError:
    sessao = requests.Session()
    sessao.headers.update(HEADERS)
    print("⚠️ curl_cffi não instalado; usando requests comum.")


# ============================================================
# MODELOS DE RESPOSTA DO GEMINI
# ============================================================

class Cargo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nome_cargo: str = Field(description="Nome exato da carreira, cargo ou especialidade.")
    vagas: int | None = Field(
        default=None,
        description="Total numérico de vagas imediatas + cotas + PcD do cargo (0 se apenas CR); null se não informado.",
    )
    salario: float | None = Field(
        default=None,
        description="Remuneração bruta inicial em reais (apenas número, ex: 6420.50); null se não informado.",
    )
    escolaridade: str | None = Field(
        default=None,
        description="Nível de escolaridade exigido (ex: Superior, Médio, Técnico, Fundamental); null se não informado.",
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
    peso: float | None = Field(default=1.0, description="Peso da disciplina, se especificado no edital.")
    topicos: list[str] = Field(default_factory=list, description="Lista textual de tópicos e subtópicos da matéria.")


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
    """Executa chamadas estruturadas ao Gemini com fallback de modelo e retries."""
    ultimo_
