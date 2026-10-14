import json
import os
import re
import sys
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from supabase import create_client

def limpar_url(u: str) -> str:
    if not u:
        return ""
    u = u.strip()
    m = re.match(r"^\[.*?\]\((https?://[^\)]+)\)(.*)$", u)
    if m:
        return m.group(1) + m.group(2)
    u = re.sub(r"\[https?://[^\]]+\]\((https?://[^\)]+)\)", r"\1", u)
    return u.strip("[]()")

SUPABASE_URL = limpar_url(os.getenv("SUPABASE_URL", ""))
SUPABASE_KEY = limpar_url(os.getenv("SUPABASE_SERVICE_KEY", ""))

PCI_HOME_URL = "https" + "://" + "www.pciconcursos.com.br/"
PCI_CONCURSOS_URL = PCI_HOME_URL + "concursos/"

MAX_CONCURSOS = int(os.getenv("MAX_CONCURSOS", "2"))
MAX_CARGOS_POR_CONCURSO = int(os.getenv("MAX_CARGOS_POR_CONCURSO", "25"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "45"))
SLEEP_SECONDS = float(os.getenv("SLEEP_SECONDS", "2"))

TERMOS_NAO_CONCURSO = (
    "processo-seletivo", "processo seletivo", "seletivo simplificado",
    "temporario", "temporário", "temporarios", "temporários",
    "oficiais-temporarios", "servico-militar-voluntario", "serviço militar voluntário",
    "estagiario", "estagiário", "estagio", "estágio",
    "credenciamento", "residencia", "residência", "bolsista",
    "professor-substituto", "professor substituto",
)

HEADERS_PADRAO = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
sessao = requests.Session()
sessao.headers.update(HEADERS_PADRAO)

def normalizar_texto(texto: str | None) -> str:
    if not texto:
        return ""
    texto = texto.replace("\xa0", " ")
    return re.sub(r"\s+", " ", texto).strip()

def identificar_esfera(orgao: str) -> str:
    texto = normalizar_texto(orgao).lower()
    if any(t in texto for t in ("prefeitura", "câmara", "camara", "municipal", "saae", "fms")):
        return "Municipal"
    if any(t in texto for t in ("estadual", "polícia", "policia", "sefaz", "governo do estado", "tj", "detran")):
        return "Estadual"
    return "Federal"

def validar_se_eh_concurso_publico(url_noticia: str, texto_capa: str = "", titulo_noticia: str = "") -> tuple[bool, str]:
    slug = url_noticia.lower()
    combinado = f"{slug} {texto_capa.lower()} {titulo_noticia.lower()}"
    for termo in TERMOS_NAO_CONCURSO:
        if termo in slug or termo in titulo_noticia.lower():
            return False, f"Processo Seletivo/Temporário ('{termo}')"
    for termo_cancel in ("-suspende-", "-cancela-", "-anula-"):
        if termo_cancel in slug:
            return False, "Suspensão/Cancelamento"
    if titulo_noticia and "concurso" not in combinado:
        return False, "Não é Concurso Público"
    return True, "OK"

