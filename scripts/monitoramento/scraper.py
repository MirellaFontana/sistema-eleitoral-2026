"""
Monitoramento web com Scrapling — busca menções em portais de notícias e sites públicos.

Uso:
    python scraper.py                     # roda para todas as campanhas
    python scraper.py --campanha UUID     # roda para uma campanha específica

Variáveis de ambiente (.env na raiz do projeto ou sistema):
    SUPABASE_URL          — URL do projeto Supabase
    SUPABASE_SERVICE_KEY  — service_role key (não anon!)
"""

import os
import re
import sys
import json
import hashlib
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

# .env na raiz do projeto
load_dotenv(Path(__file__).resolve().parent.parent.parent / "apps" / "web" / ".env.local")
load_dotenv(Path(__file__).resolve().parent.parent.parent / "apps" / "web" / ".env")

from scrapling import Fetcher, StealthyFetcher
from supabase import create_client


def get_supabase():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def buscar_google_news(termo: str, fetcher: Fetcher) -> list[dict]:
    """Busca no Google News via RSS com Scrapling (mais robusto que fetch simples)."""
    query = f'"{termo}"'
    url = f"https://news.google.com/rss/search?q={query}&hl=pt-BR&gl=BR&ceid=BR:pt-419"

    try:
        page = fetcher.get(url)
        items = page.find_all("item")

        resultados = []
        semana_atras = datetime.now(timezone.utc) - timedelta(days=7)

        for item in items[:20]:
            titulo_el = item.find("title")
            pub_el = item.find("pubdate")
            fonte_el = item.find("source")

            titulo = titulo_el.text.strip() if titulo_el else ""
            # <link> is void in HTML, so URL becomes sibling text — extract via regex
            link_match = re.search(r"<link/?>([^<]+)", str(item))
            link = link_match.group(1).strip() if link_match else ""
            pub_date = pub_el.text.strip() if pub_el else None
            fonte = fonte_el.text.strip() if fonte_el else ""

            if not titulo or not link:
                continue

            resultados.append({
                "titulo": titulo,
                "link": link,
                "fonte": fonte,
                "publicadoEm": pub_date,
            })

        return resultados[:15]
    except Exception as e:
        print(f"  Erro Google News para '{termo}': {e}")
        return []


def buscar_portal(url: str, termo: str, fetcher: Fetcher) -> list[dict]:
    """Scrape genérico de portal de notícias — busca links que mencionem o termo."""
    try:
        page = fetcher.get(url, timeout=15)
        resultados = []
        termo_lower = termo.lower()

        for link in page.find_all("a"):
            texto = link.text.strip() if link.text else ""
            href = link.attrib.get("href", "")

            if not texto or len(texto) < 15:
                continue

            if termo_lower in texto.lower():
                if href and not href.startswith(("#", "javascript:")):
                    if not href.startswith("http"):
                        href = url.rstrip("/") + "/" + href.lstrip("/")
                    resultados.append({
                        "titulo": texto[:200],
                        "link": href,
                        "fonte": url,
                        "publicadoEm": None,
                    })

        return resultados[:10]
    except Exception as e:
        print(f"  Erro scraping {url}: {e}")
        return []


PORTAIS_PADRAO = [
    # Nacionais
    "https://g1.globo.com",
    "https://www.uol.com.br/noticias",
    "https://noticias.r7.com",
    "https://www.terra.com.br/noticias",
    "https://www.folha.uol.com.br",
    "https://www.estadao.com.br",
    "https://www.cartacapital.com.br",
    "https://www.metropoles.com",
    "https://www.poder360.com.br",
    "https://www.correiobraziliense.com.br",
    "https://congressoemfoco.uol.com.br",
    "https://revistaforum.com.br",
    "https://www.brasildefato.com.br",
    "https://www.gazetadopovo.com.br",
    # Paraná / regionais
    "https://www.bandab.com.br",
    "https://www.bemparana.com.br",
    "https://www.tribunapr.com.br",
    "https://www.cbnlondrina.com.br",
    "https://arede.info",
    "https://www.plural.jor.br",
    "https://www.ricmais.com.br",
]

REDES_SOCIAIS = [
    ("x.com", "X (Twitter)"),
    ("youtube.com", "YouTube"),
    ("instagram.com", "Instagram"),
    ("facebook.com", "Facebook"),
    ("tiktok.com", "TikTok"),
    ("threads.net", "Threads"),
    ("bsky.app", "Bluesky"),
]


def buscar_redes_sociais(termo: str, fetcher: Fetcher) -> list[dict]:
    """Busca menções em redes sociais via Google News RSS com site: filter por rede."""
    from urllib.parse import quote_plus

    resultados = []

    for dominio, nome_rede in REDES_SOCIAIS:
        query = f'"{termo}" site:{dominio}'
        url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419"

        try:
            page = fetcher.get(url, timeout=15)
            items = page.find_all("item")

            for item in items[:10]:
                titulo_el = item.find("title")
                pub_el = item.find("pubdate")

                titulo = titulo_el.text.strip() if titulo_el else ""
                link_match = re.search(r"<link/?>([^<]+)", str(item))
                link = link_match.group(1).strip() if link_match else ""
                pub_date = pub_el.text.strip() if pub_el else None

                if not titulo or not link:
                    continue

                resultados.append({
                    "titulo": titulo[:200],
                    "link": link,
                    "fonte": nome_rede,
                    "publicadoEm": pub_date,
                })
        except Exception as e:
            print(f"    Erro {nome_rede} para '{termo}': {e}")

    # Deduplicar por link
    vistos = set()
    unicos = []
    for r in resultados:
        if r["link"] not in vistos:
            vistos.add(r["link"])
            unicos.append(r)

    return unicos[:30]


