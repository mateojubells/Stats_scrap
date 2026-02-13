"""
BasketStats Pro — Play-by-Play Text Parser (Simplified Schema)
===============================================================
Parsea el texto de las acciones PBP y retorna action_type ultra-específico.
Soporta acciones de jugador Y acciones de equipo (sin jugador).

ESQUEMA SIMPLIFICADO:
  - action_type: valor auto-descriptivo (2pt_made, steal, sub_in, team_rebound, etc.)
  - action_value: puntos (2, 3, 1) o 0 si falla
  - stat_count: número acumulado extraído de paréntesis
  - free_throws_awarded: tiros libres generados por falta (0 si no aplica)
  - is_team_action: True si es acción del equipo (sin jugador específico)

ACTION_TYPE ESTÁNDAR:
  Jugador:
    Tiros: 2pt_made, 2pt_missed, 3pt_made, 3pt_missed, ft_made, ft_missed, dunk_made
    Rebotes: reb_off, reb_def
    Defensa: steal, block
    Errores: turnover
    Faltas: foul_comm
    Sustituciones: sub_in, sub_out
  
  Equipo (sin jugador):
    team_rebound: Rebote de equipo
    team_foul: Falta de equipo
    timeout: Tiempo muerto
  
  Otros: period_start, period_end

PATRONES DE TEXTO (FEB):
  Con jugador:
    "(EQUIPO) JUGADOR: TIRO DE 2 ANOTADO (Puntos: 8)"
    "(EQUIPO) JUGADOR: REBOTE DEFENSIVO (Rebotes: 3)"
    "(EQUIPO) JUGADOR: FALTA Personal (Faltas: 2). Tiros libres: 2"
  
  Sin jugador (del equipo):
    "(IMMO SA MARINA BASQUET) REBOTE (Rebotes: 5)"
    "(PUJOL MOLLERUSSA) TIEMPO MUERTO"
    "(EQUIPO) FALTA (Faltas de equipo: 3)"
"""

import re
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


