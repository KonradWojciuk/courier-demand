import os
import time
import pandas as pd
import s3fs
from datetime import datetime
from trino.dbapi import connect
import pyarrow as pa
import pyarrow.parquet as pq

# =========================
# CONFIG
# =========================

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET = os.getenv("WATCH_BUCKET", "datalake")

TRINO_HOST = os.getenv("TRINO_HOST", "trino")
TRINO_PORT = int(os.getenv("TRINO_PORT", "8080"))
TRINO_USER = os.getenv("TRINO_USER", "admin")
TRINO_CATALOG = os.getenv("TRINO_CATALOG", "hive")
TRINO_SCHEMA = os.getenv("TRINO_SCHEMA", "default")

TABLE_NAME = "shipments"

RAW_PATH = f"{BUCKET}/raw/"
BASE_PARQUET_PATH = f"{BUCKET}/parquet/{TABLE_NAME}/"

# -------------------------
# S3FS WITH CACHE DISABLED
# -------------------------
fs = s3fs.S3FileSystem(
    key=ACCESS_KEY,
    secret=SECRET_KEY,
    client_kwargs={"endpoint_url": MINIO_ENDPOINT},
    skip_instance_cache=True,
    use_listings_cache=False,
    cache_regions=False
)

# =========================
# TRINO EXEC
# =========================

def trino_exec(sql):
    conn = None
    try:
        conn = connect(
            host=TRINO_HOST,
            port=TRINO_PORT,
            user=TRINO_USER,
            catalog=TRINO_CATALOG,
            schema=TRINO_SCHEMA,
        )
        cur = conn.cursor()
        cur.execute(sql)
        cur.fetchall()
        cur.close()
    except Exception as e:
        print(f"[TRINO ERROR] Query failed:\n{sql}\nError: {e}")
        raise
    finally:
        if conn:
            conn.close()


# =========================
# CREATE TABLE IF NEEDED
# =========================

def ensure_table_exists():
    sql = f"""
    CREATE TABLE IF NOT EXISTS {TRINO_CATALOG}.{TRINO_SCHEMA}.{TABLE_NAME} (
        shipment_number VARCHAR,
        hour_of_shipment VARCHAR,
        sender_city VARCHAR,
        sender_country VARCHAR,
        sender_terminal VARCHAR,
        receiver_city VARCHAR,
        receiver_country VARCHAR,
        receiver_terminal VARCHAR,
        package_type VARCHAR,
        weight DOUBLE,
        size VARCHAR,
        sender_latitude DOUBLE,
        sender_longitude DOUBLE,
        receiver_latitude DOUBLE,
        receiver_longitude DOUBLE,
        date_of_shipment VARCHAR
    )
    WITH (
        external_location = 's3://{BASE_PARQUET_PATH}',
        format = 'PARQUET',
        partitioned_by = ARRAY['date_of_shipment']
    )
    """
    trino_exec(sql)
    print(f"[INFO] Table {TABLE_NAME} ensured in Trino")


# =========================
# SYNC PARTITIONS
# =========================

def sync_partitions(mode="ADD"):
    sql = (
        f"CALL system.sync_partition_metadata("
        f"'{TRINO_SCHEMA}', '{TABLE_NAME}', '{mode}')"
    )
    print(f"[INFO] Syncing partitions (mode={mode})...")
    try:
        trino_exec(sql)
        print("[INFO] Partitions synchronized")
    except Exception as e:
        # If sync fails, log warning but don't fail - partitions might already exist
        print(f"[WARN] Partition sync completed with warnings: {e}")
        # Don't re-raise - allow conversion to continue


# =========================
# CONVERSION
# =========================

