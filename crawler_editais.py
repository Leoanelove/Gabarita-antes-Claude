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
PCI_HOME_URL = PROTO + "www.pciconcursos.com.br/"
# Página geral de concursos (engloba abertos, inscrições em andamento, etc.)
PCI_CONCURSOS_URL = limpar_url(
    os.getenv("PCI_URL", PROTO + "www.pciconcursos.com.br/concursos/")
)

_modelo_env = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL = "gemini-2.5-flash" if "3.8" in _modelo_env else _modelo_env

MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "2"))
MAX_CARGOS_POR_CONCURSO = int(os.getenv("MAX_CARGOS_POR_CONCURSO", "25"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "40"))
PDF_TIMEOUT = int(os.getenv("PDF_TIMEOUT", "90"))
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "2"))

# Termos para ignorar processos seletivos temporários, estágio, etc.
TERMOS_NAO_CONCURSO = (
    "processo-seletivo",
    "processo seletivo",
    "seletivo simplificado",
    "temporario",
    "temporário",
    "temporarios",
    "temporários",
    "oficiais-temporarios",
    "servico-militar-voluntario",
    "serviço militar voluntário",
    "estagiario",
    "estagiário",
    "estagio",
    "estágio",
    "credenciamento",
    "residencia",
    "residência",
    "bolsista",
    "professor-substituto",
    "professor substituto",
)

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
# SCHEMAS PYDANTIC
# ============================================================

