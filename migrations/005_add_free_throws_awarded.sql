-- ============================================================================
-- MIGRACIÓN 005: Añadir free_throws_awarded a play_by_play
-- ============================================================================
-- OBJETIVO: Capturar cuántos tiros libres genera una falta.
--
-- Ejemplo: "FALTA Personal (Faltas: 2...). Tiros libres: 2"
--   → free_throws_awarded = 2
--
-- Permite análisis más profundo: faltas que generan TL vs faltas normales.
-- ============================================================================

BEGIN;

-- Añadir columna para tiros libres generados por una falta
ALTER TABLE public.play_by_play 
ADD COLUMN IF NOT EXISTS free_throws_awarded integer DEFAULT 0;

-- Índice para consultas de faltas con TL
CREATE INDEX IF NOT EXISTS idx_pbp_free_throws 
ON public.play_by_play(free_throws_awarded) 
WHERE free_throws_awarded > 0;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'play_by_play' AND column_name = 'free_throws_awarded';
--
-- Resultado esperado:
--   column_name: free_throws_awarded
--   data_type: integer
--   column_default: 0
-- ============================================================================