def parse_pbp_action_text(action_text: str) -> Dict:
    """
    Parsea texto PBP y retorna action_type ultra-específico.
    Soporta tanto acciones de jugador como acciones de equipo.
    
    Args:
        action_text: Texto completo del evento, ej:
            "(FLANIGAN CALVIÀ) A. AGUILERA MELCHOR: ROBO (Robos: 1)"  ← Con jugador
            "(IMMO BASQUET) REBOTE (Rebotes: 5)"  ← Solo equipo
    
    Returns:
        Dict con:
        {
            "action_type": str,      # Ultra-específico: '2pt_made', 'steal', 'sub_in', 'team_rebound', etc.
            "action_value": int,     # Puntos (2, 3, 1) o 0 si falla/no aplica
            "stat_count": int|None,  # Número acumulado: "(Robos: 1)" → 1
            "free_throws_awarded": int,  # Tiros libres generados por falta (0 si no aplica)
            "is_team_action": bool,  # True si es acción de equipo (sin jugador específico)
        }
    """
    result = {
        "action_type": "unknown",
        "action_value": 0,
        "stat_count": None,
        "free_throws_awarded": 0,
        "is_team_action": False,
    }
    
    if not action_text:
        return result
    
    text = action_text.strip()
    
    # ═══ DETECTAR SI ES ACCIÓN DE EQUIPO O DE JUGADOR ═══
    # Patrón A: (EQUIPO) JUGADOR: ACCIÓN  ← Nombre antes de ':'
    # Patrón B: (EQUIPO) ACCIÓN            ← Sin nombre ni ':'
    
    action_part = text
    
    # Regex específico: busca nombre de jugador (letras, espacios, puntos) seguido de ':'
    # Esto evita confundir con ':' en estadísticas como "(Rebotes: 5)"
    player_match = re.match(r"\([^)]+\)\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\.\s]+?):\s*(.+)", text)
    if player_match:
        # Hay jugador específico (Patrón A)
        action_part = player_match.group(2).strip()
        result["is_team_action"] = False
    else:
        # No hay jugador → Acción de equipo (Patrón B)
        team_only_match = re.match(r"\([^)]+\)\s*(.+)", text)
        if team_only_match:
            action_part = team_only_match.group(1).strip()
            result["is_team_action"] = True
    
    t = action_part.upper()
    
    # ─── MATE (tiro de 2 anotado especial) ───
    if "MATE" in t:
        result["action_type"] = "dunk_made"
        result["action_value"] = 2
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── TIROS DE CAMPO ───
    shot_match = re.match(r"TIRO\s+DE\s+([23])\s+(ANOTADO|FALLADO)", t)
    if shot_match:
        shot_value = int(shot_match.group(1))
        made = shot_match.group(2) == "ANOTADO"
        result["action_type"] = f"{shot_value}pt_made" if made else f"{shot_value}pt_missed"
        result["action_value"] = shot_value if made else 0
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── TIROS LIBRES (la FEB usa "TIRO DE 1") ───
    ft_match = re.match(r"TIRO\s+DE\s+1\s+(ANOTADO|FALLADO)", t)
    if ft_match:
        made = ft_match.group(1) == "ANOTADO"
        result["action_type"] = "ft_made" if made else "ft_missed"
        result["action_value"] = 1 if made else 0
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── REBOTES ───
    if "REBOTE" in t:
        is_offensive = "OFENSIVO" in t or "ATAQUE" in t
        is_defensive = "DEFENSIVO" in t or "DEFENSA" in t
        
        # Si es acción de equipo (sin jugador), usar tipo especial
        if result["is_team_action"]:
            result["action_type"] = "team_rebound"
        elif is_offensive:
            result["action_type"] = "reb_off"
        elif is_defensive:
            result["action_type"] = "reb_def"
        else:
            # Sin especificar → asumir defensivo si hay jugador, team si no
            result["action_type"] = "team_rebound" if result["is_team_action"] else "reb_def"
        
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── ASISTENCIA (no se guarda en PBP principal, solo en stats) ───
    if "ASISTENCIA" in t:
        result["action_type"] = "assist"
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── ROBO ───
    if "ROBO" in t:
        result["action_type"] = "steal"
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── PÉRDIDA ───
    if "PÉRDIDA" in t or "PERDIDA" in t:
        result["action_type"] = "turnover"
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── TAPÓN ───
    if "TAPÓN" in t or "TAPON" in t:
        result["action_type"] = "block"
        result["stat_count"] = _extract_stat_count(action_part)
        return result
    
    # ─── FALTA ───
    if "FALTA" in t:
        # Si es acción de equipo -> team_foul, si no -> foul_comm
        if result["is_team_action"]:
            result["action_type"] = "team_foul"
        else:
            result["action_type"] = "foul_comm"
        
        # Extraer conteo de faltas personales: "Faltas: 2"
        foul_count_m = re.search(r"Faltas:\s*(\d+)", action_part, re.IGNORECASE)
        if foul_count_m:
            result["stat_count"] = int(foul_count_m.group(1))
        
        # Extraer tiros libres concedidos: "Tiros libres: 2"
        ft_awarded_m = re.search(r"Tiros\s+libres:\s*(\d+)", action_part, re.IGNORECASE)
        if ft_awarded_m:
            result["free_throws_awarded"] = int(ft_awarded_m.group(1))
        
        return result
    
    # ─── SUSTITUCIÓN ───
    if "SUSTITU" in t:
        if "ENTRA" in t:
            result["action_type"] = "sub_in"
        elif "SALE" in t:
            result["action_type"] = "sub_out"
        else:
            result["action_type"] = "sub_in"  # Default
        return result
    
    # ─── TIEMPO MUERTO ───
    if "TIEMPO MUERTO" in t or "TIMEOUT" in t:
        result["action_type"] = "timeout"
        return result
    
    # ─── INICIO/FIN DE PERIODO ───
    if "INICIO" in t or "COMIENZA" in t:
        result["action_type"] = "period_start"
        return result
    if "FIN" in t or "FINAL" in t:
        result["action_type"] = "period_end"
        return result
    
    # ─── DEFAULT (unknown) ───
    return result


def _extract_stat_count(text: str) -> Optional[int]:
    """
    Extrae el conteo de estadísticas del paréntesis final.
    
    Ejemplos:
      "ROBO (Robos: 1)" → 1
      "REBOTE (Rebotes: 3)" → 3
      "ASISTENCIA (Asistencias: 2)" → 2
      "TIRO DE 2 ANOTADO (Puntos: 8)" → 8
      "PÉRDIDA (Pérdidas: 3)" → 3
    """
    # Buscar el patrón "(Palabra: N)"
    m = re.search(r"\((?:Puntos|Rebotes|Asistencias|Robos|Pérdidas|Perdidas|Tapones|Faltas):\s*(\d+)", text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None
