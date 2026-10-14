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
# FUNÇÃO ANTI-FORMATAÇÃO MARKDOWN
# ============================================================

def limpar_url(u: str) -> str:
    if not u:
        return ""
    u = u.strip()
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
PCI_URL = limpar_url(
    os.getenv("PCI_URL", PROTO + "www.pciconcursos.com.br/concursos/")
)

_modelo_env = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL = "gemini-2.5-flash" if "3.8" in _modelo_env else _modelo_env

MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "1"))
MAX_CARGOS_POR_CONCURSO = int(os.getenv("MAX_CARGOS_POR_CONCURSO", "25"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "40"))
PDF_TIMEOUT = int(os.getenv("PDF_TIMEOUT", "90"))
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

sessao = requests.Session()
sessao.headers.update(HEADERS_PADRAO)


# ============================================================
# SCHEMAS PYDANTIC (SEPARAÇÃO POR CARGO + MATÉRIAS DO CARGO)
# ============================================================

class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome: str = Field(description="Nome formal da disciplina (ex: Língua Portuguesa, Conhecimentos Específicos).")
    peso: float | None = Field(default=1.0)
    topicos: list[str] = Field(
        default_factory=list,
        description="Lista de tópicos/assuntos cobrados dentro desta disciplina para este cargo.",
    )


