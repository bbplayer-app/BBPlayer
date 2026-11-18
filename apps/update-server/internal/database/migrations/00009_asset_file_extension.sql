-- +goose Up
-- expo-updates reads `fileExtension` as a required field of every non-launch
-- manifest asset and silently drops assets without it. Store the extension the
-- export reported (with its leading dot, as the protocol expects). Older rows
-- never recorded it, so recover it from the content type where unambiguous;
-- the rest stay empty, which clients still accept.
ALTER TABLE assets ADD COLUMN file_extension text NOT NULL DEFAULT '';
UPDATE assets SET file_extension = CASE split_part(content_type, ';', 1)
    WHEN 'image/png' THEN '.png'
    WHEN 'image/jpeg' THEN '.jpg'
    WHEN 'image/gif' THEN '.gif'
    WHEN 'image/webp' THEN '.webp'
    WHEN 'image/svg+xml' THEN '.svg'
    WHEN 'text/xml' THEN '.xml'
    WHEN 'application/xml' THEN '.xml'
    WHEN 'application/json' THEN '.json'
    WHEN 'font/ttf' THEN '.ttf'
    WHEN 'font/otf' THEN '.otf'
    WHEN 'application/javascript' THEN '.bundle'
    ELSE ''
END;

-- +goose Down
ALTER TABLE assets DROP COLUMN file_extension;
