"""
BasketStats Pro v2.0 — Database Models
=======================================
Pydantic models para validación de datos y contratos con Supabase.

Estructura:
- ShotData: Coordenadas de tiros del gráfico
- PlayByPlayEvent: Eventos cronológicos del partido
- PlayerBioData: Datos biográficos de jugadores
- PlayerGameStats: Estadísticas por jugador
- TeamAdvancedStats: Métricas avanzadas de equipo
- FullGameData: Contenedor consolidado
"""

from datetime import datetime, date
from enum import Enum
from typing import Optional, List
import re
from pydantic import BaseModel, Field, validator


# ═════════════════════════════════════════════════════════════════════════════
# ENUMS
# ═════════════════════════════════════════════════════════════════════════════

class ShotResult(str, Enum):
    """Resultado del tiro."""
    MADE = "made"
    MISSED = "missed"


class ShotZone(str, Enum):
    """Zonas de la cancha (clasificación NBA-style)."""
    PAINT = "paint"
    MID_RANGE = "mid-range"
    CORNER_3 = "corner-3"
    WING_3 = "wing-3"
    TOP_3 = "top-3"
    FREE_THROW = "free-throw"
    OTHER = "other"


class PlayByPlayActionType(str, Enum):
    """Tipos de acción en el play-by-play."""
    FIELD_GOAL_MADE = "field_goal_made"
    FIELD_GOAL_MISSED = "field_goal_missed"
    FREE_THROW_MADE = "free_throw_made"
    FREE_THROW_MISSED = "free_throw_missed"
    REBOUND_OFF = "rebound_offensive"
    REBOUND_DEF = "rebound_defensive"
    ASSIST = "assist"
    TURNOVER = "turnover"
    STEAL = "steal"
    FOUL = "foul"
    BLOCK = "block"
    SUBSTITUTION = "substitution"
    TIMEOUT = "timeout"
    PERIOD_START = "period_start"
    PERIOD_END = "period_end"
    UNKNOWN = "unknown"


# ═════════════════════════════════════════════════════════════════════════════
# SHOT CHART MODELS
# ═════════════════════════════════════════════════════════════════════════════

class ShotData(BaseModel):
    """Modelo para un tiro individual."""
    game_id: str
    team_id: int
    player_number: int
    result: ShotResult
    quarter: int
    x_coordinate: float = Field(..., ge=0, le=100, description="% horizontal (0-100)")
    y_coordinate: float = Field(..., ge=0, le=100, description="% vertical (0-100)")
    zone: ShotZone
    raw_style: str
    
    class Config:
        use_enum_values = True


# ═════════════════════════════════════════════════════════════════════════════
# PLAY-BY-PLAY MODELS
# ═════════════════════════════════════════════════════════════════════════════

class PlayByPlayEvent(BaseModel):
    """
    Evento del play-by-play (timeline cronológica) - Esquema simplificado.
    
    action_type ultra-específico (sin columnas redundantes):
      Tiros: 2pt_made, 2pt_missed, 3pt_made, 3pt_missed, ft_made, ft_missed, dunk_made
      Rebotes: reb_off, reb_def, team_rebound
      Defensa: steal, block
      Errores: turnover
      Faltas: foul_comm, foul_rec, team_foul
      Sustituciones: sub_in, sub_out
      Otros: timeout, period_start, period_end, assist, unknown
    """
    game_id: str
    quarter: int
    minute: str = Field(..., description="Tiempo del reloj (ej: '09:45', '00:03')")
    team_name: Optional[str] = None
    player_name: Optional[str] = None
    player_number: Optional[int] = None
    action_type: str = Field(..., description="Tipo ultra-específico: 2pt_made, steal, sub_in, etc.")
    action_value: int = Field(0, description="Puntos anotados (2,3,1) o 0 si falla/no aplica")
    stat_count: Optional[int] = Field(None, description="Conteo acumulado: (Robos: 1) → 1")
    free_throws_awarded: int = Field(0, description="Tiros libres generados por falta (0 si no aplica)")
    score_home: Optional[int] = None
    score_away: Optional[int] = None
    
    @validator("minute")
    def validate_time_format(cls, v):
        """Valida formato MM:SS."""
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError(f"Invalid time format: {v}. Expected MM:SS")
        return v
    
    class Config:
        use_enum_values = True


# ═════════════════════════════════════════════════════════════════════════════
# PLAYER BIO & STATS MODELS
# ═════════════════════════════════════════════════════════════════════════════

