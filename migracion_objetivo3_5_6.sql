-- ============================================================
-- MIGRACIÓN: Objetivos 3, 5 y 6 — Trazabilidad, Cesión de Plazas y Estados de Mapa
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- === 1. OBJETIVO 3: ESTADO DE VERIFICACIÓN Y RELACIÓN CON USUARIO EN PAGOS ===
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado_verificacion TEXT DEFAULT 'verificado';
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

-- === 2. OBJETIVO 5: TABLA DE CESIÓN TEMPORAL DE PLAZA / INFORMACIÓN DE AUSENCIAS ===
CREATE TABLE IF NOT EXISTS cesiones_plaza (
    id                  SERIAL PRIMARY KEY,
    pago_id             INTEGER REFERENCES pagos(id) ON DELETE CASCADE,
    placa_mensualista   TEXT NOT NULL,
    nombre_mensualista  TEXT,
    espacio_numero      INTEGER,
    fecha_ausencia      DATE NOT NULL DEFAULT CURRENT_DATE,
    jornada             TEXT NOT NULL CHECK (jornada IN ('diurna', 'nocturna', 'ambas')),
    placa_beneficiario  TEXT, -- NULL si está libre para cualquier usuario
    estado              TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'usada', 'cancelada')),
    observacion         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en cesiones_plaza
ALTER TABLE cesiones_plaza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SELECT cesiones" ON cesiones_plaza FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT cesiones" ON cesiones_plaza FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE cesiones" ON cesiones_plaza FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE cesiones" ON cesiones_plaza FOR DELETE TO anon USING (true);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_cesiones_fecha ON cesiones_plaza(fecha_ausencia);
CREATE INDEX IF NOT EXISTS idx_cesiones_placa ON cesiones_plaza(placa_mensualista);

-- === 3. TABLA DE RESERVAS ANTICIPADAS (OBJETIVO 6) ===
CREATE TABLE IF NOT EXISTS reservas (
    id              SERIAL PRIMARY KEY,
    pago_id         INTEGER REFERENCES pagos(id) ON DELETE CASCADE,
    placa           TEXT NOT NULL,
    espacio_numero  INTEGER NOT NULL,
    fecha_reserva   DATE NOT NULL DEFAULT CURRENT_DATE,
    jornada         TEXT NOT NULL,
    estado          TEXT DEFAULT 'reservada' CHECK (estado IN ('reservada', 'completada', 'cancelada')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SELECT reservas" ON reservas FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT reservas" ON reservas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE reservas" ON reservas FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE reservas" ON reservas FOR DELETE TO anon USING (true);
