"""
BasketStats Pro — League Discovery
====================================
Descubre todas las Ligas y Grupos disponibles en la FEB (Primera, Segunda, Tercera).

Para cada categoría:
1. Navega a la URL
2. Selecciona temporada 2025 (con __doPostBack)
3. Extrae todas las opciones del dropdown de grupos
4. Guarda en tabla 'leagues' de Supabase

HTML Selectors:
  - Temporadas: id="_ctl0_MainContentPlaceHolderMaster_temporadasDropDownList"
  - Grupos:     id="_ctl0_MainContentPlaceHolderMaster_gruposDropDownList"
"""

import asyncio
import logging
from typing import List, Dict
from datetime import date

from playwright.async_api import async_playwright, Page
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Base URLs para las 3 categorías FEB
LEAGUE_BASE_URLS = {
    "Primera FEB": "https://www.feb.es/competiciones/calendario/primerafeb/1/2025",
    "Segunda FEB": "https://www.feb.es/competiciones/calendario/segundafeb/2/2025",
    "Tercera FEB": "https://www.feb.es/competiciones/calendario/tercerafeb/3/2025",
}


async def discover_leagues(repository, season_year: str = "2025", headless: bool = True) -> List[Dict]:
    """
    Descubre todas las ligas y grupos disponibles en FEB.
    
    Args:
        repository: SupabaseRepository instance
        season_year: Año de temporada (ej: "2025")
        headless: Browser mode
        
    Returns:
        Lista de dicts con info de ligas descubiertas
    """
    discovered = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        
        # Set longer timeout
        page.set_default_timeout(60000)  # 60 seconds
        page.set_default_navigation_timeout(60000)
        
        try:
            for league_name, base_url in LEAGUE_BASE_URLS.items():
                logger.info(f"🔍 Descubriendo: {league_name}")
                
                try:
                    groups = await _extract_groups(page, league_name, base_url, season_year)
                    
                    for group_info in groups:
                        logger.info(
                            f"  → {group_info['group_name']} "
                            f"(ID: {group_info['feb_group_id']})"
                        )
                        
                        # Guardar en Supabase
                        league_record = repository.upsert_league(
                            name=league_name,
                            group_name=group_info["group_name"],
                            feb_group_id=group_info["feb_group_id"],
                            base_url=base_url,
                            season_year=season_year,
                        )
                        
                        discovered.append({
                            "db_id": league_record["id"],
                            "league_name": league_name,
                            "group_name": group_info["group_name"],
                            "feb_group_id": group_info["feb_group_id"],
                        })
                    
                    logger.info(f"✅ {league_name}: {len(groups)} grupos encontrados")
                    
                except Exception as e:
                    logger.error(f"❌ Error en {league_name}: {e}")
                    continue
        
        finally:
            try:
                await browser.close()
            except Exception as e:
                logger.warning(f"Warning closing browser: {e}")
    
    logger.info(f"\n📊 Total descubierto: {len(discovered)} groups")
    return discovered


async def _extract_groups(
    page: Page,
    league_name: str,
    base_url: str,
    season_year: str,
) -> List[Dict]:
    """
    Navega a una liga, selecciona temporada y extrae grupos.
    """
    groups = []
    
    # Navegar
    logger.info(f"  [1/3] Navegando a {league_name}...")
    try:
        await page.goto(base_url, wait_until="domcontentloaded", timeout=60000)
    except Exception as e:
        logger.warning(f"  ⚠️  Error en navegación inicial: {e}")
        return []
    
    # Pequeño delay
    await asyncio.sleep(2)
    
    try:
        await page.wait_for_load_state("networkidle", timeout=30000)
    except Exception as e:
        logger.warning(f"  ⚠️  Network idle timeout: {e}")
    
    # Verificar que los dropdowns existen
    try:
        await page.wait_for_selector(
            "#_ctl0_MainContentPlaceHolderMaster_temporadasDropDownList",
            timeout=10000
        )
    except Exception:
        logger.warning(f"  ⚠️  No se encontró dropdown de temporadas en {league_name}")
        return []
    
    # Step 1: Seleccionar temporada
    logger.info(f"  [2/3] Seleccionando temporada {season_year}...")
    try:
        await page.select_option(
            "#_ctl0_MainContentPlaceHolderMaster_temporadasDropDownList",
            value=season_year
        )
        await asyncio.sleep(3)
        try:
            await page.wait_for_load_state("networkidle", timeout=30000)
        except:
            pass
    except Exception as e:
        logger.warning(f"  ⚠️  Error seleccionando temporada: {e}")
    
    # Step 2: Extraer grupos del dropdown
    logger.info(f"  [3/3] Extrayendo grupos...")
    try:
        await page.wait_for_selector(
            "#_ctl0_MainContentPlaceHolderMaster_gruposDropDownList",
            timeout=10000
        )
    except Exception as e:
        logger.warning(f"  ⚠️  No se encontró dropdown de grupos: {e}")
        return []
    
    try:
        html = await page.content()
        soup = BeautifulSoup(html, "lxml")
        
        grupos_select = soup.select_one(
            "#_ctl0_MainContentPlaceHolderMaster_gruposDropDownList"
        )
        
        if not grupos_select:
            logger.warning(f"  ⚠️  No se encontró select en HTML")
            return []
        
        options = grupos_select.find_all("option")
        logger.info(f"  Found {len(options)} options in dropdown")
        
        for option in options:
            feb_group_id = option.get("value", "").strip()
            group_name = option.get_text(strip=True)
            
            if feb_group_id:
                groups.append({
                    "feb_group_id": feb_group_id,
                    "group_name": group_name,
                })
    
    except Exception as e:
        logger.error(f"  ❌ Error extrayendo grupos: {e}")
    
    return groups