def convert_csv_to_parquet(filename):
    if not filename.endswith(".csv"):
        return

    src = f"s3://{RAW_PATH}{filename}"

    try:
        print(f"[INFO] Reading CSV: {src}")

        df = pd.read_csv(
            src,
            storage_options={
                "key": ACCESS_KEY,
                "secret": SECRET_KEY,
                "client_kwargs": {"endpoint_url": MINIO_ENDPOINT},
            },
        )

        expected_cols = [
            "shipment_number", "date_of_shipment", "hour_of_shipment",
            "sender_city", "latitude", "longitude",
            "sender_country", "sender_terminal",
            "receiver_country", "package_type", "weight", "size",
            "receiver_city", "receiver_terminal",
            "receiver_latitude", "receiver_longitude"
        ]

        if not all(col in df.columns for col in expected_cols):
            print(f"[DEBUG] Columns in {filename}: {list(df.columns)}")
            print(f"[DEBUG] Missing columns: {[c for c in expected_cols if c not in df.columns]}")
            print(f"[WARN] {filename} has invalid columns. Skipping.")
            print("Columns:", df.columns.tolist())
            return

        # Rename lat/lon
        df.rename(columns={
            "latitude": "sender_latitude",
            "longitude": "sender_longitude",
        }, inplace=True)

        numeric_cols = ["weight", "sender_latitude", "sender_longitude",
                        "receiver_latitude", "receiver_longitude"]

        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        string_cols = [
            "shipment_number", "hour_of_shipment", "sender_city",
            "sender_country", "sender_terminal", "receiver_city",
            "receiver_country", "receiver_terminal", "package_type",
            "size", "date_of_shipment"
        ]
        df[string_cols] = df[string_cols].fillna("").astype(str)

        schema = pa.schema([
            ("shipment_number", pa.string()),
            ("hour_of_shipment", pa.string()),
            ("sender_city", pa.string()),
            ("sender_country", pa.string()),
            ("sender_terminal", pa.string()),
            ("receiver_city", pa.string()),
            ("receiver_country", pa.string()),
            ("receiver_terminal", pa.string()),
            ("package_type", pa.string()),
            ("weight", pa.float64()),
            ("size", pa.string()),
            ("sender_latitude", pa.float64()),
            ("sender_longitude", pa.float64()),
            ("receiver_latitude", pa.float64()),
            ("receiver_longitude", pa.float64()),
            ("date_of_shipment", pa.string())
        ])

        # Write partitions
        for date, group in df.groupby("date_of_shipment"):
            dst_file = (
                f"s3://{BASE_PARQUET_PATH}"
                f"date_of_shipment={date}/"
                f"{filename.replace('.csv', f'_{date}.parquet')}"
            )

            print(f"[INFO] Saving Parquet for date {date}: {dst_file}")

            table = pa.Table.from_pandas(group, schema=schema, preserve_index=False)
            with fs.open(dst_file, "wb") as f:
                pq.write_table(table, f)

        print(f"[OK] Converted {filename} -> {len(df['date_of_shipment'].unique())} partitions")

        ensure_table_exists()
        try:
            sync_partitions("ADD")
        except Exception as sync_error:
            print(f"[WARN] Partition sync failed (non-critical): {sync_error}")
            # Continue even if sync fails - partitions might already exist

    except Exception as e:
        print(f"[ERROR] Conversion failed for {filename}: {e}")


# =========================
# POLLER WITH CACHE INVALIDATION
# =========================

class MinioPoller:
    def poll(self):
        while True:
            try:
                # Force fresh listing
                fs.invalidate_cache(RAW_PATH)

                files = [
                    f for f in fs.ls(RAW_PATH)
                    if f.endswith(".csv") and not fs.exists(f + ".done")
                ]

                for f in files:
                    fname = f.split("/")[-1]
                    convert_csv_to_parquet(fname)

                    # Create .done flag
                    done_path = f"s3://{RAW_PATH}{fname}.done"
                    with fs.open(done_path, "w") as df:
                        df.write("processed")

                    print(f"[INFO] Flag created: {done_path}")

            except Exception as e:
                print(f"[WARN] Poll error: {e}")

            time.sleep(10)


# =========================
# MAIN
# =========================

if __name__ == "__main__":
    print(f"[INFO] Poller started, watching: s3://{RAW_PATH}")
    ensure_table_exists()
    MinioPoller().poll()
    
