-- Posicion de la planta en la sala (formato "carpa-indice", ej "c2-5").
-- Null = sin ubicar (aparece en la bandeja del tablero Sala).
alter table plantas add column if not exists slot text;