class Materia(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome: str = Field(description="Nome formal da disciplina (ex: Língua Portuguesa, Legislação Específica).")
    peso: float | None = Field(default=1.0)
    topicos: list[str] = Field(
        default_factory=list,
        description="Lista detalhada de tópicos/assuntos cobrados dentro desta disciplina para este cargo.",
    )


class CargoDetalhado(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nome_cargo: str = Field(description="Nome específico do cargo (ex: Auxiliar Administrativo, Fiscal Biólogo).")
    escolaridade: str = Field(default="Ensino Superior", description="Ensino Fundamental, Ensino Médio, Ensino Técnico ou Ensino Superior.")
    vagas: int = Field(default=0, description="Quantidade total de vagas para este cargo (imediatas + CR se informado).")
    salario: float = Field(default=0.0, description="Salário/remuneração inicial deste cargo em reais (ex: 7181.00).")
    materias: list[Materia] = Field(
        default_factory=list,
        description="Conteúdo programático completo deste cargo (unindo Conhecimentos Básicos/Gerais + Conhecimentos Específicos).",
    )


class EditalCompletoExtraido(BaseModel):
    model_config = ConfigDict(extra="ignore")
    eh_concurso_publico: bool = Field(
        default=True,
        description="True se for Concurso Público efetivo/estatutário/CLT. False se for Processo Seletivo Temporário ou Estágio.",
    )
    orgao: str = Field(description="Nome oficial do órgão público (ex: CRBio-01 - Conselho Regional de Biologia da 1ª Região).")
    banca: str = Field(description="Nome da banca organizadora (ex: Vunesp, Quadrix, Cebraspe, FGV, IBFC).")
    data_prova: str | None = Field(default=None, description="Data da prova objetiva no formato YYYY-MM-DD, se constar.")
    cargos: list[CargoDetalhado] = Field(
        default_factory=list,
        description="Lista de todos os cargos abertos neste edital, cada um com suas vagas, salário e conteúdo programático separado.",
    )


# ============================================================
# FUNÇÕES UTILITÁRIAS E VALIDAÇÃO
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


def validar_se_eh_concurso_publico(url_noticia: str, texto_capa: str = "", titulo_noticia: str = "") -> tuple[bool, str]:
    slug = url_noticia.lower()
    combinado = f"{slug} {texto_capa.lower()} {titulo_noticia.lower()}"

    for termo in TERMOS_NAO_CONCURSO:
        if termo in slug or termo in titulo_noticia.lower():
            return False, f"Identificado como Processo Seletivo/Temporário ('{termo}')"

    for termo_cancel in ("-suspende-", "-cancela-", "-anula-"):
        if termo_cancel in slug:
            return False, f"Notícia de suspensão/cancelamento ('{termo_cancel}')"

    if titulo_noticia and "concurso" not in combinado:
        return False, "O título não indica ser um Concurso Público"

    return True, "OK"


# ============================================================
# NÍVEL 1: LISTAR TODOS OS CONCURSOS (ABERTOS, EM ANDAMENTO, ETC.)
# ============================================================

def listar_concursos_abertos_pci() -> list[dict]:
    print(f"🏠 [Passo 1] Acessando página inicial: {PCI_HOME_URL}")
    sessao.get(PCI_HOME_URL, timeout=REQUEST_TIMEOUT)

    print(f"🔎 [Passo 2] Acessando listagem geral de concursos em andamento: {PCI_CONCURSOS_URL}")
    resp = sessao.get(PCI_CONCURSOS_URL, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    itens_lista = []
    urls_vistas = set()

    # Varre blocos de concursos na página (div.ca, tabelas e listas de links)
    seletores = ["div.ca", "table tr", "ul.list li", "div.es", "div.estados"]
    
    for seletor in seletores:
        for elemento in soup.select(seletor):
            for a_tag in elemento.find_all("a", href=True):
                href = limpar_url(a_tag["href"])
                url_completa = urljoin(PCI_CONCURSOS_URL, href)
                
                # Deve ser link de notícia do PCI e não pode estar duplicado
                if "/noticias/" not in url_completa or url_completa in urls_vistas:
                    continue

                nome_orgao_capa = normalizar_texto(a_tag.get_text(" ", strip=True))
                resumo_capa = normalizar_texto(elemento.get_text(" ", strip=True))

                # Ignora links irrelevantes de rodapé ou navegação
                if len(nome_orgao_capa) < 5 or "concursos" in nome_orgao_capa.lower() and len(nome_orgao_capa) < 15:
                    continue

                urls_vistas.add(url_completa)
                itens_lista.append({
                    "orgao_capa": nome_orgao_capa,
                    "resumo_capa": resumo_capa,
                    "url": url_completa,
                })

    print(f"📋 Total de links de concursos identificados na listagem: {len(itens_lista)}")
    return itens_lista


# ============================================================
# NÍVEL 2: LOCALIZAR O EDITAL (PDF) DENTRO DA PÁGINA
# ============================================================

def obter_pdfs_do_concurso(html_bruto: str, soup: BeautifulSoup, url_noticia: str) -> list[str]:
    pdfs_edital = []
    pdfs_anexos = []

    def registrar_pdf(url_candidata: str, contexto: str = ""):
        u = limpar_url(url_candidata)
        if not u:
            return
        u_full = urljoin(url_noticia, u)
        u_low = u_full.lower()
        ctx_low = contexto.lower()

        if any(ig in u_low for ig in ("prova", "gabarito", "termos", "privacidade", "apostila", "simulado")):
            return

        if any(p in u_low or p in ctx_low for p in ("edital", "abertura", "completo")):
            if u_full not in pdfs_edital:
                pdfs_edital.append(u_full)
        else:
            if u_full not in pdfs_anexos and u_full not in pdfs_edital:
                pdfs_anexos.append(u_full)

    for tag in soup.find_all(["a", "li", "div", "span"]):
        texto_tag = normalizar_texto(tag.get_text(" ", strip=True))
        for attr in ("href", "data-url", "data-href", "src"):
            val = tag.get(attr)
            if isinstance(val, str) and ".pdf" in val.lower():
                registrar_pdf(val, texto_tag)

    for match in re.findall(r"https?://[^\s\"'<>]+?\.pdf", html_bruto, flags=re.IGNORECASE):
        registrar_pdf(match, match)

    return pdfs_edital + pdfs_anexos


def baixar_pdf_temporario(pdf_url: str) -> str | None:
    try:
        print(f"📥 Baixando PDF oficial do edital: {pdf_url}")
        headers_pdf = {**HEADERS_PADRAO, "Referer": PCI_CONCURSOS_URL}
        resp = sessao.get(pdf_url, headers=headers_pdf, timeout=PDF_TIMEOUT, allow_redirects=True)
        resp.raise_for_status()

        if not resp.content[:1024].lstrip().startswith(b"%PDF"):
            print("⚠️ O link retornado não é um arquivo PDF válido.")
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
# NÍVEL 3: EXTRAIR VAGAS, CARGOS E CONTEÚDO PROGRAMÁTICO (GEMINI)
# ============================================================

def extrair_cargos_e_materias_com_ia(caminhos_pdf: list[str], texto_noticia: str, resumo_capa: str) -> EditalCompletoExtraido | None:
    prompt = f"""
Você é um especialista em análise de Editais de Concursos Públicos para a plataforma Gabarita PRO.
Analise os dados da notícia e o(s) PDF(s) oficial(is) do Edital em anexo.

Dados da listagem: {resumo_capa}

REGRAS OBRIGATÓRIAS:
1. 'eh_concurso_publico': Marque True se for um Concurso Público efetivo. Se o PDF for apenas de Processo Seletivo Simplificado/Temporário ou Estágio, marque False.
2. 'orgao': Nome limpo do órgão público (ex: CRBio-01 - Conselho Regional de Biologia da 1ª Região).
3. 'banca': Nome da banca organizadora (ex: Vunesp, Quadrix, Cebraspe, FGV, IBFC).
4. 'data_prova': Data da prova objetiva no formato YYYY-MM-DD (se houver).
5. 'cargos': Crie um item separado para CADA CARGO previsto no edital.
6. Para CADA cargo, extraia:
   - 'nome_cargo': Nome exato do cargo.
   - 'escolaridade': Ensino Fundamental, Ensino Médio, Ensino Técnico ou Ensino Superior.
   - 'vagas': Total de vagas numéricas para este cargo (se for apenas Cadastro de Reserva, coloque 0).
   - 'salario': Valor numérico do salário inicial deste cargo em reais (ex: 7181.00).
   - 'materias': Extraia TODO o CONTEÚDO PROGRAMÁTICO deste cargo! Una as disciplinas de Conhecimentos Básicos/Gerais (comuns) + Conhecimentos Específicos daquele cargo, listando cada matéria e todos os seus tópicos separados dentro de 'topicos'.
"""
    arquivos_gemini = []
    try:
        for path in caminhos_pdf[:2]:
            if path and os.path.exists(path):
                up = gemini.files.upload(file=path, config={"mime_type": "application/pdf"})
                for _ in range(35):
                    estado = getattr(up.state, "name", str(up.state))
                    if estado == "ACTIVE":
                        break
                    time.sleep(2)
                    up = gemini.files.get(name=up.name)
                arquivos_gemini.append(up)

        conteudos = [*arquivos_gemini, f"Texto da notícia:\n{texto_noticia[:15000]}\n\n{prompt}"]

        print("🤖 Extraindo cargos, vagas, salários e conteúdo programático do Edital com Gemini...")
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
# EXECUÇÃO DO ROBÔ
# ============================================================

def processar_item_da_lista(item: dict) -> bool:
    url_noticia = item["url"]
    orgao_capa = item["orgao_capa"]
    resumo_capa = item["resumo_capa"]

    print("\n" + "=" * 80)
    print(f"👉 Analisando item: {orgao_capa}")
    print(f"🔗 URL: {url_noticia}")

    valido_url, motivo_url = validar_se_eh_concurso_publico(url_noticia, resumo_capa)
    if not valido_url:
        print(f"↩️ [Ignorado] {motivo_url}. Passando para o próximo...")
        return False

    try:
        resp = sessao.get(url_noticia, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        print(f"❌ Falha ao abrir página ({url_noticia}): {exc}. Passando para o próximo...")
        return False

    soup = BeautifulSoup(resp.text, "html.parser")
    h1_tag = soup.find("h1")
    titulo_noticia = normalizar_texto(h1_tag.get_text(" ", strip=True) if h1_tag else "")
    texto_noticia = normalizar_texto(soup.get_text("\n", strip=True))

    valido_titulo, motivo_titulo = validar_se_eh_concurso_publico(url_noticia, resumo_capa, titulo_noticia)
    if not valido_titulo:
        print(f"↩️ [Ignorado] ('{titulo_noticia}' -> {motivo_titulo}). Passando para o próximo...")
        return False

    urls_pdfs = obter_pdfs_do_concurso(resp.text, soup, url_noticia)
    if not urls_pdfs:
        print("↩️ [Ignorado] Nenhum PDF de edital encontrado nesta página. Passando para o próximo...")
        return False

    print(f"✅ Concurso Público confirmado: '{titulo_noticia}'")
    print(f"📎 Edital PDF localizado: {urls_pdfs[0]}")

    caminhos_pdf_baixados = []
    for pdf_url in urls_pdfs[:2]:
        caminho = baixar_pdf_temporario(pdf_url)
        if caminho:
            caminhos_pdf_baixados.append(caminho)

    if not caminhos_pdf_baixados:
        print("↩️ [Ignorado] Não foi possível baixar o PDF. Passando para o próximo...")
        return False

    try:
        edital_extraido = extrair_cargos_e_materias_com_ia(caminhos_pdf_baixados, texto_noticia, resumo_capa)
        if not edital_extraido:
            print("↩️ [Ignorado] Falha ao extrair dados do PDF. Passando para o próximo...")
            return False

        if not edital_extraido.eh_concurso_publico:
            print("↩️ [Ignorado] A leitura do PDF indicou ser Processo Seletivo Temporário. Passando para o próximo...")
            return False

        if not edital_extraido.cargos:
            print("↩️ [Ignorado] Nenhum cargo identificado no edital. Passando para o próximo...")
            return False

        print(f"✓ Órgão: {edital_extraido.orgao} | Banca: {edital_extraido.banca} | Prova: {edital_extraido.data_prova}")
        print(f"✓ Cargos encontrados no edital: {len(edital_extraido.cargos)}")

        cargos_salvos = 0
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

            if not materias_formatadas:
                print(f"   ⚠️ Cargo '{nome_cargo}' sem conteúdo programático detalhado no PDF, pulando linha...")
                continue

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

            print(
                f"➡️ [{idx}/{len(edital_extraido.cargos)}] Salvando linha para o cargo: {nome_cargo} "
                f"| Vagas: {cargo_obj.vagas} | Salário: R$ {cargo_obj.salario} | {len(materias_formatadas)} matérias"
            )
            salvar_no_banco(payload, materias_formatadas)
            cargos_salvos += 1

        return cargos_salvos > 0

    finally:
        for path in caminhos_pdf_baixados:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


def main():
    itens = listar_concursos_abertos_pci()
    if not itens:
        print("❌ Nenhum item encontrado na listagem.")
        return 1

    concursos_salvos = 0
    verificados = 0
    limite_verificacao = max(MAX_CONCURSOS * 20, 60)

    for item in itens:
        if concursos_salvos >= MAX_CONCURSOS:
            break
        if verificados >= limite_verificacao:
            print(f"⚠️ Limite de segurança atingido ({limite_verificacao} itens verificados).")
            break

        verificados += 1
        sucesso = processar_item_da_lista(item)
        if sucesso:
            concursos_salvos += 1
            print(f"\n🎯 Progresso: {concursos_salvos}/{MAX_CONCURSOS} Concursos Públicos completos salvos no Supabase!")

        time.sleep(SLEEP_SECONDS)

    print(f"\n🏁 Execução concluída! Total de Concursos Públicos processados: {concursos_salvos}/{MAX_CONCURSOS}")
    return 0 if concursos_salvos > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
