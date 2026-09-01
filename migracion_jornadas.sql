-- =============================================
-- MIGRACIÓN: Sistema de Jornadas y Check-ins
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Agregar columna de jornada a la tabla pagos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS jornada TEXT DEFAULT 'diurna';

-- 2. Crear tabla de check-ins (asignaciones diarias al llegar)
CREATE TABLE IF NOT EXISTS checkins (
    id          SERIAL PRIMARY KEY,
    pago_id     INTEGER REFERENCES pagos(id) ON DELETE CASCADE,
    placa       TEXT NOT NULL,
    nombre      TEXT,
    espacio_numero INTEGER NOT NULL,
    jornada     TEXT NOT NULL,        -- 'diurna' | 'nocturna'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    auto_liberar_a TIMESTAMPTZ NOT NULL
);

-- 3. Índice para acelerar las consultas por fecha de liberación
CREATE INDEX IF NOT EXISTS idx_checkins_auto_liberar ON checkins(auto_liberar_a);
CREATE INDEX IF NOT EXISTS idx_checkins_jornada ON checkins(jornada);

-- 4. Limpiar check-ins vencidos automáticamente (función helper)
--    Esta función se puede llamar desde el cliente para mantener limpia la tabla
CREATE OR REPLACE FUNCTION limpiar_checkins_vencidos()
RETURNS INTEGER AS $$
DECLARE
    eliminados INTEGER;
BEGIN
    DELETE FROM checkins WHERE auto_liberar_a < NOW();
    GET DIAGNOSTICS eliminados = ROW_COUNT;
    RETURN eliminados;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VERIFICACIÓN: ejecuta esto para confirmar
-- =============================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pagos';
-- SELECT * FROM checkins LIMIT 5;

-- =============================================
-- POLÍTICAS RLS PARA TABLA checkins
-- (Supabase bloquea escrituras por defecto)
-- =============================================

-- Habilitar RLS en la tabla
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT a usuarios anónimos (para leer check-ins activos)
CREATE POLICY "Permitir SELECT checkins" ON checkins
    FOR SELECT TO anon USING (true);

-- Permitir INSERT a usuarios anónimos (para hacer check-in al llegar)
CREATE POLICY "Permitir INSERT checkins" ON checkins
    FOR INSERT TO anon WITH CHECK (true);

-- Permitir UPDATE a usuarios anónimos
CREATE POLICY "Permitir UPDATE checkins" ON checkins
    FOR UPDATE TO anon USING (true);

-- Permitir DELETE a usuarios anónimos (para limpiar check-ins vencidos)
CREATE POLICY "Permitir DELETE checkins" ON checkins
    FOR DELETE TO anon USING (true);
