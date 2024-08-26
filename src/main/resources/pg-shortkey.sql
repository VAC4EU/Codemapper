-- by Nathan Fritz (andyet.com); turbo (github.com/turbo)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- can't query pg_type because type might exist in other schemas
-- no IF NOT EXISTS for CREATE DOMAIN, need to catch exception
DO $$ BEGIN
  CREATE DOMAIN SHORTKEY as varchar(11);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION shortkey_generate()
RETURNS SHORTKEY as $$
DECLARE
  gkey TEXT;
BEGIN
  -- 8 bytes gives a collision p = .5 after 5.1 x 10^9 values
  gkey := encode(gen_random_bytes(8), 'base64');
  gkey := lower(gkey);
  gkey := replace(gkey, '/', '-');  -- url safe replacement
  gkey := replace(gkey, '+', '-');  -- url safe replacement
  RETURN rtrim(gkey, '=');          -- cut off padding
END
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION shortkey_trigger()
RETURNS TRIGGER AS $$
DECLARE
  key SHORTKEY;
  qry TEXT;
  found TEXT;
  user_key BOOLEAN;
BEGIN
  -- generate the first part of a query as a string with safely
  -- escaped table name, using || to concat the parts
  qry := 'SELECT shortkey FROM ' || quote_ident(TG_TABLE_NAME) || ' WHERE shortkey=';

  LOOP
    -- deal with user-supplied keys, they don't have to be valid base64
    -- only the right length for the type
    IF NEW.shortkey IS NOT NULL THEN
      key := NEW.shortkey;
      user_key := TRUE;

      IF length(key) <> 11 THEN
        RAISE 'User defined key value % has invalid length. Expected 11, got %.', key, length(key);
      END IF;
    ELSE
      key := shortkey_generate();
      user_key := FALSE;
    END IF;

    -- Concat the generated key (safely quoted) with the generated query
    -- and run it.
    -- SELECT shortkey FROM "test" WHERE shortkey='blahblah' INTO found
    -- Now "found" will be the duplicated shortkey or NULL.
    EXECUTE qry || quote_literal(key) INTO found;

    -- Check to see if found is NULL.
    -- If we checked to see if found = NULL it would always be FALSE
    -- because (NULL = NULL) is always FALSE.
    IF found IS NULL THEN
      -- If we didn't find a collision then leave the LOOP.
      EXIT;
    END IF;

    IF user_key THEN
      -- User supplied ID but it violates the PK unique constraint
      RAISE 'Shortkey % already exists in table %', key, TG_TABLE_NAME;
    END IF;

    -- We haven't EXITed yet, so return to the top of the LOOP
    -- and try again.
  END LOOP;

  -- NEW and OLD are available in TRIGGER PROCEDURES.
  -- NEW is the mutated row that will actually be INSERTed.
  -- We're replacing key, regardless of what it was before
  -- with our key variable.
  NEW.shortkey = key;

  -- The RECORD returned here is what will actually be INSERTed,
  -- or what the next trigger will get if there is one.
  RETURN NEW;
END
$$ language 'plpgsql';

-- DROP TABLE IF EXISTS test1;
-- CREATE TABLE test1 (
--   name TEXT NOT NULL,
--   shortkey SHORTKEY NOT NULL,
--   unique (shortkey)
-- );

-- CREATE TRIGGER test1_shortkey
-- BEFORE INSERT ON test1
-- FOR EACH ROW EXECUTE PROCEDURE shortkey_trigger();

-- INSERT INTO test1 (name) VALUES ('hooo');

-- DROP TABLE IF EXISTS test2;
-- CREATE TABLE test2 (
--   name TEXT
-- );

-- INSERT INTO test2 (name) VALUES ('foo');
-- INSERT INTO test2 (name) VALUES ('bar');

-- ALTER TABLE test2 ADD COLUMN shortkey SHORTKEY;
-- UPDATE test2 SET shortkey = shortkey_generate();
-- ALTER TABLE test2 ALTER COLUMN shortkey SET NOT NULL;
-- CREATE TRIGGER test2_shortkey
-- BEFORE INSERT ON test2
-- FOR EACH ROW EXECUTE PROCEDURE shortkey_trigger();

-- CREATE TRIGGER shortkey_test
-- BEFORE INSERT ON case_definitions
-- FOR EACH ROW EXECUTE PROCEDURE shortkey_trigger();