class CargoDetalhado(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome_cargo: str = Field(description="Nome específico do cargo (ex: Guarda Civil Municipal, Analista Administrativo).")
    escolaridade: str = Field(default="Ensino Superior", description="Ex: Ensino Fundamental, Ensino Médio, Ensino Técnico, Ensino Superior.")
    vagas: int = Field(default=0, description="Quantidade de vagas para este cargo (soma de imediatas + CR se houver).")
    salario: float = Field(default=0.0, description="Salário/remuneração inicial deste cargo em reais (ex: 3450.00).")
    materias: list[Materia] = Field(
        default_factory=list,
        description="Conteúdo programático completo deste cargo (Conhecimentos Básicos comuns + Conhecimentos Específicos deste cargo).",
    )


class EditalCompletoExtraido(BaseModel):
    model_config = ConfigDict(extra="ignore")
    orgao: str = Field(description="Nome oficial do órgão público (ex: Prefeitura de Sobral - CE).")
    banca: str = Field(description="Nome da banca organizadora ou comissão do certame.")
    data_prova: str | None = Field(default=None, description="Data da prova objetiva no formato YYYY-MM-DD, se constar.")
    cargos: list[CargoDetalhado] = Field(
        default_factory=list,
        description="Lista de todos os cargos abertos neste edital, cada um com suas vagas, salário e conteúdo programático.",
    )


# ============================================================
# FUNÇÕES UTILITÁRIAS
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
    if any(t in texto for t in ("prefeitura", "câmara", "camara", "guarda municipal", "municipal", "saae", "fms")):
        return "Municipal"
    if any(t in texto for t in ("estadual", "polícia militar", "policia civil", "sefaz", "governo do estado", "tj", "detran", "ses ")):
        return "Estadual"
    return "Federal"


# ============================================================
# NÍVEL 1: LISTAR CONCURSOS ABERTOS NO PCI CONCURSOS (SEM 403!)
# ============================================================

def listar_concursos_abertos_pci() -> list[str]:
    print(f"🔎 Buscando editais abertos em: {PCI_URL}")
    resp = sessao.get(PCI_URL, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    links = []

    # No PCI Concursos, cada concurso aberto fica em uma div class="ca" com link para /noticias/...
    for div_ca in soup.select("div.ca"):
        a_tag = div_ca.find("a", href=True)
        if a_tag:
            href = limpar_url(a_tag["href"])
            url_completa = urljoin(PCI_URL, href)
            if "/noticias/" in url_completa and url_completa not in links:
                links.append(url_completa)

    # Fallback caso a classe mude: pega todos os links de notícias da página de Concursos Abertos
    if not links:
        for a_tag in soup.find_all("a", href=True):
            href = limpar_url(a_tag["href"])
            url_completa = urljoin(PCI_URL, href)
            if "pciconcursos.com.br/noticias/" in url_completa and url_completa not in links:
                links.append(url_completa)

    return links


# ============================================================
# NÍVEL 2: CAPTURAR OS PDFS DO EDITAL NA PÁGINA DA NOTÍCIA
# ============================================================

def obter_pdfs_do_concurso(soup: BeautifulSoup, url_noticia: str) -> list[str]:
    pdfs = []
    for a in soup.find_all("a", href=True):
        href = limpar_url(a["href"])
        texto = normalizar_texto(a.get_text(" ", strip=True)).lower()
        href_low = href.lower()

        if ".pdf" in href_low:
            # Ignora provas antigas ou manuais irrelevantes
            if any(ig in href_low for ig in ("prova", "gabarito", "termos", "privacidade")):
                continue
            url_pdf = urljoin(url_noticia, href)
            # Prioriza links que contenham "edital", "abertura" ou "anexo"
            if any(p in href_low or p in texto for p in ("edital", "abertura", "anexo", "retifica")):
                pdfs.insert(0, url_pdf)
            else:
                pdfs.append(url_pdf)

    # Remove duplicados mantendo a ordem
    return list(dict.fromkeys(pdfs))


def baixar_pdf_temporario(pdf_url: str) -> str | None:
    try:
        print(f"📥 Baixando PDF oficial do edital: {pdf_url}")
        resp = sessao.get(pdf_url, timeout=PDF_TIMEOUT, allow_redirects=True)
        resp.raise_for_status()

        if not resp.content[:1024].lstrip().startswith(b"%PDF"):
            print("⚠️ O arquivo baixado não é um PDF válido.")
            return None

        arq = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        arq.write(resp.content)
        arq.close()
        print(f"✓ PDF baixado com sucesso ({len(resp.content) / 1024:.1f} KB)")
        return arq.name
    except Exception as exc:
        print(f"⚠️ Erro ao baixar PDF ({pdf_url}): {exc}")
        return None


# ============================================================
# NÍVEL 3: EXTRAÇÃO COMPLETA POR CARGO VIA GEMINI 2.5 FLASH
# ============================================================

def extrair_cargos_e_materias_com_ia(caminhos_pdf: list[str], texto_noticia: str) -> EditalCompletoExtraido | None:
    prompt = """
Você é um especialista em análise de Editais de Concursos Públicos para a plataforma Gabarita PRO.
Analise a notícia e o(s) PDF(s) oficial(is) do Edital em anexo e extraia os dados estruturados:

REGRAS OBRIGATÓRIAS:
1. 'orgao': Nome limpo do órgão público (ex: Prefeitura de Sobral - CE).
2. 'banca': Nome da banca organizadora (se o concurso for organizado pela própria prefeitura/órgão, coloque 'Comissão Própria'). NUNCA coloque 'A definir'.
3. 'data_prova': Data da prova objetiva no formato YYYY-MM-DD (se houver).
4. 'cargos': Desmembre CADA CARGO do edital em um item separado na lista (máximo de 20 cargos principais).
5. Para CADA cargo, preencha:
   - 'nome_cargo': Nome exato do cargo/função.
   - 'escolaridade': Ensino Fundamental, Ensino Médio, Ensino Técnico ou Ensino Superior.
   - 'vagas': Total de vagas numéricas para este cargo.
   - 'salario': Valor numérico da remuneração/salário (ex: 3500.00).
   - 'materias': Lista completa de disciplinas cobradas PARA ESTE CARGO, unindo as matérias de Conhecimentos Básicos (comuns) + Conhecimentos Específicos daquele cargo, com todos os tópicos detalhados de cada matéria!
"""
    arquivos_gemini = []
    try:
        for path in caminhos_pdf[:2]:  # Envia até 2 PDFs (ex: Edital de Abertura + Anexo de Conteúdo Programático)
            if path and os.path.exists(path):
                up = gemini.files.upload(file=path, config={"mime_type": "application/pdf"})
                for _ in range(35):
                    estado = getattr(up.state, "name", str(up.state))
                    if estado == "ACTIVE":
                        break
                    time.sleep(2)
                    up = gemini.files.get(name=up.name)
                arquivos_gemini.append(up)

        conteudos = [*arquivos_gemini, f"Resumo da notícia:\n{texto_noticia[:15000]}\n\n{prompt}"]

        print("🤖 Analisando Edital com Gemini e separando cargos + conteúdos programáticos...")
        resposta = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=conteudos,
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=EditalCompletoExtraido,
                max_output_tokens=65536,
            ),
        )

        dados = parse_json_resposta(resposta.text)
        return EditalCompletoExtraido.model_validate(dados)

    except Exception as exc:
        print(f"❌ Erro na extração com Gemini: {exc}")
        return None
    finally:
        for arq in arquivos_gemini:
            try:
                gemini.files.delete(name=arq.name)
            except Exception:
                pass


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
# PROCESSAMENTO DE CADA CONCURSO ABERTO
# ============================================================

