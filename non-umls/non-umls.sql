-- Import a non-UMLS vocabulary from a CSV file produced by non-umls.py
CREATE OR REPLACE FUNCTION non_umls_import_csv(
    voc_id INTEGER,
    filename TEXT
)
RETURNS VOID AS $$
BEGIN
    CREATE TEMP TABLE temp_csv_import (
      code text,
      term text,
      rel text,
      umls_sab text,
      umls_code text,
      cui text,
      criterion text
    );
    EXECUTE format('COPY temp_csv_import FROM %L WITH (FORMAT CSV, HEADER false)', filename);
    INSERT INTO non_umls_codes (voc_id, code, term, rel, umls_sab, umls_code, cui, criterion)
    SELECT voc_id, code, term, rel, umls_sab, umls_code, cui, criterion FROM temp_csv_import;
    DROP TABLE temp_csv_import;
END;
$$ LANGUAGE plpgsql;
