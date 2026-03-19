import os
from io import StringIO
from pathlib import Path

import pandas as pd
import requests

# ========= 你要用的資料網址 =========
# 這兩個是 OWID 的 grapher CSV，來源標示為 FAO
URL_UNDER = "https://ourworldindata.org/grapher/prevalence-of-undernourishment.csv"
URL_SEVERE = "https://ourworldindata.org/grapher/share-of-population-with-severe-food-insecurity.csv"

# 你的國家清單來源
INPUT_COUNTRY_FILE = "number-healthy-diet-unaffordable.csv"

# 輸出資料夾
OUTPUT_DIR = "output_country_csvs"

# ========= 下載函式 =========
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/csv,application/csv,text/plain,*/*",
    "Referer": "https://ourworldindata.org/"
}


def download_csv(url: str) -> pd.DataFrame:
    print(f"Downloading: {url}")
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return pd.read_csv(StringIO(r.text))


# ========= 讀取國家清單 =========
def load_requested_entities(filepath: str) -> list[str]:
    df = pd.read_csv(filepath)

    # 盡量自動找國家欄位
    possible_cols = [
        "Entity", "entity",
        "Country", "country",
        "Country Name", "country_name"
    ]
    for col in possible_cols:
        if col in df.columns:
            country_col = col
            break
    else:
        raise ValueError(
            f"找不到國家欄位。請確認 {filepath} 裡有以下其中一欄：{possible_cols}"
        )

    countries = (
        df[country_col]
        .dropna()
        .astype(str)
        .str.strip()
        .unique()
        .tolist()
    )
    return countries


# ========= 清理欄位 =========
def normalize_owid_under(df: pd.DataFrame) -> pd.DataFrame:
    # OWID 典型欄位: Entity, Code, Year, Prevalence of undernourishment (%)
    value_col = None
    for c in df.columns:
        if "undernourishment" in c.lower():
            value_col = c
            break
    if value_col is None:
        raise ValueError("找不到 undernourishment 的數值欄位")

    out = df.rename(columns={
        "Entity": "country",
        "Code": "iso3",
        "Year": "year",
        value_col: "prevalence_of_undernourishment_percent_3yr_avg"
    })[["country", "iso3", "year", "prevalence_of_undernourishment_percent_3yr_avg"]]

    return out


def normalize_owid_severe(df: pd.DataFrame) -> pd.DataFrame:
    # OWID 典型欄位: Entity, Code, Year, Prevalence of severe food insecurity...
    value_col = None
    for c in df.columns:
        if "severe food insecurity" in c.lower():
            value_col = c
            break
    if value_col is None:
        raise ValueError("找不到 severe food insecurity 的數值欄位")

    out = df.rename(columns={
        "Entity": "country",
        "Code": "iso3",
        "Year": "year",
        value_col: "prevalence_of_severe_food_insecurity_percent_3yr_avg"
    })[["country", "iso3", "year", "prevalence_of_severe_food_insecurity_percent_3yr_avg"]]

    return out


# ========= 主程式 =========
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Loading country list...")
    requested = load_requested_entities(INPUT_COUNTRY_FILE)
    print(f"Found {len(requested)} requested countries/regions")

    print("Downloading datasets...")
    under_raw = download_csv(URL_UNDER)
    severe_raw = download_csv(URL_SEVERE)

    under = normalize_owid_under(under_raw)
    severe = normalize_owid_severe(severe_raw)

    # 合併
    merged = pd.merge(
        under,
        severe,
        on=["country", "iso3", "year"],
        how="outer"
    )

    # 篩選你檔案裡有的國家或地區
    selected = merged[merged["country"].isin(requested)].copy()

    # 輸出總表
    combined_path = Path("combined_selected_countries.csv")
    selected.to_csv(combined_path, index=False, encoding="utf-8-sig")
    print(f"Saved: {combined_path}")

    # 每個國家各一份
    matched_countries = sorted(selected["country"].dropna().unique())
    for country in matched_countries:
        safe_name = (
            country.replace("/", "_")
                   .replace("\\", "_")
                   .replace(":", "_")
                   .replace("*", "_")
                   .replace("?", "_")
                   .replace('"', "_")
                   .replace("<", "_")
                   .replace(">", "_")
                   .replace("|", "_")
        )
        out_path = Path(OUTPUT_DIR) / f"{safe_name}.csv"
        selected[selected["country"] == country].sort_values("year").to_csv(
            out_path, index=False, encoding="utf-8-sig"
        )

    # 未匹配清單
    found_set = set(matched_countries)
    unmatched = [c for c in requested if c not in found_set]
    unmatched_df = pd.DataFrame({"unmatched_country_or_region": unmatched})
    unmatched_path = Path("unmatched_entities.csv")
    unmatched_df.to_csv(unmatched_path, index=False, encoding="utf-8-sig")
    print(f"Saved: {unmatched_path}")

    print("Done.")
    print(f"Matched countries: {len(matched_countries)}")
    print(f"Unmatched countries: {len(unmatched)}")


if __name__ == "__main__":
    main()