def processar_concurso(url_noticia: str):
    print("\n" + "=" * 80)
    print(f"🌐 Processando Concurso Aberto: {url_noticia}")
    print("=" * 80)

    try:
        resp = sessao.get(url_noticia, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        print(f"❌ Falha ao abrir notícia ({url_noticia}): {exc}")
        return

    soup = BeautifulSoup(resp.text, "html.parser")
    texto_noticia = normalizar_texto(soup.get_text("\n", strip=True))

    urls_pdfs = obter_pdfs_do_concurso(soup, url_noticia)
    if not urls_pdfs:
        print("⏭️ Ignorado: Nenhum PDF de edital encontrado nesta página.")
        return

    caminhos_pdf_baixados = []
    for pdf_url in urls_pdfs[:2]:
        caminho = baixar_pdf_temporario(pdf_url)
        if caminho:
            caminhos_pdf_baixados.append(caminho)

    if not caminhos_pdf_baixados:
        print("⏭️ Ignorado: Não foi possível baixar o PDF oficial do edital.")
        return

    try:
        edital_extraido = extrair_cargos_e_materias_com_ia(caminhos_pdf_baixados, texto_noticia)
        if not edital_extraido or not edital_extraido.cargos:
            print("⚠️ A IA não retornou cargos válidos para este edital.")
            return

        print(f"✓ Órgão: {edital_extraido.orgao} | Banca: {edital_extraido.banca} | Prova: {edital_extraido.data_prova}")
        print(f"✓ Cargos extraídos individualmente: {len(edital_extraido.cargos)}")

        for idx, cargo_obj in enumerate(edital_extraido.cargos[:MAX_CARGOS_POR_CONCURSO], start=1):
            nome_cargo = normalizar_texto(cargo_obj.nome_cargo)
            if not nome_cargo:
                continue

            materias_formatadas = []
            for m in cargo_obj.materias:
                if m.nome and m.nome.strip():
                    materias_formatadas.append({
                        "nome": m.nome.strip(),
                        "peso": m.peso or 1.0,
                        "topicos": [t.strip() for t in m.topicos if t and t.strip()],
                    })

            payload = {
                "titulo": f"{edital_extraido.orgao} - {nome_cargo}"[:255],
                "orgao": edital_extraido.orgao[:255],
                "banca": (edital_extraido.banca or "Comissão Própria")[:100],
                "vagas": cargo_obj.vagas or 0,
                "salario_maximo": cargo_obj.salario or 0.0,
                "escolaridade": (cargo_obj.escolaridade or "Ensino Superior")[:100],
                "link_origem": url_noticia,
                "cargo": nome_cargo[:255],
                "esfera": identificar_esfera(edital_extraido.orgao)[:50],
                "status": "Edital Publicado",
                "data_prova": normalizar_texto(edital_extraido.data_prova) or None,
                "observacoes": f"Edital PDF: {urls_pdfs[0]}",
            }

            print(f"➡️ [{idx}/{len(edital_extraido.cargos)}] Salvando cargo: {nome_cargo} | Vagas: {cargo_obj.vagas} | R$ {cargo_obj.salario} | {len(materias_formatadas)} matérias")
            salvar_no_banco(payload, materias_formatadas)

    finally:
        for path in caminhos_pdf_baixados:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


def main():
    links = listar_concursos_abertos_pci()
    print(f"📋 Concursos ABERTOS encontrados no PCI Concursos: {len(links)}")

    if not links:
        print("❌ Nenhum link encontrado.")
        return 1

    for link in links[:MAX_CONCURSOS]:
        processar_concurso(link)
        time.sleep(SLEEP_SECONDS)

    print("\n🏁 Execução concluída com sucesso!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