class PlayerBioData(BaseModel):
    """Datos biográficos de un jugador (de la pestaña Ficha)."""
    game_id: str
    team_name: str
    player_name: str
    jersey_number: int
    height_cm: Optional[int] = None
    birth_date: Optional[date] = None
    position: Optional[str] = None
    
    @property
    def age(self) -> Optional[int]:
        """Calcula edad en años."""
        if self.birth_date:
            today = date.today()
            return today.year - self.birth_date.year - (
                (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
            )
        return None


class PlayerGameStats(BaseModel):
    """Estadísticas completas de un jugador en un partido."""
    game_id: str
    team_name: str
    player_name: str
    jersey_number: str = ""  # Puede ser texto como "4" o vacío
    feb_player_id: Optional[str] = None  # ID único de FEB (extraído de href Jugador.aspx?i=XXXXXX)
    starter: bool = False
    
    # Minutos
    minutes_played: str = Field(default="00:00", description="MM:SS format")
    
    # Puntos
    points: int = 0
    
    # Tiros de campo (FG)
    fg_made: int = 0
    fg_attempted: int = 0
    
    # Tiros de 2 (T2)
    fg2_made: int = 0
    fg2_attempted: int = 0
    
    # Tiros de 3 (T3)
    fg3_made: int = 0
    fg3_attempted: int = 0
    
    # Tiros libres (FT)
    ft_made: int = 0
    ft_attempted: int = 0
    
    # Rebotes
    rebounds_offensive: int = 0
    rebounds_defensive: int = 0
    rebounds_total: int = 0
    
    # Asistencias, robos, tapones
    assists: int = 0
    steals: int = 0
    blocks: int = 0
    blocks_against: int = 0
    
    # Faltas y pérdidas
    turnovers: int = 0
    fouls: int = 0
    fouls_received: int = 0
    
    # Valoración
    efficiency: Optional[int] = None
    plus_minus: Optional[int] = None
    
    @property
    def fg_percentage(self) -> Optional[float]:
        """% de tiros de campo."""
        if self.fg_attempted > 0:
            return round((self.fg_made / self.fg_attempted) * 100, 1)
        return None
    
    @property
    def fg3_percentage(self) -> Optional[float]:
        """% de triples."""
        if self.fg3_attempted > 0:
            return round((self.fg3_made / self.fg3_attempted) * 100, 1)
        return None
    
    @property
    def ft_percentage(self) -> Optional[float]:
        """% de tiros libres."""
        if self.ft_attempted > 0:
            return round((self.ft_made / self.ft_attempted) * 100, 1)
        return None


# ═════════════════════════════════════════════════════════════════════════════
# TEAM STATS MODELS
# ═════════════════════════════════════════════════════════════════════════════

class TeamAdvancedStats(BaseModel):
    """Estadísticas avanzadas de equipo (de la pestaña Estadísticas)."""
    game_id: str
    team_name: str
    
    # Tiros de campo (FG)
    fg_made: Optional[int] = None
    fg_attempted: Optional[int] = None
    fg_percentage: Optional[float] = None
    
    # Tiros de 2 (T2)
    fg2_made: Optional[int] = None
    fg2_attempted: Optional[int] = None
    fg2_percentage: Optional[float] = None
    
    # Tiros de 3 (T3)
    fg3_made: Optional[int] = None
    fg3_attempted: Optional[int] = None
    fg3_percentage: Optional[float] = None
    
    # Tiros libres (FT)
    ft_made: Optional[int] = None
    ft_attempted: Optional[int] = None
    ft_percentage: Optional[float] = None
    
    # Rebotes y asistencias
    total_rebounds: Optional[int] = None
    assists: Optional[int] = None
    
    # Defensa
    steals: Optional[int] = None
    blocks: Optional[int] = None
    
    # Errores
    turnovers: Optional[int] = None
    fouls: Optional[int] = None


# ═════════════════════════════════════════════════════════════════════════════
# CONSOLIDATED GAME DATA
# ═════════════════════════════════════════════════════════════════════════════

class FullGameData(BaseModel):
    """Contenedor consolidado para todos los datos de un partido."""
    game_id: str
    scraped_at: datetime = Field(default_factory=datetime.now)
    
    # Metadata
    home_team: str
    away_team: str
    final_score_home: int
    final_score_away: int
    game_date: Optional[date] = None
    venue: Optional[str] = None
    
    # Data completa
    shots: List[ShotData] = Field(default_factory=list)
    play_by_play: List[PlayByPlayEvent] = Field(default_factory=list)
    player_stats: List[PlayerGameStats] = Field(default_factory=list)
    team_stats: List[TeamAdvancedStats] = Field(default_factory=list)
    
    def to_dict(self) -> dict:
        """Serializa a diccionario para guardar en JSON."""
        return self.model_dump(mode="json")
    
    def to_json(self, indent: int = 2) -> str:
        """Serializa a JSON string."""
        return self.model_dump_json(indent=indent)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
        }


# ═════════════════════════════════════════════════════════════════════════════
# VALIDATION UTILITIES
# ═════════════════════════════════════════════════════════════════════════════

def validate_game_data(data: dict) -> FullGameData:
    """
    Valida y convierte un diccionario a FullGameData.
    Lanza ValidationError si hay problemas.
    """
    return FullGameData(**data)


# Re-export para facilitar imports
__all__ = [
    "ShotResult",
    "ShotZone",
    "PlayByPlayActionType",
    "ShotData",
    "PlayByPlayEvent",
    "PlayerGameStats",
    "TeamAdvancedStats",
    "FullGameData",
    "validate_game_data",
]
