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
