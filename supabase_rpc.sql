-- ═══════════════════════════════════════════════════════════════
-- HoopsAI: Función RPC para ejecutar consultas del chatbot
-- Ejecutar este script en el SQL Editor de Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear la función execute_coach_query
CREATE OR REPLACE FUNCTION public.execute_coach_query(sql_query TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Se ejecuta con permisos del owner (bypass RLS)
SET search_path = public
AS $$
DECLARE
  result JSON;
  trimmed TEXT;
BEGIN
  -- Limpiar espacios y saltos de línea al inicio
  trimmed := btrim(sql_query);
  
  -- ─── VALIDACIÓN DE SEGURIDAD ───────────────────────────────
  -- Solo permitir sentencias SELECT
  IF NOT (upper(trimmed) LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT. Operación denegada.';
  END IF;

  -- Bloquear palabras clave peligrosas (incluso dentro de subconsultas)
  IF trimmed ~* '\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE)\b' THEN
    RAISE EXCEPTION 'Consulta contiene operaciones prohibidas. Solo SELECT es permitido.';
  END IF;

  -- ─── EJECUCIÓN ────────────────────────────────────────────
  EXECUTE 'SELECT json_agg(t) FROM (' || trimmed || ') t' INTO result;
  
  -- Si no hay resultados, devolver array vacío
  IF result IS NULL THEN
    result := '[]'::JSON;
  END IF;

  RETURN result;
END;
$$;

-- 2. Revocar acceso público y otorgar solo al rol authenticated
REVOKE ALL ON FUNCTION public.execute_coach_query(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_coach_query(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_coach_query(TEXT) TO authenticated;

-- 3. Comentario descriptivo
COMMENT ON FUNCTION public.execute_coach_query IS 
  'HoopsAI: Ejecuta consultas SELECT generadas por el chatbot IA. 
   Security Definer para bypass RLS. Solo accesible por usuarios autenticados.';
