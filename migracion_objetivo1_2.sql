-- ============================================================
-- MIGRACIÓN: Objetivos 1 y 2 — Usuarios, Tarifas, Salidas, Plan Por Hora
-- Ejecutar en Supabase SQL Editor ANTES de usar las nuevas funciones
-- ============================================================

-- === 1. TABLA DE USUARIOS DEL SISTEMA ===
CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    cedula      TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE,
    telefono    TEXT,
    password    TEXT NOT NULL,   -- NOTA: en producción usar bcrypt/hash
    rol         TEXT DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SELECT usuarios"  ON usuarios FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT usuarios"  ON usuarios FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE usuarios"  ON usuarios FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE usuarios"  ON usuarios FOR DELETE TO anon USING (true);

-- Usuario administrador por defecto
INSERT INTO usuarios (nombre, cedula, email, password, rol)
VALUES ('Administrador Parqueadero', '0000000000', 'admin@unimeta.edu.co', 'admin123', 'admin')
ON CONFLICT (cedula) DO NOTHING;

-- === 2. TABLA DE TARIFAS CONFIGURABLES ===
CREATE TABLE IF NOT EXISTS tarifas (
    id              SERIAL PRIMARY KEY,
    tipo_servicio   TEXT UNIQUE NOT NULL,
    nombre_display  TEXT NOT NULL,
    precio          INTEGER NOT NULL,
    descripcion     TEXT,
    activo          BOOLEAN DEFAULT true,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SELECT tarifas" ON tarifas FOR SELECT TO anon USING (true);
CREATE POLICY "UPDATE tarifas" ON tarifas FOR UPDATE TO anon USING (true);
CREATE POLICY "INSERT tarifas" ON tarifas FOR INSERT TO anon WITH CHECK (true);

-- Valores iniciales de tarifas
INSERT INTO tarifas (tipo_servicio, nombre_display, precio, descripcion) VALUES
('hora',    'Por Hora',  1500,  'Tarifa flexible — cobro según horas reales de permanencia'),
('diario',  'Diario',    2000,  'Acceso por un día completo (por jornada)'),
('semanal', 'Semanal',   10000, 'Acceso por 7 días corridos'),
('mensual', 'Mensual',   45000, 'Acceso por un mes calendario')
ON CONFLICT (tipo_servicio) DO UPDATE
    SET nombre_display = EXCLUDED.nombre_display,
        precio         = EXCLUDED.precio,
        descripcion    = EXCLUDED.descripcion,
        updated_at     = NOW();

-- === 3. CAMPO fecha_salida EN checkins (registro explícito de salida) ===
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS fecha_salida TIMESTAMPTZ;

-- === 4. CAMPO horas_estimadas EN pagos (para plan por hora) ===
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS horas_estimadas INTEGER;

-- === 5. ÍNDICES PARA REPORTES POR FECHA ===
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_inicio ON pagos(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_checkins_fecha_salida ON checkins(fecha_salida);

-- ============================================================
-- VERIFICACIÓN (ejecutar por separado para confirmar):
-- SELECT * FROM usuarios;
-- SELECT * FROM tarifas;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'checkins' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'pagos' ORDER BY ordinal_position;
-- ============================================================
