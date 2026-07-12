-- SQL Skript pro nastavení Supabase databáze pro AI Coach
-- 1. Otevři svůj projekt v Supabase
-- 2. V levém menu klikni na "SQL Editor"
-- 3. Vlož tento kód a spusť jej (tlačítko Run)

-- Vytvoření tabulky pro ukládání historie tréninků
CREATE TABLE IF NOT EXISTS training_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    feeling TEXT NOT NULL,
    activity TEXT NOT NULL,
    ai_recommendation TEXT
);

-- Nastavení RLS (Row Level Security) - prozatím nastavíme veřejný přístup pro čtení i zápis
-- V budoucnu, až přidáš přihlašování uživatelů (Auth), je doporučeno toto omezit
ALTER TABLE training_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Povolit vkládání všem (vývoj)" 
ON training_history FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Povolit čtení všem (vývoj)" 
ON training_history FOR SELECT 
USING (true);