def listar_concursos_abertos_pci() -> list[dict]:
    print(f"🏠 Acessando listagem do PCI: {PCI_CONCURSOS_URL}")
    resp = sessao.get(PCI_CONCURSOS_URL, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    itens = []
    vistas = set()

    for div_ca in soup.select("div.ca, table tr, ul.list li"):
        a_tag = div_ca.find("a", href=True)
        if not a_tag:
            continue
        url = urljoin(PCI_CONCURSOS_URL, limpar_url(a_tag["href"]))
        if "/noticias/" not in url or url in vistas:
            continue
        orgao = normalizar_texto(a_tag.get_text(" ", strip=True))
        resumo = normalizar_texto(div_ca.get_text(" ", strip=True))
        if len(orgao) < 5:
            continue
        vistas.add(url)
        itens.append({"orgao_capa": orgao, "resumo_capa": resumo, "url": url})

    print(f"📋 Total de links identificados: {len(itens)}")
    return itens

def extrair_dados_via_regex_html(texto_noticia: str, orgao_capa: str) -> dict:
    """Extrai informações básicas sem gastar IA, usando puro Python (Regex/BeautifulSoup)."""
    
    # Órgão
    orgao = orgao_capa.split("-")[0].strip() if "-" in orgao_capa else orgao_capa[:100]
    
    # Banca
    banca = "Comissão Própria"
    match_banca = re.search(r"banca[:\s]+([^\n\.,]+)", texto_noticia, re.IGNORECASE)
    if match_banca:
        banca = match_banca.group(1).strip()[:100]

    # Salário
    salario = 0.0
    match_salario = re.search(r"R\$\s*([\d\.,]+)", texto_noticia)
    if match_salario:
        try:
            salario = float(match_salario.group(1).replace(".", "").replace(",", "."))
        except ValueError:
            pass

    # Vagas
    vagas = 0
    match_vagas = re.search(r"(\d+)\s+vagas", texto_noticia, re.IGNORECASE)
    if match_vagas:
        try:
            vagas = int(match_vagas.group(1))
        except ValueError:
            pass

    # Data da prova
    data_prova = None
    match_data = re.search(r"(?:provas em|data da prova)[:\s]+(\d{2}/\d{2}/\d{4})", texto_noticia, re.IGNORECASE)
    if match_data:
        partes = match_data.group(1).split("/")
        if len(partes) == 3:
            data_prova = f"{partes[2]}-{partes[1]}-{partes[0]}"

    # Cargo principal extraído do título/texto
    cargo_nome = "Geral / Vários Cargos"
    match_cargo = re.search(r"cargo[s]?[:\s]+([^\n\.]+)", texto_noticia, re.IGNORECASE)
    if match_cargo:
        cargo_nome = normalizar_texto(match_cargo.group(1))[:255]

    return {
        "orgao": orgao,
        "banca": banca,
        "salario": salario,
        "vagas": vagas,
        "data_prova": data_prova,
        "cargos": [{
            "nome_cargo": cargo_nome,
            "escolaridade": "Ensino Superior",
            "vagas": vagas,
            "salario": salario,
            "materias": [{"nome": "Conhecimentos Básicos", "peso": 1.0, "topicos": ["Língua Portuguesa", "Matemática", "Conhecimentos Gerais"]}]
        }]
    }

def salvar_no_banco(payload: dict, materias: list[dict]):
    try:
        resp = supabase.table("editais").select("id").ilike("orgao", f"%{payload['orgao'][:50]}%").ilike("cargo", f"%{payload['cargo'][:50]}%").limit(1).execute()
        if resp.data:
            supabase.table("editais").update({**payload, "materias": materias}).eq("id", resp.data[0]["id"]).execute()
            print(f"   🔄 Atualizado no Supabase: {payload['orgao']} -> {payload['cargo']}")
        else:
            supabase.table("editais").insert({**payload, "materias": materias}).execute()
            print(f"   🆕 Inserido no Supabase: {payload['orgao']} -> {payload['cargo']} ({len(materias)} matérias)")
    except Exception as exc:
        print(f"   ❌ Erro ao salvar no Supabase: {exc}")

def processar_item(item: dict) -> bool:
    url = item["url"]
    print(f"\n👉 Analisando: {item['orgao_capa']}\n🔗 {url}")

    valido, motivo = validar_se_eh_concurso_publico(url, item["resumo_capa"])
    if not valido:
        print(f"↩️ Ignorado ({motivo}).")
        return False

    try:
        resp = sessao.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception:
        return False

    soup = BeautifulSoup(resp.text, "html.parser")
    h1 = soup.find("h1")
    titulo = normalizar_texto(h1.get_text(" ", strip=True) if h1 else "")
    texto = normalizar_texto(soup.get_text("\n", strip=True))

    valido_t, motivo_t = validar_se_eh_concurso_publico(url, item["resumo_capa"], titulo)
    if not valido_t:
        print(f"↩️ Ignorado ({motivo_t}).")
        return False

    print(f"✅ Concurso confirmado: '{titulo or item['orgao_capa']}'")
    
    # Extração 100% gratuita via Python puro (sem IA, sem erro 429, sem erro 503)
    dados = extrair_dados_via_regex_html(texto, item["orgao_capa"])
    
    print(f"✓ Órgão: {dados['orgao']} | Banca: {dados['banca']} | Salário: R$ {dados['salario']} | Vagas: {dados['vagas']}")

    salvos = 0
    for idx, c in enumerate(dados["cargos"][:MAX_CARGOS_POR_CONCURSO], start=1):
        nome_cargo = normalizar_texto(c["nome_cargo"])
        if not nome_cargo:
            continue
        
        mats = [{"nome": m["nome"], "peso": m["peso"], "topicos": m["topicos"]} for m in c["materias"]]

        payload = {
            "titulo": f"{dados['orgao']} - {nome_cargo}"[:255],
            "orgao": dados["orgao"][:255],
            "banca": dados["banca"][:100],
            "vagas": c["vagas"],
            "salario_maximo": c["salario"],
            "escolaridade": c["escolaridade"][:100],
            "link_origem": url,
            "cargo": nome_cargo[:255],
            "esfera": identificar_esfera(dados["orgao"])[:50],
            "status": "Edital Publicado",
            "data_prova": dados["data_prova"],
            "observacoes": f"Fonte PCI Concursos: {url}",
        }
        salvar_no_banco(payload, mats)
        salvos += 1

    return salvos > 0

def main():
    itens = listar_concursos_abertos_pci()
    if not itens:
        return 1

    salvos = 0
    verificados = 0
    for item in itens:
        if salvos >= MAX_CONCURSOS:
            break
        if verificados >= 40:
            break
        verificados += 1
        if processar_item(item):
            salvos += 1
            print(f"\n🎯 Progresso: {salvos}/{MAX_CONCURSOS} concursos salvos!")
        time.sleep(SLEEP_SECONDS)

    print(f"\n🏁 Fim da execução. Total salvos: {salvos}/{MAX_CONCURSOS}")
    return 0 if salvos > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
