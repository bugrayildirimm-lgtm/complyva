#!/bin/bash
# =============================================
# Complyva Nightly Database Backup
# =============================================

# Load env
set -a
source /home/ubuntu/complyva/apps/api/.env
set +a

BACKUP_DIR="/home/ubuntu/complyva/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
FILENAME="complyva_backup_${TIMESTAMP}.sql.gz"
KEEP_DAYS=30

# Create backup dir
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Dump and compress
pg_dump "$DATABASE_URL" --no-owner --no-privileges 2>/dev/null | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ] && [ -s "$BACKUP_DIR/$FILENAME" ]; then
  SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
  echo "[$(date)] Backup successful: $FILENAME ($SIZE)"
else
  echo "[$(date)] ERROR: Backup failed!"
  rm -f "$BACKUP_DIR/$FILENAME"
  exit 1
fi

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "complyva_backup_*.sql.gz" -mtime +$KEEP_DAYS -delete
REMAINING=$(ls "$BACKUP_DIR"/complyva_backup_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Cleanup done. $REMAINING backups retained."