def executar_campanha(supabase, campanha_id: str, nome_candidato: str | None):
    """Executa monitoramento para uma campanha."""
    print(f"\n{'='*60}")
    print(f"Campanha: {nome_candidato or campanha_id}")
    print(f"{'='*60}")

    # Buscar termos ativos
    res = supabase.table("termos_monitoramento") \
        .select("id, termo, rotulo") \
        .eq("campanha_id", campanha_id) \
        .eq("ativo", True) \
        .execute()

    termos = res.data or []
    if not termos:
        print("  Sem termos de monitoramento ativos. Pulando.")
        return

    print(f"  {len(termos)} termo(s) ativo(s)")

    # Buscar fontes customizadas (se existirem)
    try:
        fontes_res = supabase.table("fontes_monitoramento") \
            .select("url") \
            .eq("campanha_id", campanha_id) \
            .eq("ativo", True) \
            .execute()
        portais = [f["url"] for f in (fontes_res.data or [])] or PORTAIS_PADRAO
    except Exception:
        portais = PORTAIS_PADRAO

    fetcher = Fetcher()

    todas_mencoes = []

    for t in termos:
        print(f"\n  Buscando: '{t['termo']}' ({t.get('rotulo') or 'sem rótulo'})")

        # Google News
        noticias = buscar_google_news(t["termo"], fetcher)
        print(f"    Google News: {len(noticias)} resultado(s)")

        # Portais
        for portal_url in portais:
            resultados = buscar_portal(portal_url, t["termo"], fetcher)
            if resultados:
                print(f"    {portal_url}: {len(resultados)} resultado(s)")
                noticias.extend(resultados)

        # Redes sociais via Google
        redes = buscar_redes_sociais(t["termo"], fetcher)
        if redes:
            por_rede = {}
            for r in redes:
                por_rede[r["fonte"]] = por_rede.get(r["fonte"], 0) + 1
            resumo = ", ".join(f"{nome}: {qtd}" for nome, qtd in por_rede.items())
            print(f"    Redes sociais: {len(redes)} ({resumo})")
            noticias.extend(redes)
        else:
            print(f"    Redes sociais: 0")

        for n in noticias:
            n["termo"] = t["termo"]
            n["termoId"] = t["id"]

        todas_mencoes.extend(noticias)

    # Deduplicar por link
    vistos = set()
    unicas = []
    for m in todas_mencoes:
        chave = m["link"]
        if chave not in vistos:
            vistos.add(chave)
            unicas.append(m)

    print(f"\n  Total: {len(unicas)} menções únicas (de {len(todas_mencoes)} brutas)")

    # Salvar no monitoramento_snapshots
    redes_sociais_nomes = {nome for _, nome in REDES_SOCIAIS}
    snapshot = {
        "campanha_id": campanha_id,
        "total_mencoes": len(unicas),
        "resultados_brutos": [{
            "termoId": t["id"],
            "termo": t["termo"],
            "rotulo": t.get("rotulo"),
            "noticias": [m for m in unicas if m.get("termoId") == t["id"] and m.get("fonte") not in redes_sociais_nomes],
            "erroNoticias": None,
            "redes": {
                "configurado": True,
                "resultados": [m for m in unicas if m.get("termoId") == t["id"] and m.get("fonte") in redes_sociais_nomes],
                "erro": None,
            },
        } for t in termos],
    }

    try:
        supabase.table("monitoramento_snapshots").insert(snapshot).execute()
        print(f"  Snapshot salvo com sucesso.")
    except Exception as e:
        print(f"  ERRO ao salvar snapshot: {e}")

    # Criar itens de monitoramento para menções novas (que não existem ainda)
    novos = 0
    for m in unicas:
        if not m.get("link"):
            continue

        # Checar se já existe
        check = supabase.table("monitoramento_itens") \
            .select("id") \
            .eq("campanha_id", campanha_id) \
            .eq("url", m["link"]) \
            .limit(1) \
            .execute()

        if check.data:
            continue

        item = {
            "campanha_id": campanha_id,
            "url": m["link"],
            "descricao": f"[Scrapling] {m['titulo']}",
            "categoria": "mencao_neutra",
            "status": "novo",
        }

        try:
            supabase.table("monitoramento_itens").insert(item).execute()
            novos += 1
        except Exception as e:
            print(f"  Erro ao inserir item: {e}")

    print(f"  {novos} novo(s) item(ns) de monitoramento criado(s).")


def main():
    parser = argparse.ArgumentParser(description="Monitoramento web com Scrapling")
    parser.add_argument("--campanha", help="UUID da campanha específica")
    args = parser.parse_args()

    supabase = get_supabase()

    if args.campanha:
        res = supabase.table("campanhas") \
            .select("id, nome_candidato") \
            .eq("id", args.campanha) \
            .single() \
            .execute()
        campanhas = [res.data] if res.data else []
    else:
        res = supabase.table("campanhas") \
            .select("id, nome_candidato") \
            .eq("status", "ativa") \
            .execute()
        campanhas = res.data or []

    if not campanhas:
        print("Nenhuma campanha encontrada.")
        return

    print(f"Monitoramento Scrapling — {len(campanhas)} campanha(s)")
    print(f"Início: {datetime.now().isoformat()}")

    for c in campanhas:
        executar_campanha(supabase, c["id"], c.get("nome_candidato"))

    print(f"\nFinalizado: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
