"""
Capturar HTML del boxscore para inspección
"""

import asyncio
import os
import sys
from pathlib import Path

root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))

from playwright.async_api import async_playwright


async def capture_html():
    """Capturar HTML del boxscore"""
    
    print("=" * 70)
    print("📸 Capturando HTML del boxscore")
    print("=" * 70)
    
    game_url = "https://www.feb.es/competiciones/calendario/partido.aspx?p=2486265"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"\n📡 Navegando a: {game_url}")
        await page.goto(game_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)
        
        # Navegar a pestaña "Estadísticas"
        print("   Navegando a pestaña 'Estadísticas'...")
        tabs = await page.locator("ul.menu-tabs li").all()
        for tab in tabs:
            text = await tab.inner_text()
            if "Estad" in text:
                await tab.click()
                await page.wait_for_timeout(2000)
                break
        
        # Obtener HTML
        html = await page.content()
        
        # Guardar a archivo
        output_file = Path("boxscore_debug.html")
        output_file.write_text(html, encoding="utf-8")
        
        # Buscar primera fila de jugador para inspeccionar
        print("\n🔍 Inspeccionando primera fila de jugador...")
        
        # Buscar tabla
        table = page.locator("table.clasificacion").first
        
        # Buscar primera fila de datos (no total)
        rows = await table.locator("tbody tr").all()
        for idx, row in enumerate(rows[:3]):
            classes = await row.get_attribute("class") or ""
            if "row-total" not in classes:
                print(f"\n   Fila {idx + 1}:")
                cells = await row.locator("td").all()
                if len(cells) >= 3:
                    # Cell 2 = nombre del jugador
                    cell2_html = await cells[2].inner_html()
                    cell2_text = await cells[2].inner_text()
                    
                    print(f"   Texto: {cell2_text}")
                    print(f"   HTML: {cell2_html[:200]}")
                    
                    # Buscar el <a>
                    a_tag = cells[2].locator("a").first
                    if a_tag:
                        try:
                            href = await a_tag.get_attribute("href")
                            print(f"   Href: {href}")
                        except:
                            print("   No href encontrado")
        
        await browser.close()
        
        print(f"\n✅ HTML guardado en: {output_file.absolute()}")
        print(f"   Tamaño: {len(html) / 1024:.1f} KB")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(capture_html())
